import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Shield, ArrowLeft, Building2, Globe, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import {
  DEFAULT_LANDING_PAGE_CONFIG,
  type LandingPageConfig,
  type LandingPricingPack,
  type LandingAudience,
  type LandingHero,
  type LandingFaq,
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
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
