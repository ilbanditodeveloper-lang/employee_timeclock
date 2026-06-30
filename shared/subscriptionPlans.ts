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

/** Etiqueta corta para el panel superadmin (Trial / Mensual / Anual). */
export function getSuperAdminSubscriptionLabel(plan: SubscriptionPlan): string {
  if (plan === "trial") return "Trial";
  if (plan === "starter" || plan === "pro") return "Mensual";
  if (plan === "enterprise") return "Anual";
  return "Legacy";
}

/** Límite de empleados activos por plan (null = sin límite práctico). */
export const PLAN_EMPLOYEE_LIMITS: Record<SubscriptionPlan, number | null> = {
  trial: 5,
  starter: 10,
  pro: 50,
  enterprise: null,
  legacy: null,
};

/** Límite de sedes/locales por plan (null = ilimitado). */
export const PLAN_LOCATION_LIMITS: Record<SubscriptionPlan, number | null> = {
  trial: 1,
  starter: 1,
  pro: 1,
  enterprise: null,
  legacy: null,
};

export const BILLING_BLOCKED_STATUSES = ["past_due", "unpaid", "canceled", "incomplete_expired"] as const;

export const BILLING_BLOCKED_MSG =
  "Tu suscripción requiere atención. Actualiza el método de pago para seguir usando TimeClock.";

export function getPlanLocationLimit(plan: SubscriptionPlan): number | null {
  return PLAN_LOCATION_LIMITS[plan];
}

export function isBillingAccessBlocked(
  company: {
    subscriptionPlan?: string | null;
    billingStatus?: string | null;
    stripeSubscriptionId?: string | null;
  }
): boolean {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  if (plan === "trial" || plan === "legacy") return false;
  if (!company.stripeSubscriptionId) return false;
  const status = company.billingStatus ?? "";
  return (BILLING_BLOCKED_STATUSES as readonly string[]).includes(status);
}

export function assertBillingAllowsAccess(company: {
  subscriptionPlan?: string | null;
  billingStatus?: string | null;
  stripeSubscriptionId?: string | null;
  isActive?: boolean;
}) {
  if (company.isActive === false) {
    throw new Error("Empresa no disponible");
  }
  if (isBillingAccessBlocked(company)) {
    throw new Error(BILLING_BLOCKED_MSG);
  }
}

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
  return `Has alcanzado el límite de ${limit} empleados del plan ${SUBSCRIPTION_PLAN_LABELS[plan]}. La empresa ha sido dada de baja automáticamente.`;
}

export type SubscriptionViolationReason = "trial_expired" | "employee_limit" | "billing_blocked";

export function getSubscriptionViolationReason(
  company: {
    subscriptionPlan?: string | null;
    trialEndsAt?: Date | null;
    billingStatus?: string | null;
    stripeSubscriptionId?: string | null;
    isActive?: boolean;
  },
  employeeCount: number,
  now = new Date()
): SubscriptionViolationReason | null {
  if (company.isActive === false) return null;
  if (isBillingAccessBlocked(company)) {
    return "billing_blocked";
  }
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  if (isTrialExpired(plan, company.trialEndsAt, now)) {
    return "trial_expired";
  }
  const limit = getPlanEmployeeLimit(plan);
  if (limit != null && employeeCount >= limit) {
    return "employee_limit";
  }
  return null;
}

export type SubscriptionAccessStatus = {
  plan: SubscriptionPlan;
  planLabel: string;
  employeeCount: number;
  employeeLimit: number | null;
  locationLimit: number | null;
  atEmployeeLimit: boolean;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  billingStatus: string | null;
  billingBlocked: boolean;
  stripeEnabled: boolean;
  accessBlocked: boolean;
  showTrialBanner: boolean;
  showLimitBanner: boolean;
  showBillingBanner: boolean;
  bannerMessage: string | null;
  blockMessage: string | null;
};

export function getSubscriptionAccessStatus(
  company: {
    subscriptionPlan?: string | null;
    trialEndsAt?: Date | null;
    billingStatus?: string | null;
    stripeSubscriptionId?: string | null;
  },
  employeeCount: number,
  now = new Date(),
  options?: { stripeEnabled?: boolean; locationCount?: number }
): SubscriptionAccessStatus {
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  const employeeLimit = getPlanEmployeeLimit(plan);
  const locationLimit = getPlanLocationLimit(plan);
  const billingBlocked = isBillingAccessBlocked(company);
  const trialDaysRemaining =
    plan === "trial" ? getTrialDaysRemaining(company.trialEndsAt, now) : null;
  const trialExpired = isTrialExpired(plan, company.trialEndsAt, now);
  const atEmployeeLimit = employeeLimit != null && employeeCount >= employeeLimit;
  const accessBlocked = trialExpired || atEmployeeLimit || billingBlocked;

  let bannerMessage: string | null = null;
  if (billingBlocked) {
    bannerMessage = BILLING_BLOCKED_MSG;
  } else if (plan === "trial" && !trialExpired && trialDaysRemaining != null) {
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
    bannerMessage = `Has alcanzado el límite de ${employeeLimit} empleados. La empresa será dada de baja automáticamente.`;
  } else if (
    locationLimit != null &&
    options?.locationCount != null &&
    options.locationCount >= locationLimit
  ) {
    bannerMessage = `Tu plan permite ${locationLimit} sede. Actualiza a Enterprise para multi-sede.`;
  }

  return {
    plan,
    planLabel: SUBSCRIPTION_PLAN_LABELS[plan],
    employeeCount,
    employeeLimit,
    locationLimit,
    atEmployeeLimit,
    trialDaysRemaining,
    trialExpired,
    billingStatus: company.billingStatus ?? null,
    billingBlocked,
    stripeEnabled: options?.stripeEnabled ?? false,
    accessBlocked,
    showTrialBanner: plan === "trial" && !trialExpired && trialDaysRemaining != null && !billingBlocked,
    showLimitBanner: atEmployeeLimit && !trialExpired && !billingBlocked,
    showBillingBanner: billingBlocked,
    bannerMessage,
    blockMessage: billingBlocked
      ? BILLING_BLOCKED_MSG
      : trialExpired
        ? SUBSCRIPTION_TRIAL_EXPIRED_MSG
        : atEmployeeLimit
          ? subscriptionEmployeeLimitMessage(employeeLimit as number, plan)
          : null,
  };
}

export function assertSubscriptionAllowsAccess(company: {
  subscriptionPlan?: string | null;
  trialEndsAt?: Date | null;
  billingStatus?: string | null;
  stripeSubscriptionId?: string | null;
  isActive?: boolean;
}) {
  if (company.isActive === false) {
    throw new Error("Empresa no disponible");
  }
  assertBillingAllowsAccess(company);
  const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
  if (isTrialExpired(plan, company.trialEndsAt)) {
    throw new Error(SUBSCRIPTION_TRIAL_EXPIRED_MSG);
  }
}

export function assertCanAddEmployee(
  company: {
    subscriptionPlan?: string | null;
    trialEndsAt?: Date | null;
    isActive?: boolean;
  },
  employeeCount: number
) {
  const violation = getSubscriptionViolationReason(company, employeeCount + 1);
  if (violation === "trial_expired") {
    throw new Error(SUBSCRIPTION_TRIAL_EXPIRED_MSG);
  }
  if (violation === "employee_limit") {
    const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
    const limit = getPlanEmployeeLimit(plan);
    if (limit != null) {
      throw new Error(subscriptionEmployeeLimitMessage(limit, plan));
    }
  }
}
