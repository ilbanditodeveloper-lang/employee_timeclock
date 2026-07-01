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

const NAV_ITEMS: { label: string; icon: LucideIcon; active?: boolean }[] = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Empleados", icon: Users },
  { label: "Horas", icon: Clock },
  { label: "Turnos", icon: UserCog },
  { label: "Vacaciones", icon: CalendarDays },
  { label: "Incidencias", icon: Shield },
  { label: "Auditoría", icon: FileText },
  { label: "Legal / RGPD", icon: Scale },
  { label: "Ajustes", icon: Settings },
];

type Props = {
  compact?: boolean;
  className?: string;
};

/**
 * Mockup estático del panel admin real — solo para la landing (no afecta la app).
 */
export default function LandingDashboardMockup({ compact = false, className }: Props) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-slate-200 bg-[#f4f7f6] shadow-2xl",
        compact ? "max-w-[320px]" : "w-full",
        className
      )}
    >
      <div className={cn("flex", compact ? "min-h-[220px]" : "min-h-[420px]")}>
        <aside
          className={cn(
            "app-shell-sidebar shrink-0 text-white",
            compact ? "w-[88px]" : "w-[200px] hidden sm:block"
          )}
        >
          <div className="border-b border-white/10 p-3">
            <div className="flex items-center gap-2">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                <Clock className="size-4" />
              </div>
              {!compact ? (
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold uppercase tracking-wide">TimeClock</p>
                  <p className="truncate text-[10px] text-slate-300">Fichaje de empleados</p>
                </div>
              ) : null}
            </div>
          </div>

          <nav className="space-y-0.5 p-2">
            {NAV_ITEMS.slice(0, compact ? 4 : NAV_ITEMS.length).map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium",
                    item.active
                      ? "bg-[#3b82f6] text-white"
                      : "text-slate-300"
                  )}
                >
                  <Icon className="size-3 shrink-0" />
                  {!compact ? <span className="truncate">{item.label}</span> : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 p-3 sm:p-4">
          {!compact ? (
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-slate-900">Dashboard</p>
                <p className="text-[10px] text-slate-500">
                  Seguimiento en vivo · Cafetería Sol · 01/07/2026
                </p>
              </div>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600">
                Actualizar
              </span>
            </div>
          ) : (
            <p className="mb-2 text-[10px] font-bold text-slate-900">Dashboard · En vivo</p>
          )}

          <div className="grid grid-cols-1 gap-2">
            <MockKpiCard
              compact={compact}
              tone="emerald"
              title="Trabajando"
              count={3}
              items={compact ? undefined : ["Ana · 08:02", "Carlos · 08:15", "María · 09:00"]}
            />
            <MockKpiCard
              compact={compact}
              tone="amber"
              title="En pausa"
              count={1}
              items={compact ? undefined : ["Pedro · 11:30"]}
            />
            <MockKpiCard
              compact={compact}
              tone="teal"
              title="Vacaciones"
              count={1}
              items={compact ? undefined : ["Laura"]}
            />
            <MockKpiCard
              compact={compact}
              tone="muted"
              title="Sin fichar"
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
  compact: boolean;
  tone: "emerald" | "amber" | "teal" | "muted";
  title: string;
  count: number;
  items?: string[];
  chips?: string[];
}) {
  const tones = {
    emerald: "border-emerald-200 bg-emerald-50/80 text-emerald-800",
    amber: "border-amber-200 bg-amber-50/80 text-amber-800",
    teal: "border-teal-200 bg-teal-50/80 text-teal-800",
    muted: "border-slate-200 bg-slate-50 text-slate-800",
  };

  return (
    <div className={cn("rounded-xl border p-2.5", tones[tone], compact ? "min-h-[56px]" : "min-h-0")}>
      <div className="mb-1.5 flex items-center justify-between gap-1">
        <p className={cn("font-semibold", compact ? "text-[9px]" : "text-xs")}>{title}</p>
        <span className="rounded bg-white/80 px-1.5 py-0.5 text-[9px] font-bold text-slate-700">
          {count}
        </span>
      </div>
      {!compact && items ? (
        <ul className="space-y-1">
          {items.map((line) => (
            <li
              key={line}
              className="rounded border border-white/60 bg-white/70 px-2 py-1 text-[10px] text-slate-700"
            >
              {line}
            </li>
          ))}
        </ul>
      ) : null}
      {!compact && chips ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((name) => (
            <span
              key={name}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-700"
            >
              {name}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
