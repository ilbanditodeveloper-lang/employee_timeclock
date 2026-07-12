import { ClipboardList } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { adminApiInput } from "@/lib/adminContext";
import { useLocale } from "@/contexts/LocaleContext";

function formatTime(value: string | Date, locale: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString(locale === "en" ? "en-US" : "es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminTodayActivityPanel() {
  const { t, locale } = useLocale();
  const query = trpc.publicApi.getAdminTodayActivity.useQuery(adminApiInput(), {
    refetchInterval: 60_000,
  });
  const items = query.data?.items ?? [];

  const actionLabel = (action: string) => {
    const key = `admin.todayActivity.actions.${action}` as const;
    const translated = t(key);
    return translated === key ? action : translated;
  };

  return (
    <Card className="app-shell-card border-0 p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ClipboardList className="size-5" />
            {t("admin.todayActivity.title")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("admin.todayActivity.subtitle")}
            {query.data?.date
              ? ` · ${query.data.date.split("-").reverse().join("/")}`
              : ""}
          </p>
        </div>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("admin.todayActivity.loading")}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("admin.todayActivity.empty")}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-lg border border-border/80 bg-muted/20 px-4 py-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{actionLabel(item.action)}</p>
                <span className="text-xs text-muted-foreground">
                  {formatTime(item.performedAt, locale)}
                </span>
              </div>
              <p className="mt-1 text-sm text-foreground">
                {item.affectedEmployeeName ?? t("admin.todayActivity.employeeFallback")}
                {item.performedByName ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {t("admin.todayActivity.performedBy", { name: item.performedByName })}
                  </span>
                ) : null}
              </p>
              {item.summary ? (
                <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
              ) : null}
              {item.reason ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.todayActivity.reason")} {item.reason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
