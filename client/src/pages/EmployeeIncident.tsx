import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuthContext, useRequireEmployeeAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { employeeQueryInput } from "@/lib/authApi";
import EmployeeShellLayout from "@/components/EmployeeShellLayout";

export default function EmployeeIncident() {
  const { t } = useLocale();
  const [, setLocation] = useLocation();
  const [incidentType, setIncidentType] = useState("delay");
  const [incidentDate, setIncidentDate] = useState("");
  const [incidentTime, setIncidentTime] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const createIncident = trpc.publicApi.createIncident.useMutation();
  const clockIn = trpc.publicApi.clockIn.useMutation();
  const { employeeSession } = useAuthContext();
  const { isAuthLoading, isEmployeeAuthenticated } = useRequireEmployeeAuth();

  useEffect(() => {
    const now = new Date();
    setIncidentDate(now.toISOString().slice(0, 10));
    setIncidentTime(now.toTimeString().slice(0, 5));
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!description.trim()) {
      toast.error(t("employee.incident.toasts.descriptionRequired"));
      return;
    }
    if (!employeeSession) {
      toast.error(t("employee.incident.toasts.signInRequired"));
      setLocation("/employee-login");
      return;
    }

    setSubmitting(true);
    try {
      const employeeId = employeeSession.employeeId;
      const now = new Date();
      await createIncident.mutateAsync({
        ...employeeQueryInput(employeeId),
        type: incidentType === "delay" ? "late_arrival" : "other",
        reason: description.trim(),
      });

      if (incidentType === "delay" && employeeSession.locationEnabled) {
        const clockInDate = now;
        if (!navigator.geolocation) {
          toast.error(t("employee.incident.toasts.geoUnavailable"));
        } else {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject);
          });
          await clockIn.mutateAsync({
            ...employeeQueryInput(employeeId),
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        }
      } else if (incidentType === "delay") {
        await clockIn.mutateAsync(employeeQueryInput(employeeId));
      }

      toast.success(
        incidentType === "delay"
          ? t("employee.incident.toasts.delayWithClockIn")
          : t("employee.incident.toasts.success")
      );
      setIncidentType("delay");
      setIncidentDate("");
      setIncidentTime("");
      setDescription("");
      setLocation("/employee");
    } catch {
      toast.error(t("employee.incident.toasts.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  if (isAuthLoading || !isEmployeeAuthenticated) {
    return null;
  }

  return (
    <EmployeeShellLayout
      pageTitle={t("employee.incident.pageTitle")}
      pageSubtitle={t("employee.incident.pageSubtitle")}
      contentClassName="container mx-auto max-w-2xl px-4 py-8 pb-28 md:pb-8"
    >
        <Card className="app-shell-card mx-auto max-w-2xl border-0 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("employee.incident.type")}
              </label>
              <select
                value={incidentType}
                onChange={(event) => setIncidentType(event.target.value)}
                className="input-elegant"
              >
                <option value="delay">{t("employee.incident.types.delay")}</option>
                <option value="absence">{t("employee.incident.types.absence")}</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("employee.incident.date")}
                </label>
                <input
                  type="date"
                  value={incidentDate}
                  readOnly
                  className="input-elegant"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  {t("employee.incident.time")}
                </label>
                <input
                  type="time"
                  value={incidentTime}
                  readOnly
                  className="input-elegant"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                {t("employee.incident.description")}
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="input-elegant min-h-[120px]"
                placeholder={t("employee.incident.descriptionPlaceholder")}
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-800"
              disabled={submitting}
            >
              {submitting ? t("employee.incident.submitting") : t("employee.incident.submit")}
            </Button>
          </form>
        </Card>
    </EmployeeShellLayout>
  );
}
