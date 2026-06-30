import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Building2, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";

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
  const registerBusiness = trpc.publicApi.registerBusiness.useMutation();

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
        acceptedTerms: true,
      });

      setAdminSession({
        companySlug: result.companySlug,
        displayName: result.adminUsername,
      });
      setEmployeeSession(null);

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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
        <div className="max-w-md w-full">
          <Card className="p-8 shadow-lg space-y-6">
            <div className="text-center">
                  <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 dark:bg-blue-900/30 rounded-2xl mb-4">
                <CheckCircle2 className="w-7 h-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">¡Negocio creado correctamente!</h1>
              <p className="text-sm text-muted-foreground">
                <strong>{success.companyName}</strong> ya está listo. Guarda estos datos de acceso.
              </p>
            </div>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border text-sm">
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
              <Button type="button" className="w-full btn-primary" onClick={() => setLocation("/admin/onboarding")}>
                Configurar mi negocio
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={() => setLocation("/admin")}>
                Ir al panel
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-md w-full">
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <Card className="p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-accent rounded-2xl mb-4 shadow-lg">
              <Building2 className="w-7 h-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Registrar mi negocio</h1>
            <p className="text-sm text-muted-foreground">Crea tu empresa y accede al panel de administración</p>
          </div>

          {!registrationAvailable && (
            <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-900 dark:text-yellow-200">
                El registro requiere base de datos configurada (<code>DATABASE_URL</code>). El modo demo no
                permite crear negocios reales.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nombre del negocio *</label>
              <Input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Mi Cafetería"
                required
                minLength={2}
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Nombre del responsable *</label>
              <Input
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="Juan Pérez"
                required
                minLength={2}
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Email del admin *</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="juan@empresa.com"
                required
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Contraseña *</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
                required
                minLength={8}
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Confirmar contraseña *</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repite la contraseña"
                required
                minLength={8}
                className="input-elegant"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">País *</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {COUNTRY_OPTIONS.map((opt) => (
                    <option key={opt.code} value={opt.code}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Zona horaria *</label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              <label className="block text-sm font-medium text-foreground mb-2">Teléfono (opcional)</label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Dirección del negocio (opcional)</label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Calle Mayor 1, Madrid"
                className="input-elegant"
              />
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              />
              <label htmlFor="terms" className="text-sm text-muted-foreground leading-relaxed">
                He leído y acepto los{" "}
                <Link href="/legal/terms" className="underline hover:text-foreground">
                  Términos de uso
                </Link>{" "}
                y la{" "}
                <Link href="/legal/privacy" className="underline hover:text-foreground">
                  Política de privacidad
                </Link>
                .
              </label>
            </div>

            {fieldError && (
              <p className="text-sm text-destructive" role="alert">
                {fieldError}
              </p>
            )}

            <Button
              type="submit"
              disabled={registerBusiness.isPending || !registrationAvailable}
              className="w-full btn-primary"
            >
              {registerBusiness.isPending ? "Creando negocio..." : "Registrar negocio"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
