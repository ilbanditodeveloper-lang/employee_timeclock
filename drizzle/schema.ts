import {
  pgEnum,
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  boolean,
  integer,
  numeric,
  jsonb,
  date,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["employee", "admin"]);
export const incidentTypeEnum = pgEnum("incident_type", ["late_arrival", "early_exit", "other"]);
export const incidentStatusEnum = pgEnum("incident_status", ["pending", "approved", "rejected"]);
export const timeOffKindEnum = pgEnum("time_off_kind", ["vacation", "day_off"]);
export const timeOffStatusEnum = pgEnum("time_off_status", ["pending", "approved", "rejected"]);
export const timeclockStatusEnum = pgEnum("timeclock_status", ["valid", "corrected", "voided"]);
export const clockSourceEnum = pgEnum("clock_source", ["mobile", "admin_panel", "tablet", "qr"]);
export const auditEntityTypeEnum = pgEnum("audit_entity_type", [
  "timeclock",
  "employee",
  "company",
  "incident",
]);
export const legalDocumentTypeEnum = pgEnum("legal_document_type", [
  "employee_privacy_notice",
  "platform_terms",
]);

export const contractTypeEnum = pgEnum("contract_type", [
  "full_time",
  "part_time",
  "temporary",
  "other",
]);

export const adminRoleEnum = pgEnum("admin_role", [
  "owner",
  "admin",
  "hr_manager",
  "accountant",
  "read_only_auditor",
]);

export const gdprRequestTypeEnum = pgEnum("gdpr_request_type", [
  "access",
  "rectification",
  "erasure",
  "restriction",
  "objection",
  "portability",
  "other",
]);

export const gdprRequestStatusEnum = pgEnum("gdpr_request_status", [
  "received",
  "in_review",
  "resolved",
  "rejected",
]);

export const legalDocumentCodeEnum = pgEnum("legal_document_code", [
  "privacy_policy",
  "terms_of_use",
  "dpa",
  "employee_notice",
]);

export const monthlyReportDeliveryTypeEnum = pgEnum("monthly_report_delivery_type", [
  "admin_generated",
  "employee_downloaded",
  "admin_delivered",
]);

/**
 * Company/tenant for multi-business SaaS deployments.
 */
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  legalName: varchar("legalName", { length: 255 }),
  taxId: varchar("taxId", { length: 32 }),
  address: text("address"),
  privacyContactEmail: varchar("privacyContactEmail", { length: 320 }),
  country: varchar("country", { length: 2 }).default("ES").notNull(),
  timezone: varchar("timezone", { length: 64 }).default("Europe/Madrid").notNull(),
  locationEnabled: boolean("locationEnabled").default(false).notNull(),
  dataRetentionYears: integer("dataRetentionYears").default(4).notNull(),
  province: varchar("province", { length: 100 }),
  legalContactName: varchar("legalContactName", { length: 255 }),
  gpsJustification: text("gpsJustification"),
  gpsJustificationCategory: varchar("gpsJustificationCategory", { length: 64 }),
  gpsActivatedBy: integer("gpsActivatedBy"),
  gpsActivatedAt: timestamp("gpsActivatedAt"),
  /** Bumped when company legal data changes so employees must re-accept the notice. */
  employeePrivacyNoticeVersion: varchar("employeePrivacyNoticeVersion", { length: 32 })
    .default("2026-06-22-v2")
    .notNull(),
  legalHoldEnabled: boolean("legalHoldEnabled").default(false).notNull(),
  minimumRetentionYears: integer("minimumRetentionYears").default(4).notNull(),
  anonymizeAfterRetention: boolean("anonymizeAfterRetention").default(false).notNull(),
  termsAcceptedAt: timestamp("termsAcceptedAt"),
  onboardingCompleted: boolean("onboardingCompleted").default(false).notNull(),
  onboardingCompletedAt: timestamp("onboardingCompletedAt"),
  onboardingSkippedAt: timestamp("onboardingSkippedAt"),
  onboardingLegalAcknowledgedAt: timestamp("onboardingLegalAcknowledgedAt"),
  subscriptionPlan: varchar("subscriptionPlan", { length: 32 }).default("trial").notNull(),
  trialEndsAt: timestamp("trialEndsAt"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  billingStatus: varchar("billingStatus", { length: 32 }),
  billingEmail: varchar("billingEmail", { length: 320 }),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  crmStage: varchar("crmStage", { length: 32 }).default("trial").notNull(),
  crmContactName: varchar("crmContactName", { length: 255 }),
  crmContactPhone: varchar("crmContactPhone", { length: 32 }),
  crmNotes: text("crmNotes"),
  crmNextFollowUpAt: timestamp("crmNextFollowUpAt"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Company = typeof companies.$inferSelect;
export type InsertCompany = typeof companies.$inferInsert;

/**
 * Core user table backing auth flow.
 * Extended with employee-specific fields for the timeclock system.
 */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").default(1).notNull(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    password: varchar("password", { length: 255 }), // For employee login
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: userRoleEnum("role").default("employee").notNull(),
    adminRole: adminRoleEnum("adminRole").default("admin"),
    employeeId: integer("employeeId"), // Reference to employee table
    restaurantId: integer("restaurantId"), // Reference to restaurant (for admin)
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (table) => ({
    adminEmailLowerUnique: uniqueIndex("users_admin_email_lower_unique_idx")
      .on(sql`lower(trim(${table.email}))`)
      .where(
        sql`${table.email} IS NOT NULL AND trim(${table.email}) <> '' AND ${table.role} = 'admin' AND ${table.openId} LIKE 'local-admin-%'`
      ),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Restaurant table for storing restaurant information and location
 */
export const restaurants = pgTable("restaurants", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  latitude: numeric("latitude", { precision: 10, scale: 8 }).notNull(),
  longitude: numeric("longitude", { precision: 11, scale: 8 }).notNull(),
  radiusMeters: integer("radiusMeters").default(100).notNull(), // GPS validation radius
  isPrimary: boolean("isPrimary").default(false).notNull(),
  adminId: integer("adminId").notNull(), // Reference to admin user
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;

/**
 * Employee table for storing employee information
 */
export const employees = pgTable(
  "employees",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").default(1).notNull(),
    restaurantId: integer("restaurantId").notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    username: varchar("username", { length: 100 }).notNull(),
    email: varchar("email", { length: 255 }),
    password: varchar("password", { length: 255 }).notNull(),
    pinCode: varchar("pinCode", { length: 255 }),
    phone: varchar("phone", { length: 20 }),
    lateGraceMinutes: integer("lateGraceMinutes").default(5).notNull(),
    contractType: contractTypeEnum("contractType").default("full_time").notNull(),
    weeklyContractedHours: numeric("weeklyContractedHours", { precision: 5, scale: 2 }),
    nationalId: varchar("nationalId", { length: 32 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    companyUsernameIdx: uniqueIndex("employees_company_username_idx").on(
      table.companyId,
      table.username
    ),
    companyEmailLowerUniqueIdx: uniqueIndex("employees_company_email_lower_unique_idx").on(
      table.companyId,
      sql`lower(trim(${table.email}))`
    ),
    companyIdx: index("employees_company_idx").on(table.companyId),
  })
);

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = typeof employees.$inferInsert;

/**
 * Schedule table for storing employee work schedules
 */
export const schedules = pgTable("schedules", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  employeeId: integer("employeeId").notNull(), // Reference to employee
  dayOfWeek: integer("dayOfWeek").notNull(), // 0-6 (Sunday-Saturday)
  entryTime: varchar("entryTime", { length: 5 }).notNull(), // HH:mm format
  exitTime: varchar("exitTime", { length: 5 }), // HH:mm format (optional)
  entrySlot: integer("entrySlot").default(1).notNull(), // 1 or 2 for split shifts
  isWorkDay: boolean("isWorkDay").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type Schedule = typeof schedules.$inferSelect;
export type InsertSchedule = typeof schedules.$inferInsert;

/**
 * Timeclock table for storing clock-in/clock-out records
 */
export const timeclocks = pgTable(
  "timeclocks",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").default(1).notNull(),
    employeeId: integer("employeeId").notNull(),
    entryTime: timestamp("entryTime"),
    exitTime: timestamp("exitTime"),
    isLate: boolean("isLate").default(false).notNull(),
    status: timeclockStatusEnum("status").default("valid").notNull(),
    source: clockSourceEnum("source").default("mobile").notNull(),
    latitude: numeric("latitude", { precision: 10, scale: 8 }),
    longitude: numeric("longitude", { precision: 11, scale: 8 }),
    exitLatitude: numeric("exitLatitude", { precision: 10, scale: 8 }),
    exitLongitude: numeric("exitLongitude", { precision: 11, scale: 8 }),
    correctionReason: text("correctionReason"),
    correctedByUserId: integer("correctedByUserId"),
    correctedAt: timestamp("correctedAt"),
    voidReason: text("voidReason"),
    voidedByUserId: integer("voidedByUserId"),
    voidedAt: timestamp("voidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  },
  (table) => ({
    companyEmployeeEntryIdx: index("timeclocks_company_employee_entry_idx").on(
      table.companyId,
      table.employeeId,
      table.entryTime
    ),
    companyIdx: index("timeclocks_company_idx").on(table.companyId),
  })
);

export type Timeclock = typeof timeclocks.$inferSelect;
export type InsertTimeclock = typeof timeclocks.$inferInsert;

/**
 * Pausas durante un fichaje abierto (descanso / comida).
 */
export const timeclockBreaks = pgTable(
  "timeclock_breaks",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    employeeId: integer("employeeId").notNull(),
    timeclockId: integer("timeclockId").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    endedAt: timestamp("endedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    timeclockIdx: index("timeclock_breaks_timeclock_idx").on(table.timeclockId),
    employeeOpenIdx: index("timeclock_breaks_employee_open_idx").on(
      table.employeeId,
      table.endedAt
    ),
  })
);

export type TimeclockBreak = typeof timeclockBreaks.$inferSelect;
export type InsertTimeclockBreak = typeof timeclockBreaks.$inferInsert;

/**
 * Incident table for storing employee incidents
 */
export const incidents = pgTable("incidents", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  employeeId: integer("employeeId").notNull(), // Reference to employee
  timeclockId: integer("timeclockId"), // Reference to timeclock entry
  type: incidentTypeEnum("type").notNull(),
  reason: text("reason").notNull(),
  status: incidentStatusEnum("status").default("pending").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

/**
 * Push subscription for employee notifications
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  employeeId: integer("employeeId").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

/**
 * Notification log to avoid duplicate sends
 */
export const notificationLogs = pgTable("notification_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  employeeId: integer("employeeId").notNull(),
  entryTime: varchar("entryTime", { length: 5 }).notNull(),
  scheduleDate: date("scheduleDate").notNull(), // Date of the scheduled entry
  entrySlot: integer("entrySlot").default(1).notNull(), // 1 or 2 for split shifts
  notifiedAt: timestamp("notifiedAt").defaultNow().notNull(),
});

export type NotificationLog = typeof notificationLogs.$inferSelect;
export type InsertNotificationLog = typeof notificationLogs.$inferInsert;

export type Incident = typeof incidents.$inferSelect;
export type InsertIncident = typeof incidents.$inferInsert;

/**
 * Solicitudes de vacaciones o días libres (empleado → admin aprueba/deniega).
 */
export const timeOffRequests = pgTable("time_off_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").default(1).notNull(),
  employeeId: integer("employeeId").notNull(),
  kind: timeOffKindEnum("kind").notNull(),
  startDate: date("startDate").notNull(),
  endDate: date("endDate").notNull(),
  comment: text("comment").notNull(),
  status: timeOffStatusEnum("status").default("pending").notNull(),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type TimeOffRequest = typeof timeOffRequests.$inferSelect;
export type InsertTimeOffRequest = typeof timeOffRequests.$inferInsert;

/**
 * Immutable audit trail for compliance (timeclock corrections, etc.).
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    entityType: auditEntityTypeEnum("entityType").notNull(),
    entityId: integer("entityId").notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    oldValue: jsonb("oldValue"),
    newValue: jsonb("newValue"),
    reason: text("reason"),
    performedByType: varchar("performedByType", { length: 32 }).notNull(),
    performedById: integer("performedById"),
    performedAt: timestamp("performedAt").defaultNow().notNull(),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: text("userAgent"),
    previousHash: varchar("previousHash", { length: 64 }),
    currentHash: varchar("currentHash", { length: 64 }),
  },
  (table) => ({
    companyEntityIdx: index("audit_logs_company_entity_idx").on(
      table.companyId,
      table.entityType,
      table.entityId
    ),
  })
);

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;

/**
 * Employee informational privacy notice acceptance (not consent as legal basis).
 */
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    employeeId: integer("employeeId").notNull(),
    documentType: legalDocumentTypeEnum("documentType").notNull(),
    documentVersion: varchar("documentVersion", { length: 32 }).notNull(),
    acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
    ipAddress: varchar("ipAddress", { length: 64 }),
    userAgent: text("userAgent"),
    documentHash: varchar("documentHash", { length: 64 }),
  },
  (table) => ({
    employeeDocIdx: uniqueIndex("legal_acceptances_employee_doc_idx").on(
      table.employeeId,
      table.documentType,
      table.documentVersion
    ),
  })
);

export type LegalAcceptance = typeof legalAcceptances.$inferSelect;
export type InsertLegalAcceptance = typeof legalAcceptances.$inferInsert;

/** Historial CRM por empresa (superadmin). */
export const companyCrmActivities = pgTable(
  "company_crm_activities",
  {
    id: serial("id").primaryKey(),
    companyId: integer("companyId").notNull(),
    activityType: varchar("activityType", { length: 32 }).default("note").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    companyIdx: index("company_crm_activities_company_idx").on(table.companyId),
  })
);

export type CompanyCrmActivity = typeof companyCrmActivities.$inferSelect;
export type InsertCompanyCrmActivity = typeof companyCrmActivities.$inferInsert;

/** Configuración global de la plataforma (landing, etc.). */
export const platformSettings = pgTable("platform_settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;

/** Uploaded images for the public landing (audience section, etc.). */
export const landingMedia = pgTable("landing_media", {
  id: serial("id").primaryKey(),
  purpose: varchar("purpose", { length: 64 }).default("audience").notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  dataBase64: text("dataBase64").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LandingMedia = typeof landingMedia.$inferSelect;
export type InsertLandingMedia = typeof landingMedia.$inferInsert;

export const legalDocuments = pgTable(
  "legal_documents",
  {
    id: serial("id").primaryKey(),
    code: legalDocumentCodeEnum("code").notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    body: text("body").notNull(),
    publishedAt: timestamp("publishedAt").defaultNow().notNull(),
    active: boolean("active").default(true).notNull(),
    documentHash: varchar("documentHash", { length: 64 }),
  },
  (table) => ({
    codeVersionIdx: uniqueIndex("legal_documents_code_version_idx").on(table.code, table.version),
  })
);

export const companyLegalAcceptances = pgTable("company_legal_acceptances", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  acceptedByUserId: integer("acceptedByUserId").notNull(),
  documentCode: legalDocumentCodeEnum("documentCode").notNull(),
  documentVersion: varchar("documentVersion", { length: 32 }).notNull(),
  documentHash: varchar("documentHash", { length: 64 }),
  acceptedAt: timestamp("acceptedAt").defaultNow().notNull(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
});

export const gdprRequests = pgTable("gdpr_requests", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  employeeId: integer("employeeId").notNull(),
  requestType: gdprRequestTypeEnum("requestType").notNull(),
  message: text("message").notNull(),
  status: gdprRequestStatusEnum("status").default("received").notNull(),
  adminNotes: text("adminNotes"),
  resolvedAt: timestamp("resolvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
});

export const monthlyReportDeliveries = pgTable("monthly_report_deliveries", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId").notNull(),
  employeeId: integer("employeeId").notNull(),
  periodYear: integer("periodYear").notNull(),
  periodMonth: integer("periodMonth").notNull(),
  reportType: varchar("reportType", { length: 64 }).default("monthly_summary").notNull(),
  deliveryType: monthlyReportDeliveryTypeEnum("deliveryType").notNull(),
  documentHash: varchar("documentHash", { length: 64 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
