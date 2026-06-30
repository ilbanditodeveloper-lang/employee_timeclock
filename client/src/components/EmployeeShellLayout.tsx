import { type ReactNode } from "react";
import { useLocation } from "wouter";
import { Calendar, CalendarDays, Clock, House, Palmtree } from "lucide-react";
import AppShellLayout, { type AppShellNavItem } from "@/components/AppShellLayout";
import EmployeeBottomMenu from "@/components/EmployeeBottomMenu";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

export const EMPLOYEE_NAV: AppShellNavItem[] = [
  { id: "home", label: "Inicio", icon: House },
  { id: "timeoff", label: "Vacaciones", icon: Palmtree },
  { id: "calendar", label: "Calendario", icon: Calendar },
  { id: "schedule", label: "Horario", icon: CalendarDays },
];

const NAV_TO_PATH: Record<string, string> = {
  home: "/employee",
  timeoff: "/employee/time-off",
  calendar: "/employee/calendar",
  schedule: "/employee/schedule",
};

function pathToNav(path: string): string {
  if (path === "/employee" || path === "/employee/incident") return "home";
  if (path.startsWith("/employee/calculator")) return "calendar";
  if (path.startsWith("/employee/time-off")) return "timeoff";
  if (path.startsWith("/employee/calendar")) return "calendar";
  if (path.startsWith("/employee/schedule")) return "schedule";
  return "home";
}

type EmployeeShellLayoutProps = {
  pageTitle: string;
  pageSubtitle?: string;
  children: ReactNode;
  contentClassName?: string;
  showBottomMenu?: boolean;
};

export default function EmployeeShellLayout({
  pageTitle,
  pageSubtitle = "Fichaje y consulta de horas",
  children,
  contentClassName = "container mx-auto max-w-4xl py-8 pb-28 md:pb-8",
  showBottomMenu = true,
}: EmployeeShellLayoutProps) {
  const [location, setLocation] = useLocation();
  const { employeeSession, clearAllSessions, setEmployeeSession } = useAuthContext();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();

  const handleLogout = async () => {
    try {
      await logoutSession.mutateAsync();
    } catch {
      // ignore
    }
    clearAllSessions();
    setEmployeeSession(null);
    setLocation("/");
  };

  return (
    <>
      <AppShellLayout
        brandLabel={employeeSession?.displayName ?? "Empleado"}
        brandIcon={<Clock className="size-5" />}
        pageTitle={pageTitle}
        pageSubtitle={pageSubtitle}
        userName={employeeSession?.displayName ?? "Empleado"}
        userEmail={employeeSession?.username}
        navItems={EMPLOYEE_NAV}
        activeNavId={pathToNav(location)}
        onNavChange={(id) => {
          const path = NAV_TO_PATH[id];
          if (path) setLocation(path);
        }}
        onLogout={() => void handleLogout()}
      >
        <div className={contentClassName}>{children}</div>
      </AppShellLayout>
      {showBottomMenu ? <EmployeeBottomMenu /> : null}
    </>
  );
}
