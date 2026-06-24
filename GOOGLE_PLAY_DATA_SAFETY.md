# Google Play — Data Safety (borrador)

> Completar en Play Console. Revisar antes de publicar.

## Datos recogidos

| Tipo | Recogido | Compartido | Obligatorio | Finalidad |
|------|----------|------------|-------------|-----------|
| Nombre | Sí | No | Sí (empleador) | Registro horario |
| Email/teléfono | Opcional | No | No | Contacto laboral |
| Ubicación aproximada | Opcional (empresa) | No | No | Validar fichaje en sede |
| Identificadores dispositivo (push) | Sí si notificaciones | No | No | Recordatorios de entrada |
| Historial empleo (fichajes) | Sí | No | Sí | Registro horario legal |

## Seguridad

- Datos cifrados en tránsito: **Sí** (HTTPS).
- Eliminación de datos: solicitable al empleador/responsable; fichajes sujetos a retención legal 4 años.

## Permisos Android (TWA/PWA)

- Ubicación: solo en primer plano al fichar, si la empresa lo activa.
- Notificaciones: opcionales, con explicación previa.
- Sin cámara, micrófono, contactos ni biometría en la app.

## URL política privacidad

Publicar en: `https://TU-DOMINIO/legal/privacy`
