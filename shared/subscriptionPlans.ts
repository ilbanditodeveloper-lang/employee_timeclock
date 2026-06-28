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
