import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  MessageCircle,
  Phone,
  Search,
  CalendarClock,
  AlertTriangle,
  User,
  UserCheck,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import { AppShellKpiCard, AppShellPanel } from "@/components/AppShellLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import { SUBSCRIPTION_PLANS, SUBSCRIPTION_PLAN_LABELS } from "@shared/subscriptionPlans";
import type { SubscriptionPlan } from "@shared/subscriptionPlans";
import {
  CRM_STAGES,
  CRM_STAGE_LABELS,
  CRM_STAGE_COLORS,
  CRM_ACTIVITY_TYPES,
  CRM_ACTIVITY_LABELS,
  type CrmStage,
  type CrmActivityType,
} from "@shared/crmStages";
import { buildWhatsAppHref } from "@shared/landingConfig";
import SuperAdminCompanyLocationsPanel from "@/components/SuperAdminCompanyLocationsPanel";

type CompanyRow = {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionPlan: string;
  adminUsername: string | null;
  adminEmail: string | null;
  adminLastSignedIn: Date | string | null;
  employeeCount: number;
  locationCount: number;
  planName?: string;
  planLabel?: string;
  trialDaysRemaining: number | null;
  trialExpired: boolean;
  billingStatus: string | null;
  stripeCustomerId: string | null;
  crmStage: string;
  crmContactName: string | null;
  crmContactPhone: string | null;
  crmNotes: string | null;
  crmNextFollowUpAt: Date | string | null;
  privacyContactEmail: string | null;
  billingEmail: string | null;
  address: string | null;
  legalName: string | null;
  createdAt: Date | string;
  trialEndsAt: Date | string | null;
  onboardingCompleted: boolean;
  followUpOverdue?: boolean;
  followUpDueSoon?: boolean;
  atEmployeeLimit?: boolean;
};

function formatDt(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatDateOnly(value: Date | string | null | undefined) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short" }).format(new Date(value));
}

function toDatetimeLocal(value: Date | string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SuperAdminCompaniesPanel({
  planLabels: planLabelsProp,
}: {
  planLabels?: Record<SubscriptionPlan, string>;
} = {}) {
  const { t } = useLocale();
  const planLabels = planLabelsProp ?? SUBSCRIPTION_PLAN_LABELS;
  const listCompanies = trpc.publicApi.superAdminListCompanies.useQuery(emptyCreds);
  const setStatus = trpc.publicApi.superAdminSetCompanyStatus.useMutation();
  const deleteCompany = trpc.publicApi.superAdminDeleteCompany.useMutation();
  const createCompany = trpc.publicApi.superAdminCreateCompany.useMutation();
  const setSubscription = trpc.publicApi.superAdminSetCompanySubscription.useMutation();
  const setCompanyAdmin = trpc.publicApi.superAdminSetCompanyAdmin.useMutation();
  const updateCrm = trpc.publicApi.superAdminUpdateCompanyCrm.useMutation();
  const addActivity = trpc.publicApi.superAdminAddCrmActivity.useMutation();

  const [search, setSearch] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("all");
  const [filterStage, setFilterStage] = useState<string>("all");
  const [filterUrgent, setFilterUrgent] = useState(false);

  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [createForm, setCreateForm] = useState({
    companyName: "",
    companySlug: "",
    adminUsername: "",
    adminPassword: "",
  });

  const [editingCompanyId, setEditingCompanyId] = useState<number | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    plan: "trial" as SubscriptionPlan,
    trialEndsAt: "",
    billingStatus: "",
    isActive: true,
  });
  const [adminForm, setAdminForm] = useState({ adminUsername: "", adminPassword: "" });
  const [crmForm, setCrmForm] = useState({
    crmStage: "trial" as CrmStage,
    crmContactName: "",
    crmContactPhone: "",
    crmNotes: "",
    crmNextFollowUpAt: "",
  });
  const [newActivity, setNewActivity] = useState({ body: "", activityType: "note" as CrmActivityType });

  const activitiesQuery = trpc.publicApi.superAdminListCrmActivities.useQuery(
    { ...emptyCreds, companyId: editingCompanyId ?? 0 },
    { enabled: editingCompanyId != null && editingCompanyId > 0 }
  );

  const companies = (listCompanies.data ?? []) as CompanyRow[];

  const crmStats = useMemo(() => {
    const active = companies.filter((c) => c.isActive);
    const trialsExpiring = active.filter(
      (c) =>
        c.trialDaysRemaining != null &&
        c.trialDaysRemaining <= 7 &&
        !c.trialExpired
    );
    const followUpsDue = companies.filter((c) => c.followUpOverdue);
    const paying = active.filter(
      (c) => c.billingStatus === "active" || c.billingStatus === "trialing"
    );
    return {
      total: companies.length,
      active: active.length,
      trialsExpiring: trialsExpiring.length,
      followUpsDue: followUpsDue.length,
      paying: paying.length,
    };
  }, [companies]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return companies.filter((c) => {
      if (filterPlan !== "all" && c.subscriptionPlan !== filterPlan) return false;
      if (filterActive === "active" && !c.isActive) return false;
      if (filterActive === "inactive" && c.isActive) return false;
      if (filterStage !== "all" && c.crmStage !== filterStage) return false;
      if (filterUrgent) {
        const urgent =
          c.followUpOverdue ||
          (c.trialDaysRemaining != null && c.trialDaysRemaining <= 3 && !c.trialExpired) ||
          c.atEmployeeLimit;
        if (!urgent) return false;
      }
      if (!q) return true;
      const haystack = [
        c.name,
        c.slug,
        c.adminUsername,
        c.adminEmail,
        c.privacyContactEmail,
        c.crmContactName,
        c.crmContactPhone,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [companies, search, filterPlan, filterActive, filterStage, filterUrgent]);

  const refetch = () => void listCompanies.refetch();

  const openCompanyEditor = (company: CompanyRow) => {
    setEditingCompanyId(company.id);
    setSubscriptionForm({
      plan: (company.subscriptionPlan ?? "trial") as SubscriptionPlan,
      trialEndsAt: toDatetimeLocal(company.trialEndsAt),
      billingStatus: company.billingStatus ?? "",
      isActive: company.isActive,
    });
    setAdminForm({ adminUsername: company.adminUsername ?? "", adminPassword: "" });
    setCrmForm({
      crmStage: (company.crmStage ?? "trial") as CrmStage,
      crmContactName: company.crmContactName ?? company.legalName ?? "",
      crmContactPhone: company.crmContactPhone ?? "",
      crmNotes: company.crmNotes ?? "",
      crmNextFollowUpAt: toDatetimeLocal(company.crmNextFollowUpAt),
    });
    setNewActivity({ body: "", activityType: "note" });
  };

  const handleCreateCompany = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await createCompany.mutateAsync({ ...emptyCreds, ...createForm });
      toast.success("Empresa creada");
      setShowCreateCompany(false);
      setCreateForm({ companyName: "", companySlug: "", adminUsername: "", adminPassword: "" });
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear");
    }
  };

  const handleSaveCrm = async () => {
    if (editingCompanyId == null) return;
    try {
      await updateCrm.mutateAsync({
        ...emptyCreds,
        companyId: editingCompanyId,
        crmStage: crmForm.crmStage,
        crmContactName: crmForm.crmContactName || null,
        crmContactPhone: crmForm.crmContactPhone || null,
        crmNotes: crmForm.crmNotes || null,
        crmNextFollowUpAt: crmForm.crmNextFollowUpAt
          ? new Date(crmForm.crmNextFollowUpAt).toISOString()
          : null,
      });
      toast.success("CRM actualizado");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error al guardar CRM");
    }
  };

  const handleAddActivity = async () => {
    if (editingCompanyId == null || !newActivity.body.trim()) return;
    try {
      await addActivity.mutateAsync({
        ...emptyCreds,
        companyId: editingCompanyId,
        body: newActivity.body.trim(),
        activityType: newActivity.activityType,
      });
      setNewActivity((p) => ({ ...p, body: "" }));
      await activitiesQuery.refetch();
      toast.success("Actividad registrada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar");
    }
  };

  const handleSaveSubscription = async () => {
    if (editingCompanyId == null) return;
    try {
      await setSubscription.mutateAsync({
        ...emptyCreds,
        companyId: editingCompanyId,
        subscriptionPlan: subscriptionForm.plan,
        trialEndsAt: subscriptionForm.trialEndsAt
          ? new Date(subscriptionForm.trialEndsAt).toISOString()
          : null,
        billingStatus: subscriptionForm.billingStatus || null,
        isActive: subscriptionForm.isActive,
      });
      toast.success("Suscripción actualizada");
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const handleSaveAdmin = async () => {
    if (editingCompanyId == null || !adminForm.adminPassword) {
      toast.error("Introduce contraseña para actualizar admin");
      return;
    }
    try {
      await setCompanyAdmin.mutateAsync({
        ...emptyCreds,
        companyId: editingCompanyId,
        adminUsername: adminForm.adminUsername,
        adminPassword: adminForm.adminPassword,
      });
      toast.success("Admin actualizado");
      setAdminForm((p) => ({ ...p, adminPassword: "" }));
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Error");
    }
  };

  const toggleStatus = async (company: CompanyRow) => {
    const next = !company.isActive;
    const msg = next
      ? `¿Dar de alta a "${company.name}"?`
      : `¿Dar de baja a "${company.name}"?`;
    if (!window.confirm(msg)) return;
    try {
      await setStatus.mutateAsync({ ...emptyCreds, companyId: company.id, isActive: next });
      toast.success(next ? "Empresa activada" : "Empresa dada de baja");
      refetch();
    } catch {
      toast.error("No se pudo cambiar el estado");
    }
  };

  const handleDeleteCompany = async (company: CompanyRow) => {
    const warning =
      `BORRADO PERMANENTE de "${company.name}" (${company.slug}).\n\n` +
      `Se eliminarán empleados, fichajes, incidencias, CRM y datos de la empresa. ` +
      `Esta acción no se puede deshacer.\n\n` +
      `Escribe el slug exacto para confirmar: ${company.slug}`;
    const typed = window.prompt(warning);
    if (typed == null) return;
    if (typed.trim() !== company.slug) {
      toast.error("Slug incorrecto — no se borró nada");
      return;
    }
    try {
      await deleteCompany.mutateAsync({
        ...emptyCreds,
        companyId: company.id,
        confirmSlug: typed.trim(),
      });
      toast.success(`Empresa "${company.name}" eliminada`);
      if (editingCompanyId === company.id) setEditingCompanyId(null);
      refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar la empresa");
    }
  };

  const contactEmail = (c: CompanyRow) =>
    c.adminEmail ?? c.privacyContactEmail ?? c.billingEmail ?? null;

  const waLink = (phone: string | null | undefined, name: string) => {
    if (!phone) return null;
    return buildWhatsAppHref(phone, `Hola ${name}, te escribo desde TimeClock.`);
  };

  return (
    <div className="w-full space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AppShellKpiCard label="Clientes" value={String(crmStats.total)} icon={<User className="size-5" />} accent="blue" />
        <AppShellKpiCard label="Activos" value={String(crmStats.active)} icon={<UserCheck className="size-5" />} accent="emerald" />
        <AppShellKpiCard label="Trials ≤7 días" value={String(crmStats.trialsExpiring)} icon={<Clock className="size-5" />} accent="amber" />
        <AppShellKpiCard label="Seguimientos vencidos" value={String(crmStats.followUpsDue)} icon={<AlertTriangle className="size-5" />} accent="rose" />
        <AppShellKpiCard label="Pagando (Stripe)" value={String(crmStats.paying)} icon={<CalendarClock className="size-5" />} accent="blue" />
      </div>

      <AppShellPanel title="Nueva empresa" description="Alta manual de cliente">
        {showCreateCompany ? (
          <form onSubmit={handleCreateCompany} className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Nombre</Label>
              <Input
                value={createForm.companyName}
                onChange={(e) => setCreateForm((p) => ({ ...p, companyName: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input
                value={createForm.companySlug}
                onChange={(e) => setCreateForm((p) => ({ ...p, companySlug: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Usuario admin</Label>
              <Input
                value={createForm.adminUsername}
                onChange={(e) => setCreateForm((p) => ({ ...p, adminUsername: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div>
              <Label>Contraseña admin</Label>
              <Input
                type="password"
                value={createForm.adminPassword}
                onChange={(e) => setCreateForm((p) => ({ ...p, adminPassword: e.target.value }))}
                className="mt-1"
                required
              />
            </div>
            <div className="sm:col-span-2 flex gap-2">
              <Button type="submit" disabled={createCompany.isPending}>
                Crear
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreateCompany(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" onClick={() => setShowCreateCompany(true)}>
            <Plus className="mr-2 size-4" />
            {t("superadmin.companies.addCompany")}
          </Button>
        )}
      </AppShellPanel>

      <AppShellPanel
        title="CRM — Clientes"
        description="Contacto, seguimiento, historial y suscripción en un solo sitio"
      >
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("superadmin.companies.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
          >
            <option value="all">Todos los planes</option>
            {SUBSCRIPTION_PLANS.map((p) => (
              <option key={p} value={p}>
                {planLabels[p]}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterStage}
            onChange={(e) => setFilterStage(e.target.value)}
          >
            <option value="all">Todas las etapas CRM</option>
            {CRM_STAGES.map((s) => (
              <option key={s} value={s}>
                {CRM_STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="all">Activas + bajas</option>
            <option value="active">Solo activas</option>
            <option value="inactive">Solo bajas</option>
          </select>
          <label className="flex items-center gap-2 text-sm px-2">
            <input
              type="checkbox"
              checked={filterUrgent}
              onChange={(e) => setFilterUrgent(e.target.checked)}
            />
            Urgentes
          </label>
        </div>

        <div className="space-y-3">
          {filtered.map((company) => {
            const email = contactEmail(company);
            const stage = (company.crmStage ?? "trial") as CrmStage;
            const whatsapp = waLink(company.crmContactPhone, company.crmContactName || company.name);

            return (
              <div
                key={company.id}
                className={cn(
                  "border rounded-lg p-3 space-y-3",
                  company.followUpOverdue && "border-orange-300 bg-orange-50/40",
                  editingCompanyId === company.id && "ring-2 ring-blue-500/30"
                )}
              >
                <div className="flex flex-wrap gap-3 justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{company.name}</p>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          CRM_STAGE_COLORS[stage] ?? "bg-slate-100"
                        )}
                      >
                        {CRM_STAGE_LABELS[stage] ?? stage}
                      </span>
                      {company.followUpOverdue ? (
                        <span className="text-xs text-orange-700 flex items-center gap-1">
                          <AlertTriangle className="size-3" /> Seguimiento vencido
                        </span>
                      ) : null}
                      {company.trialDaysRemaining != null && !company.trialExpired ? (
                        <span className="text-xs text-sky-700 font-medium">
                          {company.trialDaysRemaining}d para pagar
                        </span>
                      ) : company.trialExpired ? (
                        <span className="text-xs text-red-700">Prueba vencida</span>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {company.slug} · Alta {formatDateOnly(company.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {email ? (
                        <a href={`mailto:${email}`} className="inline-flex items-center gap-1 hover:text-blue-700">
                          <Mail className="size-3.5" /> {email}
                        </a>
                      ) : null}
                      {company.crmContactPhone ? (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="size-3.5" /> {company.crmContactPhone}
                        </span>
                      ) : null}
                      <span>
                        {company.employeeCount} emp · {company.locationCount} sede(s) ·{" "}
                        {company.planName ?? company.planLabel}
                      </span>
                      <span>Último acceso admin: {formatDt(company.adminLastSignedIn)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    {whatsapp ? (
                      <a href={whatsapp} target="_blank" rel="noreferrer">
                        <Button type="button" size="sm" variant="outline">
                          <MessageCircle className="size-3.5 mr-1" />
                          WhatsApp
                        </Button>
                      </a>
                    ) : null}
                    {email ? (
                      <a href={`mailto:${email}`}>
                        <Button type="button" size="sm" variant="outline">
                          <Mail className="size-3.5 mr-1" />
                          Email
                        </Button>
                      </a>
                    ) : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => openCompanyEditor(company)}>
                      <Pencil className="size-3.5 mr-1" />
                      Ficha CRM
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={company.isActive ? "destructive" : "outline"}
                      onClick={() => void toggleStatus(company)}
                    >
                      {company.isActive ? "Baja" : "Alta"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-red-700 border-red-200 hover:bg-red-50"
                      disabled={deleteCompany.isPending}
                      onClick={() => void handleDeleteCompany(company)}
                    >
                      <Trash2 className="size-3.5 mr-1" />
                      Borrar
                    </Button>
                  </div>
                </div>

                {editingCompanyId === company.id ? (
                  <div className="rounded-xl bg-slate-50 p-4 space-y-4 border border-slate-200">
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm flex items-center gap-1">
                          <User className="size-4" /> Contacto CRM
                        </h4>
                        <div>
                          <Label>Etapa CRM</Label>
                          <select
                            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={crmForm.crmStage}
                            onChange={(e) =>
                              setCrmForm((p) => ({ ...p, crmStage: e.target.value as CrmStage }))
                            }
                          >
                            {CRM_STAGES.map((s) => (
                              <option key={s} value={s}>
                                {CRM_STAGE_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label>Persona de contacto</Label>
                          <Input
                            value={crmForm.crmContactName}
                            onChange={(e) =>
                              setCrmForm((p) => ({ ...p, crmContactName: e.target.value }))
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Teléfono / WhatsApp</Label>
                          <Input
                            value={crmForm.crmContactPhone}
                            onChange={(e) =>
                              setCrmForm((p) => ({ ...p, crmContactPhone: e.target.value }))
                            }
                            placeholder="34600111222"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="flex items-center gap-1">
                            <CalendarClock className="size-3.5" /> Próximo seguimiento
                          </Label>
                          <Input
                            type="datetime-local"
                            value={crmForm.crmNextFollowUpAt}
                            onChange={(e) =>
                              setCrmForm((p) => ({ ...p, crmNextFollowUpAt: e.target.value }))
                            }
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Notas internas</Label>
                          <Textarea
                            value={crmForm.crmNotes}
                            onChange={(e) => setCrmForm((p) => ({ ...p, crmNotes: e.target.value }))}
                            rows={4}
                            className="mt-1"
                          />
                        </div>
                        <Button type="button" size="sm" onClick={() => void handleSaveCrm()} disabled={updateCrm.isPending}>
                          Guardar CRM
                        </Button>
                        <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                          <p>Email admin: {email ?? "—"}</p>
                          <p>Dirección: {company.address ?? "—"}</p>
                          <p>Onboarding: {company.onboardingCompleted ? "Completado" : "Pendiente"}</p>
                          {company.billingStatus ? <p>Stripe: {company.billingStatus}</p> : null}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h4 className="font-semibold text-sm">Historial de actividades</h4>
                        <div className="flex gap-2">
                          <select
                            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                            value={newActivity.activityType}
                            onChange={(e) =>
                              setNewActivity((p) => ({
                                ...p,
                                activityType: e.target.value as CrmActivityType,
                              }))
                            }
                          >
                            {CRM_ACTIVITY_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {CRM_ACTIVITY_LABELS[t]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <Textarea
                          placeholder="Ej: Llamada — interesado en plan Pro..."
                          value={newActivity.body}
                          onChange={(e) => setNewActivity((p) => ({ ...p, body: e.target.value }))}
                          rows={3}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => void handleAddActivity()}
                          disabled={addActivity.isPending}
                        >
                          Añadir actividad
                        </Button>
                        <div className="max-h-48 overflow-y-auto space-y-2 text-sm">
                          {(activitiesQuery.data ?? []).map((act) => (
                            <div key={act.id} className="rounded-lg bg-white border px-3 py-2">
                              <p className="text-xs text-muted-foreground">
                                {formatDt(act.createdAt)} ·{" "}
                                {CRM_ACTIVITY_LABELS[act.activityType as CrmActivityType] ?? act.activityType}
                              </p>
                              <p className="text-foreground whitespace-pre-wrap">{act.body}</p>
                            </div>
                          ))}
                          {activitiesQuery.data?.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Sin actividades aún.</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">Suscripción</h4>
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            value={subscriptionForm.plan}
                            onChange={(e) =>
                              setSubscriptionForm((p) => ({
                                ...p,
                                plan: e.target.value as SubscriptionPlan,
                              }))
                            }
                          >
                            {SUBSCRIPTION_PLANS.map((plan) => (
                              <option key={plan} value={plan}>
                                {planLabels[plan]}
                              </option>
                            ))}
                          </select>
                          {subscriptionForm.plan !== "legacy" ? (
                            <div className="space-y-1">
                              <Label className="text-xs">Fin periodo de prueba / pago</Label>
                              <Input
                                type="datetime-local"
                                value={subscriptionForm.trialEndsAt}
                                onChange={(e) =>
                                  setSubscriptionForm((p) => ({ ...p, trialEndsAt: e.target.value }))
                                }
                              />
                            </div>
                          ) : null}
                          <Input
                            placeholder="Estado facturación"
                            value={subscriptionForm.billingStatus}
                            onChange={(e) =>
                              setSubscriptionForm((p) => ({ ...p, billingStatus: e.target.value }))
                            }
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={subscriptionForm.isActive}
                              onChange={(e) =>
                                setSubscriptionForm((p) => ({ ...p, isActive: e.target.checked }))
                              }
                            />
                            Empresa activa
                          </label>
                          <Button type="button" size="sm" onClick={() => void handleSaveSubscription()}>
                            Guardar plan
                          </Button>
                        </div>
                        <div className="space-y-3 pt-3 border-t">
                          <h4 className="font-semibold text-sm">Admin</h4>
                          <Input
                            value={adminForm.adminUsername}
                            onChange={(e) =>
                              setAdminForm((p) => ({ ...p, adminUsername: e.target.value }))
                            }
                          />
                          <Input
                            type="password"
                            placeholder="Nueva contraseña"
                            value={adminForm.adminPassword}
                            onChange={(e) =>
                              setAdminForm((p) => ({ ...p, adminPassword: e.target.value }))
                            }
                          />
                          <Button type="button" size="sm" variant="secondary" onClick={() => void handleSaveAdmin()}>
                            Actualizar admin
                          </Button>
                        </div>
                        <SuperAdminCompanyLocationsPanel
                          companyId={company.id}
                          companyName={company.name}
                          locationCount={company.locationCount}
                        />
                        <Button type="button" size="sm" variant="ghost" onClick={() => setEditingCompanyId(null)}>
                          Cerrar ficha
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay clientes con estos filtros.</p>
          ) : null}
        </div>
      </AppShellPanel>
    </div>
  );
}
