# Backup y recuperación — TimeClock / Supabase

## Tablas críticas (no borrar sin revisión legal)

| Tabla | Importancia |
|-------|-------------|
| `companies` | Tenants |
| `users` | Admins |
| `employees` | Trabajadores |
| `timeclocks` | **Registro horario legal (4 años mínimo ES)** |
| `audit_logs` | Trazabilidad correcciones |
| `legal_acceptances` | Acuses RGPD empleados |
| `schedules`, `incidents`, `time_off_requests` | Operativa laboral |

## Supabase — backup

### Plan Pro (recomendado producción)

1. Dashboard → Project Settings → **Database** → Backups
2. Activar **daily backups** (retención según plan)
3. Anotar región y proyecto ID

### Backup manual antes de migración

1. Dashboard → **Database** → Backups → **Download** (si disponible)
2. O usar `pg_dump` con conexión directa:

```bash
pg_dump "postgresql://postgres:PASSWORD@db.xxxx.supabase.co:5432/postgres" \
  --format=custom --file=backup_$(date +%Y%m%d).dump
```

**Nunca** commitear dumps al repositorio.

## Frecuencia recomendada

| Entorno | Frecuencia |
|---------|------------|
| Production | Daily automático (Supabase Pro) + manual pre-migración |
| Staging | Manual antes de pruebas destructivas |
| Local | Opcional |

## Restaurar en staging (prueba)

1. Crear nuevo proyecto Supabase staging-restore **o** restaurar snapshot en dashboard
2. Actualizar `DATABASE_URL` staging
3. `pnpm db:migrate` si esquema diverge
4. Ejecutar E2E

**No restaurar backups de prod en entornos con acceso de desarrollo sin anonimizar.**

## Migraciones — procedimiento seguro

1. Backup production
2. `pnpm db:migrate` en **staging**
3. E2E Fase 1–4 staging
4. Backup production again
5. `pnpm db:migrate` en **production**
6. `node scripts/verify-production-db.mjs --production`
7. Smoke manual

**No usar** `pnpm db:push` (generate + migrate) en production.

## Export datos cliente (baja / portabilidad)

- Admin → exportaciones Fase 4 (PDF, CSV, JSON empleado)
- Superadmin: export manual vía SQL solo con autorización legal
- Registros horarios: conservar 4 años aunque empleado desactivado

## Desactivar vs borrar

| Acción | Fichajes | Acceso empleado |
|--------|----------|-----------------|
| Desactivar empleado | **Conservados** | Bloqueado |
| cleanup-test-data | Borra solo TEST | — |
| DELETE empresa | **No implementado** — requiere proceso legal |

## Limpieza datos TEST

Solo staging/dev:

```bash
node scripts/inventory-test-data.mjs
node scripts/cleanup-test-data.mjs --confirm
node scripts/verify-no-orphans.mjs
```

**Nunca** en production sin confirmación explícita y revisión de inventario.

## Recuperación ante desastre

1. Render: redeploy último deployment OK
2. DB corrupta: restore Supabase backup → actualizar `DATABASE_URL`
3. Secretos comprometidos: rotar `JWT_SECRET`, `CRON_SECRET`, passwords → redeploy → usuarios re-login
