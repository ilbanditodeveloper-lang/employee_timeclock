import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { resolveScheduleExitTime } from "@shared/scheduleExit";

const scheduleDays = [
  { key: "monday", label: "Lunes" },
  { key: "tuesday", label: "Martes" },
  { key: "wednesday", label: "Miércoles" },
  { key: "thursday", label: "Jueves" },
  { key: "friday", label: "Viernes" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" },
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

function getShiftSummary(daySchedule?: DaySchedule): string {
  if (!daySchedule || !daySchedule.isActive) return "Día libre";
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
  if (ranges.length === 0) return "Día libre";
  return ranges.join(" · ");
}

export default function EmployeeSchedule() {
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();

  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );

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
        summary: getShiftSummary(value),
      };
    });
  }, [employeeScheduleQuery.data]);

  if (isAuthLoading || !isEmployeeAuthenticated) {
    return null;
  }

  return (
    <EmployeeShellLayout
      pageTitle="Horario"
      pageSubtitle="Turnos asignados por tu administrador"
      contentClassName="container mx-auto max-w-4xl py-8 pb-28 md:pb-8"
    >
      <Card className="app-shell-card border-0 p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">Calendario semanal de turnos</h2>
        <p className="text-sm text-muted-foreground mb-6">
          Recibirás avisos 1 minuto antes y a la hora de entrada y salida según este horario.
        </p>

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
