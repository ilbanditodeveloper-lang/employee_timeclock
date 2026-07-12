import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Headphones, MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAdminSupportWhatsAppHref } from "@shared/landingConfig";

type Props = {
  companyName?: string | null;
};

export default function AdminSupportPanel({ companyName }: Props) {
  const { t } = useLocale();
  const landingQuery = trpc.publicApi.getLandingPageConfig.useQuery();
  const whatsappHref = useMemo(
    () =>
      buildAdminSupportWhatsAppHref(
        landingQuery.data?.whatsappNumber ?? "",
        companyName ?? "mi negocio"
      ),
    [landingQuery.data?.whatsappNumber, companyName]
  );

  return (
    <Card className="p-6 border-emerald-200/80 bg-emerald-50/30">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Headphones className="size-5 text-emerald-700" />
            {t("admin.support.title")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xl">{t("admin.support.description")}</p>
        </div>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="shrink-0">
            <Button
              type="button"
              className="w-full sm:w-auto bg-[#25D366] hover:bg-[#20bd5a] text-white gap-2"
            >
              <MessageCircle className="size-4" />
              {t("admin.support.whatsappCta")}
            </Button>
          </a>
        ) : (
          <p className="text-sm text-muted-foreground italic">{t("admin.support.notConfigured")}</p>
        )}
      </div>
    </Card>
  );
}
