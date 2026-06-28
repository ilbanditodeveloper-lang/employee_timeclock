import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useLocation } from "wouter";

export default function OnboardingReminderBanner() {
  const [, setLocation] = useLocation();

  return (
    <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-2 flex-1">
        <Sparkles className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-amber-900 dark:text-amber-200 text-sm">
            Configuración inicial pendiente
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">
            Completa los datos de tu negocio, local y revisión legal para sacar el máximo partido a TimeClock.
          </p>
        </div>
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => setLocation("/admin/onboarding")}>
        Continuar configuración
      </Button>
    </div>
  );
}
