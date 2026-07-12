import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { SESSION_IDLE_TIMEOUT_MS } from "@shared/const";
import { useLocale } from "@/contexts/LocaleContext";
import { useAuthContext } from "@/contexts/AuthContext";
import { trpc } from "@/lib/trpc";

const IDLE_ACTIVITY_EVENTS = ["mousedown", "keydown", "scroll", "touchstart", "click"] as const;

type SessionRole = "admin" | "employee" | "superadmin";

function loginPathForRole(role: SessionRole): string {
  if (role === "superadmin") return "/acceso";
  if (role === "admin") return "/admin-login";
  return "/employee-login";
}

/**
 * Logs out after SESSION_IDLE_TIMEOUT_MS without mouse/keyboard/touch activity.
 * Applies to admin, employee, and superadmin sessions.
 */
export function useIdleSessionTimeout() {
  const {
    isAdminAuthenticated,
    isEmployeeAuthenticated,
    isSuperAdminAuthenticated,
    clearAllSessions,
  } = useAuthContext();
  const [, setLocation] = useLocation();
  const { t } = useLocale();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();
  const utils = trpc.useUtils();
  const roleRef = useRef<SessionRole | null>(null);

  const isAuthenticated =
    isAdminAuthenticated || isEmployeeAuthenticated || isSuperAdminAuthenticated;

  useEffect(() => {
    if (isSuperAdminAuthenticated) roleRef.current = "superadmin";
    else if (isAdminAuthenticated) roleRef.current = "admin";
    else if (isEmployeeAuthenticated) roleRef.current = "employee";
    else roleRef.current = null;
  }, [isAdminAuthenticated, isEmployeeAuthenticated, isSuperAdminAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const logout = async () => {
      const role = roleRef.current;
      if (!role) return;

      try {
        await logoutSession.mutateAsync();
      } catch {
        // Cookie may already be cleared server-side.
      }
      clearAllSessions();
      await utils.publicApi.getSession.invalidate();
      toast.info(t("auth.session.idleLogout"));
      setLocation(loginPathForRole(role));
    };

    const resetTimer = () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void logout(), SESSION_IDLE_TIMEOUT_MS);
    };

    const onActivity = () => resetTimer();

    for (const eventName of IDLE_ACTIVITY_EVENTS) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    const onVisibility = () => {
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    resetTimer();

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      for (const eventName of IDLE_ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [
    isAuthenticated,
    clearAllSessions,
    logoutSession,
    setLocation,
    t,
    utils.publicApi.getSession,
  ]);
}
