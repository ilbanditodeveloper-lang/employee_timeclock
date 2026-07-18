import { useMemo } from "react";
import { CalendarClock, AlertTriangle, CreditCard, Sparkles } from "lucide-react";
import { AppShellPanel } from "@/components/AppShellLayout";
import { useLocale } from "@/contexts/LocaleContext";
import type { AppLocale } from "@/i18n/types";
import { cn } from "@/lib/utils";
import {
  buildUpcomingPayments,
  estimatePaymentAmountLabel,
  type UpcomingPaymentKind,
  type UpcomingPaymentSource,
} from "@shared/upcomingPayments";
import type { LandingPricingPack } from "@shared/landingConfig";

type Props = {
  companies: UpcomingPaymentSource[];
  pricingPacks?: LandingPricingPack[] | null;
  className?: string;
};

function formatDueDate(value: Date, locale: AppLocale) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function daysUntil(dueAt: Date, now: Date): number {
  return Math.ceil((dueAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

function kindIcon(kind: UpcomingPaymentKind) {
  if (kind === "payment_overdue") return AlertTriangle;
  if (kind === "trial_end") return Sparkles;
  return CreditCard;
}

function billingStatusClass(status: string | null) {
  if (!status) return "bg-slate-100 text-slate-700";
  if (status === "active") return "bg-emerald-100 text-emerald-800";
  if (status === "trialing") return "bg-blue-100 text-blue-800";
  if (status === "past_due" || status === "unpaid") return "bg-red-100 text-red-800";
  if (status === "canceled") return "bg-slate-200 text-slate-600";
  return "bg-amber-100 text-amber-900";
}

export default function SuperAdminUpcomingPaymentsPanel({
  companies,
  pricingPacks,
  className,
}: Props) {
  const { t, locale } = useLocale();
  const now = useMemo(() => new Date(), []);

  const payments = useMemo(
    () => buildUpcomingPayments(companies, now),
    [companies, now]
  );

  const stats = useMemo(() => {
    const overdue = payments.filter((p) => p.kind === "payment_overdue").length;
    const next30 = payments.filter((p) => {
      const days = daysUntil(p.dueAt, now);
      return days >= 0 && days <= 30;
    }).length;
    return { total: payments.length, overdue, next30 };
  }, [payments, now]);

  const kindLabel = (kind: UpcomingPaymentKind) => {
    if (kind === "renewal") return t("superadmin.dashboard.upcomingPayments.kind.renewal");
    if (kind === "trial_end") return t("superadmin.dashboard.upcomingPayments.kind.trialEnd");
    return t("superadmin.dashboard.upcomingPayments.kind.overdue");
  };

  const relativeLabel = (dueAt: Date, kind: UpcomingPaymentKind) => {
    if (kind === "payment_overdue") {
      return t("superadmin.dashboard.upcomingPayments.relative.overdue");
    }
    const days = daysUntil(dueAt, now);
    if (days <= 0) return t("superadmin.dashboard.upcomingPayments.relative.today");
    if (days === 1) return t("superadmin.dashboard.upcomingPayments.relative.tomorrow");
    return t("superadmin.dashboard.upcomingPayments.relative.inDays", { days: String(days) });
  };

  return (
    <AppShellPanel
      title={t("superadmin.dashboard.upcomingPayments.title")}
      description={t("superadmin.dashboard.upcomingPayments.description")}
      className={className}
    >
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
          {t("superadmin.dashboard.upcomingPayments.stats.total", { count: String(stats.total) })}
        </span>
        <span className="rounded-full bg-blue-50 px-3 py-1 font-medium text-blue-800">
          {t("superadmin.dashboard.upcomingPayments.stats.next30", { count: String(stats.next30) })}
        </span>
        {stats.overdue > 0 ? (
          <span className="rounded-full bg-red-50 px-3 py-1 font-medium text-red-800">
            {t("superadmin.dashboard.upcomingPayments.stats.overdue", { count: String(stats.overdue) })}
          </span>
        ) : null}
      </div>

      {payments.length === 0 ? (
        <p className="text-sm text-slate-500">
          {t("superadmin.dashboard.upcomingPayments.empty")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.company")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.plan")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.amount")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.type")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.date")}
                </th>
                <th className="px-3 py-2 font-semibold">
                  {t("superadmin.dashboard.upcomingPayments.columns.billing")}
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => {
                const Icon = kindIcon(payment.kind);
                const amount = estimatePaymentAmountLabel(payment.plan, pricingPacks);
                return (
                  <tr
                    key={`${payment.companyId}-${payment.kind}-${payment.dueAt.toISOString()}`}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-semibold text-slate-900">{payment.companyName}</p>
                      {payment.billingEmail ? (
                        <p className="text-xs text-slate-500">{payment.billingEmail}</p>
                      ) : null}
                      {!payment.isActive ? (
                        <p className="mt-1 text-xs font-medium text-slate-500">
                          {t("superadmin.dashboard.upcomingPayments.inactiveCompany")}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-top text-slate-700">{payment.planName}</td>
                    <td className="px-3 py-3 align-top font-medium text-slate-900">
                      {amount ?? t("superadmin.dashboard.upcomingPayments.amountUnknown")}
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
                          payment.kind === "payment_overdue"
                            ? "bg-red-50 text-red-800"
                            : payment.kind === "trial_end"
                              ? "bg-violet-50 text-violet-800"
                              : "bg-blue-50 text-blue-800"
                        )}
                      >
                        <Icon className="size-3.5 shrink-0" />
                        {kindLabel(payment.kind)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 size-4 shrink-0 text-slate-400" />
                        <div>
                          <p className="font-medium text-slate-900">
                            {formatDueDate(payment.dueAt, locale)}
                          </p>
                          <p
                            className={cn(
                              "text-xs",
                              payment.kind === "payment_overdue"
                                ? "font-semibold text-red-700"
                                : "text-slate-500"
                            )}
                          >
                            {relativeLabel(payment.dueAt, payment.kind)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <span
                        className={cn(
                          "inline-block rounded-full px-2.5 py-1 text-xs font-semibold capitalize",
                          billingStatusClass(payment.billingStatus)
                        )}
                      >
                        {payment.billingStatus ??
                          t("superadmin.dashboard.upcomingPayments.billingUnknown")}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AppShellPanel>
  );
}
