# Stripe, PWA y apps nativas — pasos para ti

El código ya incluye facturación Stripe, multi-sede Enterprise, panel superadmin completo y mejoras PWA. **Tú debes completar la configuración externa** (Stripe Dashboard, migración BD, builds nativos).

---

## 1. Migración de base de datos

En local o staging (conexión directa o pooler según tu flujo habitual):

```bash
cd employee_timeclock
npx drizzle-kit migrate
```

Esto aplica `0013_stripe_billing_multisite.sql` (campos Stripe en `companies` + `isPrimary` en `restaurants`).

---

## 2. Stripe (facturación automática)

### 2.1 Cuenta y productos

1. Crea cuenta en [Stripe](https://dashboard.stripe.com) (modo Test primero).
2. **Productos → Añadir producto** para Starter, Pro y Enterprise (suscripción mensual).
3. Copia el **Price ID** de cada uno (`price_...`).

### 2.2 Variables en Render (o `.env.local`)

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_ENTERPRISE=price_...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

`VITE_STRIPE_PUBLISHABLE_KEY` es opcional hoy (el checkout es server-side), pero conviene dejarla para futuras mejoras.

### 2.3 Webhook

En Stripe → **Developers → Webhooks → Add endpoint**:

- **URL:** `https://employee-timeclock-1.onrender.com/api/stripe/webhook`
- **Eventos:** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copia el **Signing secret** → `STRIPE_WEBHOOK_SECRET`

### 2.5 Códigos promocionales (descuentos para negocios)

En el **pago con Stripe Checkout** el cliente puede usar un código promocional:

1. Stripe → **Productos → Cupones** → crea un cupón (ej. 20 % de descuento, 3 meses gratis, etc.).
2. **Cupones → Códigos promocionales** → **Crear código** (ej. `SOCIO20`, `AMIGO50`).
3. Asocia el código al cupón y, si quieres, limita usos o fecha de caducidad.

En la app:

- Al contratar desde la landing o **Admin → Ajustes → Facturación**, hay un campo opcional para el código.
- Si no lo rellenan, en la página de pago de Stripe verán **«Añadir código promocional»**.

No hace falta configurar nada más en Render: ya está activado en el checkout.

### 2.6 Probar flujo

1. Landing → plan → registro → redirección a Stripe Checkout.
2. Admin → **Ajustes → Suscripción y facturación** → contratar o abrir portal.
3. Superadmin → **Empresas → Gestionar** para overrides manuales.

Sin Stripe configurado, todo sigue funcionando con trial y gestión manual en superadmin.

---

## 3. Multi-sede (Enterprise)

- Planes Trial / Starter / Pro: **1 sede**.
- Enterprise: **sedes ilimitadas**.
- Admin → **Ajustes → Sedes / locales** → crear sedes, cambiar sede activa (recarga datos de esa sede).
- Empleados siguen asignados a una sede al crearlos.

---

## 4. PWA (ya integrada)

- `manifest.webmanifest` + service worker en producción.
- Banner **Instalar TimeClock** en móvil (Android/Chrome) e instrucciones iOS (Safari → Compartir → Añadir a pantalla de inicio).

**Opcional:** genera iconos PNG 192×192 y 512×512 en `client/public/` y añádelos al manifest para mejor instalación en Android.

---

## 5. App nativa iOS / Android (Capacitor)

El repo incluye `capacitor.config.ts`. **En tu máquina** (con Xcode / Android Studio):

```bash
cd employee_timeclock
npm install
npm run build
npm install @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
npx cap init TimeClock com.timeclock.app --web-dir dist/public
npx cap add android
npx cap add ios
npx cap sync
npx cap open android   # o: npx cap open ios
```

Publicar en App Store / Play Store requiere cuentas de desarrollador Apple/Google, certificados y revisión de las tiendas (no automatizable desde aquí).

**Alternativa rápida:** la PWA instalada cubre el 90 % del caso “app en el móvil” sin tiendas.

---

## 6. Checklist producción

- [ ] Migración `0013` aplicada en Supabase prod
- [ ] Variables Stripe en Render
- [ ] Webhook Stripe apuntando a prod con secret correcto
- [ ] Precios en landing alineados con Stripe (superadmin → Web / Landing)
- [ ] Redeploy Render + Ctrl+F5 en navegador
- [ ] Probar registro + checkout en modo Test Stripe
- [ ] (Opcional) Capacitor build para tiendas
