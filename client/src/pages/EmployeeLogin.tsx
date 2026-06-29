import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Clock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';

export default function EmployeeLogin() {
  const [, setLocation] = useLocation();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const employeeLogin = trpc.publicApi.employeeLogin.useMutation();
  const { setEmployeeSession, setAdminSession } = useAuthContext();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const trimmed = loginId.trim();
      const username = trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
      const result = await employeeLogin.mutateAsync({ username, password });
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full">
        <button
          onClick={() => setLocation('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <Card className="p-8 shadow-lg">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-accent rounded-2xl mb-4 shadow-lg">
              <Clock className="w-7 h-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Empleado</h1>
            <p className="text-sm text-muted-foreground">Inicia sesión para fichar</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email o usuario
              </label>
              <Input
                type="text"
                placeholder="email@empresa.com"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                required
                className="input-elegant"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Contraseña
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input-elegant"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full btn-primary"
            >
              {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Usa el <strong>email</strong> que te dio tu administrador (recomendado) o tu nombre de usuario, más la contraseña.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
