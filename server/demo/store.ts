import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "@shared/const";
import { addTrialDays, type SubscriptionPlan } from "@shared/subscriptionPlans";

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
  province: null as string | null,
  legalContactName: null as string | null,
  gpsJustification: null as string | null,
  gpsJustificationCategory: null as string | null,
  gpsActivatedBy: null as number | null,
  gpsActivatedAt: null as Date | null,
  legalHoldEnabled: false,
  minimumRetentionYears: 4,
  anonymizeAfterRetention: false,
  termsAcceptedAt: null,
  onboardingCompleted: true,
  onboardingCompletedAt: now,
  onboardingSkippedAt: null,
  onboardingLegalAcknowledgedAt: now,
  subscriptionPlan: "legacy",
  trialEndsAt: null as Date | null,
  stripeCustomerId: null as string | null,
  stripeSubscriptionId: null as string | null,
  billingStatus: null as string | null,
  billingEmail: null as string | null,
  currentPeriodEnd: null as Date | null,
  crmStage: "active" as const,
  crmContactName: null as string | null,
  crmContactPhone: null as string | null,
  crmNotes: null as string | null,
  crmNextFollowUpAt: null as Date | null,
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
  isPrimary: true,
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
    email: "ana@demo.local",
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
    email: "carlos@demo.local",
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

type DemoSuperCompany = {
  id: number;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  privacyContactEmail: string | null;
  country: string;
  timezone: string;
  locationEnabled: boolean;
  dataRetentionYears: number;
  province: string | null;
  legalContactName: string | null;
  gpsJustification: string | null;
  gpsJustificationCategory: string | null;
  gpsActivatedBy: number | null;
  gpsActivatedAt: Date | null;
  legalHoldEnabled: boolean;
  minimumRetentionYears: number;
  anonymizeAfterRetention: boolean;
  termsAcceptedAt: Date | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: Date | null;
  onboardingSkippedAt: Date | null;
  onboardingLegalAcknowledgedAt: Date | null;
  subscriptionPlan: string;
  trialEndsAt: Date | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  billingStatus: string | null;
  billingEmail: string | null;
  currentPeriodEnd: Date | null;
  crmStage: string;
  crmContactName: string | null;
  crmContactPhone: string | null;
  crmNotes: string | null;
  crmNextFollowUpAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  adminUsername: string;
  employeeCount: number;
};

let superCompanies: DemoSuperCompany[] = [
  { ...demoCompany, adminUsername: "admin", employeeCount: 2 },
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
    province: null,
    legalContactName: null,
    gpsJustification: null,
    gpsJustificationCategory: null,
    gpsActivatedBy: null,
    gpsActivatedAt: null,
    legalHoldEnabled: false,
    minimumRetentionYears: 4,
    anonymizeAfterRetention: false,
    termsAcceptedAt: null,
    onboardingCompleted: true,
    onboardingCompletedAt: now,
    onboardingSkippedAt: null,
    onboardingLegalAcknowledgedAt: null,
    subscriptionPlan: "trial",
    trialEndsAt: addTrialDays(now, 7),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingStatus: null,
    billingEmail: null,
    currentPeriodEnd: null,
    crmStage: "trial",
    crmContactName: null,
    crmContactPhone: null,
    crmNotes: null,
    crmNextFollowUpAt: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    adminUsername: "sol.admin",
    employeeCount: 0,
  },
];

let nextTimeclockId = 2;
let nextEmployeeId = 3;
let nextIncidentId = 2;
let nextTimeOffId = 2;
let nextCompanyId = 3;
let nextBreakId = 1;
let timeclockBreaks: Array<{
  id: number;
  companyId: number;
  employeeId: number;
  timeclockId: number;
  startedAt: Date;
  endedAt: Date | null;
  createdAt: Date;
}> = [];

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
  closeDemoOpenBreak(open.id);
  open.exitTime = new Date();
  open.updatedAt = new Date();
  return { success: true };
}

export function demoAdminForceClockOut(
  timeclockId: number,
  reason: string,
  exitAt = new Date()
) {
  const open = timeclocks.find(
    (t) => t.id === timeclockId && !t.exitTime && t.status !== "voided"
  );
  if (!open) throw new Error("Fichaje no encontrado o ya cerrado");
  closeDemoOpenBreak(open.id, exitAt);
  open.exitTime = exitAt;
  open.status = "corrected";
  open.correctionReason = reason;
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
    province: null,
    legalContactName: null,
    gpsJustification: null,
    gpsJustificationCategory: null,
    gpsActivatedBy: null,
    gpsActivatedAt: null,
    legalHoldEnabled: false,
    minimumRetentionYears: 4,
    anonymizeAfterRetention: false,
    termsAcceptedAt: null,
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    onboardingSkippedAt: null,
    onboardingLegalAcknowledgedAt: null,
    subscriptionPlan: "trial",
    trialEndsAt: addTrialDays(new Date()),
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingStatus: null,
    billingEmail: null,
    currentPeriodEnd: null,
    crmStage: "trial",
    crmContactName: null,
    crmContactPhone: null,
    crmNotes: null,
    crmNextFollowUpAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    adminUsername: input.adminUsername.trim(),
    employeeCount: 0,
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

export function demoSetCompanySubscription(
  companyId: number,
  subscriptionPlan: SubscriptionPlan,
  trialEndsAt: Date | null
) {
  const row = superCompanies.find((c) => c.id === companyId);
  if (!row) throw new Error("Empresa no encontrada");
  row.subscriptionPlan = subscriptionPlan;
  row.trialEndsAt = trialEndsAt;
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
      exitTime: isWorkDay ? "17:00" : null,
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

export function getDemoOpenBreak(timeclockId: number) {
  return timeclockBreaks.find((b) => b.timeclockId === timeclockId && !b.endedAt);
}

export function getDemoBreaksForTimeclocks(timeclockIds: number[]) {
  const ids = new Set(timeclockIds);
  return timeclockBreaks.filter((b) => ids.has(b.timeclockId));
}

export function closeDemoOpenBreak(timeclockId: number, endedAt = new Date()) {
  const row = timeclockBreaks.find((b) => b.timeclockId === timeclockId && !b.endedAt);
  if (row) row.endedAt = endedAt;
}

export function demoPauseClock(employeeId: number) {
  const open = getDemoLatestOpenTimeclock(employeeId);
  if (!open) throw new Error("Debes fichar entrada antes de pausar");
  if (getDemoOpenBreak(open.id)) throw new Error("Ya estás en pausa");
  const now = new Date();
  const row = {
    id: nextBreakId++,
    companyId: open.companyId,
    employeeId,
    timeclockId: open.id,
    startedAt: now,
    endedAt: null as Date | null,
    createdAt: now,
  };
  timeclockBreaks.push(row);
  return { success: true as const, isPaused: true };
}

export function demoResumeClock(employeeId: number) {
  const open = getDemoLatestOpenTimeclock(employeeId);
  if (!open) throw new Error("No hay fichaje de entrada activo");
  const activeBreak = getDemoOpenBreak(open.id);
  if (!activeBreak) throw new Error("No estás en pausa");
  activeBreak.endedAt = new Date();
  return { success: true as const, isPaused: false };
}

