import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Clock, LogOut, Calendar, AlertCircle, CalendarDays, Palmtree, Pause, Play } from 'lucide-react';
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
import {
  APP_TIMEZONE,
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getDayOfWeekInTimeZone,
  getMinutesSinceMidnightInTimeZone,
  resolveAppTimeZone,
  todayYmdInTimeZone,
} from "@shared/timezone";
import EmployeeBottomMenu from '@/components/EmployeeBottomMenu';
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
  const { employeeSession, setEmployeeSession, clearAllSessions } = useAuthContext();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();
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
  const [isWorkDay, setIsWorkDay] = useState(true);
  const [lastClockOut, setLastClockOut] = useState<Date | null>(null);
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
    const todayExit = timeclocks
      .filter((entry) => {
        if (!entry.exitTime) return false;
        const exitYmd = todayYmdInTimeZone(appTimeZone, new Date(entry.exitTime));
        return exitYmd === todayYmd;
      })
      .sort((a, b) => new Date(b.exitTime || 0).getTime() - new Date(a.exitTime || 0).getTime())[0];
    setLastClockOut(todayExit?.exitTime ? new Date(todayExit.exitTime) : null);
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
      return;
    }

    const scheduleKey = weekdayKeys[getDayOfWeekInTimeZone(currentTime, appTimeZone)];
    const daySchedule =
      employeeScheduleQuery.data?.[scheduleKey] ?? employeeSession?.schedule?.[scheduleKey];
    const entry1 = daySchedule?.entry1 || null;
    const entry2 = daySchedule?.entry2 || null;
    const dayActive = daySchedule?.isActive ?? true;
    const isSameDayClockOut =
      lastClockOut &&
      lastClockOut.getFullYear() === currentTime.getFullYear() &&
      lastClockOut.getMonth() === currentTime.getMonth() &&
      lastClockOut.getDate() === currentTime.getDate();

    setIsWorkDay(dayActive);
    if (!dayActive) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
      return;
    }

    const entryTime = isSameDayClockOut && entry2 ? entry2 : entry1;

    if (!entryTime) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
      return;
    }

    const parsed = parseScheduleEntryTime(entryTime);
    if (!parsed) {
      setIsLate(false);
      setIsTooEarly(false);
      setScheduledEntryLabel(null);
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
    lastClockOut,
    appTimeZone,
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

  const handleLogout = async () => {
    try {
      await logoutSession.mutateAsync();
    } catch {
      // ignore
    }
    clearAllSessions();
    setEmployeeSession(null);
    setLocation('/');
  };

  if (employeeSession?.needsPrivacyNotice) {
    return (
      <div className="min-h-screen bg-slate-900/40 flex items-center justify-center p-4">
        <EmployeePrivacyNotice embedded />
      </div>
    );
  }

  const canClockIn = !isClockedIn && !loading && isWorkDay && !isLate && !isTooEarly;
  const canClockOut = isClockedIn && !loading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <Clock className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">TimeClock</h1>
          </div>
          <Button
            onClick={handleLogout}
            variant="ghost"
            className="flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Cerrar Sesión
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8 pb-28 md:pb-8">
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
        <Card className="mb-8 p-6 border-2 border-accent/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground mb-2">Estado de Ubicación</h2>
              <p className={`text-sm ${locationEnabled ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                {locationEnabled
                  ? 'Se validará tu ubicación al pulsar Entrada o Salida'
                  : 'Fichaje sin geolocalización (configuración de tu empresa)'}
              </p>
              {!isWorkDay && (
                <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
                  Día no laborable
                </p>
              )}
              {isTooEarly && isWorkDay && scheduledEntryLabel && !isClockedIn && (
                <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
                  Fichaje disponible desde {EARLY_CLOCK_MINUTES} min antes de las {scheduledEntryLabel}
                </p>
              )}
              {isLate && isWorkDay && !isClockedIn && (
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
            className="btn-primary h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2"
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
            className="h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2 border-2"
          >
            {isPaused ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
            {isPaused ? "Reanudar" : "Pausa"}
          </Button>

          <Button
            onClick={handleClockOut}
            disabled={!canClockOut}
            className="btn-secondary h-24 text-lg font-semibold flex flex-col items-center justify-center gap-2"
          >
            <Clock className="w-6 h-6" />
            Salida
          </Button>
        </div>

        {/* Incident Button */}
        <Button
          onClick={handleIncident}
          variant="outline"
          className="w-full mb-8 h-16 text-lg font-semibold flex items-center justify-center gap-2"
        >
          <AlertCircle className="w-5 h-5" />
          Reportar Incidencia
        </Button>

        {/* Quick Links */}
        <div className="hidden md:grid md:grid-cols-3 gap-4">
          <Card
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setLocation('/employee/time-off')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-teal-100 dark:bg-teal-900/30 rounded-lg">
                <Palmtree className="w-6 h-6 text-teal-700 dark:text-teal-300" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Vacaciones / días libres</h3>
                <p className="text-sm text-muted-foreground">Solicitar con antelación</p>
              </div>
            </div>
          </Card>
          <Card
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setLocation('/employee/calendar')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Calendario y Calculadora</h3>
                <p className="text-sm text-muted-foreground">Ver mis horas</p>
              </div>
            </div>
          </Card>
          <Card
            className="p-6 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setLocation('/employee/schedule')}
          >
            <div className="flex items-center gap-4">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
                <CalendarDays className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">Horario</h3>
                <p className="text-sm text-muted-foreground">Ver mis turnos</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Status Info */}
        <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Estado actual:</strong> {isClockedIn ? 'Fichado (entrada registrada)' : 'No fichado'}
          </p>
        </div>
      </main>

      <EmployeeBottomMenu />
    </div>
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
