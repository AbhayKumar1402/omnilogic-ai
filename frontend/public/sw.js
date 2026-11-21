self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Pass-through fetch handler required by Chrome to enable native 1-click install prompt
  if (event.request.method !== "GET") return;
});
