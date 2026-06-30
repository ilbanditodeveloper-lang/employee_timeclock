CREATE TABLE IF NOT EXISTS "platform_settings" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updatedAt" timestamp DEFAULT now() NOT NULL
);
