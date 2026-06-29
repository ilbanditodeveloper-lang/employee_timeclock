import webpush from "web-push";
import {
  getDayOfWeekInTimeZone,
  getTimePartsInTimeZone,
  todayYmdInTimeZone,
} from "@shared/timezone";
import { getDb } from "./db";
import { pushSubscriptions, notificationLogs, schedules, timeclocks } from "../drizzle/schema";
import { eq, and, gte, lt, inArray, isNull, sql } from "drizzle-orm";

// VAPID keys - these should be set as environment variables
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@timeclock.app";

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to an employee
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  title: string,
  body: string,
  data?: Record<string, any>
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
        },
      },
      JSON.stringify({
        title,
        body,
        icon: "/icon.svg",
        badge: "/icon.svg",
        tag: typeof data?.tag === "string" ? data.tag : "timeclock-notification",
        data: data || {},
      })
    );
  } catch (error: any) {
    // Remove invalid subscriptions so the client can re-subscribe with a fresh endpoint.
    if ([400, 401, 403, 404, 410].includes(error.statusCode)) {
      const db = await getDb();
      if (db) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
      }
    }
    throw error;
  }
}

/**
 * Check and send notifications for employees who need to clock in.
 * Push: endpoint is globally unique per browser; same browser in another company
 * reassigns the subscription to the latest employee (publicApi.pushNotifications.subscribe).
 * This should be called periodically (e.g., every minute via cron).
 */
type NotificationOptions = {
  timeZone?: string;
  leadMinutes?: number;
  lookbackMinutes?: number;
};

const DEFAULT_TIME_ZONE = "Europe/Madrid";
const DEFAULT_ENTRY_LEAD_MINUTES = 5;
const DEFAULT_LOOKBACK_MINUTES = 65;
const EXIT_REMINDER_STARTS = [
  { time: "15:30", intervalMinutes: 30, repeats: 3 },
  { time: "22:30", intervalMinutes: 30, repeats: 3 },
];
const EXIT_REMINDER_SLOT = 0;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseTimeToMinutes(time: string) {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function formatMinutesToTime(minutes: number) {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function buildExitReminderSlots() {
  const slots: Array<{ minuteOfDay: number; scheduleDateOffset: number }> = [];
  for (const start of EXIT_REMINDER_STARTS) {
    const baseMinutes = parseTimeToMinutes(start.time);
    for (let i = 0; i <= start.repeats; i += 1) {
      const total = baseMinutes + i * start.intervalMinutes;
      const minuteOfDay = total % 1440;
      const scheduleDateOffset = total >= 1440 ? -1 : 0;
      slots.push({ minuteOfDay, scheduleDateOffset });
    }
  }
  return slots;
}

function getWrappedMinuteDiff(currentMinuteOfDay: number, slotMinuteOfDay: number) {
  return ((currentMinuteOfDay - slotMinuteOfDay) + 1440) % 1440;
}

function buildEntryReminderSlots(scheduleTime: number, leadMinutes: number) {
  const slots = new Set<number>();
  slots.add(scheduleTime);
  slots.add(scheduleTime - leadMinutes);
  return Array.from(slots).map((minute) => ((minute % 1440) + 1440) % 1440);
}

export async function checkAndSendNotifications(
  options: NotificationOptions = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  const leadMinutes = Math.max(0, options.leadMinutes ?? DEFAULT_ENTRY_LEAD_MINUTES);
  const lookbackMinutes = Math.max(1, options.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES);
  const { hour, minute } = getTimePartsInTimeZone(now, timeZone);
  const currentDay = getDayOfWeekInTimeZone(now, timeZone);
  const currentHour = hour;
  const currentMinute = minute;
  const todayDate = todayYmdInTimeZone(timeZone, now);

  // Get all active employees with schedules for today
  const todaySchedules = await db
    .select()
    .from(schedules)
    .where(
      and(
        eq(schedules.dayOfWeek, currentDay),
        eq(schedules.isWorkDay, true)
      )
    );

  for (const schedule of todaySchedules) {
    const [scheduleHour, scheduleMinute] = schedule.entryTime.split(":").map(Number);
    const scheduleTime = scheduleHour * 60 + scheduleMinute;
    const currentTime = currentHour * 60 + currentMinute;
    const reminderSlots = buildEntryReminderSlots(scheduleTime, leadMinutes);

    const todayYmd = todayYmdInTimeZone(timeZone, now);

    const todayTimeclocks = await db
      .select()
      .from(timeclocks)
      .where(
        and(
          eq(timeclocks.companyId, schedule.companyId),
          eq(timeclocks.employeeId, schedule.employeeId),
          sql`${timeclocks.entryTime}::date = ${todayYmd}::date`
        )
      );

    const hasClockedIn = todayTimeclocks.some(
      (tc) => tc.entryTime && !tc.exitTime
    );
    if (hasClockedIn) {
      continue;
    }

    for (const reminderMinute of reminderSlots) {
      const reminderTime = formatMinutesToTime(reminderMinute);
      const timeDiff = currentTime - reminderMinute;
      if (timeDiff < 0 || timeDiff > lookbackMinutes) {
        continue;
      }

      const existingLog = await db
        .select()
        .from(notificationLogs)
        .where(
          and(
            eq(notificationLogs.companyId, schedule.companyId),
            eq(notificationLogs.employeeId, schedule.employeeId),
            eq(notificationLogs.entryTime, reminderTime),
            eq(notificationLogs.scheduleDate, todayDate),
            eq(notificationLogs.entrySlot, schedule.entrySlot)
          )
        )
        .limit(1);
      if (existingLog.length > 0) {
        continue;
      }

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.companyId, schedule.companyId),
            eq(pushSubscriptions.employeeId, schedule.employeeId)
          )
        );

      const isLeadReminder = reminderMinute !== scheduleTime;
      const body = isLeadReminder
        ? `En 5 minutos toca fichar entrada (${schedule.entryTime})`
        : `Es hora de registrar tu entrada (${schedule.entryTime})`;

      for (const sub of subscriptions) {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            "⏰ Hora de entrada",
            body,
            {
              url: "/employee/dashboard",
              entryTime: schedule.entryTime,
              entrySlot: schedule.entrySlot,
              reminderType: isLeadReminder ? "lead_5m" : "on_time",
            }
          );

          await db.insert(notificationLogs).values({
            companyId: schedule.companyId,
            employeeId: schedule.employeeId,
            entryTime: reminderTime,
            scheduleDate: todayDate,
            entrySlot: schedule.entrySlot,
          });
        } catch (error) {
          console.error(`Failed to send notification to employee ${schedule.employeeId}:`, error);
        }
      }
    }
  }

  const exitReminderSlots = buildExitReminderSlots();
  const currentMinutes = currentHour * 60 + currentMinute;
  const exitLookback = Math.max(lookbackMinutes, 70);
  const matchingSlots = exitReminderSlots
    .map(slot => {
      const diff = getWrappedMinuteDiff(currentMinutes, slot.minuteOfDay);
      return { ...slot, diff };
    })
    .filter(slot => slot.diff <= exitLookback);

  if (matchingSlots.length === 0) return;

  const openTimeclocks = await db
    .select()
    .from(timeclocks)
    .where(isNull(timeclocks.exitTime));

  if (openTimeclocks.length === 0) return;

  const openByEmployee = new Map<number, Array<(typeof openTimeclocks)[number]>>();
  for (const clock of openTimeclocks) {
    if (!clock.entryTime) continue;
    const list = openByEmployee.get(clock.employeeId) || [];
    list.push(clock);
    openByEmployee.set(clock.employeeId, list);
  }

  const yesterdayDateKey = todayYmdInTimeZone(timeZone, new Date(now.getTime() - 86400000));

  for (const slot of matchingSlots) {
    const reminderDateKey = slot.scheduleDateOffset === 0 ? todayDate : yesterdayDateKey;
    const reminderTime = formatMinutesToTime(slot.minuteOfDay);

    const candidateEmployeeIds: number[] = [];
    for (const [employeeId, clocks] of openByEmployee.entries()) {
      const hasOpenOnDate = clocks.some((clock) => {
        if (!clock.entryTime) return false;
        const entryDateKey = todayYmdInTimeZone(timeZone, new Date(clock.entryTime));
        return entryDateKey === reminderDateKey;
      });
      if (hasOpenOnDate) {
        candidateEmployeeIds.push(employeeId);
      }
    }

    if (candidateEmployeeIds.length === 0) continue;

    const existingLogs = await db
      .select()
      .from(notificationLogs)
      .where(
        and(
          inArray(notificationLogs.employeeId, candidateEmployeeIds),
          eq(notificationLogs.entrySlot, EXIT_REMINDER_SLOT),
          eq(notificationLogs.entryTime, reminderTime),
          eq(notificationLogs.scheduleDate, reminderDateKey)
        )
      );
    const alreadyNotified = new Set(existingLogs.map(log => log.employeeId));

    for (const employeeId of candidateEmployeeIds) {
      if (alreadyNotified.has(employeeId)) continue;
      const clocks = openByEmployee.get(employeeId);
      const companyId = clocks?.[0]?.companyId;
      if (!companyId) continue;

      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.companyId, companyId),
            eq(pushSubscriptions.employeeId, employeeId)
          )
        );

      if (subscriptions.length === 0) continue;

      for (const sub of subscriptions) {
        try {
          await sendPushNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            "⏰ Recuerda fichar la salida",
            "No olvides registrar tu salida cuando termines.",
            {
              url: "/employee/dashboard",
              tag: `timeclock-exit-${reminderDateKey}-${reminderTime}-${employeeId}`,
            }
          );

          await db.insert(notificationLogs).values({
            companyId,
            employeeId,
            entryTime: reminderTime,
            scheduleDate: reminderDateKey,
            entrySlot: EXIT_REMINDER_SLOT,
          });
        } catch (error) {
          console.error(`Failed to send exit reminder to employee ${employeeId}:`, error);
        }
      }
    }
  }
}

/**
 * Get VAPID public key for client-side subscription
 */
export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
