import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Keyboard, LogOut, Delete } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import AccessPageShell from "@/components/AccessPageShell";
import { adminApiInput } from "@/lib/adminContext";

type MultiClockFeedback = {
  action: "clock_in" | "clock_out";
  employeeName: string;
  at: Date;
};

const DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"] as const;

export default function MultiClockTerminal() {
  const { t, locale } = useLocale();
  const [, setLocation] = useLocation();
  const {
    isAuthLoading,
    isAdminAuthenticated,
    adminSession,
    setAdminSession,
    setEmployeeSession,
  } = useAuthContext();
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState<MultiClockFeedback | null>(null);
  const multiClockByPin = trpc.publicApi.multiClockByPin.useMutation();
  const logoutSession = trpc.publicApi.logoutSession.useMutation();

  useEffect(() => {
    if (isAuthLoading) return;
    if (!isAdminAuthenticated) {
      setLocation("/multifichaje");
    }
  }, [isAuthLoading, isAdminAuthenticated, setLocation]);

  const submitPin = async (code: string) => {
    const normalized = code.replace(/\D/g, "").slice(0, 4);
    if (normalized.length !== 4 || multiClockByPin.isPending) return;
    try {
      const result = await multiClockByPin.mutateAsync({
        ...adminApiInput(),
        pin: normalized,
      });
      setPin("");
      setFeedback({
        action: result.action,
        employeeName: result.employeeName,
        at: new Date(),
      });
    } catch (error) {
      setPin("");
      toast.error(error instanceof Error ? error.message : t("auth.multiClock.pinError"));
    }
  };

  const appendDigit = (digit: string) => {
    if (multiClockByPin.isPending) return;
    setPin((prev) => {
      if (prev.length >= 4) return prev;
      const next = `${prev}${digit}`;
      if (next.length === 4) {
        void submitPin(next);
      }
      return next;
    });
  };

  const handleInputChange = (value: string) => {
    if (multiClockByPin.isPending) return;
    const next = value.replace(/\D/g, "").slice(0, 4);
    setPin(next);
    if (next.length === 4) {
      void submitPin(next);
    }
  };

  const handleBackspace = () => {
    if (multiClockByPin.isPending) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLogout = async () => {
    try {
      await logoutSession.mutateAsync();
      setAdminSession(null);
      setEmployeeSession(null);
      setLocation("/acceso");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.multiClock.logoutError"));
    }
  };

  const feedbackTitle = useMemo(() => {
    if (!feedback) return null;
    if (feedback.action === "clock_in") {
      return t("auth.multiClock.welcomeMessage", { name: feedback.employeeName });
    }
    return t("auth.multiClock.farewellMessage", { name: feedback.employeeName });
  }, [feedback, t]);

  const feedbackTime = useMemo(() => {
    if (!feedback) return "";
    return feedback.at.toLocaleTimeString(locale === "en" ? "en-US" : "es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }, [feedback, locale]);

  if (!isAdminAuthenticated) return null;

  return (
    <AccessPageShell
      showBackLink={false}
      icon={Keyboard}
      title={t("auth.multiClock.title")}
      subtitle={t("auth.multiClock.subtitle")}
      badge={t("auth.multiClock.badge")}
      maxWidthClass="max-w-lg"
      footer={
        <div className="pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handleLogout}
            disabled={logoutSession.isPending}
          >
            <LogOut className="size-4" />
            {t("auth.multiClock.logout")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {t("auth.multiClock.loggedAs", { name: adminSession?.displayName ?? "admin" })}
        </p>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-900">
            {t("auth.multiClock.pinLabel")}
          </label>
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            value={pin}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder={t("auth.multiClock.pinPlaceholder")}
            className="border-blue-100 bg-blue-50/40 text-center text-xl tracking-[0.5rem] focus-visible:ring-blue-600"
          />
          <p className="mt-2 text-xs text-slate-500">{t("auth.multiClock.pinHint")}</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {DIGITS.slice(0, 9).map((digit) => (
            <Button
              key={digit}
              type="button"
              variant="outline"
              className="h-12 text-lg"
              onClick={() => appendDigit(digit)}
              disabled={multiClockByPin.isPending}
            >
              {digit}
            </Button>
          ))}
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={() => setPin("")}
            disabled={multiClockByPin.isPending}
          >
            {t("common.clear")}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 text-lg"
            onClick={() => appendDigit("0")}
            disabled={multiClockByPin.isPending}
          >
            0
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12"
            onClick={handleBackspace}
            disabled={multiClockByPin.isPending}
          >
            <Delete className="size-4" />
          </Button>
        </div>

        {feedback ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">{feedbackTitle}</p>
            <p className="mt-1 text-sm text-emerald-800">
              {t("auth.multiClock.clockedAt", { time: feedbackTime })}
            </p>
          </div>
        ) : null}

        {multiClockByPin.isPending ? (
          <p className="text-sm text-slate-600">{t("auth.multiClock.processing")}</p>
        ) : null}
      </div>
    </AccessPageShell>
  );
}
