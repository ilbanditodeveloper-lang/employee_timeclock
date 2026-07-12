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
import { useLocale } from '@/contexts/LocaleContext';
import { adminApiInput, getStoredActiveLocationId, syncStoredActiveLocationId } from '@/lib/adminContext';
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

export default function AdminDashboard() {
  const { t, locale } = useLocale();
  const dateLocale = locale === 'en' ? 'en-US' : 'es-ES';
  const scheduleDays = useMemo(
    () =>
      [
        { key: 'monday', label: t('common.weekdays.monday') },
        { key: 'tuesday', label: t('common.weekdays.tuesday') },
        { key: 'wednesday', label: t('common.weekdays.wednesday') },
        { key: 'thursday', label: t('common.weekdays.thursday') },
        { key: 'friday', label: t('common.weekdays.friday') },
        { key: 'saturday', label: t('common.weekdays.saturday') },
        { key: 'sunday', label: t('common.weekdays.sunday') },
      ] as const,
    [t]
  );
  const adminNav = useMemo<AppShellNavItem[]>(
    () => [
      { id: 'dashboard', label: t('nav.admin.dashboard'), icon: LayoutDashboard },
      { id: 'employees', label: t('nav.admin.employees'), icon: Users },
      { id: 'hours', label: t('nav.admin.hours'), icon: Calendar },
      { id: 'shifts', label: t('nav.admin.shifts'), icon: Clock3 },
      { id: 'timeoff', label: t('nav.admin.vacations'), icon: Palmtree },
      { id: 'incidents', label: t('nav.admin.incidents'), icon: AlertCircle },
      { id: 'audit', label: t('nav.admin.audit'), icon: ClipboardList },
      { id: 'legal', label: t('nav.admin.legal'), icon: Scale },
      { id: 'settings', label: t('nav.admin.settings'), icon: Settings },
    ],
    [t]
  );
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
  const [employeeFormKey, setEmployeeFormKey] = useState(0);
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
  const [forceClockOutReason, setForceClockOutReason] = useState('');

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
        variables.decision === 'approved'
          ? t('admin.toasts.incidentApproved')
          : t('admin.toasts.incidentRejected')
      );
      void listIncidents.refetch();
      void trpcUtils.publicApi.getAdminNotificationCenter.invalidate();
    },
    onError: (error) =>
      toast.error(error.message || t('admin.toasts.incidentUpdateFailed')),
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
  const workforceTodayQuery = trpc.publicApi.getTodayWorkforceStatus.useQuery(adminInput, {
    enabled: isAdminAuthenticated,
    refetchInterval: activeTab === 'dashboard' ? 15_000 : false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });
  const decideTimeOff = trpc.publicApi.decideTimeOffRequest.useMutation({
    onSuccess: () => {
      toast.success(t('admin.toasts.timeOffUpdated'));
      void timeOffPendingQuery.refetch();
      void timeOffAllQuery.refetch();
      void timeOffCalendarQuery.refetch();
    },
    onError: () => toast.error(t('admin.toasts.timeOffUpdateFailed')),
  });
  const adminDeleteTimeOff = trpc.publicApi.adminDeleteTimeOffRequest.useMutation({
    onSuccess: () => {
      toast.success(t('admin.toasts.timeOffCancelled'));
      void timeOffPendingQuery.refetch();
      void timeOffAllQuery.refetch();
      void timeOffCalendarQuery.refetch();
    },
    onError: () => toast.error(t('admin.toasts.timeOffCancelFailed')),
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
      ? employeeNameById.get(Number(selectedEmployeeId)) ||
        t('common.employeeFallback', { id: selectedEmployeeId })
      : t('common.allEmployees');
    const rangeLabel =
      rangeStart || rangeEnd
        ? t('admin.hours.report.rangeLabel', {
            start: rangeStart || t('common.start'),
            end: rangeEnd || t('common.today'),
          })
        : t('admin.hours.report.noDateFilter');
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
    const timeOffType = (kind: string) =>
      kind === 'vacation' ? t('common.timeOff.vacation') : t('common.timeOff.dayOff');
    const timeOffStatus = (status: string) =>
      status === 'approved'
        ? t('common.timeOff.status.approved')
        : status === 'rejected'
          ? t('common.timeOff.status.rejected')
          : t('common.timeOff.status.pending');
    const incidentType = (type: string) =>
      type === 'late_arrival'
        ? t('common.incidents.lateArrivalShort')
        : type === 'early_exit'
          ? t('common.incidents.earlyExitShort')
          : t('common.incidents.otherShort');
    const incidentStatus = (status: string) =>
      status === 'approved'
        ? t('common.incidents.status.approved')
        : status === 'rejected'
          ? t('common.incidents.status.rejected')
          : t('common.incidents.status.pending');

    const timeOffRows = filteredTimeOffForReport.map((row) => ({
      [t('admin.hours.report.columns.employee')]:
        row.employeeName || employeeNameById.get(row.employeeId) || `#${row.employeeId}`,
      [t('admin.hours.report.columns.type')]: timeOffType(row.kind),
      [t('admin.hours.report.columns.from')]: toYmd(row.startDate),
      [t('admin.hours.report.columns.to')]: toYmd(row.endDate),
      [t('admin.hours.report.columns.status')]: timeOffStatus(row.status),
      [t('admin.hours.report.columns.comment')]: row.comment || '',
    }));
    const incidentRows = filteredIncidentsForReport.map((incident) => ({
      [t('admin.hours.report.columns.employee')]:
        employeeNameById.get(incident.employeeId) || `#${incident.employeeId}`,
      [t('admin.hours.report.columns.type')]: incidentType(incident.type),
      [t('admin.hours.report.columns.status')]: incidentStatus(incident.status),
      [t('admin.hours.report.columns.reason')]: incident.reason,
      [t('admin.hours.report.columns.date')]: incident.createdAt
        ? new Date(incident.createdAt).toLocaleString(dateLocale)
        : '',
    }));
    const timeOffPdf = filteredTimeOffForReport.map((row) => [
      row.employeeName || employeeNameById.get(row.employeeId) || `#${row.employeeId}`,
      timeOffType(row.kind),
      toYmd(row.startDate),
      toYmd(row.endDate),
      timeOffStatus(row.status),
      row.comment || '',
    ]);
    const incidentPdf = filteredIncidentsForReport.map((incident) => [
      employeeNameById.get(incident.employeeId) || `#${incident.employeeId}`,
      incidentType(incident.type),
      incidentStatus(incident.status),
      incident.reason || '',
      incident.createdAt ? new Date(incident.createdAt).toLocaleString(dateLocale) : '',
    ]);
    return { timeOffRows, incidentRows, timeOffPdf, incidentPdf };
  };

  const runExport = async (kind: 'csv' | 'official-pdf' | 'excel' | 'pdf') => {
    if (!hasReportData && kind !== 'csv') {
      toast.error(t('admin.toasts.noExportData'));
      return;
    }
    setExportBusy(true);
    try {
      const bundle = await fetchReportBundle(true, kind === 'official-pdf');
      if (bundle.rows.length === 0 && !filteredTimeOffForReport.length && !filteredIncidentsForReport.length) {
        toast.error(t('admin.toasts.noClockEntriesInPeriod'));
        return;
      }
      const extras = buildReportExtras();
      if (kind === 'csv') {
        downloadLaborReportCsv(bundle);
        toast.success(t('admin.toasts.csvDownloaded'));
      } else if (kind === 'official-pdf') {
        downloadOfficialLaborReportPdf(bundle);
        toast.success(t('admin.toasts.officialPdfDownloaded'));
      } else if (kind === 'excel') {
        downloadEnhancedLaborReportExcel(bundle, extras);
        toast.success(t('admin.toasts.excelDownloaded'));
      } else {
        downloadEnhancedLaborReportPdf(bundle, {
          timeOffRows: extras.timeOffPdf,
          incidentRows: extras.incidentPdf,
        });
        toast.success(t('admin.toasts.pdfDownloaded'));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.toasts.exportFailed'));
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
      toast.success(t('admin.toasts.jsonExportDownloaded'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('admin.toasts.exportEmployeeFailed'));
    }
  };

  const handleDeactivateEmployee = (employee: { id: number; name: string; isActive?: boolean }) => {
    if (employee.isActive === false) {
      toast.info(t('admin.toasts.employeeAlreadyInactive'));
      return;
    }
    const reason = window.prompt(
      t('admin.dialogs.deactivateEmployee', { name: employee.name })
    );
    if (reason === null) return;
    if (reason.trim().length > 0 && reason.trim().length < 3) {
      toast.error(t('admin.toasts.deactivateReasonTooShort'));
      return;
    }
    deactivateEmployee
      .mutateAsync({
        ...adminApiInput(),
        employeeId: employee.id,
        reason: reason.trim() || undefined,
      })
      .then(() => {
        toast.success(t('admin.toasts.employeeDeactivated'));
        listEmployees.refetch();
      })
      .catch((error) => toast.error(error?.message || t('admin.toasts.deactivateFailed')));
  };

  const timeclockStatusBadge = (entry: { status?: string; exitTime?: string | Date | null }) => {
    if (entry.status === 'voided') {
      return <Badge variant="destructive">{t('admin.timeclock.voided')}</Badge>;
    }
    if (entry.status === 'corrected') {
      return <Badge variant="secondary">{t('admin.timeclock.corrected')}</Badge>;
    }
    if (!entry.exitTime) {
      return <Badge variant="outline">{t('admin.timeclock.incomplete')}</Badge>;
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
      toast.error(t('admin.toasts.selectEmployee'));
      return;
    }
    updateEmployeeSchedule
      .mutateAsync({
        ...adminApiInput(),
        employeeId: Number(shiftEmployeeId),
        schedule: shiftSchedule,
      })
      .then(() => {
        toast.success(t('admin.toasts.shiftsSaved'));
        shiftScheduleQuery.refetch();
      })
      .catch((error) => {
        toast.error(t('admin.toasts.shiftsSaveFailed'));
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
    setForceClockOutReason(t('admin.dialogs.forceClockOut.defaultReason'));
  };

  const closeForceClockOutDialog = () => {
    if (adminForceClockOut.isPending) return;
    setForceClockOutTarget(null);
  };

  const submitAdminForceClockOut = () => {
    if (!forceClockOutTarget) return;
    if (!forceClockOutReason.trim() || forceClockOutReason.trim().length < 3) {
      toast.error(t('admin.toasts.forceClockOutReasonTooShort'));
      return;
    }
    if (!forceClockOutExitTime) {
      toast.error(t('admin.toasts.forceClockOutExitRequired'));
      return;
    }
    const exitDate = new Date(forceClockOutExitTime);
    if (Number.isNaN(exitDate.getTime())) {
      toast.error(t('admin.toasts.forceClockOutExitInvalid'));
      return;
    }
    if (forceClockOutTarget.entryTime) {
      const entryDate = new Date(forceClockOutTarget.entryTime);
      if (!Number.isNaN(entryDate.getTime()) && exitDate <= entryDate) {
        toast.error(t('admin.toasts.exitMustBeAfterEntry'));
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
        toast.success(
          t('admin.toasts.forceClockOutSuccess', { name: forceClockOutTarget.employeeName })
        );
        setForceClockOutTarget(null);
        void workforceTodayQuery.refetch();
        void timeclocksQuery.refetch();
        void trpcUtils.publicApi.getAdminTodayActivity.invalidate();
      })
      .catch((error) => {
        toast.error(error?.message || t('admin.toasts.forceClockOutFailed'));
      });
  };

  const handleSaveTimeclock = () => {
    if (!editingTimeclockId) return;
    if (!editingEntryTime) {
      toast.error(t('admin.toasts.entryTimeRequired'));
      return;
    }
    if (!editingCorrectionReason || editingCorrectionReason.trim().length < 3) {
      toast.error(t('admin.toasts.correctionReasonRequired'));
      return;
    }
    if (editingExitTime) {
      const entryDate = new Date(editingEntryTime);
      const exitDate = new Date(editingExitTime);
      if (Number.isNaN(entryDate.getTime()) || Number.isNaN(exitDate.getTime())) {
        toast.error(t('admin.toasts.invalidDateFormat'));
        return;
      }
      if (exitDate <= entryDate) {
        toast.error(t('admin.toasts.exitMustBeAfterEntry'));
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
        toast.success(t('admin.toasts.timeclockUpdated'));
        handleCancelTimeclockEdit();
        setEditingCorrectionReason('');
        timeclocksQuery.refetch();
      })
      .catch((error) => {
        toast.error(error?.message || t('admin.toasts.timeclockUpdateFailed'));
        console.error(error);
      });
  };

  const handleSendTestNotification = () => {
    if (!selectedEmployeeId) {
      toast.error(t('admin.toasts.selectEmployeeFirst'));
      return;
    }
    sendTestNotification
      .mutateAsync({
        ...adminApiInput(),
        employeeId: Number(selectedEmployeeId),
      })
      .then((result) => {
        toast.success(
          t('admin.toasts.notificationSent', {
            sent: result.sent,
            failedPart: result.failed
              ? t('admin.toasts.notificationFailedPart', { failed: result.failed })
              : '',
          })
        );
      })
      .catch((error) => {
        toast.error(error?.message || t('admin.toasts.notificationFailed'));
        console.error(error);
      });
  };

  const handleClearAllIncidents = () => {
    const confirmed = window.confirm(t('admin.dialogs.clearAllIncidents'));
    if (!confirmed) return;

    clearAllIncidents
      .mutateAsync({ ...adminApiInput() })
      .then(() => {
        toast.success(t('admin.toasts.allIncidentsCleared'));
        listIncidents.refetch();
      })
      .catch((error) => {
        toast.error(t('admin.toasts.clearIncidentsFailed'));
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
      toast.error(t('admin.toasts.completeAllFields'));
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
      toast.error(t('admin.toasts.geocodeFailed'));
      return;
    }

    const safeRadius = Math.max(radiusMeters, 50);
    if (safeRadius !== radiusMeters) {
      setRadiusMeters(safeRadius);
      toast.message(t('admin.toasts.minRadiusApplied'));
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
      toast.success(t('admin.toasts.restaurantSaved'));
      void getRestaurant.refetch();
    } catch (error) {
      toast.error(t('admin.toasts.restaurantSaveFailed'));
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
        contact.message ?? t('admin.toasts.employeeFormIncomplete')
      );
      return;
    }
    if (employeePassword && employeePassword.length < 6) {
      toast.error(t('admin.toasts.passwordTooShort'));
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
          employeeEmail: contact.normalizedEmail ?? '',
          employeeUsername,
          employeePassword,
          employeePhone: contact.normalizedPhone ?? '',
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
            ? t('admin.toasts.employeeUpdated', { name: employeeName })
            : t('admin.toasts.employeeCreated', { name: employeeName })
        );
        if (adminSession?.companySlug) {
          saveDefaultSchedule(adminSession.companySlug, employeeSchedule);
        }
        resetEmployeeFormFields();
        setShowEmployeeForm(false);
        listEmployees.refetch();
      })
      .catch((error) => {
        toast.error(
          editingEmployeeId
            ? t('admin.toasts.employeeUpdateFailed')
            : t('admin.toasts.employeeCreateFailed')
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
    setEmployeeContractType('full_time');
    setEmployeeWeeklyHours('');
    setEmployeeNationalId('');
    setLateGraceMinutes('5');
    setEditingEmployeeId(null);
    setEmployeeSchedule(nextSchedule);
    setScheduleSectionOpen(false);
    setEmployeeFormKey((key) => key + 1);
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
    if (!isAdminAuthenticated || getRestaurant.isLoading || !getRestaurant.isFetched) return;
    const stored = getStoredActiveLocationId();
    const resolvedId = getRestaurant.data?.id;
    if (resolvedId) {
      if (stored !== resolvedId) {
        syncStoredActiveLocationId(resolvedId);
        void workforceTodayQuery.refetch();
      }
      return;
    }
    if (stored) {
      syncStoredActiveLocationId(null);
      void workforceTodayQuery.refetch();
    }
  }, [
    getRestaurant.data?.id,
    getRestaurant.isLoading,
    getRestaurant.isFetched,
    isAdminAuthenticated,
  ]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !isAdminAuthenticated) return;
    void workforceTodayQuery.refetch();
  }, [activeTab, isAdminAuthenticated]);

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
      toast.success(t('admin.toasts.billingPaymentSuccess'));
      window.history.replaceState({}, '', '/admin');
      void onboardingQuery.refetch();
    } else if (params.get('billing') === 'cancel') {
      toast.message(t('admin.toasts.billingPaymentCancelled'));
      window.history.replaceState({}, '', '/admin');
    }
  }, [t]);
  const activeNav = adminNav.find((item) => item.id === activeTab);

  if (isAuthLoading || !isAdminAuthenticated) {
    return null;
  }

  return (
    <AppShellLayout
      brandLabel={adminSession?.displayName ?? adminSession?.companySlug ?? t('admin.shell.businessFallback')}
      brandIcon={<LayoutDashboard className="size-5" />}
      pageTitle={activeNav?.label ?? t('admin.shell.pageTitleFallback')}
      pageSubtitle={t('admin.shell.pageSubtitle')}
      userName={adminSession?.displayName ?? t('admin.shell.adminFallback')}
      userEmail={adminSession?.companySlug}
      navItems={adminNav}
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
            {t('admin.dashboard.initialSetup')}
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
                  <h2 className="text-2xl font-bold text-foreground">{t('admin.dashboard.title')}</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t('admin.dashboard.subtitle')}
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
                  {workforceTodayQuery.isFetching ? t('common.updating') : t('common.refresh')}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                <section className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-5">
                  <h3 className="text-lg font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
                    {t('admin.dashboard.workforce.workingNow')}
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.working ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.working ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.workforce.nobodyWorking')}</p>
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
                              {t('admin.dashboard.workforce.entryAt', { time: formatClockTime(row.entryTime) })}
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
                            {t('admin.dashboard.workforce.forceClockOut')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-5">
                  <h3 className="text-lg font-semibold text-amber-800 dark:text-amber-200 mb-3 flex items-center gap-2">
                    <span className="inline-block size-2.5 rounded-full bg-amber-500" />
                    {t('admin.dashboard.workforce.onBreak')}
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.onBreak ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.onBreak ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.workforce.nobodyOnBreak')}</p>
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
                              {t('admin.dashboard.workforce.entryAtOnBreak', {
                                time: formatClockTime(row.entryTime),
                              })}
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
                            {t('admin.dashboard.workforce.forceClockOut')}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/60 dark:bg-teal-950/20 p-5">
                  <h3 className="text-lg font-semibold text-teal-800 dark:text-teal-200 mb-3 flex items-center gap-2">
                    <Palmtree className="w-4 h-4" />
                    {t('admin.dashboard.workforce.onTimeOff')}
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.onTimeOff ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.onTimeOff ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.workforce.nobodyOnTimeOff')}</p>
                  ) : (
                    <ul className="space-y-2">
                      {(workforceTodayQuery.data?.onTimeOff ?? []).map((row) => (
                        <li
                          key={row.employeeId}
                          className="flex items-center justify-between gap-2 rounded-lg border border-teal-200/80 dark:border-teal-800/50 bg-background/80 px-3 py-2"
                        >
                          <span className="font-medium text-foreground">{row.employeeName}</span>
                          <span className="text-sm text-muted-foreground">
                            {row.kind === 'vacation' ? t('admin.dashboard.workforce.vacation') : t('admin.dashboard.workforce.dayOff')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="rounded-xl border border-border bg-muted/30 p-5">
                  <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t('admin.dashboard.workforce.notClockedIn')}
                    <Badge variant="secondary" className="ml-auto">
                      {(workforceTodayQuery.data?.notClockedIn ?? []).length}
                    </Badge>
                  </h3>
                  {(workforceTodayQuery.data?.notClockedIn ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.workforce.everyoneClockedOrOff')}</p>
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
                    {t('admin.dashboard.workforce.finishedToday')}
                  </h3>
                  <ul className="space-y-2">
                    {(workforceTodayQuery.data?.finishedToday ?? []).map((row) => (
                      <li
                        key={row.employeeId}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm"
                      >
                        <span className="font-medium text-foreground">{row.employeeName}</span>
                        <span className="text-muted-foreground">
                          {t('admin.dashboard.workforce.exitAt', { time: formatClockTime(row.exitTime) })}
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
                    <h2 className="text-2xl font-bold text-foreground">{t('admin.employees.title')}</h2>
                    <Button
                      type="button"
                      onClick={handleStartCreateEmployee}
                      className="btn-primary gap-2"
                      disabled={atEmployeeLimit}
                    >
                      <Plus className="size-4" />
                      {t('admin.employees.create')}
                    </Button>
                  </div>
                  {atEmployeeLimit ? (
                    <p className="mb-4 text-xs text-muted-foreground">
                      {t('admin.employees.atLimit')}
                    </p>
                  ) : null}

                  <div>
                    <h3 className="mb-2 font-semibold text-foreground">{t('admin.employees.registered')}</h3>
                    <p className="mb-4 text-xs text-muted-foreground">
                      {t('admin.employees.registeredHint')}
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
                                  <Badge variant="secondary">{t('common.inactive')}</Badge>
                                ) : (
                                  <Badge variant="outline">{t('common.active')}</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {t('admin.employees.form.email')}: {employee.email || "—"} · {t('admin.employees.form.username')}: {employee.username}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditEmployee(employee.id)}
                              >
                                {t('common.edit')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleExportEmployeeData(employee.id, employee.name)}
                              >
                                {t('admin.employees.exportJson')}
                              </Button>
                              {employee.isActive !== false && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeactivateEmployee(employee)}
                                  disabled={deactivateEmployee.isPending}
                                >
                                  {t('admin.employees.deactivate')}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">{t('admin.employees.none')}</p>
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
                      {t('admin.employees.form.backToList')}
                    </Button>
                    <h2 className="text-2xl font-bold text-foreground">
                      {editingEmployeeId ? t('admin.employees.form.editTitle') : t('admin.employees.form.createTitle')}
                    </h2>
                  </div>

              <div key={employeeFormKey} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.nameLabel')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.employees.form.namePlaceholder')}
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    className="input-elegant"
                    autoComplete="off"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.emailContact')}
                  </label>
                  <input
                    type="email"
                    placeholder={t('admin.employees.form.emailPlaceholder')}
                    value={employeeEmail}
                    onChange={(e) => setEmployeeEmail(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.phoneContact')}
                  </label>
                  <input
                    type="tel"
                    placeholder={t('admin.employees.form.phonePlaceholder')}
                    value={employeePhone}
                    onChange={(e) => setEmployeePhone(e.target.value)}
                    className="input-elegant"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('admin.employees.form.contactHint')}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.usernameClock')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.employees.form.usernamePlaceholder')}
                    value={employeeUsername}
                    onChange={(e) => setEmployeeUsername(e.target.value)}
                    className="input-elegant"
                    autoComplete="off"
                    name="timeclock-new-employee-username"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.password')}
                  </label>
                  <input
                    type="password"
                    placeholder={t('admin.employees.form.passwordPlaceholder')}
                    value={employeePassword}
                    onChange={(e) => setEmployeePassword(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('admin.employees.form.contractType')}
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
                      <option value="full_time">{t('common.contractTypes.full_time')}</option>
                      <option value="part_time">{t('common.contractTypes.part_time')}</option>
                      <option value="temporary">{t('common.contractTypes.temporary')}</option>
                      <option value="other">{t('common.contractTypes.other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('admin.employees.form.weeklyHours')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      step="0.5"
                      placeholder={t('admin.employees.form.weeklyHoursPlaceholder')}
                      value={employeeWeeklyHours}
                      onChange={(e) => setEmployeeWeeklyHours(e.target.value)}
                      className="input-elegant"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.nationalId')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.employees.form.nationalIdPlaceholder')}
                    value={employeeNationalId}
                    onChange={(e) => setEmployeeNationalId(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.employees.form.lateGraceMinutes')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder={t('admin.employees.form.lateGracePlaceholder')}
                    value={lateGraceMinutes}
                    onChange={(e) => setLateGraceMinutes(e.target.value)}
                    className="input-elegant"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('admin.employees.form.lateGraceHint')}
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
                        {t('admin.employees.form.scheduleEntry')}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        {t('admin.employees.form.scheduleEntryHint')}
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
                            {t('common.clear')}
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
                            {t('common.clear')}
                          </Button>
                        </div>
                        <label className="flex items-center gap-2 text-sm text-foreground">
                          <input
                            type="checkbox"
                            checked={employeeSchedule[day.key].isActive}
                            onChange={() => handleScheduleToggle(day.key)}
                          />
                          {t('common.active')}
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
                  {editingEmployeeId
                    ? t('admin.employees.form.saveChanges')
                    : t('admin.employees.form.createEmployee')}
                </Button>
                {!editingEmployeeId && atEmployeeLimit ? (
                  <p className="text-xs text-muted-foreground">
                    {t('admin.employees.atLimit')}
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
              <h2 className="text-2xl font-bold text-foreground mb-2">{t('admin.shifts.title')}</h2>
              <p className="text-sm text-muted-foreground mb-4">
                {t('admin.shifts.subtitle')}
              </p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.shifts.selectEmployee')}
                  </label>
                  <select
                    className="input-elegant"
                    value={shiftEmployeeId}
                    onChange={(event) => setShiftEmployeeId(event.target.value)}
                  >
                    <option value="">{t('common.selectEmployee')}</option>
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
                      <label className="block text-xs text-muted-foreground mb-1">{t('admin.shifts.shiftTypeLabel')}</label>
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
                        <option value="off">{t('common.shiftTypes.off')}</option>
                        <option value="morning">{t('common.shiftTypes.morning')}</option>
                        <option value="afternoon">{t('common.shiftTypes.afternoon')}</option>
                        <option value="split">{t('common.shiftTypes.split')}</option>
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
                {updateEmployeeSchedule.isPending ? t('common.saving') : t('admin.shifts.save')}
              </Button>
            </Card>
          </TabsContent>

          {/* Hours Tab */}
          <TabsContent value="hours" className="mt-0 space-y-6">
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">{t('admin.hours.title')}</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.hours.selectEmployee')}
                  </label>
                  <select
                    className="input-elegant"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    <option value="">{t('common.selectEmployee')}</option>
                    {listEmployees.data?.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => setMonthRange(0)} disabled={exportBusy}>
                    {t('admin.hours.currentMonth')}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setMonthRange(-1)} disabled={exportBusy}>
                    {t('admin.hours.previousMonth')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportOfficialPdf}
                    disabled={exportBusy || !hasReportData}
                  >
                    {t('admin.hours.officialPdf')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportCsv}
                    disabled={exportBusy}
                  >
                    {t('admin.hours.csvPayroll')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportReportsToExcel}
                    disabled={exportBusy || !hasReportData}
                  >
                    {t('admin.hours.fullExcel')}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportReportsToPdf}
                    disabled={exportBusy || !hasReportData}
                  >
                    {t('admin.hours.fullPdf')}
                  </Button>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground px-2">
                    <input
                      type="checkbox"
                      checked={includeAuditHistory}
                      onChange={(e) => setIncludeAuditHistory(e.target.checked)}
                    />
                    {t('admin.hours.includeAuditHistory')}
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendTestNotification}
                    disabled={!selectedEmployeeId || sendTestNotification.isPending}
                  >
                    {sendTestNotification.isPending
                      ? t('common.sending')
                      : t('admin.hours.testNotification')}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('common.from')}
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
                      {t('common.to')}
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
                    {t('admin.hours.registerTitle', {
                      count: filteredTimeclocks.length,
                      hours: totalHours.toFixed(2),
                    })}
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
                            {employeeNameById.get(entry.employeeId) ||
                              t('common.employeeFallback', { id: entry.employeeId })}
                          </p>
                          {timeclockStatusBadge(entry)}
                          {entry.isLate && entry.status !== "voided" ? (
                            <Badge variant="outline" className="text-amber-700">
                              {t('admin.timeclock.late')}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.timeclock.entryLabel')}{" "}
                          {entry.entryTime ? formatClockTime(entry.entryTime) : t('admin.timeclock.noEntry')}
                          {" · "}
                          {entry.entryTime ? formatClockDateShort(entry.entryTime) : ""}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t('admin.timeclock.exitLabel')}{" "}
                          {entry.exitTime ? formatClockTime(entry.exitTime) : t('admin.timeclock.pending')}
                          {entry.exitTime ? ` · ${formatClockDateShort(entry.exitTime)}` : ""}
                        </p>
                        {(entry.correctionReason || entry.voidReason) && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t('admin.timeclock.reasonLabel')} {entry.correctionReason || entry.voidReason}
                          </p>
                        )}
                        {editingTimeclockId !== entry.id && entry.status !== "voided" && (
                          <div className="mt-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditTimeclock(entry)}
                            >
                              {entry.exitTime
                                ? t('admin.timeclock.editEntry')
                                : t('admin.timeclock.completeEntryOrExit')}
                            </Button>
                          </div>
                        )}
                        {editingTimeclockId === entry.id && (
                          <div className="mt-3 grid gap-3 rounded-lg border border-border bg-background p-3">
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                {t('common.entry')}
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
                                {t('common.exit')}
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
                                {t('admin.timeclock.exitHint')}
                              </p>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-foreground mb-1">
                                {t('admin.timeclock.correctionReason')}
                              </label>
                              <input
                                type="text"
                                value={editingCorrectionReason}
                                onChange={(event) => setEditingCorrectionReason(event.target.value)}
                                placeholder={t('admin.timeclock.correctionReasonPlaceholder')}
                                className="input-elegant w-full"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={handleSaveTimeclock}>
                                {t('admin.employees.form.saveChanges')}
                              </Button>
                              <Button size="sm" variant="ghost" onClick={handleCancelTimeclockEdit}>
                                {t('common.cancel')}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {entry.status === "voided" ? (
                          <span className="text-xs text-muted-foreground">{t('admin.timeclock.notCountedInTotals')}</span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.hours.noEntries')}</p>
                )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
              <div className="mt-6 border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t('admin.hours.salaryCalculator')}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.hours.workedHours')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={workedHours}
                    onChange={(event) => setWorkedHours(event.target.value)}
                    className="input-elegant"
                    placeholder={t('admin.hours.workedHoursPlaceholder')}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.hours.hourlyRate')}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                    className="input-elegant"
                    placeholder={t('admin.hours.hourlyRatePlaceholder')}
                  />
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted">
                  <p className="text-sm text-muted-foreground">{t('admin.hours.estimatedTotal')}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {salaryTotal.toLocaleString(dateLocale, {
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
              <h2 className="text-2xl font-bold text-foreground mb-2">{t('admin.timeOff.title')}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t('admin.timeOff.subtitle')}
              </p>

              <h3 className="text-lg font-semibold text-foreground mb-3">{t('admin.timeOff.pendingTitle')}</h3>
              {(timeOffPendingQuery.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground mb-8">{t('admin.timeOff.noPending')}</p>
              ) : (
                <div className="space-y-4 mb-8">
                  {(timeOffPendingQuery.data || []).map((row) => (
                    <div key={row.id} className="rounded-lg border border-border p-4 space-y-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground">{row.employeeName}</p>
                          <p className="text-sm text-muted-foreground">
                            {row.kind === 'vacation'
                              ? t('common.timeOff.vacation')
                              : t('common.timeOff.daysOff')}{' '}
                            · {String(row.startDate)} → {String(row.endDate)}
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
                            {t('common.timeOff.approve')}
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
                            {t('common.timeOff.deny')}
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

              <h3 className="text-lg font-semibold text-foreground mb-2">{t('admin.timeOff.calendarTitle')}</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {t('admin.timeOff.legend')}
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
                              title={`${name} ${t('admin.timeOff.pendingSuffix')}`}
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
                <p className="text-center text-xs text-muted-foreground">{t('admin.timeOff.updatingCalendar')}</p>
              ) : null}

              <h3 className="text-lg font-semibold text-foreground mt-8 mb-3">{t('admin.timeOff.historyTitle')}</h3>
              {(timeOffAllQuery.data || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.timeOff.noRequests')}</p>
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
                          · {row.kind === 'vacation'
                            ? t('common.timeOff.vacation')
                            : t('common.timeOff.dayOffShort')}{' '}
                          · {String(row.startDate)} →{' '}
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
                            ? t('common.timeOff.status.approved')
                            : row.status === 'rejected'
                              ? t('common.timeOff.status.rejected')
                              : t('common.timeOff.status.pending')}
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
                                  ? t('admin.timeOff.confirmCancelApproved', {
                                      name: row.employeeName,
                                      start: String(row.startDate),
                                      end: String(row.endDate),
                                    })
                                  : t('admin.timeOff.confirmDeletePending', {
                                      name: row.employeeName,
                                    });
                              if (!window.confirm(msg)) return;
                              adminDeleteTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: row.id,
                              });
                            }}
                          >
                            {t('common.timeOff.cancel')}
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
              <h2 className="text-2xl font-bold text-foreground mb-6">{t('admin.incidents.title')}</h2>
              
              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.incidents.selectEmployee')}
                  </label>
                  <select
                    className="input-elegant"
                    value={incidentEmployeeId}
                    onChange={(event) => setIncidentEmployeeId(event.target.value)}
                  >
                    <option value="">{t('common.allEmployees')}</option>
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
                    {clearAllIncidents.isPending
                      ? t('common.deleting')
                      : t('admin.incidents.clearAll')}
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
                              ? t('common.incidents.lateArrival')
                              : incident.type === "early_exit"
                              ? t('common.incidents.earlyExit')
                              : t('common.incidents.other')}
                          </h4>
                          <p className="text-sm text-muted-foreground">
                            {employeeNameById.get(incident.employeeId) ||
                              t('common.employeeFallback', { id: incident.employeeId })}{" "}
                            · {formatClockDateShort(incident.createdAt)}
                          </p>
                        </div>
                        <span className={incident.status === "pending" ? "badge-warning" : incident.status === "approved" ? "badge-success" : "badge-error"}>
                          {incident.status === "pending"
                            ? t('common.incidents.status.pending')
                            : incident.status === "approved"
                              ? t('common.incidents.status.approved')
                              : t('common.incidents.status.rejected')}
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
                            {t('common.incidents.approve')}
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
                            {t('common.incidents.reject')}
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.incidents.none')}</p>
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
              <h2 className="text-2xl font-bold text-foreground mb-2">{t('admin.settings.title')}</h2>
              <p className="text-sm text-muted-foreground mb-6">
                {t('admin.settings.subtitle')}
              </p>

              <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t('admin.settings.locationTitle')}
              </h3>

              <div className="space-y-4 mb-8">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.settings.businessName')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.settings.businessNamePlaceholder')}
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t('admin.settings.address')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('admin.settings.addressPlaceholder')}
                    value={restaurantAddress}
                    onChange={(e) => setRestaurantAddress(e.target.value)}
                    className="input-elegant"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('admin.settings.validationRadius')}
                    </label>
                    <input
                      type="number"
                      placeholder={t('admin.settings.radiusPlaceholder')}
                      min={50}
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(Number(e.target.value))}
                      className="input-elegant"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('admin.settings.radiusHint')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-foreground mb-4">{t('admin.settings.selectLocation')}</h3>
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
                {t('admin.settings.saveLocation')}
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
            <DialogTitle>{t('admin.dialogs.forceClockOut.title')}</DialogTitle>
            <DialogDescription>
              {forceClockOutTarget
                ? t('admin.dialogs.forceClockOut.description', {
                    name: forceClockOutTarget.employeeName,
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-1">
            {forceClockOutTarget?.entryTime ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.dialogs.forceClockOut.entryRecorded', {
                  time: formatClockTime(forceClockOutTarget.entryTime),
                })}
              </p>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                {t('admin.dialogs.forceClockOut.exitTime')}
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
                {t('common.reason')}
              </label>
              <Textarea
                value={forceClockOutReason}
                onChange={(event) => setForceClockOutReason(event.target.value)}
                rows={3}
                placeholder={t('admin.dialogs.forceClockOut.reasonPlaceholder')}
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
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={submitAdminForceClockOut}
              disabled={adminForceClockOut.isPending}
            >
              {adminForceClockOut.isPending
                ? t('common.savingEllipsis')
                : t('admin.dialogs.forceClockOut.registerExit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShellLayout>
  );
}
