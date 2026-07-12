import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { emptyCreds } from "@/lib/authApi";
import { buildEmployeePrivacyNotice } from "@shared/employeePrivacyNotice";
import EmployeePrivacyNoticeDocument from "@/components/EmployeePrivacyNoticeDocument";

type Props = {
  onAccepted?: () => void;
  embedded?: boolean;
};

export default function EmployeePrivacyNotice({ onAccepted, embedded }: Props) {
  const [read, setRead] = useState(false);
  const { t } = useLocale();
  const { employeeSession, setEmployeeSession } = useAuthContext();
  const companySlug = employeeSession?.companySlug ?? "default";

  const companyLegalQuery = trpc.publicApi.getPublicCompanyLegal.useQuery({ companySlug });
  const accept = trpc.publicApi.acceptEmployeePrivacyNotice.useMutation({
    onSuccess: () => {
      if (employeeSession) {
        setEmployeeSession({ ...employeeSession, needsPrivacyNotice: false });
      }
      toast.success(t("legal.employeeNotice.accepted"));
      onAccepted?.();
    },
    onError: (e) => toast.error(e.message),
  });

  const company = companyLegalQuery.data;
  const noticeDocument = buildEmployeePrivacyNotice(
    {
      name: company?.name ?? t("legal.employeeNotice.defaultCompanyName"),
      legalName: company?.legalName,
      taxId: company?.taxId,
      address: company?.address,
      privacyContactEmail: company?.privacyContactEmail,
      country: company?.country,
      locationEnabled: company?.locationEnabled,
      dataRetentionYears: company?.dataRetentionYears,
    },
    {
      employeeName: employeeSession?.displayName,
      employeeUsername: employeeSession?.username,
    }
  );

  const content = (
    <div className="space-y-4">
      {companyLegalQuery.isLoading ? (
        <p className="text-sm text-slate-600">{t("legal.employeeNotice.loading")}</p>
      ) : (
        <EmployeePrivacyNoticeDocument document={noticeDocument} />
      )}
      <p className="text-xs text-slate-500">
        {t("legal.employeeNotice.platformPrivacyPrefix")}{" "}
        <Link href="/legal/privacy" className="text-blue-600 underline">
          {t("legal.employeeNotice.platformPrivacyLink")}
        </Link>
        .
      </p>
      {embedded && (
        <div className="flex items-start gap-2 border-t pt-4">
          <Checkbox id="read-notice" checked={read} onCheckedChange={(v) => setRead(Boolean(v))} />
          <Label htmlFor="read-notice" className="leading-snug text-sm">
            {t("legal.employeeNotice.checkboxLabel")}
          </Label>
        </div>
      )}
      {embedded && (
        <Button
          className="w-full"
          disabled={!read || accept.isPending || companyLegalQuery.isLoading}
          onClick={() => accept.mutate(emptyCreds)}
        >
          {accept.isPending ? t("legal.employeeNotice.saving") : t("legal.employeeNotice.continue")}
        </Button>
      )}
    </div>
  );

  if (embedded) {
    return <Card className="mx-auto w-full max-w-2xl p-6">{content}</Card>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="max-w-2xl p-6">{content}</Card>
    </div>
  );
}
