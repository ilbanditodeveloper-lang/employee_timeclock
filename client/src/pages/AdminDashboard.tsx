import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { MapPin, Users, Calendar, AlertCircle, Clock3, Palmtree, Scale, ClipboardList, ChevronDown, LayoutDashboard, Settings, Plus, ArrowLeft, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import RestaurantMap, { geocodeAddressString } from '@/components/RestaurantMap';
import { trpc } from '@/lib/trpc';
import { useAuthContext } from '@/contexts/AuthContext';
import { adminApiInput } from '@/lib/adminContext';
import { Calendar as UiCalendar, CalendarDayButton } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, subMonths } from 'date-fns';
import AdminLegalPanel from '@/components/AdminLegalPanel';
import AdminAuditLogPanel from '@/components/AdminAuditLogPanel';
import OnboardingReminderBanner from '@/components/OnboardingReminderBanner';
import LegalReacceptanceBanner from '@/components/LegalReacceptanceBanner';
import SubscriptionBanner from '@/components/SubscriptionBanner';
import AdminBillingPanel from '@/components/AdminBillingPanel';
import AdminSupportPanel from '@/components/AdminSupportPanel';
import AdminNotificationsBell from '@/components/AdminNotificationsBell';
import AdminTodayActivityPanel from '@/components/AdminTodayActivityPanel';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import AppShellLayout, { type AppShellNavItem } from '@/components/AppShellLayout';
import { Badge } from '@/components/ui/badge';
import { calendarMonthRange } from '@shared/laborReport';
import {
  formatDateInTimeZone,
  formatTimeInTimeZone,
  getTimePartsInTimeZone,
  resolveAppTimeZone,
} from '@shared/timezone';
import {
  downloadEmployeeDataJson,
  downloadEnhancedLaborReportExcel,
  downloadEnhancedLaborReportPdf,
  downloadLaborReportCsv,
  downloadOfficialLaborReportPdf,
} from '@/lib/laborReportExport';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  createEmptySchedule,
  createDefaultEmployeeSchedule,
  loadDefaultSchedule,
  saveDefaultSchedule,
  type WeekSchedule,
} from '@shared/scheduleDefaults';
import { validateEmployeeEmailOrPhone } from '@shared/employeeContact';

const scheduleDays = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
] as const;

const ADMIN_NAV: AppShellNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'employees', label: 'Empleados', icon: Users },
  { id: 'hours', label: 'Horas', icon: Calendar },
  { id: 'shifts', label: 'Turnos', icon: Clock3 },
  { id: 'timeoff', label: 'Vacaciones', icon: Palmtree },
  { id: 'incidents', label: 'Incidencias', icon: AlertCircle },
  { id: 'audit', label: 'Auditoría', icon: ClipboardList },
  { id: 'legal', label: 'Legal / RGPD', icon: Scale },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeOffCalMonth, setTimeOffCalMonth] = useState(() => new Date());
  
  // Restaurant form state
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [latitude, setLatitude] = useState(40.7128);
  const [longitude, setLongitude] = useState(-74.006);
  const [radiusMeters, setRadiusMeters] = useState(100);

  // Employee form state
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeeUsername, setEmployeeUsername] = useState('');
  const [employeePassword, setEmployeePassword] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeeContractType, setEmployeeContractType] = useState<
    'full_time' | 'part_time' | 'temporary' | 'other'
  >('full_time');
  const [employeeWeeklyHours, setEmployeeWeeklyHours] = useState('');
  const [employeeNationalId, setEmployeeNationalId] = useState('');
  const [lateGraceMinutes, setLateGraceMinutes] = useState('5');
  const [editingEmployeeId, setEditingEmployeeId] = useState<number | null>(null);
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [workedHours, setWorkedHours] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [incidentEmployeeId, setIncidentEmployeeId] = useState('');
  const [editingTimeclockId, setEditingTimeclockId] = useState<number | null>(null);
  const [editingEntryTime, setEditingEntryTime] = useState('');
  const [editingExitTime, setEditingExitTime] = useState('');
  const [editingCorrectionReason, setEditingCorrectionReason] = useState('');
  const [includeAuditHistory, setIncludeAuditHistory] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [forceClockOutTarget, setForceClockOutTarget] = useState<{
    timeclockId: number;
    employeeName: string;
    entryTime: string | null;
  } | null>(null);
  const [forceClockOutExitTime, setForceClockOutExitTime] = useState('');
  const [forceClockOutReason, setForceClockOutReason] = useState(
    'Empleado terminó jornada sin fichar salida'
  );

  const trpcUtils = trpc.useUtils();
  const [employeeSchedule, setEmployeeSchedule] = useState<WeekSchedule>(() => createDefaultEmployeeSchedule());
  const [shiftEmployeeId, setShiftEmployeeId] = useState('');
  const [shiftSchedule, setShiftSchedule] = useState<WeekSchedule>(() => createEmptySchedule());
  const [scheduleSectionOpen, setScheduleSectionOpen] = useState(false);

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    String(i).padStart(2, '0')
  );
  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    String(i).padStart(2, '0')
  );

  const parseTime = (value: string) => {
    if (!value) return { hour: '', minute: '' };
    const [hour, minute] = value.split(':');
    return { hour: hour || '', minute: minute || '' };
  };

  const buildTime = (hour: string, minute: string) => {
    if (!hour && !minute) return '';
    const normalizedHour = hour || '00';
    const normalizedMinute = minute || '00';
    return `${normalizedHour}:${normalizedMinute}`;
  };

  const updateScheduleTime = (
    day: keyof typeof employeeSchedule,
    field: 'entry1' | 'entry2',
    hour: string,
    minute: string
  ) => {
    handleScheduleChange(day, field, buildTime(hour, minute));
  };

  const salaryTotal = (() => {
    const hours = Number(workedHours);
    const rate = Number(hourlyRate);
    if (Number.isNaN(hours) || Number.isNaN(rate)) return 0;
    return Math.max(hours, 0) * Math.max(rate, 0);
  })();

  const splitDateTimeInput = (value: string) => {
    if (!value) return { date: '', time: '' };
    const [date = '', time = ''] = value.split('T');
    return { date, time: time.slice(0, 5) };
  };

  const buildDateTimeInput = (date: string, time: string) => {
    if (!date && !time) return '';
    if (!date) return '';
    if (!time) return `${date}T00:00`;
    return `${date}T${time}`;
  };

  const { adminSession, setAdminSession, clearAllSessions, isAdminAuthenticated, isAuthLoading } = useAuthContext();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();

  const adminInput = adminApiInput();
  const onboardingQuery = trpc.publicApi.getOnboardingStatus.useQuery(adminInput, {
    enabled: isAdminAuthenticated,
  });
  const appTimeZone = resolveAppTimeZone(onboardingQuery.data?.company?.timezone);

  const formatDateTimeInput = (value?: string | Date | null) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const { year, month, day, hour, minute } = getTimePartsInTimeZone(date, appTimeZone);
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}`;
  };

  const formatClockTime = (iso: string | Date | null | undefined) => {
    if (!iso) return '—';
    return formatTimeInTimeZone(new Date(iso), appTimeZone);
  };

  const formatClockDateShort = (iso: string | Date | null | undefined) => {
    if (!iso) return '';
    return formatDateInTimeZone(new Date(iso), appTimeZone, {
      weekday: undefined,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getRestaurant = trpc.publicApi.getRestaurant.useQuery(adminInput, {
    enabled: isAdminAuthenticated,
  });
  const upsertRestaurant = trpc.publicApi.upsertRestaurant.useMutation();
  const createEmployee = trpc.publicApi.createEmployee.useMutation();
  const listEmployees = trpc.publicApi.listEmployees.useQuery(
    { ...adminApiInput() },
    { enabled: isAdminAuthenticated }
  );
  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    {
      employeeId: editingEmployeeId ?? 0,
    },
    { enabled: isAdminAuthenticated && Boolean(editingEmployeeId) }
  );
  const shiftScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    {
      employeeId: shiftEmployeeId ? Number(shiftEmployeeId) : 0,
    },
    { enabled: isAdminAuthenticated && Boolean(shiftEmployeeId) }
  );
  const updateEmployee = trpc.publicApi.updateEmployee.useMutation();
  const updateEmployeeSchedule = trpc.publicApi.updateEmployeeSchedule.useMutation();
  const listIncidents = trpc.publicApi.listIncidents.useQuery(
    { ...adminApiInput() },
    { enabled: isAdminAuthenticated }
  );
  const timeclocksQuery = trpc.publicApi.listTimeclocks.useQuery(
    { ...adminApiInput() },
    { enabled: isAdminAuthenticated }
  );
  const updateTimeclock = trpc.publicApi.updateTimeclock.useMutation();
  const adminForceClockOut = trpc.publicApi.adminForceClockOut.useMutation();
  const deactivateEmployee = trpc.publicApi.deactivateEmployee.useMutation();
  const sendTestNotification = trpc.publicApi.sendTestNotification.useMutation();
  const clearAllIncidents = trpc.publicApi.clearAllIncidents.useMutation();
  const decideIncident = trpc.publicApi.decideIncident.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "approved" ? "Incidencia aprobada" : "Incidencia rechazada"
      );
      void listIncidents.refetch();
      void trpcUtils.publicApi.getAdminNotificationCenter.invalidate();
    },
    onError: (error) => toast.error(error.message || "No se pudo actualizar la incidencia"),
  });
  const timeOffPendingQuery = trpc.publicApi.listTimeOffRequests.useQuery(
    { ...adminApiInput(), status: 'pending' },
    { enabled: isAdminAuthenticated }
  );
  const timeOffAllQuery = trpc.publicApi.listTimeOffRequests.useQuery(
    { ...adminApiInput(), status: 'all' },
    { enabled: isAdminAuthenticated }
  );
  const timeOffCalendarQuery = trpc.publicApi.getTimeOffCalendarMonth.useQuery(
    {
      ...adminApiInput(),
      year: timeOffCalMonth.getFullYear(),
      month: timeOffCalMonth.getMonth() + 1,
    },
    { enabled: isAdminAuthenticated }
  );
  const workforceTodayQuery = trpc.publicApi.getTodayWorkforceStatus.useQuery(adminApiInput(), {
    enabled: isAdminAuthenticated,
    refetchInterval: activeTab === 'dashboard' ? 30_000 : false,
  });
  const decideTimeOff = trpc.publicApi.decideTimeOffRequest.useMutation({
    onSuccess: () => {
      toast.success('Solicitud actualizada');
      void timeOffPendingQuery.refetch();
      void timeOffAllQuery.refetch();
      void timeOffCalendarQuery.refetch();
    },
    onError: () => toast.error('No se pudo actualizar la solicitud'),
  });
  const adminDeleteTimeOff = trpc.publicApi.adminDeleteTimeOffRequest.useMutation({
    onSuccess: () => {
      toast.success('Solicitud anulada');
      void timeOffPendingQuery.refetch();
      void timeOffAllQuery.refetch();
      void timeOffCalendarQuery.refetch();
    },
    onError: () => toast.error('No se pudo anular la solicitud'),
  });

  const filteredTimeclocks = (timeclocksQuery.data || [])
    .filter((entry) =>
      selectedEmployeeId ? String(entry.employeeId) === selectedEmployeeId : true
    )
    .filter((entry) => {
    if (!rangeStart && !rangeEnd) return true;
    const entryDate = new Date(entry.entryTime || entry.createdAt);
    if (rangeStart) {
      const start = new Date(rangeStart);
      start.setHours(0, 0, 0, 0);
      if (entryDate < start) return false;
    }
    if (rangeEnd) {
      const end = new Date(rangeEnd);
      end.setHours(23, 59, 59, 999);
      if (entryDate > end) return false;
    }
    return true;
  });

  const employeeNameById = new Map(
    (listEmployees.data || []).map((employee) => [employee.id, employee.name])
  );

  const timeOffCellApproved = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const day of timeOffCalendarQuery.data?.days ?? []) {
      const names = Array.from(
        new Set(day.entries.filter((e) => e.status === 'approved').map((e) => e.employeeName))
      );
      if (names.length) m.set(day.date, names);
    }
    return m;
  }, [timeOffCalendarQuery.data?.days]);

  const timeOffCellPending = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const day of timeOffCalendarQuery.data?.days ?? []) {
      const names = Array.from(
        new Set(day.entries.filter((e) => e.status === 'pending').map((e) => e.employeeName))
      );
      if (names.length) m.set(day.date, names);
    }
    return m;
  }, [timeOffCalendarQuery.data?.days]);

  const getRangeBounds = () => {
    const start = rangeStart ? new Date(rangeStart) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = rangeEnd ? new Date(rangeEnd) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const isDateInsideSelectedRange = (value?: string | Date | null) => {
    if (!rangeStart && !rangeEnd) return true;
    if (!value) return false;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return false;
    const { start, end } = getRangeBounds();
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  };

  const toYmd = (value?: string | Date | null) => {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return format(d, 'yyyy-MM-dd');
  };

  const rangeStartYmd = rangeStart || '';
  const rangeEndYmd = rangeEnd || '';

  const filteredIncidentsForReport = (listIncidents.data || [])
    .filter((incident) =>
      selectedEmployeeId ? String(incident.employeeId) === selectedEmployeeId : true
    )
    .filter((incident) => isDateInsideSelectedRange(incident.createdAt));

  const filteredTimeOffForReport = (timeOffAllQuery.data || [])
    .filter((row) =>
      selectedEmployeeId ? String(row.employeeId) === selectedEmployeeId : true
    )
    .filter((row) => {
      const rowStart = toYmd(row.startDate);
      const rowEnd = toYmd(row.endDate);
      if (!rowStart || !rowEnd) return false;
      if (!rangeStartYmd && !rangeEndYmd) return true;
      if (rangeStartYmd && rowEnd < rangeStartYmd) return false;
      if (rangeEndYmd && rowStart > rangeEndYmd) return false;
      return true;
    });

  const hasReportData =
    filteredTimeclocks.length > 0 ||
    filteredTimeOffForReport.length > 0 ||
    filteredIncidentsForReport.length > 0;

  const reportContextLabel = () => {
    const employeeLabel = selectedEmployeeId
      ? employeeNameById.get(Number(selectedEmployeeId)) || `Empleado #${selectedEmployeeId}`
      : 'Todos los empleados';
    const rangeLabel =
      rangeStart || rangeEnd
        ? `${rangeStart || 'Inicio'} → ${rangeEnd || 'Hoy'}`
        : 'Sin filtro de fechas';
    return { employeeLabel, rangeLabel };
  };

  const getReportDateRange = () => {
    const from = rangeStart || format(subMonths(new Date(), 1), 'yyyy-MM-dd');
    const to = rangeEnd || format(new Date(), 'yyyy-MM-dd');
    return { from, to };
  };

  const fetchReportBundle = async (withAudit?: boolean, official?: boolean) => {
    const { from, to } = getReportDateRange();
    return trpcUtils.publicApi.getLaborReportBundle.fetch({
      ...adminApiInput(),
      employeeId: selectedEmployeeId ? Number(selectedEmployeeId) : undefined,
      dateFrom: from,
      dateTo: to,
      includeAuditHistory: withAudit ?? includeAuditHistory,
      officialExport: official ?? false,
    });
  };

  const buildReportExtras = () => {
    const timeOffRows = filteredTimeOffForReport.map((row) => ({
      Empleado: row.employeeName || employeeNameById.get(row.employeeId) || `#${row.employeeId}`,
      Tipo: row.kind === 'vacation' ? 'Vacaciones' : 'Día libre',
      Desde: toYmd(row.startDate),
      Hasta: toYmd(row.endDate),
      Estado:
        row.status === 'approved' ? 'Aprobada' : row.status === 'rejected' ? 'Denegada' : 'Pendiente',
      Comentario: row.comment || '',
    }));
    const incidentRows = filteredIncidentsForReport.map((incident) => ({
      Empleado: employeeNameById.get(incident.employeeId) || `#${incident.employeeId}`,
      Tipo:
        incident.type === 'late_arrival'
          ? 'Retraso entrada'
          : incident.type === 'early_exit'
          ? 'Salida temprana'
          : 'Otra',
      Estado:
        incident.status === 'approved'
          ? 'Aprobada'
          : incident.status === 'rejected'
          ? 'Denegada'
          : 'Pendiente',
      Motivo: incident.reason,
      Fecha: incident.createdAt ? new Date(incident.createdAt).toLocaleString('es-ES') : '',
    }));
    const timeOffPdf = filteredTimeOffForReport.map((row) => [
      row.employeeName || employeeNameById.get(row.employeeId) || `#${row.employeeId}`,
      row.kind === 'vacation' ? 'Vacaciones' : 'Día libre',
      toYmd(row.startDate),
      toYmd(row.endDate),
      row.status === 'approved' ? 'Aprobada' : row.status === 'rejected' ? 'Denegada' : 'Pendiente',
      row.comment || '',
    ]);
    const incidentPdf = filteredIncidentsForReport.map((incident) => [
      employeeNameById.get(incident.employeeId) || `#${incident.employeeId}`,
      incident.type === 'late_arrival'
        ? 'Retraso entrada'
        : incident.type === 'early_exit'
        ? 'Salida temprana'
        : 'Otra',
      incident.status === 'approved' ? 'Aprobada' : incident.status === 'rejected' ? 'Denegada' : 'Pendiente',
      incident.reason || '',
      incident.createdAt ? new Date(incident.createdAt).toLocaleString('es-ES') : '',
    ]);
    return { timeOffRows, incidentRows, timeOffPdf, incidentPdf };
  };

  const runExport = async (kind: 'csv' | 'official-pdf' | 'excel' | 'pdf') => {
    if (!hasReportData && kind !== 'csv') {
      toast.error('No hay datos para exportar con los filtros actuales');
      return;
    }
    setExportBusy(true);
    try {
      const bundle = await fetchReportBundle(true, kind === 'official-pdf');
      if (bundle.rows.length === 0 && !filteredTimeOffForReport.length && !filteredIncidentsForReport.length) {
        toast.error('No hay fichajes en el periodo seleccionado');
        return;
      }
      const extras = buildReportExtras();
      if (kind === 'csv') {
        downloadLaborReportCsv(bundle);
        toast.success('CSV descargado');
      } else if (kind === 'official-pdf') {
        downloadOfficialLaborReportPdf(bundle);
        toast.success('Informe registro horario descargado');
      } else if (kind === 'excel') {
        downloadEnhancedLaborReportExcel(bundle, extras);
        toast.success('Excel descargado');
      } else {
        downloadEnhancedLaborReportPdf(bundle, {
          timeOffRows: extras.timeOffPdf,
          incidentRows: extras.incidentPdf,
        });
        toast.success('PDF descargado');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al exportar');
    } finally {
      setExportBusy(false);
    }
  };

  const exportReportsToExcel = () => runExport('excel');
  const exportReportsToPdf = () => runExport('pdf');
  const exportOfficialPdf = () => runExport('official-pdf');
  const exportCsv = () => runExport('csv');

  const setMonthRange = (offsetMonths: number) => {
    const d = new Date();
    d.setMonth(d.getMonth() + offsetMonths);
    const range = calendarMonthRange(d.getFullYear(), d.getMonth() + 1);
    setRangeStart(range.from);
    setRangeEnd(range.to);
  };

  const handleExportEmployeeData = async (employeeId: number, employeeName: string) => {
    try {
      const data = await trpcUtils.publicApi.exportEmployeeData.fetch({
        ...adminApiInput(),
        employeeId,
      });
      downloadEmployeeDataJson(data, employeeName);
      toast.success('Exportación JSON descargada');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo exportar');
    }
  };

  const handleDeactivateEmployee = (employee: { id: number; name: string; isActive?: boolean }) => {
    if (employee.isActive === false) {
      toast.info('Este empleado ya está inactivo');
      return;
    }
    const reason = window.prompt(
      `Motivo de desactivación de ${employee.name} (opcional, mín. 3 caracteres si se indica):`
    );
    if (reason === null) return;
    if (reason.trim().length > 0 && reason.trim().length < 3) {
      toast.error('El motivo debe tener al menos 3 caracteres');
      return;
    }
    deactivateEmployee
      .mutateAsync({
        ...adminApiInput(),
        employeeId: employee.id,
        reason: reason.trim() || undefined,
      })
      .then(() => {
        toast.success('Empleado desactivado. Sus fichajes se conservan (mín. 4 años).');
        listEmployees.refetch();
      })
      .catch((error) => toast.error(error?.message || 'No se pudo desactivar'));
  };

  const timeclockStatusBadge = (entry: { status?: string; exitTime?: string | Date | null }) => {
    if (entry.status === 'voided') {
      return <Badge variant="destructive">Anulado</Badge>;
    }
    if (entry.status === 'corrected') {
      return <Badge variant="secondary">Corregido</Badge>;
    }
    if (!entry.exitTime) {
      return <Badge variant="outline">Incompleto</Badge>;
    }
    return null;
  };

  const totalHours = filteredTimeclocks.reduce((total, entry) => {
    if (entry.status === 'voided') return total;
    if (!entry.entryTime || !entry.exitTime) return total;
    const start = new Date(entry.entryTime).getTime();
    const end = new Date(entry.exitTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return total;
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  const handleScheduleChange = (
    day: keyof typeof employeeSchedule,
    field: 'entry1' | 'entry2',
    value: string
  ) => {
    setEmployeeSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value,
      },
    }));
  };

  const handleScheduleToggle = (day: keyof typeof employeeSchedule) => {
    setEmployeeSchedule(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isActive: !prev[day].isActive,
      },
    }));
  };

  const handleShiftTypeChange = (
    day: keyof typeof shiftSchedule,
    shiftType: 'split' | 'morning' | 'afternoon' | 'off'
  ) => {
    if (shiftType === 'off') {
      setShiftSchedule(prev => ({
        ...prev,
        [day]: { entry1: '', entry2: '', exit1: '', exit2: '', isActive: false },
      }));
      return;
    }
    if (shiftType === 'split') {
      setShiftSchedule(prev => ({
        ...prev,
        [day]: {
          entry1: '09:00',
          exit1: '16:00',
          entry2: '16:00',
          exit2: '22:00',
          isActive: true,
        },
      }));
      return;
    }
    if (shiftType === 'morning') {
      setShiftSchedule(prev => ({
        ...prev,
        [day]: { entry1: '09:00', entry2: '', exit1: '17:00', exit2: '', isActive: true },
      }));
      return;
    }
    setShiftSchedule(prev => ({
      ...prev,
      [day]: { entry1: '16:00', entry2: '', exit1: '22:00', exit2: '', isActive: true },
    }));
  };

  const getShiftType = (day: keyof typeof shiftSchedule): 'split' | 'morning' | 'afternoon' | 'off' => {
    const value = shiftSchedule[day];
    if (!value.isActive || (!value.entry1 && !value.entry2)) return 'off';
    if (value.entry1 && value.entry2) return 'split';
    const hour = Number((value.entry1 || '0').split(':')[0]);
    return hour >= 14 ? 'afternoon' : 'morning';
  };

  const handleSaveEmployeeShifts = () => {
    if (!shiftEmployeeId) {
      toast.error('Selecciona un empleado');
      return;
    }
    updateEmployeeSchedule
      .mutateAsync({
        ...adminApiInput(),
        employeeId: Number(shiftEmployeeId),
        schedule: shiftSchedule,
      })
      .then(() => {
        toast.success('Turnos guardados correctamente');
        shiftScheduleQuery.refetch();
      })
      .catch((error) => {
        toast.error('No se pudieron guardar los turnos');
        console.error(error);
      });
  };

  const handleEditTimeclock = (entry: { id: number; entryTime?: string | Date | null; exitTime?: string | Date | null }) => {
    setEditingTimeclockId(entry.id);
    setEditingEntryTime(formatDateTimeInput(entry.entryTime));
    setEditingExitTime(formatDateTimeInput(entry.exitTime));
  };

  const handleCancelTimeclockEdit = () => {
    setEditingTimeclockId(null);
    setEditingEntryTime('');
    setEditingExitTime('');
  };

  const handleAdminForceClockOut = (row: {
    timeclockId: number;
    employeeName: string;
    entryTime: string | null;
  }) => {
    setForceClockOutTarget(row);
    setForceClockOutExitTime(formatDateTimeInput(new Date()));
    setForceClockOutReason('Empleado terminó jornada sin fichar salida');
  };

  const closeForceClockOutDialog = () => {
    if (adminForceClockOut.isPending) return;
    setForceClockOutTarget(null);
  };

  const submitAdminForceClockOut = () => {
    if (!forceClockOutTarget) return;
    if (!forceClockOutReason.trim() || forceClockOutReason.trim().length < 3) {
      toast.error('Indica un motivo de al menos 3 caracteres');
      return;
    }
    if (!forceClockOutExitTime) {
      toast.error('Indica la hora de salida');
      return;
    }
    const exitDate = new Date(forceClockOutExitTime);
    if (Number.isNaN(exitDate.getTime())) {
      toast.error('Hora de salida inválida');
      return;
    }
    if (forceClockOutTarget.entryTime) {
      const entryDate = new Date(forceClockOutTarget.entryTime);
      if (!Number.isNaN(entryDate.getTime()) && exitDate <= entryDate) {
        toast.error('La salida debe ser posterior a la entrada');
        return;
      }
    }
    adminForceClockOut
      .mutateAsync({
        ...adminApiInput(),
        timeclockId: forceClockOutTarget.timeclockId,
        exitTime: exitDate.toISOString(),
        reason: forceClockOutReason.trim(),
      })
      .then(() => {
        toast.success(`Salida registrada para ${forceClockOutTarget.employeeName}`);
        setForceClockOutTarget(null);
        void workforceTodayQuery.refetch();
        void timeclocksQuery.refetch();
        void trpcUtils.publicApi.getAdminTodayActivity.invalidate();
      })
      .catch((error) => {
        toast.error(error?.message || 'No se pudo registrar la salida');
      });
  };

  const handleSaveTimeclock = () => {
    if (!editingTimeclockId) return;
    if (!editingEntryTime) {
      toast.error('La hora de entrada es obligatoria');
      return;
    }
    if (!editingCorrectionReason || editingCorrectionReason.trim().length < 3) {
      toast.error('Indica el motivo de la corrección (mínimo 3 caracteres)');
      return;
    }
    if (editingExitTime) {
      const entryDate = new Date(editingEntryTime);
      const exitDate = new Date(editingExitTime);
      if (Number.isNaN(entryDate.getTime()) || Number.isNaN(exitDate.getTime())) {
        toast.error('Formato de fecha inválido');
        return;
      }
      if (exitDate <= entryDate) {
        toast.error('La salida debe ser posterior a la entrada');
        return;
      }
    }
    updateTimeclock
      .mutateAsync({
        ...adminApiInput(),
        timeclockId: editingTimeclockId,
        entryTime: editingEntryTime ? new Date(editingEntryTime).toISOString() : undefined,
        exitTime: editingExitTime ? new Date(editingExitTime).toISOString() : null,
        correctionReason: editingCorrectionReason.trim(),
      })
      .then(() => {
        toast.success('Fichaje actualizado (queda registrado en auditoría)');
        handleCancelTimeclockEdit();
        setEditingCorrectionReason('');
        timeclocksQuery.refetch();
      })
      .catch((error) => {
        toast.error(error?.message || 'No se pudo actualizar el fichaje');
        console.error(error);
      });
  };

  const handleSendTestNotification = () => {
    if (!selectedEmployeeId) {
      toast.error('Selecciona un empleado primero');
      return;
    }
    sendTestNotification
      .mutateAsync({
        ...adminApiInput(),
        employeeId: Number(selectedEmployeeId),
      })
      .then((result) => {
        toast.success(`Notificación enviada (${result.sent} ok${result.failed ? `, ${result.failed} fallidas` : ''})`);
      })
      .catch((error) => {
        toast.error(error?.message || 'No se pudo enviar la notificación');
        console.error(error);
      });
  };

  const handleClearAllIncidents = () => {
    const confirmed = window.confirm(
      'Esto borrará TODAS las incidencias de tus empleados. ¿Quieres continuar?'
    );
    if (!confirmed) return;

    clearAllIncidents
      .mutateAsync({ ...adminApiInput() })
      .then(() => {
        toast.success('Todas las incidencias se han borrado');
        listIncidents.refetch();
      })
      .catch((error) => {
        toast.error('No se pudieron borrar las incidencias');
        console.error(error);
      });
  };

  const handleLogout = async () => {
    try {
      await logoutSession.mutateAsync();
    } catch {
      // ignore
    }
    clearAllSessions();
    setAdminSession(null);
    trpcUtils.publicApi.getSession.setData(undefined, { session: null });
    await trpcUtils.publicApi.getSession.invalidate();
    window.location.href = '/admin-login';
  };

  const handleSaveRestaurant = async () => {
    if (!restaurantName || !restaurantAddress) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    let lat = latitude;
    let lng = longitude;
    let address = restaurantAddress;

    try {
      const geocoded = await geocodeAddressString(restaurantAddress);
      if (geocoded) {
        lat = geocoded.lat;
        lng = geocoded.lng;
        address = geocoded.formattedAddress;
        setLatitude(lat);
        setLongitude(lng);
        setRestaurantAddress(address);
      }
    } catch {
      toast.error('No se pudo geocodificar la dirección. Confirma el pin en el mapa.');
      return;
    }

    const safeRadius = Math.max(radiusMeters, 50);
    if (safeRadius !== radiusMeters) {
      setRadiusMeters(safeRadius);
      toast.message('Radio mínimo 50 m aplicado (GPS puede variar unos metros).');
    }

    try {
      await upsertRestaurant.mutateAsync({
        ...adminApiInput(),
        name: restaurantName,
        address,
        latitude: lat,
        longitude: lng,
        radiusMeters: safeRadius,
      });
      toast.success('Restaurante guardado correctamente');
      void getRestaurant.refetch();
    } catch (error) {
      toast.error('Error al guardar restaurante');
      console.error(error);
    }
  };

  const handleCreateEmployee = () => {
    const contact = validateEmployeeEmailOrPhone(employeeEmail, employeePhone);
    if (
      !employeeName ||
      !contact.valid ||
      !employeeUsername ||
      (!editingEmployeeId && !employeePassword)
    ) {
      toast.error(
        contact.message ?? 'Completa nombre, usuario, contraseña y al menos email o teléfono de contacto'
      );
      return;
    }
    if (employeePassword && employeePassword.length < 6) {
      toast.error('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    const parsedGraceMinutes = Number(lateGraceMinutes);
    const graceMinutesValue = Number.isFinite(parsedGraceMinutes)
      ? Math.max(0, parsedGraceMinutes)
      : 5;
    const action = editingEmployeeId
      ? updateEmployee.mutateAsync({
          ...adminApiInput(),
          employeeId: editingEmployeeId,
          employeeName,
          employeeEmail: contact.normalizedEmail ?? '',
          employeeUsername,
          employeePassword: employeePassword || undefined,
          employeePhone: contact.normalizedPhone ?? '',
          lateGraceMinutes: graceMinutesValue,
          contractType: employeeContractType,
          weeklyContractedHours: employeeWeeklyHours ? Number(employeeWeeklyHours) : undefined,
          nationalId: employeeNationalId || undefined,
          schedule: employeeSchedule,
        })
      : createEmployee.mutateAsync({
          ...adminApiInput(),
          employeeName,
          employeeEmail: employeeEmail.trim().toLowerCase(),
          employeeUsername,
          employeePassword,
          employeePhone,
          lateGraceMinutes: graceMinutesValue,
          contractType: employeeContractType,
          weeklyContractedHours: employeeWeeklyHours ? Number(employeeWeeklyHours) : undefined,
          nationalId: employeeNationalId || undefined,
          schedule: employeeSchedule,
        });

    action
      .then(() => {
        toast.success(
          editingEmployeeId
            ? `Empleado ${employeeName} actualizado correctamente`
            : `Empleado ${employeeName} creado correctamente`
        );
        if (adminSession?.companySlug) {
          saveDefaultSchedule(adminSession.companySlug, employeeSchedule);
        }
        const nextSchedule = adminSession?.companySlug
          ? loadDefaultSchedule(adminSession.companySlug)
          : createDefaultEmployeeSchedule();
        setEmployeeName('');
        setEmployeeEmail('');
        setEmployeeUsername('');
        setEmployeePassword('');
        setEmployeePhone('');
        setEmployeeContractType('full_time');
        setEmployeeWeeklyHours('');
        setEmployeeNationalId('');
        setLateGraceMinutes('5');
        setEditingEmployeeId(null);
        setEmployeeSchedule(nextSchedule);
        setScheduleSectionOpen(false);
        setShowEmployeeForm(false);
        listEmployees.refetch();
      })
      .catch((error) => {
        toast.error(
          editingEmployeeId ? 'Error al actualizar empleado' : 'Error al crear empleado'
        );
        console.error(error);
      });
  };

  const resetEmployeeFormFields = () => {
    const nextSchedule = adminSession?.companySlug
      ? loadDefaultSchedule(adminSession.companySlug)
      : createDefaultEmployeeSchedule();
    setEmployeeName('');
    setEmployeeEmail('');
    setEmployeeUsername('');
    setEmployeePassword('');
    setEmployeePhone('');
    setLateGraceMinutes('5');
    setEditingEmployeeId(null);
    setEmployeeSchedule(nextSchedule);
    setScheduleSectionOpen(false);
  };

  const handleStartCreateEmployee = () => {
    resetEmployeeFormFields();
    setShowEmployeeForm(true);
  };

  const handleCancelEmployeeForm = () => {
    resetEmployeeFormFields();
    setShowEmployeeForm(false);
  };

  const handleEditEmployee = (employeeId: number) => {
    const employee = listEmployees.data?.find((item) => item.id === employeeId);
    if (!employee) return;
    setEditingEmployeeId(employeeId);
    setEmployeeName(employee.name);
    setEmployeeEmail(employee.email ?? '');
    setEmployeeUsername(employee.username);
    setEmployeePassword('');
    setEmployeePhone(employee.phone || '');
    setEmployeeContractType(
      (employee as { contractType?: typeof employeeContractType }).contractType ?? 'full_time'
    );
    setEmployeeWeeklyHours(
      (employee as { weeklyContractedHours?: string | null }).weeklyContractedHours ?? ''
    );
    setEmployeeNationalId((employee as { nationalId?: string | null }).nationalId ?? '');
    setLateGraceMinutes(String(employee.lateGraceMinutes ?? 5));
    setScheduleSectionOpen(true);
    setShowEmployeeForm(true);
  };

  useEffect(() => {
    if (employeeScheduleQuery.data) {
      setEmployeeSchedule({
        ...createEmptySchedule(),
        ...employeeScheduleQuery.data,
      });
    }
  }, [employeeScheduleQuery.data]);

  useEffect(() => {
    if (shiftScheduleQuery.data) {
      setShiftSchedule({
        ...createEmptySchedule(),
        ...shiftScheduleQuery.data,
      });
    } else {
      setShiftSchedule(createEmptySchedule());
    }
  }, [shiftScheduleQuery.data]);

  useEffect(() => {
    if (getRestaurant.data) {
      setRestaurantName(getRestaurant.data.name || '');
      setRestaurantAddress(getRestaurant.data.address || '');
      setLatitude(Number(getRestaurant.data.latitude));
      setLongitude(Number(getRestaurant.data.longitude));
      setRadiusMeters(getRestaurant.data.radiusMeters);
    }
  }, [getRestaurant.data]);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAdminAuthenticated) {
      setLocation('/admin-login');
      return;
    }
    const ob = onboardingQuery.data;
    if (!ob || ob.onboardingCompleted) return;
    if (!ob.onboardingSkippedAt) {
      setLocation('/admin/onboarding');
    }
  }, [isAdminAuthenticated, isAuthLoading, onboardingQuery.data, setLocation]);

  useEffect(() => {
    if (activeTab !== 'employees') {
      setShowEmployeeForm(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (!adminSession?.companySlug || editingEmployeeId) return;
    setEmployeeSchedule(loadDefaultSchedule(adminSession.companySlug));
  }, [adminSession?.companySlug, editingEmployeeId]);

  const showOnboardingBanner =
    Boolean(onboardingQuery.data) &&
    !onboardingQuery.data?.onboardingCompleted &&
    Boolean(onboardingQuery.data?.onboardingSkippedAt);

  const subscription = onboardingQuery.data?.subscription;
  const showTrialBanner = Boolean(subscription?.showTrialBanner && subscription.bannerMessage);
  const showLimitBanner = Boolean(subscription?.showLimitBanner && subscription.bannerMessage);
  const showBillingBanner = Boolean(subscription?.showBillingBanner && subscription.bannerMessage);
  const atEmployeeLimit = Boolean(subscription?.atEmployeeLimit);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('billing') === 'success') {
      toast.success('Pago completado. Tu plan se activará en unos segundos.');
      window.history.replaceState({}, '', '/admin');
      void onboardingQuery.refetch();
    } else if (params.get('billing') === 'cancel') {
      toast.message('Pago cancelado');
      window.history.replaceState({}, '', '/admin');
    }
  }, []);
  const activeNav = ADMIN_NAV.find((item) => item.id === activeTab);

  if (isAuthLoading || !isAdminAuthenticated) {
    return null;
  }

  return (
    <AppShellLayout
      brandLabel={adminSession?.displayName ?? adminSession?.companySlug ?? 'Mi negocio'}
      brandIcon={<LayoutDashboard className="size-5" />}
      pageTitle={activeNav?.label ?? 'Panel de administración'}
      pageSubtitle="Gestión de equipo y control horario"
      userName={adminSession?.displayName ?? 'Administrador'}
      userEmail={adminSession?.companySlug}
      navItems={ADMIN_NAV}
      activeNavId={activeTab}
      onNavChange={setActiveTab}
      onLogout={() => void handleLogout()}
      headerActions={
        <>
          <AdminNotificationsBell
            enabled={isAdminAuthenticated}
            onOpenTimeOff={() => setActiveTab('timeoff')}
            onOpenIncidents={() => setActiveTab('incidents')}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLocation('/admin/onboarding')}
          >
            Configuración inicial
          </Button>
        </>
      }
    >
      <LegalReacceptanceBanner />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="w-full space-y-6">
            {showOnboardingBanner && <OnboardingReminderBanner />}
            {showTrialBanner && subscription?.bannerMessage ? (
              <SubscriptionBanner message={subscription.bannerMessage} variant="trial" />
            ) : null}
            {showLimitBanner && subscription?.bannerMessage ? (
              <SubscriptionBanner message={subscription.bannerMessage} variant="limit" />
            ) : null}
            {showBillingBanner && subscription?.bannerMessage ? (
              <SubscriptionBanner message={subscription.bannerMessage} variant="billing" />
            ) : null}

          <TabsContent value="dashboard" className="mt-0 space-y-6">
            <Card className="app-shell-card p-6 border-0 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    Seguimiento en vivo · Estado del equipo hoy
                    {workforceTodayQuery.data?.date
                      ? ` · ${workforceTodayQuery.data.date.split('-').reverse().join('/')}`
                      : ''}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void workforceTodayQuery.refetch()}
                  disabled={workforceTodayQuery.isFetching}
                >
                  {workforceTodayQuery.isFetching ? 'Actualizando…' : 'Actualizar'}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <section className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-5">
                  <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
                    Trabajando ahora
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.working ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.working ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nadie fichado en este momento.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(workforceTodayQuery.data?.working ?? []).map((row) => (
                        <li
                          key={row.employeeId}
                          className="flex flex-col gap-2 rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{row.employeeName}</span>
                            <span className="block text-sm text-muted-foreground sm:inline sm:ml-2">
                              Entrada {formatClockTime(row.entryTime)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={adminForceClockOut.isPending}
                            onClick={() => handleAdminForceClockOut(row)}
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1" />
                            Fichar salida
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-5">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-amber-500" />
                    En pausa
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.onBreak ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.onBreak ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nadie en pausa.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(workforceTodayQuery.data?.onBreak ?? []).map((row) => (
                        <li
                          key={row.employeeId}
                          className="flex flex-col gap-2 rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-background/80 px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <span className="font-medium text-foreground">{row.employeeName}</span>
                            <span className="block text-sm text-muted-foreground sm:inline sm:ml-2">
                              Entrada {formatClockTime(row.entryTime)} · En pausa
                            </span>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={adminForceClockOut.isPending}
                            onClick={() => handleAdminForceClockOut(row)}
                          >
                            <LogOut className="w-3.5 h-3.5 mr-1" />
                            Fichar salida
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/60 dark:bg-teal-950/20 p-5">
                  <h3 className="text-lg font-semibold text-teal-800 dark:text-teal-200 mb-3 flex items-center gap-2">
                    <Palmtree className="w-4 h-4" />
                    Vacaciones / libre hoy
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.onTimeOff ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.onTimeOff ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nadie de baja hoy.</p>
                  ) : (
                    <ul className="space-y-2">
                      {(workforceTodayQuery.data?.onTimeOff ?? []).map((row) => (
                        <li
                          key={row.employeeId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-teal-200/80 dark:border-teal-800/50 bg-background/80 px-3 py-2"
                        >
                          <span className="font-medium text-foreground">{row.employeeName}</span>
                          <span className="text-sm text-muted-foreground">
                            {row.kind === 'vacation' ? 'Vacaciones' : 'Día libre'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-border bg-muted/30 p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Sin fichar hoy
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.notClockedIn ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.notClockedIn ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">Todos han fichado o están de baja.</p>
                  ) : (
                    <ul className="flex flex-wrap gap-2">
                      {(workforceTodayQuery.data?.notClockedIn ?? []).map((row) => (
                        <li key={row.employeeId}>
                          <Badge variant="outline" className="text-sm py-1 px-2">
                            {row.employeeName}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {(workforceTodayQuery.data?.finishedToday ?? []).length > 0 ? (
                <section className="mt-6 rounded-xl border border-border p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-3">
                    Ya han terminado jornada hoy
                  </h3>
                  <ul className="space-y-2">
                    {(workforceTodayQuery.data?.finishedToday ?? []).map((row) => (
                      <li
                        key={row.employeeId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{row.employeeName}</span>
                        <span className="text-muted-foreground">
                          Salida {formatClockTime(row.exitTime)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <div className="mt-6">
                <AdminTodayActivityPanel />
              </div>
            </Card>
          </TabsContent>

          {/* Employees Tab */}
          <TabsContent value="employees" className="mt-0 space-y-6">
            <Card className="app-shell-card border-0 p-6 shadow-sm">
              {!showEmployeeForm ? (
                <>
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold text-foreground">Gestión de Empleados</h2>
                    <Button
                      type="button"
                      onClick={handleStartCreateEmployee}
                      className="btn-primary gap-2"
                      disabled={atEmployeeLimit}
                    >
                      <Plus className="size-4" />
                      Crear Empleado
                    </Button>
                  </div>
                  {atEmployeeLimit ? (
                    <p className="mb-4 text-xs text-muted-foreground">
                      Has alcanzado el límite de empleados de tu plan. La empresa será dada de baja
                      automáticamente.
                    </p>
                  ) : null}

                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">Empleados registrados</h3>
                    <p className="mb-4 text-xs text-muted-foreground">
                      Desactivar un empleado impide su acceso, pero conserva fichajes e historial (mínimo
                      4 años). Puede seguir exportando sus registros.
                    </p>
                    <div className="space-y-2">
                      {listEmployees.data?.length ? (
                        listEmployees.data.map((employee) => (
                          <div
                            key={employee.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-4"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-foreground">{employee.name}</p>
                                {employee.isActive === false ? (
                                  <Badge variant="secondary">Inactivo</Badge>
                                ) : (
                                  <Badge variant="outline">Activo</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Email: {employee.email || "—"} · Usuario: {employee.username}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEmployee(employee.id)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportEmployeeData(employee.id, employee.name)}
                              >
                                Exportar JSON
                              </Button>
                              {employee.isActive !== false && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeactivateEmployee(employee)}
                                  disabled={deactivateEmployee.isPending}
                                >
                                  Desactivar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">No hay empleados registrados.</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-6 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleCancelEmployeeForm}
                      className="gap-2"
                    >
                      <ArrowLeft className="size-4" />
                      Volver a la lista
                    </Button>
                    <h2 className="text-2xl font-bold text-foreground">
                      {editingEmployeeId ? "Editar empleado" : "Crear empleado"}
                    </h2>
                  </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre del Empleado
                  </label>
                  <input
                    type="text"
                    placeholder="Juan García"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Email de contacto
                  </label>
                  <input
                    type="email"
                    placeholder="empleado@empresa.com (opcional si hay teléfono)"
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Teléfono de contacto
                  </label>
                  <input
                    type="tel"
                    placeholder="+34 600 123 456 (opcional si hay email)"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="input-elegant"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Al menos uno: email o teléfono. Para fichar el empleado usa su usuario y contraseña.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Usuario para fichar
                  </label>
                  <input
                    type="text"
                    placeholder="juan.garcia"
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={employeePassword}
                    onChange={(e) => setEmployeePassword(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Teléfono (Opcional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+34 600 123 456"
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Tipo de contrato
                    </label>
                    <select
                      value={employeeContractType}
                      onChange={(e) =>
                        setEmployeeContractType(
                          e.target.value as 'full_time' | 'part_time' | 'temporary' | 'other'
                        )
                      }
                      className="input-elegant w-full"
                    >
                      <option value="full_time">Tiempo completo</option>
                      <option value="part_time">Tiempo parcial</option>
                      <option value="temporary">Temporal</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Horas semanales contratadas
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      placeholder="20"
                      value={employeeWeeklyHours}
                      onChange={(e) => setEmployeeWeeklyHours(e.target.value)}
                      className="input-elegant"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    DNI/NIE (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="12345678A"
                    value={employeeNationalId}
                    onChange={(e) => setEmployeeNationalId(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Minutos de gracia (retraso)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="5"
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(e.target.value)}
                    className="input-elegant"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tras estos minutos desde la hora de entrada, el botón de fichar se bloquea.
                  </p>
                </div>

                <Collapsible
                  open={scheduleSectionOpen}
                  onOpenChange={setScheduleSectionOpen}
                  className="border border-border rounded-lg"
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 rounded-lg">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Horario de entrada
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Se aplica al crear empleado y rellena turnos automáticamente (L–V 09:00 por defecto).
                      </p>
                    </div>
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                        scheduleSectionOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-4 pb-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    {scheduleDays.map(day => (
                      <div
                        key={day.key}
                        className="grid grid-cols-1 md:grid-cols-[120px,1fr,1fr,auto] gap-2 items-center"
                      >
                        <span className="text-sm text-foreground">
                          {day.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const time = parseTime(employeeSchedule[day.key].entry1);
                            return (
                              <>
                                <select
                                  className="input-elegant"
                                  value={time.hour}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry1', e.target.value, time.minute)
                                  }
                                >
                                  <option value="">HH</option>
                                  {hourOptions.map((hour) => (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground">:</span>
                                <select
                                  className="input-elegant"
                                  value={time.minute}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry1', time.hour, e.target.value)
                                  }
                                >
                                  <option value="">MM</option>
                                  {minuteOptions.map((minute) => (
                                    <option key={minute} value={minute}>
                                      {minute}
                                    </option>
                                  ))}
                                </select>
                              </>
                            );
                          })()}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleScheduleChange(day.key, 'entry1', '')}
                          >
                            Limpiar
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          {(() => {
                            const time = parseTime(employeeSchedule[day.key].entry2);
                            return (
                              <>
                                <select
                                  className="input-elegant"
                                  value={time.hour}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry2', e.target.value, time.minute)
                                  }
                                >
                                  <option value="">HH</option>
                                  {hourOptions.map((hour) => (
                                    <option key={hour} value={hour}>
                                      {hour}
                                    </option>
                                  ))}
                                </select>
                                <span className="text-muted-foreground">:</span>
                                <select
                                  className="input-elegant"
                                  value={time.minute}
                                  onChange={(e) =>
                                    updateScheduleTime(day.key, 'entry2', time.hour, e.target.value)
                                  }
                                >
                                  <option value="">MM</option>
                                  {minuteOptions.map((minute) => (
                                    <option key={minute} value={minute}>
                                      {minute}
                                    </option>
                                  ))}
                                </select>
                              </>
                            );
                          })()}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => handleScheduleChange(day.key, 'entry2', '')}
                          >
                            Limpiar
                          </Button>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={employeeSchedule[day.key].isActive}
                            onChange={() => handleScheduleToggle(day.key)}
                          />
                          Activo
                        </label>
                      </div>
                    ))}
                  </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button
                  onClick={handleCreateEmployee}
                  className="w-full btn-primary"
                  disabled={!editingEmployeeId && atEmployeeLimit}
                >
                  {editingEmployeeId ? "Guardar cambios" : "Crear Empleado"}
                </Button>
                {!editingEmployeeId && atEmployeeLimit ? (
                  <p className="text-xs text-muted-foreground">
                    Has alcanzado el límite de empleados de tu plan. La empresa será dada de baja automáticamente.
                  </p>
                ) : null}
              </div>
                </>
              )}
            </Card>
          </TabsContent>

          {/* Shifts Tab */}
          <TabsContent value="shifts" className="mt-0 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Configuración de Turnos</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Los empleados reciben notificaciones push 1 minuto antes y a la hora de entrada y salida según el turno guardado.
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar Empleado
                  </label>
                  <select
                    className="input-elegant"
                    value={shiftEmployeeId}
                    onChange={(event) => setShiftEmployeeId(event.target.value)}
                  >
                    <option value="">Selecciona un empleado</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {scheduleDays.map((day) => (
                  <div key={day.key} className="border border-border rounded-lg p-4 space-y-3">
                    <p className="font-medium text-foreground">{day.label}</p>
                    <div>
                      <label className="block text-xs text-muted-foreground mb-1">Tipo de turno</label>
                      <select
                        className="input-elegant"
                        value={getShiftType(day.key)}
                        onChange={(event) =>
                          handleShiftTypeChange(
                            day.key,
                            event.target.value as 'split' | 'morning' | 'afternoon' | 'off'
                          )
                        }
                      >
                        <option value="off">Día libre</option>
                        <option value="morning">Mañana</option>
                        <option value="afternoon">Tarde</option>
                        <option value="split">Turno Partido</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleSaveEmployeeShifts}
                className="w-full btn-primary"
                disabled={!shiftEmployeeId || updateEmployeeSchedule.isPending}
              >
                {updateEmployeeSchedule.isPending ? "Guardando..." : "Guardar turnos"}
              </Button>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours" className="mt-0 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Calendario de Horas</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar Empleado
                  </label>
                  <select
                    className="input-elegant"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    <option value="">Selecciona un empleado</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setMonthRange(0)} disabled={exportBusy}>
                    Mes actual
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMonthRange(-1)} disabled={exportBusy}>
                    Mes anterior
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportOfficialPdf}
                    disabled={exportBusy || !hasReportData}
                  >
                    Informe registro horario (PDF)
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportCsv}
                    disabled={exportBusy}
                  >
                    CSV gestoría
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportReportsToExcel}
                    disabled={exportBusy || !hasReportData}
                  >
                    Excel completo
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportReportsToPdf}
                    disabled={exportBusy || !hasReportData}
                  >
                    PDF completo
                  </Button>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                    <input
                      type="checkbox"
                      checked={includeAuditHistory}
                      onChange={(e) => setIncludeAuditHistory(e.target.checked)}
                    />
                    Incluir historial de cambios
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestNotification}
                    disabled={!selectedEmployeeId || sendTestNotification.isPending}
                  >
                    {sendTestNotification.isPending ? "Enviando..." : "Notificación de prueba"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Desde
                    </label>
                    <input
                      type="date"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      className="input-elegant"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Hasta
                    </label>
                    <input
                      type="date"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      className="input-elegant"
                    />
                  </div>
                </div>
              </div>

              {/* Calendar Display */}
              <Accordion type="single" collapsible defaultValue="hours-register">
                <AccordionItem value="hours-register">
                  <AccordionTrigger className="text-sm font-semibold text-foreground">
                    Registro de horas ({filteredTimeclocks.length} fichajes, {totalHours.toFixed(2)} h)
                  </AccordionTrigger>
                  <AccordionContent className="pt-2">
                    <div className="space-y-2">
                {filteredTimeclocks.length ? (
                  filteredTimeclocks.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-start justify-between gap-4 p-3 border border-border rounded-lg",
                        entry.status === "voided" && "opacity-70 bg-muted/40"
                      )}
                    >
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm text-foreground">
                            {employeeNameById.get(entry.employeeId) || `Empleado #${entry.employeeId}`}
                          </p>
                          {timeclockStatusBadge(entry)}
                          {entry.isLate && entry.status !== "voided" ? (
                            <Badge variant="outline" className="text-amber-700">
                              Tarde
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Entrada:{" "}
                          {entry.entryTime ? formatClockTime(entry.entryTime) : "Sin entrada"}
                          {" · "}
                          {entry.entryTime ? formatClockDateShort(entry.entryTime) : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Salida:{" "}
                          {entry.exitTime ? formatClockTime(entry.exitTime) : "Pendiente"}
                          {entry.exitTime ? ` · ${formatClockDateShort(entry.exitTime)}` : ""}
                        </p>
                        {(entry.correctionReason || entry.voidReason) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Motivo: {entry.correctionReason || entry.voidReason}
                          </p>
                        )}
                        {editingTimeclockId !== entry.id && entry.status !== "voided" && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditTimeclock(entry)}
                            >
                              {entry.exitTime ? "Modificar fichaje" : "Completar entrada o salida"}
                            </Button>
                          </div>
                        )}
                        {editingTimeclockId === entry.id && (
                          <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3">
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Entrada
                              </label>
                              <input
                                type="datetime-local"
                                value={editingEntryTime}
                                onChange={(event) => setEditingEntryTime(event.target.value)}
                                className="input-elegant hidden sm:block"
                              />
                              <div className="grid grid-cols-2 gap-2 sm:hidden">
                                <input
                                  type="date"
                                  value={splitDateTimeInput(editingEntryTime).date}
                                  onChange={(event) =>
                                    setEditingEntryTime(
                                      buildDateTimeInput(
                                        event.target.value,
                                        splitDateTimeInput(editingEntryTime).time
                                      )
                                    )
                                  }
                                  className="input-elegant"
                                />
                                <input
                                  type="time"
                                  value={splitDateTimeInput(editingEntryTime).time}
                                  onChange={(event) =>
                                    setEditingEntryTime(
                                      buildDateTimeInput(
                                        splitDateTimeInput(editingEntryTime).date,
                                        event.target.value
                                      )
                                    )
                                  }
                                  className="input-elegant"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Salida
                              </label>
                              <input
                                type="datetime-local"
                                value={editingExitTime}
                                onChange={(event) => setEditingExitTime(event.target.value)}
                                className="input-elegant hidden sm:block"
                              />
                              <div className="grid grid-cols-2 gap-2 sm:hidden">
                                <input
                                  type="date"
                                  value={splitDateTimeInput(editingExitTime).date}
                                  onChange={(event) =>
                                    setEditingExitTime(
                                      buildDateTimeInput(
                                        event.target.value,
                                        splitDateTimeInput(editingExitTime).time
                                      )
                                    )
                                  }
                                  className="input-elegant"
                                />
                                <input
                                  type="time"
                                  value={splitDateTimeInput(editingExitTime).time}
                                  onChange={(event) =>
                                    setEditingExitTime(
                                      buildDateTimeInput(
                                        splitDateTimeInput(editingExitTime).date,
                                        event.target.value
                                      )
                                    )
                                  }
                                  className="input-elegant"
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                Si olvidó fichar salida, indica aquí la hora de fin de jornada.
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                Motivo del cambio (obligatorio)
                              </label>
                              <input
                                type="text"
                                value={editingCorrectionReason}
                                onChange={(event) => setEditingCorrectionReason(event.target.value)}
                                placeholder="Ej.: olvidó fichar salida, error de sistema..."
                                className="input-elegant w-full"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={handleSaveTimeclock}>
                                Guardar cambios
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelTimeclockEdit}>
                                Cancelar
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {entry.status === "voided" ? (
                          <span className="text-xs text-muted-foreground">No suma en totales</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay fichajes en este rango.</p>
                )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="mt-6 border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  Calculadora de sueldo
                </h3>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Horas trabajadas
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={workedHours}
                    onChange={(event) => setWorkedHours(event.target.value)}
                    className="input-elegant"
                    placeholder="Ej. 160"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Sueldo por hora
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                    className="input-elegant"
                    placeholder="Ej. 12.50"
                  />
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted">
                  <p className="text-sm text-muted-foreground">Total estimado</p>
                  <p className="text-lg font-semibold text-foreground">
                    {salaryTotal.toLocaleString("es-ES", {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="timeoff" className="mt-0 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Vacaciones y días libres</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Revisa las solicitudes pendientes. En el calendario, los días aprobados aparecen en verde con el
                nombre del empleado; los pendientes de revisar, en ámbar.
              </p>

              <h3 className="text-lg font-semibold text-foreground mb-3">Solicitudes pendientes</h3>
              {(timeOffPendingQuery.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground mb-8">No hay solicitudes pendientes.</p>
              ) : (
                <div className="space-y-4 mb-8">
                  {(timeOffPendingQuery.data || []).map((row) => (
                    <div key={row.id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{row.employeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {row.kind === 'vacation' ? 'Vacaciones' : 'Día(s) libre(s)'} ·{' '}
                            {String(row.startDate)} → {String(row.endDate)}
                          </p>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={decideTimeOff.isPending}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: row.id,
                                decision: 'approved',
                              })
                            }
                          >
                            Aprobar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={decideTimeOff.isPending}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: row.id,
                                decision: 'rejected',
                              })
                            }
                          >
                            Denegar
                          </Button>
                        </div>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap border-t border-border pt-2">
                        {row.comment}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <h3 className="text-lg font-semibold text-foreground mb-2">Historial en calendario</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Leyenda: verde = aprobado (día cogido) · ámbar = pendiente de revisar
              </p>
              <div className="w-full overflow-x-auto pb-2">
                <UiCalendar
                  mode="single"
                  selected={undefined}
                  onSelect={() => {}}
                  month={timeOffCalMonth}
                  onMonthChange={setTimeOffCalMonth}
                  className={cn(
                    'w-full max-w-none rounded-xl border border-border p-4 sm:p-6',
                    '[--cell-size:3.25rem] sm:[--cell-size:4.25rem] md:[--cell-size:5rem] lg:[--cell-size:5.75rem]'
                  )}
                  classNames={{
                    root: 'w-full',
                    months: 'w-full',
                    month: 'w-full gap-4',
                    month_caption: 'text-lg sm:text-xl font-semibold mb-1',
                    weekdays: 'w-full',
                    weekday: 'flex-1 text-center text-xs sm:text-sm font-medium py-2',
                    week: 'w-full mt-1',
                    day: 'aspect-auto min-h-0 flex-1',
                  }}
                  components={{
                    DayButton: (props) => {
                      const key = format(props.day.date, 'yyyy-MM-dd');
                      const approved = timeOffCellApproved.get(key);
                      const pending = timeOffCellPending.get(key);
                      return (
                        <CalendarDayButton
                          {...props}
                          className={cn(
                            props.className,
                            '!aspect-auto !min-h-[4.5rem] sm:!min-h-[5.5rem] md:!min-h-[6.5rem] !h-auto w-full py-1.5 px-0.5',
                            approved &&
                              '!bg-emerald-200 dark:!bg-emerald-900/55 hover:!bg-emerald-300 dark:hover:!bg-emerald-800/55',
                            !approved &&
                              pending &&
                              '!bg-amber-100 dark:!bg-amber-900/40 hover:!bg-amber-200 dark:hover:!bg-amber-800/40'
                          )}
                        >
                          <span className="text-sm sm:text-base font-semibold leading-none">
                            {props.day.date.getDate()}
                          </span>
                          {approved?.map((name) => (
                            <span
                              key={`${key}-${name}`}
                              className="text-[0.6rem] sm:text-[0.7rem] md:text-xs leading-tight w-full px-0.5 font-semibold text-emerald-950 dark:text-emerald-50 truncate"
                              title={name}
                            >
                              {name}
                            </span>
                          ))}
                          {!approved?.length && pending?.map((name) => (
                            <span
                              key={`${key}-${name}-p`}
                              className="text-[0.6rem] sm:text-[0.7rem] md:text-xs leading-tight w-full px-0.5 font-medium text-amber-950 dark:text-amber-50 truncate"
                              title={`${name} (pendiente)`}
                            >
                              {name}
                            </span>
                          ))}
                        </CalendarDayButton>
                      );
                    },
                  }}
                />
              </div>
              {timeOffCalendarQuery.isFetching ? (
                <p className="text-center text-xs text-muted-foreground">Actualizando calendario…</p>
              ) : null}

              <h3 className="text-lg font-semibold text-foreground mt-8 mb-3">Historial de solicitudes</h3>
              {(timeOffAllQuery.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No hay solicitudes.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {(timeOffAllQuery.data || []).map((row) => (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                    >
                      <div>
                        <span className="font-medium text-foreground">{row.employeeName}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          · {row.kind === 'vacation' ? 'Vacaciones' : 'Libre'} · {String(row.startDate)} →{' '}
                          {String(row.endDate)}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={
                            row.status === 'approved'
                              ? 'text-green-600 dark:text-green-400 font-medium'
                              : row.status === 'rejected'
                                ? 'text-red-600 dark:text-red-400 font-medium'
                                : 'text-amber-600 dark:text-amber-400 font-medium'
                          }
                        >
                          {row.status === 'approved'
                            ? 'Aprobada'
                            : row.status === 'rejected'
                              ? 'Denegada'
                              : 'Pendiente'}
                        </span>
                        {row.status === 'approved' || row.status === 'pending' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-destructive border-destructive/40 hover:bg-destructive/10"
                            disabled={adminDeleteTimeOff.isPending}
                            onClick={() => {
                              const msg =
                                row.status === 'approved'
                                  ? `¿Anular la aprobación de ${row.employeeName} (${String(row.startDate)} → ${String(row.endDate)})? Se borrará el registro.`
                                  : `¿Eliminar la solicitud pendiente de ${row.employeeName}?`;
                              if (!window.confirm(msg)) return;
                              adminDeleteTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: row.id,
                              });
                            }}
                          >
                            Anular
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Incidents Tab */}
          <TabsContent value="incidents" className="mt-0 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">Gestión de Incidencias</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Seleccionar Empleado
                  </label>
                  <select
                    className="input-elegant"
                    value={incidentEmployeeId}
                    onChange={(event) => setIncidentEmployeeId(event.target.value)}
                  >
                    <option value="">Todos los empleados</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleClearAllIncidents}
                    disabled={clearAllIncidents.isPending}
                  >
                    {clearAllIncidents.isPending ? "Borrando..." : "Borrar todas las incidencias"}
                  </Button>
                </div>
              </div>

              {/* Incidents List */}
              <div className="space-y-4">
                {(listIncidents.data || [])
                  .filter((incident) =>
                    incidentEmployeeId ? String(incident.employeeId) === incidentEmployeeId : true
                  )
                  .length ? (
                  (listIncidents.data || [])
                    .filter((incident) =>
                      incidentEmployeeId ? String(incident.employeeId) === incidentEmployeeId : true
                    )
                    .map((incident) => (
                    <div key={incident.id} className="p-4 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {incident.type === "late_arrival"
                              ? "Retraso en la entrada"
                              : incident.type === "early_exit"
                              ? "Salida anticipada"
                              : "Incidencia"}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {employeeNameById.get(incident.employeeId) || `Empleado #${incident.employeeId}`}{" "}
                            · {formatClockDateShort(incident.createdAt)}
                          </p>
                        </div>
                        <span className={incident.status === "pending" ? "badge-warning" : incident.status === "approved" ? "badge-success" : "badge-error"}>
                          {incident.status === "pending" ? "Pendiente" : incident.status === "approved" ? "Aprobada" : "Rechazada"}
                        </span>
                      </div>
                      <p className="text-sm text-foreground mb-3">{incident.reason}</p>
                      {incident.status === "pending" ? (
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            disabled={decideIncident.isPending}
                            onClick={() =>
                              decideIncident.mutate({
                                ...adminApiInput(),
                                incidentId: incident.id,
                                decision: "approved",
                              })
                            }
                          >
                            Aprobar
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={decideIncident.isPending}
                            onClick={() =>
                              decideIncident.mutate({
                                ...adminApiInput(),
                                incidentId: incident.id,
                                decision: "rejected",
                              })
                            }
                          >
                            Rechazar
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No hay incidencias registradas.</p>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="mt-0 space-y-6">
            <AdminLegalPanel />
          </TabsContent>

          <TabsContent value="audit" className="mt-0 space-y-6">
            <AdminAuditLogPanel />
          </TabsContent>

          <TabsContent value="settings" className="mt-0 space-y-6">
            <AdminSupportPanel companyName={onboardingQuery.data?.company?.name} />

            {subscription ? (
              <AdminBillingPanel
                plan={subscription.plan}
                planLabel={subscription.planLabel}
                billingStatus={subscription.billingStatus}
                stripeEnabled={subscription.stripeEnabled}
                trialDaysRemaining={subscription.trialDaysRemaining}
                showBillingBanner={subscription.showBillingBanner}
              />
            ) : null}

            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-2">Ajustes del negocio</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Configuración de tu centro de trabajo y validación GPS al fichar (si está activa).
              </p>

              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Ubicación del negocio
              </h3>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Nombre del negocio
                  </label>
                  <input
                    type="text"
                    placeholder="Mi Restaurante"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dirección
                  </label>
                  <input
                    type="text"
                    placeholder="Calle Principal, 123"
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      Radio de Validación (metros)
                    </label>
                    <input
                      type="number"
                      placeholder="100"
                      min={50}
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="input-elegant"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Recomendado 100–150 m. Con menos de 50 m el GPS del móvil suele fallar al fichar.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">Seleccionar Ubicación</h3>
                <RestaurantMap
                  latitude={latitude}
                  longitude={longitude}
                  initialAddress={restaurantAddress}
                  onLocationSelect={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  onAddressChange={(address) => setRestaurantAddress(address)}
                />
              </div>

              <Button onClick={handleSaveRestaurant} className="w-full btn-primary">
                Guardar ubicación
              </Button>
            </Card>
          </TabsContent>
        </div>
      </Tabs>

      <Dialog
        open={forceClockOutTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeForceClockOutDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fichar salida manual</DialogTitle>
            <DialogDescription>
              {forceClockOutTarget
                ? `Registrar la salida de ${forceClockOutTarget.employeeName}. Puedes ajustar la hora si terminó antes.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            {forceClockOutTarget?.entryTime ? (
              <p className="text-sm text-muted-foreground">
                Entrada registrada: {formatClockTime(forceClockOutTarget.entryTime)}
              </p>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Hora de salida
              </label>
              <input
                type="datetime-local"
                value={forceClockOutExitTime}
                onChange={(event) => setForceClockOutExitTime(event.target.value)}
                className="input-elegant hidden sm:block w-full"
              />
              <div className="grid grid-cols-2 gap-2 sm:hidden">
                <input
                  type="date"
                  value={splitDateTimeInput(forceClockOutExitTime).date}
                  onChange={(event) =>
                    setForceClockOutExitTime(
                      buildDateTimeInput(
                        event.target.value,
                        splitDateTimeInput(forceClockOutExitTime).time
                      )
                    )
                  }
                  className="input-elegant"
                />
                <input
                  type="time"
                  value={splitDateTimeInput(forceClockOutExitTime).time}
                  onChange={(event) =>
                    setForceClockOutExitTime(
                      buildDateTimeInput(
                        splitDateTimeInput(forceClockOutExitTime).date,
                        event.target.value
                      )
                    )
                  }
                  className="input-elegant"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Motivo
              </label>
              <Textarea
                value={forceClockOutReason}
                onChange={(event) => setForceClockOutReason(event.target.value)}
                rows={3}
                placeholder="Motivo del cierre manual (mín. 3 caracteres)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeForceClockOutDialog}
              disabled={adminForceClockOut.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={submitAdminForceClockOut}
              disabled={adminForceClockOut.isPending}
            >
              {adminForceClockOut.isPending ? 'Guardando…' : 'Registrar salida'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShellLayout>
  );
}
