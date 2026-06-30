import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "timeclock-pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);
    if (ios) {
      setVisible(true);
      return;
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setVisible(false);
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-40 md:left-auto md:right-4 md:max-w-sm">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">Instalar TimeClock</p>
            <p className="text-sm text-slate-600 mt-1">
              {isIos
                ? "En Safari: Compartir → Añadir a pantalla de inicio."
                : "Añade TimeClock a tu móvil como app para fichar más rápido."}
            </p>
          </div>
          <button type="button" onClick={dismiss} className="text-slate-400 hover:text-slate-600">
            <X className="size-4" />
          </button>
        </div>
        {!isIos ? (
          <Button type="button" className="w-full mt-3" onClick={() => void install()}>
            <Download className="size-4 mr-2" />
            Instalar app
          </Button>
        ) : null}
      </div>
    </div>
  );
}
