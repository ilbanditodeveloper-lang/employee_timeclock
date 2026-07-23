import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import AccessPageShell from "@/components/AccessPageShell";

export default function MultiClockLogin() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const adminLogin = trpc.publicApi.adminLogin.useMutation();
  const trpcUtils = trpc.useUtils();
  const { setAdminSession, setEmployeeSession, isAuthLoading, isAdminAuthenticated } =
    useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdminAuthenticated) {
      setLocation("/multifichaje/panel");
    }
  }, [isAuthLoading, isAdminAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loginId = username.trim().includes("@")
        ? username.trim().toLowerCase()
        : username.trim();
      const result = await adminLogin.mutateAsync({ username: loginId, password });
      await trpcUtils.publicApi.getSession.invalidate();
      const sessionResult = await trpcUtils.publicApi.getSession.fetch();
      if (sessionResult.session?.type !== "admin") {
        throw new Error(t("auth.multiClockLogin.sessionError"));
      }
      setAdminSession({
        companySlug: result.companySlug,
        displayName: sessionResult.session.displayName ?? username.trim(),
      });
      setEmployeeSession(null);

      toast.success(t("auth.multiClockLogin.welcome"));
      setLocation("/multifichaje/panel");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.multiClockLogin.loginError"));
    } finally {
      setLoading(false);
    }
  };

  if (isAdminAuthenticated) {
    return null;
  }

  return (
    <AccessPageShell
      backHref="/acceso"
      icon={Building2}
      title={t("auth.multiClockLogin.title")}
      subtitle={t("auth.multiClockLogin.subtitle")}
      badge={t("auth.multiClockLogin.badge")}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.multiClockLogin.emailOrUsername")}
          </label>
          <Input
            type="text"
            placeholder={t("auth.multiClockLogin.emailPlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.multiClockLogin.password")}
          </label>
          <Input
            type="password"
            placeholder={t("auth.multiClockLogin.passwordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
          />
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full bg-blue-700 text-base hover:bg-blue-800"
        >
          {loading ? t("auth.multiClockLogin.submitting") : t("auth.multiClockLogin.submit")}
        </Button>
      </form>

      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4">
        <p className="text-sm text-blue-900">{t("auth.multiClockLogin.hint")}</p>
      </div>
    </AccessPageShell>
  );
}
