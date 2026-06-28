export type DaySchedule = { entry1: string; entry2: string; isActive: boolean };
export type WeekSchedule = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export function createEmptySchedule(): WeekSchedule {
  return {
    monday: { entry1: "", entry2: "", isActive: true },
    tuesday: { entry1: "", entry2: "", isActive: true },
    wednesday: { entry1: "", entry2: "", isActive: true },
    thursday: { entry1: "", entry2: "", isActive: true },
    friday: { entry1: "", entry2: "", isActive: true },
    saturday: { entry1: "", entry2: "", isActive: true },
    sunday: { entry1: "", entry2: "", isActive: true },
  };
}

/** Horario laboral por defecto: L–V 09:00, fin de semana libre. */
export function createDefaultEmployeeSchedule(): WeekSchedule {
  const schedule = createEmptySchedule();
  for (const day of ["monday", "tuesday", "wednesday", "thursday", "friday"] as const) {
    schedule[day] = { entry1: "09:00", entry2: "", isActive: true };
  }
  schedule.saturday = { entry1: "", entry2: "", isActive: false };
  schedule.sunday = { entry1: "", entry2: "", isActive: false };
  return schedule;
}

const STORAGE_PREFIX = "timeclock:default-schedule:";

export function loadDefaultSchedule(companySlug: string): WeekSchedule {
  if (typeof localStorage === "undefined") return createDefaultEmployeeSchedule();
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${companySlug}`);
    if (!raw) return createDefaultEmployeeSchedule();
    const parsed = JSON.parse(raw) as Partial<WeekSchedule>;
    return { ...createDefaultEmployeeSchedule(), ...parsed };
  } catch {
    return createDefaultEmployeeSchedule();
  }
}

export function saveDefaultSchedule(companySlug: string, schedule: WeekSchedule): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${STORAGE_PREFIX}${companySlug}`, JSON.stringify(schedule));
}
