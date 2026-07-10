import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, MapPin, Scale, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  DEFAULT_WORKPLACE_GPS_JUSTIFICATION,
  GPS_JUSTIFICATION_CATEGORIES,
  type GpsJustificationCategory,
} from "@shared/gpsJustification";
import { validateEmployeeEmailOrPhone } from "@shared/employeeContact";

const COUNTRY_OPTIONS = [{ code: "ES", label: "España" }];
const TIMEZONE_OPTIONS = [
  { value: "Europe/Madrid", label: "Europe/Madrid (España peninsular)" },
  { value: "Atlantic/Canary", label: "Atlantic/Canary (Canarias)" },
];

const STEPS = [
  { id: 1, title: "Datos del negocio", icon: Building2 },
  { id: 2, title: "Local y fichaje", icon: MapPin },
  { id: 3, title: "Legal básico", icon: Scale },
  { id: 4, title: "Primer empleado", icon: Users },
  { id: 5, title: "Finalizar", icon: CheckCircle2 },
] as const;

const MADRID_LAT = 40.4168;
const MADRID_LNG = -3.7038;

export default function AdminOnboarding() {
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
  const [gpsJustification, setGpsJustification] = useState(DEFAULT_WORKPLACE_GPS_JUSTIFICATION);

  const [dataRetentionYears, setDataRetentionYears] = useState("4");
  const [legalAcknowledged, setLegalAcknowledged] = useState(false);

  const [employeeName, setEmployeeName] = useState("");
  const [employeeEmail, setEmployeeEmail] = useState("");
  const [employeePhone, setEmployeePhone] = useState("");
  const [employeeUsername, setEmployeeUsername] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");

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
  }, [statusQuery.data, setLocation]);

  const handleSkip = async () => {
    try {
      await skipOnboarding.mutateAsync(emptyCreds);
      toast.message("Puedes completar la configuración más tarde desde el panel.");
      setLocation("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

  const saveStep1 = async () => {
    if (businessName.trim().length < 2) {
      toast.error("El nombre comercial es obligatorio");
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
        toast.error("Seleccione el motivo de activación de geolocalización");
        return false;
      }
      if (justification.length < 10) {
        toast.error("Indique una justificación de GPS de al menos 10 caracteres");
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
      toast.error("La conservación mínima es 4 años");
      return false;
    }
    if (!legalAcknowledged) {
      toast.error("Debes confirmar la revisión de los textos legales");
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
        contact.message ??
          "Completa nombre, usuario (mín. 3), contraseña (mín. 6) y email o teléfono, o usa «Crear después»"
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
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const handleFinish = async () => {
    if (!legalAcknowledged) {
      toast.error("Debes confirmar la revisión de los textos legales");
      return;
    }
    setSaving(true);
    try {
      await completeOnboarding.mutateAsync({
        ...emptyCreds,
        legalAcknowledged: true,
      });
      toast.success("Configuración inicial completada");
      setLocation("/admin");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo finalizar");
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
        <p className="text-muted-foreground">Cargando configuración…</p>
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
            Panel
          </button>
          <Button type="button" variant="ghost" size="sm" onClick={handleSkip} disabled={skipOnboarding.isPending}>
            Saltar por ahora
          </Button>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground">Configuración inicial</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Paso {step} de 5 — configura lo mínimo para empezar
          </p>
        </div>

        <div className="flex justify-between mb-8 gap-1">
          {STEPS.map((s) => {
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
              <h2 className="text-lg font-semibold">Datos del negocio</h2>
              <div className="space-y-4">
                <div>
                  <Label>Nombre comercial *</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Razón social / responsable</Label>
                  <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Input value={businessAddress} onChange={(e) => setBusinessAddress(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>País</Label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {COUNTRY_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Zona horaria</Label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {TIMEZONE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <Label>Email de contacto / privacidad</Label>
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
              <h2 className="text-lg font-semibold">Local y fichaje</h2>
              <div className="space-y-4">
                <div>
                  <Label>Dirección del local</Label>
                  <Input
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    placeholder="Calle, número, ciudad"
                    className="mt-1"
                  />
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <p className="font-medium text-sm">Validación por GPS</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Activa el GPS para que los empleados solo puedan fichar cerca del local (no desde casa).
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
                        setGpsJustification(DEFAULT_WORKPLACE_GPS_JUSTIFICATION);
                      }
                    }}
                  />
                </div>
                {locationEnabled && (
                  <>
                    <div>
                      <Label>Radio de validación (metros)</Label>
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
                      <Label htmlFor="onboarding-gps-category">Motivo de activación GPS</Label>
                      <select
                        id="onboarding-gps-category"
                        value={gpsJustificationCategory}
                        onChange={(e) =>
                          setGpsJustificationCategory(e.target.value as GpsJustificationCategory)
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        {GPS_JUSTIFICATION_CATEGORIES.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-muted-foreground mt-1">
                        {
                          GPS_JUSTIFICATION_CATEGORIES.find((o) => o.value === gpsJustificationCategory)
                            ?.hint
                        }
                      </p>
                    </div>
                    <div>
                      <Label htmlFor="onboarding-gps-justification">Justificación GPS</Label>
                      <Input
                        id="onboarding-gps-justification"
                        value={gpsJustification}
                        onChange={(e) => setGpsJustification(e.target.value)}
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Obligatorio al activar GPS (mínimo 10 caracteres). Puedes dejar el texto sugerido.
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Radio recomendado: 100–150 m. Con 10 m el GPS del móvil puede fallar aunque el empleado
                      esté en el local.
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
              <h2 className="text-lg font-semibold">Legal básico</h2>
              <p className="text-sm text-muted-foreground">
                Esta app gestiona registros horarios de empleados. Tu empresa debe informar a sus trabajadores y
                revisar los textos legales antes de usarla oficialmente. Esto es una ayuda técnica, no asesoramiento
                legal.
              </p>
              <div className="space-y-4">
                <div>
                  <Label>Email de privacidad</Label>
                  <Input
                    type="email"
                    value={privacyEmail}
                    onChange={(e) => setPrivacyEmail(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Años de conservación de fichajes</Label>
                  <Input
                    type="number"
                    min={4}
                    max={10}
                    value={dataRetentionYears}
                    onChange={(e) => setDataRetentionYears(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Mínimo legal recomendado: 4 años</p>
                </div>
                <p className="text-sm flex flex-wrap gap-3">
                  <Link href="/legal/privacy" className="underline">
                    Política de privacidad
                  </Link>
                  <Link href="/legal/employee-notice" className="underline">
                    Aviso para empleados
                  </Link>
                  <Link href="/legal/terms" className="underline">
                    Términos de uso
                  </Link>
                </p>
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="legal-ack"
                    checked={legalAcknowledged}
                    onCheckedChange={(v) => setLegalAcknowledged(v === true)}
                  />
                  <label htmlFor="legal-ack" className="text-sm text-muted-foreground leading-relaxed">
                    Entiendo que debo revisar los textos legales con un asesor antes de usar la app oficialmente en mi
                    negocio.
                  </label>
                </div>
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold">Primer empleado (opcional)</h2>
              <p className="text-sm text-muted-foreground">
                Puedes crear tu primer empleado ahora o hacerlo más tarde desde el panel.
              </p>
              <div className="space-y-4">
                <div>
                  <Label>Nombre</Label>
                  <Input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Email de contacto</Label>
                  <Input
                    type="email"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    className="mt-1"
                    placeholder="empleado@empresa.com (opcional si hay teléfono)"
                  />
                </div>
                <div>
                  <Label>Teléfono de contacto</Label>
                  <Input
                    type="tel"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="mt-1"
                    placeholder="+34 600 000 000 (opcional si hay email)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Indica al menos uno: email o teléfono. Para fichar usará el usuario y la contraseña de abajo.
                  </p>
                </div>
                <div>
                  <Label>Usuario para fichar</Label>
                  <Input value={employeeUsername} onChange={(e) => setEmployeeUsername(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Contraseña</Label>
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
                <h2 className="text-lg font-semibold">Configuración inicial completada</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Ya puedes usar el panel de administración. Podrás ajustar empleados, horarios y opciones legales en
                  cualquier momento.
                </p>
                {statusQuery.data.employeeCount === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
                    Aún no has creado empleados. Recuerda añadirlos antes de que tu equipo fiche.
                  </p>
                )}
              </div>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-4 border-t">
            {step > 1 && step < 5 && (
              <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Atrás
              </Button>
            )}
            {step < 4 && (
              <Button type="button" className="ml-auto btn-primary" onClick={handleNext} disabled={saving}>
                {saving ? "Guardando…" : "Siguiente"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
            {step === 4 && (
              <>
                <Button type="button" variant="secondary" onClick={() => setStep(5)} disabled={saving}>
                  Crear después
                </Button>
                <Button type="button" className="ml-auto btn-primary" onClick={handleNext} disabled={saving}>
                  {saving ? "Guardando…" : "Siguiente"}
                </Button>
              </>
            )}
            {step === 5 && (
              <Button type="button" className="w-full btn-primary" onClick={handleFinish} disabled={saving}>
                {saving ? "Finalizando…" : "Ir al panel admin"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
