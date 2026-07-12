import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";
import { downloadLaborReportCsv, downloadOfficialLaborReportPdf } from "@/lib/laborReportExport";
import { calendarMonthRange } from "@shared/laborReport";
import { LEGAL_DISCLAIMER } from "@shared/legalCompliance";

export default function EmployeeLegal() {
  const { t, locale } = useLocale();
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();
  const employeeId = employeeSession?.employeeId ?? 0;
  const enabled = Boolean(employeeId);
  const numberLocale = locale === "en" ? "en-US" : "es-ES";

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

  const gdprTypeLabels = useMemo(
    () => ({
      access: t("employee.legal.gdprTypes.access"),
      rectification: t("employee.legal.gdprTypes.rectification"),
      erasure: t("employee.legal.gdprTypes.erasure"),
      restriction: t("employee.legal.gdprTypes.restriction"),
      objection: t("employee.legal.gdprTypes.objection"),
      portability: t("employee.legal.gdprTypes.portability"),
      other: t("employee.legal.gdprTypes.other"),
    }),
    [t]
  );

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
      toast.success(t("employee.legal.toasts.downloadStarted"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("employee.legal.toasts.exportFailed"));
    } finally {
      setExportBusy(false);
    }
  };

  const handleGdprSubmit = async () => {
    if (!employeeId || message.trim().length < 10) {
      toast.error(t("employee.legal.toasts.messageTooShort"));
      return;
    }
    try {
      await submitGdpr.mutateAsync({
        ...employeeQueryInput(employeeId),
        requestType,
        message: message.trim(),
      });
      toast.success(t("employee.legal.toasts.requestSubmitted"));
      setMessage("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("employee.legal.toasts.requestFailed"));
    }
  };

  if (isAuthLoading || !isEmployeeAuthenticated) return null;

  const latestAcceptance = portalQuery.data?.acceptances[0];

  return (
    <EmployeeShellLayout
      pageTitle={t("employee.legal.pageTitle")}
      pageSubtitle={t("employee.legal.pageSubtitle")}
      contentClassName="container mx-auto max-w-2xl space-y-6 py-8 pb-28 md:pb-8"
    >
      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">{t("employee.legal.workerNotice")}</h2>
        <p className="text-sm text-muted-foreground mb-3">{LEGAL_DISCLAIMER}</p>
        {latestAcceptance ? (
          <p className="text-sm">
            {t("employee.legal.acceptedVersion")}{" "}
            <strong>{latestAcceptance.documentVersion}</strong> ·{" "}
            {new Date(latestAcceptance.acceptedAt).toLocaleString(numberLocale)}
          </p>
        ) : (
          <p className="text-sm text-amber-700">{t("employee.legal.noAck")}</p>
        )}
        <Button asChild variant="outline" size="sm" className="mt-3">
          <Link href="/legal/employee-notice">{t("employee.legal.readNotice")}</Link>
        </Button>
        {portalQuery.data?.locationEnabled ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("employee.legal.geoActive")}</p>
        ) : null}
      </Card>

      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">{t("employee.legal.downloadTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-4">{t("employee.legal.downloadDescription")}</p>
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
            {t("employee.legal.currentMonthPdf")}
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
            {t("employee.legal.prevMonthCsv")}
          </Button>
        </div>
      </Card>

      <Card className="app-shell-card border-0 p-5 shadow-sm">
        <h2 className="text-lg font-semibold mb-2">{t("employee.legal.gdprTitle")}</h2>
        <p className="text-sm text-muted-foreground mb-2">
          {portalQuery.data?.gdprErasureNotice}
        </p>
        <div className="space-y-3">
          <select
            className="input-elegant w-full"
            value={requestType}
            onChange={(e) => setRequestType(e.target.value as typeof requestType)}
          >
            {(Object.keys(gdprTypeLabels) as Array<keyof typeof gdprTypeLabels>).map((key) => (
              <option key={key} value={key}>
                {gdprTypeLabels[key]}
              </option>
            ))}
          </select>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            placeholder={t("employee.legal.gdprMessagePlaceholder")}
          />
          <Button onClick={() => void handleGdprSubmit()} disabled={submitGdpr.isPending}>
            {submitGdpr.isPending ? t("employee.legal.gdprSubmitting") : t("employee.legal.gdprSubmit")}
          </Button>
        </div>
      </Card>
    </EmployeeShellLayout>
  );
}
