import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Clock, LogOut } from "lucide-react";
import EmployeeBottomMenu from "@/components/EmployeeBottomMenu";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

type EmployeeShellLayoutProps = {
  pageTitle: string;
  pageSubtitle?: string;
  children: ReactNode;
  contentClassName?: string;
  showBottomMenu?: boolean;
};

export default function EmployeeShellLayout({
  pageTitle,
  pageSubtitle,
  children,
  contentClassName = "container mx-auto max-w-4xl px-4 py-8 pb-28 md:pb-8",
  showBottomMenu = true,
}: EmployeeShellLayoutProps) {
  const [, setLocation] = useLocation();
  const { clearAllSessions, setEmployeeSession } = useAuthContext();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();

  const handleLogout = async () => {
    try {
      await logoutSession.mutateAsync();
    } catch {
      // ignore
    }
    clearAllSessions();
    setEmployeeSession(null);
    setLocation("/acceso");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f7f6]">
      <header className="sticky top-0 z-30 shrink-0 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="container flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-800 text-white shadow-sm">
              <Clock className="size-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{pageTitle}</h1>
              {pageSubtitle ? (
                <p className="truncate text-xs text-slate-500 sm:text-sm">{pageSubtitle}</p>
              ) : null}
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void handleLogout()}
            className="shrink-0 gap-2 text-slate-600 hover:text-slate-900"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={contentClassName}>{children}</div>
      </main>

      {showBottomMenu ? <EmployeeBottomMenu /> : null}
    </div>
  );
}
