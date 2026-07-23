-- Media files for landing page audience photos (served at /api/landing-media/:id).
CREATE TABLE IF NOT EXISTS "landing_media" (
  "id" serial PRIMARY KEY NOT NULL,
  "purpose" varchar(64) DEFAULT 'audience' NOT NULL,
  "contentType" varchar(128) NOT NULL,
  "dataBase64" text NOT NULL,
  "createdAt" timestamp DEFAULT now() NOT NULL
);
