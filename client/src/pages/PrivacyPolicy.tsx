import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

const DATA_BULLET_KEYS = [
  "legal.platform.privacy.sections.data.bullet1",
  "legal.platform.privacy.sections.data.bullet2",
  "legal.platform.privacy.sections.data.bullet3",
  "legal.platform.privacy.sections.data.bullet4",
] as const;

export default function PrivacyPolicy() {
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
          <h1>{t("legal.platform.privacy.title")}</h1>
          <p>
            <strong>{t("legal.platform.privacy.lastUpdated")}</strong>
          </p>

          <h2>{t("legal.platform.privacy.sections.controller.title")}</h2>
          <p>{t("legal.platform.privacy.sections.controller.body")}</p>

          <h2>{t("legal.platform.privacy.sections.data.title")}</h2>
          <ul>
            {DATA_BULLET_KEYS.map((key) => (
              <li key={key}>{t(key)}</li>
            ))}
          </ul>

          <h2>{t("legal.platform.privacy.sections.purpose.title")}</h2>
          <p>{t("legal.platform.privacy.sections.purpose.body")}</p>

          <h2>{t("legal.platform.privacy.sections.retention.title")}</h2>
          <p>{t("legal.platform.privacy.sections.retention.body")}</p>

          <h2>{t("legal.platform.privacy.sections.recipients.title")}</h2>
          <p>{t("legal.platform.privacy.sections.recipients.body")}</p>

          <h2>{t("legal.platform.privacy.sections.rights.title")}</h2>
          <p>{t("legal.platform.privacy.sections.rights.body")}</p>

          <h2>{t("legal.platform.privacy.sections.security.title")}</h2>
          <p>{t("legal.platform.privacy.sections.security.body")}</p>
        </Card>
        <Button asChild variant="outline">
          <Link href="/">{t("legal.common.backToHome")}</Link>
        </Button>
      </div>
    </div>
  );
}
