import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";

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
  isActive: boolean;
};

function getShiftLabel(daySchedule?: DaySchedule): string {
  if (!daySchedule || !daySchedule.isActive) return "Día libre";
  if (daySchedule.entry1 && daySchedule.entry2) return "Turno Partido";
  if (!daySchedule.entry1) return "Día libre";

  const hour = Number(daySchedule.entry1.split(":")[0] || "0");
  return hour >= 14 ? "Tarde" : "Mañana";
}

export default function EmployeeSchedule() {
  const { employeeSession } = useAuthContext();

  const employeeScheduleQuery = trpc.publicApi.getEmployeeSchedule.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled: Boolean(employeeSession?.employeeId) }
  );

  const normalizedSchedule = useMemo(() => {
    return scheduleDays.map((day) => {
      const value = (employeeScheduleQuery.data?.[day.key] || {
        entry1: "",
        entry2: "",
        isActive: false,
      }) as DaySchedule;
      return {
        ...day,
        value,
      };
    });
  }, [employeeScheduleQuery.data]);

  return (
    <EmployeeShellLayout
      pageTitle="Horario"
      pageSubtitle="Turnos asignados por tu administrador"
      contentClassName="container mx-auto max-w-4xl py-8 pb-28 md:pb-8"
    >
        <Card className="app-shell-card border-0 p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-foreground mb-2">Calendario semanal de turnos</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tu administrador configura estos turnos. Aquí puedes ver tu planificación por día.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {normalizedSchedule.map((day) => (
              <div key={day.key} className="border border-border rounded-lg p-4 bg-card">
                <p className="font-semibold text-foreground">{day.label}</p>
                <p className="text-sm mt-2 text-foreground">{getShiftLabel(day.value)}</p>
              </div>
            ))}
          </div>
        </Card>
    </EmployeeShellLayout>
  );
}
