import { useLocale } from "@/contexts/LocaleContext";
import type { AppLocale } from "@/i18n/types";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  compact?: boolean;
};

const OPTIONS: { id: AppLocale; labelKey: "es" | "en" }[] = [
  { id: "es", labelKey: "es" },
  { id: "en", labelKey: "en" },
];

export default function LanguageSwitcher({ className, compact }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useLocale();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm",
        className
      )}
      role="group"
      aria-label={t("common.language.label")}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => setLocale(option.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
            locale === option.id
              ? "bg-blue-700 text-white"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            compact && "px-2 py-0.5 text-[11px]"
          )}
        >
          {t(`common.language.${option.labelKey}`)}
        </button>
      ))}
    </div>
  );
}
