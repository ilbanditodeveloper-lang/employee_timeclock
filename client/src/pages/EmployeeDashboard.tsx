import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, Calendar, AlertCircle, CalendarDays, Palmtree, Pause, Play } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';
import { employeeQueryInput } from '@/lib/authApi';
import EmployeePrivacyNotice from '@/pages/EmployeePrivacyNotice';
import {
  formatScheduleTime,
  getClockWindowMinutes,
  parseScheduleEntryTime,
} from "@shared/scheduleClockWindow";
import { SCHEDULE_DAY_KEYS, type DaySchedulePayload } from "@shared/scheduleMap";
import {
  resolveClockEntrySlot,
  shouldEnforceClockWindow,
} from "@shared/scheduleFlexibility";
import {
  APP_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getDayOfWeekInTimeZone,
  getMinutesSinceMidnightInTimeZone,
  resolveAppTimeZone,
  todayYmdInTimeZone,
} from "@shared/timezone";
import EmployeeShellLayout from '@/components/EmployeeShellLayout';
import { EARLY_CLOCK_MINUTES } from '@shared/const';

const LATE_GRACE_MINUTES = 5;

const weekdayKeys = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

function getCurrentLocationOnce(): Promise<{ lat: number; lng: number }> {
  const readLocation = (options: PositionOptions) =>
    new Promise<{ lat: number; lng: number }>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          reject(error);
        },
        options
      );
    });

  return new Promise(async (resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalización no disponible'));
      return;
    }

    try {
      // Fast path: use a recent location fix if available.
      const fastLocation = await readLocation({
        enableHighAccuracy: false,
        timeout: 2000,
        maximumAge: 120000,
      });
      resolve(fastLocation);
      return;
    } catch {
      // Ignore and fallback to high-accuracy attempt.
    }

    try {
      const preciseLocation = await readLocation({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
      resolve(preciseLocation);
    } catch (error) {
      reject(error);
    }
  });
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: string }).message || '').trim();
    if (message) return message;
  }
  return fallback;
}

function isNetworkFetchError(error: unknown): boolean {
  const message = getErrorMessage(error, "").toLowerCase();
  if (message.includes("failed to fetch") || message.includes("networkerror")) return true;
  if (message.includes("abort") || message.includes("timeout")) return true;
  return false;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function EmployeeDashboard() {
  const clockInMutation = trpc.publicApi.clockIn.useMutation();
  const clockOutMutation = trpc.publicApi.clockOut.useMutation();
  const pauseClockMutation = trpc.publicApi.pauseClock.useMutation();
  const resumeClockMutation = trpc.publicApi.resumeClock.useMutation();
  const subscribePushMutation = trpc.publicApi.pushNotifications.subscribe.useMutation();
  const vapidKeyQuery = trpc.publicApi.pushNotifications.getVapidPublicKey.useQuery();
  const [, setLocation] = useLocation();
  const { employeeSession, setEmployeeSession } = useAuthContext();
  const locationEnabled = employeeSession?.locationEnabled ?? false;
  const appTimeZone = resolveAppTimeZone(employeeSession?.timezone);
  const [isAtRestaurant, setIsAtRestaurant] = useState(() => !locationEnabled);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLate, setIsLate] = useState(false);
  const [isTooEarly, setIsTooEarly] = useState(false);
  const [scheduledEntryLabel, setScheduledEntryLabel] = useState<string | null>(null);
  const [clockWindowEnforced, setClockWindowEnforced] = useState(false);
  const [flexibleClockIn, setFlexibleClockIn] = useState(false);
  const [completedShiftsToday, setCompletedShiftsToday] = useState(0);
  const notificationWarningShown = useRef(false);
  const pushSubscriptionAttempted = useRef(false);

  const employeeTimeclocks = trpc.publicApi.getEmployeeTimeclocks.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );
  const clockStatusQuery = trpc.publicApi.getEmployeeClockStatus.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );
  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );
  const employeeRestaurantQuery = trpc.publicApi.getEmployeeRestaurant.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );

  useEffect(() => {
    if (!employeeSession) {
      setLocation('/employee-login');
    }
  }, [employeeSession, setLocation]);

  // Request push notification permission and subscribe — solo una vez por sesión y con retraso para no saturar el servidor (p. ej. Render al despertar).
  useEffect(() => {
    if (!employeeSession || !vapidKeyQuery.data?.publicKey || pushSubscriptionAttempted.current) return;
    pushSubscriptionAttempted.current = true;

    const subscribeToPushNotifications = async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

      const vapidPublicKey = vapidKeyQuery.data!.publicKey;
      const urlBase64ToUint8Array = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
        return outputArray;
      };
      const base64UrlEncode = (arrayBuffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(arrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      };

      const syncSubscriptionWithServer = async (subscription: PushSubscription) => {
        const p256dhKey = subscription.getKey('p256dh');
        const authKey = subscription.getKey('auth');
        if (!p256dhKey || !authKey) return;
        await subscribePushMutation.mutateAsync({
          ...employeeQueryInput(employeeSession!.employeeId),
          subscription: {
            endpoint: subscription.endpoint,
            keys: { p256dh: base64UrlEncode(p256dhKey), auth: base64UrlEncode(authKey) },
          },
        });
      };

      try {
        await new Promise((r) => setTimeout(r, 2500));
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
          await syncSubscriptionWithServer(existingSubscription);
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
        await syncSubscriptionWithServer(subscription);
      } catch {
        pushSubscriptionAttempted.current = false;
      }
    };

    subscribeToPushNotifications();
  }, [employeeSession, vapidKeyQuery.data, subscribePushMutation]);

  useEffect(() => {
    if (!employeeSession || !vapidKeyQuery.isSuccess) return;
    if (!vapidKeyQuery.data?.publicKey && !notificationWarningShown.current) {
      notificationWarningShown.current = true;
      toast.error("Notificaciones no configuradas. Contacta con el administrador.");
    }
  }, [employeeSession, vapidKeyQuery.isSuccess, vapidKeyQuery.data]);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timeclocks = employeeTimeclocks.data || [];
    const openRecord = timeclocks.find((entry) => entry.entryTime && !entry.exitTime);
    setIsClockedIn(Boolean(openRecord));
    const todayYmd = todayYmdInTimeZone(appTimeZone);
    setCompletedShiftsToday(
      timeclocks.filter((entry) => {
        if (!entry.exitTime) return false;
        const exitYmd = todayYmdInTimeZone(appTimeZone, new Date(entry.exitTime));
        return exitYmd === todayYmd;
      }).length
    );
  }, [employeeTimeclocks.data, appTimeZone]);

  useEffect(() => {
    if (clockStatusQuery.data) {
      setIsClockedIn(clockStatusQuery.data.isClockedIn);
      setIsPaused(clockStatusQuery.data.isPaused);
    }
  }, [clockStatusQuery.data]);

  useEffect(() => {
    if (isClockedIn) {
      setIsLate(false);
      setIsTooEarly(false);
      setClockWindowEnforced(false);
      setFlexibleClockIn(false);
      return;
    }

    const scheduleMap = (employeeScheduleQuery.data ??
      employeeSession?.schedule ??
      {}) as Record<string, DaySchedulePayload | undefined>;
    const scheduleKey = weekdayKeys[getDayOfWeekInTimeZone(currentTime, appTimeZone)];
    const daySchedule = scheduleMap[scheduleKey];
    const entrySlot = resolveClockEntrySlot({ completedShiftsToday });
    const enforceWindow =
      entrySlot !== null &&
      shouldEnforceClockWindow(scheduleMap, scheduleKey, entrySlot);

    setClockWindowEnforced(enforceWindow);
    setFlexibleClockIn(!enforceWindow);

    if (!enforceWindow) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
      return;
    }

    const entryTime =
      entrySlot === 2 ? daySchedule?.entry2 || null : daySchedule?.entry1 || null;

    if (!entryTime) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
      setClockWindowEnforced(false);
      setFlexibleClockIn(true);
      return;
    }

    const parsed = parseScheduleEntryTime(entryTime);
    if (!parsed) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
      setClockWindowEnforced(false);
      setFlexibleClockIn(true);
      return;
    }

    setScheduledEntryLabel(formatScheduleTime(parsed.hour, parsed.minute));
    const graceMinutes = employeeSession?.lateGraceMinutes ?? LATE_GRACE_MINUTES;
    const { earliest, latest } = getClockWindowMinutes(
      parsed.hour,
      parsed.minute,
      graceMinutes,
      EARLY_CLOCK_MINUTES
    );
    const currentTotalMinutes = getMinutesSinceMidnightInTimeZone(currentTime, appTimeZone);
    setIsTooEarly(currentTotalMinutes < earliest);
    setIsLate(currentTotalMinutes > latest);
  }, [
    currentTime,
    isClockedIn,
    employeeSession?.schedule,
    employeeScheduleQuery.data,
    completedShiftsToday,
    appTimeZone,
    employeeSession?.lateGraceMinutes,
  ]);

  useEffect(() => {
    setIsAtRestaurant(!locationEnabled);
  }, [locationEnabled]);

  const buildClockPayload = async () => {
    if (!employeeSession?.employeeId) throw new Error("Sesión no válida");
    const base = employeeQueryInput(employeeSession.employeeId);
    if (!locationEnabled) return base;
    const coords = await getCurrentLocationOnce();
    return { ...base, latitude: coords.lat, longitude: coords.lng };
  };

  const handleClockIn = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (locationEnabled && !window.confirm(
        "Tu empresa requiere ubicación puntual solo al fichar. ¿Continuar?"
      )) {
        return;
      }
      const payload = await buildClockPayload();
      if (locationEnabled) setIsAtRestaurant(true);
      await clockInMutation.mutateAsync(payload);
      setIsClockedIn(true);
      employeeTimeclocks.refetch().catch(() => {});
      toast.success('¡Entrada registrada!');
    } catch (error) {
      if (!isNetworkFetchError(error)) {
        toast.error(getErrorMessage(error, 'Error al registrar entrada'));
      } else {
        let done = false;
        for (const delayMs of [500, 1500]) {
          try {
            await wait(delayMs);
            const payload = await buildClockPayload();
            await clockInMutation.mutateAsync(payload);
            setIsClockedIn(true);
            employeeTimeclocks.refetch().catch(() => {});
            toast.success('¡Entrada registrada!');
            done = true;
            break;
          } catch (retryError) {
            if (!isNetworkFetchError(retryError)) {
              toast.error(getErrorMessage(retryError, 'Error al registrar entrada'));
              done = true;
              break;
            }
          }
        }
        if (!done) {
          const refreshed = await employeeTimeclocks.refetch();
          const openRecord = (refreshed.data || []).some((entry) => entry.entryTime && !entry.exitTime);
          if (openRecord) {
            setIsClockedIn(true);
            toast.success('¡Entrada registrada! (la conexión estaba inestable)');
          } else {
            toast.error('Error de conexión. Espera unos segundos y vuelve a pulsar Entrada.');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const payload = await buildClockPayload();
      await clockOutMutation.mutateAsync(payload);
      setIsClockedIn(false);
      setIsPaused(false);
      refreshClockState();
      toast.success('¡Salida registrada!');
    } catch (error) {
      if (!isNetworkFetchError(error)) {
        toast.error(getErrorMessage(error, 'Error al registrar salida'));
      } else {
        let done = false;
        for (const delayMs of [500, 1500]) {
          try {
            await wait(delayMs);
            const payload = await buildClockPayload();
            await clockOutMutation.mutateAsync(payload);
            setIsClockedIn(false);
            employeeTimeclocks.refetch().catch(() => {});
            toast.success('¡Salida registrada!');
            done = true;
            break;
          } catch (retryError) {
            if (!isNetworkFetchError(retryError)) {
              toast.error(getErrorMessage(retryError, 'Error al registrar salida'));
              done = true;
              break;
            }
          }
        }
        if (!done) {
          const refreshed = await employeeTimeclocks.refetch();
          const openRecord = (refreshed.data || []).some((entry) => entry.entryTime && !entry.exitTime);
          if (!openRecord) {
            setIsClockedIn(false);
            toast.success('¡Salida registrada! (la conexión estaba inestable)');
          } else {
            toast.error('Error de conexión. Espera unos segundos y vuelve a pulsar Salida.');
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshClockState = () => {
    employeeTimeclocks.refetch().catch(() => {});
    clockStatusQuery.refetch().catch(() => {});
  };

  const handleTogglePause = async () => {
    if (loading || !isClockedIn) return;
    setLoading(true);
    try {
      const input = employeeQueryInput(employeeSession!.employeeId);
      if (isPaused) {
        await resumeClockMutation.mutateAsync(input);
        setIsPaused(false);
        toast.success('Jornada reanudada');
      } else {
        await pauseClockMutation.mutateAsync(input);
        setIsPaused(true);
        toast.success('Pausa iniciada');
      }
      refreshClockState();
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo actualizar la pausa'));
    } finally {
      setLoading(false);
    }
  };

  const handleIncident = () => {
    setLocation('/employee/incident');
  };

  if (employeeSession?.needsPrivacyNotice) {
    return (
      <div className="min-h-screen bg-slate-900/40 flex items-center justify-center p-4">
        <EmployeePrivacyNotice embedded />
      </div>
    );
  }

  const canClockIn =
    !isClockedIn &&
    !loading &&
    (!clockWindowEnforced || (!isLate && !isTooEarly));
  const canClockOut = isClockedIn && !loading;

  return (
    <EmployeeShellLayout pageTitle="Fichaje" pageSubtitle="Entrada, salida y pausas">
        {/* Time Display */}
        <div className="mb-8 text-center">
          <div className="text-5xl font-bold text-foreground mb-2">
            {formatTimeInTimeZone(currentTime, appTimeZone, { second: "2-digit" })}
          </div>
          <div className="text-lg text-muted-foreground">
            {formatDateInTimeZone(currentTime, appTimeZone)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Horario de Madrid ({APP_TIMEZONE})</p>
        </div>

        {/* Location Status */}
        <Card className="app-shell-card mb-8 border border-blue-100 p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Estado de Ubicación</h2>
              <p className={`text-sm ${locationEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                {locationEnabled
                  ? 'Se validará tu ubicación al pulsar Entrada o Salida'
                  : 'Fichaje sin geolocalización (configuración de tu empresa)'}
              </p>
              {flexibleClockIn && !isClockedIn && (
                <p className="text-sm text-emerald-700 dark:text-emerald-400 mt-2">
                  Fichaje libre: no tienes horario asignado para hoy
                </p>
              )}
              {isTooEarly && clockWindowEnforced && scheduledEntryLabel && !isClockedIn && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Fichaje disponible desde {EARLY_CLOCK_MINUTES} min antes de las {scheduledEntryLabel}
                </p>
              )}
              {isLate && clockWindowEnforced && !isClockedIn && (
                <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                  Fichaje bloqueado: superaste los {employeeSession?.lateGraceMinutes ?? 5} min de gracia
                </p>
              )}
              {isClockedIn && isPaused && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  En pausa — pulsa Reanudar para seguir fichando
                </p>
              )}
            </div>
            <div
              className={`w-4 h-4 rounded-full ${
                locationEnabled ? 'bg-amber-500' : 'bg-green-500'
              }`}
            />
          </div>
        </Card>

        {/* Clock In / Pause / Out */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button
            onClick={handleClockIn}
            disabled={!canClockIn}
            className="h-24 bg-blue-700 text-lg font-semibold text-white hover:bg-blue-800 flex flex-col items-center justify-center gap-2 disabled:opacity-50"
          >
            <Clock className="w-6 h-6" />
            {isTooEarly ? "Aún no puedes fichar" : isLate ? "Entrada bloqueada" : "Entrada"}
            {isTooEarly && scheduledEntryLabel && (
              <span className="text-xs font-normal">Desde {EARLY_CLOCK_MINUTES} min antes de {scheduledEntryLabel}</span>
            )}
            {isLate && (
              <span className="text-xs font-normal">Retraso &gt; gracia permitida</span>
            )}
          </Button>

          <Button
            onClick={handleTogglePause}
            disabled={!isClockedIn || loading}
            variant="outline"
            className="h-24 border-2 border-blue-200 text-lg font-semibold text-blue-900 hover:bg-blue-50 flex flex-col items-center justify-center gap-2"
          >
            {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            {isPaused ? "Reanudar" : "Pausa"}
          </Button>

          <Button
            onClick={handleClockOut}
            disabled={!canClockOut}
            className="h-24 border-2 border-slate-300 bg-white text-lg font-semibold text-slate-800 hover:bg-slate-50 flex flex-col items-center justify-center gap-2 disabled:opacity-50"
          >
            <Clock className="w-6 h-6" />
            Salida
          </Button>
        </div>

        {/* Incident Button */}
        <Button
          onClick={handleIncident}
          variant="outline"
          className="mb-8 h-16 w-full border-2 border-blue-200 text-lg font-semibold text-blue-900 hover:bg-blue-50 flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          Reportar Incidencia
        </Button>

        {/* Quick Links */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          <Card
            className="app-shell-card cursor-pointer p-6 shadow-sm transition-shadow hover:shadow-md"
            onClick={() => setLocation('/employee/time-off')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex size-12 items-center justify-center rounded-lg bg-blue-100">
                <Palmtree className="size-6 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Vacaciones / días libres</h3>
                <p className="text-sm text-muted-foreground">Solicitar con antelación</p>
              </div>
            </div>
          </Card>
          <Card
            className="app-shell-card cursor-pointer p-6 shadow-sm transition-shadow hover:shadow-md"
            onClick={() => setLocation('/employee/calendar')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex size-12 items-center justify-center rounded-lg bg-blue-100">
                <Calendar className="size-6 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Calendario y Calculadora</h3>
                <p className="text-sm text-muted-foreground">Ver mis horas</p>
              </div>
            </div>
          </Card>
          <Card
            className="app-shell-card cursor-pointer p-6 shadow-sm transition-shadow hover:shadow-md"
            onClick={() => setLocation('/employee/schedule')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex size-12 items-center justify-center rounded-lg bg-blue-100">
                <CalendarDays className="size-6 text-blue-700" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Horario</h3>
                <p className="text-sm text-muted-foreground">Ver mis turnos</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Status Info */}
        <div className="mt-8 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <p className="text-sm text-blue-900">
            <strong>Estado actual:</strong> {isClockedIn ? 'Fichado (entrada registrada)' : 'No fichado'}
          </p>
        </div>
    </EmployeeShellLayout>
  );
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
