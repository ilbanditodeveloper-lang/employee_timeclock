# Variables de entorno — TimeClock

Referencia completa por entorno. **Nunca** incluyas secretos reales en el repositorio.

## Obligatorias en producción

| Variable | Descripción |
|----------|-------------|
| `NODE_ENV` | Debe ser `production` |
| `DATABASE_URL` | PostgreSQL Supabase **pooler** (puerto 6543) para la app |
| `JWT_SECRET` | Clave HMAC sesión JWT — **≥ 32 caracteres** |
| `CRON_SECRET` | Secret para `GET /api/cron/notifications?secret=...` |
| `SUPERADMIN_USERNAME` | Usuario panel superadmin |
| `SUPERADMIN_PASSWORD` | Contraseña fuerte superadmin |
| `FRONTEND_URL` | URL pública HTTPS, ej. `https://app.tudominio.com` |
| `VITE_APP_URL` | Igual que FRONTEND_URL (usada en build Vite) |
| `PORT` | Puerto HTTP — lo inyecta Render/Railway |

## Recomendadas

| Variable | Default | Descripción |
|----------|---------|-------------|
| `CRON_INTERNAL` | `false` en prod | `true` = setInterval interno; `false` = solo cron HTTP |
| `SESSION_MAX_AGE_DAYS` | 7 | Vida sesión (shared/const.ts) |
| `VAPID_PUBLIC_KEY` | — | Push web |
| `VAPID_PRIVATE_KEY` | — | Push web |
| `VAPID_SUBJECT` | — | mailto:... push |
| `VITE_GOOGLE_MAPS_API_KEY` | — | Mapas en cliente |
| `LOG_LEVEL` | info | Reservado documentación futura |

## Opcionales

| Variable | Uso |
|----------|-----|
| `DEMO_MODE` | `true` en local/staging. **Prohibido** `true` en prod (preflight falla) |
| `VITE_API_BASE_URL` | Solo deploy split API/frontend (no recomendado v1) |
| OAuth/Manus/Forge | Legacy, no requerido SaaS |

## Por entorno

### Local / dev

```env
NODE_ENV=development
DATABASE_URL=postgresql://... (Supabase dev o local)
JWT_SECRET=dev-secret-at-least-32-characters-long
DEMO_MODE=true
CRON_INTERNAL=true
FRONTEND_URL=http://localhost:3000
VITE_APP_URL=http://localhost:3000
```

### Staging

```env
NODE_ENV=production
DATABASE_URL=postgresql://... (Supabase staging pooler)
JWT_SECRET=<único staging, ≥32 chars>
CRON_SECRET=<único staging>
CRON_INTERNAL=false
DEMO_MODE=true
FRONTEND_URL=https://staging.app.tudominio.com
VITE_APP_URL=https://staging.app.tudominio.com
```

Datos TEST permitidos. Ejecutar E2E Fase 1–4 aquí.

### Production

```env
NODE_ENV=production
DATABASE_URL=postgresql://... (Supabase prod pooler)
JWT_SECRET=<único prod, ≥32 chars>
CRON_SECRET=<único prod>
CRON_INTERNAL=false
# DEMO_MODE omitido o false
FRONTEND_URL=https://app.tudominio.com
VITE_APP_URL=https://app.tudominio.com
```

Sin datos TEST. Preflight `--production` debe pasar.

## DATABASE_URL: pooler vs directo

| Uso | Conexión |
|-----|----------|
| App (Render/Railway) | **Pooler** puerto 6543, `?pgbouncer=true` |
| Migraciones (`pnpm db:migrate`) | **Directa** puerto 5432 |

En Render, usa variable separada `DATABASE_URL_DIRECT` solo en jobs de migración manual.

## Verificación

```bash
node scripts/preflight-production-check.mjs --production --url=https://app.tudominio.com
node scripts/verify-production-db.mjs --production
node scripts/e2e-phase5-production-readiness.mjs --url=https://app.tudominio.com
```
