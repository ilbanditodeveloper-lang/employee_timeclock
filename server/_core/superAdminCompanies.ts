import type { Company } from "../../drizzle/schema";
import {
  getPlanEmployeeLimit,
  getTrialDaysRemaining,
  isTrialExpired,
  getSuperAdminSubscriptionLabel,
  type SubscriptionPlan,
} from "@shared/subscriptionPlans";

export type SuperAdminCompanyRow = Company & {
  adminUsername: string | null;
  employeeCount: number;
  planLabel: string;
  planEmployeeLimit: number | null;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
};

export function enrichSuperAdminCompany(
  company: Company & { adminUsername?: string | null },
  employeeCount: number
): SuperAdminCompanyRow {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  return {
    ...company,
    adminUsername: company.adminUsername ?? null,
    employeeCount,
    planLabel: getSuperAdminSubscriptionLabel(plan),
    planEmployeeLimit: getPlanEmployeeLimit(plan),
    trialDaysRemaining: plan === "trial" ? getTrialDaysRemaining(company.trialEndsAt) : null,
    trialExpired: isTrialExpired(plan, company.trialEndsAt),
  };
}
