import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

const DATA_TYPE_BULLET_KEYS = [
  "legal.platform.dpa.sections.dataTypes.bullet1",
  "legal.platform.dpa.sections.dataTypes.bullet2",
  "legal.platform.dpa.sections.dataTypes.bullet3",
  "legal.platform.dpa.sections.dataTypes.bullet4",
] as const;

const OBLIGATION_BULLET_KEYS = [
  "legal.platform.dpa.sections.obligations.bullet1",
  "legal.platform.dpa.sections.obligations.bullet2",
  "legal.platform.dpa.sections.obligations.bullet3",
  "legal.platform.dpa.sections.obligations.bullet4",
  "legal.platform.dpa.sections.obligations.bullet5",
  "legal.platform.dpa.sections.obligations.bullet6",
] as const;

export default function PlatformDpa() {
  const { t } = useLocale();

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex justify-end">
          <LanguageSwitcher compact />
        </div>
        <Card className="p-6 md:p-8 prose prose-slate max-w-none">
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 not-prose">
            {t("legal.common.disclaimerDpa")}
          </p>
          <h1>{t("legal.platform.dpa.title")}</h1>
          <p>
            <strong>{t("legal.platform.dpa.platform")}</strong>
          </p>

          <h2>{t("legal.platform.dpa.sections.object.title")}</h2>
          <p>{t("legal.platform.dpa.sections.object.body")}</p>

          <h2>{t("legal.platform.dpa.sections.duration.title")}</h2>
          <p>{t("legal.platform.dpa.sections.duration.body")}</p>

          <h2>{t("legal.platform.dpa.sections.dataTypes.title")}</h2>
          <ul>
            {DATA_TYPE_BULLET_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>

          <h2>{t("legal.platform.dpa.sections.obligations.title")}</h2>
          <ul>
            {OBLIGATION_BULLET_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>

          <h2>{t("legal.platform.dpa.sections.security.title")}</h2>
          <p>{t("legal.platform.dpa.sections.security.body")}</p>

          <h2>{t("legal.platform.dpa.sections.contact.title")}</h2>
          <p>{t("legal.platform.dpa.sections.contact.body")}</p>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/legal/privacy">{t("legal.common.privacyPolicy")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/legal/terms">{t("legal.common.termsOfUse")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">{t("legal.common.backToHome")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
