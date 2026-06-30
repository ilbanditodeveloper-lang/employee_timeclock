import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CreditCard, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
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

const UPGRADE_PLANS: { id: CheckoutPlan; label: string; price: string }[] = [
  { id: "starter", label: "Starter", price: "19€/mes" },
  { id: "pro", label: "Pro", price: "29€/mes" },
  { id: "enterprise", label: "Enterprise", price: "79€/mes" },
];

export default function AdminBillingPanel({
  plan,
  planLabel,
  billingStatus,
  stripeEnabled,
  trialDaysRemaining,
  showBillingBanner,
}: Props) {
  const checkout = trpc.publicApi.createCheckoutSession.useMutation();
  const portal = trpc.publicApi.createBillingPortalSession.useMutation();

  const startCheckout = async (checkoutPlan: CheckoutPlan) => {
    try {
      const { url } = await checkout.mutateAsync({
        ...adminApiInput(),
        plan: checkoutPlan,
      });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar el pago");
    }
  };

  const openPortal = async () => {
    try {
      const { url } = await portal.mutateAsync(adminApiInput());
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir el portal de facturación");
    }
  };

  if (!stripeEnabled) {
    return (
      <Card className="p-6 border-dashed">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <CreditCard className="size-4" />
          Facturación
        </h3>
        <p className="text-sm text-muted-foreground">
          Stripe no está configurado en el servidor. El superadmin puede gestionar planes manualmente.
          Plan actual: <strong>{planLabel || SUBSCRIPTION_PLAN_LABELS[plan as keyof typeof SUBSCRIPTION_PLAN_LABELS] || plan}</strong>
          {trialDaysRemaining != null ? ` · ${trialDaysRemaining} días de prueba restantes` : null}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="size-4" />
          Suscripción y facturación
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Plan actual: <strong>{planLabel}</strong>
          {billingStatus ? ` · Estado Stripe: ${billingStatus}` : null}
          {trialDaysRemaining != null ? ` · Prueba: ${trialDaysRemaining} días` : null}
        </p>
      </div>

      {showBillingBanner ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
          Tu suscripción requiere atención. Actualiza el método de pago para seguir usando TimeClock.
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {UPGRADE_PLANS.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant={plan === p.id ? "default" : "outline"}
            size="sm"
            disabled={checkout.isPending}
            onClick={() => void startCheckout(p.id)}
          >
            {plan === p.id ? `Plan ${p.label}` : `Contratar ${p.label}`} ({p.price})
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
          Portal de facturación
        </Button>
      </div>
    </Card>
  );
}
