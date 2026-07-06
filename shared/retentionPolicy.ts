/**
 * Política de retención mínima (4 años) para registros horarios en España.
 */

export const MINIMUM_RETENTION_YEARS = 4;

export type RetentionPolicy = {
  minimumRetentionYears: number;
  configuredRetentionYears: number;
  legalHoldEnabled: boolean;
};

export function normalizeRetentionPolicy(company: {
  minimumRetentionYears?: number | null;
  dataRetentionYears?: number | null;
  legalHoldEnabled?: boolean | null;
}): RetentionPolicy {
  const minimum = Math.max(MINIMUM_RETENTION_YEARS, company.minimumRetentionYears ?? MINIMUM_RETENTION_YEARS);
  const configured = Math.max(minimum, company.dataRetentionYears ?? MINIMUM_RETENTION_YEARS);
  return {
    minimumRetentionYears: minimum,
    configuredRetentionYears: configured,
    legalHoldEnabled: company.legalHoldEnabled ?? false,
  };
}

export function yearsSince(date: Date, asOf = new Date()): number {
  const ms = asOf.getTime() - date.getTime();
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

export function isWithinMinimumRetention(recordDate: Date, policy: RetentionPolicy, asOf = new Date()): boolean {
  return yearsSince(recordDate, asOf) < policy.minimumRetentionYears;
}

export function canPurgeRecord(recordDate: Date, policy: RetentionPolicy, asOf = new Date()): boolean {
  if (policy.legalHoldEnabled) return false;
  return yearsSince(recordDate, asOf) >= policy.configuredRetentionYears;
}

export const RETENTION_BLOCK_DELETE_MSG =
  "No se puede eliminar este registro: conservación legal mínima de 4 años en registros de jornada.";
