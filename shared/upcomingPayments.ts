import {
  hasPaidSubscriptionActive,
  isInFreeTrialCountdown,
  type SubscriptionPlan,
} from "./subscriptionPlans";

export type UpcomingPaymentKind = "renewal" | "trial_end" | "payment_overdue";

export type UpcomingPaymentSource = {
  id: number;
  name: string;
  subscriptionPlan?: string | null;
  planName?: string | null;
  trialEndsAt?: Date | string | null;
  currentPeriodEnd?: Date | string | null;
  stripeSubscriptionId?: string | null;
  billingStatus?: string | null;
  billingEmail?: string | null;
  isActive?: boolean;
};

export type UpcomingPaymentRow = {
  companyId: number;
  companyName: string;
  plan: SubscriptionPlan;
  planName: string;
  kind: UpcomingPaymentKind;
  dueAt: Date;
  billingStatus: string | null;
  billingEmail: string | null;
  isActive: boolean;
};

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function buildUpcomingPayments(
  companies: UpcomingPaymentSource[],
  now = new Date()
): UpcomingPaymentRow[] {
  const rows: UpcomingPaymentRow[] = [];
  const nowMs = now.getTime();

  for (const company of companies) {
    const status = (company.billingStatus ?? "").trim();
    const periodEnd = toDate(company.currentPeriodEnd);
    const trialEnd = toDate(company.trialEndsAt);
    const plan = (company.subscriptionPlan ?? "trial") as SubscriptionPlan;
    const planName = company.planName?.trim() || plan;
    const base = {
      companyId: company.id,
      companyName: company.name,
      plan,
      planName,
      billingStatus: status || null,
      billingEmail: company.billingEmail ?? null,
      isActive: company.isActive ?? true,
    };

    const isOverdueStatus = status === "past_due" || status === "unpaid";

    if (isOverdueStatus && company.stripeSubscriptionId?.trim()) {
      rows.push({
        ...base,
        kind: "payment_overdue",
        dueAt: periodEnd && periodEnd.getTime() < nowMs ? periodEnd : periodEnd ?? now,
      });
      continue;
    }

    if (hasPaidSubscriptionActive(company) && periodEnd) {
      const isTrialing = status === "trialing";
      const isLate = periodEnd.getTime() < nowMs;
      rows.push({
        ...base,
        kind: isLate ? "payment_overdue" : isTrialing ? "trial_end" : "renewal",
        dueAt: periodEnd,
      });
      continue;
    }

    if (
      isInFreeTrialCountdown({ ...company, trialEndsAt: trialEnd }, now) &&
      trialEnd &&
      trialEnd.getTime() > nowMs
    ) {
      rows.push({
        ...base,
        kind: "trial_end",
        dueAt: trialEnd,
      });
    }
  }

  return rows
    .filter((row) => row.kind === "payment_overdue" || row.dueAt.getTime() >= nowMs)
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export type PricingPackPriceSource = { id: string; price: string; priceSuffix?: string };

export function estimatePaymentAmountLabel(
  plan: string,
  packs: PricingPackPriceSource[] | null | undefined
): string | null {
  if (!packs?.length) return null;
  const pack = packs.find((p) => p.id === plan);
  if (!pack?.price) return null;
  const suffix = pack.priceSuffix ?? "";
  return `${pack.price}${suffix}`.trim();
}
