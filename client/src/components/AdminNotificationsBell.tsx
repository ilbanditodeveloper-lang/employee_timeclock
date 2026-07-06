import { Bell, AlertCircle, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { adminApiInput } from "@/lib/adminContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AdminNotificationsBellProps = {
  onOpenTimeOff?: () => void;
  onOpenIncidents?: () => void;
};

const INCIDENT_TYPE_LABELS: Record<string, string> = {
  late_arrival: "Llegada tarde",
  early_exit: "Salida anticipada",
  absence: "Ausencia",
  other: "Otra incidencia",
};

const TIME_OFF_KIND_LABELS: Record<string, string> = {
  vacation: "Vacaciones",
  day_off: "Día libre",
};

function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

export default function AdminNotificationsBell({
  onOpenTimeOff,
  onOpenIncidents,
}: AdminNotificationsBellProps) {
  const trpcUtils = trpc.useUtils();
  const query = trpc.publicApi.getAdminNotificationCenter.useQuery(adminApiInput(), {
    refetchInterval: 60_000,
  });
  const decideTimeOff = trpc.publicApi.decideTimeOffRequest.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "approved"
          ? "Solicitud aprobada"
          : "Solicitud denegada"
      );
      void query.refetch();
      void trpcUtils.publicApi.listTimeOffRequests.invalidate();
      void trpcUtils.publicApi.getTimeOffCalendarMonth.invalidate();
      void trpcUtils.publicApi.getTodayWorkforceStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "No se pudo actualizar la solicitud");
    },
  });
  const total = query.data?.totalCount ?? 0;
  const decidingId = decideTimeOff.isPending ? decideTimeOff.variables?.requestId : null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${total > 0 ? `, ${total} pendientes` : ""}`}
        >
          <Bell className="size-4" />
          {total > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full",
                "bg-rose-600 px-1 text-[10px] font-bold text-white"
              )}
            >
              {total > 9 ? "9+" : total}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Notificaciones</p>
          <p className="text-xs text-muted-foreground">
            Vacaciones e incidencias pendientes de revisar
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {query.isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Cargando…</p>
          ) : total === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">No hay pendientes.</p>
          ) : (
            <div className="space-y-3">
              {(query.data?.timeOff ?? []).length > 0 ? (
                <section>
                  <div className="mb-1 flex items-center justify-between gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <Palmtree className="size-3.5 text-teal-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Vacaciones / ausencias
                      </p>
                    </div>
                    {onOpenTimeOff ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700 hover:underline"
                        onClick={onOpenTimeOff}
                      >
                        Ver todas
                      </button>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {(query.data?.timeOff ?? []).map((item) => (
                      <li
                        key={`to-${item.id}`}
                        className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground">{item.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {TIME_OFF_KIND_LABELS[item.kind] ?? item.kind} ·{" "}
                          {formatShortDate(item.startDate)}
                          {item.endDate !== item.startDate
                            ? ` – ${formatShortDate(item.endDate)}`
                            : ""}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                            disabled={decidingId === item.id}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: item.id,
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
                            className="h-7 px-2 text-xs"
                            disabled={decidingId === item.id}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: item.id,
                                decision: "rejected",
                              })
                            }
                          >
                            Denegar
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {(query.data?.incidents ?? []).length > 0 ? (
                <section>
                  <div className="mb-1 flex items-center justify-between gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3.5 text-amber-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Incidencias
                      </p>
                    </div>
                    {onOpenIncidents ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700 hover:underline"
                        onClick={onOpenIncidents}
                      >
                        Ver todas
                      </button>
                    ) : null}
                  </div>
                  <ul className="space-y-1">
                    {(query.data?.incidents ?? []).map((item) => (
                      <li key={`inc-${item.id}`}>
                        <button
                          type="button"
                          className="w-full rounded-lg px-2 py-2 text-left hover:bg-muted/70"
                          onClick={onOpenIncidents}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{item.employeeName}</p>
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              Pendiente
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {INCIDENT_TYPE_LABELS[item.type] ?? item.type}
                            {item.reason ? ` · ${item.reason}` : ""}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
