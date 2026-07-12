import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calculator } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useLocale } from "@/contexts/LocaleContext";

export default function EmployeeCalculator() {
  const { t, locale } = useLocale();
  const [, setLocation] = useLocation();
  const [hoursWorked, setHoursWorked] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");

  const total = useMemo(() => {
    const hours = Number(hoursWorked);
    const rate = Number(hourlyRate);
    if (Number.isNaN(hours) || Number.isNaN(rate)) return 0;
    return Math.max(hours, 0) * Math.max(rate, 0);
  }, [hoursWorked, hourlyRate]);

  const numberLocale = locale === "en" ? "en-US" : "es-ES";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-accent rounded-lg">
              <Calculator className="w-5 h-5 text-accent-foreground" />
            </div>
            <h1 className="text-xl font-bold text-foreground">{t("employee.calculator.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <Button
              onClick={() => setLocation("/employee")}
              variant="ghost"
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("common.back")}
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <Card className="p-6 max-w-xl mx-auto space-y-6">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("employee.calculator.hoursWorked")}
            </label>
            <input
              type="number"
              min="0"
              step="0.25"
              value={hoursWorked}
              onChange={(event) => setHoursWorked(event.target.value)}
              className="input-elegant"
              placeholder={t("employee.calculator.hoursPlaceholder")}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              {t("employee.calculator.hourlyRate")}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={hourlyRate}
              onChange={(event) => setHourlyRate(event.target.value)}
              className="input-elegant"
              placeholder={t("employee.calculator.ratePlaceholder")}
            />
          </div>
          <div className="p-4 rounded-lg border border-border bg-muted">
            <p className="text-sm text-muted-foreground">{t("employee.calculator.estimatedTotal")}</p>
            <p className="text-2xl font-semibold text-foreground">
              {total.toLocaleString(numberLocale, {
                style: "currency",
                currency: "EUR",
              })}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">{t("employee.calculator.disclaimer")}</p>
        </Card>
      </main>
    </div>
  );
}
