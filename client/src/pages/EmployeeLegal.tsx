import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { downloadLaborReportCsv, downloadOfficialLaborReportPdf } from "@/lib/laborReportExport";
import { calendarMonthRange } from "@shared/laborReport";
import { LEGAL_DISCLAIMER } from "@shared/legalCompliance";

export default function EmployeeLegal() {
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();
  const employeeId = employeeSession?.employeeId ?? 0;
  const enabled = Boolean(employeeId);

  const portalQuery = trpc.publicApi.getEmployeeLegalPortal.useQuery(
    employeeQueryInput(employeeId),
    { enabled }
  );
  const submitGdpr = trpc.publicApi.submitGdprRequest.useMutation();
  const trpcUtils = trpc.useUtils();

  const [requestType, setRequestType] = useState<
    "access" | "rectification" | "erasure" | "restriction" | "objection" | "portability" | "other"
  >("access");
  const [message, setMessage] = useState("");
  const [exportBusy, setExportBusy] = useState(false);

  const currentMonth = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }, []);

  const prevMonth = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }, []);

  const downloadRange = async (from: string, to: string, format: "csv" | "pdf") => {
    if (!employeeId) return;
    setExportBusy(true);
    try {
      const bundle = await trpcUtils.publicApi.getMyLaborReportBundle.fetch({
        ...employeeQueryInput(employeeId),
        dateFrom: from,
        dateTo: to,
      });
      if (format === "csv") downloadLaborReportCsv(bundle);
      else downloadOfficialLaborReportPdf(bundle);
      toast.success("Descarga iniciada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo exportar");
    } finally {
      setExportBusy(false);
    }
  };

  const handleGdprSubmit = async () => {
    if (!employeeId || message.trim().length < 10) {
      toast.error("Escribe un mensaje de al menos 10 caracteres");
      return;
    }
    try {
      await submitGdpr.mutateAsync({
        ...employeeQueryInput(employeeId),
        requestType,
        message: message.trim(),
      });
      toast.success("Solicitud registrada. La empresa la revisará.");
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar la solicitud");
    }
  };

  if (isAuthLoading || !isEmployeeAuthenticated) return null;

  const latestAcceptance = portalQuery.data?.acceptances[0];

  return (
    <EmployeeShellLayout
      pageTitle="Información legal y privacidad"
      pageSubtitle="Aviso informativo, descargas y derechos RGPD"
      contentClassName="container mx-auto max-w-2xl space-y-6 py-8 pb-28 md:pb-8"
    >
      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Aviso al trabajador</h2>
        <p className="text-sm text-muted-foreground mb-3">{LEGAL_DISCLAIMER}</p>
        {latestAcceptance ? (
          <p className="text-sm">
            Versión aceptada: <strong>{latestAcceptance.documentVersion}</strong> ·{" "}
            {new Date(latestAcceptance.acceptedAt).toLocaleString("es-ES")}
          </p>
        ) : (
          <p className="text-sm text-amber-700">Aún no consta acuse de lectura en el sistema.</p>
        )}
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/legal/employee-notice">Leer aviso informativo vigente</Link>
        </Button>
        {portalQuery.data?.locationEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Geolocalización activa en su empresa: solo se registra ubicación aproximada al fichar. No hay
            seguimiento continuo.
          </p>
        ) : null}
      </Card>

      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Descargar mis registros de jornada</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Exportación orientativa para su consulta. Incluye pausas y horas netas cuando existan registros.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={exportBusy}
            onClick={() => {
              const { from, to } = calendarMonthRange(currentMonth.year, currentMonth.month);
              void downloadRange(from, to, "pdf");
            }}
          >
            Mes actual (PDF)
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exportBusy}
            onClick={() => {
              const { from, to } = calendarMonthRange(prevMonth.year, prevMonth.month);
              void downloadRange(from, to, "csv");
            }}
          >
            Mes anterior (CSV)
          </Button>
        </div>
      </Card>

      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">Ejercicio de derechos RGPD</h2>
        <p className="text-sm text-muted-foreground mb-2">
          {portalQuery.data?.gdprErasureNotice}
        </p>
        <div className="space-y-3">
          <select
            className="input-elegant w-full"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as typeof requestType)}
          >
            <option value="access">Acceso</option>
            <option value="rectification">Rectificación</option>
            <option value="erasure">Supresión</option>
            <option value="restriction">Limitación</option>
            <option value="objection">Oposición</option>
            <option value="portability">Portabilidad</option>
            <option value="other">Otro</option>
          </select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder="Describe tu solicitud..."
          />
          <Button onClick={() => void handleGdprSubmit()} disabled={submitGdpr.isPending}>
            {submitGdpr.isPending ? "Enviando…" : "Enviar solicitud"}
          </Button>
        </div>
      </Card>
    </EmployeeShellLayout>
  );
}
