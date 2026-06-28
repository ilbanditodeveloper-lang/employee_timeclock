import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  SUBSCRIPTION_PLANS,
  SUBSCRIPTION_PLAN_LABELS,
  type SubscriptionPlan,
} from "@shared/subscriptionPlans";

function formatTrialSummary(company: {
  subscriptionPlan: string;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  trialEndsAt: Date | string | null;
}) {
  if (company.subscriptionPlan !== "trial") {
    return "—";
  }
  if (company.trialExpired) {
    return "Trial vencido";
  }
  if (company.trialDaysRemaining != null) {
    return `${company.trialDaysRemaining} día${company.trialDaysRemaining === 1 ? "" : "s"} restantes`;
  }
  if (company.trialEndsAt) {
    return `Hasta ${new Date(company.trialEndsAt).toLocaleDateString("es-ES")}`;
  }
  return "Trial activo";
}

function formatEmployeeUsage(employeeCount: number, planEmployeeLimit: number | null) {
  if (planEmployeeLimit == null) {
    return `${employeeCount} empleados`;
  }
  return `${employeeCount} / ${planEmployeeLimit}`;
}

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const loginMutation = trpc.publicApi.superAdminLogin.useMutation();
  const sessionQuery = trpc.publicApi.getSession.useQuery();
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(
    { username, password },
    { enabled: isAuthed && Boolean(username && password) }
  );
  const createCompany = trpc.publicApi.superAdminCreateCompany.useMutation();
  const setStatus = trpc.publicApi.superAdminSetCompanyStatus.useMutation();
  const setCompanyAdmin = trpc.publicApi.superAdminSetCompanyAdmin.useMutation();
  const setSubscription = trpc.publicApi.superAdminSetCompanySubscription.useMutation();

  useEffect(() => {
    if (sessionQuery.data?.session?.type === "superadmin") {
      setIsAuthed(true);
    }
  }, [sessionQuery.data?.session?.type]);

  useEffect(() => {
    if (isAuthed && sessionQuery.data?.session?.type === "superadmin" && !username) {
      setUsername("owner");
      setPassword("123456");
    }
  }, [isAuthed, sessionQuery.data?.session?.type, username]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      setIsAuthed(true);
      toast.success("Acceso superadmin correcto");
      await listCompanies.refetch();
    } catch {
      toast.error("Credenciales de superadmin inválidas");
    }
  };

  const handleCreateCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName || !companySlug || !adminUsername || !adminPassword) {
      toast.error("Completa todos los campos");
      return;
    }
    try {
      await createCompany.mutateAsync({
        username,
        password,
        companyName,
        companySlug,
        adminUsername,
        adminPassword,
      });
      toast.success("Empresa creada (trial 14 días)");
      setCompanyName("");
      setCompanySlug("");
      setAdminUsername("");
      setAdminPassword("");
      await listCompanies.refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo crear la empresa";
      toast.error(msg);
    }
  };

  const handleToggleCompany = async (companyId: number, nextIsActive: boolean) => {
    try {
      await setStatus.mutateAsync({
        username,
        password,
        companyId,
        isActive: nextIsActive,
      });
      toast.success(nextIsActive ? "Empresa activada" : "Empresa desactivada");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo actualizar la empresa");
    }
  };

  const handleResetAdmin = async (companyId: number) => {
    const newUser = window.prompt("Nuevo usuario admin para la empresa:");
    if (!newUser) return;
    const newPass = window.prompt("Nueva contraseña admin (mínimo 6 caracteres):");
    if (!newPass) return;
    try {
      await setCompanyAdmin.mutateAsync({
        username,
        password,
        companyId,
        adminUsername: newUser,
        adminPassword: newPass,
      });
      toast.success("Admin de empresa actualizado");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo actualizar el admin");
    }
  };

  const handlePlanChange = async (companyId: number, subscriptionPlan: SubscriptionPlan) => {
    try {
      await setSubscription.mutateAsync({
        username,
        password,
        companyId,
        subscriptionPlan,
      });
      toast.success(`Plan actualizado a ${SUBSCRIPTION_PLAN_LABELS[subscriptionPlan]}`);
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo actualizar el plan");
    }
  };

  const handleExtendTrial = async (companyId: number) => {
    const daysRaw = window.prompt("Días de trial adicionales desde hoy (ej. 14):", "14");
    if (!daysRaw) return;
    const days = Number(daysRaw);
    if (!Number.isFinite(days) || days < 1) {
      toast.error("Indica un número válido de días");
      return;
    }
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + days);
    try {
      await setSubscription.mutateAsync({
        username,
        password,
        companyId,
        subscriptionPlan: "trial",
        trialEndsAt: trialEndsAt.toISOString(),
      });
      toast.success(`Trial extendido ${days} días`);
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo extender el trial");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-6xl w-full space-y-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {!isAuthed ? (
          <Card className="p-8 shadow-lg max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-accent rounded-2xl mb-4 shadow-lg">
                <Shield className="w-7 h-7 text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Superadmin</h1>
              <p className="text-sm text-muted-foreground">Control comercial multiempresa</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Usuario</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Contraseña</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-elegant"
                />
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Validando..." : "Entrar"}
              </Button>
            </form>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Crear empresa</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Las empresas nuevas entran en trial de 14 días (5 empleados máx.).
              </p>
              <form onSubmit={handleCreateCompany} className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Nombre empresa"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  placeholder="Slug (ej: cafeteria-sol)"
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  placeholder="Usuario admin empresa"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  type="password"
                  placeholder="Contraseña admin empresa"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input-elegant"
                />
                <Button
                  type="submit"
                  className="md:col-span-2 btn-primary"
                  disabled={createCompany.isPending}
                >
                  {createCompany.isPending ? "Creando..." : "Crear empresa"}
                </Button>
              </form>
            </Card>

            <Card className="p-6 overflow-x-auto">
              <h2 className="text-xl font-bold text-foreground mb-4">Empresas registradas</h2>
              <div className="min-w-[920px] space-y-3">
                <div className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_0.8fr_auto] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>Negocio</span>
                  <span>Empleados</span>
                  <span>Plan</span>
                  <span>Trial</span>
                  <span>Estado</span>
                  <span className="text-right">Acciones</span>
                </div>
                {(listCompanies.data || []).map((company) => (
                  <div
                    key={company.id}
                    className="grid grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_0.8fr_auto] gap-3 items-center border border-border rounded-lg p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {company.slug} · admin: {company.adminUsername || "sin configurar"}
                      </p>
                    </div>
                    <p className="text-sm text-foreground">
                      {formatEmployeeUsage(company.employeeCount, company.planEmployeeLimit)}
                    </p>
                    <Select
                      value={company.subscriptionPlan}
                      onValueChange={(value) =>
                        handlePlanChange(company.id, value as SubscriptionPlan)
                      }
                      disabled={setSubscription.isPending}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SUBSCRIPTION_PLANS.map((plan) => (
                          <SelectItem key={plan} value={plan}>
                            {SUBSCRIPTION_PLAN_LABELS[plan]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p
                      className={`text-sm ${
                        company.trialExpired ? "text-destructive font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatTrialSummary(company)}
                    </p>
                    <p className="text-sm">
                      {company.isActive ? (
                        <span className="text-emerald-600 dark:text-emerald-400">Activa</span>
                      ) : (
                        <span className="text-muted-foreground">Inactiva</span>
                      )}
                    </p>
                    <div className="flex flex-wrap justify-end gap-2">
                      {company.subscriptionPlan === "trial" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleExtendTrial(company.id)}
                          disabled={setSubscription.isPending}
                        >
                          + Trial
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant={company.isActive ? "destructive" : "outline"}
                        size="sm"
                        onClick={() => handleToggleCompany(company.id, !company.isActive)}
                        disabled={setStatus.isPending}
                      >
                        {company.isActive ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetAdmin(company.id)}
                        disabled={setCompanyAdmin.isPending}
                      >
                        Admin
                      </Button>
                    </div>
                  </div>
                ))}
                {listCompanies.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay empresas todavía.</p>
                ) : null}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
