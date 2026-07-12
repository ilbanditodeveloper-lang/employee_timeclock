import { Calendar, CalendarDays, House, Palmtree, Scale } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/contexts/LocaleContext";

export default function EmployeeBottomMenu() {
  const [location, setLocation] = useLocation();
  const { t } = useLocale();

  const items = [
    { key: "dashboard", label: t("nav.employee.home"), path: "/employee", icon: House },
    { key: "timeoff", label: t("nav.employee.timeOff"), path: "/employee/time-off", icon: Palmtree },
    { key: "calendar", label: t("nav.employee.calendar"), path: "/employee/calendar", icon: Calendar },
    { key: "schedule", label: t("nav.employee.schedule"), path: "/employee/schedule", icon: CalendarDays },
    { key: "legal", label: t("nav.employee.legal"), path: "/employee/legal", icon: Scale },
  ] as const;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-blue-200 bg-white shadow-[0_-8px_24px_-12px_rgba(30,64,175,0.25)] backdrop-blur md:hidden supports-[backdrop-filter]:bg-white/95">
      <div className="mx-auto max-w-lg px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        <div className="grid grid-cols-5 gap-1">
        {items.map((item) => {
          const active = location === item.path;
          const Icon = item.icon;
          return (
            <Button
              key={item.key}
              type="button"
              variant="ghost"
              className={cn(
                "h-14 flex flex-col items-center justify-center gap-1 text-xs",
                active ? "bg-blue-600 text-white hover:bg-blue-700 hover:text-white" : "text-slate-600"
              )}
              onClick={() => setLocation(item.path)}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Button>
          );
        })}
        </div>
      </div>
    </nav>
  );
}
