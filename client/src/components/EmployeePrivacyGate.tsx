import EmployeePrivacyNotice from "@/pages/EmployeePrivacyNotice";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";

/**
 * Blocks all employee screens until the current privacy notice is accepted.
 */
export default function EmployeePrivacyGate({ children }: { children: React.ReactNode }) {
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();
  const { employeeSession } = useAuthContext();

  if (isAuthLoading || !isEmployeeAuthenticated) {
    return null;
  }

  if (employeeSession?.needsPrivacyNotice) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900/40 p-4">
        <EmployeePrivacyNotice embedded />
      </div>
    );
  }

  return <>{children}</>;
}
