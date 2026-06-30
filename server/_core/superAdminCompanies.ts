import type { Company } from "../../drizzle/schema";
import {
  getPlanEmployeeLimit,
  getTrialDaysRemaining,
  isTrialExpired,
  getSuperAdminSubscriptionLabel,
  SUBSCRIPTION_PLAN_LABELS,
  type SubscriptionPlan,
} from "@shared/subscriptionPlans";
import type { CrmStage } from "@shared/crmStages";

export type SuperAdminCompanyRow = Company & {
  adminUsername: string | null;
  adminEmail: string | null;
  adminLastSignedIn: Date | null;
  employeeCount: number;
  locationCount: number;
  planLabel: string;
  planName: string;
  planEmployeeLimit: number | null;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  billingStatus: string | null;
  stripeCustomerId: string | null;
  followUpOverdue: boolean;
  followUpDueSoon: boolean;
  atEmployeeLimit: boolean;
};

export function enrichSuperAdminCompany(
  company: Company & {
    adminUsername?: string | null;
    adminEmail?: string | null;
    adminLastSignedIn?: Date | null;
  },
  employeeCount: number,
  locationCount = 1,
  now = new Date()
): SuperAdminCompanyRow {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  const employeeLimit = getPlanEmployeeLimit(plan);
  const followUp = company.crmNextFollowUpAt;
  const followUpOverdue = Boolean(followUp && followUp.getTime() < now.getTime());
  const followUpDueSoon = Boolean(
    followUp &&
      !followUpOverdue &&
      followUp.getTime() - now.getTime() <= 3 * 24 * 60 * 60 * 1000
  );

  return {
    ...company,
    adminUsername: company.adminUsername ?? null,
    adminEmail: company.adminEmail ?? company.privacyContactEmail ?? company.billingEmail ?? null,
    adminLastSignedIn: company.adminLastSignedIn ?? null,
    employeeCount,
    locationCount,
    planLabel: getSuperAdminSubscriptionLabel(plan),
    planName: SUBSCRIPTION_PLAN_LABELS[plan],
    planEmployeeLimit: employeeLimit,
    trialDaysRemaining: plan === "trial" ? getTrialDaysRemaining(company.trialEndsAt, now) : null,
    trialExpired: isTrialExpired(plan, company.trialEndsAt, now),
    billingStatus: company.billingStatus ?? null,
    stripeCustomerId: company.stripeCustomerId ?? null,
    crmStage: (company.crmStage ?? "trial") as CrmStage,
    followUpOverdue,
    followUpDueSoon,
    atEmployeeLimit: employeeLimit != null && employeeCount >= employeeLimit,
  };
}
