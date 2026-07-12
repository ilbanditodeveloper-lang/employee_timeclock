import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import AccessPageShell from "@/components/AccessPageShell";

export default function AdminLogin() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const adminLogin = trpc.publicApi.adminLogin.useMutation();
  const trpcUtils = trpc.useUtils();
  const { setAdminSession, setEmployeeSession, isAuthLoading, isAdminAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (isAdminAuthenticated) {
      setLocation('/admin');
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
        throw new Error(t("auth.adminLogin.sessionError"));
      }
      setAdminSession({
        companySlug: result.companySlug,
        displayName: sessionResult.session.displayName ?? username.trim(),
      });
      setEmployeeSession(null);

      toast.success(t("auth.adminLogin.welcome"));
      setLocation('/admin');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.adminLogin.loginError"));
    } finally {
      setLoading(false);
    }
  };

  if (isAuthLoading || isAdminAuthenticated) {
    return null;
  }

  return (
    <AccessPageShell
      backHref="/acceso"
      icon={Lock}
      title={t("auth.adminLogin.title")}
      subtitle={t("auth.adminLogin.subtitle")}
      badge={t("auth.adminLogin.badge")}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.adminLogin.emailOrUsername")}
          </label>
          <Input
            type="text"
            placeholder={t("auth.adminLogin.emailPlaceholder")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.adminLogin.password")}
          </label>
          <Input
            type="password"
            placeholder={t("auth.adminLogin.passwordPlaceholder")}
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
          {loading ? t("auth.adminLogin.submitting") : t("auth.adminLogin.submit")}
        </Button>
      </form>

      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-950">
          <strong>{t("auth.adminLogin.restrictedTitle")}</strong> {t("auth.adminLogin.restrictedBody")}
        </p>
        <p className="text-xs text-amber-900">{t("auth.adminLogin.hint")}</p>
      </div>
    </AccessPageShell>
  );
}
