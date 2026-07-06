import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';
import AccessPageShell from '@/components/AccessPageShell';

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const adminLogin = trpc.publicApi.adminLogin.useMutation();
  const trpcUtils = trpc.useUtils();
  const { setAdminSession, setEmployeeSession } = useAuthContext();

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
        throw new Error("No se pudo establecer la sesión. Prueba de nuevo.");
      }
      setAdminSession({
        companySlug: result.companySlug,
        displayName: sessionResult.session.displayName ?? username.trim(),
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
    <AccessPageShell
      backHref="/acceso"
      icon={Lock}
      title="Acceso administrador"
      subtitle="Panel de gestión"
      badge="Admin"
    >
      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">Email o usuario</label>
          <Input
            type="text"
            placeholder="email@empresa.com o tu.usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
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

      <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-950">
          <strong>Acceso restringido:</strong> Solo administradores autorizados.
        </p>
        <p className="text-xs text-amber-900">
          Entra con tu <strong>email</strong> y contraseña (recomendado). También puedes usar tu nombre de
          usuario.
        </p>
      </div>
    </AccessPageShell>
  );
}
