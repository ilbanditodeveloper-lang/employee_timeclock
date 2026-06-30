import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";

export type AppShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type AppShellLayoutProps = {
  brandLabel: string;
  brandIcon: ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  userName?: string;
  userEmail?: string;
  navItems: AppShellNavItem[];
  activeNavId: string;
  onNavChange: (id: string) => void;
  headerActions?: ReactNode;
  onLogout?: () => void;
  children: ReactNode;
};

export default function AppShellLayout({
  brandLabel,
  brandIcon,
  pageTitle,
  pageSubtitle,
  userName,
  userEmail,
  navItems,
  activeNavId,
  onNavChange,
  headerActions,
  onLogout,
  children,
}: AppShellLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem = navItems.find((item) => item.id === activeNavId);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white/10 text-white">
            {brandIcon}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold uppercase tracking-wide text-white">
              {brandLabel}
            </p>
            <p className="truncate text-xs text-slate-300">TimeClock</p>
          </div>
        </div>
      </div>

      {(userName || userEmail) && (
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#3b82f6] text-sm font-bold text-white">
              {(userName ?? "U").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{userName ?? "Usuario"}</p>
              {userEmail ? (
                <p className="truncate text-xs text-slate-400">{userEmail}</p>
              ) : null}
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.id === activeNavId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onNavChange(item.id);
                setMobileOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#3b82f6] text-white shadow-md shadow-blue-900/30"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {onLogout ? (
        <div className="border-t border-white/10 p-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onLogout}
            className="w-full justify-start gap-2 text-slate-300 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-4" />
            Cerrar sesión
          </Button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-[#f4f7f6]">
      <aside className="app-shell-sidebar hidden w-64 shrink-0 lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/50"
            aria-label="Cerrar menú"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="app-shell-sidebar relative z-10 h-full w-72 shadow-2xl">{sidebar}</aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="lg:hidden"
                onClick={() => setMobileOpen((open) => !open)}
                aria-label="Abrir menú"
              >
                {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
              </Button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">
                  {pageTitle}
                </h1>
                {pageSubtitle ? (
                  <p className="truncate text-xs text-slate-500 sm:text-sm">{pageSubtitle}</p>
                ) : activeItem ? (
                  <p className="truncate text-xs text-slate-500 sm:text-sm">{activeItem.label}</p>
                ) : null}
              </div>
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:px-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}

export function AppShellKpiCard({
  label,
  value,
  icon,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: "blue" | "emerald" | "amber" | "rose";
}) {
  const accents = {
    blue: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="app-shell-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
        </div>
        <div
          className={cn(
            "flex size-11 items-center justify-center rounded-xl",
            accents[accent]
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

export function AppShellPanel({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-shell-card p-5 sm:p-6", className)}>
      {title ? (
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          ) : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
