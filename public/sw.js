const CACHE = 'connor-v14';

self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || 'Connor Tracker';
  const options = {
    body: data.body || "Time to train.",
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/' },
    actions: data.actions || [],
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = e.notification.data?.url || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      const existing = wins.find(w => w.url.includes(self.location.origin));
      if (existing) { existing.focus(); existing.navigate(url); }
      else clients.openWindow(url);
    })
  );
});
