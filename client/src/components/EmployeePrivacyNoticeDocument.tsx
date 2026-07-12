import type {
  EmployeePrivacyNoticeDocument as NoticeDoc,
} from "@shared/employeePrivacyNotice";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

type Props = {
  document: NoticeDoc;
  className?: string;
  printable?: boolean;
  showSignatureBlock?: boolean;
  employeeName?: string;
};

export default function EmployeePrivacyNoticeDocument({
  document,
  className,
  printable = false,
  showSignatureBlock = false,
  employeeName,
}: Props) {
  const { t } = useLocale();
  return (
    <article
      className={cn(
        "space-y-5 text-sm leading-relaxed text-slate-800",
        printable && "print:text-black print:text-[11pt]",
        className
      )}
    >
      <header className="space-y-1 border-b border-slate-200 pb-4">
        <h1 className="text-lg font-bold text-slate-900">{document.title}</h1>
        <p className="text-base font-medium text-slate-700">{document.subtitle}</p>
        <p className="text-xs text-slate-500">
          {t("legal.employeeNotice.documentVersion", { version: document.version })}
        </p>
        {employeeName && (
          <p className="text-sm font-medium text-slate-700">
            {t("legal.employeeNotice.employeeLabel", { name: employeeName })}
          </p>
        )}
      </header>

      <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
        {document.disclaimer}
      </p>

      {document.sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-900">{section.heading}</h2>
          {section.paragraphs.map(
            (paragraph, i) =>
              paragraph && (
                <p key={`${section.heading}-p-${i}`} className="text-slate-700">
                  {paragraph}
                </p>
              )
          )}
          {section.bullets && section.bullets.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-slate-700">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {showSignatureBlock && (
        <footer className="mt-8 space-y-6 border-t border-slate-300 pt-6 print:break-inside-avoid">
          <p className="font-medium text-slate-900">{document.acknowledgmentLabel}</p>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-8">
              <p className="text-xs text-slate-600">{document.signatureBlock.employeeLabel}</p>
              <div className="border-b border-slate-400 pb-1" />
            </div>
            <div className="space-y-8">
              <p className="text-xs text-slate-600">{document.signatureBlock.companyLabel}</p>
              <div className="border-b border-slate-400 pb-1" />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-slate-600">{document.signatureBlock.placeLabel}</p>
              <div className="mt-6 border-b border-slate-400" />
            </div>
            <div>
              <p className="text-xs text-slate-600">{document.signatureBlock.dateLabel}</p>
              <div className="mt-6 border-b border-slate-400" />
            </div>
          </div>
        </footer>
      )}
    </article>
  );
}
