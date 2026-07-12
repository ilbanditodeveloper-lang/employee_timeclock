import { useMemo } from "react";
import {
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Palmtree,
  Scale,
  Settings,
  Shield,
  Users,
  UserCog,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

type Props = {
  compact?: boolean;
  className?: string;
};

/**
 * Mockup estático del panel admin real — solo para la landing (no afecta la app).
 */
export default function LandingDashboardMockup({ compact = false, className }: Props) {
  const { t } = useLocale();

  const navItems = useMemo(
    (): { label: string; icon: LucideIcon; active?: boolean }[] => [
      { label: t("nav.admin.dashboard"), icon: LayoutDashboard, active: true },
      { label: t("nav.admin.employees"), icon: Users },
      { label: t("nav.admin.hours"), icon: Clock },
      { label: t("nav.admin.shifts"), icon: UserCog },
      { label: t("nav.admin.vacations"), icon: CalendarDays },
      { label: t("nav.admin.incidents"), icon: Shield },
      { label: t("nav.admin.audit"), icon: FileText },
      { label: t("nav.admin.legal"), icon: Scale },
      { label: t("nav.admin.settings"), icon: Settings },
    ],
    [t]
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7f6] shadow-2xl",
        compact ? "max-w-[320px]" : "w-full",
        className
      )}
    >
      <div className={cn("flex", compact ? "min-h-[220px]" : "min-h-[380px] sm:min-h-[420px]")}>
        <aside
          className={cn(
            "app-shell-sidebar shrink-0 text-white",
            compact ? "w-[88px]" : "w-[72px] sm:w-[200px]"
          )}
        >
          <div className="border-b border-white/10 p-2 sm:p-3">
            <div className="flex items-center justify-center gap-2 sm:justify-start">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Clock className="size-4" />
              </div>
              {!compact ? (
                <div className="min-w-0 hidden sm:block">
                  <p className="truncate text-xs font-bold uppercase tracking-wide">TimeClock</p>
                  <p className="truncate text-[10px] text-slate-300">{t("landing.brandTagline")}</p>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="space-y-0.5 p-1.5 sm:p-2">
            {navItems.slice(0, compact ? 4 : navItems.length).map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[10px] font-medium sm:px-2",
                    item.active
                      ? "bg-[#3b82f6] text-white"
                      : "text-slate-300",
                    !compact && "justify-center sm:justify-start"
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  {!compact ? (
                    <span className="truncate hidden sm:inline">{item.label}</span>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-2.5 sm:p-4">
          {!compact ? (
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">{t("admin.dashboard.title")}</p>
                <p className="text-[10px] text-slate-500">{t("landing.mockup.liveSubtitle")}</p>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
                {t("common.refresh")}
              </span>
            </div>
          ) : (
            <p className="mb-2 text-[10px] font-bold text-slate-900">{t("admin.dashboard.mockup.live")}</p>
          )}

          <div className="grid grid-cols-1 gap-2">
            <MockKpiCard
              compact={compact}
              tone="emerald"
              title={t("admin.dashboard.mockup.working")}
              count={3}
              items={compact ? undefined : ["Ana · 08:02", "Carlos · 08:15", "María · 09:00"]}
            />
            <MockKpiCard
              compact={compact}
              tone="amber"
              title={t("admin.dashboard.mockup.onBreak")}
              count={1}
              items={compact ? undefined : ["Pedro · 11:30"]}
            />
            <MockKpiCard
              compact={compact}
              tone="teal"
              title={t("landing.mockup.vacation")}
              count={1}
              items={compact ? undefined : ["Laura"]}
            />
            <MockKpiCard
              compact={compact}
              tone="muted"
              title={t("admin.dashboard.mockup.notClockedIn")}
              count={2}
              chips={compact ? undefined : ["Juan", "Sofía"]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function MockKpiCard({
  compact,
  tone,
  title,
  count,
  items,
  chips,
}: {
  compact?: boolean;
  tone: "emerald" | "amber" | "teal" | "muted";
  title: string;
  count: number;
  items?: string[];
  chips?: string[];
}) {
  const toneClasses = {
    emerald: "border-emerald-200 bg-emerald-50/80",
    amber: "border-amber-200 bg-amber-50/80",
    teal: "border-teal-200 bg-teal-50/80",
    muted: "border-slate-200 bg-slate-50/80",
  };

  return (
    <div className={cn("rounded-lg border p-2", toneClasses[tone])}>
      <div className="flex items-center justify-between gap-1">
        <p className="text-[10px] font-semibold text-slate-800">{title}</p>
        <span className="rounded bg-white/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
          {count}
        </span>
      </div>
      {!compact && items ? (
        <ul className="mt-1 space-y-0.5 text-[9px] text-slate-600">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {!compact && chips ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] text-slate-600"
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
