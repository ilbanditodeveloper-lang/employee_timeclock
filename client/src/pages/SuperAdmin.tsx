import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  const loginMutation = trpc.publicApi.superAdminLogin.useMutation();
  const sessionQuery = trpc.publicApi.getSession.useQuery();
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(
    { username, password },
    { enabled: isAuthed && Boolean(username && password) }
  );
  const setStatus = trpc.publicApi.superAdminSetCompanyStatus.useMutation();

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

  const handleDeactivate = async (companyId: number, companyName: string) => {
    if (!window.confirm(`¿Dar de baja a "${companyName}"? Los usuarios no podrán acceder.`)) {
      return;
    }
    try {
      await setStatus.mutateAsync({
        username,
        password,
        companyId,
        isActive: false,
      });
      toast.success("Empresa dada de baja");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo dar de baja la empresa");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-3xl w-full space-y-6">
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
          <Card className="p-6">
            <h2 className="text-xl font-bold text-foreground mb-2">Empresas registradas</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Las empresas se dan de baja solas si superan el límite de empleados o vence el trial.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-[1.5fr_0.7fr_1fr_0.9fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Empresa</span>
                <span>Empleados</span>
                <span>Suscripción</span>
                <span className="text-right">Acción</span>
              </div>
              {(listCompanies.data || []).map((company) => (
                <div
                  key={company.id}
                  className="grid grid-cols-[1.5fr_0.7fr_1fr_0.9fr] gap-3 items-center border border-border rounded-lg p-3"
                >
                  <p className="font-semibold text-foreground">{company.name}</p>
                  <p className="text-sm text-foreground">{company.employeeCount}</p>
                  <p className="text-sm text-foreground">{company.planLabel}</p>
                  <div className="text-right">
                    {company.isActive ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDeactivate(company.id, company.name)}
                        disabled={setStatus.isPending}
                      >
                        Dar de baja
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Dada de baja</span>
                    )}
                  </div>
                </div>
              ))}
              {listCompanies.data?.length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay empresas todavía.</p>
              ) : null}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
