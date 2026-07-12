import { type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

type AccessPageShellProps = {
  backHref?: string;
  backLabel?: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidthClass?: string;
};

export default function AccessPageShell({
  backHref = "/acceso",
  backLabel = "Volver",
  icon: Icon,
  title,
  subtitle,
  badge,
  children,
  footer,
  maxWidthClass = "max-w-md",
}: AccessPageShellProps) {
  const { t } = useLocale();
  const resolvedBackLabel = backLabel ?? t("common.back");

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-blue-50/60 to-blue-100/50 px-4 py-8 sm:py-12">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-200/30 via-transparent to-transparent"
        aria-hidden
      />

      <div className={`relative mx-auto w-full ${maxWidthClass}`}>
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-sm text-slate-600 transition-colors hover:text-blue-800"
          >
            <ArrowLeft className="size-4" />
            {resolvedBackLabel}
          </Link>
          <LanguageSwitcher compact />
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute -inset-3 rounded-[1.75rem] bg-gradient-to-br from-blue-500/25 via-blue-600/15 to-blue-900/30 blur-xl"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-20px_rgba(30,64,175,0.35)]">
            <div className="h-1.5 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-900" />
            <div className="bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 px-6 py-8 text-center text-white">
              <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl bg-white/15 shadow-lg backdrop-blur-sm sm:size-16">
                <Icon className="size-7 text-white sm:size-8" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-2 text-sm text-blue-100/90 sm:text-base">{subtitle}</p>
              {badge ? (
                <p className="mt-4 inline-block rounded-full bg-blue-800/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-blue-100">
                  {badge}
                </p>
              ) : null}
            </div>

            <div className="space-y-5 p-6 sm:p-8">{children}</div>

            {footer ? <div className="border-t border-blue-100 px-6 pb-6 sm:px-8">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
