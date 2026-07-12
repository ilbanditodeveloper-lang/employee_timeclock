import { useMemo, useState, type ComponentProps } from "react";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { formatTimeInTimeZone, resolveAppTimeZone, todayYmdInTimeZone } from "@shared/timezone";
import { cn } from "@/lib/utils";

export default function EmployeeCalendar() {
  const { t, locale } = useLocale();
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();
  const appTimeZone = resolveAppTimeZone(employeeSession?.timezone);
  const dateFnsLocale = locale === "en" ? enUS : es;
  const numberLocale = locale === "en" ? "en-US" : "es-ES";
  const [selectionMode, setSelectionMode] = useState<"single" | "range">("single");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>();
  const [hoursWorked, setHoursWorked] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const employeeTimeclocks = trpc.publicApi.getEmployeeTimeclocks.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );

  const salaryTotal = useMemo(() => {
    const hours = Number(hoursWorked);
    const rate = Number(hourlyRate);
    if (Number.isNaN(hours) || Number.isNaN(rate)) return 0;
    return Math.max(hours, 0) * Math.max(rate, 0);
  }, [hoursWorked, hourlyRate]);

  const workedDayKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const entry of employeeTimeclocks.data ?? []) {
      if (!entry.entryTime || entry.status === "voided") continue;
      keys.add(todayYmdInTimeZone(appTimeZone, new Date(entry.entryTime)));
    }
    return keys;
  }, [employeeTimeclocks.data, appTimeZone]);

  const isWorkedDay = (date: Date) =>
    workedDayKeys.has(todayYmdInTimeZone(appTimeZone, date));

  const workedDayCalendarProps = {
    modifiers: { worked: isWorkedDay },
    components: {
      DayButton: (btnProps: ComponentProps<typeof CalendarDayButton>) => {
        const { worked, selected, range_start, range_end, range_middle } = btnProps.modifiers;
        const isRangeDay = range_start || range_end || range_middle;
        return (
          <CalendarDayButton
            {...btnProps}
            className={cn(
              btnProps.className,
              worked &&
                !selected &&
                !isRangeDay &&
                "bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:bg-emerald-900/45 dark:text-emerald-50 dark:hover:bg-emerald-800/55"
            )}
          >
            {btnProps.children}
            {worked ? (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  selected || range_start || range_end
                    ? "bg-emerald-300 dark:bg-emerald-400"
                    : "bg-emerald-600 dark:bg-emerald-400"
                )}
                aria-hidden
              />
            ) : null}
          </CalendarDayButton>
        );
      },
    },
  };

  const filteredTimeclocks = useMemo(() => {
    return (employeeTimeclocks.data || []).filter((entry) => {
      if (!entry.entryTime) return false;
      const entryYmd = todayYmdInTimeZone(appTimeZone, new Date(entry.entryTime));
      if (selectionMode === "range") {
        if (!selectedRange?.from || !selectedRange?.to) return false;
        const startYmd = todayYmdInTimeZone(appTimeZone, selectedRange.from);
        const endYmd = todayYmdInTimeZone(appTimeZone, selectedRange.to);
        return entryYmd >= startYmd && entryYmd <= endYmd;
      }
      if (!selectedDate) return false;
      return entryYmd === todayYmdInTimeZone(appTimeZone, selectedDate);
    });
  }, [
    employeeTimeclocks.data,
    appTimeZone,
    selectionMode,
    selectedRange,
    selectedDate,
  ]);

  const totalHours = filteredTimeclocks.reduce((total, entry) => {
    if (!entry.entryTime || !entry.exitTime) return total;
    const start = new Date(entry.entryTime).getTime();
    const end = new Date(entry.exitTime).getTime();
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return total;
    return total + (end - start) / (1000 * 60 * 60);
  }, 0);

  if (isAuthLoading || !isEmployeeAuthenticated) {
    return null;
  }

  return (
    <EmployeeShellLayout
      pageTitle={t("employee.calendar.pageTitle")}
      pageSubtitle={t("employee.calendar.pageSubtitle")}
      contentClassName="container mx-auto max-w-4xl py-8 pb-28 md:pb-8"
    >
        <Card className="app-shell-card mx-auto max-w-3xl border-0 p-6 shadow-sm">
          <div className="grid gap-6 md:grid-cols-[auto,1fr] items-start">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(prev => (prev ? addDays(prev, -1) : new Date()))
                  }
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center text-sm font-medium text-foreground">
                  {selectionMode === "range"
                    ? selectedRange?.from && selectedRange?.to
                      ? `${format(selectedRange.from, "d MMM yyyy", { locale: dateFnsLocale })} - ${format(selectedRange.to, "d MMM yyyy", { locale: dateFnsLocale })}`
                      : t("employee.calendar.selectRange")
                    : selectedDate
                    ? format(selectedDate, "eeee, d MMMM yyyy", { locale: dateFnsLocale })
                    : t("employee.calendar.selectDay")}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() =>
                    setSelectedDate(prev => (prev ? addDays(prev, 1) : new Date()))
                  }
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setSelectionMode("single")}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectionMode === "single"
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent text-foreground hover:bg-muted"
                  }`}
                >
                  {t("employee.calendar.singleDay")}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectionMode("range")}
                  className={`px-4 py-2 text-sm font-medium ${
                    selectionMode === "range"
                      ? "bg-accent text-accent-foreground"
                      : "bg-transparent text-foreground hover:bg-muted"
                  }`}
                >
                  {t("employee.calendar.dayRange")}
                </button>
              </div>
              {selectionMode === "range" ? (
                <Calendar
                  mode="range"
                  selected={selectedRange}
                  onSelect={setSelectedRange}
                  {...workedDayCalendarProps}
                />
              ) : (
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  {...workedDayCalendarProps}
                />
              )}
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-block size-3 rounded-sm border border-emerald-400 bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-900/45"
                  aria-hidden
                />
                {t("employee.calendar.workedDayLegend")}
              </p>
            </div>
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground">
                {selectionMode === "range" ? t("employee.calendar.rangeDetail") : t("employee.calendar.dayDetail")}
              </h2>
              <div className="p-4 rounded-lg border border-border bg-muted">
                <p className="text-sm text-muted-foreground">
                  {selectionMode === "range"
                    ? selectedRange?.from && selectedRange?.to
                      ? `${selectedRange.from.toLocaleDateString(numberLocale, {
                          day: "numeric",
                          month: "long",
                        })} - ${selectedRange.to.toLocaleDateString(numberLocale, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}`
                      : t("employee.calendar.selectRangeHint")
                    : selectedDate
                    ? selectedDate.toLocaleDateString(numberLocale, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : t("employee.calendar.selectDayHint")}
                </p>
                <p className="mt-3 text-sm text-foreground">
                  {t("employee.calendar.hoursRegistered", { hours: totalHours.toFixed(2) })}
                </p>
                <p className="text-sm text-foreground">
                  {t("employee.calendar.incidents", { count: "0" })}
                </p>
              </div>
              <div className="space-y-2">
                {filteredTimeclocks.length ? (
                  filteredTimeclocks.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                      <div>
                        <p className="text-sm text-foreground">
                          {t("employee.calendar.clockIn")}{" "}
                          {entry.entryTime
                            ? formatTimeInTimeZone(new Date(entry.entryTime), appTimeZone)
                            : t("employee.calendar.noEntry")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("employee.calendar.clockOut")}{" "}
                          {entry.exitTime
                            ? formatTimeInTimeZone(new Date(entry.exitTime), appTimeZone)
                            : t("employee.calendar.pending")}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {entry.entryTime
                          ? new Date(entry.entryTime).toLocaleDateString(numberLocale, { timeZone: appTimeZone })
                          : ""}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">{t("employee.calendar.noEntries")}</p>
                )}
              </div>
              <div className="border border-border rounded-lg p-4 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">
                  {t("employee.calendar.salaryCalculator")}
                </h3>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("employee.calculator.hoursWorked")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    value={hoursWorked}
                    onChange={(event) => setHoursWorked(event.target.value)}
                    className="input-elegant"
                    placeholder={t("employee.calculator.hoursPlaceholder")}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    {t("employee.calendar.hourlyWage")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={hourlyRate}
                    onChange={(event) => setHourlyRate(event.target.value)}
                    className="input-elegant"
                    placeholder={t("employee.calculator.ratePlaceholder")}
                  />
                </div>
                <div className="p-3 rounded-lg border border-border bg-muted">
                  <p className="text-sm text-muted-foreground">{t("employee.calendar.estimatedTotal")}</p>
                  <p className="text-lg font-semibold text-foreground">
                    {salaryTotal.toLocaleString(numberLocale, {
                      style: "currency",
                      currency: "EUR",
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>
    </EmployeeShellLayout>
  );
}
