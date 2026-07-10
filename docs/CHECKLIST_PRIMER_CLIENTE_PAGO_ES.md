# Checklist — Primer cliente de pago

> Objetivo: tener **timeclockapp.es** listo para registrar y cobrar a un negocio real en España.  
> Tiempo estimado si sigues este documento: **2–4 horas** (sin contar revisión legal externa).

---

## Criterio GO / NO-GO

| Resultado | Significado |
|-----------|-------------|
| **GO piloto** | Script automatizado PASS + secciones A, B y C completadas + prueba manual D |
| **GO comercial** | Todo lo anterior + Stripe live + soporte configurado + revisión legal mínima (E) |

---

## Verificación rápida (5 minutos)

Desde la carpeta `employee_timeclock`, con `DATABASE_URL` de producción en `.env.local` o `.env.staging.local`:

```bash
npm run check:primer-cliente
```

Solo comprobaciones HTTP (sin BD):

```bash
npm run check:primer-cliente:http
```

Comandos adicionales:

```bash
npm run preflight:prod -- --url=https://timeclockapp.es
npm run verify:db:prod
node scripts/inventory-test-data.mjs
```

**Todos deben terminar con exit code 0** antes de abrir a clientes de pago.

---

## A. Infraestructura Render (Dashboard → Environment)

Pantalla: [Render Dashboard](https://dashboard.render.com) → servicio `employee-timeclock` → **Environment**

| Variable | Valor / acción |
|----------|----------------|
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://timeclockapp.es` |
| `VITE_APP_URL` | `https://timeclockapp.es` (rebuild tras cambiar) |
| `JWT_SECRET` | ≥ 32 caracteres, único, no reutilizar de staging |
| `CRON_SECRET` | string aleatorio largo |
| `SUPERADMIN_PASSWORD` | fuerte (no `123456`) |
| `DEMO_MODE` | **no** poner `true` (eliminar o `false`) |
| `CRON_INTERNAL` | `false` |
| `DATABASE_URL` | pooler Supabase UE (puerto 6543) |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | `node scripts/generate-vapid-keys.js` |
| `VAPID_SUBJECT` | `mailto:tu-email@soporte.com` |

**Cron externo** (cron-job.org, Render Cron o similar):

- URL: `https://timeclockapp.es/api/cron/notifications?secret=TU_CRON_SECRET`
- Frecuencia: **cada 1 minuto** (`* * * * *`)
- Método: GET

**Health check:** abrir `https://timeclockapp.es/healthz` → debe devolver `{"ok":true,...}`

---

## B. Supabase (base de datos)

Pantalla: [Supabase Dashboard](https://supabase.com/dashboard) → proyecto → **SQL** / **Database**

1. **Migraciones:** en local con `DATABASE_URL` de prod:
   ```bash
   npm run db:migrate
   ```
   Debe aplicar hasta `0016_fix_legal_compliance_columns.sql` sin error.

2. **Backups:** Settings → Database → activar backups (plan Pro recomendado).

3. **Datos limpios:** `node scripts/inventory-test-data.mjs` → 0 empresas `test-*`, 0 `@example.com`.

---

## C. Stripe (cobro automático)

Guía completa: [STRIPE_AND_NATIVE_SETUP.md](./STRIPE_AND_NATIVE_SETUP.md)

| Paso | Dónde |
|------|--------|
| Crear productos Starter / Pro / Enterprise | Stripe Dashboard → Productos |
| Copiar `price_...` a Render | `STRIPE_PRICE_STARTER`, `_PRO`, `_ENTERPRISE` |
| Webhook | `https://timeclockapp.es/api/stripe/webhook` |
| Eventos | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed` |
| Probar | Landing → registro → pago test → Admin → Ajustes → Facturación |

Sin Stripe: puedes usar **superadmin** para activar plan manualmente (solo piloto).

---

## D. Prueba manual con un negocio real (30–45 min)

Hazlo tú o con un cliente de confianza.

### D1. Registro y onboarding admin

| Paso | URL / pantalla |
|------|----------------|
| Landing | `https://timeclockapp.es/` |
| Registro negocio | Landing → precios → **Registra tu negocio** |
| Login admin | `https://timeclockapp.es/admin-login` |
| Onboarding | `https://timeclockapp.es/admin/onboarding` — completar datos, local, legal, opcional 1 empleado |

### D2. Configuración del negocio

| Paso | Pantalla admin |
|------|----------------|
| Datos legales | **Ajustes** → razón social, CIF, email privacidad |
| Ubicación | **Ajustes** → dirección y radio (si usas GPS) |
| Empleado | **Empleados** → crear con email y contraseña |
| Horario | **Turnos** → horario L–V + guardar |

### D3. Fichaje empleado

| Paso | URL |
|------|-----|
| Login empleado | `https://timeclockapp.es/employee-login` |
| Fichaje | **Entrada** → **Pausa** → **Salida** |
| Cerrar sesión | Debe volver a `/employee-login` |
| Push (opcional) | Aceptar notificaciones en el navegador; aviso **1 min antes** y a la hora |

### D4. Admin: informes y legal

| Paso | Pantalla |
|------|----------|
| Export PDF/CSV | **Ajustes** o **Legal** → exportar registro |
| Auditoría | **Legal** → log de cambios |
| Vacaciones | Empleado solicita → admin aprueba en **Vacaciones** |

### D5. Superadmin (tú como operador)

| Paso | URL |
|------|-----|
| Panel | `https://timeclockapp.es/superadmin` |
| Empresa nueva | Verificar plan, trial, contacto CRM |
| Soporte WhatsApp | Superadmin → **Ajustes plataforma** → número WhatsApp |
| Landing | Mismo panel → textos, precios, FAQ |

---

## E. Legal y comercial (antes de vender en masa)

No bloquea 1–2 pilotos con acompañamiento, **sí bloquea escalar sin riesgo**:

- [ ] Revisión de textos por asesor laboral / RGPD (plantillas en `/legal/*`)
- [ ] DPA firmado o aceptado formalmente con cada cliente B2B
- [ ] Email de soporte real en landing y `VAPID_SUBJECT`
- [ ] Política de precios clara (trial 14 días → plan de pago)

La app muestra aviso de «plantilla orientativa» — **no sustituye asesoramiento profesional**.

---

## F. Los 10 ítems del script automatizado

| # | Ítem | Si falla |
|---|------|----------|
| 1 | `/healthz` | Revisar deploy Render |
| 2 | `/legal/privacy`, `/terms`, `/dpa` | Build frontend |
| 3 | `getAppConfig` seguro | Revisar servidor |
| 4 | Cron protegido | `CRON_SECRET` en Render |
| 5 | VAPID | Generar claves push |
| 6 | Stripe | Configurar precios y webhook |
| 7 | Secretos prod | JWT, CRON, superadmin |
| 8 | `DEMO_MODE` off | Quitar en Render |
| 9 | BD migrada | `npm run db:migrate` |
| 10 | Sin datos TEST | `cleanup-test-data.mjs` |

---

## G. Día del primer cliente de pago

1. Cliente se registra en landing (o tú lo creas en superadmin).
2. Completa onboarding y datos legales (CIF, razón social).
3. Pago Stripe o activación manual de plan en superadmin.
4. Creas empleados y horarios.
5. Empleados fichan desde móvil (PWA: «Añadir a pantalla de inicio»).
6. Tú monitorizas 24 h: logs Render, cron, primer export PDF.

**Contacto soporte recomendado:** WhatsApp en superadmin + email en footer landing.

---

## H. Qué NO hace falta para el primer cliente

- App nativa iOS/Android (PWA basta).
- Historial de notificaciones en admin (eliminado a propósito).
- Separar BD staging/prod (opcional hasta más clientes).
- RBAC completo por roles (owner/admin basta al inicio).

---

## Referencias

- [GO_LIVE_CHECKLIST.md](./GO_LIVE_CHECKLIST.md)
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md)
- [LEGAL_SAAS_READINESS_CHECKLIST_ES.md](./LEGAL_SAAS_READINESS_CHECKLIST_ES.md)
- [BACKUP_AND_RECOVERY.md](./BACKUP_AND_RECOVERY.md)

**Última actualización:** checklist alineado con recordatorio push 1 min y logout corregido.
