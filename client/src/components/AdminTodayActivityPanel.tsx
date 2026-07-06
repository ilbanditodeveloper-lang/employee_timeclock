import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { adminApiInput } from "@/lib/adminContext";

const ACTION_LABELS: Record<string, string> = {
  correct: "Corrección de fichaje",
  void: "Anulación de fichaje",
  void_bulk: "Anulación masiva",
  update_schedule: "Cambio de horario",
};

function formatTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
}

export default function AdminTodayActivityPanel() {
  const query = trpc.publicApi.getAdminTodayActivity.useQuery(adminApiInput(), {
    refetchInterval: 60_000,
  });
  const items = query.data?.items ?? [];

  return (
    <Card className="app-shell-card border-0 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardList className="size-5" />
            Actividad de hoy
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Cierres manuales, correcciones y cambios de horario
            {query.data?.date
              ? ` · ${query.data.date.split("-").reverse().join("/")}`
              : ""}
          </p>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando actividad…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Hoy no hay correcciones de fichajes ni cambios de horario registrados.
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {ACTION_LABELS[item.action] ?? item.action}
                </p>
                <span className="text-xs text-muted-foreground">
                  {formatTime(item.performedAt)}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground">
                {item.affectedEmployeeName ?? "Empleado"}
                {item.performedByName ? (
                  <span className="text-muted-foreground"> · por {item.performedByName}</span>
                ) : null}
              </p>
              {item.summary ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
              ) : null}
              {item.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">Motivo: {item.reason}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
