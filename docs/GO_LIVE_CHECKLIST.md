# Go-live checklist — TimeClock

Checklist final antes de abrir producción a clientes reales.

## QA y pruebas

- [ ] E2E Fase 1 — ALL_PASSED (staging)
- [ ] E2E Fase 2 — ALL_PASSED (staging)
- [ ] E2E Fase 3 — ALL_PASSED (staging)
- [ ] E2E Fase 4 — ALL_PASSED (staging)
- [ ] E2E Fase 5 — PASS (production URL o staging final)
- [ ] QA manual: registro, onboarding, fichaje, export, auditoría, legal

## Infraestructura

- [ ] Supabase **production** creado (UE), separado de staging
- [ ] Backups Supabase activados
- [ ] Render Web Service desplegado
- [ ] Dominio HTTPS configurado
- [ ] `FRONTEND_URL` / `VITE_APP_URL` correctos
- [ ] Health `/healthz` responde 200

## Seguridad

- [ ] `JWT_SECRET` ≥ 32 chars (único prod)
- [ ] `CRON_SECRET` configurado
- [ ] `SUPERADMIN_PASSWORD` fuerte
- [ ] `DEMO_MODE` no activo en prod
- [ ] `CRON_INTERNAL=false`
- [ ] Cron HTTP externo programado
- [ ] CORS estricto verificado

## Base de datos production

- [ ] Migraciones 0000–0008 aplicadas
- [ ] `node scripts/verify-production-db.mjs --production` → PASS
- [ ] 0 datos TEST (`test-*`, `@example.com`)
- [ ] 0 emails admin duplicados
- [ ] Preflight `--production` → PASS

## Legal y compliance técnico

- [ ] `/legal/privacy` público
- [ ] `/legal/terms` público
- [ ] `/legal/dpa` público
- [ ] Textos revisados por asesor (responsabilidad cliente)
- [ ] Exportaciones probadas (PDF inspección, CSV)

## Operaciones

- [ ] Documentación [DEPLOYMENT.md](./DEPLOYMENT.md) leída por responsable deploy
- [ ] [ENVIRONMENT_VARIABLES.md](./ENVIRONMENT_VARIABLES.md) vars en Render dashboard
- [ ] [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md) procedimiento conocido
- [ ] Contacto soporte definido para clientes

## Post go-live (primeras 24h)

- [ ] Monitorizar logs Render
- [ ] Verificar cron ejecuta (notificaciones)
- [ ] Primer registro empresa real OK
- [ ] Inventario TEST en prod = 0

## Comandos finales

```bash
node scripts/inventory-test-data.mjs
node scripts/preflight-production-check.mjs --production --url=https://app.tudominio.com
node scripts/verify-production-db.mjs --production
node scripts/e2e-phase5-production-readiness.mjs --url=https://app.tudominio.com
```

**Go / No-go:** todos PASS + QA manual OK → **GO**
