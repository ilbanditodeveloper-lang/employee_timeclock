-- Employee PIN for local multi-clock mode (kiosk).
ALTER TABLE "employees"
ADD COLUMN IF NOT EXISTS "pinCode" varchar(255);
