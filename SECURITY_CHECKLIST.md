# Checklist de seguridad — TimeClock

- [x] Contraseñas con scrypt + migración legado
- [x] Sesiones JWT en cookie httpOnly
- [x] Aislamiento por companyId en API
- [x] Rate limiting en login
- [x] Audit log en correcciones/anulaciones de fichajes
- [x] Soft void (no borrado físico de fichajes desde UI)
- [ ] Rotación JWT_SECRET en producción
- [ ] Backups automáticos PostgreSQL
- [ ] Monitorización y alertas
- [ ] Pentest antes de escalar clientes
- [ ] Separación entornos demo / producción
