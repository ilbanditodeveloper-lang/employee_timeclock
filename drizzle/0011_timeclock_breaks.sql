-- Pausas de fichaje (descanso durante jornada abierta)
CREATE TABLE IF NOT EXISTS "timeclock_breaks" (
  "id" serial PRIMARY KEY NOT NULL,
  "companyId" integer NOT NULL,
  "employeeId" integer NOT NULL,
  "timeclockId" integer NOT NULL,
  "startedAt" timestamp DEFAULT now() NOT NULL,
  "endedAt" timestamp,
  "createdAt" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "timeclock_breaks_timeclock_idx" ON "timeclock_breaks" ("timeclockId");
CREATE INDEX IF NOT EXISTS "timeclock_breaks_employee_open_idx" ON "timeclock_breaks" ("employeeId", "endedAt");
