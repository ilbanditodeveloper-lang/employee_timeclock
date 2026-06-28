import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Clock, Users, AlertCircle, Sparkles } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect } from "react";

export default function Home() {
  const { adminSession, employeeSession, isAuthLoading, setAdminSession, setEmployeeSession } =
    useAuthContext();
  const [, setLocation] = useLocation();
  const configQuery = trpc.publicApi.getAppConfig.useQuery();
  const enterDemo = trpc.publicApi.enterDemo.useMutation();

  useEffect(() => {
    if (isAuthLoading) return;
    if (adminSession) setLocation("/admin");
    else if (employeeSession) setLocation("/employee");
  }, [adminSession, employeeSession, isAuthLoading, setLocation]);

  const handleDemo = async (role: "admin" | "employee" | "superadmin") => {
    try {
      const result = await enterDemo.mutateAsync({ role });
      if (role === "admin") {
        setAdminSession({ companySlug: "demo", displayName: "Admin Demo" });
        setEmployeeSession(null);
        setLocation("/admin");
      } else if (role === "employee") {
        setEmployeeSession({
          username: "demo::ana",
          employeeId: result.employeeId ?? 1,
          companySlug: "demo",
          displayName: "Ana García",
          schedule: result.schedule,
          lateGraceMinutes: result.lateGraceMinutes,
          locationEnabled: result.locationEnabled,
          needsPrivacyNotice: result.needsPrivacyNotice,
        });
        setAdminSession(null);
        setLocation("/employee");
      } else {
        setAdminSession(null);
        setEmployeeSession(null);
        setLocation("/superadmin");
      }
      toast.success("Modo demo activado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo entrar en demo");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto mb-4"></div>
          <p className="text-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (adminSession || employeeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <p className="text-muted-foreground">Redirigiendo...</p>
      </div>
    );
  }

  const demoMode = configQuery.data?.demoMode ?? false;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-accent rounded-2xl mb-6 shadow-lg">
            <Clock className="w-8 h-8 text-accent-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">TimeClock</h1>
          <p className="text-muted-foreground text-lg">Sistema de Fichaje de Empleados</p>
        </div>

        <div className="space-y-4 mb-12">
          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <Clock className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Fichaje Inteligente</h3>
              <p className="text-sm text-muted-foreground">Validación por ubicación (opcional por empresa)</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <Users className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Gestión Completa</h3>
              <p className="text-sm text-muted-foreground">Panel de administrador avanzado</p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 bg-card rounded-lg border border-border">
            <AlertCircle className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground">Incidencias</h3>
              <p className="text-sm text-muted-foreground">Registro de retrasos y eventos</p>
            </div>
          </div>
        </div>

        {demoMode && (
          <div className="mb-6 p-4 rounded-lg border border-violet-200 bg-violet-50 dark:bg-violet-950/30 dark:border-violet-800 space-y-3">
            <div className="flex items-center gap-2 text-violet-900 dark:text-violet-200 font-semibold">
              <Sparkles className="w-4 h-4" />
              Modo demo (sin Supabase)
            </div>
            <p className="text-sm text-violet-800 dark:text-violet-300">
              Prueba la app con datos de ejemplo. Los cambios no se guardan en base de datos.
            </p>
            <div className="grid gap-2">
              <Button
                type="button"
                className="w-full"
                disabled={enterDemo.isPending}
                onClick={() => handleDemo("employee")}
              >
                Demo empleado (Ana García)
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={enterDemo.isPending}
                onClick={() => handleDemo("admin")}
              >
                Demo administrador
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={enterDemo.isPending}
                onClick={() => handleDemo("superadmin")}
              >
                Demo superadmin
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button onClick={() => setLocation("/employee-login")} className="w-full btn-primary text-base">
            Acceso Empleado
          </Button>
          <Button onClick={() => setLocation("/admin-login")} variant="outline" className="w-full text-base">
            Acceso Administrador
          </Button>
          <Button onClick={() => setLocation("/superadmin")} variant="ghost" className="w-full text-base">
            Acceso Superadmin
          </Button>
        </div>

        <div className="mt-6 pt-6 border-t border-border text-center space-y-3">
          <p className="text-sm text-muted-foreground">¿Tienes un negocio?</p>
          <Button
            onClick={() => setLocation("/register-business")}
            variant="secondary"
            className="w-full text-base"
          >
            Registrar mi negocio
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground mt-8 space-y-2">
          <p>© {new Date().getFullYear()} TimeClock. Todos los derechos reservados.</p>
          <p className="flex justify-center gap-3">
            <Link href="/legal/privacy" className="underline hover:text-foreground">
              Privacidad
            </Link>
            <Link href="/legal/terms" className="underline hover:text-foreground">
              Términos
            </Link>
            <Link href="/legal/dpa" className="underline hover:text-foreground">
              DPA
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
