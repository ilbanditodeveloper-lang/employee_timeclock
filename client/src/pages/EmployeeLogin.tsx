import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Clock } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';
import AccessPageShell from '@/components/AccessPageShell';

export default function EmployeeLogin() {
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
        throw new Error("No se pudo establecer la sesión. Prueba de nuevo.");
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

      toast.success('¡Bienvenido!');
      setLocation('/employee');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al iniciar sesión');
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
      title="Acceso empleado"
      subtitle="Inicia sesión para fichar"
      badge="Empleado"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Email o usuario</label>
          <Input
            type="text"
            placeholder="email@empresa.com"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Contraseña</label>
          <Input
            type="password"
            placeholder="••••••••"
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
          {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
        </Button>
      </form>

      <div className="rounded-xl border border-blue-100 bg-blue-50/80 p-4">
        <p className="text-sm text-blue-900">
          Usa el <strong>email</strong> que te dio tu administrador (recomendado) o tu nombre de usuario,
          más la contraseña.
        </p>
      </div>
    </AccessPageShell>
  );
}
