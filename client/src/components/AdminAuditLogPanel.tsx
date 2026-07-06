import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";

const ACTION_LABELS: Record<string, string> = {
  correct: "Corrección fichaje",
  void: "Anulación fichaje",
  void_bulk: "Anulación masiva",
  update_legal: "Actualización legal",
  complete_onboarding: "Onboarding completado",
  deactivate: "Desactivar empleado",
  update_schedule: "Cambio de horario",
};

export default function AdminAuditLogPanel() {
  const defaultTo = format(new Date(), "yyyy-MM-dd");
  const defaultFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");

  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const employeesQuery = trpc.publicApi.listEmployees.useQuery(emptyCreds);

  const auditQuery = trpc.publicApi.listAuditLogs.useQuery({
    ...emptyCreds,
    dateFrom,
    dateTo,
    entityType: entityType
      ? (entityType as "timeclock" | "employee" | "company" | "incident")
      : undefined,
    action: action || undefined,
    employeeId: employeeId ? Number(employeeId) : undefined,
    limit: 200,
  });

  const rows = auditQuery.data ?? [];

  const actionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.action));
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardList className="h-6 w-6" />
          Historial de cambios
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          Registro de auditoría de su empresa (solo lectura). Incluye correcciones y anulaciones de
          fichajes, cambios legales y desactivaciones. No se pueden editar ni eliminar estos registros.
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="audit-from">Desde</Label>
            <input
              id="audit-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-elegant mt-1"
            />
          </div>
          <div>
            <Label htmlFor="audit-to">Hasta</Label>
            <input
              id="audit-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-elegant mt-1"
            />
          </div>
          <div>
            <Label htmlFor="audit-employee">Empleado</Label>
            <select
              id="audit-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">Todos</option>
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="audit-entity">Entidad</Label>
            <select
              id="audit-entity"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">Todas</option>
              <option value="timeclock">Fichaje</option>
              <option value="employee">Empleado</option>
              <option value="company">Empresa</option>
              <option value="incident">Incidencia</option>
            </select>
          </div>
          <div>
            <Label htmlFor="audit-action">Acción</Label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">Todas</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {ACTION_LABELS[a] ?? a}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => auditQuery.refetch()}>
              Actualizar
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">Fecha/hora</th>
                <th className="py-2 pr-3">Usuario</th>
                <th className="py-2 pr-3">Acción</th>
                <th className="py-2 pr-3">Entidad</th>
                <th className="py-2 pr-3">Empleado</th>
                <th className="py-2 pr-3">Cambio</th>
                <th className="py-2">Motivo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {format(new Date(row.performedAt), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="py-2 pr-3">{row.performedByName ?? row.performedByType}</td>
                  <td className="py-2 pr-3">{ACTION_LABELS[row.action] ?? row.action}</td>
                  <td className="py-2 pr-3">
                    {row.entityType} #{row.entityId}
                  </td>
                  <td className="py-2 pr-3">{row.affectedEmployeeName ?? "—"}</td>
                  <td className="py-2 pr-3 max-w-xs text-xs text-muted-foreground">{row.summary}</td>
                  <td className="py-2 text-xs">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!auditQuery.isLoading && rows.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">No hay registros con los filtros actuales.</p>
          )}
          {auditQuery.isLoading && (
            <p className="py-6 text-sm text-muted-foreground">Cargando auditoría…</p>
          )}
        </div>
      </Card>
    </div>
  );
}
