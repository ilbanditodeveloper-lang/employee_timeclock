import type { SubscriptionPlan } from "./subscriptionPlans";

export const BILLING_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
] as const;

export type BillingStatus = (typeof BILLING_STATUSES)[number];

export const CHECKOUT_PLANS = ["starter", "pro", "enterprise"] as const;
export type CheckoutPlan = (typeof CHECKOUT_PLANS)[number];

export function isCheckoutPlan(value: string): value is CheckoutPlan {
  return (CHECKOUT_PLANS as readonly string[]).includes(value);
}

export function getStripePriceIdForPlan(plan: CheckoutPlan): string | null {
  const key =
    plan === "starter"
      ? "STRIPE_PRICE_STARTER"
      : plan === "pro"
        ? "STRIPE_PRICE_PRO"
        : "STRIPE_PRICE_ENTERPRISE";
  return process.env[key]?.trim() || null;
}

export function planFromStripePriceId(priceId: string): CheckoutPlan | null {
  if (priceId === process.env.STRIPE_PRICE_STARTER?.trim()) return "starter";
  if (priceId === process.env.STRIPE_PRICE_PRO?.trim()) return "pro";
  if (priceId === process.env.STRIPE_PRICE_ENTERPRISE?.trim()) return "enterprise";
  return null;
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function getPublicStripeConfig() {
  return {
    enabled: isStripeConfigured(),
    publishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY?.trim() || null,
    priceIds: {
      starter: process.env.STRIPE_PRICE_STARTER?.trim() || null,
      pro: process.env.STRIPE_PRICE_PRO?.trim() || null,
      enterprise: process.env.STRIPE_PRICE_ENTERPRISE?.trim() || null,
    },
  };
}

export function mapStripeSubscriptionStatus(
  status: string | null | undefined
): BillingStatus | null {
  if (!status) return null;
  if ((BILLING_STATUSES as readonly string[]).includes(status)) {
    return status as BillingStatus;
  }
  return null;
}

export function subscriptionPlanFromCheckout(plan: CheckoutPlan): SubscriptionPlan {
  return plan;
}
