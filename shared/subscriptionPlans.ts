export const TRIAL_DAYS = 14;

export const SUBSCRIPTION_PLANS = ["trial", "starter", "pro", "enterprise", "legacy"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

export const SUBSCRIPTION_PLAN_LABELS: Record<SubscriptionPlan, string> = {
  trial: "Trial (14 días)",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
  legacy: "Legacy (sin límite)",
};

/** Límite de empleados activos por plan (null = sin límite práctico). */
export const PLAN_EMPLOYEE_LIMITS: Record<SubscriptionPlan, number | null> = {
  trial: 5,
  starter: 10,
  pro: 50,
  enterprise: null,
  legacy: null,
};

export function addTrialDays(from: Date = new Date(), days = TRIAL_DAYS): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return end;
}

export function getPlanEmployeeLimit(plan: SubscriptionPlan): number | null {
  return PLAN_EMPLOYEE_LIMITS[plan];
}

export function getTrialDaysRemaining(trialEndsAt: Date | null | undefined, now = new Date()): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

export function isTrialExpired(
  plan: SubscriptionPlan,
  trialEndsAt: Date | null | undefined,
  now = new Date()
): boolean {
  if (plan !== "trial") return false;
  if (!trialEndsAt) return false;
  return trialEndsAt.getTime() <= now.getTime();
}

export const SUBSCRIPTION_TRIAL_EXPIRED_MSG =
  "Tu periodo de prueba ha terminado. Contacta con soporte para activar un plan.";

export function subscriptionEmployeeLimitMessage(limit: number, plan: SubscriptionPlan): string {
  return `Has alcanzado el límite de ${limit} empleados del plan ${SUBSCRIPTION_PLAN_LABELS[plan]}. Contacta con soporte para ampliarlo.`;
}

export type SubscriptionAccessStatus = {
  plan: SubscriptionPlan;
  planLabel: string;
  employeeCount: number;
  employeeLimit: number | null;
  atEmployeeLimit: boolean;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  accessBlocked: boolean;
  showTrialBanner: boolean;
  showLimitBanner: boolean;
  bannerMessage: string | null;
  blockMessage: string | null;
};

export function getSubscriptionAccessStatus(
  company: { subscriptionPlan?: string | null; trialEndsAt?: Date | null },
  employeeCount: number,
  now = new Date()
): SubscriptionAccessStatus {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  const employeeLimit = getPlanEmployeeLimit(plan);
  const trialDaysRemaining =
    plan === "trial" ? getTrialDaysRemaining(company.trialEndsAt, now) : null;
  const trialExpired = isTrialExpired(plan, company.trialEndsAt, now);
  const atEmployeeLimit = employeeLimit != null && employeeCount >= employeeLimit;
  const accessBlocked = trialExpired;

  let bannerMessage: string | null = null;
  if (plan === "trial" && !trialExpired && trialDaysRemaining != null) {
    if (trialDaysRemaining === 0) {
      bannerMessage = "Tu periodo de prueba termina hoy.";
    } else if (trialDaysRemaining === 1) {
      bannerMessage = "Te queda 1 día de prueba.";
    } else {
      bannerMessage = `Te quedan ${trialDaysRemaining} días de prueba.`;
    }
    if (employeeLimit != null) {
      bannerMessage += ` Límite: ${employeeLimit} empleados.`;
    }
  } else if (atEmployeeLimit && !trialExpired) {
    bannerMessage = `Has alcanzado el límite de ${employeeLimit} empleados de tu plan.`;
  }

  return {
    plan,
    planLabel: SUBSCRIPTION_PLAN_LABELS[plan],
    employeeCount,
    employeeLimit,
    atEmployeeLimit,
    trialDaysRemaining,
    trialExpired,
    accessBlocked,
    showTrialBanner: plan === "trial" && !trialExpired && trialDaysRemaining != null,
    showLimitBanner: atEmployeeLimit && !trialExpired,
    bannerMessage,
    blockMessage: trialExpired ? SUBSCRIPTION_TRIAL_EXPIRED_MSG : null,
  };
}

export function assertSubscriptionAllowsAccess(company: {
  subscriptionPlan?: string | null;
  trialEndsAt?: Date | null;
}) {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  if (isTrialExpired(plan, company.trialEndsAt)) {
    throw new Error(SUBSCRIPTION_TRIAL_EXPIRED_MSG);
  }
}

export function assertCanAddEmployee(
  company: { subscriptionPlan?: string | null; trialEndsAt?: Date | null },
  employeeCount: number
) {
  assertSubscriptionAllowsAccess(company);
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  const limit = getPlanEmployeeLimit(plan);
  if (limit != null && employeeCount >= limit) {
    throw new Error(subscriptionEmployeeLimitMessage(limit, plan));
  }
}
