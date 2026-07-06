import { trpc } from "@/lib/trpc";
import { isSessionAuthErrorMessage } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, httpLink, splitLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

function getAuthRedirectPath(): string {
  const path = window.location.pathname;
  if (path.startsWith("/admin")) return "/admin-login";
  if (path.startsWith("/employee")) return "/employee-login";
  if (path.startsWith("/superadmin")) return "/superadmin";
  return "/acceso";
}

function shouldRedirectOnAuthError(): boolean {
  const path = window.location.pathname;
  if (
    path === "/admin-login" ||
    path === "/employee-login" ||
    path === "/acceso" ||
    path === "/" ||
    path === "/superadmin"
  ) {
    return false;
  }

  const sessionQuery = queryClient.getQueryCache().findAll({
    predicate: (query) => JSON.stringify(query.queryKey).includes("getSession"),
  })[0];

  if (!sessionQuery?.state.dataUpdatedAt) return false;

  const session = (sessionQuery.state.data as { session?: unknown } | undefined)?.session;
  return !session;
}

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const code =
    error.data && typeof error.data === "object" && "code" in error.data
      ? String((error.data as { code: unknown }).code)
      : undefined;
  const isUnauthorized =
    code === "UNAUTHORIZED" || isSessionAuthErrorMessage(error.message);

  if (!isUnauthorized) return;
  if (!shouldRedirectOnAuthError()) return;

  window.location.href = getAuthRedirectPath();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    const path =
      error instanceof TRPCClientError
        ? (error as TRPCClientError<any> & { data?: { path?: string } }).data?.path
        : "";
    if (typeof path === "string" && path.includes("pushNotifications")) return;
    console.error("[API Mutation Error]", error);
  }
});

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const trpcUrl = apiBaseUrl ? `${apiBaseUrl}/api/trpc` : "/api/trpc";

const FETCH_TIMEOUT_MS = 30000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return globalThis
    .fetch(input, {
      ...(init ?? {}),
      credentials: "include",
      signal: ctrl.signal,
    })
    .finally(() => clearTimeout(timeout));
}

const trpcClient = trpc.createClient({
  links: [
    splitLink({
      condition: (op) => op.type === "mutation",
      true: httpLink({
        url: trpcUrl,
        transformer: superjson,
        fetch: fetchWithTimeout,
      }),
      false: httpBatchLink({
        url: trpcUrl,
        transformer: superjson,
        fetch(input, init) {
          return globalThis.fetch(input, {
            ...(init ?? {}),
            credentials: "include",
          });
        },
      }),
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

if ("serviceWorker" in navigator && import.meta.env.DEV) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });
}

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(registration => {
        let refreshing = false;
        let updateNotified = false;

        const notifyUpdateAvailable = () => {
          if (updateNotified) return;
          updateNotified = true;
          window.dispatchEvent(new CustomEvent("timeclock-update-available"));
        };

        const activateUpdate = () => {
          if (registration.waiting) {
            notifyUpdateAvailable();
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }
        };

        // If there is already an update waiting, activate it now.
        activateUpdate();

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            // A new service worker is installed and ready to take control.
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdateAvailable();
              activateUpdate();
            }
          });
        });

        // Check for updates periodically so deployed changes arrive automatically.
        setInterval(() => {
          registration.update().catch(() => {
            // ignore background update errors
          });
        }, 60 * 1000);

        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      })
      .catch(error => {
        console.warn("[PWA] Service worker registration failed:", error);
      });
  });
}
