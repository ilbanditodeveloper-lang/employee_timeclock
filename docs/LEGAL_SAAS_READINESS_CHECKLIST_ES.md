# Checklist Legal/Técnico SaaS España — TimeClock

> Plantillas y checklist orientativos. Requieren revisión por asesoría laboral, abogado o DPO antes de uso oficial.
> Este checklist es técnico-operativo y **no constituye asesoramiento legal**.

## 1. Registro de jornada

* [x] Registro diario individual por empleado.
* [x] Hora concreta de inicio.
* [x] Hora concreta de fin.
* [x] Pausas registradas (`timeclock_breaks`).
* [x] Horas brutas calculadas.
* [x] Horas netas calculadas descontando pausas.
* [x] Incidencias visibles.
* [x] Correcciones trazadas.
* [x] Motivo obligatorio en correcciones.
* [x] No se borra el registro original (void/corrección auditada).

## 2. Conservación

* [x] Conservación mínima 4 años (configurable 4–10).
* [x] Bloqueo de borrado antes de 4 años (`voidTimeclock` + política retención).
* [x] Empleados desactivados conservan histórico.
* [x] Legal hold disponible (`legalHoldEnabled`).
* [x] Proceso documentado de anonimización/borrado posterior (`retention:review`).
* [x] Exportaciones disponibles durante el plazo.

## 3. Tiempo parcial

* [x] Tipo de contrato configurable (`contractType`).
* [x] Horas semanales contratadas (`weeklyContractedHours`).
* [x] Resumen mensual (`getMonthlyEmployeeReport`).
* [x] Total de horas por mes.
* [x] Diferencia frente a horas contratadas.
* [x] Entrega/descarga registrada (`monthly_report_deliveries`).
* [x] Exportación CSV específica para trabajador a tiempo parcial.

## 4. RGPD trabajador

* [x] Aviso informativo art. 13 RGPD.
* [x] Acuse de lectura sin consentimiento como base principal.
* [x] Versión del aviso guardada.
* [x] Fecha/IP/userAgent guardados si aplica.
* [x] Trabajador puede volver a leer el aviso (`/employee/legal`).
* [x] Trabajador puede descargar sus registros (PDF/CSV).
* [x] Canal de solicitud de derechos RGPD (`gdpr_requests`).
* [x] Supresión limitada cuando haya obligación legal de conservación.

## 5. SaaS B2B

* [x] Empresa cliente acepta Términos (onboarding + `company_legal_acceptances`).
* [x] Empresa cliente acepta Política de privacidad SaaS.
* [x] Empresa cliente acepta DPA.
* [x] Se guarda versión de cada documento.
* [x] Se guarda hash de cada documento.
* [ ] Reaceptación automática forzada en UI si cambia versión activa (API parcial).
* [x] La empresa cliente aparece como responsable.
* [x] TimeClock aparece como encargado.

## 6. Datos legales empresa

* [x] Razón social obligatoria para export oficial.
* [x] CIF/NIF obligatorio para export oficial.
* [x] Domicilio en panel legal.
* [x] Email privacidad obligatorio para export oficial.
* [x] Centro/s de trabajo (restaurants).
* [x] Exportaciones oficiales bloqueadas si faltan datos críticos.
* [x] Sin placeholders tipo “Juan Pérez” en export oficial (validación).

## 7. Geolocalización

* [x] GPS desactivado por defecto (`locationEnabled: false`).
* [x] Activación con justificación y categoría.
* [x] Aviso específico al trabajador (portal legal + cláusula).
* [x] Solo ubicación puntual al fichar.
* [x] No seguimiento continuo (diseño).
* [x] Alternativa sin GPS para centro físico (panel/tablet).
* [x] Coordenadas exactas no visibles por defecto en exports.
* [x] Cambios GPS auditados (`GPS_ENABLED` / `GPS_DISABLED`).

## 8. Auditoría

* [x] Logs append-only (tabla `audit_logs` + triggers anti-DELETE en tablas críticas).
* [x] Correcciones auditadas.
* [x] Anulaciones auditadas.
* [x] Exportaciones auditadas (`EXPORT_GENERATED`).
* [x] Acuses legales auditados.
* [x] Cambios de configuración legal auditados.
* [x] Cambios de GPS auditados.
* [x] Hash encadenado evaluado (`previous_hash` / `current_hash` en schema).

## 9. Roles y permisos

* [x] `owner`, `admin`, `hr_manager`, `accountant`, `read_only_auditor` (enum `admin_role`).
* [ ] Enforcement completo en todos los endpoints (parcial — `adminRoles.ts` creado).
* [x] `employee` aislado por `employeeId`.
* [x] Multiempresa aislada por `companyId`.
* [ ] Tests e2e de acceso cruzado completos.

## 10. Exportaciones

* [x] PDF oficial con pausas y horas netas.
* [x] CSV con pausas y horas netas.
* [x] Excel con pausas y horas netas.
* [x] Paquete inspección (manifest JSON + CSV + checksum).
* [x] Pausas incluidas.
* [x] Horas netas incluidas.
* [x] Auditoría incluida (opción `includeAuditHistory`).
* [x] Hash/checksum de exportación.
* [x] Fecha de generación.
* [x] Datos legales empresa.

## 11. Seguridad

* [x] HTTPS (producción).
* [x] Cookies httpOnly/secure.
* [x] Password hashing.
* [x] RBAC (base).
* [ ] Backups documentados (operación infra).
* [x] Logs de acceso / auditoría.
* [x] Protección frente a borrado accidental (retención + triggers).
* [x] Sin exposición de IPs a usuarios no autorizados (solo admin).
* [x] Sin coordenadas exactas salvo rol autorizado.

## 12. Revisión profesional pendiente

* [ ] Revisión abogado laboral.
* [ ] Revisión protección de datos/RGPD.
* [ ] Revisión gestoría.
* [ ] Revisión DPA firmado entre partes.
* [ ] Revisión subencargados reales del despliegue.
* [ ] Revisión textos finales antes de venta masiva.

## Tests implementados

* `shared/laborReport.test.ts` — horas netas, pausas, export CSV.
* `shared/monthlyLaborReport.test.ts` — tiempo parcial, totalización.
* `shared/retentionPolicy.test.ts` — bloqueo < 4 años, legal hold.

## Migraciones

* `drizzle/0015_saas_legal_compliance.sql` — contratos, RGPD, DPA, GPS, retención, triggers.

---

**Este checklist es técnico-operativo y no constituye asesoramiento legal.**
