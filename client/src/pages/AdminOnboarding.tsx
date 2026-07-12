import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, MapPin, Scale, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import RestaurantMap from "@/components/RestaurantMap";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import { useAuthContext, useRequireAdminAuth } from "@/contexts/AuthContext";
import { createDefaultEmployeeSchedule } from "@shared/scheduleDefaults";
import {
  GPS_JUSTIFICATION_CATEGORIES,
  type GpsJustificationCategory,
} from "@shared/gpsJustification";
import { validateEmployeeEmailOrPhone } from "@shared/employeeContact";

const COUNTRY_OPTIONS = [{ code: "ES", labelKey: "admin.onboarding.countries.ES" }];
const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", labelKey: "admin.onboarding.timezones.europeMadrid" },
  { value: "Atlantic/Canary", labelKey: "admin.onboarding.timezones.atlanticCanary" },
];

const STEPS_META = [
  { id: 1, key: "business" as const, icon: Building2 },
  { id: 2, key: "location" as const, icon: MapPin },
  { id: 3, key: "legal" as const, icon: Scale },
  { id: 4, key: "firstEmployee" as const, icon: Users },
  { id: 5, key: "finish" as const, icon: CheckCircle2 },
] as const;

const MADRID_LAT = 40.4168;
const MADRID_LNG = -3.7038;

export default function AdminOnboarding() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const { adminSession } = useAuthContext();
  const { isAuthLoading, isAdminAuthenticated } = useRequireAdminAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const statusQuery = trpc.publicApi.getOnboardingStatus.useQuery(emptyCreds, {
    enabled: Boolean(adminSession),
  });
  const updateLegal = trpc.publicApi.updateCompanyLegal.useMutation();
  const upsertRestaurant = trpc.publicApi.upsertRestaurant.useMutation();
  const createEmployee = trpc.publicApi.createEmployee.useMutation();
  const skipOnboarding = trpc.publicApi.skipOnboarding.useMutation();
  const completeOnboarding = trpc.publicApi.completeOnboarding.useMutation();

  const [businessName, setBusinessName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [country, setCountry] = useState("ES");
  const [timezone, setTimezone] = useState("Europe/Madrid");
  const [privacyEmail, setPrivacyEmail] = useState("");

  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [latitude, setLatitude] = useState(MADRID_LAT);
  const [longitude, setLongitude] = useState(MADRID_LNG);
  const [radiusMeters, setRadiusMeters] = useState(150);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [gpsJustificationCategory, setGpsJustificationCategory] =
    useState<GpsJustificationCategory>("workplace_geofence");
  const [gpsJustification, setGpsJustification] = useState("");

  const [dataRetentionYears, setDataRetentionYears] = useState("4");
  const [legalAcknowledged, setLegalAcknowledged] = useState(false);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");

  const steps = useMemo(
    () =>
      STEPS_META.map((s) => ({
        ...s,
        title: t(`admin.onboarding.steps.${s.key}`),
      })),
    [t]
  );

  const gpsCategoryOptions = useMemo(
    () =>
      GPS_JUSTIFICATION_CATEGORIES.map((option) => ({
        value: option.value,
        label: t(`admin.legal.gps.categories.${option.value}.label`),
        hint: t(`admin.legal.gps.categories.${option.value}.hint`),
      })),
    [t]
  );

  const defaultGpsJustification = t("admin.legal.gps.defaultJustification");

  useEffect(() => {
    if (!gpsJustification.trim()) {
      setGpsJustification(defaultGpsJustification);
    }
  }, [defaultGpsJustification, gpsJustification]);

  useEffect(() => {
    if (isAuthLoading || !isAdminAuthenticated) return;
    const data = statusQuery.data;
    if (!data) return;
    if (data.onboardingCompleted) {
      setLocation("/admin");
      return;
    }
    const c = data.company;
    setBusinessName(c.name ?? "");
    setLegalName(c.legalName ?? "");
    setBusinessAddress(c.address ?? "");
    setCountry(c.country ?? "ES");
    setTimezone(c.timezone ?? "Europe/Madrid");
    setPrivacyEmail(c.privacyContactEmail ?? "");
    setLocationEnabled(c.locationEnabled ?? false);
    setDataRetentionYears(String(c.dataRetentionYears ?? 4));
    setLegalAcknowledged(Boolean(data.onboardingLegalAcknowledgedAt));
    if (data.restaurant) {
      setRestaurantAddress(data.restaurant.address ?? "");
      setLatitude(Number(data.restaurant.latitude) || MADRID_LAT);
      setLongitude(Number(data.restaurant.longitude) || MADRID_LNG);
      setRadiusMeters(data.restaurant.radiusMeters ?? 150);
    } else {
      setRestaurantAddress(c.address ?? "");
    }
  }, [statusQuery.data, setLocation, isAuthLoading, isAdminAuthenticated]);

  const handleSkip = async () => {
    try {
      await skipOnboarding.mutateAsync(emptyCreds);
      toast.message(t("admin.onboarding.skipLater"));
      setLocation("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.onboarding.toasts.saveFailed"));
    }
  };

  const saveStep1 = async () => {
    if (businessName.trim().length < 2) {
      toast.error(t("admin.onboarding.validations.businessNameRequired"));
      return false;
    }
    await updateLegal.mutateAsync({
      ...emptyCreds,
      name: businessName.trim(),
      legalName: legalName.trim() || undefined,
      address: businessAddress.trim() || undefined,
      country,
      timezone,
      privacyContactEmail: privacyEmail.trim() || undefined,
    });
    return true;
  };

  const saveStep2 = async () => {
    const address = restaurantAddress.trim() || "Pendiente de configurar";
    const effectiveRadius = locationEnabled ? Math.max(50, radiusMeters) : 150;
    await upsertRestaurant.mutateAsync({
      ...emptyCreds,
      name: businessName.trim() || "Mi negocio",
      address,
      latitude,
      longitude,
      radiusMeters: effectiveRadius,
    });
    if (locationEnabled) {
      const justification = gpsJustification.trim();
      if (!gpsJustificationCategory) {
        toast.error(t("admin.onboarding.validations.gpsCategoryRequired"));
        return false;
      }
      if (justification.length < 10) {
        toast.error(t("admin.onboarding.validations.gpsJustificationMin"));
        return false;
      }
      await updateLegal.mutateAsync({
        ...emptyCreds,
        locationEnabled: true,
        gpsJustificationCategory,
        gpsJustification: justification,
      });
    } else {
      await updateLegal.mutateAsync({
        ...emptyCreds,
        locationEnabled: false,
      });
    }
    return true;
  };

  const saveStep3 = async () => {
    const years = Number(dataRetentionYears);
    if (Number.isNaN(years) || years < 4) {
      toast.error(t("admin.onboarding.validations.minRetention"));
      return false;
    }
    if (!legalAcknowledged) {
      toast.error(t("admin.onboarding.validations.legalAckRequired"));
      return false;
    }
    await updateLegal.mutateAsync({
      ...emptyCreds,
      privacyContactEmail: privacyEmail.trim() || undefined,
      dataRetentionYears: years,
      legalOnboardingAcknowledged: true,
    });
    return true;
  };

  const saveStep4 = async () => {
    if (
      !employeeName.trim() &&
      !employeeUsername.trim() &&
      !employeeEmail.trim() &&
      !employeePhone.trim()
    ) {
      return true;
    }
    const contact = validateEmployeeEmailOrPhone(employeeEmail, employeePhone);
    if (
      !employeeName.trim() ||
      !contact.valid ||
      employeeUsername.trim().length < 3 ||
      employeePassword.length < 6
    ) {
      toast.error(
        contact.message ?? t("admin.onboarding.validations.employeeIncomplete")
      );
      return false;
    }
    await createEmployee.mutateAsync({
      ...emptyCreds,
      employeeName: employeeName.trim(),
      employeeEmail: contact.normalizedEmail ?? "",
      employeePhone: contact.normalizedPhone ?? "",
      employeeUsername: employeeUsername.trim(),
      employeePassword,
      lateGraceMinutes: 5,
      schedule: createDefaultEmployeeSchedule(),
    });
    return true;
  };

  const handleNext = async () => {
    setSaving(true);
    try {
      if (step === 1 && !(await saveStep1())) return;
      if (step === 2 && !(await saveStep2())) return;
      if (step === 3 && !(await saveStep3())) return;
      if (step === 4 && !(await saveStep4())) return;
      await statusQuery.refetch();
      setStep((s) => Math.min(5, s + 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.onboarding.toasts.saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!legalAcknowledged) {
      toast.error(t("admin.onboarding.validations.legalAckRequired"));
      return;
    }
    setSaving(true);
    try {
      await completeOnboarding.mutateAsync({
        ...emptyCreds,
        legalAcknowledged: true,
      });
      toast.success(t("admin.onboarding.toasts.completed"));
      setLocation("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.onboarding.toasts.finishFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (isAuthLoading || !isAdminAuthenticated) {
    return null;
  }

  if (statusQuery.isLoading || !statusQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t("admin.onboarding.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" />
            {t("admin.dashboard.title")}
          </button>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button type="button" variant="ghost" size="sm" onClick={handleSkip} disabled={skipOnboarding.isPending}>
              {t("admin.onboarding.skipNow")}
            </Button>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">{t("admin.onboarding.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin.onboarding.stepProgress", { step })}
          </p>
        </div>

        <div className="flex justify-between mb-8 gap-1">
          {steps.map((s) => {
            const Icon = s.icon;
            const active = s.id === step;
            const done = s.id < step;
            return (
              <div
                key={s.id}
                className={`flex-1 text-center text-xs ${active ? "text-accent font-semibold" : done ? "text-foreground" : "text-muted-foreground"}`}
              >
                <div
                  className={`mx-auto w-8 h-8 rounded-full flex items-center justify-center mb-1 ${active ? "bg-accent text-accent-foreground" : done ? "bg-muted" : "bg-muted/50"}`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline">{s.title}</span>
              </div>
            );
          })}
        </div>

        <Card className="p-6 shadow-lg space-y-6">
          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold">{t("admin.onboarding.steps.business")}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("admin.onboarding.fields.businessName")}</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.legalName")}</Label>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.address")}</Label>
                  <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t("admin.onboarding.fields.country")}</Label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {COUNTRY_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {t(o.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>{t("admin.onboarding.fields.timezone")}</Label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TIMEZONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {t(o.labelKey)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.privacyEmail")}</Label>
                  <Input
                    type="email"
                    value={privacyEmail}
                    onChange={(e) => setPrivacyEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold">{t("admin.onboarding.steps.location")}</h2>
              <div className="space-y-4">
                <div>
                  <Label>{t("admin.onboarding.fields.restaurantAddress")}</Label>
                  <Input
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    placeholder={t("admin.onboarding.placeholders.restaurantAddress")}
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-sm">{t("admin.onboarding.location.gpsTitle")}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t("admin.onboarding.location.gpsDescription")}
                    </p>
                  </div>
                  <Switch
                    checked={locationEnabled}
                    onCheckedChange={(checked) => {
                      setLocationEnabled(checked);
                      if (checked && !gpsJustificationCategory) {
                        setGpsJustificationCategory("workplace_geofence");
                      }
                      if (checked && !gpsJustification.trim()) {
                        setGpsJustification(defaultGpsJustification);
                      }
                    }}
                  />
                </div>
                {locationEnabled && (
                  <>
                    <div>
                      <Label>{t("admin.onboarding.fields.validationRadius")}</Label>
                      <Input
                        type="number"
                        min={50}
                        max={500}
                        value={radiusMeters}
                        onChange={(e) => setRadiusMeters(Number(e.target.value) || 150)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="onboarding-gps-category">
                        {t("admin.onboarding.fields.gpsCategory")}
                      </Label>
                      <select
                        id="onboarding-gps-category"
                        value={gpsJustificationCategory}
                        onChange={(e) =>
                          setGpsJustificationCategory(e.target.value as GpsJustificationCategory)
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {gpsCategoryOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {
                          gpsCategoryOptions.find((o) => o.value === gpsJustificationCategory)
                            ?.hint
                        }
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="onboarding-gps-justification">
                        {t("admin.onboarding.fields.gpsJustification")}
                      </Label>
                      <Input
                        id="onboarding-gps-justification"
                        value={gpsJustification}
                        onChange={(e) => setGpsJustification(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("admin.onboarding.location.gpsJustificationHint")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("admin.onboarding.location.radiusHint")}
                    </p>
                    <RestaurantMap
                      latitude={latitude}
                      longitude={longitude}
                      onLocationSelect={(lat, lng) => {
                        setLatitude(lat);
                        setLongitude(lng);
                      }}
                      onAddressChange={setRestaurantAddress}
                    />
                  </>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold">{t("admin.onboarding.steps.legal")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("admin.onboarding.legal.description")}
              </p>
              <div className="space-y-4">
                <div>
                  <Label>{t("admin.onboarding.fields.privacyEmailLegal")}</Label>
                  <Input
                    type="email"
                    value={privacyEmail}
                    onChange={(e) => setPrivacyEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.retentionYears")}</Label>
                  <Input
                    type="number"
                    min={4}
                    max={10}
                    value={dataRetentionYears}
                    onChange={(e) => setDataRetentionYears(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.onboarding.legal.retentionHint")}
                  </p>
                </div>
                <p className="text-sm flex flex-wrap gap-3">
                  <Link href="/legal/privacy" className="underline">
                    {t("admin.onboarding.legal.links.privacy")}
                  </Link>
                  <Link href="/legal/employee-notice" className="underline">
                    {t("admin.onboarding.legal.links.employeeNotice")}
                  </Link>
                  <Link href="/legal/terms" className="underline">
                    {t("admin.onboarding.legal.links.terms")}
                  </Link>
                </p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="legal-ack"
                    checked={legalAcknowledged}
                    onCheckedChange={(v) => setLegalAcknowledged(v === true)}
                  />
                  <label htmlFor="legal-ack" className="text-sm text-muted-foreground leading-relaxed">
                    {t("admin.onboarding.legal.acknowledge")}
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold">{t("admin.onboarding.steps.firstEmployee")}</h2>
              <p className="text-sm text-muted-foreground">
                {t("admin.onboarding.firstEmployee.description")}
              </p>
              <div className="space-y-4">
                <div>
                  <Label>{t("admin.onboarding.fields.employeeName")}</Label>
                  <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.employeeEmail")}</Label>
                  <Input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    className="mt-1"
                    placeholder={t("admin.onboarding.placeholders.employeeEmail")}
                  />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.employeePhone")}</Label>
                  <Input
                    type="tel"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="mt-1"
                    placeholder={t("admin.onboarding.placeholders.employeePhone")}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("admin.onboarding.firstEmployee.contactHint")}
                  </p>
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.employeeUsername")}</Label>
                  <Input value={employeeUsername} onChange={(e) => setEmployeeUsername(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>{t("admin.onboarding.fields.employeePassword")}</Label>
                  <Input
                    type="password"
                    value={employeePassword}
                    onChange={(e) => setEmployeePassword(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}

          {step === 5 && (
            <>
              <div className="text-center py-4">
                <CheckCircle2 className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h2 className="text-lg font-semibold">{t("admin.onboarding.finish.title")}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t("admin.onboarding.finish.description")}
                </p>
                {statusQuery.data.employeeCount === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                    {t("admin.onboarding.finish.noEmployees")}
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {step > 1 && step < 5 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                {t("admin.onboarding.actions.back")}
              </Button>
            )}
            {step < 4 && (
              <Button type="button" className="ml-auto btn-primary" onClick={handleNext} disabled={saving}>
                {saving ? t("admin.onboarding.actions.saving") : t("admin.onboarding.actions.next")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 4 && (
              <>
                <Button type="button" variant="secondary" onClick={() => setStep(5)} disabled={saving}>
                  {t("admin.onboarding.actions.createLater")}
                </Button>
                <Button type="button" className="ml-auto btn-primary" onClick={handleNext} disabled={saving}>
                  {saving ? t("admin.onboarding.actions.saving") : t("admin.onboarding.actions.next")}
                </Button>
              </>
            )}
            {step === 5 && (
              <Button type="button" className="w-full btn-primary" onClick={handleFinish} disabled={saving}>
                {saving ? t("admin.onboarding.actions.finishing") : t("admin.onboarding.actions.goToPanel")}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
