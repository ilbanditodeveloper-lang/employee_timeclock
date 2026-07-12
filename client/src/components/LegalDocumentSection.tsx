import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileDown, Copy } from "lucide-react";
import { toast } from "sonner";
import type { LegalTemplateDocument } from "@shared/legalTemplates";
import { legalTemplateToPlainText } from "@shared/legalTemplates";
import { downloadLegalTemplatePdf } from "@/lib/laborReportExport";
import { useLocale } from "@/contexts/LocaleContext";

import type { ReactNode } from "react";

type Props = {
  document: LegalTemplateDocument;
  children?: ReactNode;
};

export default function LegalDocumentSection({ document: doc, children }: Props) {
  const { t } = useLocale();
  const plain = legalTemplateToPlainText(doc);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plain);
      toast.success(t("legal.common.copySuccess"));
    } catch {
      toast.error(t("legal.common.copyFailed"));
    }
  };

  const handlePdf = () => {
    downloadLegalTemplatePdf(doc.title, plain, `${doc.id}_${doc.version}.pdf`);
    toast.success(t("legal.common.pdfDownloaded"));
  };

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">{doc.title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("legal.common.templateVersion", { version: doc.version })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="gap-2">
            <Copy className="h-4 w-4" />
            {t("legal.common.copy")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={handlePdf} className="gap-2">
            <FileDown className="h-4 w-4" />
            {t("legal.common.pdf")}
          </Button>
        </div>
      </div>
      <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
        {doc.disclaimer}
      </p>
      {children}
      <div className="prose prose-sm max-w-none text-sm text-foreground dark:prose-invert">
        {doc.sections.map((s) => (
          <div key={s.heading} className="mb-4">
            <h4 className="font-semibold">{s.heading}</h4>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mt-1 text-muted-foreground">
                {p}
              </p>
            ))}
            {s.bullets?.length ? (
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                {s.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
}
