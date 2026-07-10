import webpush from "web-push";
import {
  getDayOfWeekInTimeZone,
  getTimePartsInTimeZone,
  todayYmdInTimeZone,
} from "@shared/timezone";
import {
  buildReminderMinuteSlots,
  minutesToScheduleTime,
  resolveScheduleExitTime,
  scheduleTimeToMinutes,
} from "@shared/scheduleExit";
import { getDb } from "./db";
import { pushSubscriptions, notificationLogs, schedules, timeclocks } from "../drizzle/schema";
import { eq, and, isNull, sql } from "drizzle-orm";

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

type NotificationOptions = {
  timeZone?: string;
  leadMinutes?: number;
  lookbackMinutes?: number;
};

const DEFAULT_TIME_ZONE = "Europe/Madrid";
const DEFAULT_LEAD_MINUTES = 1;
const DEFAULT_LOOKBACK_MINUTES = 65;

/** Distingue logs de salida de los de entrada en notification_logs.entrySlot */
const EXIT_LOG_SLOT_OFFSET = 100;

function formatMinutesToTime(minutes: number) {
  return minutesToScheduleTime(minutes);
}

export async function sendPushNotification(
  subscription: PushSubscriptionData,
  title: string,
  body: string,
  data?: Record<string, unknown>
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
  } catch (error: unknown) {
    const statusCode =
      error && typeof error === "object" && "statusCode" in error
        ? Number((error as { statusCode?: number }).statusCode)
        : 0;
    if ([400, 401, 403, 404, 410].includes(statusCode)) {
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

type ScheduleRow = typeof schedules.$inferSelect;

function groupSchedulesByEmployeeDay(rows: ScheduleRow[]) {
  const map = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    const key = `${row.employeeId}:${row.dayOfWeek}`;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.entrySlot - b.entrySlot);
  }
  return map;
}

function resolveExitForSchedule(row: ScheduleRow, siblings: ScheduleRow[]) {
  const nextEntry =
    siblings.find((sibling) => sibling.entrySlot > row.entrySlot && sibling.isWorkDay)?.entryTime ??
    null;
  return resolveScheduleExitTime({
    entryTime: row.entryTime,
    exitTime: row.exitTime,
    nextEntryTime: nextEntry,
  });
}

async function wasReminderSent(params: {
  companyId: number;
  employeeId: number;
  reminderTime: string;
  scheduleDate: string;
  logSlot: number;
}) {
  const db = await getDb();
  if (!db) return true;

  const existing = await db
    .select({ id: notificationLogs.id })
    .from(notificationLogs)
    .where(
      and(
        eq(notificationLogs.companyId, params.companyId),
        eq(notificationLogs.employeeId, params.employeeId),
        eq(notificationLogs.entryTime, params.reminderTime),
        eq(notificationLogs.scheduleDate, params.scheduleDate),
        eq(notificationLogs.entrySlot, params.logSlot)
      )
    )
    .limit(1);

  return existing.length > 0;
}

async function logReminderSent(params: {
  companyId: number;
  employeeId: number;
  reminderTime: string;
  scheduleDate: string;
  logSlot: number;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notificationLogs).values({
    companyId: params.companyId,
    employeeId: params.employeeId,
    entryTime: params.reminderTime,
    scheduleDate: params.scheduleDate,
    entrySlot: params.logSlot,
  });
}

async function getEmployeeSubscriptions(companyId: number, employeeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.companyId, companyId),
        eq(pushSubscriptions.employeeId, employeeId)
      )
    );
}

async function notifyEmployee(params: {
  companyId: number;
  employeeId: number;
  title: string;
  body: string;
  reminderTime: string;
  scheduleDate: string;
  logSlot: number;
  data?: Record<string, unknown>;
}) {
  if (
    await wasReminderSent({
      companyId: params.companyId,
      employeeId: params.employeeId,
      reminderTime: params.reminderTime,
      scheduleDate: params.scheduleDate,
      logSlot: params.logSlot,
    })
  ) {
    return;
  }

  const subscriptions = await getEmployeeSubscriptions(params.companyId, params.employeeId);
  if (subscriptions.length === 0) return;

  for (const sub of subscriptions) {
    try {
      await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        params.title,
        params.body,
        {
          url: "/employee/dashboard",
          tag: `timeclock-${params.logSlot}-${params.scheduleDate}-${params.reminderTime}-${params.employeeId}`,
          ...params.data,
        }
      );
      await logReminderSent({
        companyId: params.companyId,
        employeeId: params.employeeId,
        reminderTime: params.reminderTime,
        scheduleDate: params.scheduleDate,
        logSlot: params.logSlot,
      });
    } catch (error) {
      console.error(`Failed to send notification to employee ${params.employeeId}:`, error);
    }
  }
}

function isReminderDue(
  currentMinutes: number,
  reminderMinute: number,
  lookbackMinutes: number
): boolean {
  const diff = currentMinutes - reminderMinute;
  return diff >= 0 && diff <= lookbackMinutes;
}

/**
 * Recordatorios push de fichaje: entrada y salida, 1 min antes y a la hora.
 * Ejecutar cada minuto vía cron (GET /api/cron/notifications).
 */
export async function checkAndSendNotifications(
  options: NotificationOptions = {}
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const timeZone = options.timeZone || DEFAULT_TIME_ZONE;
  const leadMinutes = Math.max(0, options.leadMinutes ?? DEFAULT_LEAD_MINUTES);
  const lookbackMinutes = Math.max(1, options.lookbackMinutes ?? DEFAULT_LOOKBACK_MINUTES);
  const leadTimeLabel =
    leadMinutes === 1 ? "1 minuto" : leadMinutes > 1 ? `${leadMinutes} minutos` : "";
  const { hour, minute } = getTimePartsInTimeZone(now, timeZone);
  const currentDay = getDayOfWeekInTimeZone(now, timeZone);
  const currentMinutes = hour * 60 + minute;
  const todayDate = todayYmdInTimeZone(timeZone, now);

  const todaySchedules = await db
    .select()
    .from(schedules)
    .where(and(eq(schedules.dayOfWeek, currentDay), eq(schedules.isWorkDay, true)));

  const schedulesByEmployeeDay = groupSchedulesByEmployeeDay(todaySchedules);

  const openTimeclocks = await db
    .select()
    .from(timeclocks)
    .where(isNull(timeclocks.exitTime));

  const openClockByEmployee = new Map<number, boolean>();
  for (const clock of openTimeclocks) {
    if (!clock.entryTime) continue;
    const entryDateKey = todayYmdInTimeZone(timeZone, new Date(clock.entryTime));
    if (entryDateKey === todayDate) {
      openClockByEmployee.set(clock.employeeId, true);
    }
  }

  for (const schedule of todaySchedules) {
    const siblings =
      schedulesByEmployeeDay.get(`${schedule.employeeId}:${schedule.dayOfWeek}`) ?? [schedule];
    const scheduleMinutes = scheduleTimeToMinutes(schedule.entryTime);
    if (scheduleMinutes == null) continue;

    const hasOpenClock = openClockByEmployee.get(schedule.employeeId) === true;

    // --- Entrada: solo si aún no ha fichado hoy ---
    if (!hasOpenClock) {
      const todayTimeclocks = await db
        .select({ id: timeclocks.id, entryTime: timeclocks.entryTime, exitTime: timeclocks.exitTime })
        .from(timeclocks)
        .where(
          and(
            eq(timeclocks.companyId, schedule.companyId),
            eq(timeclocks.employeeId, schedule.employeeId),
            sql`${timeclocks.entryTime}::date = ${todayDate}::date`
          )
        );

      const hasClockedIn = todayTimeclocks.some((tc) => tc.entryTime && !tc.exitTime);
      if (!hasClockedIn) {
        for (const reminderMinute of buildReminderMinuteSlots(scheduleMinutes, leadMinutes)) {
          if (!isReminderDue(currentMinutes, reminderMinute, lookbackMinutes)) continue;

          const reminderTime = formatMinutesToTime(reminderMinute);
          const isLeadReminder = reminderMinute !== scheduleMinutes;
          await notifyEmployee({
            companyId: schedule.companyId,
            employeeId: schedule.employeeId,
            title: "⏰ Hora de entrada",
            body: isLeadReminder
              ? `En ${leadTimeLabel} toca fichar entrada (${schedule.entryTime})`
              : `Es hora de registrar tu entrada (${schedule.entryTime})`,
            reminderTime,
            scheduleDate: todayDate,
            logSlot: schedule.entrySlot,
            data: {
              entryTime: schedule.entryTime,
              entrySlot: schedule.entrySlot,
              reminderType: isLeadReminder ? `entry_lead_${leadMinutes}m` : "entry_on_time",
            },
          });
        }
      }
    }

    // --- Salida: solo si tiene fichaje abierto hoy ---
    if (!hasOpenClock) continue;

    const exitTime = resolveExitForSchedule(schedule, siblings);
    const exitMinutes = exitTime ? scheduleTimeToMinutes(exitTime) : null;
    if (exitMinutes == null) continue;

    for (const reminderMinute of buildReminderMinuteSlots(exitMinutes, leadMinutes)) {
      if (!isReminderDue(currentMinutes, reminderMinute, lookbackMinutes)) continue;

      const reminderTime = formatMinutesToTime(reminderMinute);
      const isLeadReminder = reminderMinute !== exitMinutes;
      await notifyEmployee({
        companyId: schedule.companyId,
        employeeId: schedule.employeeId,
        title: "⏰ Hora de salida",
        body: isLeadReminder
          ? `En ${leadTimeLabel} toca fichar salida (${exitTime})`
          : `Es hora de registrar tu salida (${exitTime})`,
        reminderTime,
        scheduleDate: todayDate,
        logSlot: EXIT_LOG_SLOT_OFFSET + schedule.entrySlot,
        data: {
          exitTime,
          entrySlot: schedule.entrySlot,
          reminderType: isLeadReminder ? `exit_lead_${leadMinutes}m` : "exit_on_time",
        },
      });
    }
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}
