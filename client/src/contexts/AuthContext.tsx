import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useIdleSessionTimeout } from "@/hooks/useIdleSessionTimeout";

export type EmployeeScheduleDay = {
  entry1: string;
  entry2: string;
  exit1?: string;
  exit2?: string;
  isActive: boolean;
};

export type AdminSession = {
  companySlug: string;
  displayName?: string;
};

export type EmployeeSession = {
  username: string;
  employeeId: number;
  companySlug: string;
  displayName?: string;
  schedule?: Record<string, EmployeeScheduleDay>;
  lateGraceMinutes?: number;
  locationEnabled?: boolean;
  needsPrivacyNotice?: boolean;
  timezone?: string;
};

type AuthContextValue = {
  adminSession: AdminSession | null;
  employeeSession: EmployeeSession | null;
  isAdminAuthenticated: boolean;
  isEmployeeAuthenticated: boolean;
  isSuperAdminAuthenticated: boolean;
  setAdminSession: (session: AdminSession | null) => void;
  setEmployeeSession: (session: EmployeeSession | null) => void;
  clearAllSessions: () => void;
  isAuthLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [employeeSession, setEmployeeSession] = useState<EmployeeSession | null>(null);

  const sessionQuery = trpc.publicApi.getSession.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });

  const serverSession = sessionQuery.data?.session ?? null;
  const isAdminAuthenticated = serverSession?.type === "admin";
  const isEmployeeAuthenticated = serverSession?.type === "employee";
  const isSuperAdminAuthenticated = serverSession?.type === "superadmin";
  const isAuthLoading = sessionQuery.isLoading && !sessionQuery.isError;

  useEffect(() => {
    if (!sessionQuery.isFetched) return;
    if (!serverSession) {
      setAdminSession(null);
      setEmployeeSession(null);
    }
  }, [sessionQuery.isFetched, serverSession]);

  const activeAdminSession = useMemo((): AdminSession | null => {
    if (serverSession?.type === "admin" && serverSession.companySlug) {
      return {
        companySlug: serverSession.companySlug,
        displayName: serverSession.displayName ?? adminSession?.displayName,
      };
    }
    return adminSession;
  }, [serverSession, adminSession]);

  const activeEmployeeSession = useMemo((): EmployeeSession | null => {
    if (
      serverSession?.type === "employee" &&
      serverSession.employeeId &&
      serverSession.companySlug
    ) {
      const sameEmployee = employeeSession?.employeeId === serverSession.employeeId;
      const serverLocation =
        typeof serverSession.locationEnabled === "boolean"
          ? serverSession.locationEnabled
          : undefined;
      const serverTimezone =
        typeof serverSession.timezone === "string" ? serverSession.timezone : undefined;
      const serverGrace =
        typeof serverSession.lateGraceMinutes === "number"
          ? serverSession.lateGraceMinutes
          : undefined;
      const serverPrivacy =
        typeof serverSession.needsPrivacyNotice === "boolean"
          ? serverSession.needsPrivacyNotice
          : undefined;
      return {
        username: sameEmployee
          ? (employeeSession?.username ?? serverSession.displayName ?? "")
          : (serverSession.displayName ?? ""),
        employeeId: serverSession.employeeId,
        companySlug: serverSession.companySlug,
        displayName: serverSession.displayName ?? employeeSession?.displayName,
        schedule: sameEmployee ? employeeSession?.schedule : undefined,
        lateGraceMinutes: serverGrace ?? (sameEmployee ? employeeSession?.lateGraceMinutes : undefined),
        locationEnabled: serverLocation ?? (sameEmployee ? employeeSession?.locationEnabled : undefined) ?? false,
        needsPrivacyNotice:
          serverPrivacy ?? (sameEmployee ? employeeSession?.needsPrivacyNotice : undefined),
        timezone: serverTimezone ?? (sameEmployee ? employeeSession?.timezone : undefined),
      };
    }
    return employeeSession;
  }, [serverSession, employeeSession]);

  const clearAllSessions = () => {
    setAdminSession(null);
    setEmployeeSession(null);
  };

  const value = useMemo(
    () => ({
      adminSession: activeAdminSession,
      employeeSession: activeEmployeeSession,
      isAdminAuthenticated,
      isEmployeeAuthenticated,
      isSuperAdminAuthenticated,
      setAdminSession,
      setEmployeeSession,
      clearAllSessions,
      isAuthLoading,
    }),
    [
      activeAdminSession,
      activeEmployeeSession,
      isAdminAuthenticated,
      isEmployeeAuthenticated,
      isSuperAdminAuthenticated,
      isAuthLoading,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Mounted inside AuthProvider — closes session after 1h without user activity. */
export function IdleSessionWatcher() {
  useIdleSessionTimeout();
  return null;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}

export function useRequireEmployeeAuth() {
  const [, setLocation] = useLocation();
  const { isAuthLoading, isEmployeeAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isEmployeeAuthenticated) {
      setLocation("/employee-login");
    }
  }, [isAuthLoading, isEmployeeAuthenticated, setLocation]);

  return { isAuthLoading, isEmployeeAuthenticated };
}

export function useRequireAdminAuth() {
  const [, setLocation] = useLocation();
  const { isAuthLoading, isAdminAuthenticated } = useAuthContext();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAdminAuthenticated) {
      setLocation("/admin-login");
    }
  }, [isAuthLoading, isAdminAuthenticated, setLocation]);

  return { isAuthLoading, isAdminAuthenticated };
}
