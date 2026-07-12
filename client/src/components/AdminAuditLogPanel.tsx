import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ClipboardList } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import { useLocale } from "@/contexts/LocaleContext";

const AUDIT_ACTIONS = [
  "correct",
  "void",
  "void_bulk",
  "update_legal",
  "complete_onboarding",
  "deactivate",
  "update_schedule",
] as const;

const ENTITY_TYPES = ["timeclock", "employee", "company", "incident"] as const;

export default function AdminAuditLogPanel() {
  const { t } = useLocale();
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

  const actionLabels = useMemo(
    () =>
      Object.fromEntries(
        AUDIT_ACTIONS.map((key) => [key, t(`admin.audit.actions.${key}`)])
      ) as Record<string, string>,
    [t]
  );

  const actionOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.action));
    return Array.from(set).sort();
  }, [rows]);

  const entityLabel = (type: string) =>
    ENTITY_TYPES.includes(type as (typeof ENTITY_TYPES)[number])
      ? t(`admin.audit.entityTypes.${type}`)
      : type;

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="mb-2 flex items-center gap-2 text-2xl font-bold text-foreground">
          <ClipboardList className="h-6 w-6" />
          {t("admin.audit.title")}
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
          {t("admin.audit.description")}
        </p>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="audit-from">{t("admin.audit.filters.from")}</Label>
            <input
              id="audit-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input-elegant mt-1"
            />
          </div>
          <div>
            <Label htmlFor="audit-to">{t("admin.audit.filters.to")}</Label>
            <input
              id="audit-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input-elegant mt-1"
            />
          </div>
          <div>
            <Label htmlFor="audit-employee">{t("admin.audit.filters.employee")}</Label>
            <select
              id="audit-employee"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">{t("admin.audit.filters.allEmployees")}</option>
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="audit-entity">{t("admin.audit.filters.entity")}</Label>
            <select
              id="audit-entity"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">{t("admin.audit.filters.all")}</option>
              {ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`admin.audit.entityTypes.${type}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="audit-action">{t("admin.audit.filters.action")}</Label>
            <select
              id="audit-action"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="input-elegant mt-1 w-full"
            >
              <option value="">{t("admin.audit.filters.all")}</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {actionLabels[a] ?? a}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button type="button" variant="outline" onClick={() => auditQuery.refetch()}>
              {t("admin.audit.filters.refresh")}
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-3">{t("admin.audit.table.datetime")}</th>
                <th className="py-2 pr-3">{t("admin.audit.table.user")}</th>
                <th className="py-2 pr-3">{t("admin.audit.table.action")}</th>
                <th className="py-2 pr-3">{t("admin.audit.table.entity")}</th>
                <th className="py-2 pr-3">{t("admin.audit.table.employee")}</th>
                <th className="py-2 pr-3">{t("admin.audit.table.change")}</th>
                <th className="py-2">{t("admin.audit.table.reason")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">
                    {format(new Date(row.performedAt), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="py-2 pr-3">{row.performedByName ?? row.performedByType}</td>
                  <td className="py-2 pr-3">{actionLabels[row.action] ?? row.action}</td>
                  <td className="py-2 pr-3">
                    {entityLabel(row.entityType)} #{row.entityId}
                  </td>
                  <td className="py-2 pr-3">{row.affectedEmployeeName ?? "—"}</td>
                  <td className="py-2 pr-3 max-w-xs text-xs text-muted-foreground">{row.summary}</td>
                  <td className="py-2 text-xs">{row.reason ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!auditQuery.isLoading && rows.length === 0 && (
            <p className="py-6 text-sm text-muted-foreground">{t("admin.audit.empty")}</p>
          )}
          {auditQuery.isLoading && (
            <p className="py-6 text-sm text-muted-foreground">{t("admin.audit.loading")}</p>
          )}
        </div>
      </Card>
    </div>
  );
}
