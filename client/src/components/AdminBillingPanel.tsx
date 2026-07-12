import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CreditCard, ExternalLink } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { adminApiInput } from "@/lib/adminContext";
import { SUBSCRIPTION_PLAN_LABELS } from "@shared/subscriptionPlans";
import type { CheckoutPlan } from "@shared/stripeConfig";

type Props = {
  plan: string;
  planLabel: string;
  billingStatus: string | null;
  stripeEnabled: boolean;
  trialDaysRemaining: number | null;
  showBillingBanner: boolean;
};

const CHECKOUT_PLAN_IDS: CheckoutPlan[] = ["starter", "pro", "enterprise"];

export default function AdminBillingPanel({
  plan,
  planLabel,
  billingStatus,
  stripeEnabled,
  trialDaysRemaining,
  showBillingBanner,
}: Props) {
  const { t } = useLocale();
  const [promotionCode, setPromotionCode] = useState("");
  const landingQuery = trpc.publicApi.getLandingPageConfig.useQuery();
  const upgradePlans = useMemo(() => {
    const packs = landingQuery.data?.pricingPacks ?? [];
    return CHECKOUT_PLAN_IDS.map((id) => {
      const pack = packs.find((p) => p.id === id);
      const price = pack ? `${pack.price}${pack.priceSuffix}` : "";
      return {
        id,
        label: pack?.name ?? SUBSCRIPTION_PLAN_LABELS[id],
        price,
      };
    });
  }, [landingQuery.data?.pricingPacks]);
  const checkout = trpc.publicApi.createCheckoutSession.useMutation();
  const portal = trpc.publicApi.createBillingPortalSession.useMutation();

  const startCheckout = async (checkoutPlan: CheckoutPlan) => {
    try {
      const { url } = await checkout.mutateAsync({
        ...adminApiInput(),
        plan: checkoutPlan,
        promotionCode: promotionCode.trim() || undefined,
      });
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("admin.billing.toasts.checkoutFailed")
      );
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await portal.mutateAsync(adminApiInput());
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("admin.billing.toasts.portalFailed")
      );
    }
  };

  if (!stripeEnabled) {
    return (
      <Card className="p-6 border-dashed">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <CreditCard className="size-4" />
          {t("admin.billing.title")}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t("admin.billing.stripeDisabled")}{" "}
          {t("admin.billing.currentPlan")}{" "}
          <strong>
            {planLabel || SUBSCRIPTION_PLAN_LABELS[plan as keyof typeof SUBSCRIPTION_PLAN_LABELS] || plan}
          </strong>
          {trialDaysRemaining != null
            ? ` · ${t("admin.billing.trialDaysRemaining", { days: String(trialDaysRemaining) })}`
            : null}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="size-4" />
          {t("admin.billing.subscriptionTitle")}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin.billing.currentPlan")} <strong>{planLabel}</strong>
          {billingStatus ? ` · ${t("admin.billing.stripeStatus")} ${billingStatus}` : null}
          {trialDaysRemaining != null
            ? ` · ${t("admin.billing.trialLabel")} ${t("admin.billing.trialDays", { days: String(trialDaysRemaining) })}`
            : null}
        </p>
      </div>

      {showBillingBanner ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          {t("admin.billing.attentionBanner")}
        </div>
      ) : null}

      <div className="max-w-sm space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="billing-promo">
          {t("admin.billing.promoCode")}
        </label>
        <Input
          id="billing-promo"
          value={promotionCode}
          onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
          placeholder="Ej. SOCIO20"
          className="uppercase"
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">{t("admin.billing.promoHint")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {upgradePlans.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={plan === p.id ? "default" : "outline"}
            size="sm"
            disabled={checkout.isPending}
            onClick={() => void startCheckout(p.id)}
          >
            {plan === p.id
              ? t("admin.billing.currentPlanButton", { label: p.label })
              : t("admin.billing.upgradeButton", { label: p.label })}{" "}
            ({p.price})
          </Button>
        ))}
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={portal.isPending}
          onClick={() => void openPortal()}
        >
          <ExternalLink className="size-4 mr-1" />
          {t("admin.billing.billingPortal")}
        </Button>
      </div>
    </Card>
  );
}
