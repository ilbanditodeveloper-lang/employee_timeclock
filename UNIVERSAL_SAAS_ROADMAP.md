# Roadmap TimeClock universal (actualizado)

## Completado en esta copia

### Fase 1 — Seguridad y multiempresa
- Licencia propietaria (`UNLICENSED` + `LICENSE`)
- Hash `scrypt` + migración Base64 legado
- Multiempresa: `companies`, `companyId`, login `slug::usuario`
- Superadmin web (`/superadmin`)
- **Sesiones JWT en cookie httpOnly** (sin contraseña en localStorage)
- **Rate limiting** en login
- **Aislamiento reforzado** por `companyId` en listados y mutaciones
- Username único por empresa `(companyId, username)`

### Fase 2 — Registro horario y auditoría
- Campos `status`, `source`, corrección y anulación en `timeclocks`
- **Audit log** (`audit_logs`) en correcciones/anulaciones
- **Sin borrado físico** de fichajes desde UI (anulación con motivo)
- Motivo obligatorio al corregir fichajes

### Fase 3 — RGPD y legal (plantillas)
- Pantallas: `/legal/privacy`, `/legal/terms`, aviso empleado embebido
- Registro `legal_acceptances` (lectura informativa, no consentimiento)
- Datos legales por empresa (CIF, contacto privacidad, timezone, GPS opcional)
- Documentos: `PRIVACY_POLICY.md`, `TERMS_OF_USE.md`, `DATA_PROCESSING_AGREEMENT_TEMPLATE.md`, etc.

### Fase 4 — Exportaciones
- Excel y PDF en admin (existentes)
- Pendiente: CSV dedicado y metadatos legales en cabecera de informes

### Fase 5 — Google Play
- `GOOGLE_PLAY_DATA_SAFETY.md` borrador
- Pendiente: TWA/Capacitor, iconos 512px, URL pública en producción

## Pendiente recomendado

1. Pestaña **Legal** en admin (UI para `updateCompanyLegal`)
2. Export **CSV** y cabecera legal en PDF/Excel
3. Rol **manager** con permisos limitados
4. Onboarding empresa ampliado (CIF, términos)
5. Modo **demo** aislado
6. Billing y bloqueo por impago
7. Revisión legal profesional de todas las plantillas

> **Aviso:** Los textos legales son plantillas. Deben revisarse con un asesor antes de comercializar.
