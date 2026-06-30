import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Shield, Building2, Globe, Plus, Trash2, LayoutDashboard, Users, UserCheck, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import AppShellLayout, {
  AppShellKpiCard,
  AppShellPanel,
  type AppShellNavItem,
} from "@/components/AppShellLayout";
import {
  DEFAULT_LANDING_PAGE_CONFIG,
  type LandingPageConfig,
  type LandingPricingPack,
  type LandingAudience,
  type LandingHero,
  type LandingFaq,
} from "@shared/landingConfig";
import { cn } from "@/lib/utils";

type SuperAdminTab = "dashboard" | "companies" | "landing";

const SUPERADMIN_NAV: AppShellNavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "landing", label: "Web / Landing", icon: Globe },
];

const SUPERADMIN_PAGE_TITLES: Record<SuperAdminTab, { title: string; subtitle: string }> = {
  dashboard: {
    title: "Dashboard",
    subtitle: "Resumen de la plataforma TimeClock",
  },
  companies: {
    title: "Empresas",
    subtitle: "Gestión de clientes y suscripciones",
  },
  landing: {
    title: "Web / Landing",
    subtitle: "Contenido público de la página principal",
  },
};

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
  const [activeTab, setActiveTab] = useState<SuperAdminTab>("dashboard");
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
  const logoutMutation = trpc.publicApi.logoutSession.useMutation();

  const companies = listCompanies.data ?? [];
  const stats = useMemo(() => {
    const active = companies.filter((c) => c.isActive);
    return {
      total: companies.length,
      active: active.length,
      inactive: companies.length - active.length,
      employees: companies.reduce((sum, c) => sum + (c.employeeCount ?? 0), 0),
      onTrial: active.filter((c) => c.subscriptionPlan === "trial").length,
    };
  }, [companies]);

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

  const handleActivate = async (companyId: number, companyName: string) => {
    if (
      !window.confirm(
        `¿Dar de alta de nuevo a "${companyName}"? Los usuarios podrán volver a acceder.`
      )
    ) {
      return;
    }
    try {
      await setStatus.mutateAsync({
        ...emptyCreds,
        companyId,
        isActive: true,
      });
      toast.success("Empresa dada de alta");
      await listCompanies.refetch();
    } catch {
      toast.error("No se pudo dar de alta la empresa");
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

  const updateHero = (patch: Partial<LandingHero>) => {
    setLandingDraft((prev) => ({
      ...prev,
      hero: { ...prev.hero, ...patch },
    }));
  };

  const updateFaq = (index: number, patch: Partial<LandingFaq>) => {
    setLandingDraft((prev) => {
      const faqs = [...prev.faqs];
      faqs[index] = { ...faqs[index], ...patch };
      return { ...prev, faqs };
    });
  };

  const addFaq = () => {
    setLandingDraft((prev) => {
      if (prev.faqs.length >= 20) return prev;
      return {
        ...prev,
        faqs: [...prev.faqs, { q: "Nueva pregunta", a: "Respuesta..." }],
      };
    });
  };

  const removeFaq = (index: number) => {
    setLandingDraft((prev) => {
      if (prev.faqs.length <= 1) return prev;
      return { ...prev, faqs: prev.faqs.filter((_, i) => i !== index) };
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
      const trustBadges = landingDraft.hero.trustBadges.map((b) => b.trim()).filter(Boolean);
      if (trustBadges.length === 0) {
        toast.error("El hero debe tener al menos un distintivo de confianza");
        return;
      }
      const faqs = landingDraft.faqs
        .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
        .filter((f) => f.q && f.a);
      if (faqs.length === 0) {
        toast.error("Debe haber al menos una pregunta FAQ con texto");
        return;
      }
      await saveLanding.mutateAsync({
        ...emptyCreds,
        config: {
          ...landingDraft,
          hero: { ...landingDraft.hero, trustBadges },
          faqs,
          pricingPacks: packs as LandingPageConfig["pricingPacks"],
        },
      });
      toast.success("Ajustes de la web guardados");
      void landingQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron guardar los ajustes");
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // cookie cleared or session already ended
    }
    setIsAuthed(false);
    setLocation("/");
  };

  const pageMeta = SUPERADMIN_PAGE_TITLES[activeTab];

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      {!isAuthed ? (
        <div className="flex min-h-screen items-center justify-center px-4 py-8">
          <Card className="w-full max-w-md p-8 shadow-lg">
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
        </div>
      ) : (
        <AppShellLayout
          brandLabel="Superadmin"
          brandIcon={<Shield className="size-5" />}
          pageTitle={pageMeta.title}
          pageSubtitle={pageMeta.subtitle}
          userName="Superadmin"
          userEmail="Control de plataforma"
          navItems={SUPERADMIN_NAV}
          activeNavId={activeTab}
          onNavChange={(id) => setActiveTab(id as SuperAdminTab)}
          onLogout={() => void handleLogout()}
          headerActions={
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/")}>
              <ExternalLink className="mr-2 size-4" />
              Ver web
            </Button>
          }
        >
          {activeTab === "dashboard" ? (
            <div className="w-full space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AppShellKpiCard
                  label="Empresas totales"
                  value={stats.total}
                  icon={<Building2 className="size-5" />}
                  accent="blue"
                />
                <AppShellKpiCard
                  label="Empresas activas"
                  value={stats.active}
                  icon={<UserCheck className="size-5" />}
                  accent="emerald"
                />
                <AppShellKpiCard
                  label="Empleados en plataforma"
                  value={stats.employees}
                  icon={<Users className="size-5" />}
                  accent="amber"
                />
                <AppShellKpiCard
                  label="En periodo de prueba"
                  value={stats.onTrial}
                  icon={<Clock className="size-5" />}
                  accent="rose"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <AppShellPanel
                  title="Estado de clientes"
                  description="Distribución actual de empresas registradas"
                  className="lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                      <span className="text-sm font-medium text-emerald-800">Activas</span>
                      <span className="text-2xl font-bold text-emerald-900">{stats.active}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">Dadas de baja</span>
                      <span className="text-2xl font-bold text-slate-900">{stats.inactive}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("companies")}
                    >
                      Gestionar empresas
                    </Button>
                  </div>
                </AppShellPanel>

                <AppShellPanel
                  title="Últimas empresas"
                  description="Acceso rápido a clientes recientes"
                  className="lg:col-span-2"
                >
                  <div className="space-y-2">
                    {companies.slice(0, 5).map((company) => (
                      <div
                        key={company.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{company.name}</p>
                          <p className="text-xs text-slate-500">
                            {company.employeeCount} empleados · {company.planLabel}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-semibold",
                            company.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          )}
                        >
                          {company.isActive ? "Activa" : "Baja"}
                        </span>
                      </div>
                    ))}
                    {companies.length === 0 ? (
                      <p className="text-sm text-slate-500">No hay empresas registradas todavía.</p>
                    ) : null}
                  </div>
                </AppShellPanel>
              </div>

              <AppShellPanel
                title="Accesos rápidos"
                description="Herramientas habituales del superadmin"
              >
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setActiveTab("companies")}>
                    <Building2 className="mr-2 size-4" />
                    Ver todas las empresas
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setActiveTab("landing")}>
                    <Globe className="mr-2 size-4" />
                    Editar landing
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                    <ExternalLink className="mr-2 size-4" />
                    Abrir web pública
                  </Button>
                </div>
              </AppShellPanel>
            </div>
          ) : null}

          {activeTab === "companies" ? (
            <div className="w-full">
              <AppShellPanel
                title="Empresas registradas"
                description="Las empresas se dan de baja solas si superan el límite de empleados o vence el trial. Puedes reactivarlas manualmente si fue un error."
              >
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
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="border-blue-600 text-blue-700 hover:bg-blue-50"
                            onClick={() => handleActivate(company.id, company.name)}
                            disabled={setStatus.isPending}
                          >
                            Dar de alta
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {listCompanies.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No hay empresas todavía.</p>
                  ) : null}
                </div>
              </AppShellPanel>
            </div>
          ) : null}

          {activeTab === "landing" ? (
            <div className="w-full">
              <AppShellPanel className="space-y-8">
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
                  <h3 className="text-lg font-semibold text-foreground">Hero (cabecera principal)</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Etiqueta superior (badge)</Label>
                      <Input
                        value={landingDraft.hero.badge}
                        onChange={(e) => updateHero({ badge: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Título — parte principal</Label>
                      <Input
                        value={landingDraft.hero.titleMain}
                        onChange={(e) => updateHero({ titleMain: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Título — parte destacada (color)</Label>
                      <Input
                        value={landingDraft.hero.titleHighlight}
                        onChange={(e) => updateHero({ titleHighlight: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Subtítulo</Label>
                      <Textarea
                        value={landingDraft.hero.subtitle}
                        onChange={(e) => updateHero({ subtitle: e.target.value })}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    <div>
                      <Label>Botón WhatsApp / demo</Label>
                      <Input
                        value={landingDraft.hero.ctaWhatsappLabel}
                        onChange={(e) => updateHero({ ctaWhatsappLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Botón prueba gratis</Label>
                      <Input
                        value={landingDraft.hero.ctaTrialLabel}
                        onChange={(e) => updateHero({ ctaTrialLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Botón secundario</Label>
                      <Input
                        value={landingDraft.hero.ctaSecondaryLabel}
                        onChange={(e) => updateHero({ ctaSecondaryLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Distintivos de confianza (uno por línea)</Label>
                      <Textarea
                        value={packFeaturesToText(landingDraft.hero.trustBadges)}
                        onChange={(e) =>
                          updateHero({ trustBadges: textToFeatures(e.target.value) })
                        }
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Título del bloque final (CTA footer)</Label>
                      <Input
                        value={landingDraft.hero.footerTitle}
                        onChange={(e) => updateHero({ footerTitle: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Subtítulo del bloque final</Label>
                      <Textarea
                        value={landingDraft.hero.footerSubtitle}
                        onChange={(e) => updateHero({ footerSubtitle: e.target.value })}
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                    <div>
                      <Label>Botón registro en bloque final</Label>
                      <Input
                        value={landingDraft.hero.footerCtaRegisterLabel}
                        onChange={(e) => updateHero({ footerCtaRegisterLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
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
                          pack.highlighted ? "border-blue-500 bg-blue-50/50" : "border-border"
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

                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">Preguntas frecuentes (FAQ)</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        En las respuestas puedes usar <code className="text-xs">{"{trialDays}"}</code>{" "}
                        para insertar los días de prueba configurados arriba.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addFaq}
                      disabled={landingDraft.faqs.length >= 20}
                      className="gap-1"
                    >
                      <Plus className="size-4" />
                      Añadir pregunta
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {landingDraft.faqs.map((faq, index) => (
                      <div key={index} className="rounded-xl border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-muted-foreground">
                            Pregunta {index + 1}
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFaq(index)}
                            disabled={landingDraft.faqs.length <= 1}
                            className="text-destructive hover:text-destructive gap-1"
                          >
                            <Trash2 className="size-4" />
                            Eliminar
                          </Button>
                        </div>
                        <div>
                          <Label>Pregunta</Label>
                          <Input
                            value={faq.q}
                            onChange={(e) => updateFaq(index, { q: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Respuesta</Label>
                          <Textarea
                            value={faq.a}
                            onChange={(e) => updateFaq(index, { a: e.target.value })}
                            className="mt-1 min-h-[80px]"
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
              </AppShellPanel>
            </div>
          ) : null}
        </AppShellLayout>
      )}
    </div>
  );
}
