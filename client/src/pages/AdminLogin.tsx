import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Lock, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const adminLogin = trpc.publicApi.adminLogin.useMutation();
  const { setAdminSession, setEmployeeSession } = useAuthContext();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const loginId = username.trim().includes("@")
        ? username.trim().toLowerCase()
        : username.trim();
      const result = await adminLogin.mutateAsync({ username: loginId, password });
      setAdminSession({
        companySlug: result.companySlug,
        displayName: username.trim(),
      });
      setEmployeeSession(null);
      
      toast.success('¡Bienvenido Administrador!');
      setLocation('/admin');
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
              <Lock className="w-7 h-7 text-accent-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Acceso Administrador</h1>
            <p className="text-sm text-muted-foreground">Panel de gestión</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Email o usuario
              </label>
              <Input
                type="text"
                placeholder="email@empresa.com o tu.usuario"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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

          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 space-y-2">
            <p className="text-sm text-yellow-900 dark:text-yellow-200">
              <strong>Acceso restringido:</strong> Solo administradores autorizados.
            </p>
            <p className="text-xs text-yellow-800 dark:text-yellow-300">
              Entra con tu <strong>email</strong> y contraseña (recomendado). También puedes usar tu nombre de usuario.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
