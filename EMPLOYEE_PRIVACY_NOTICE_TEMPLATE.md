# Cláusula informativa al trabajador (RGPD art. 13)

> **Nombre correcto:** *Cláusula informativa* o *Aviso informativo sobre protección de datos* — **no** es un contrato ni un consentimiento de control horario.

## Base legal (España / UE)

- **AEPD (FAQ):** no hace falta consentimiento para el registro horario; basta la obligación legal (art. 34.9 ET, art. 6.1.c RGPD). Sí hay que **informar** al trabajador.
- **Artículo 13 RGPD:** información en el momento de recoger los datos (clara, concisa, comprensible).
- **Guía AEPD** *La protección de datos en las relaciones laborales*: el deber de información debe poder **acreditarse** (acuse de recibo, firma, registro electrónico).

## Contenido mínimo del documento

1. Identidad del responsable (razón social, NIF, domicilio, contacto privacidad)
2. Finalidad (registro de jornada, horarios, incidencias, ausencias)
3. Base jurídica (obligación legal / contrato)
4. Categorías de datos (identificación, fichajes, incidencias; GPS si aplica)
5. Destinatarios (empresa, inspección, encargado del tratamiento SaaS)
6. Plazo de conservación (mínimo 4 años en España)
7. Derechos ARSOPL y reclamación ante AEPD
8. Medidas de seguridad
9. Acuse de recibo (firma en papel o registro en app)

## En esta aplicación

| Dónde | Qué hace |
|-------|----------|
| **Admin → Legal / RGPD** | Rellenar datos de la empresa, ver cláusula, **imprimir**, **PDF**, listado de acuses |
| **App empleado (1.er acceso)** | Muestra la cláusula personalizada y guarda acuse electrónico (fecha + IP) |
| **PDF con firma** | Bloque de firma al final para entrega en papel o firma digital externa |

El texto generado está en `shared/employeePrivacyNotice.ts`. Al cambiar el texto de forma relevante, incrementar `EMPLOYEE_PRIVACY_NOTICE_VERSION` en `shared/const.ts`.

## Revisión profesional

Esta plantilla es orientativa. Antes de uso comercial masivo, conviene revisión por asesoría laboral / protección de datos.
