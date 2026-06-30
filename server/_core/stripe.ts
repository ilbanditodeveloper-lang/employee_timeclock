import { companies } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { getCompanyById, getDb } from "../db";
import {
  getStripePriceIdForPlan,
  isStripeConfigured,
  mapStripeSubscriptionStatus,
  planFromStripePriceId,
  subscriptionPlanFromCheckout,
  type CheckoutPlan,
} from "@shared/stripeConfig";
import { addTrialDays } from "@shared/subscriptionPlans";

type StripeSubscription = {
  id: string;
  status: string;
  customer: string | { id: string };
  current_period_end?: number;
  metadata?: Record<string, string>;
  items?: { data?: Array<{ price?: { id?: string } }> };
};

type StripeCheckoutSession = {
  id: string;
  url?: string | null;
  subscription?: string | StripeSubscription | null;
  customer?: string | null;
  metadata?: Record<string, string>;
  customer_details?: { email?: string | null };
};

type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("Stripe no está configurado");
  return key;
}

async function stripeFormRequest<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getStripeSecretKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(params),
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Stripe error ${res.status}`);
  }
  return json;
}

async function stripeGetRequest<T>(path: string): Promise<T> {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${getStripeSecretKey()}` },
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message ?? `Stripe error ${res.status}`);
  }
  return json;
}

export function getAppBaseUrl(): string {
  const url =
    process.env.FRONTEND_URL?.split(",")[0]?.trim() ||
    process.env.VITE_APP_URL?.split(",")[0]?.trim() ||
    "http://localhost:3000";
  return url.replace(/\/$/, "");
}

export async function ensureStripeCustomer(params: {
  companyId: number;
  email?: string | null;
  name?: string | null;
}): Promise<string> {
  const company = await getCompanyById(params.companyId);
  if (!company) throw new Error("Empresa no encontrada");

  if (company.stripeCustomerId) {
    return company.stripeCustomerId;
  }

  const customer = await stripeFormRequest<{ id: string; email?: string | null }>(
    "/customers",
    {
      name: params.name?.trim() || company.name,
      ...(params.email?.trim() || company.billingEmail || company.privacyContactEmail
        ? { email: (params.email?.trim() || company.billingEmail || company.privacyContactEmail)! }
        : {}),
      "metadata[companyId]": String(company.id),
      "metadata[companySlug]": company.slug,
    }
  );

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(companies)
    .set({
      stripeCustomerId: customer.id,
      billingEmail: customer.email ?? company.billingEmail,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));

  return customer.id;
}

export async function createStripeCheckoutSession(params: {
  companyId: number;
  plan: CheckoutPlan;
  email?: string | null;
  successPath?: string;
  cancelPath?: string;
}): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe no está configurado en el servidor");
  }

  const priceId = getStripePriceIdForPlan(params.plan);
  if (!priceId) {
    throw new Error(`No hay precio Stripe configurado para el plan ${params.plan}`);
  }

  const company = await getCompanyById(params.companyId);
  if (!company) throw new Error("Empresa no encontrada");

  const customerId = await ensureStripeCustomer({
    companyId: company.id,
    email: params.email,
    name: company.name,
  });

  const baseUrl = getAppBaseUrl();
  const session = await stripeFormRequest<StripeCheckoutSession>("/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: `${baseUrl}${params.successPath ?? "/admin?billing=success"}`,
    cancel_url: `${baseUrl}${params.cancelPath ?? "/admin?billing=cancel"}`,
    allow_promotion_codes: "true",
    "metadata[companyId]": String(company.id),
    "metadata[plan]": params.plan,
    "subscription_data[metadata][companyId]": String(company.id),
    "subscription_data[metadata][plan]": params.plan,
  });

  if (!session.url) {
    throw new Error("No se pudo crear la sesión de pago");
  }

  return { url: session.url };
}

export async function createStripeBillingPortalSession(companyId: number): Promise<{ url: string }> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe no está configurado en el servidor");
  }

  const company = await getCompanyById(companyId);
  if (!company) throw new Error("Empresa no encontrada");
  if (!company.stripeCustomerId) {
    throw new Error("Esta empresa aún no tiene cliente de facturación en Stripe");
  }

  const session = await stripeFormRequest<{ url: string }>("/billing_portal/sessions", {
    customer: company.stripeCustomerId,
    return_url: `${getAppBaseUrl()}/admin`,
  });

  return { url: session.url };
}

async function applySubscriptionToCompany(params: {
  companyId: number;
  plan: CheckoutPlan;
  stripeSubscriptionId: string;
  stripeCustomerId?: string | null;
  billingStatus: string | null | undefined;
  currentPeriodEnd: Date | null;
  billingEmail?: string | null;
}) {
  const db = await getDb();
  if (!db) return;

  const blocked = ["canceled", "unpaid", "incomplete_expired"].includes(params.billingStatus ?? "");

  await db
    .update(companies)
    .set({
      subscriptionPlan: subscriptionPlanFromCheckout(params.plan),
      trialEndsAt: null,
      stripeSubscriptionId: params.stripeSubscriptionId,
      stripeCustomerId: params.stripeCustomerId ?? undefined,
      billingStatus: mapStripeSubscriptionStatus(params.billingStatus),
      currentPeriodEnd: params.currentPeriodEnd,
      billingEmail: params.billingEmail ?? undefined,
      isActive: !blocked,
      updatedAt: new Date(),
    })
    .where(eq(companies.id, params.companyId));
}

function customerIdFromStripe(value: string | { id: string } | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function syncSubscriptionFromStripe(subscription: StripeSubscription) {
  const companyId = Number(subscription.metadata?.companyId);
  if (!Number.isFinite(companyId) || companyId <= 0) return;

  const priceId = subscription.items?.data?.[0]?.price?.id;
  const planFromMeta = subscription.metadata?.plan;
  const plan =
    (planFromMeta && ["starter", "pro", "enterprise"].includes(planFromMeta)
      ? (planFromMeta as CheckoutPlan)
      : null) ?? (priceId ? planFromStripePriceId(priceId) : null);

  if (!plan) return;

  await applySubscriptionToCompany({
    companyId,
    plan,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerIdFromStripe(subscription.customer),
    billingStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null,
  });
}

export async function handleStripeWebhookEvent(event: StripeEvent) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as unknown as StripeCheckoutSession;
      const companyId = Number(session.metadata?.companyId);
      const plan = session.metadata?.plan as CheckoutPlan | undefined;
      const subId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;
      if (!Number.isFinite(companyId) || !plan || !subId) return;

      const subscription = await stripeGetRequest<StripeSubscription>(
        `/subscriptions/${subId}`
      );
      await applySubscriptionToCompany({
        companyId,
        plan,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId: customerIdFromStripe(subscription.customer),
        billingStatus: subscription.status,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000)
          : null,
        billingEmail: session.customer_details?.email ?? null,
      });
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as StripeSubscription;
      await syncSubscriptionFromStripe(subscription);
      if (event.type === "customer.subscription.deleted") {
        const companyId = Number(subscription.metadata?.companyId);
        if (Number.isFinite(companyId) && companyId > 0) {
          const db = await getDb();
          if (db) {
            await db
              .update(companies)
              .set({
                billingStatus: "canceled",
                isActive: false,
                updatedAt: new Date(),
              })
              .where(eq(companies.id, companyId));
          }
        }
      }
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as { subscription?: string | { id: string } | null };
      const subId =
        typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
      if (!subId) return;
      const subscription = await stripeGetRequest<StripeSubscription>(
        `/subscriptions/${subId}`
      );
      await syncSubscriptionFromStripe(subscription);
      break;
    }
    default:
      break;
  }
}

export function verifyStripeWebhook(payload: Buffer, signature: string): StripeEvent {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("Stripe webhook no configurado");
  }

  const parts = signature.split(",").map((p) => p.split("="));
  const timestamp = parts.find(([k]) => k === "t")?.[1];
  const sig = parts.find(([k]) => k === "v1")?.[1];
  if (!timestamp || !sig) {
    throw new Error("Firma Stripe inválida");
  }

  const signedPayload = `${timestamp}.${payload.toString("utf8")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");
  if (expected !== sig) {
    throw new Error("Firma webhook no válida");
  }

  return JSON.parse(payload.toString("utf8")) as StripeEvent;
}

export function defaultTrialEndFromLandingDays(days: number): Date {
  return addTrialDays(new Date(), days > 0 ? days : 14);
}
