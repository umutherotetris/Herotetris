/* SÜKÛN Service Worker — build 2026-07-29
   Strateji:
   • Çekirdek (nero.html + manifest): install'da önbelleğe alınır → tam çevrimdışı açılış.
   • Gezinti istekleri: önbellek-öncelikli (anında açılış), arka planda ağdan tazele (yeni sürüm yakala).
   • Aynı-origin GET: stale-while-revalidate. Çapraz-origin (Google Fonts gövde yazıları): ağ → önbellek yedeği.
   • Yeni sürüm: yüklendiğinde sayfaya haber verilir; sayfa "Yenile" der, SKIP_WAITING ile devralır. */
'use strict';
const V = 'sukun-2026-07-29';
const CORE = ['./nero.html', './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(V).then(c =>
      Promise.allSettled(CORE.map(u => c.add(u)))   /* biri düşse de diğerleri alınsın */
    )
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(req, cacheKeyReq) {
  const c = await caches.open(V);
  const key = cacheKeyReq || req;
  const cached = await c.match(key);
  const fresh = fetch(req).then(res => {
    if (res && res.ok) c.put(key, res.clone()).catch(()=>{});
    return res;
  }).catch(() => null);
  return cached || (await fresh) || new Response('Çevrimdışı', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Gezinti → tek sayfa çekirdeğinden karşıla (çevrimdışı dahil) */
  if (req.mode === 'navigate') {
    e.respondWith(staleWhileRevalidate(req, './nero.html'));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  /* Çapraz-origin (fonts.googleapis / gstatic): ağ öncelikli, düşerse önbellek */
  e.respondWith(
    (async () => {
      const c = await caches.open(V);
      try {
        const res = await fetch(req);
        if (res && (res.ok || res.type === 'opaque')) c.put(req, res.clone()).catch(()=>{});
        return res;
      } catch (_) {
        const hit = await c.match(req);
        return hit || Response.error();
      }
    })()
  );
});
