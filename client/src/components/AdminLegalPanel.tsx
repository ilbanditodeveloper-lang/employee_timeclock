import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileDown, Printer, Scale, Save, Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { emptyCreds } from "@/lib/authApi";
import { EMPLOYEE_PRIVACY_NOTICE_VERSION } from "@shared/const";
import {
  buildEmployeePrivacyNotice,
  type CompanyLegalInfo,
} from "@shared/employeePrivacyNotice";
import {
  buildBusinessPrivacyPolicy,
  buildCompanyTerms,
  buildDpaTemplate,
} from "@shared/legalTemplates";
import EmployeePrivacyNoticeDocument from "@/components/EmployeePrivacyNoticeDocument";
import LegalDocumentSection from "@/components/LegalDocumentSection";
import { downloadEmployeePrivacyNoticePdf } from "@/lib/employeePrivacyNoticePdf";
import {
  downloadInspectionPackageBundle,
  downloadMonthlyLaborReportCsv,
} from "@/lib/laborReportExport";
import { validateCompanyLegalForOfficialExport } from "@shared/legalCompliance";
import {
  GPS_JUSTIFICATION_CATEGORIES,
  type GpsJustificationCategory,
} from "@shared/gpsJustification";
import { format } from "date-fns";
import { useLocale } from "@/contexts/LocaleContext";

const MISSING_FIELD_KEYS: Record<string, string> = {
  "razón social": "admin.legal.missingFields.legalName",
  "CIF/NIF": "admin.legal.missingFields.taxId",
  "email de contacto privacidad": "admin.legal.missingFields.privacyEmail",
};

export default function AdminLegalPanel() {
  const { t } = useLocale();
  const printRef = useRef<HTMLDivElement>(null);
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [privacyContactEmail, setPrivacyContactEmail] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [gpsJustificationCategory, setGpsJustificationCategory] = useState("");
  const [gpsJustification, setGpsJustification] = useState("");
  const [dataRetentionYears, setDataRetentionYears] = useState("4");
  const [pdfEmployeeId, setPdfEmployeeId] = useState("");
  const [monthlyEmployeeId, setMonthlyEmployeeId] = useState("");
  const [monthlyYear, setMonthlyYear] = useState(String(new Date().getFullYear()));
  const [monthlyMonth, setMonthlyMonth] = useState(String(new Date().getMonth() + 1));
  const [inspectionFrom, setInspectionFrom] = useState("");
  const [inspectionTo, setInspectionTo] = useState("");
  const [complianceBusy, setComplianceBusy] = useState(false);

  const translateMissingFields = useCallback(
    (fields: string[]) =>
      fields.map((field) => (MISSING_FIELD_KEYS[field] ? t(MISSING_FIELD_KEYS[field]) : field)),
    [t]
  );

  const gpsCategoryOptions = useMemo(
    () =>
      GPS_JUSTIFICATION_CATEGORIES.map((option) => ({
        value: option.value,
        label: t(`admin.legal.gps.categories.${option.value}.label`),
        hint: t(`admin.legal.gps.categories.${option.value}.hint`),
      })),
    [t]
  );

  const companyLegalQuery = trpc.publicApi.getCompanyLegal.useQuery(emptyCreds);
  const acceptancesQuery = trpc.publicApi.listEmployeePrivacyAcceptances.useQuery(emptyCreds);
  const companyAcceptancesQuery = trpc.publicApi.listCompanyLegalAcceptances.useQuery(emptyCreds);
  const gdprQuery = trpc.publicApi.listGdprRequests.useQuery(emptyCreds);
  const employeesQuery = trpc.publicApi.listEmployees.useQuery(emptyCreds);
  const trpcUtils = trpc.useUtils();
  const updateLegal = trpc.publicApi.updateCompanyLegal.useMutation({
    onSuccess: (result) => {
      toast.success(t("admin.legal.toasts.saved"));
      if (result.privacyNoticeReacceptanceRequired) {
        toast.message(t("admin.legal.toasts.employeesMustReaccept"));
      }
      companyLegalQuery.refetch();
      acceptancesQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    const c = companyLegalQuery.data;
    if (!c) return;
    setLegalName(c.legalName ?? "");
    setTaxId(c.taxId ?? "");
    setAddress(c.address ?? "");
    setPrivacyContactEmail(c.privacyContactEmail ?? "");
    setLocationEnabled(c.locationEnabled ?? false);
    setGpsJustificationCategory(c.gpsJustificationCategory ?? "");
    setGpsJustification(c.gpsJustification ?? "");
    setDataRetentionYears(String(c.dataRetentionYears ?? 4));
  }, [companyLegalQuery.data]);

  const companyInfo: CompanyLegalInfo = useMemo(() => {
    const c = companyLegalQuery.data;
    return {
      name: c?.name ?? t("admin.legal.defaults.companyName"),
      legalName: legalName || c?.legalName,
      taxId: taxId || c?.taxId,
      address: address || c?.address,
      privacyContactEmail: privacyContactEmail || c?.privacyContactEmail,
      country: c?.country ?? "ES",
      locationEnabled,
      dataRetentionYears: Number(dataRetentionYears) || 4,
    };
  }, [
    companyLegalQuery.data,
    legalName,
    taxId,
    address,
    privacyContactEmail,
    locationEnabled,
    dataRetentionYears,
    t,
  ]);

  const noticeDocument = useMemo(
    () => buildEmployeePrivacyNotice(companyInfo),
    [companyInfo]
  );

  const businessPrivacyDoc = useMemo(() => buildBusinessPrivacyPolicy(companyInfo), [companyInfo]);
  const companyTermsDoc = useMemo(() => buildCompanyTerms(companyInfo), [companyInfo]);
  const dpaDoc = useMemo(() => buildDpaTemplate(companyInfo), [companyInfo]);

  const legalExportReady = useMemo(
    () => validateCompanyLegalForOfficialExport(companyInfo),
    [companyInfo]
  );

  const translatedMissing = useMemo(
    () => translateMissingFields(legalExportReady.missing),
    [legalExportReady.missing, translateMissingFields]
  );

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    setInspectionFrom(format(monthStart, "yyyy-MM-dd"));
    setInspectionTo(format(now, "yyyy-MM-dd"));
  }, []);

  const selectedEmployee = acceptancesQuery.data?.find(
    (e) => String(e.employeeId) === pdfEmployeeId
  );

  const handleSave = () => {
    const years = Number(dataRetentionYears);
    if (Number.isNaN(years) || years < 4) {
      toast.error(t("admin.legal.toasts.minRetention"));
      return;
    }
    const legalCheck = validateCompanyLegalForOfficialExport({
      name: companyLegalQuery.data?.name,
      legalName,
      taxId,
      privacyContactEmail,
    });
    if (!legalCheck.valid) {
      toast.error(
        t("admin.legal.toasts.incomplete", {
          missing: translateMissingFields(legalCheck.missing).join(", "),
        })
      );
    }
    const enablingGps =
      locationEnabled && !companyLegalQuery.data?.locationEnabled;
    if (enablingGps) {
      if (!gpsJustificationCategory || gpsJustification.trim().length < 10) {
        toast.error(t("admin.legal.toasts.gpsRequired"));
        return;
      }
    }
    const validCategory = GPS_JUSTIFICATION_CATEGORIES.some(
      (c) => c.value === gpsJustificationCategory
    )
      ? (gpsJustificationCategory as GpsJustificationCategory)
      : undefined;

    updateLegal.mutate({
      ...emptyCreds,
      legalName,
      taxId,
      address,
      privacyContactEmail,
      locationEnabled,
      dataRetentionYears: years,
      ...(enablingGps || locationEnabled
        ? {
            gpsJustification: gpsJustification.trim() || undefined,
            gpsJustificationCategory: validCategory,
          }
        : {}),
    });
  };

  const handleMonthlyExport = async () => {
    const employeeId = Number(monthlyEmployeeId);
    if (!employeeId) {
      toast.error(t("admin.legal.toasts.selectEmployee"));
      return;
    }
    setComplianceBusy(true);
    try {
      const report = await trpcUtils.publicApi.getMonthlyEmployeeReport.fetch({
        ...emptyCreds,
        employeeId,
        year: Number(monthlyYear),
        month: Number(monthlyMonth),
        recordDelivery: true,
      });
      downloadMonthlyLaborReportCsv(report);
      toast.success(t("admin.legal.toasts.monthlyGenerated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.legal.toasts.exportFailed"));
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleInspectionExport = async () => {
    if (!inspectionFrom || !inspectionTo) {
      toast.error(t("admin.legal.toasts.inspectionPeriodRequired"));
      return;
    }
    setComplianceBusy(true);
    try {
      const pkg = await trpcUtils.publicApi.buildInspectionPackage.fetch({
        ...emptyCreds,
        dateFrom: inspectionFrom,
        dateTo: inspectionTo,
      });
      downloadInspectionPackageBundle(pkg);
      toast.success(t("admin.legal.toasts.inspectionGenerated"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("admin.legal.toasts.inspectionFailed"));
    } finally {
      setComplianceBusy(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handlePdf = (forEmployee?: { employeeName: string; employeeUsername: string }) => {
    downloadEmployeePrivacyNoticePdf(
      companyInfo,
      forEmployee
        ? {
            employeeName: forEmployee.employeeName,
            employeeUsername: forEmployee.employeeUsername,
          }
        : undefined
    );
  };

  const pendingCount =
    acceptancesQuery.data?.filter((e) => !e.acceptedAt && e.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {t("admin.legal.processorNotice")} {t("admin.legal.templateDisclaimer")}
      </p>

      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Scale className="h-6 w-6" />
              {t("admin.legal.employeeInfo.title")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {t("admin.legal.employeeInfo.description")}
            </p>
          </div>
          <span className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
            {t("admin.legal.employeeInfo.version", {
              version:
                companyLegalQuery.data?.employeePrivacyNoticeVersion ??
                EMPLOYEE_PRIVACY_NOTICE_VERSION,
            })}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="legalName">{t("admin.legal.fields.legalName")}</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder={t("admin.legal.placeholders.legalName")}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="taxId">{t("admin.legal.fields.taxId")}</Label>
            <Input
              id="taxId"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder={t("admin.legal.placeholders.taxId")}
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">{t("admin.legal.fields.address")}</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t("admin.legal.placeholders.address")}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="privacyEmail">{t("admin.legal.fields.privacyEmail")}</Label>
            <Input
              id="privacyEmail"
              type="email"
              value={privacyContactEmail}
              onChange={(e) => setPrivacyContactEmail(e.target.value)}
              placeholder={t("admin.legal.placeholders.privacyEmail")}
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="retention">{t("admin.legal.fields.retentionYears")}</Label>
            <Input
              id="retention"
              type="number"
              min={4}
              max={10}
              value={dataRetentionYears}
              onChange={(e) => setDataRetentionYears(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex items-center gap-3 md:col-span-2">
            <Switch
              id="locationEnabled"
              checked={locationEnabled}
              onCheckedChange={setLocationEnabled}
            />
            <Label htmlFor="locationEnabled" className="leading-snug">
              {t("admin.legal.fields.locationEnabled")}
            </Label>
          </div>
          {locationEnabled && !companyLegalQuery.data?.locationEnabled ? (
            <div className="md:col-span-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm text-amber-900">{t("admin.legal.gps.activationWarning")}</p>
              <div>
                <Label htmlFor="gpsCategory">{t("admin.legal.fields.gpsCategory")}</Label>
                <select
                  id="gpsCategory"
                  value={gpsJustificationCategory}
                  onChange={(e) =>
                    setGpsJustificationCategory(e.target.value as GpsJustificationCategory)
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">{t("admin.legal.placeholders.selectCategory")}</option>
                  {gpsCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {gpsJustificationCategory ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {
                      gpsCategoryOptions.find((o) => o.value === gpsJustificationCategory)?.hint
                    }
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="gpsJustification">{t("admin.legal.fields.gpsJustification")}</Label>
                <Input
                  id="gpsJustification"
                  value={gpsJustification}
                  onChange={(e) => setGpsJustification(e.target.value)}
                  placeholder={t("admin.legal.gps.defaultJustification")}
                  className="mt-1"
                />
              </div>
            </div>
          ) : null}
        </div>

        <Button onClick={handleSave} disabled={updateLegal.isPending} className="mt-6 gap-2">
          <Save className="h-4 w-4" />
          {updateLegal.isPending ? t("admin.legal.actions.saving") : t("admin.legal.actions.save")}
        </Button>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            {t("admin.legal.actions.print")}
          </Button>
          <Button variant="outline" onClick={() => handlePdf()} className="gap-2">
            <FileDown className="h-4 w-4" />
            {t("admin.legal.actions.pdfBlank")}
          </Button>
          <select
            value={pdfEmployeeId}
            onChange={(e) => setPdfEmployeeId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">{t("admin.legal.placeholders.pdfEmployee")}</option>
            {(acceptancesQuery.data ?? []).map((emp) => (
              <option key={emp.employeeId} value={String(emp.employeeId)}>
                {emp.employeeName} ({emp.username})
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            disabled={!selectedEmployee}
            onClick={() =>
              selectedEmployee &&
              handlePdf({
                employeeName: selectedEmployee.employeeName,
                employeeUsername: selectedEmployee.username,
              })
            }
            className="gap-2"
          >
            <FileDown className="h-4 w-4" />
            {t("admin.legal.actions.pdfEmployee")}
          </Button>
        </div>

        <div
          ref={printRef}
          id="legal-notice-print"
          className="rounded-lg border bg-white p-6 print:border-0 print:p-0"
        >
          <EmployeePrivacyNoticeDocument
            document={noticeDocument}
            printable
            showSignatureBlock
            employeeName={selectedEmployee?.employeeName}
          />
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {t("admin.legal.acceptances.title")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.legal.acceptances.description")}{" "}
          <strong>{pendingCount}</strong>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">{t("admin.legal.acceptances.columns.employee")}</th>
                <th className="py-2 pr-4">{t("admin.legal.acceptances.columns.username")}</th>
                <th className="py-2 pr-4">{t("admin.legal.acceptances.columns.status")}</th>
                <th className="py-2 pr-4">{t("admin.legal.acceptances.columns.acceptedAt")}</th>
                <th className="py-2">{t("admin.legal.acceptances.columns.ip")}</th>
              </tr>
            </thead>
            <tbody>
              {(acceptancesQuery.data ?? []).map((row) => (
                <tr key={row.employeeId} className="border-b border-border/50">
                  <td className="py-2 pr-4">{row.employeeName}</td>
                  <td className="py-2 pr-4">{row.username}</td>
                  <td className="py-2 pr-4">
                    {row.acceptedAt ? (
                      <span className="text-green-700">
                        {t("admin.legal.acceptances.status.digital")}
                      </span>
                    ) : row.isActive ? (
                      <span className="text-amber-700">
                        {t("admin.legal.acceptances.status.pending")}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        {t("admin.legal.acceptances.status.inactive")}
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {row.acceptedAt
                      ? format(new Date(row.acceptedAt), "dd/MM/yyyy HH:mm")
                      : "—"}
                  </td>
                  <td className="py-2">{row.ipAddress ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!acceptancesQuery.data?.length && (
            <p className="py-4 text-sm text-muted-foreground">{t("admin.legal.acceptances.empty")}</p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5" />
          {t("admin.legal.saasAcceptances.title")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.legal.saasAcceptances.description")}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">{t("admin.legal.saasAcceptances.columns.document")}</th>
                <th className="py-2 pr-4">{t("admin.legal.saasAcceptances.columns.version")}</th>
                <th className="py-2 pr-4">{t("admin.legal.saasAcceptances.columns.date")}</th>
                <th className="py-2">{t("admin.legal.saasAcceptances.columns.hash")}</th>
              </tr>
            </thead>
            <tbody>
              {(companyAcceptancesQuery.data ?? []).map((row) => (
                <tr key={row.id} className="border-b border-border/50">
                  <td className="py-2 pr-4">{row.documentCode}</td>
                  <td className="py-2 pr-4">{row.documentVersion}</td>
                  <td className="py-2 pr-4">
                    {format(new Date(row.acceptedAt), "dd/MM/yyyy HH:mm")}
                  </td>
                  <td className="py-2 font-mono text-xs">{row.documentHash?.slice(0, 12) ?? "—"}…</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!companyAcceptancesQuery.data?.length && (
            <p className="py-4 text-sm text-muted-foreground">
              {t("admin.legal.saasAcceptances.empty")}
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {t("admin.legal.monthlyReport.title")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.legal.monthlyReport.description")}
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[180px]">
            <Label htmlFor="monthly-employee">{t("admin.legal.fields.employee")}</Label>
            <select
              id="monthly-employee"
              value={monthlyEmployeeId}
              onChange={(e) => setMonthlyEmployeeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">{t("admin.legal.placeholders.selectEmployee")}</option>
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              {t("admin.legal.monthlyReport.employeeHint")}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthly-year">{t("admin.legal.fields.year")}</Label>
            <Input
              id="monthly-year"
              type="number"
              min={2000}
              max={2100}
              value={monthlyYear}
              onChange={(e) => setMonthlyYear(e.target.value)}
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">{t("admin.legal.monthlyReport.yearHint")}</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthly-month">{t("admin.legal.fields.month")}</Label>
            <Input
              id="monthly-month"
              type="number"
              min={1}
              max={12}
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
              className="w-20"
            />
            <p className="text-xs text-muted-foreground">{t("admin.legal.monthlyReport.monthHint")}</p>
          </div>
          <Button onClick={() => void handleMonthlyExport()} disabled={complianceBusy}>
            {t("admin.legal.actions.exportMonthlyCsv")}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {t("admin.legal.inspectionPackage.title")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.legal.inspectionPackage.description")}
        </p>
        {!legalExportReady.valid ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t("admin.legal.inspectionPackage.missingData", {
              missing: translatedMissing.join(", "),
            })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="inspection-from">{t("admin.legal.fields.from")}</Label>
            <Input
              id="inspection-from"
              type="date"
              value={inspectionFrom}
              onChange={(e) => setInspectionFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.legal.inspectionPackage.fromHint")}
            </p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inspection-to">{t("admin.legal.fields.to")}</Label>
            <Input
              id="inspection-to"
              type="date"
              value={inspectionTo}
              onChange={(e) => setInspectionTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {t("admin.legal.inspectionPackage.toHint")}
            </p>
          </div>
          <Button
            onClick={() => void handleInspectionExport()}
            disabled={complianceBusy || !legalExportReady.valid}
          >
            {t("admin.legal.actions.downloadPackage")}
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">
          {t("admin.legal.gdprRequests.title")}
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          {t("admin.legal.gdprRequests.description")}
        </p>
        <div className="space-y-2">
          {(gdprQuery.data ?? []).slice(0, 20).map((req) => (
            <div key={req.id} className="rounded-lg border px-3 py-2 text-sm">
              <p className="font-medium">
                #{req.id} · {req.requestType} · {req.status}
              </p>
              <p className="text-muted-foreground">{req.message}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(req.createdAt), "dd/MM/yyyy HH:mm")}
              </p>
            </div>
          ))}
          {!gdprQuery.data?.length && (
            <p className="text-sm text-muted-foreground">{t("admin.legal.gdprRequests.empty")}</p>
          )}
        </div>
      </Card>

      <LegalDocumentSection document={businessPrivacyDoc} />
      <LegalDocumentSection document={companyTermsDoc} />
      <LegalDocumentSection document={dpaDoc} />

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #legal-notice-print, #legal-notice-print * { visibility: visible; }
          #legal-notice-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
