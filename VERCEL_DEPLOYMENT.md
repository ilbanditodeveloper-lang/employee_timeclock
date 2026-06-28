# � Documento obsoleto para SaaS completo

> **No usar Vercel como deploy principal** de TimeClock SaaS.

## Por qu�

TimeClock es un **monolito** Node.js + Express que sirve:

- API tRPC en `/api/trpc`
- Cron en `/api/cron/notifications`
- Frontend est�tico en producci�n (`dist/public`)

El archivo `vercel.json` del repo solo despliega **frontend est�tico** (`dist/public`) **sin backend**. No funcionar� el registro, login, fichajes, exportaciones ni cron.

## Deploy recomendado

Ver **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)**  Render Web Service (Opci�n A, monolito same-origin).

## Si necesitas Vercel en el futuro

Solo como CDN de est�ticos con backend separado (Opci�n B). Requiere:

- `VITE_API_BASE_URL` apuntando al backend
- CORS y cookies cross-domain
- Cron HTTP en el backend (Render/Railway)

No implementado en Fase 5.

## Referencia hist�rica

La gu�a completa de despliegue en Vercel (solo frontend) est� en el historial de git del archivo `VERCEL_DEPLOYMENT.md` antes de Fase 5. No la uses para el SaaS completo.

## Alternativa m�nima en Vercel (no recomendada)

Si insistes en Vercel solo para est�ticos:

1. Build: `pnpm build`
2. Output: `dist/public`
3. Backend debe vivir en otro servicio con `VITE_API_BASE_URL`

Sin backend desplegado, la app no es funcional.
