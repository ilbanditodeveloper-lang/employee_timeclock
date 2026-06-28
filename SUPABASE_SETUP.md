# Configuración de Supabase — TimeClock

Guía para **local**, **staging** y **production**. Usa **proyectos Supabase separados** por entorno; nunca mezcles datos TEST con producción.

## Entornos

| Entorno | Proyecto Supabase | Datos TEST | DEMO_MODE |
|---------|-------------------|------------|-----------|
| Local/dev | Propio o staging | Permitido | Permitido |
| Staging | `timeclock-staging` | Permitido | Permitido |
| Production | `timeclock-production` | **Prohibido** | **Prohibido** |

## Paso 1: Crear proyectos

1. [supabase.com](https://supabase.com) → **New Project**
2. Repetir para staging y production
3. Configuración recomendada:
   - **Region**: UE (Frankfurt `eu-central-1` o equivalente)
   - **Database password**: contraseña fuerte, distinta por proyecto
   - **Project name**: `timeclock-staging`, `timeclock-production`

## Paso 2: URLs de conexión

Settings → **Database** → Connection string.

### App runtime (pooler) — usar en `DATABASE_URL`

Para la aplicación en Render/Railway usa el **Transaction pooler** (puerto **6543**):

```
postgresql://postgres.[ref]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:6543/postgres
```

Ventajas: más conexiones concurrentes, adecuado para serverless/long-running Node.

### Migraciones (conexión directa) — solo CLI local/CI

Para `pnpm db:migrate` usa conexión **directa** (puerto **5432**):

```
postgresql://postgres:[PASSWORD]@db.[ref].supabase.co:5432/postgres
```

Puedes exportar temporalmente:

```bash
# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres"
pnpm db:migrate
```

En Render, ejecuta migraciones desde tu máquina o CI apuntando a la URL directa **antes** del deploy, no en cada start.

## Paso 3: Variables de entorno

Ver [docs/ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md).

```env
# .env.local (dev) — pooler o directo según prefieras en local
DATABASE_URL=postgresql://postgres.[ref]:[PASSWORD]@...pooler.supabase.com:6543/postgres
```

**Nunca** commitear `.env.local` ni URLs con password.

## Paso 4: Migraciones

### Desarrollo (primera vez o cambio de esquema)

```bash
pnpm db:generate   # solo si cambiaste schema en código
pnpm db:migrate
```

### Staging / Production

**Siempre** migraciones controladas, nunca `db:push` con generate sin revisar:

```bash
pnpm db:migrate
node scripts/verify-production-db.mjs --production   # o --staging
```

Migraciones actuales: `drizzle/0000` … `drizzle/0008` (incluye compliance, onboarding, índice email admin único).

## Paso 5: Verificar esquema

```bash
node scripts/verify-production-db.mjs --staging
node scripts/verify-production-db.mjs --production
```

Comprueba tablas clave, índice `users_admin_email_lower_unique_idx`, ausencia de datos TEST en prod.

## Backups

1. Settings → **Database** → **Backups**
2. Activar backups diarios (plan Pro recomendado en production)
3. Descargar backup manual antes de migraciones importantes

Detalle: [docs/BACKUP_AND_RECOVERY.md](./docs/BACKUP_AND_RECOVERY.md)

## Datos TEST — reglas

| Patrón | Acción en prod |
|--------|----------------|
| Companies slug `test-*` | Preflight **falla** |
| Users `@example.com` | Preflight **falla** |
| Nombres con prefijo TEST | Preflight **falla** |

Limpieza solo staging/dev:

```bash
node scripts/inventory-test-data.mjs
node scripts/cleanup-test-data.mjs --confirm
```

## Deploy con Render (recomendado)

No uses Vercel para el SaaS completo. Ver [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

En Render:

1. `DATABASE_URL` = pooler (6543) del proyecto correcto (staging vs prod)
2. Build incluye `VITE_*` del entorno
3. Tras migraciones: `verify-production-db` + preflight

## Row Level Security (RLS)

La app usa Drizzle + JWT propio, no Supabase Auth. RLS es opcional; si lo activas, define políticas que no bloqueen la conexión `postgres` de la app.

## Troubleshooting

### `password authentication failed`

- Contraseña correcta en URL (URL-encode caracteres especiales)
- Proyecto activo, región correcta

### `Connection refused` / timeout

- Usar pooler (6543) en runtime
- Usar directo (5432) solo para migraciones
- Comprobar IP allowlist si está configurada

### Tablas faltantes

```bash
pnpm db:migrate
node scripts/verify-production-db.mjs --staging
```

### Emails admin duplicados

```bash
node scripts/check-admin-email-duplicates.mjs
```

## Seguridad

1. Proyectos **separados** staging / production
2. Passwords y `DATABASE_URL` solo en variables de entorno
3. Backups regulares en production
4. No restaurar prod en máquinas de dev sin anonimizar
5. Rotar password si hay sospecha de filtración → actualizar Render + redeploy

## Recursos

- [Supabase Docs](https://supabase.com/docs)
- [Drizzle PostgreSQL](https://orm.drizzle.team/docs/get-started-postgresql)
- [ENVIRONMENT_VARIABLES.md](./docs/ENVIRONMENT_VARIABLES.md)
- [DEPLOYMENT.md](./docs/DEPLOYMENT.md)
