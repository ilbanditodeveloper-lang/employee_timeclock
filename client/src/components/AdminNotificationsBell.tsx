import { Bell, AlertCircle, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { trpc } from "@/lib/trpc";
import { adminApiInput } from "@/lib/adminContext";
import { useLocale } from "@/contexts/LocaleContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type AdminNotificationsBellProps = {
  enabled?: boolean;
  onOpenTimeOff?: () => void;
  onOpenIncidents?: () => void;
};

function formatShortDate(
  value: string | Date | null | undefined,
  locale: "es" | "en"
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
    day: "2-digit",
    month: "short",
  });
}

export default function AdminNotificationsBell({
  enabled = true,
  onOpenTimeOff,
  onOpenIncidents,
}: AdminNotificationsBellProps) {
  const { t, locale } = useLocale();
  const trpcUtils = trpc.useUtils();
  const query = trpc.publicApi.getAdminNotificationCenter.useQuery(adminApiInput(), {
    enabled,
    refetchInterval: enabled ? 60_000 : false,
  });
  const decideTimeOff = trpc.publicApi.decideTimeOffRequest.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "approved"
          ? t("notifications.timeOffApproved")
          : t("notifications.timeOffDenied")
      );
      void query.refetch();
      void trpcUtils.publicApi.listTimeOffRequests.invalidate();
      void trpcUtils.publicApi.getTimeOffCalendarMonth.invalidate();
      void trpcUtils.publicApi.getTodayWorkforceStatus.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("notifications.timeOffUpdateFailed"));
    },
  });
  const decideIncident = trpc.publicApi.decideIncident.useMutation({
    onSuccess: (_data, variables) => {
      toast.success(
        variables.decision === "approved"
          ? t("notifications.incidentApproved")
          : t("notifications.incidentRejected")
      );
      void query.refetch();
      void trpcUtils.publicApi.listIncidents.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || t("notifications.incidentUpdateFailed"));
    },
  });
  const total = query.data?.totalCount ?? 0;
  const decidingTimeOffId = decideTimeOff.isPending ? decideTimeOff.variables?.requestId : null;
  const decidingIncidentId = decideIncident.isPending ? decideIncident.variables?.incidentId : null;

  const timeOffKindLabel = (kind: string) => {
    const label = t(`notifications.timeOffKinds.${kind}`);
    return label === `notifications.timeOffKinds.${kind}` ? kind : label;
  };

  const incidentTypeLabel = (type: string) => {
    const label = t(`notifications.incidentTypes.${type}`);
    return label === `notifications.incidentTypes.${type}` ? type : label;
  };

  const ariaLabel =
    total > 0
      ? t("notifications.ariaLabelPending", { count: total })
      : t("notifications.ariaLabel");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="relative" aria-label={ariaLabel}>
          <Bell className="size-4" />
          {total > 0 ? (
            <span
              className={cn(
                "absolute -right-1 -top-1 flex min-h-5 min-w-5 items-center justify-center rounded-full",
                "bg-rose-600 px-1 text-[10px] font-bold text-white"
              )}
            >
              {total > 9 ? "9+" : total}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b px-4 py-3">
          <p className="text-sm font-semibold text-foreground">{t("notifications.title")}</p>
          <p className="text-xs text-muted-foreground">{t("notifications.subtitle")}</p>
        </div>
        <div className="max-h-96 overflow-y-auto p-2">
          {query.isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">{t("notifications.loading")}</p>
          ) : total === 0 ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">{t("notifications.empty")}</p>
          ) : (
            <div className="space-y-3">
              {(query.data?.gdprPending ?? 0) > 0 ? (
                <section className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2">
                  <p className="text-sm font-medium text-violet-900">
                    {t("notifications.gdprPending", { count: query.data?.gdprPending ?? 0 })}
                  </p>
                  <p className="text-xs text-violet-800">{t("notifications.gdprReview")}</p>
                </section>
              ) : null}

              {(query.data?.timeOff ?? []).length > 0 ? (
                <section>
                  <div className="mb-1 flex items-center justify-between gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <Palmtree className="size-3.5 text-teal-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("notifications.timeOffSection")}
                      </p>
                    </div>
                    {onOpenTimeOff ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700 hover:underline"
                        onClick={onOpenTimeOff}
                      >
                        {t("notifications.viewAll")}
                      </button>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {(query.data?.timeOff ?? []).map((item) => (
                      <li
                        key={`to-${item.id}`}
                        className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-foreground">{item.employeeName}</p>
                        <p className="text-xs text-muted-foreground">
                          {timeOffKindLabel(item.kind)} · {formatShortDate(item.startDate, locale)}
                          {item.endDate !== item.startDate
                            ? ` – ${formatShortDate(item.endDate, locale)}`
                            : ""}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                            disabled={decidingTimeOffId === item.id}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: item.id,
                                decision: "approved",
                              })
                            }
                          >
                            {t("notifications.approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={decidingTimeOffId === item.id}
                            onClick={() =>
                              decideTimeOff.mutate({
                                ...adminApiInput(),
                                requestId: item.id,
                                decision: "rejected",
                              })
                            }
                          >
                            {t("notifications.deny")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {(query.data?.incidents ?? []).length > 0 ? (
                <section>
                  <div className="mb-1 flex items-center justify-between gap-2 px-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="size-3.5 text-amber-600" />
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {t("notifications.incidentsSection")}
                      </p>
                    </div>
                    {onOpenIncidents ? (
                      <button
                        type="button"
                        className="text-xs font-medium text-blue-700 hover:underline"
                        onClick={onOpenIncidents}
                      >
                        {t("notifications.viewAll")}
                      </button>
                    ) : null}
                  </div>
                  <ul className="space-y-2">
                    {(query.data?.incidents ?? []).map((item) => (
                      <li
                        key={`inc-${item.id}`}
                        className="rounded-lg border border-border/80 bg-muted/20 px-3 py-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{item.employeeName}</p>
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            {t("notifications.pending")}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {incidentTypeLabel(item.type)}
                          {item.reason ? ` · ${item.reason}` : ""}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="h-7 bg-emerald-600 px-2 text-xs text-white hover:bg-emerald-700"
                            disabled={decidingIncidentId === item.id}
                            onClick={() =>
                              decideIncident.mutate({
                                ...adminApiInput(),
                                incidentId: item.id,
                                decision: "approved",
                              })
                            }
                          >
                            {t("notifications.approve")}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="h-7 px-2 text-xs"
                            disabled={decidingIncidentId === item.id}
                            onClick={() =>
                              decideIncident.mutate({
                                ...adminApiInput(),
                                incidentId: item.id,
                                decision: "rejected",
                              })
                            }
                          >
                            {t("notifications.reject")}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
