import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "@shared/const";

const now = new Date();
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0);
const todayExit = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 30, 0);

export const demoCompany = {
  id: 1,
  name: "Restaurante Demo",
  slug: "demo",
  legalName: "Restaurante Demo S.L.",
  taxId: "B12345678",
  address: "Calle Mayor 1, 28013 Madrid",
  privacyContactEmail: "privacidad@demo.local",
  country: "ES",
  timezone: "Europe/Madrid",
  locationEnabled: false,
  dataRetentionYears: 4,
  termsAcceptedAt: null,
  onboardingCompleted: true,
  onboardingCompletedAt: now,
  onboardingSkippedAt: null,
  onboardingLegalAcknowledgedAt: now,
  isActive: true,
  createdAt: now,
  updatedAt: now,
};

export const demoAdmin = {
  id: 1,
  companyId: 1,
  openId: "local-admin-1",
  name: "admin",
  email: null,
  password: "demo",
  loginMethod: null,
  role: "admin" as const,
  employeeId: null,
  restaurantId: 1,
  createdAt: now,
  updatedAt: now,
  lastSignedIn: now,
};

export const demoRestaurant = {
  id: 1,
  companyId: 1,
  name: "Restaurante Demo Centro",
  address: "Calle Mayor 1, Madrid",
  latitude: "40.4168",
  longitude: "-3.7038",
  radiusMeters: 150,
  adminId: 1,
  createdAt: now,
  updatedAt: now,
};

export const demoEmployees = [
  {
    id: 1,
    companyId: 1,
    restaurantId: 1,
    name: "Ana García",
    username: "ana",
    password: "demo1234",
    phone: "600111222",
    lateGraceMinutes: 5,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 2,
    companyId: 1,
    restaurantId: 1,
    name: "Carlos López",
    username: "carlos",
    password: "demo1234",
    phone: "600333444",
    lateGraceMinutes: 10,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  },
];

const defaultSchedule = () => ({
  monday: { entry1: "09:00", entry2: "", isActive: true },
  tuesday: { entry1: "09:00", entry2: "", isActive: true },
  wednesday: { entry1: "09:00", entry2: "", isActive: true },
  thursday: { entry1: "09:00", entry2: "", isActive: true },
  friday: { entry1: "09:00", entry2: "", isActive: true },
  saturday: { entry1: "", entry2: "", isActive: false },
  sunday: { entry1: "", entry2: "", isActive: false },
});

let restaurant = { ...demoRestaurant };
let company = { ...demoCompany };
let employees = demoEmployees.map((e) => ({ ...e }));
let timeclocks: Array<{
  id: number;
  companyId: number;
  employeeId: number;
  entryTime: Date;
  exitTime: Date | null;
  isLate: boolean;
  status: "valid" | "corrected" | "voided";
  source: "mobile";
  latitude: string | null;
  longitude: string | null;
  correctionReason: string | null;
  correctedByUserId: number | null;
  correctedAt: Date | null;
  voidReason: string | null;
  voidedByUserId: number | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> = [
  {
    id: 1,
    companyId: 1,
    employeeId: 1,
    entryTime: today,
    exitTime: todayExit,
    status: "valid",
    source: "mobile",
    latitude: null,
    longitude: null,
    isLate: false,
    correctionReason: null,
    correctedByUserId: null,
    correctedAt: null,
    voidReason: null,
    voidedByUserId: null,
    voidedAt: null,
    createdAt: today,
    updatedAt: todayExit,
  },
];
let incidents = [
  {
    id: 1,
    companyId: 1,
    employeeId: 2,
    timeclockId: null,
    type: "late_arrival" as const,
    reason: "Retraso de 12 minutos",
    status: "pending" as const,
    createdAt: today,
    updatedAt: today,
  },
];
let timeOffRequests = [
  {
    id: 1,
    companyId: 1,
    employeeId: 1,
    kind: "vacation" as const,
    startDate: "2026-07-15",
    endDate: "2026-07-19",
    comment: "Vacaciones de verano",
    status: "pending" as const,
    reviewedAt: null,
    createdAt: now,
    updatedAt: now,
  },
];
let privacyAcceptances: Array<{
  employeeId: number;
  documentVersion: string;
  acceptedAt: Date;
  ipAddress: string | null;
}> = [];
let superCompanies = [
  { ...demoCompany, adminUsername: "admin" },
  {
    id: 2,
    name: "Cafetería Sol",
    slug: "cafeteria-sol",
    legalName: null,
    taxId: null,
    address: null,
    privacyContactEmail: null,
    country: "ES",
    timezone: "Europe/Madrid",
    locationEnabled: false,
    dataRetentionYears: 4,
    termsAcceptedAt: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    adminUsername: "sol.admin",
  },
];

let nextTimeclockId = 2;
let nextEmployeeId = 3;
let nextIncidentId = 2;
let nextTimeOffId = 2;
let nextCompanyId = 3;

export function getDemoCompany() {
  return { ...company };
}

export function getDemoAdmin() {
  return { ...demoAdmin };
}

export function getDemoRestaurant() {
  return { ...restaurant };
}

export function getDemoEmployees() {
  return employees.map((e) => ({ ...e }));
}

export function getDemoEmployeeById(id: number) {
  return employees.find((e) => e.id === id);
}

export function getDemoScheduleMap() {
  return defaultSchedule();
}

export function getDemoTimeclocks(employeeIds?: number[]) {
  const rows = timeclocks.filter((t) => t.status !== "voided");
  if (!employeeIds?.length) return rows.map((r) => ({ ...r }));
  return rows.filter((t) => employeeIds.includes(t.employeeId)).map((r) => ({ ...r }));
}

export function getDemoIncidents(employeeIds: number[]) {
  return incidents
    .filter((i) => employeeIds.includes(i.employeeId))
    .map((i) => ({ ...i }));
}

export function getDemoTimeOff(status?: string) {
  const rows = timeOffRequests.map((r) => ({
    ...r,
    employeeName: employees.find((e) => e.id === r.employeeId)?.name ?? "—",
  }));
  if (!status || status === "all") return rows;
  return rows.filter((r) => r.status === status);
}

export function getDemoPrivacyAcceptances() {
  return employees.map((emp) => {
    const acc = privacyAcceptances.find(
      (a) => a.employeeId === emp.id && a.documentVersion === EMPLOYEE_PRIVACY_NOTICE_VERSION
    );
    return {
      employeeId: emp.id,
      employeeName: emp.name,
      username: emp.username,
      isActive: emp.isActive,
      acceptedAt: acc?.acceptedAt ?? null,
      ipAddress: acc?.ipAddress ?? null,
      documentVersion: acc?.documentVersion ?? null,
    };
  });
}

export function getDemoSuperCompanies() {
  return superCompanies.map((c) => ({ ...c }));
}

export function demoUpsertRestaurant(input: {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}) {
  restaurant = {
    ...restaurant,
    name: input.name,
    address: input.address,
    latitude: String(input.latitude),
    longitude: String(input.longitude),
    radiusMeters: input.radiusMeters,
    updatedAt: new Date(),
  };
  return { success: true, restaurantId: restaurant.id };
}

export function demoUpdateCompanyLegal(input: Record<string, unknown>) {
  company = { ...company, ...input, updatedAt: new Date() } as typeof company;
  return { success: true };
}

export function demoClockIn(employeeId: number) {
  const open = timeclocks.find((t) => t.employeeId === employeeId && !t.exitTime && t.status !== "voided");
  if (open) throw new Error("You must clock out before clocking in again");
  const entry = new Date();
  const row = {
    id: nextTimeclockId++,
    companyId: 1,
    employeeId,
    entryTime: entry,
    exitTime: null as Date | null,
    status: "valid" as const,
    source: "mobile" as const,
    latitude: null,
    longitude: null,
    isLate: false,
    correctionReason: null,
    correctedByUserId: null,
    correctedAt: null,
    voidReason: null,
    voidedByUserId: null,
    voidedAt: null,
    createdAt: entry,
    updatedAt: entry,
  };
  timeclocks.push(row);
  return { success: true, timeclockId: row.id };
}

export function demoClockOut(employeeId: number) {
  const open = timeclocks.find((t) => t.employeeId === employeeId && !t.exitTime && t.status !== "voided");
  if (!open) throw new Error("No open clock-in found");
  open.exitTime = new Date();
  open.updatedAt = new Date();
  return { success: true };
}

export function demoAcceptPrivacy(employeeId: number, ip: string | null) {
  const existing = privacyAcceptances.find(
    (a) => a.employeeId === employeeId && a.documentVersion === EMPLOYEE_PRIVACY_NOTICE_VERSION
  );
  if (existing) return { success: true, alreadyAccepted: true };
  privacyAcceptances.push({
    employeeId,
    documentVersion: EMPLOYEE_PRIVACY_NOTICE_VERSION,
    acceptedAt: new Date(),
    ipAddress: ip,
  });
  return { success: true, alreadyAccepted: false };
}

export function demoHasPrivacyAcceptance(employeeId: number) {
  return privacyAcceptances.some(
    (a) => a.employeeId === employeeId && a.documentVersion === EMPLOYEE_PRIVACY_NOTICE_VERSION
  );
}

export function demoCreateSuperCompany(input: {
  companyName: string;
  companySlug: string;
  adminUsername: string;
}) {
  const slug = input.companySlug.trim().toLowerCase();
  if (superCompanies.some((c) => c.slug === slug)) {
    throw new Error("Ya existe una empresa con ese slug");
  }
  superCompanies.push({
    id: nextCompanyId++,
    name: input.companyName.trim(),
    slug,
    legalName: null,
    taxId: null,
    address: null,
    privacyContactEmail: null,
    country: "ES",
    timezone: "Europe/Madrid",
    locationEnabled: false,
    dataRetentionYears: 4,
    termsAcceptedAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    adminUsername: input.adminUsername.trim(),
  });
  return { success: true };
}

export function demoSetCompanyStatus(companyId: number, isActive: boolean) {
  const row = superCompanies.find((c) => c.id === companyId);
  if (!row) throw new Error("Empresa no encontrada");
  row.isActive = isActive;
  row.updatedAt = new Date();
  return { success: true };
}

export function demoMutationSuccess() {
  return { success: true };
}

export function getDemoCalendarMonth(year: number, month: number) {
  return getDemoTimeOff("approved").filter((r) => {
    const start = new Date(r.startDate);
    return start.getFullYear() === year && start.getMonth() + 1 === month;
  });
}

export function getDemoNotificationLogs() {
  return [];
}

export function getDemoAuditLogs() {
  return [];
}

export function getDemoScheduleRows(employeeId: number) {
  const rows = [];
  for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek += 1) {
    const isWorkDay = dayOfWeek >= 1 && dayOfWeek <= 5;
    rows.push({
      id: dayOfWeek + 1,
      companyId: 1,
      employeeId,
      dayOfWeek,
      entryTime: isWorkDay ? "09:00" : "",
      isWorkDay,
      entrySlot: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return rows;
}

export function getDemoLatestOpenTimeclock(employeeId: number) {
  return (
    timeclocks.find(
      (t) => t.employeeId === employeeId && !t.exitTime && t.status !== "voided"
    ) ?? undefined
  );
}

export function getDemoTodayTimeclocks(employeeId: number) {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  return timeclocks.filter(
    (t) => t.employeeId === employeeId && t.createdAt >= dayStart
  );
}

