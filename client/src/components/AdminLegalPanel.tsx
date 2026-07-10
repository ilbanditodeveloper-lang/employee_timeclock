import { useEffect, useMemo, useRef, useState } from "react";
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
import { SAAS_PROCESSOR_NOTICE, validateCompanyLegalForOfficialExport } from "@shared/legalCompliance";
import {
  DEFAULT_WORKPLACE_GPS_JUSTIFICATION,
  GPS_JUSTIFICATION_CATEGORIES,
  type GpsJustificationCategory,
} from "@shared/gpsJustification";
import { format } from "date-fns";

export default function AdminLegalPanel() {
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

  const companyLegalQuery = trpc.publicApi.getCompanyLegal.useQuery(emptyCreds);
  const acceptancesQuery = trpc.publicApi.listEmployeePrivacyAcceptances.useQuery(emptyCreds);
  const companyAcceptancesQuery = trpc.publicApi.listCompanyLegalAcceptances.useQuery(emptyCreds);
  const gdprQuery = trpc.publicApi.listGdprRequests.useQuery(emptyCreds);
  const employeesQuery = trpc.publicApi.listEmployees.useQuery(emptyCreds);
  const trpcUtils = trpc.useUtils();
  const updateLegal = trpc.publicApi.updateCompanyLegal.useMutation({
    onSuccess: () => {
      toast.success("Datos legales guardados");
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
    setDataRetentionYears(String(c.dataRetentionYears ?? 4));
  }, [companyLegalQuery.data]);

  const companyInfo: CompanyLegalInfo = useMemo(() => {
    const c = companyLegalQuery.data;
    return {
      name: c?.name ?? "Su empresa",
      legalName: legalName || c?.legalName,
      taxId: taxId || c?.taxId,
      address: address || c?.address,
      privacyContactEmail: privacyContactEmail || c?.privacyContactEmail,
      country: c?.country ?? "ES",
      locationEnabled,
      dataRetentionYears: Number(dataRetentionYears) || 4,
    };
  }, [companyLegalQuery.data, legalName, taxId, address, privacyContactEmail, locationEnabled, dataRetentionYears]);

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
      toast.error("La conservación mínima legal es 4 años");
      return;
    }
    const legalCheck = validateCompanyLegalForOfficialExport({
      name: companyLegalQuery.data?.name,
      legalName,
      taxId,
      privacyContactEmail,
    });
    if (!legalCheck.valid) {
      toast.error(`Datos legales incompletos: ${legalCheck.missing.join(", ")}`);
    }
    if (locationEnabled && !companyLegalQuery.data?.locationEnabled) {
      if (!gpsJustificationCategory || gpsJustification.trim().length < 10) {
        toast.error("Para activar GPS indique motivo y justificación (mín. 10 caracteres)");
        return;
      }
    }
    updateLegal.mutate({
      ...emptyCreds,
      legalName,
      taxId,
      address,
      privacyContactEmail,
      locationEnabled,
      dataRetentionYears: years,
      gpsJustification: locationEnabled ? gpsJustification.trim() : undefined,
      gpsJustificationCategory: locationEnabled
        ? (gpsJustificationCategory as GpsJustificationCategory)
        : undefined,
    });
  };

  const handleMonthlyExport = async () => {
    const employeeId = Number(monthlyEmployeeId);
    if (!employeeId) {
      toast.error("Seleccione un empleado");
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
      toast.success("Resumen mensual generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo exportar");
    } finally {
      setComplianceBusy(false);
    }
  };

  const handleInspectionExport = async () => {
    if (!inspectionFrom || !inspectionTo) {
      toast.error("Indique periodo de inspección");
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
      toast.success("Paquete de inspección generado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo generar el paquete");
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
        {SAAS_PROCESSOR_NOTICE} Los documentos siguientes son plantillas orientativas; requieren
        revisión por asesoría laboral, abogado o DPO antes de uso oficial.
      </p>

      <Card className="p-6">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
              <Scale className="h-6 w-6" />
              A) Información para empleados
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Cláusula informativa RGPD (art. 13) para entregar al trabajador. Debe comunicarse antes
              o al inicio del uso del sistema de registro horario.
            </p>
          </div>
          <span className="rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground">
            Versión {EMPLOYEE_PRIVACY_NOTICE_VERSION}
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="legalName">Razón social / Responsable</Label>
            <Input
              id="legalName"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Empresa Ejemplo S.L."
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="taxId">NIF / CIF</Label>
            <Input
              id="taxId"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="B12345678"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">Domicilio social</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Calle, número, CP, ciudad"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="privacyEmail">Email protección de datos</Label>
            <Input
              id="privacyEmail"
              type="email"
              value={privacyContactEmail}
              onChange={(e) => setPrivacyContactEmail(e.target.value)}
              placeholder="privacidad@empresa.com"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="retention">Años conservación fichajes (mín. 4)</Label>
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
              Geolocalización al fichar (desactivada por defecto; solo si es necesario y proporcionado)
            </Label>
          </div>
          {locationEnabled && !companyLegalQuery.data?.locationEnabled ? (
            <div className="md:col-span-2 space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-sm text-amber-900">
                Active GPS solo si es necesario. Para centros físicos se recomienda fichaje desde
                dispositivo del centro (panel/tablet) sin GPS.
              </p>
              <div>
                <Label htmlFor="gpsCategory">Motivo de activación</Label>
                <select
                  id="gpsCategory"
                  value={gpsJustificationCategory}
                  onChange={(e) =>
                    setGpsJustificationCategory(e.target.value as GpsJustificationCategory)
                  }
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Seleccione…</option>
                  {GPS_JUSTIFICATION_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {gpsJustificationCategory ? (
                  <p className="text-xs text-muted-foreground mt-1">
                    {
                      GPS_JUSTIFICATION_CATEGORIES.find((o) => o.value === gpsJustificationCategory)
                        ?.hint
                    }
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="gpsJustification">Justificación (obligatoria)</Label>
                <Input
                  id="gpsJustification"
                  value={gpsJustification}
                  onChange={(e) => setGpsJustification(e.target.value)}
                  placeholder={DEFAULT_WORKPLACE_GPS_JUSTIFICATION}
                  className="mt-1"
                />
              </div>
            </div>
          ) : null}
        </div>

        <Button onClick={handleSave} disabled={updateLegal.isPending} className="mt-6 gap-2">
          <Save className="h-4 w-4" />
          {updateLegal.isPending ? "Guardando..." : "Guardar datos legales"}
        </Button>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
          <Button variant="outline" onClick={() => handlePdf()} className="gap-2">
            <FileDown className="h-4 w-4" />
            PDF (modelo en blanco)
          </Button>
          <select
            value={pdfEmployeeId}
            onChange={(e) => setPdfEmployeeId(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="">PDF con nombre de empleado…</option>
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
            PDF empleado
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
        <h3 className="mb-2 text-lg font-semibold text-foreground">Acuses de recibo (app)</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Los empleados marcan «He leído la información…» al primer acceso. Quedan registrados con
          fecha e IP. Pendientes activos:{" "}
          <strong>{pendingCount}</strong>
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Empleado</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Fecha acuse</th>
                <th className="py-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {(acceptancesQuery.data ?? []).map((row) => (
                <tr key={row.employeeId} className="border-b border-border/50">
                  <td className="py-2 pr-4">{row.employeeName}</td>
                  <td className="py-2 pr-4">{row.username}</td>
                  <td className="py-2 pr-4">
                    {row.acceptedAt ? (
                      <span className="text-green-700">Acuse digital</span>
                    ) : row.isActive ? (
                      <span className="text-amber-700">Pendiente</span>
                    ) : (
                      <span className="text-muted-foreground">Inactivo</span>
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
            <p className="py-4 text-sm text-muted-foreground">No hay empleados registrados.</p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 flex items-center gap-2 text-lg font-semibold text-foreground">
          <Shield className="h-5 w-5" />
          Documentos legales SaaS aceptados
        </h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Términos, privacidad SaaS y DPA aceptados por la empresa cliente (versión y hash registrados).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Documento</th>
                <th className="py-2 pr-4">Versión</th>
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2">Hash</th>
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
              Sin aceptaciones registradas. Complete el onboarding legal.
            </p>
          )}
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">Resumen mensual (tiempo parcial)</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Genera un CSV con las horas netas del mes elegido (descontando pausas), incidencias y diferencia
          frente a las horas contratadas del empleado.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1 min-w-[180px]">
            <Label htmlFor="monthly-employee">Empleado</Label>
            <select
              id="monthly-employee"
              value={monthlyEmployeeId}
              onChange={(e) => setMonthlyEmployeeId(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccione empleado…</option>
              {(employeesQuery.data ?? []).map((emp) => (
                <option key={emp.id} value={String(emp.id)}>
                  {emp.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">Trabajador del que se exportan las horas.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthly-year">Año</Label>
            <Input
              id="monthly-year"
              type="number"
              min={2000}
              max={2100}
              value={monthlyYear}
              onChange={(e) => setMonthlyYear(e.target.value)}
              className="w-28"
            />
            <p className="text-xs text-muted-foreground">Año natural (ej. 2026).</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="monthly-month">Mes</Label>
            <Input
              id="monthly-month"
              type="number"
              min={1}
              max={12}
              value={monthlyMonth}
              onChange={(e) => setMonthlyMonth(e.target.value)}
              className="w-20"
            />
            <p className="text-xs text-muted-foreground">1 = enero, 7 = julio, 12 = diciembre.</p>
          </div>
          <Button onClick={() => void handleMonthlyExport()} disabled={complianceBusy}>
            Exportar CSV mensual
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">Paquete Inspección de Trabajo</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Descarga manifest JSON + CSV con checksum para un periodo concreto. Requiere razón social, CIF y email
          de privacidad guardados arriba.
        </p>
        {!legalExportReady.valid ? (
          <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Faltan datos legales: {legalExportReady.missing.join(", ")}. Complételos en «Datos legales de la
            empresa» y pulse Guardar antes de descargar.
          </p>
        ) : null}
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="inspection-from">Desde</Label>
            <Input
              id="inspection-from"
              type="date"
              value={inspectionFrom}
              onChange={(e) => setInspectionFrom(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Primer día del periodo a incluir.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="inspection-to">Hasta</Label>
            <Input
              id="inspection-to"
              type="date"
              value={inspectionTo}
              onChange={(e) => setInspectionTo(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Último día del periodo (inclusive).</p>
          </div>
          <Button
            onClick={() => void handleInspectionExport()}
            disabled={complianceBusy || !legalExportReady.valid}
          >
            Descargar paquete
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="mb-2 text-lg font-semibold text-foreground">Solicitudes RGPD de empleados</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          Canal interno de ejercicio de derechos. La supresión puede no ser procedente por obligación
          legal de conservar registros horarios.
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
            <p className="text-sm text-muted-foreground">No hay solicitudes registradas.</p>
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
