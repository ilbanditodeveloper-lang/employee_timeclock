/**
 * Validación de datos legales de empresa para exportaciones oficiales.
 */

export type CompanyLegalExportFields = {
  name?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  address?: string | null;
  privacyContactEmail?: string | null;
};

export const LEGAL_EXPORT_BLOCK_MESSAGE =
  "Faltan datos legales de empresa. Complete el panel Legal/RGPD antes de usar este informe oficialmente.";

export const LEGAL_DISCLAIMER =
  "Plantilla orientativa. Requiere revisión por asesoría laboral, abogado o DPO antes de uso oficial.";

export const SAAS_PROCESSOR_NOTICE =
  "TimeClock actúa como encargado del tratamiento respecto a los datos de empleados tratados por cuenta de la empresa cliente. La empresa cliente actúa como responsable del tratamiento.";

export const OFFICIAL_EXPORT_FOOTER =
  "Documento generado por TimeClock. La exactitud de la configuración legal y laboral corresponde a la empresa usuaria.";

export function validateCompanyLegalForOfficialExport(company: CompanyLegalExportFields): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];
  if (!company.legalName?.trim() && !company.name?.trim()) missing.push("razón social");
  if (!company.taxId?.trim()) missing.push("CIF/NIF");
  if (!company.privacyContactEmail?.trim()) missing.push("email de contacto privacidad");
  return { valid: missing.length === 0, missing };
}

export function isValidPrivacyEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
