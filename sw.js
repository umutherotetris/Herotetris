/* SÜKÛN Service Worker — build 2026-08-19-r164
   Premium Stability Layer

   • Çekirdek dosyalar install sırasında cache'e alınır.
   • Sadece SÜKÛN cache'leri temizlenir.
   • Navigation istekleri nero.html üzerinden karşılanır.
   • Same-origin GET → stale-while-revalidate.
   • Cross-origin → yalnız Google Fonts cache'lenir.
   • Yeni sürüm notları cache'deki yeni nero.html'den okunur.
*/

'use strict';

const VERSION = '2026-08-19-r164';
const CACHE_NAME = `sukun-${VERSION}`;
const CACHE_PREFIX = 'sukun-';

const CORE = [
  './nero.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];


/* ═══════════════════════════════════════════════
   INSTALL
   Çekirdek dosyalardan biri eksikse yeni sürüm
   yarım kurulmuş kabul edilmez.
   ═══════════════════════════════════════════════ */

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(CORE);
    })()
  );
});


/* ═══════════════════════════════════════════════
   ACTIVATE
   Yalnız SÜKÛN'a ait eski cache'leri temizler.
   ═══════════════════════════════════════════════ */

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {

      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(key =>
            key.startsWith(CACHE_PREFIX) &&
            key !== CACHE_NAME
          )
          .map(key => caches.delete(key))
      );

      await self.clients.claim();

    })()
  );
});


/* ═══════════════════════════════════════════════
   SÜRÜM NOTU
   Yeni nero.html içindeki #surumNotlari JSON'unu
   yeni cache üzerinden okur.
   ═══════════════════════════════════════════════ */

async function surumNotu() {
  try {

    const cache = await caches.open(CACHE_NAME);

    const response =
      await cache.match('./nero.html');

    if (!response) {
      return null;
    }

    const html =
      await response.text();

    const match = html.match(
      /<script[^>]+id=["']surumNotlari["'][^>]*>([\s\S]*?)<\/script>/i
    );

    if (!match) {
      return null;
    }

    const liste =
      JSON.parse(match[1]);

    return {
      v: VERSION,
      notlar:
        Array.isArray(liste)
          ? liste.slice(0, 3)
          : []
    };

  } catch (_) {
    return null;
  }
}


/* ═══════════════════════════════════════════════
   MESSAGE API
   ═══════════════════════════════════════════════ */

self.addEventListener('message', event => {

  const data = event.data;

  if (!data) {
    return;
  }

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  if (data.type === 'SURUM_NOTU') {

    const port =
      event.ports &&
      event.ports[0];

    surumNotu().then(info => {

      try {

        if (port) {
          port.postMessage(info);
        }

      } catch (_) {}

    });

    return;
  }

});


/* ═══════════════════════════════════════════════
   CACHE HELPERS
   ═══════════════════════════════════════════════ */

async function cachePutSafe(
  cache,
  key,
  response
) {

  try {

    if (
      response &&
      (
        response.ok ||
        response.type === 'opaque'
      )
    ) {

      await cache.put(
        key,
        response.clone()
      );

    }

  } catch (_) {}
}


async function staleWhileRevalidate(
  request,
  cacheKey
) {

  const cache =
    await caches.open(CACHE_NAME);

  const key =
    cacheKey || request;

  const cached =
    await cache.match(key);

  const networkPromise =
    fetch(request)
      .then(async response => {

        if (
          response &&
          response.ok
        ) {

          await cachePutSafe(
            cache,
            key,
            response
          );

        }

        return response;

      })
      .catch(() => null);


  /* Cache varsa kullanıcıyı bekletme */
  if (cached) {

    networkPromise.catch(() => {});

    return cached;
  }


  /* Cache yoksa network cevabını bekle */
  const fresh =
    await networkPromise;

  if (fresh) {
    return fresh;
  }


  return new Response(
    'Çevrimdışı',
    {
      status: 503,
      headers: {
        'Content-Type':
          'text/plain; charset=utf-8'
      }
    }
  );
}


/* ═══════════════════════════════════════════════
   NAVIGATION
   Route cevabı nero.html cache anahtarının
   üzerine yazılmaz.

   Cache'deki nero.html anında döner;
   gerçek nero.html arkada güncellenir.
   ═══════════════════════════════════════════════ */

async function handleNavigation() {

  const cache =
    await caches.open(CACHE_NAME);

  const cached =
    await cache.match('./nero.html');

  const refresh =
    fetch('./nero.html', {
      cache: 'no-cache'
    })
      .then(async response => {

        if (
          response &&
          response.ok
        ) {

          await cachePutSafe(
            cache,
            './nero.html',
            response
          );

        }

        return response;

      })
      .catch(() => null);


  if (cached) {

    refresh.catch(() => {});

    return cached;
  }


  const fresh =
    await refresh;

  if (fresh) {
    return fresh;
  }


  return new Response(
    'SÜKÛN çevrimdışı ve uygulama çekirdeği önbellekte bulunamadı.',
    {
      status: 503,
      headers: {
        'Content-Type':
          'text/plain; charset=utf-8'
      }
    }
  );
}


/* ═══════════════════════════════════════════════
   GOOGLE FONTS
   Harici tüm GET'leri cache'lemek yerine
   yalnız Google Fonts kaynaklarına müdahale edilir.
   ═══════════════════════════════════════════════ */

function isGoogleFontRequest(url) {

  return (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  );

}


async function googleFontStrategy(request) {

  const cache =
    await caches.open(CACHE_NAME);

  try {

    const response =
      await fetch(request);

    await cachePutSafe(
      cache,
      request,
      response
    );

    return response;

  } catch (_) {

    const cached =
      await cache.match(request);

    return (
      cached ||
      Response.error()
    );
  }
}


/* ═══════════════════════════════════════════════
   FETCH ROUTER
   ═══════════════════════════════════════════════ */

self.addEventListener('fetch', event => {

  const request =
    event.request;

  if (
    !request ||
    request.method !== 'GET'
  ) {
    return;
  }

  const url =
    new URL(request.url);


  /* NAVIGATION */
  if (request.mode === 'navigate') {

    event.respondWith(
      handleNavigation()
    );

    return;
  }


  /* SAME ORIGIN */
  if (
    url.origin ===
    self.location.origin
  ) {

    event.respondWith(
      staleWhileRevalidate(
        request
      )
    );

    return;
  }


  /* GOOGLE FONTS */
  if (
    isGoogleFontRequest(url)
  ) {

    event.respondWith(
      googleFontStrategy(
        request
      )
    );

    return;
  }


  /* Diğer cross-origin isteklerde
     Service Worker müdahale etmez. */

});


/* ═══════════════════════════════════════════════
   OPSİYONEL CACHE TEMİZLİĞİ
   Şimdilik otomatik çalıştırılmaz.
   ═══════════════════════════════════════════════ */

async function trimCache(
  cacheName,
  maxItems = 80
) {

  try {

    const cache =
      await caches.open(cacheName);

    const keys =
      await cache.keys();

    if (
      keys.length <= maxItems
    ) {
      return;
    }

    const removeCount =
      keys.length - maxItems;

    for (
      let i = 0;
      i < removeCount;
      i++
    ) {

      await cache.delete(
        keys[i]
      );

    }

  } catch (_) {}
}
