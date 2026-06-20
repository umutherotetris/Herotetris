/* ═══════════════════════════════════════════════════════════════
   Hero Oyun Portalı — Service Worker (PWA)
   Önbellek + Push bildirim desteği
   ═══════════════════════════════════════════════════════════════ */
const CACHE_NAME = 'hero-portal-v97';
const CORE_ASSETS = [
  './index.html',
  './manifest.json',
];

// ── Kurulum ──
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(CORE_ASSETS).catch(() => {}))
  );
});

// ── Aktifleştirme — eski cache temizle ──
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ──
// JS/CSS modülleri → DAİMA ağdan (cache'lenmez), böylece güncel kod hemen gelir.
// Sadece HTML/manifest → network-first + cache fallback (offline çalışsın diye).
self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Firebase, CDN, API istekleri → her zaman ağdan, dokunma
  if (url.includes('firebase') || url.includes('gstatic') ||
      url.includes('googleapis') || url.includes('unpkg') ||
      url.includes('peerjs') || e.request.method !== 'GET') {
    return; // varsayılan tarayıcı davranışı
  }

  // JS / CSS / JSON / harita dosyaları → network-only (cache'leme!)
  // Bu, "eski cache'lenmiş kod" sorununu kökten önler.
  if (/\.(js|mjs|css|json|map)(\?|$)/i.test(url)) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // Geri kalan (HTML, ikon, font vb.) → network-first + cache fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ── Push bildirimi al (sunucudan gelirse) ──
self.addEventListener('push', (e) => {
  let data = { title: 'Hero Portal', body: 'Yeni bir bildirim!', icon: '🔔' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch (err) {
    if (e.data) data.body = e.data.text();
  }
  const options = {
    body: data.body,
    icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='42' fill='%230a0e1a'/%3E%3Ctext x='96' y='130' font-size='110' text-anchor='middle'%3E%F0%9F%8E%AE%3C/text%3E%3C/svg%3E",
    badge: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'%3E%3Ctext x='48' y='70' font-size='70' text-anchor='middle'%3E%F0%9F%8E%AE%3C/text%3E%3C/svg%3E",
    tag: data.tag || 'hero-notif',
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: data.url || './index.html' },
  };
  e.waitUntil(self.registration.showNotification(data.title, options));
});

// ── Bildirime tıklanınca uygulamayı aç/öne getir ──
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const targetUrl = (e.notification.data && e.notification.data.url) || './index.html';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(wins => {
      for (const w of wins) {
        if ('focus' in w) return w.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

// ── Sayfadan mesaj al (yerel bildirim tetikle) ──
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, url } = e.data.payload || {};
    self.registration.showNotification(title || 'Hero Portal', {
      body: body || '',
      icon: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'%3E%3Crect width='192' height='192' rx='42' fill='%230a0e1a'/%3E%3Ctext x='96' y='130' font-size='110' text-anchor='middle'%3E%F0%9F%8E%AE%3C/text%3E%3C/svg%3E",
      tag: tag || 'hero-local',
      renotify: true,
      vibrate: [80, 40, 80],
      data: { url: url || './index.html' },
    });
  }
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
