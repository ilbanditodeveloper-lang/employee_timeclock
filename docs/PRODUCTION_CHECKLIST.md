# Checklist de producción — TimeClock

Usar antes de cada deploy a **production** y como referencia de configuración.

## Entorno Render

- [ ] Web Service Node en región UE (Frankfurt)
- [ ] Health check `/healthz` configurado
- [ ] `NODE_ENV=production`
- [ ] `CRON_INTERNAL=false`
- [ ] `PORT` inyectado por plataforma (no hardcodear)
- [ ] Build: `pnpm install && pnpm build`
- [ ] Start: `pnpm start` (cross-env compatible Linux)

## Secretos y URLs

- [ ] `JWT_SECRET` ≥ 32 caracteres, único por entorno
- [ ] `CRON_SECRET` configurado, único por entorno
- [ ] `SUPERADMIN_PASSWORD` fuerte (no default `123456`)
- [ ] `FRONTEND_URL` = URL HTTPS final
- [ ] `VITE_APP_URL` = misma URL (build-time en Render)
- [ ] `DEMO_MODE` **no** es `true`

## Supabase production

- [ ] Proyecto separado de staging/dev
- [ ] Región UE
- [ ] Backups activados
- [ ] `DATABASE_URL` = pooler (6543)
- [ ] Migraciones 0000–0008 aplicadas (`pnpm db:migrate`)
- [ ] Índice `users_admin_email_lower_unique_idx` presente
- [ ] **0** companies `test-*`
- [ ] **0** users `@example.com`

## Seguridad

- [ ] HTTPS activo
- [ ] CORS: solo `FRONTEND_URL` / `VITE_APP_URL`
- [ ] Cookies: httpOnly, secure en HTTPS
- [ ] `getAppConfig` no expone superadmin
- [ ] Cron sin secret → 401/503 en prod
- [ ] Errores tRPC sin stack traces al cliente (prod)
- [ ] Rate limit documentado (in-memory, 1 instancia)

## Legal público

- [ ] `/legal/privacy` accesible
- [ ] `/legal/terms` accesible
- [ ] `/legal/dpa` accesible
- [ ] Disclaimers “plantilla orientativa” visibles

## Cron

- [ ] Cron HTTP externo configurado
- [ ] URL: `/api/cron/notifications?secret=CRON_SECRET`
- [ ] Frecuencia 1–5 min
- [ ] Logs cron revisados tras primer deploy

## Verificación automatizada

```bash
node scripts/preflight-production-check.mjs --production --url=https://app.tudominio.com
node scripts/verify-production-db.mjs --production
node scripts/e2e-phase5-production-readiness.mjs --url=https://app.tudominio.com
```

- [ ] Preflight PASS
- [ ] verify-production-db PASS
- [ ] E2E Fase 5 PASS

## QA manual (staging)

- [ ] Registro empresa (Fase 1)
- [ ] Onboarding (Fase 2)
- [ ] Login admin / empleado
- [ ] Export PDF/CSV
- [ ] Panel auditoría
- [ ] E2E Fase 1–4 en staging

## Post-deploy production

- [ ] Login superadmin
- [ ] Crear empresa prueba real (no @example.com) → eliminar si fue solo prueba
- [ ] Health `/healthz` → `{ ok: true }`
- [ ] Cron ejecutado al menos 1 vez OK
