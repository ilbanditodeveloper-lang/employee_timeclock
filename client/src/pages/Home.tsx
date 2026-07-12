import { useMemo } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Link, useLocation } from "wouter";
import { Clock, Users, AlertCircle, Sparkles, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

export default function Home() {
  const { t } = useLocale();
  const { adminSession, employeeSession, isAuthLoading, setAdminSession, setEmployeeSession } =
    useAuthContext();
  const [, setLocation] = useLocation();
  const configQuery = trpc.publicApi.getAppConfig.useQuery();
  const enterDemo = trpc.publicApi.enterDemo.useMutation();

  const featureItems = useMemo(
    () => [
      {
        icon: Clock,
        title: t("auth.home.features.smartClock.title"),
        text: t("auth.home.features.smartClock.text"),
      },
      {
        icon: Users,
        title: t("auth.home.features.fullManagement.title"),
        text: t("auth.home.features.fullManagement.text"),
      },
      {
        icon: AlertCircle,
        title: t("auth.home.features.incidents.title"),
        text: t("auth.home.features.incidents.text"),
      },
    ],
    [t]
  );

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
      toast.success(t("auth.home.demo.activated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("auth.home.demo.failed"));
    }
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-blue-100/40">
        <div className="text-center">
          <div className="mx-auto mb-4 size-12 animate-spin rounded-full border-2 border-blue-200 border-t-blue-700" />
          <p className="text-slate-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (adminSession || employeeSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50/50 to-blue-100/40">
        <p className="text-slate-500">{t("common.redirecting")}</p>
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
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-blue-800"
          >
            <ArrowLeft className="size-4" />
            {t("auth.home.backToHome")}
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-blue-500/25 via-blue-600/15 to-blue-900/30 blur-xl"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(30,64,175,0.35)]">
            <div className="h-1.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-900" />
            <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 px-6 py-8 text-center text-white">
              <div className="mx-auto mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm">
                <Clock className="size-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">TimeClock</h1>
              <p className="mt-2 text-blue-100/90">{t("auth.home.subtitle")}</p>
              <p className="mt-4 inline-block rounded-full bg-blue-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">
                {t("auth.home.secureAccess")}
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
                  {t("auth.home.demo.title")}
                </div>
                <p className="text-sm text-violet-800">{t("auth.home.demo.description")}</p>
                <div className="grid gap-2">
                  <Button
                    type="button"
                    className="w-full bg-blue-700 hover:bg-blue-800"
                    disabled={enterDemo.isPending}
                    onClick={() => handleDemo("employee")}
                  >
                    {t("auth.home.demo.employeeButton")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-blue-200 text-blue-900 hover:bg-blue-50"
                    disabled={enterDemo.isPending}
                    onClick={() => handleDemo("admin")}
                  >
                    {t("auth.home.demo.adminButton")}
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="space-y-3 pt-1">
              <Button
                onClick={() => setLocation("/employee-login")}
                className="h-11 w-full bg-blue-700 text-base hover:bg-blue-800"
              >
                {t("auth.home.employeeAccess")}
              </Button>
              <Button
                onClick={() => setLocation("/admin-login")}
                variant="outline"
                className={cn(
                  "h-11 w-full border border-blue-300 text-base text-blue-900",
                  "hover:bg-blue-50"
                )}
              >
                {t("auth.home.adminAccess")}
              </Button>
            </div>

            <div className="border-t border-blue-100 pt-5 text-center">
              <p className="text-sm text-slate-600">{t("auth.home.hasBusiness")}</p>
              <Button
                onClick={() => setLocation("/register-business")}
                variant="ghost"
                className="mt-2 w-full text-base text-blue-800 hover:bg-blue-50 hover:text-blue-900"
              >
                {t("auth.home.registerBusiness")}
              </Button>
            </div>

            <div className="space-y-2 border-t border-blue-100 pt-5 text-center text-xs text-slate-500">
              <p>{t("auth.home.copyright", { year: String(new Date().getFullYear()) })}</p>
              <p className="flex justify-center gap-3">
                <Link href="/legal/privacy" className="hover:text-blue-800 hover:underline">
                  {t("auth.home.privacy")}
                </Link>
                <Link href="/legal/terms" className="hover:text-blue-800 hover:underline">
                  {t("auth.home.terms")}
                </Link>
                <Link href="/legal/dpa" className="hover:text-blue-800 hover:underline">
                  {t("auth.home.dpa")}
                </Link>
              </p>
            </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
