import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Palmtree, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { employeeQueryInput, emptyCreds } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { resolveAppTimeZone, todayYmdInTimeZone, APP_TIMEZONE } from "@shared/timezone";

const kindLabels: Record<string, string> = {
  vacation: "Vacaciones",
  day_off: "Día libre",
};

const statusLabels: Record<string, string> = {
  pending: "Pendiente",
  approved: "Aprobada",
  rejected: "Denegada",
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}


function ymdRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export default function EmployeeTimeOff() {
  const [, setLocation] = useLocation();
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();
  const appTimeZone = resolveAppTimeZone(employeeSession?.timezone);
  const todayYmd = () => todayYmdInTimeZone(appTimeZone);
  const [kind, setKind] = useState<"vacation" | "day_off">("vacation");
  const [startDate, setStartDate] = useState(() => todayYmdInTimeZone(APP_TIMEZONE));
  const [endDate, setEndDate] = useState(() => todayYmdInTimeZone(APP_TIMEZONE));
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const enabled = Boolean(employeeSession?.employeeId);

  const listQuery = trpc.publicApi.listMyTimeOffRequests.useQuery(
    employeeQueryInput(employeeSession?.employeeId ?? 0),
    { enabled }
  );

  const createMutation = trpc.publicApi.createTimeOffRequest.useMutation();
  const deleteMutation = trpc.publicApi.deleteMyTimeOffRequest.useMutation();

  const blockedRanges = useMemo(() => {
    return (listQuery.data || [])
      .filter((r) => r.status === "pending" || r.status === "approved")
      .map((r) => ({ start: String(r.startDate), end: String(r.endDate) }));
  }, [listQuery.data]);

  const rangeBlocks = useMemo(() => {
    const minD = todayYmd();
    const order = !startDate || !endDate || endDate < startDate;
    const past =
      Boolean(startDate && endDate) && (startDate < minD || endDate < minD);
    const overlap =
      Boolean(startDate && endDate) &&
      !order &&
      blockedRanges.some((b) => ymdRangesOverlap(startDate, endDate, b.start, b.end));
    return { past, order, overlap };
  }, [startDate, endDate, blockedRanges, appTimeZone]);

  const rangeInvalid = rangeBlocks.past || rangeBlocks.order || rangeBlocks.overlap;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeSession) {
      toast.error("Inicia sesión");
      setLocation("/employee-login");
      return;
    }
    if (!comment.trim()) {
      toast.error("Debes escribir un comentario (motivo o detalles)");
      return;
    }
    if (rangeInvalid) {
      if (rangeBlocks.order) {
        toast.error("La fecha fin debe ser igual o posterior a la de inicio.");
      } else if (rangeBlocks.past) {
        toast.error("No puedes elegir fechas anteriores a hoy.");
      } else if (rangeBlocks.overlap) {
        toast.error(
          "Esas fechas coinciden con otra solicitud pendiente o aprobada. Elige otros días."
        );
      }
      return;
    }
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        ...employeeQueryInput(employeeSession!.employeeId),
        kind,
        startDate,
        endDate,
        comment: comment.trim(),
      });
      toast.success("Solicitud enviada. El administrador la revisará.");
      setComment("");
      const next = todayYmd();
      setStartDate(next);
      setEndDate(next);
      await listQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo enviar la solicitud"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRequest = async (requestId: number, status: string) => {
    if (!employeeSession) return;
    const msg =
      status === "approved"
        ? "¿Anular esta solicitud ya aprobada? Los días dejarán de figurar como libres y no podrás deshacerlo."
        : "¿Borrar esta solicitud pendiente? No podrás deshacerlo.";
    const ok = window.confirm(msg);
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync({
        ...employeeQueryInput(employeeSession!.employeeId),
        requestId,
      });
      toast.success(status === "approved" ? "Solicitud aprobada anulada" : "Solicitud eliminada");
      await listQuery.refetch();
    } catch (err) {
      toast.error(getErrorMessage(err, "No se pudo borrar la solicitud"));
    }
  };

  if (isAuthLoading || !isAdminAuthenticated) {
    return null;
  }

  return (
    <EmployeeShellLayout
      pageTitle="Vacaciones"
      pageSubtitle="Solicitudes de vacaciones y días libres"
      contentClassName="container mx-auto max-w-2xl space-y-8 py-8 pb-28 md:pb-8"
    >
        <Card className="app-shell-card border-0 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Nueva solicitud</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label className="text-foreground">Tipo</Label>
              <select
                value={kind}
                onChange={(ev) => setKind(ev.target.value as "vacation" | "day_off")}
                className="input-elegant mt-2 w-full"
              >
                <option value="vacation">Vacaciones</option>
                <option value="day_off">Día(s) libre(s)</option>
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-foreground">Desde</Label>
                <input
                  type="date"
                  value={startDate}
                  min={todayYmd()}
                  onChange={(ev) => {
                    const minD = todayYmd();
                    const raw = ev.target.value;
                    const nextStart = raw < minD ? minD : raw;
                    setStartDate(nextStart);
                    setEndDate((prev) => {
                      const e = prev < nextStart ? nextStart : prev;
                      return e < minD ? minD : e;
                    });
                  }}
                  className="input-elegant mt-2 w-full"
                  required
                />
              </div>
              <div>
                <Label className="text-foreground">Hasta (incluido)</Label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate < todayYmd() ? todayYmd() : startDate}
                  onChange={(ev) => {
                    const minD = todayYmd();
                    const minEnd = startDate < minD ? minD : startDate;
                    const raw = ev.target.value;
                    setEndDate(raw < minEnd ? minEnd : raw);
                  }}
                  className="input-elegant mt-2 w-full"
                  required
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo fechas desde hoy (calendario España). No puedes repetir días que ya tienes en una
              solicitud pendiente o aprobada.
            </p>
            {rangeBlocks.order ? (
              <p className="text-sm text-destructive">
                La fecha de fin no puede ser anterior a la de inicio.
              </p>
            ) : null}
            {rangeBlocks.past && !rangeBlocks.order ? (
              <p className="text-sm text-destructive">No uses fechas anteriores a hoy.</p>
            ) : null}
            {rangeBlocks.overlap && !rangeBlocks.order && !rangeBlocks.past ? (
              <p className="text-sm text-destructive">
                Este rango coincide con otra solicitud pendiente o aprobada. Elige otras fechas.
              </p>
            ) : null}
            <div>
              <Label className="text-foreground">Comentario (obligatorio)</Label>
              <Textarea
                value={comment}
                onChange={(ev) => setComment(ev.target.value)}
                placeholder="Motivo, notas para el administrador…"
                className="mt-2 min-h-[100px]"
                required
              />
            </div>
            <Button type="submit" className="w-full btn-primary" disabled={submitting || rangeInvalid}>
              {submitting ? "Enviando…" : "Enviar solicitud"}
            </Button>
          </form>
        </Card>

        <Card className="app-shell-card border-0 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground mb-4">Mis solicitudes</h2>
          {listQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (listQuery.data || []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay solicitudes.</p>
          ) : (
            <ul className="space-y-3">
              {(listQuery.data || []).map((row) => (
                <li
                  key={row.id}
                  className="rounded-lg border border-border p-3 text-sm bg-muted/30"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">
                      {kindLabels[row.kind] ?? row.kind}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          row.status === "approved"
                            ? "text-green-600 dark:text-green-400"
                            : row.status === "rejected"
                              ? "text-red-600 dark:text-red-400"
                              : "text-amber-600 dark:text-amber-400"
                        }
                      >
                        {statusLabels[row.status] ?? row.status}
                      </span>
                      {row.status === "pending" || row.status === "approved" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-destructive border-destructive/40 hover:bg-destructive/10"
                          disabled={deleteMutation.isPending}
                          onClick={() => handleDeleteRequest(row.id, row.status)}
                          title={
                            row.status === "approved"
                              ? "Anular solicitud aprobada"
                              : "Borrar solicitud pendiente"
                          }
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-muted-foreground mt-1">
                    {String(row.startDate)} → {String(row.endDate)}
                  </p>
                  <p className="mt-2 text-foreground whitespace-pre-wrap">{row.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
    </EmployeeShellLayout>
  );
}
