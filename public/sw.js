// Forge service worker. It only shows notifications and focuses the app when one is tapped.
// It caches nothing, so a new build is never hidden behind an old one. On activation it also
// deletes any caches left behind by an earlier service worker (for example a workbox precache),
// so an installed app cannot keep serving an old copy of Forge.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) return c.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});
