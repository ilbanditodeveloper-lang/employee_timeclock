import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { resolveScheduleExitTime } from "@shared/scheduleExit";

const scheduleDayKeys = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DaySchedule = {
  entry1: string;
  entry2: string;
  exit1?: string;
  exit2?: string;
  isActive: boolean;
};

function formatShiftRange(entry: string, exit: string | null) {
  if (!entry) return null;
  return `${entry} – ${exit ?? "—"}`;
}

function getShiftSummary(daySchedule: DaySchedule | undefined, dayOffLabel: string): string {
  if (!daySchedule || !daySchedule.isActive) return dayOffLabel;
  const ranges: string[] = [];
  if (daySchedule.entry1) {
    const exit1 = resolveScheduleExitTime({
      entryTime: daySchedule.entry1,
      exitTime: daySchedule.exit1,
      nextEntryTime: daySchedule.entry2,
    });
    const label = formatShiftRange(daySchedule.entry1, exit1);
    if (label) ranges.push(label);
  }
  if (daySchedule.entry2) {
    const exit2 = resolveScheduleExitTime({
      entryTime: daySchedule.entry2,
      exitTime: daySchedule.exit2,
    });
    const label = formatShiftRange(daySchedule.entry2, exit2);
    if (label) ranges.push(label);
  }
  if (ranges.length === 0) return dayOffLabel;
  return ranges.join(" · ");
}

export default function EmployeeSchedule() {
  const { t } = useLocale();
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();

  const scheduleDays = useMemo(
    () =>
      scheduleDayKeys.map((key) => ({
        key,
        label: t(`common.weekdays.${key}`),
      })),
    [t]
  );

  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );

  const dayOffLabel = t("common.dayOff");

  const normalizedSchedule = useMemo(() => {
    return scheduleDays.map((day) => {
      const value = (employeeScheduleQuery.data?.[day.key] || {
        entry1: "",
        entry2: "",
        exit1: "",
        exit2: "",
        isActive: false,
      }) as DaySchedule;
      return {
        ...day,
        value,
        summary: getShiftSummary(value, dayOffLabel),
      };
    });
  }, [employeeScheduleQuery.data, scheduleDays, dayOffLabel]);

  if (isAuthLoading || !isEmployeeAuthenticated) {
    return null;
  }

  return (
    <EmployeeShellLayout
      pageTitle={t("employee.schedule.pageTitle")}
      pageSubtitle={t("employee.schedule.pageSubtitle")}
      contentClassName="container mx-auto max-w-4xl py-8 pb-28 md:pb-8"
    >
      <Card className="app-shell-card border-0 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">{t("employee.schedule.title")}</h2>
        <p className="text-sm text-muted-foreground mb-6">{t("employee.schedule.description")}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {normalizedSchedule.map((day) => (
            <div key={day.key} className="border border-border rounded-lg p-4 bg-card">
              <p className="font-semibold text-foreground">{day.label}</p>
              <p className="text-sm mt-2 text-foreground">{day.summary}</p>
            </div>
          ))}
        </div>
      </Card>
    </EmployeeShellLayout>
  );
}
