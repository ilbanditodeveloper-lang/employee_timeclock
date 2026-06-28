import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileDown, Printer, Scale, Save } from "lucide-react";
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
import { format } from "date-fns";

export default function AdminLegalPanel() {
  const printRef = useRef<HTMLDivElement>(null);
  const [legalName, setLegalName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [address, setAddress] = useState("");
  const [privacyContactEmail, setPrivacyContactEmail] = useState("");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [dataRetentionYears, setDataRetentionYears] = useState("4");
  const [pdfEmployeeId, setPdfEmployeeId] = useState("");

  const companyLegalQuery = trpc.publicApi.getCompanyLegal.useQuery(emptyCreds);
  const acceptancesQuery = trpc.publicApi.listEmployeePrivacyAcceptances.useQuery(emptyCreds);
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

  const selectedEmployee = acceptancesQuery.data?.find(
    (e) => String(e.employeeId) === pdfEmployeeId
  );

  const handleSave = () => {
    const years = Number(dataRetentionYears);
    if (Number.isNaN(years) || years < 4) {
      toast.error("La conservación mínima legal es 4 años");
      return;
    }
    updateLegal.mutate({
      ...emptyCreds,
      legalName,
      taxId,
      address,
      privacyContactEmail,
      locationEnabled,
      dataRetentionYears: years,
    });
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
        TimeClock es una herramienta técnica de registro horario. La empresa cliente es responsable de
        informar a sus trabajadores y cumplir la normativa aplicable. Los documentos siguientes son
        plantillas orientativas.
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
              Geolocalización activa al fichar (debe reflejarse en la cláusula)
            </Label>
          </div>
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
