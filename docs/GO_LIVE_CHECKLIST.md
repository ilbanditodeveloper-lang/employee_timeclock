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

**Opción elegida (v1): un solo Supabase** — mismo proyecto para staging y producción. No hace falta crear otro proyecto Supabase hasta tener clientes de pago y querer aislamiento.

- [x] Supabase UE con migraciones **0000–0011** aplicadas
- [ ] Backups Supabase activados (plan Pro recomendado)
- [x] Render Web Service desplegado (`employee-timeclock-1.onrender.com`)
- [ ] Dominio HTTPS propio configurado (opcional al inicio; Render ya da HTTPS)
- [ ] `FRONTEND_URL` / `VITE_APP_URL` = URL final de producción
- [x] Health `/healthz` responde 200 (staging verificado)

> **Alternativa futura:** segundo proyecto Supabase solo cuando quieras separar datos staging/prod.

## Seguridad

- [ ] `JWT_SECRET` ≥ 32 chars (único prod)
- [ ] `CRON_SECRET` configurado
- [ ] `SUPERADMIN_PASSWORD` fuerte
- [ ] `DEMO_MODE` no activo en prod
- [ ] `CRON_INTERNAL=false`
- [ ] Cron HTTP externo programado
- [ ] CORS estricto verificado

## Base de datos production

- [x] Migraciones **0000–0011** aplicadas (incl. suscripción y pausas fichaje)
- [ ] `node scripts/verify-production-db.mjs --production` → PASS
- [x] 0 datos TEST (`test-*`, `@example.com`) — verificado en Supabase
- [ ] 0 emails admin duplicados
- [ ] Preflight `--production` → PASS (con `DEMO_MODE=false`)

## Legal y compliance técnico

- [x] `/legal/privacy` público (staging OK)
- [x] `/legal/terms` público (staging OK)
- [x] `/legal/dpa` público (staging OK)
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
