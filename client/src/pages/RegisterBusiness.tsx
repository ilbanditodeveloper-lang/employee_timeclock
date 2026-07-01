import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { Building2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import AccessPageShell from "@/components/AccessPageShell";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { CHECKOUT_PLANS, isCheckoutPlan, type CheckoutPlan } from "@shared/stripeConfig";
import { cn } from "@/lib/utils";

type SuccessData = {
  companySlug: string;
  companyName: string;
  adminUsername: string;
  adminEmail: string;
  scopedLogin: string;
};

const COUNTRY_OPTIONS = [{ code: "ES", label: "España" }];

const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", label: "Europe/Madrid (España peninsular)" },
  { value: "Atlantic/Canary", label: "Atlantic/Canary (Canarias)" },
];

export default function RegisterBusiness() {
  const [, setLocation] = useLocation();
  const { setAdminSession, setEmployeeSession } = useAuthContext();
  const configQuery = trpc.publicApi.getAppConfig.useQuery();
  const landingQuery = trpc.publicApi.getLandingPageConfig.useQuery();
  const registerBusiness = trpc.publicApi.registerBusiness.useMutation();
  const checkout = trpc.publicApi.createCheckoutSession.useMutation();
  const planFromUrl = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const plan = params.get("plan");
    return plan && isCheckoutPlan(plan) ? (plan as CheckoutPlan) : null;
  }, []);
  const initialPromo = useMemo(() => {
    return new URLSearchParams(window.location.search).get("promo")?.trim() ?? "";
  }, []);

  const [promotionCode, setPromotionCode] = useState(initialPromo);
  const [selectedPlan, setSelectedPlan] = useState<CheckoutPlan>("pro");

  const checkoutPlans = useMemo(() => {
    const packs = landingQuery.data?.pricingPacks ?? [];
    return CHECKOUT_PLANS.map((id) => {
      const pack = packs.find((p) => p.id === id);
      return {
        id,
        name: pack?.name ?? id,
        price: pack ? `${pack.price}${pack.priceSuffix}` : "",
        description: pack?.description ?? "",
        highlighted: pack?.highlighted ?? false,
      };
    });
  }, [landingQuery.data?.pricingPacks]);

  const trialDays = landingQuery.data?.trialDays ?? 14;
  const trialHeadline =
    landingQuery.data?.trialHeadline ?? `${trialDays} días de prueba gratis`;

  useEffect(() => {
    if (planFromUrl) {
      setSelectedPlan(planFromUrl);
      return;
    }
    const highlighted = checkoutPlans.find((p) => p.highlighted);
    if (highlighted) setSelectedPlan(highlighted.id);
  }, [planFromUrl, checkoutPlans]);

  const [businessName, setBusinessName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [country, setCountry] = useState("ES");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [success, setSuccess] = useState<SuccessData | null>(null);

  const registrationAvailable = configQuery.data?.registrationAvailable ?? false;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);

    if (!acceptedTerms) {
      setFieldError("Debes aceptar los Términos de uso y la Política de privacidad");
      return;
    }

    try {
      const result = await registerBusiness.mutateAsync({
        businessName,
        adminName,
        email,
        password,
        confirmPassword,
        country,
        timezone,
        phone: phone.trim() || undefined,
        address: address.trim() || undefined,
        selectedPlan,
        acceptedTerms: true,
      });

      setAdminSession({
        companySlug: result.companySlug,
        displayName: result.adminUsername,
      });
      setEmployeeSession(null);

      if (planFromUrl && configQuery.data?.stripe?.enabled) {
        try {
          const { url } = await checkout.mutateAsync({
            plan: selectedPlan,
            promotionCode: promotionCode.trim() || undefined,
          });
          window.location.href = url;
          return;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "No se pudo iniciar el pago";
          toast.error(message);
          toast.message("Cuenta creada. Puedes contratar el plan desde Ajustes → Facturación.");
        }
      }

      setSuccess({
        companySlug: result.companySlug,
        companyName: result.companyName,
        adminUsername: result.adminUsername,
        adminEmail: result.adminEmail,
        scopedLogin: result.scopedLogin,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo registrar el negocio";
      setFieldError(message);
      toast.error(message);
    }
  };

  if (success) {
    return (
      <AccessPageShell
        backHref="/acceso"
        icon={CheckCircle2}
        title="¡Negocio creado!"
        subtitle={`${success.companyName} ya está listo`}
        badge="Guarda tus datos"
      >
        <p className="text-center text-sm text-slate-600">
          Guarda estos datos de acceso para entrar al panel.
        </p>

        <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-1">Email de acceso (recomendado)</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-foreground break-all">{success.adminEmail}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(success.adminEmail, "Email")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground mb-1">Usuario alternativo</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-foreground break-all">{success.adminUsername}</code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(success.adminUsername, "Usuario")}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-900 dark:text-amber-200">
                <strong>Importante:</strong> para entrar usa tu <strong>email</strong> y la contraseña que
                elegiste. No necesitas recordar el slug de la empresa.
              </p>
            </div>

        <div className="flex flex-col gap-3">
          <Button
            type="button"
            className="w-full bg-blue-700 hover:bg-blue-800"
            onClick={() => setLocation("/admin/onboarding")}
          >
            Configurar mi negocio
          </Button>
          <Button type="button" variant="outline" className="w-full border-blue-300 text-blue-900 hover:bg-blue-50" onClick={() => setLocation("/admin")}>
            Ir al panel
          </Button>
        </div>
      </AccessPageShell>
    );
  }

  return (
    <AccessPageShell
      backHref="/acceso"
      icon={Building2}
      title="Registrar mi negocio"
      subtitle="Crea tu empresa y accede al panel de administración"
      badge="Registro"
      maxWidthClass="max-w-lg"
    >
      {!registrationAvailable ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-950">
            El registro requiere base de datos configurada (<code>DATABASE_URL</code>). El modo demo no
            permite crear negocios reales.
          </p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Nombre del negocio *</label>
          <Input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Mi Cafetería"
            required
            minLength={2}
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Nombre del responsable *</label>
          <Input
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            placeholder="Juan Pérez"
            required
            minLength={2}
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Email del admin *</label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="juan@empresa.com"
            required
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Contraseña *</label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            required
            minLength={8}
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Confirmar contraseña *</label>
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repite la contraseña"
            required
            minLength={8}
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">País *</label>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="flex h-10 w-full rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm"
            >
              {COUNTRY_OPTIONS.map((opt) => (
                <option key={opt.code} value={opt.code}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-900">Zona horaria *</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="flex h-10 w-full rounded-md border border-blue-100 bg-blue-50/40 px-3 py-2 text-sm"
            >
              {TIMEZONE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Teléfono (opcional)</label>
          <Input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+34 600 000 000"
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Dirección del negocio (opcional)</label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Calle Mayor 1, Madrid"
            className="border-blue-100 bg-blue-50/40"
          />
        </div>

        <div>
          <p className="mb-2 block text-sm font-medium text-slate-900">Plan de suscripción *</p>
          <p className="mb-3 text-xs text-slate-600">
            {trialHeadline}. Elige el plan que quieres contratar después de la prueba.
          </p>
          <div className="space-y-2">
            {checkoutPlans.map((plan) => (
              <label
                key={plan.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
                  selectedPlan === plan.id
                    ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500/30"
                    : "border-blue-100 bg-blue-50/30 hover:border-blue-200"
                )}
              >
                <input
                  type="radio"
                  name="subscription-plan"
                  value={plan.id}
                  checked={selectedPlan === plan.id}
                  onChange={() => setSelectedPlan(plan.id)}
                  className="mt-1"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900">{plan.name}</span>
                    {plan.price ? (
                      <span className="text-sm text-slate-600">{plan.price}</span>
                    ) : null}
                    {plan.highlighted ? (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-medium text-white">
                        Popular
                      </span>
                    ) : null}
                  </span>
                  {plan.description ? (
                    <span className="mt-1 block text-xs text-slate-600 line-clamp-2">
                      {plan.description}
                    </span>
                  ) : null}
                </span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
          />
          <label htmlFor="terms" className="text-sm leading-relaxed text-slate-600">
            He leído y acepto los{" "}
            <Link href="/legal/terms" className="underline hover:text-blue-800">
              Términos de uso
            </Link>{" "}
            y la{" "}
            <Link href="/legal/privacy" className="underline hover:text-blue-800">
              Política de privacidad
            </Link>
            .
          </label>
        </div>

        {fieldError ? (
          <p className="text-sm text-destructive" role="alert">
            {fieldError}
          </p>
        ) : null}

        {planFromUrl && configQuery.data?.stripe?.enabled ? (
          <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-2">
            <label className="block text-sm font-medium text-slate-900" htmlFor="promo-code">
              Código promocional (opcional)
            </label>
            <Input
              id="promo-code"
              value={promotionCode}
              onChange={(e) => setPromotionCode(e.target.value.toUpperCase())}
              placeholder="Ej. SOCIO20"
              className="border-blue-100 bg-white uppercase"
              autoComplete="off"
            />
            <p className="text-xs text-slate-600">
              Si no lo tienes ahora, podrás introducirlo en la pantalla de pago de Stripe.
            </p>
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={registerBusiness.isPending || !registrationAvailable}
          className="h-11 w-full bg-blue-700 hover:bg-blue-800"
        >
          {registerBusiness.isPending ? "Creando negocio..." : "Registrar negocio"}
        </Button>
      </form>
    </AccessPageShell>
  );
}
