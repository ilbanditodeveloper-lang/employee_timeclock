import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import AccessPageShell from '@/components/AccessPageShell';

export default function EmployeeLogin() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const employeeLogin = trpc.publicApi.employeeLogin.useMutation();
  const trpcUtils = trpc.useUtils();
  const { setEmployeeSession, setAdminSession, isAuthLoading, isEmployeeAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (isEmployeeAuthenticated) {
      setLocation('/employee');
    }
  }, [isAuthLoading, isEmployeeAuthenticated, setLocation]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmed = loginId.trim();
      const username = trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
      const result = await employeeLogin.mutateAsync({ username, password });
      await trpcUtils.publicApi.getSession.invalidate();
      const sessionResult = await trpcUtils.publicApi.getSession.fetch();
      if (sessionResult.session?.type !== "employee") {
        throw new Error(t("auth.employeeLogin.sessionError"));
      }
      setEmployeeSession({
        username,
        employeeId: result.employeeId,
        companySlug: result.companySlug ?? 'default',
        displayName: trimmed,
        schedule: result.schedule,
        lateGraceMinutes: result.lateGraceMinutes,
        locationEnabled: result.locationEnabled,
        needsPrivacyNotice: result.needsPrivacyNotice,
        timezone: result.timezone,
      });
      setAdminSession(null);

      toast.success(t("auth.employeeLogin.welcome"));
      setLocation('/employee');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.employeeLogin.loginError"));
    } finally {
      setLoading(false);
    }
  };

  if (isAuthLoading || isEmployeeAuthenticated) {
    return null;
  }

  return (
    <AccessPageShell
      backHref="/acceso"
      icon={Clock}
      title={t("auth.employeeLogin.title")}
      subtitle={t("auth.employeeLogin.subtitle")}
      badge={t("auth.employeeLogin.badge")}
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.employeeLogin.emailOrUsername")}
          </label>
          <Input
            type="text"
            placeholder={t("auth.employeeLogin.emailPlaceholder")}
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.employeeLogin.password")}
          </label>
          <Input
            type="password"
            placeholder={t("auth.employeeLogin.passwordPlaceholder")}
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
          {loading ? t("auth.employeeLogin.submitting") : t("auth.employeeLogin.submit")}
        </Button>
      </form>

      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4">
        <p className="text-sm text-blue-900">{t("auth.employeeLogin.hint")}</p>
      </div>
    </AccessPageShell>
  );
}
