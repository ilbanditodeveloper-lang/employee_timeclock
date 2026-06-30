import type { Company } from "../../drizzle/schema";
import {
  getPlanEmployeeLimit,
  getTrialDaysRemaining,
  isTrialExpired,
  getSuperAdminSubscriptionLabel,
  SUBSCRIPTION_PLAN_LABELS,
  type SubscriptionPlan,
} from "@shared/subscriptionPlans";

export type SuperAdminCompanyRow = Company & {
  adminUsername: string | null;
  employeeCount: number;
  locationCount: number;
  planLabel: string;
  planName: string;
  planEmployeeLimit: number | null;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  billingStatus: string | null;
  stripeCustomerId: string | null;
};

export function enrichSuperAdminCompany(
  company: Company & { adminUsername?: string | null },
  employeeCount: number,
  locationCount = 1
): SuperAdminCompanyRow {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  return {
    ...company,
    adminUsername: company.adminUsername ?? null,
    employeeCount,
    locationCount,
    planLabel: getSuperAdminSubscriptionLabel(plan),
    planName: SUBSCRIPTION_PLAN_LABELS[plan],
    planEmployeeLimit: getPlanEmployeeLimit(plan),
    trialDaysRemaining: plan === "trial" ? getTrialDaysRemaining(company.trialEndsAt) : null,
    trialExpired: isTrialExpired(plan, company.trialEndsAt),
    billingStatus: company.billingStatus ?? null,
    stripeCustomerId: company.stripeCustomerId ?? null,
  };
}
