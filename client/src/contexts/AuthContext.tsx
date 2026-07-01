import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";

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
  setAdminSession: (session: AdminSession | null) => void;
  setEmployeeSession: (session: EmployeeSession | null) => void;
  clearAllSessions: () => void;
  isAuthLoading: boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [adminSession, setAdminSession] = useState<AdminSession | null>(null);
  const [employeeSession, setEmployeeSession] = useState<EmployeeSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const sessionQuery = trpc.publicApi.getSession.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!sessionQuery.isFetched) return;
    const session = sessionQuery.data?.session;
    if (!session) {
      setAdminSession(null);
      setEmployeeSession(null);
      setHydrated(true);
      return;
    }
    if (session.type === "admin" && session.companySlug) {
      setAdminSession({
        companySlug: session.companySlug,
        displayName: session.displayName,
      });
      setEmployeeSession(null);
    } else if (session.type === "employee" && session.employeeId && session.companySlug) {
      setEmployeeSession((prev) => ({
        username: prev?.username ?? session.displayName ?? "",
        employeeId: session.employeeId!,
        companySlug: session.companySlug!,
        displayName: session.displayName,
        schedule: prev?.schedule,
        lateGraceMinutes: prev?.lateGraceMinutes,
        locationEnabled: prev?.locationEnabled,
        needsPrivacyNotice: prev?.needsPrivacyNotice,
        timezone: prev?.timezone,
      }));
      setAdminSession(null);
    } else {
      setAdminSession(null);
      setEmployeeSession(null);
    }
    setHydrated(true);
  }, [sessionQuery.isFetched, sessionQuery.data, sessionQuery.isError]);

  const clearAllSessions = () => {
    setAdminSession(null);
    setEmployeeSession(null);
  };

  const value = useMemo(
    () => ({
      adminSession,
      employeeSession,
      setAdminSession,
      setEmployeeSession,
      clearAllSessions,
      isAuthLoading: !hydrated && (sessionQuery.isLoading || sessionQuery.isFetching),
    }),
    [adminSession, employeeSession, hydrated, sessionQuery.isLoading, sessionQuery.isFetching]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
