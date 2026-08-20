/* SÜKÛN r170 — küçük, aynı-kaynaklı uygulama kabuğu önbelleği */
'use strict';

const SURUM = 'r170';
const CACHE = 'sukun-' + SURUM + '-20260820';

const KABUK = [
  './nero.html',
  './manifest.webmanifest',
  './sukun-icon.svg',
  './sukun-icon-192.png',
  './sukun-icon-512.png'
];

const NOTLAR = [
  'Yedek izin listesi ve ses veri doğrulaması tamamlandı.',
  'Özel ambiyans kayıtlarının tam yedek aktarımı düzeltildi.',
  'Dashboard, erişilebilirlik ve içerik tutarlılığı iyileştirildi.'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(KABUK))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key.startsWith('sukun-') && key !== CACHE)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

async function agOncelikli(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (_) {
    return (
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match('./nero.html', { ignoreSearch: true })) ||
      Response.error()
    );
  }
}

async function onbellekOncelikli(request) {
  const cached = await caches.match(request, {
    ignoreSearch: true
  });

  if (cached) return cached;

  const response = await fetch(request);

  if (response && response.ok) {
    const cache = await caches.open(CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }

  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    request.mode === 'navigate'
      ? agOncelikli(request)
      : onbellekOncelikli(request)
  );
});

self.addEventListener('message', event => {
  const veri = event.data || {};

  if (veri.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (veri.type === 'SURUM_NOTU') {
    const port = event.ports && event.ports[0];

    if (port) {
      port.postMessage({
        v: SURUM,
        notlar: NOTLAR
      });
    }
  }
});
