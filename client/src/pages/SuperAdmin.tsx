import { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield,
  Building2,
  Globe,
  Plus,
  Trash2,
  LayoutDashboard,
  Users,
  UserCheck,
  Clock,
  ExternalLink,
  ImagePlus,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import { compressImageForUpload } from "@/lib/compressImage";
import AccessPageShell from "@/components/AccessPageShell";
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
import { buildSubscriptionPlanLabels } from "@shared/subscriptionPlans";
import SuperAdminCompaniesPanel from "@/components/SuperAdminCompaniesPanel";
import SuperAdminUpcomingPaymentsPanel from "@/components/SuperAdminUpcomingPaymentsPanel";
import { useUrlTab } from "@/hooks/useUrlTab";

type SuperAdminTab = "dashboard" | "companies" | "landing" | "stats";

const SUPERADMIN_TABS = ["dashboard", "companies", "landing", "stats"] as const;

function packFeaturesToText(features: string[]) {
  return features.join("\n");
}

function textToFeatures(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDateTime(value: Date | string | null | undefined, locale: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export default function SuperAdmin() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { isAuthLoading, isSuperAdminAuthenticated } = useAuthContext();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [activeTab, setActiveTab] = useUrlTab<SuperAdminTab>(
    "/superadmin",
    SUPERADMIN_TABS,
    "dashboard"
  );
  const [landingDraft, setLandingDraft] = useState<LandingPageConfig>(DEFAULT_LANDING_PAGE_CONFIG);
  const [uploadingAudienceIndex, setUploadingAudienceIndex] = useState<number | null>(null);

  const loginMutation = trpc.publicApi.superAdminLogin.useMutation();
  const trpcUtils = trpc.useUtils();
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(emptyCreds, {
    enabled: isAuthed,
  });
  const landingQuery = trpc.publicApi.superAdminGetLandingSettings.useQuery(emptyCreds, {
    enabled: isAuthed,
  });
  const saveLanding = trpc.publicApi.superAdminUpdateLandingSettings.useMutation();
  const uploadLandingImage = trpc.publicApi.superAdminUploadLandingImage.useMutation();
  const logoutMutation = trpc.publicApi.logoutSession.useMutation();

  const superAdminNav = useMemo<AppShellNavItem[]>(
    () => [
      { id: "dashboard", label: t("nav.superadmin.dashboard"), icon: LayoutDashboard },
      { id: "companies", label: t("nav.superadmin.companies"), icon: Building2 },
      { id: "landing", label: t("nav.superadmin.landing"), icon: Globe },
      { id: "stats", label: t("superadmin.stats.menuLabel"), icon: BarChart3 },
    ],
    [t]
  );

  const pageTitles = useMemo(
    () => ({
      dashboard: {
        title: t("superadmin.pages.dashboard.title"),
        subtitle: t("superadmin.pages.dashboard.subtitle"),
      },
      companies: {
        title: t("superadmin.pages.companies.title"),
        subtitle: t("superadmin.pages.companies.subtitle"),
      },
      landing: {
        title: t("superadmin.pages.landing.title"),
        subtitle: t("superadmin.pages.landing.subtitle"),
      },
      stats: {
        title: t("superadmin.pages.stats.title"),
        subtitle: t("superadmin.pages.stats.subtitle"),
      },
    }),
    [t]
  );
  const pageMeta = pageTitles[activeTab];

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

  const planLabels = useMemo(
    () => buildSubscriptionPlanLabels(landingQuery.data?.pricingPacks),
    [landingQuery.data?.pricingPacks]
  );

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const monthMs = 30 * dayMs;

    let newCompanies30d = 0;
    let adminAccess24h = 0;
    let adminAccess7d = 0;
    let onboardingCompleted = 0;
    let trialExpired = 0;

    const recentAdminAccess = companies
      .map((company) => {
        const createdAt = company.createdAt ? new Date(company.createdAt) : null;
        const createdAtMs =
          createdAt && !Number.isNaN(createdAt.getTime()) ? createdAt.getTime() : null;
        if (createdAtMs != null && now - createdAtMs <= monthMs) {
          newCompanies30d += 1;
        }

        const lastSignedIn = company.adminLastSignedIn ? new Date(company.adminLastSignedIn) : null;
        const lastSignedInMs =
          lastSignedIn && !Number.isNaN(lastSignedIn.getTime()) ? lastSignedIn.getTime() : null;
        if (lastSignedInMs != null) {
          const diff = now - lastSignedInMs;
          if (diff <= dayMs) adminAccess24h += 1;
          if (diff <= 7 * dayMs) adminAccess7d += 1;
        }

        if (company.onboardingCompleted) onboardingCompleted += 1;
        if (company.trialExpired) trialExpired += 1;

        return {
          id: company.id,
          name: company.name,
          employeeCount: company.employeeCount ?? 0,
          adminLastSignedIn: company.adminLastSignedIn ?? null,
          adminLastSignedInMs: lastSignedInMs,
        };
      })
      .filter((row) => row.adminLastSignedInMs != null)
      .sort((a, b) => (b.adminLastSignedInMs ?? 0) - (a.adminLastSignedInMs ?? 0))
      .slice(0, 8);

    return {
      newCompanies30d,
      adminAccess24h,
      adminAccess7d,
      onboardingCompleted,
      trialExpired,
      recentAdminAccess,
    };
  }, [companies]);

  useEffect(() => {
    if (isAuthLoading) return;
    setIsAuthed(isSuperAdminAuthenticated);
  }, [isAuthLoading, isSuperAdminAuthenticated]);

  useEffect(() => {
    if (landingQuery.data) {
      setLandingDraft(landingQuery.data);
    }
  }, [landingQuery.data]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await loginMutation.mutateAsync({ username, password });
      await trpcUtils.publicApi.getSession.invalidate();
      const sessionResult = await trpcUtils.publicApi.getSession.fetch();
      if (sessionResult.session?.type !== "superadmin") {
        throw new Error(t("superadmin.login.sessionError"));
      }
      setIsAuthed(true);
      toast.success(t("superadmin.login.success"));
      void listCompanies.refetch();
      void landingQuery.refetch();
    } catch {
      toast.error(t("superadmin.login.invalidCredentials"));
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

  const handleAudiencePhotoUpload = async (index: number, file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(t("superadmin.landing.audience.pickImage"));
      return;
    }
    setUploadingAudienceIndex(index);
    try {
      const { dataBase64, contentType } = await compressImageForUpload(file);
      const result = await uploadLandingImage.mutateAsync({
        ...emptyCreds,
        dataBase64,
        contentType,
        purpose: `audience-${landingDraft.audienceImages[index]?.id ?? index}`,
      });
      updateAudience(index, { imageUrl: result.url });
      toast.success(t("superadmin.landing.audience.uploadSuccess"));
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : t("superadmin.landing.audience.uploadFailed");
      toast.error(msg || t("superadmin.landing.audience.uploadFailed"));
    } finally {
      setUploadingAudienceIndex(null);
    }
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
        faqs: [
          ...prev.faqs,
          { q: t("superadmin.landing.faq.defaultQuestion"), a: t("superadmin.landing.faq.defaultAnswer") },
        ],
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
        toast.error(t("superadmin.landing.toasts.planNeedsFeature"));
        return;
      }
      const trustBadges = landingDraft.hero.trustBadges.map((b) => b.trim()).filter(Boolean);
      if (trustBadges.length === 0) {
        toast.error(t("superadmin.landing.toasts.heroNeedsBadge"));
        return;
      }
      const faqs = landingDraft.faqs
        .map((f) => ({ q: f.q.trim(), a: f.a.trim() }))
        .filter((f) => f.q && f.a);
      if (faqs.length === 0) {
        toast.error(t("superadmin.landing.toasts.faqRequired"));
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
      toast.success(t("superadmin.landing.toasts.saved"));
      void landingQuery.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("superadmin.landing.toasts.saveFailed"));
    }
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch {
      // cookie cleared or session already ended
    }
    setIsAuthed(false);
    setLocation("/acceso");
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f7f6]">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f7f6]">
      {!isAuthed ? (
        <AccessPageShell
          backHref="/acceso"
          backLabel={t("superadmin.login.backLabel")}
          icon={Shield}
          title={t("superadmin.login.title")}
          subtitle={t("superadmin.login.subtitle")}
          badge={t("superadmin.login.badge")}
        >
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="sa-user" className="mb-2 block text-sm font-medium text-slate-900">
                {t("superadmin.login.username")}
              </Label>
              <Input
                id="sa-user"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
              />
            </div>
            <div>
              <Label htmlFor="sa-pass" className="mb-2 block text-sm font-medium text-slate-900">
                {t("superadmin.login.password")}
              </Label>
              <Input
                id="sa-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-blue-100 bg-blue-50/40 focus-visible:ring-blue-600"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-blue-700 text-base hover:bg-blue-800"
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? t("superadmin.login.submitting") : t("superadmin.login.submit")}
            </Button>
          </form>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-950">
              <strong>{t("superadmin.login.restrictedTitle")}</strong> {t("superadmin.login.restrictedBody")}
            </p>
          </div>
        </AccessPageShell>
      ) : (
        <AppShellLayout
          brandLabel={t("superadmin.shell.brandLabel")}
          brandIcon={<Shield className="size-5" />}
          pageTitle={pageMeta.title}
          pageSubtitle={pageMeta.subtitle}
          userName={t("superadmin.shell.brandLabel")}
          userEmail={t("superadmin.shell.userEmail")}
          navItems={superAdminNav}
          activeNavId={activeTab}
          onNavChange={(id) => setActiveTab(id as SuperAdminTab)}
          onLogout={() => void handleLogout()}
          headerActions={
            <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/")}>
              <ExternalLink className="mr-2 size-4" />
              {t("superadmin.shell.viewWeb")}
            </Button>
          }
        >
          {activeTab === "dashboard" ? (
            <div className="w-full space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <AppShellKpiCard
                  label={t("superadmin.dashboard.totalCompanies")}
                  value={stats.total}
                  icon={<Building2 className="size-5" />}
                  accent="blue"
                />
                <AppShellKpiCard
                  label={t("superadmin.dashboard.activeCompanies")}
                  value={stats.active}
                  icon={<UserCheck className="size-5" />}
                  accent="emerald"
                />
                <AppShellKpiCard
                  label={t("superadmin.dashboard.platformEmployees")}
                  value={stats.employees}
                  icon={<Users className="size-5" />}
                  accent="amber"
                />
                <AppShellKpiCard
                  label={t("superadmin.dashboard.onTrial")}
                  value={stats.onTrial}
                  icon={<Clock className="size-5" />}
                  accent="rose"
                />
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <AppShellPanel
                  title={t("superadmin.dashboard.clientStatus.title")}
                  description={t("superadmin.dashboard.clientStatus.description")}
                  className="lg:col-span-1"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-3">
                      <span className="text-sm font-medium text-emerald-800">
                        {t("superadmin.dashboard.clientStatus.activeLabel")}
                      </span>
                      <span className="text-2xl font-bold text-emerald-900">{stats.active}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3">
                      <span className="text-sm font-medium text-slate-700">
                        {t("superadmin.dashboard.clientStatus.inactiveLabel")}
                      </span>
                      <span className="text-2xl font-bold text-slate-900">{stats.inactive}</span>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setActiveTab("companies")}
                    >
                      {t("superadmin.dashboard.clientStatus.manageCompanies")}
                    </Button>
                  </div>
                </AppShellPanel>

                <AppShellPanel
                  title={t("superadmin.dashboard.recentCompanies.title")}
                  description={t("superadmin.dashboard.recentCompanies.description")}
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
                            {t("superadmin.dashboard.recentCompanies.employees", {
                              count: company.employeeCount ?? 0,
                            })}{" "}
                            · {company.planLabel}
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
                          {company.isActive
                            ? t("superadmin.dashboard.recentCompanies.active")
                            : t("superadmin.dashboard.recentCompanies.inactive")}
                        </span>
                      </div>
                    ))}
                    {companies.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        {t("superadmin.dashboard.recentCompanies.empty")}
                      </p>
                    ) : null}
                  </div>
                </AppShellPanel>
              </div>

              <SuperAdminUpcomingPaymentsPanel
                companies={companies}
                pricingPacks={landingQuery.data?.pricingPacks}
              />

              <AppShellPanel
                title={t("superadmin.dashboard.quickAccess.title")}
                description={t("superadmin.dashboard.quickAccess.description")}
              >
                <div className="flex flex-wrap gap-3">
                  <Button type="button" onClick={() => setActiveTab("companies")}>
                    <Building2 className="mr-2 size-4" />
                    {t("superadmin.dashboard.quickAccess.viewAll")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setActiveTab("landing")}>
                    <Globe className="mr-2 size-4" />
                    {t("superadmin.dashboard.quickAccess.editLanding")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                    <ExternalLink className="mr-2 size-4" />
                    {t("superadmin.dashboard.quickAccess.openPublicWeb")}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setActiveTab("stats")}>
                    <BarChart3 className="mr-2 size-4" />
                    {t("superadmin.dashboard.quickAccess.viewStats")}
                  </Button>
                </div>
              </AppShellPanel>
            </div>
          ) : null}

          {activeTab === "stats" ? (
            <div className="w-full space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <AppShellKpiCard
                  label={t("superadmin.stats.kpis.newCompanies30d")}
                  value={analytics.newCompanies30d}
                  icon={<Building2 className="size-5" />}
                  accent="blue"
                />
                <AppShellKpiCard
                  label={t("superadmin.stats.kpis.adminAccess24h")}
                  value={analytics.adminAccess24h}
                  icon={<Clock className="size-5" />}
                  accent="emerald"
                />
                <AppShellKpiCard
                  label={t("superadmin.stats.kpis.adminAccess7d")}
                  value={analytics.adminAccess7d}
                  icon={<BarChart3 className="size-5" />}
                  accent="amber"
                />
                <AppShellKpiCard
                  label={t("superadmin.stats.kpis.onboardingCompleted")}
                  value={analytics.onboardingCompleted}
                  icon={<UserCheck className="size-5" />}
                  accent="blue"
                />
                <AppShellKpiCard
                  label={t("superadmin.stats.kpis.trialExpired")}
                  value={analytics.trialExpired}
                  icon={<Users className="size-5" />}
                  accent="rose"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-3">
                <AppShellPanel
                  title={t("superadmin.stats.activity.title")}
                  description={t("superadmin.stats.activity.description")}
                  className="xl:col-span-2"
                >
                  <div className="space-y-2">
                    {analytics.recentAdminAccess.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 px-4 py-3"
                      >
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="text-xs text-slate-500">
                            {t("superadmin.stats.activity.lastAccess", {
                              date: formatDateTime(item.adminLastSignedIn, locale),
                            })}{" "}
                            ·{" "}
                            {t("superadmin.stats.activity.employees", {
                              count: item.employeeCount,
                            })}
                          </p>
                        </div>
                      </div>
                    ))}
                    {analytics.recentAdminAccess.length === 0 ? (
                      <p className="text-sm text-slate-500">{t("superadmin.stats.activity.empty")}</p>
                    ) : null}
                  </div>
                </AppShellPanel>

                <AppShellPanel
                  title={t("superadmin.stats.visits.title")}
                  description={t("superadmin.stats.visits.description")}
                >
                  <div className="space-y-3">
                    <p className="text-sm text-slate-600">{t("superadmin.stats.visits.notConfigured")}</p>
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
                      <p className="text-xs text-blue-900">{t("superadmin.stats.visits.hint")}</p>
                    </div>
                    <Button type="button" variant="outline" onClick={() => setLocation("/")}>
                      <ExternalLink className="mr-2 size-4" />
                      {t("superadmin.stats.visits.openLanding")}
                    </Button>
                  </div>
                </AppShellPanel>
              </div>
            </div>
          ) : null}

          {activeTab === "companies" ? <SuperAdminCompaniesPanel planLabels={planLabels} /> : null}

          {activeTab === "landing" ? (
            <div className="w-full">
              <AppShellPanel className="space-y-8">
                <div>
                  <h2 className="text-xl font-bold text-foreground mb-1">
                    {t("superadmin.landing.title")}
                  </h2>
                  <p className="text-sm text-muted-foreground">{t("superadmin.landing.subtitle")}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="wa-number">{t("superadmin.landing.whatsapp.label")}</Label>
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
                      {t("superadmin.landing.whatsapp.hint")}
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="trial-days">{t("superadmin.landing.trialDays")}</Label>
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
                    <Label htmlFor="trial-headline">{t("superadmin.landing.trialHeadline")}</Label>
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
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("superadmin.landing.hero.sectionTitle")}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>{t("superadmin.landing.hero.badge")}</Label>
                      <Input
                        value={landingDraft.hero.badge}
                        onChange={(e) => updateHero({ badge: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.titleMain")}</Label>
                      <Input
                        value={landingDraft.hero.titleMain}
                        onChange={(e) => updateHero({ titleMain: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.titleHighlight")}</Label>
                      <Input
                        value={landingDraft.hero.titleHighlight}
                        onChange={(e) => updateHero({ titleHighlight: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>{t("superadmin.landing.hero.subtitle")}</Label>
                      <Textarea
                        value={landingDraft.hero.subtitle}
                        onChange={(e) => updateHero({ subtitle: e.target.value })}
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.ctaWhatsapp")}</Label>
                      <Input
                        value={landingDraft.hero.ctaWhatsappLabel}
                        onChange={(e) => updateHero({ ctaWhatsappLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.ctaTrial")}</Label>
                      <Input
                        value={landingDraft.hero.ctaTrialLabel}
                        onChange={(e) => updateHero({ ctaTrialLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.ctaSecondary")}</Label>
                      <Input
                        value={landingDraft.hero.ctaSecondaryLabel}
                        onChange={(e) => updateHero({ ctaSecondaryLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>{t("superadmin.landing.hero.trustBadges")}</Label>
                      <Textarea
                        value={packFeaturesToText(landingDraft.hero.trustBadges)}
                        onChange={(e) =>
                          updateHero({ trustBadges: textToFeatures(e.target.value) })
                        }
                        className="mt-1 min-h-[80px]"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>{t("superadmin.landing.hero.footerTitle")}</Label>
                      <Input
                        value={landingDraft.hero.footerTitle}
                        onChange={(e) => updateHero({ footerTitle: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>{t("superadmin.landing.hero.footerSubtitle")}</Label>
                      <Textarea
                        value={landingDraft.hero.footerSubtitle}
                        onChange={(e) => updateHero({ footerSubtitle: e.target.value })}
                        className="mt-1 min-h-[60px]"
                      />
                    </div>
                    <div>
                      <Label>{t("superadmin.landing.hero.footerCtaRegister")}</Label>
                      <Input
                        value={landingDraft.hero.footerCtaRegisterLabel}
                        onChange={(e) => updateHero({ footerCtaRegisterLabel: e.target.value })}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("superadmin.landing.pricing.sectionTitle")}
                  </h3>
                  <div className="grid gap-6 lg:grid-cols-3">
                    {landingDraft.pricingPacks.map((pack, index) => (
                      <div
                        key={pack.id}
                        className={cn(
                          "rounded-xl border p-4 space-y-3",
                          pack.highlighted ? "border-blue-500 bg-blue-50/50" : "border-border"
                        )}
                      >
                        <p className="text-sm font-semibold text-muted-foreground">
                          {t("superadmin.landing.pricing.planLabel", { index: index + 1 })}
                        </p>
                        <div>
                          <Label>{t("superadmin.landing.pricing.name")}</Label>
                          <Input
                            value={pack.name}
                            onChange={(e) => updatePack(index, { name: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>{t("superadmin.landing.pricing.price")}</Label>
                            <Input
                              value={pack.price}
                              onChange={(e) => updatePack(index, { price: e.target.value })}
                              className="mt-1"
                              placeholder="29€"
                            />
                          </div>
                          <div>
                            <Label>{t("superadmin.landing.pricing.priceSuffix")}</Label>
                            <Input
                              value={pack.priceSuffix}
                              onChange={(e) => updatePack(index, { priceSuffix: e.target.value })}
                              className="mt-1"
                              placeholder="/mes"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.pricing.description")}</Label>
                          <Input
                            value={pack.description}
                            onChange={(e) => updatePack(index, { description: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.pricing.features")}</Label>
                          <Textarea
                            value={packFeaturesToText(pack.features)}
                            onChange={(e) =>
                              updatePack(index, { features: textToFeatures(e.target.value) })
                            }
                            className="mt-1 min-h-[120px]"
                          />
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.pricing.ctaLabel")}</Label>
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
                          {t("superadmin.landing.pricing.highlightPopular")}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("superadmin.landing.audience.sectionTitle")}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {landingDraft.audienceImages.map((item, index) => (
                      <div key={item.id} className="rounded-xl border border-border p-4 space-y-3">
                        <div
                          className="h-28 rounded-lg bg-cover bg-center border border-border"
                          style={{ backgroundImage: `url(${item.imageUrl})` }}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            id={`audience-photo-${item.id}`}
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/gif"
                            className="sr-only"
                            disabled={uploadingAudienceIndex !== null}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              e.target.value = "";
                              void handleAudiencePhotoUpload(index, file);
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            disabled={uploadingAudienceIndex !== null}
                            onClick={() =>
                              document.getElementById(`audience-photo-${item.id}`)?.click()
                            }
                          >
                            <ImagePlus className="size-4" />
                            {uploadingAudienceIndex === index
                              ? t("superadmin.landing.audience.uploading")
                              : t("superadmin.landing.audience.changePhoto")}
                          </Button>
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.audience.label")}</Label>
                          <Input
                            value={item.label}
                            onChange={(e) => updateAudience(index, { label: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.audience.imageUrl")}</Label>
                          <Input
                            value={item.imageUrl}
                            onChange={(e) => updateAudience(index, { imageUrl: e.target.value })}
                            className="mt-1"
                            placeholder="https://... o /api/landing-media/…"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">
                        {t("superadmin.landing.faq.sectionTitle")}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {t("superadmin.landing.faq.hint")}
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
                      {t("superadmin.landing.faq.addQuestion")}
                    </Button>
                  </div>
                  <div className="space-y-4">
                    {landingDraft.faqs.map((faq, index) => (
                      <div key={index} className="rounded-xl border border-border p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-muted-foreground">
                            {t("superadmin.landing.faq.questionLabel", { index: index + 1 })}
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
                            {t("superadmin.landing.faq.remove")}
                          </Button>
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.faq.question")}</Label>
                          <Input
                            value={faq.q}
                            onChange={(e) => updateFaq(index, { q: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>{t("superadmin.landing.faq.answer")}</Label>
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
                    {saveLanding.isPending
                      ? t("superadmin.landing.actions.saving")
                      : t("superadmin.landing.actions.save")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => landingQuery.data && setLandingDraft(landingQuery.data)}
                  >
                    {t("superadmin.landing.actions.discard")}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setLocation("/")}>
                    {t("superadmin.landing.actions.viewLanding")}
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
