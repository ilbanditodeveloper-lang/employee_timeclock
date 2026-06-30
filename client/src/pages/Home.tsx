import { useAuthContext } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Clock, Users, AlertCircle, Sparkles, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const featureItems = [
  {
    icon: Clock,
    title: "Fichaje inteligente",
    text: "Validación por ubicación (opcional por empresa)",
  },
  {
    icon: Users,
    title: "Gestión completa",
    text: "Panel de administrador avanzado",
  },
  {
    icon: AlertCircle,
    title: "Incidencias",
    text: "Registro de retrasos y eventos",
  },
];

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

  const handleDemo = async (role: "admin" | "employee") => {
    try {
      const result = await enterDemo.mutateAsync({ role });
      if (role === "admin") {
        setAdminSession({ companySlug: "demo", displayName: "Admin Demo" });
        setEmployeeSession(null);
        setLocation("/admin");
      } else {
        setEmployeeSession({
          username: "demo::ana",
          employeeId: result.employeeId ?? 1,
          companySlug: "demo",
          displayName: "Ana García",
          schedule: result.schedule,
          lateGraceMinutes: result.lateGraceMinutes,
          locationEnabled: result.locationEnabled,
          needsPrivacyNotice: result.needsPrivacyNotice,
          timezone: result.timezone ?? "Europe/Madrid",
        });
        setAdminSession(null);
        setLocation("/employee");
      }
      toast.success("Modo demo activado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo entrar en demo");
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-blue-100/40">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
          <p className="text-slate-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (adminSession || employeeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-blue-100/40">
        <p className="text-slate-500">Redirigiendo...</p>
      </div>
    );
  }

  const demoMode = configQuery.data?.demoMode ?? false;

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50/60 to-blue-100/50 px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-200/30 via-transparent to-transparent"
        aria-hidden
      />

      <div className="relative mx-auto w-full max-w-md">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-blue-800"
        >
          <ArrowLeft className="size-4" />
          Volver al inicio
        </Link>

        <div className="overflow-hidden rounded-2xl border-2 border-blue-600 bg-white shadow-2xl shadow-blue-900/15 ring-4 ring-blue-600/10">
          <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 px-6 py-8 text-center text-white">
            <div className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
              <Clock className="size-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">TimeClock</h1>
            <p className="mt-2 text-blue-100/90">Sistema de fichaje de empleados</p>
            <p className="mt-4 inline-block rounded-full bg-blue-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">
              Acceso seguro
            </p>
          </div>

          <div className="space-y-5 p-6 sm:p-8">
            <div className="space-y-3">
              {featureItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white">
                      <Icon className="size-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-600">{item.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {demoMode ? (
              <div className="space-y-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-violet-900">
                  <Sparkles className="size-4" />
                  Modo demo (sin Supabase)
                </div>
                <p className="text-sm text-violet-800">
                  Prueba la app con datos de ejemplo. Los cambios no se guardan en base de datos.
                </p>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="w-full bg-blue-700 hover:bg-blue-800"
                    disabled={enterDemo.isPending}
                    onClick={() => handleDemo("employee")}
                  >
                    Demo empleado (Ana García)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-blue-200 text-blue-900 hover:bg-blue-50"
                    disabled={enterDemo.isPending}
                    onClick={() => handleDemo("admin")}
                  >
                    Demo administrador
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 pt-1">
              <Button
                onClick={() => setLocation("/employee-login")}
                className="h-11 w-full bg-blue-700 text-base hover:bg-blue-800"
              >
                Acceso empleado
              </Button>
              <Button
                onClick={() => setLocation("/admin-login")}
                variant="outline"
                className={cn(
                  "h-11 w-full border-2 border-blue-600 text-base text-blue-900",
                  "hover:bg-blue-50"
                )}
              >
                Acceso administrador
              </Button>
            </div>

            <div className="border-t border-blue-100 pt-5 text-center">
              <p className="text-sm text-slate-600">¿Tienes un negocio?</p>
              <Button
                onClick={() => setLocation("/register-business")}
                variant="ghost"
                className="mt-2 w-full text-base text-blue-800 hover:bg-blue-50 hover:text-blue-900"
              >
                Registrar mi negocio
              </Button>
            </div>

            <div className="space-y-2 border-t border-blue-100 pt-5 text-center text-xs text-slate-500">
              <p>© {new Date().getFullYear()} TimeClock. Todos los derechos reservados.</p>
              <p className="flex justify-center gap-3">
                <Link href="/legal/privacy" className="hover:text-blue-800 hover:underline">
                  Privacidad
                </Link>
                <Link href="/legal/terms" className="hover:text-blue-800 hover:underline">
                  Términos
                </Link>
                <Link href="/legal/dpa" className="hover:text-blue-800 hover:underline">
                  DPA
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
