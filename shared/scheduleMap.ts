export type DaySchedulePayload = {
  entry1: string;
  entry2: string;
  exit1: string;
  exit2: string;
  isActive: boolean;
};

export const SCHEDULE_DAY_KEYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

export type ScheduleDayKey = (typeof SCHEDULE_DAY_KEYS)[number];

export function emptyDaySchedule(isActive = true): DaySchedulePayload {
  return { entry1: "", entry2: "", exit1: "", exit2: "", isActive };
}

export function rowsToScheduleMap(
  rows: Array<{
    dayOfWeek: number;
    entryTime: string;
    exitTime?: string | null;
    entrySlot: number;
    isWorkDay: boolean;
  }>
): Record<string, DaySchedulePayload> {
  const scheduleMap: Record<string, DaySchedulePayload> = {};

  for (const row of rows) {
    const key = SCHEDULE_DAY_KEYS[row.dayOfWeek] ?? "monday";
    if (!scheduleMap[key]) {
      scheduleMap[key] = emptyDaySchedule(row.isWorkDay);
    }
    if (!row.isWorkDay) {
      scheduleMap[key].isActive = false;
      continue;
    }
    if (row.entrySlot === 2) {
      scheduleMap[key].entry2 = row.entryTime;
      scheduleMap[key].exit2 = row.exitTime ?? "";
    } else {
      scheduleMap[key].entry1 = row.entryTime;
      scheduleMap[key].exit1 = row.exitTime ?? "";
    }
  }

  return scheduleMap;
}

export const dayScheduleValueSchema = {
  entry1: undefined as string | undefined,
  entry2: undefined as string | undefined,
  exit1: undefined as string | undefined,
  exit2: undefined as string | undefined,
  isActive: false as boolean,
};

export function normalizeDayScheduleValue(
  rawValue: string | Partial<typeof dayScheduleValueSchema>
): DaySchedulePayload {
  if (typeof rawValue === "string") {
    return {
      entry1: rawValue,
      entry2: "",
      exit1: "",
      exit2: "",
      isActive: rawValue.trim().length > 0,
    };
  }
  return {
    entry1: rawValue.entry1 ?? "",
    entry2: rawValue.entry2 ?? "",
    exit1: rawValue.exit1 ?? "",
    exit2: rawValue.exit2 ?? "",
    isActive: rawValue.isActive ?? true,
  };
}

const DAY_OF_WEEK_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

export type ScheduleInsertRow = {
  companyId: number;
  employeeId: number;
  dayOfWeek: number;
  entryTime: string;
  exitTime: string | null;
  isWorkDay: boolean;
  entrySlot: number;
};

export function buildScheduleInsertRows(params: {
  companyId: number;
  employeeId: number;
  schedule: Record<string, string | Partial<typeof dayScheduleValueSchema>>;
}): ScheduleInsertRow[] {
  const rows: ScheduleInsertRow[] = [];

  for (const [dayKey, rawValue] of Object.entries(params.schedule)) {
    const value = normalizeDayScheduleValue(rawValue);
    const dayOfWeek = DAY_OF_WEEK_MAP[dayKey];
    if (dayOfWeek === undefined) continue;

    if (!value.isActive) {
      rows.push({
        companyId: params.companyId,
        employeeId: params.employeeId,
        dayOfWeek,
        entryTime: "00:00",
        exitTime: null,
        isWorkDay: false,
        entrySlot: 1,
      });
      continue;
    }

    if (value.entry1) {
      rows.push({
        companyId: params.companyId,
        employeeId: params.employeeId,
        dayOfWeek,
        entryTime: value.entry1,
        exitTime: value.exit1 || null,
        isWorkDay: true,
        entrySlot: 1,
      });
    }
    if (value.entry2) {
      rows.push({
        companyId: params.companyId,
        employeeId: params.employeeId,
        dayOfWeek,
        entryTime: value.entry2,
        exitTime: value.exit2 || null,
        isWorkDay: true,
        entrySlot: 2,
      });
    }
  }

  return rows;
}
