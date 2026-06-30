import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft, Building2, Globe } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import {
  DEFAULT_LANDING_PAGE_CONFIG,
  type LandingPageConfig,
  type LandingPricingPack,
  type LandingAudience,
} from "@shared/landingConfig";
import { cn } from "@/lib/utils";

type SuperAdminTab = "companies" | "landing";

function packFeaturesToText(features: string[]) {
  return features.join("\n");
}

function textToFeatures(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function SuperAdmin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useState<SuperAdminTab>("companies");
  const [landingDraft, setLandingDraft] = useState<LandingPageConfig>(DEFAULT_LANDING_PAGE_CONFIG);

  const loginMutation = trpc.publicApi.superAdminLogin.useMutation();
  const sessionQuery = trpc.publicApi.getSession.useQuery();
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(emptyCreds, {
    enabled: isAuthed,
  });
  const setStatus = trpc.publicApi.superAdminSetCompanyStatus.useMutation();
  const landingQuery = trpc.publicApi.superAdminGetLandingSettings.useQuery(emptyCreds, {
    enabled: isAuthed,
  });
  const saveLanding = trpc.publicApi.superAdminUpdateLandingSettings.useMutation();

  useEffect(() => {
    if (sessionQuery.data?.session?.type === "superadmin") {
      setIsAuthed(true);
    }
  }, [sessionQuery.data?.session?.type]);

  useEffect(() => {
    if (landingQuery.data) {
      setLandingDraft(landingQuery.data);
    }
  }, [landingQuery.data]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      setIsAuthed(true);
      toast.success("Acceso superadmin correcto");
      void listCompanies.refetch();
      void landingQuery.refetch();
    } catch {
      toast.error("Credenciales de superadmin inválidas");
    }
  };

  const handleDeactivate = async (companyId: number, companyName: string) => {
    if (!window.confirm(`¿Dar de baja a "${companyName}"? Los usuarios no podrán acceder.`)) {
      return;
    }
    try {
      await setStatus.mutateAsync({
        ...emptyCreds,
        companyId,
        isActive: false,
      });
      toast.success("Empresa dada de baja");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo dar de baja la empresa");
    }
  };

  const updatePack = (index: number, patch: Partial<LandingPricingPack>) => {
    setLandingDraft((prev) => {
      const packs = [...prev.pricingPacks] as [LandingPricingPack, LandingPricingPack, LandingPricingPack];
      packs[index] = { ...packs[index], ...patch };
      return { ...prev, pricingPacks: packs };
    });
  };

  const updateAudience = (index: number, patch: Partial<LandingAudience>) => {
    setLandingDraft((prev) => {
      const items = [...prev.audienceImages] as [
        LandingAudience,
        LandingAudience,
        LandingAudience,
        LandingAudience,
        LandingAudience,
        LandingAudience,
      ];
      items[index] = { ...items[index], ...patch };
      return { ...prev, audienceImages: items };
    });
  };

  const handleSaveLanding = async () => {
    try {
      const packs = landingDraft.pricingPacks.map((pack) => ({
        ...pack,
        features: pack.features.filter(Boolean),
      }));
      if (packs.some((p) => p.features.length === 0)) {
        toast.error("Cada plan debe tener al menos una característica");
        return;
      }
      await saveLanding.mutateAsync({
        ...emptyCreds,
        config: { ...landingDraft, pricingPacks: packs as LandingPageConfig["pricingPacks"] },
      });
      toast.success("Ajustes de la web guardados");
      void landingQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los ajustes");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-5xl mx-auto space-y-6">
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
                <Label htmlFor="sa-user">Usuario</Label>
                <Input
                  id="sa-user"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="input-elegant mt-1"
                />
              </div>
              <div>
                <Label htmlFor="sa-pass">Contraseña</Label>
                <Input
                  id="sa-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="input-elegant mt-1"
                />
              </div>
              <Button type="submit" className="w-full btn-primary" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "Validando..." : "Entrar"}
              </Button>
            </form>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant={activeTab === "companies" ? "default" : "outline"}
                onClick={() => setActiveTab("companies")}
                className="gap-2"
              >
                <Building2 className="size-4" />
                Empresas
              </Button>
              <Button
                type="button"
                variant={activeTab === "landing" ? "default" : "outline"}
                onClick={() => setActiveTab("landing")}
                className="gap-2"
              >
                <Globe className="size-4" />
                Web / Landing
              </Button>
            </div>

            {activeTab === "companies" ? (
              <Card className="p-6">
                <h2 className="text-xl font-bold text-foreground mb-2">Empresas registradas</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Las empresas se dan de baja solas si superan el límite de empleados o vence el trial.
                </p>
                <div className="space-y-3">
                  <div className="grid grid-cols-[1.5fr_0.7fr_1fr_0.9fr] gap-3 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <span>Empresa</span>
                    <span>Empleados</span>
                    <span>Suscripción</span>
                    <span className="text-right">Acción</span>
                  </div>
                  {(listCompanies.data || []).map((company) => (
                    <div
                      key={company.id}
                      className="grid grid-cols-[1.5fr_0.7fr_1fr_0.9fr] gap-3 items-center border border-border rounded-lg p-3"
                    >
                      <p className="font-semibold text-foreground">{company.name}</p>
                      <p className="text-sm text-foreground">{company.employeeCount}</p>
                      <p className="text-sm text-foreground">{company.planLabel}</p>
                      <div className="text-right">
                        {company.isActive ? (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeactivate(company.id, company.name)}
                            disabled={setStatus.isPending}
                          >
                            Dar de baja
                          </Button>
                        ) : (
                          <span className="text-sm text-muted-foreground">Dada de baja</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {listCompanies.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay empresas todavía.</p>
                  ) : null}
                </div>
              </Card>
            ) : (
              <Card className="p-6 space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-1">Ajustes de la landing page</h2>
                  <p className="text-sm text-muted-foreground">
                    Los cambios se aplican al instante en la página principal (/). No hace falta redeploy.
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wa-number">WhatsApp (solo números, con prefijo país)</Label>
                    <Input
                      id="wa-number"
                      placeholder="34600111222"
                      value={landingDraft.whatsappNumber}
                      onChange={(e) =>
                        setLandingDraft((p) => ({ ...p, whatsappNumber: e.target.value }))
                      }
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Ejemplo España: 34 + 9 dígitos. Si está vacío, los botones llevan al registro.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="trial-days">Días de prueba</Label>
                    <Input
                      id="trial-days"
                      type="number"
                      min={0}
                      value={landingDraft.trialDays}
                      onChange={(e) =>
                        setLandingDraft((p) => ({
                          ...p,
                          trialDays: Number(e.target.value) || 0,
                        }))
                      }
                      className="mt-1"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Label htmlFor="trial-headline">Texto destacado de prueba</Label>
                    <Input
                      id="trial-headline"
                      value={landingDraft.trialHeadline}
                      onChange={(e) =>
                        setLandingDraft((p) => ({ ...p, trialHeadline: e.target.value }))
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">Planes de precios (3 packs)</h3>
                  <div className="grid gap-6 lg:grid-cols-3">
                    {landingDraft.pricingPacks.map((pack, index) => (
                      <div
                        key={pack.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3",
                          pack.highlighted ? "border-emerald-500 bg-emerald-50/50" : "border-border"
                        )}
                      >
                        <p className="text-sm font-semibold text-muted-foreground">Plan {index + 1}</p>
                        <div>
                          <Label>Nombre</Label>
                          <Input
                            value={pack.name}
                            onChange={(e) => updatePack(index, { name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Precio</Label>
                            <Input
                              value={pack.price}
                              onChange={(e) => updatePack(index, { price: e.target.value })}
                              className="mt-1"
                              placeholder="29€"
                            />
                          </div>
                          <div>
                            <Label>Sufijo</Label>
                            <Input
                              value={pack.priceSuffix}
                              onChange={(e) => updatePack(index, { priceSuffix: e.target.value })}
                              className="mt-1"
                              placeholder="/mes"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Descripción corta</Label>
                          <Input
                            value={pack.description}
                            onChange={(e) => updatePack(index, { description: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Características (una por línea)</Label>
                          <Textarea
                            value={packFeaturesToText(pack.features)}
                            onChange={(e) =>
                              updatePack(index, { features: textToFeatures(e.target.value) })
                            }
                            className="mt-1 min-h-[120px]"
                          />
                        </div>
                        <div>
                          <Label>Texto del botón</Label>
                          <Input
                            value={pack.ctaLabel}
                            onChange={(e) => updatePack(index, { ctaLabel: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={Boolean(pack.highlighted)}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setLandingDraft((prev) => ({
                                ...prev,
                                pricingPacks: prev.pricingPacks.map((p, i) => ({
                                  ...p,
                                  highlighted: i === index ? checked : false,
                                })) as LandingPageConfig["pricingPacks"],
                              }));
                            }}
                          />
                          Destacar como plan popular
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    Fotos «Para quién es» (6 sectores)
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {landingDraft.audienceImages.map((item, index) => (
                      <div key={item.id} className="rounded-xl border border-border p-4 space-y-3">
                        <div
                          className="h-28 rounded-lg bg-cover bg-center border border-border"
                          style={{ backgroundImage: `url(${item.imageUrl})` }}
                        />
                        <div>
                          <Label>Etiqueta</Label>
                          <Input
                            value={item.label}
                            onChange={(e) => updateAudience(index, { label: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>URL de la imagen</Label>
                          <Input
                            value={item.imageUrl}
                            onChange={(e) => updateAudience(index, { imageUrl: e.target.value })}
                            className="mt-1"
                            placeholder="https://..."
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleSaveLanding}
                    disabled={saveLanding.isPending}
                    className="btn-primary"
                  >
                    {saveLanding.isPending ? "Guardando..." : "Guardar ajustes web"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => landingQuery.data && setLandingDraft(landingQuery.data)}
                  >
                    Descartar cambios
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setLocation("/")}>
                    Ver landing
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
