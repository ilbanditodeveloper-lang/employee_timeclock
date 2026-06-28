import type { Company } from "../../drizzle/schema";
import {
  getSubscriptionViolationReason,
  type SubscriptionViolationReason,
} from "@shared/subscriptionPlans";
import { countEmployeesByCompany, getCompanyById, getDb } from "../db";
import { companies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { isDemoRequestActive } from "../demo/mode";

export async function deactivateCompanyIfSubscriptionViolated(
  companyId: number
): Promise<{ deactivated: boolean; reason: SubscriptionViolationReason | null }> {
  if (isDemoRequestActive()) {
    return { deactivated: false, reason: null };
  }

  const company = await getCompanyById(companyId);
  if (!company?.isActive) {
    return { deactivated: false, reason: null };
  }

  const counts = await countEmployeesByCompany([companyId]);
  const employeeCount = counts.get(companyId) ?? 0;
  const reason = getSubscriptionViolationReason(company, employeeCount);
  if (!reason) {
    return { deactivated: false, reason: null };
  }

  const db = await getDb();
  if (!db) {
    return { deactivated: false, reason };
  }

  await db
    .update(companies)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(companies.id, companyId));

  return { deactivated: true, reason };
}

export async function syncAllCompaniesSubscriptionEnforcement(): Promise<number> {
  if (isDemoRequestActive()) return 0;

  const db = await getDb();
  if (!db) return 0;

  const activeCompanies = await db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.isActive, true));

  let deactivated = 0;
  for (const row of activeCompanies) {
    const result = await deactivateCompanyIfSubscriptionViolated(row.id);
    if (result.deactivated) deactivated += 1;
  }
  return deactivated;
}

export async function loadCompanyAfterSubscriptionSync(companyId: number): Promise<Company | undefined> {
  await deactivateCompanyIfSubscriptionViolated(companyId);
  return getCompanyById(companyId);
}
