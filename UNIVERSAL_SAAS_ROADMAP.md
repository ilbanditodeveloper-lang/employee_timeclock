# Roadmap para convertir TimeClock en sistema universal

Este documento define el plan para ofrecer la app a varios negocios sin entregar el codigo fuente.

## Objetivo

- Un solo producto para multiples empresas (multi-tenant).
- Codigo privado y controlado solo por el propietario.
- Despliegue centralizado tipo SaaS (los clientes usan URL, no reciben repo).

## Estado actual de esta copia

- Licencia del proyecto cambiada a `UNLICENSED`.
- Archivo `LICENSE` propietario agregado.
- Credenciales admin por defecto eliminadas (ahora son obligatorias en entorno).
- Passwords migradas a hash seguro con `scrypt` (compatibilidad temporal con base64 legado).
- Base multiempresa agregada en esquema (`companies` + `companyId` en tablas core).
- Login multiempresa habilitado por `slug::usuario` (admin y empleado).
- Pantalla de superadmin agregada para crear/activar/desactivar empresas y configurar admin.
- Aprovisionamiento automatico de admin deshabilitado (ahora lo crea solo superadmin).

## Fase 1 - Seguridad base (completada en esta copia)

1. Licencia propietaria y aviso legal.
2. Quitar credenciales hardcodeadas.
3. Usar hash seguro para passwords.
4. Mantener compatibilidad de login para usuarios existentes.

## Fase 2 - Multiempresa en datos

1. Crear tabla `companies`:
   - `id`
   - `name`
   - `slug` (unico)
   - `isActive`
   - `plan`
   - `createdAt`, `updatedAt`
2. Agregar `companyId` en tablas:
   - `users`
   - `restaurants`
   - `employees`
   - `schedules`
   - `timeclocks`
   - `incidents`
   - `timeOffRequests`
   - `pushSubscriptions`
   - `notificationLogs`
3. Crear indices por `companyId`.
4. Migrar data existente a una empresa inicial (`default-company`).

## Fase 3 - Aislamiento por tenant

1. Resolver tenant por `subdominio` o `slug` en login.
2. Inyectar `companyId` en el contexto de request.
3. Filtrar todas las queries por `companyId`.
4. Validar que un admin solo opera su empresa.
5. Agregar pruebas de aislamiento entre empresas.

## Fase 4 - SaaS operativo

1. Panel superadmin (solo propietario):
   - alta/baja de empresas
   - activar/desactivar cuentas
   - ver consumo y errores
2. Billing:
   - plan por empleados o por sede
   - renovacion mensual
   - bloqueo por impago (gracia configurable)
3. Logs y auditoria:
   - acciones admin criticas
   - accesos y cambios de fichajes

## Fase 5 - Proteccion comercial

1. Contrato de servicio (SaaS) con terminos anti-reventa.
2. Politica de privacidad y procesamiento de datos (RGPD/LOPD si aplica).
3. Marca y dominio propio.
4. Repositorio privado con acceso solo del propietario.
5. Backups y plan de continuidad.

## Checklist de despliegue recomendado

1. Entorno productivo separado (`prod`).
2. Base de datos gestionada (PostgreSQL).
3. Variables seguras en plataforma cloud.
4. HTTPS obligatorio.
5. Copias automaticas y monitorizacion.

## Siguiente implementacion sugerida en codigo

1. Crear migracion `companies` + `companyId` en `drizzle/schema.ts`.
2. Adaptar `server/db.ts` para consultas scoping por `companyId`.
3. Actualizar `server/routers.ts` para validar tenant en cada endpoint.
4. Ajustar frontend para login con `companySlug`.
