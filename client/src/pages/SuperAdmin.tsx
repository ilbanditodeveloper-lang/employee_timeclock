import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [adminUsername, setAdminUsername] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const loginMutation = trpc.publicApi.superAdminLogin.useMutation();
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(
    { username, password },
    { enabled: isAuthed }
  );
  const createCompany = trpc.publicApi.superAdminCreateCompany.useMutation();
  const setStatus = trpc.publicApi.superAdminSetCompanyStatus.useMutation();
  const setCompanyAdmin = trpc.publicApi.superAdminSetCompanyAdmin.useMutation();

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      setIsAuthed(true);
      toast.success("Acceso superadmin correcto");
      await listCompanies.refetch();
    } catch {
      toast.error("Credenciales de superadmin inválidas");
    }
  };

  const handleCreateCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!companyName || !companySlug || !adminUsername || !adminPassword) {
      toast.error("Completa todos los campos");
      return;
    }
    try {
      await createCompany.mutateAsync({
        username,
        password,
        companyName,
        companySlug,
        adminUsername,
        adminPassword,
      });
      toast.success("Empresa creada");
      setCompanyName("");
      setCompanySlug("");
      setAdminUsername("");
      setAdminPassword("");
      await listCompanies.refetch();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No se pudo crear la empresa";
      toast.error(msg);
    }
  };

  const handleToggleCompany = async (companyId: number, nextIsActive: boolean) => {
    try {
      await setStatus.mutateAsync({
        username,
        password,
        companyId,
        isActive: nextIsActive,
      });
      toast.success(nextIsActive ? "Empresa activada" : "Empresa desactivada");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo actualizar la empresa");
    }
  };

  const handleResetAdmin = async (companyId: number) => {
    const newUser = window.prompt("Nuevo usuario admin para la empresa:");
    if (!newUser) return;
    const newPass = window.prompt("Nueva contraseña admin (mínimo 6 caracteres):");
    if (!newPass) return;
    try {
      await setCompanyAdmin.mutateAsync({
        username,
        password,
        companyId,
        adminUsername: newUser,
        adminPassword: newPass,
      });
      toast.success("Admin de empresa actualizado");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo actualizar el admin");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-4xl w-full space-y-6">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        {!isAuthed ? (
          <Card className="p-8 shadow-lg max-w-md mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-accent rounded-2xl mb-4 shadow-lg">
                <Shield className="w-7 h-7 text-accent-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">Superadmin</h1>
              <p className="text-sm text-muted-foreground">Control comercial multiempresa</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Usuario</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">Contraseña</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-elegant"
                />
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Validando..." : "Entrar"}
              </Button>
            </form>
          </Card>
        ) : (
          <>
            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Crear empresa</h2>
              <form onSubmit={handleCreateCompany} className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="Nombre empresa"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  placeholder="Slug (ej: cafeteria-sol)"
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  placeholder="Usuario admin empresa"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  className="input-elegant"
                />
                <Input
                  type="password"
                  placeholder="Contraseña admin empresa"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="input-elegant"
                />
                <Button
                  type="submit"
                  className="md:col-span-2 btn-primary"
                  disabled={createCompany.isPending}
                >
                  {createCompany.isPending ? "Creando..." : "Crear empresa"}
                </Button>
              </form>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-foreground mb-4">Empresas registradas</h2>
              <div className="space-y-3">
                {(listCompanies.data || []).map((company) => (
                  <div
                    key={company.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-lg p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{company.name}</p>
                      <p className="text-sm text-muted-foreground">
                        slug: {company.slug} · admin: {company.adminUsername || "sin configurar"}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={company.isActive ? "destructive" : "outline"}
                        onClick={() => handleToggleCompany(company.id, !company.isActive)}
                        disabled={setStatus.isPending}
                      >
                        {company.isActive ? "Desactivar" : "Activar"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleResetAdmin(company.id)}
                        disabled={setCompanyAdmin.isPending}
                      >
                        Configurar admin
                      </Button>
                    </div>
                  </div>
                ))}
                {listCompanies.data?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No hay empresas todavía.</p>
                ) : null}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
