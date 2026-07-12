import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

const OBLIGATION_BULLET_KEYS = [
  "legal.platform.terms.sections.obligations.bullet1",
  "legal.platform.terms.sections.obligations.bullet2",
  "legal.platform.terms.sections.obligations.bullet3",
  "legal.platform.terms.sections.obligations.bullet4",
] as const;

export default function TermsOfUse() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-end">
          <LanguageSwitcher compact />
        </div>
        <Card className="p-6 md:p-8 prose prose-slate max-w-none">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 not-prose">
            {t("legal.common.disclaimerShort")}
          </p>
          <h1>{t("legal.platform.terms.title")}</h1>

          <h2>{t("legal.platform.terms.sections.object.title")}</h2>
          <p>{t("legal.platform.terms.sections.object.body")}</p>

          <h2>{t("legal.platform.terms.sections.obligations.title")}</h2>
          <ul>
            {OBLIGATION_BULLET_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>

          <h2>{t("legal.platform.terms.sections.liability.title")}</h2>
          <p>{t("legal.platform.terms.sections.liability.body")}</p>

          <h2>{t("legal.platform.terms.sections.data.title")}</h2>
          <p>{t("legal.platform.terms.sections.data.body")}</p>
        </Card>
        <Button asChild variant="outline">
          <Link href="/">{t("legal.common.backToHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
