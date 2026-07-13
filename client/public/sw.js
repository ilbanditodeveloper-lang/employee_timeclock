const CACHE_NAME = "timeclock-v6";
const PRECACHE_URLS = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];

function offlineResponse() {
  return new Response("Sin conexión", {
    status: 503,
    statusText: "Service Unavailable",
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function cachedNavigationFallback(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const fallback = await caches.match("/index.html");
  return fallback ?? offlineResponse();
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Let the browser handle cross-origin requests (e.g. external APIs).
  if (url.origin !== self.location.origin) return;

  // Never cache API, tRPC, health or auth-related routes.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/api/trpc") ||
    url.pathname === "/healthz"
  ) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Navigation requests: network-first so new deploys are picked up immediately.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
          }
          return response;
        })
        .catch(() => cachedNavigationFallback(event.request))
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => {
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
            }
            return response;
          })
          .catch(() => cachedResponse ?? offlineResponse());

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }

});

// Push notification event listener
self.addEventListener("push", event => {
  const data = event.data?.json() || {};
  const title = data.title || "TimeClock";
  const options = {
    body: data.body || "Tienes una notificación",
    icon: "/icon.svg",
    badge: "/icon.svg",
    tag: data.tag || "timeclock-notification",
    requireInteraction: false,
    data: data.data || {},
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click event listener
self.addEventListener("notificationclick", event => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientList => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        const url = event.notification.data?.url || "/";
        return clients.openWindow(url);
      }
    })
  );
});
