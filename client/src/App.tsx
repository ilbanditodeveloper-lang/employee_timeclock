import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { LocaleProvider, useLocale } from "./contexts/LocaleContext";
import { AuthProvider, IdleSessionWatcher } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import LandingPage from "./pages/LandingPage";
import Home from "./pages/Home";
import EmployeeLogin from "./pages/EmployeeLogin";
import AdminLogin from "./pages/AdminLogin";
import MultiClockLogin from "./pages/MultiClockLogin";
import MultiClockTerminal from "./pages/MultiClockTerminal";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import EmployeeIncident from "./pages/EmployeeIncident";
import EmployeeCalendar from "./pages/EmployeeCalendar";
import EmployeeCalculator from "./pages/EmployeeCalculator";
import EmployeeSchedule from "./pages/EmployeeSchedule";
import EmployeeTimeOff from "./pages/EmployeeTimeOff";
import EmployeeLegal from "./pages/EmployeeLegal";
import AdminDashboard from "./pages/AdminDashboard";
import AdminOnboarding from "./pages/AdminOnboarding";
import SuperAdmin from "./pages/SuperAdmin";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfUse from "./pages/TermsOfUse";
import PlatformDpa from "./pages/PlatformDpa";
import EmployeePrivacyNotice from "./pages/EmployeePrivacyNotice";
import RegisterBusiness from "./pages/RegisterBusiness";
import PwaInstallPrompt from "./components/PwaInstallPrompt";
import EmployeePrivacyGate from "./components/EmployeePrivacyGate";
import { useAuthContext } from "./contexts/AuthContext";

function EmployeeNoticeRoute() {
  const { isEmployeeAuthenticated, employeeSession } = useAuthContext();
  const needsAccept = Boolean(
    isEmployeeAuthenticated && employeeSession?.needsPrivacyNotice
  );
  return <EmployeePrivacyNotice embedded={needsAccept} />;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={LandingPage} />
      <Route path={"/acceso"} component={Home} />
      <Route path={"/register-business"} component={RegisterBusiness} />
      <Route path={"/employee-login"} component={EmployeeLogin} />
      <Route path={"/admin-login"} component={AdminLogin} />
      <Route path={"/multifichaje"} component={MultiClockLogin} />
      <Route path={"/multifichaje/panel"} component={MultiClockTerminal} />
      <Route path={"/superadmin"} component={SuperAdmin} />
      <Route path={"/employee/calendar"} component={() => (
        <EmployeePrivacyGate><EmployeeCalendar /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee/schedule"} component={() => (
        <EmployeePrivacyGate><EmployeeSchedule /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee/calculator"} component={() => (
        <EmployeePrivacyGate><EmployeeCalculator /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee/incident"} component={() => (
        <EmployeePrivacyGate><EmployeeIncident /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee/time-off"} component={() => (
        <EmployeePrivacyGate><EmployeeTimeOff /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee/legal"} component={() => (
        <EmployeePrivacyGate><EmployeeLegal /></EmployeePrivacyGate>
      )} />
      <Route path={"/employee"} component={() => (
        <EmployeePrivacyGate><EmployeeDashboard /></EmployeePrivacyGate>
      )} />
      <Route path={"/legal/privacy"} component={PrivacyPolicy} />
      <Route path={"/legal/terms"} component={TermsOfUse} />
      <Route path={"/legal/dpa"} component={PlatformDpa} />
      <Route
        path={"/legal/employee-notice"}
        component={EmployeeNoticeRoute}
      />
      <Route path={"/admin/onboarding"} component={AdminOnboarding} />
      <Route path={"/admin"} component={AdminDashboard} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function UpdateAppButton() {
  const { t } = useLocale();
  const [showUpdateButton, setShowUpdateButton] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    const onUpdateAvailable = () => setShowUpdateButton(true);
    window.addEventListener("timeclock-update-available", onUpdateAvailable);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistration().then(registration => {
        if (registration?.waiting) {
          setShowUpdateButton(true);
        }
      });
    }

    return () => {
      window.removeEventListener("timeclock-update-available", onUpdateAvailable);
    };
  }, []);

  const handleRefreshApp = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration?.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
          return;
        }
        await registration?.update();
      }
      window.location.reload();
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!showUpdateButton) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Button onClick={handleRefreshApp} className="shadow-lg" disabled={isRefreshing}>
        <RefreshCw className="w-4 h-4 mr-2" />
        {isRefreshing ? t("common.updating") : t("common.updateApp")}
      </Button>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LocaleProvider>
          <AuthProvider>
            <IdleSessionWatcher />
            <TooltipProvider>
              <Toaster />
              <Router />
              <UpdateAppButton />
              <PwaInstallPrompt />
            </TooltipProvider>
          </AuthProvider>
        </LocaleProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
