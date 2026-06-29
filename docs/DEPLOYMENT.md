# Despliegue — TimeClock (Render, monolito)

Arquitectura **Opción A**: un solo servicio Node.js sirve API tRPC + frontend estático en el **mismo dominio**.

```
Usuario ──HTTPS──► Render Web Service
                    ├── /api/trpc
                    ├── /api/cron/notifications
                    ├── /healthz
                    └── /* → SPA (dist/public)
                         │
                         ▼
                   Supabase PostgreSQL (UE)
```

**No usar Vercel** para el SaaS completo — ver [VERCEL_DEPLOYMENT.md](../VERCEL_DEPLOYMENT.md) (obsoleto para backend).

## Requisitos

- Cuenta [Render](https://render.com)
- 1 proyecto Supabase (v1) o 2 si quieres aislamiento staging/prod más adelante
- Dominio opcional: `app.tudominio.com`, `staging.app.tudominio.com`

## 1. Supabase

Ver [SUPABASE_SETUP.md](../SUPABASE_SETUP.md) y [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md).

### v1 — un solo proyecto (recomendado para arrancar)

1. Usar el proyecto Supabase existente (región UE)
2. Aplicar migraciones `pnpm db:migrate` (pooler si directo falla en local)
3. Activar **backups** cuando pases a clientes de pago
4. **Pooler** (6543) → `DATABASE_URL` en Render

### v2 — dos proyectos (opcional, más adelante)

1. Crear proyecto **production** separado, sin datos TEST
2. Repetir migraciones tras backup
3. Secretos y `DATABASE_URL` distintos por entorno

Connection strings:

- **Pooler** (6543) → `DATABASE_URL` en Render
- **Direct** (5432) → migraciones locales/CI (si DNS lo permite)

## 2. Migraciones

**Nunca** ejecutar `drizzle-kit generate` en producción.

```bash
# Con DATABASE_URL apuntando a staging (conexión directa)
pnpm db:migrate

# Verificar
node scripts/verify-production-db.mjs --staging
node scripts/e2e-phase1-check.mjs   # contra staging URL
```

Con un solo Supabase, no hace falta repetir migraciones para “prod”. Con dos proyectos, repetir tras backup y QA staging.

## 3. Render — Web Service

### Opción manual

1. New → **Web Service** → conectar repo Git
2. **Runtime:** Node
3. **Region:** Frankfurt (EU)
4. **Build command:** `pnpm install && pnpm build`
5. **Start command:** `pnpm start`
6. **Health check path:** `/healthz`
7. Variables de entorno — ver [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md)

### Opción Blueprint

El repo incluye `render.yaml`. Ajusta env vars en dashboard tras deploy.

### Variables críticas producción

```
NODE_ENV=production
CRON_INTERNAL=false
DATABASE_URL=<supabase pooler>
JWT_SECRET=<32+ chars>
CRON_SECRET=<secret>
SUPERADMIN_USERNAME=...
SUPERADMIN_PASSWORD=...
FRONTEND_URL=https://app.tudominio.com
VITE_APP_URL=https://app.tudominio.com
```

**Importante:** `VITE_APP_URL` debe estar definida **antes del build** en Render (Environment → Build-time).

## 4. Dominio y HTTPS

1. Render → Settings → Custom Domain → `app.tudominio.com`
2. Configurar CNAME en DNS
3. HTTPS automático (Let's Encrypt)
4. Actualizar `FRONTEND_URL` y `VITE_APP_URL` → redeploy

Cookies JWT funcionan same-origin sin CORS cross-domain.

## 5. Cron de notificaciones

En producción **desactivar** cron interno:

```
CRON_INTERNAL=false
```

Configurar cron externo (Render Cron Job, cron-job.org, GitHub Actions):

```
GET https://app.tudominio.com/api/cron/notifications?secret=TU_CRON_SECRET
```

Frecuencia recomendada: **cada 1–5 minutos**.

Alternativas auth (también soportadas en `api/cron/notifications.ts` Vercel legacy):
- Header `Authorization: Bearer CRON_SECRET`
- Header `x-cron-secret: CRON_SECRET`

## 6. Preflight pre-go-live

```bash
# Local contra .env.production o vars en Render shell
cross-env NODE_ENV=production node scripts/preflight-production-check.mjs --production --url=https://app.tudominio.com

node scripts/verify-production-db.mjs --production
node scripts/e2e-phase5-production-readiness.mjs --url=https://app.tudominio.com
```

## 7. Service Worker / PWA

- `client/public/sw.js` **no cachea** `/api/*`, `/api/trpc`, `/healthz`
- Tras cada deploy con cambios de shell, se incrementa `CACHE_NAME` (ej. `timeclock-v3`)
- Usuarios reciben actualización vía network-first en navegación

## 8. Comandos útiles

| Comando | Uso |
|---------|-----|
| `pnpm dev` | Local desarrollo |
| `pnpm build` | Build producción |
| `pnpm start` | Arrancar dist/index.js |
| `pnpm check` | TypeScript |
| `pnpm db:migrate` | Aplicar migraciones SQL |
| `pnpm db:generate` | Solo dev — generar SQL nuevo |
| `pnpm preflight:prod` | Preflight producción |

## 9. Staging vs Production

| | Staging | Production |
|---|---------|------------|
| Supabase | Proyecto staging | Proyecto prod |
| DEMO_MODE | true OK | false / omitir |
| Datos TEST | Permitidos | **Prohibidos** |
| E2E 1–4 | Ejecutar aquí | No |
| Preflight | `--staging` warn | `--production` fail |

## 10. Rollback

1. Render → Deployments → Redeploy versión anterior
2. Si migración DB problemática: restaurar backup Supabase (staging primero)

Ver [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md).
