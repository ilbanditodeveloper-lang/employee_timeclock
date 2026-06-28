-- Fase 3: email único para admins self-service (local-admin-*)
-- Ejecutar scripts/check-admin-email-duplicates.mjs antes de aplicar.

UPDATE users
SET email = lower(trim(email)), "updatedAt" = NOW()
WHERE email IS NOT NULL
  AND trim(email) <> ''
  AND role = 'admin'
  AND "openId" LIKE 'local-admin-%';

CREATE UNIQUE INDEX IF NOT EXISTS users_admin_email_lower_unique_idx
  ON users (lower(trim(email)))
  WHERE email IS NOT NULL
    AND trim(email) <> ''
    AND role = 'admin'
    AND "openId" LIKE 'local-admin-%';
