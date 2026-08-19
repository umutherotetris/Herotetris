/* SÜKÛN Service Worker — build 2026-08-19-r151
   Strateji:
   • Çekirdek (nero.html + manifest): install'da önbelleğe alınır → tam çevrimdışı açılış.
   • Gezinti istekleri: önbellek-öncelikli → arka planda ağdan tazele.
   • Aynı-origin GET: stale-while-revalidate.
   • Çapraz-origin: ağ → önbellek yedeği.
   • Yeni sürüm: sayfaya bildirilir; SKIP_WAITING ile devralır.
*/

'use strict';

const V = 'sukun-2026-08-19-r151';

const CORE = [
  './nero.html',
  './manifest.webmanifest'
];

/* ═══════════════════════════════════════════════
   INSTALL
   Çekirdek dosyalardan biri indirilemezse
   yeni Service Worker kurulumu başarısız olur.
   Böylece eski cache yanlışlıkla silinmez.
   ═══════════════════════════════════════════════ */

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(V).then(cache => {
      return cache.addAll(CORE);
    })
  );
});


/* ═══════════════════════════════════════════════
   ACTIVATE
   Eski cache sürümlerini temizle.
   ═══════════════════════════════════════════════ */

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => {
        return Promise.all(
          keys
            .filter(key => key !== V)
            .map(key => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});


/* ═══════════════════════════════════════════════
   SÜRÜM NOTU
   Yeni nero.html içindeki #surumNotlari verisini
   yeni cache üzerinden okur.
   ═══════════════════════════════════════════════ */

async function surumNotu() {
  try {
    const cache = await caches.open(V);

    const response = await cache.match('./nero.html');

    if (!response) {
      return null;
    }

    const text = await response.text();

    const match = text.match(
      /<script[^>]+id="surumNotlari"[^>]*>([\s\S]*?)<\/script>/
    );

    if (!match) {
      return null;
    }

    const liste = JSON.parse(match[1]);

    return {
      v: V.replace(/^sukun-/, ''),
      notlar: Array.isArray(liste)
        ? liste.slice(0, 3)
        : []
    };

  } catch (error) {
    return null;
  }
}


/* ═══════════════════════════════════════════════
   MESSAGE
   ═══════════════════════════════════════════════ */

self.addEventListener('message', event => {

  if (!event.data) {
    return;
  }

  /* Yeni SW hemen aktif olsun */
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  /* Yeni sürüm notlarını gönder */
  if (event.data.type === 'SURUM_NOTU') {

    const port =
      event.ports &&
      event.ports[0];

    surumNotu().then(data => {

      try {

        if (port) {
          port.postMessage(data);
        }

      } catch (error) {
        /* Port kapanmış olabilir */
      }

    });

  }

});


/* ═══════════════════════════════════════════════
   STALE-WHILE-REVALIDATE

   1. Cache varsa hemen döndür.
   2. Aynı anda ağdan güncel sürümü çek.
   3. Ağ cevabı başarılıysa cache'i güncelle.
   4. Cache + ağ yoksa 503 döndür.
   ═══════════════════════════════════════════════ */

async function staleWhileRevalidate(
  request,
  cacheKeyRequest
) {

  const cache = await caches.open(V);

  const cacheKey =
    cacheKeyRequest || request;

  const cached =
    await cache.match(cacheKey);

  const fresh =
    fetch(request)
      .then(response => {

        if (response && response.ok) {

          cache
            .put(
              cacheKey,
              response.clone()
            )
            .catch(() => {});

        }

        return response;

      })
      .catch(() => null);

  /* Cache varsa kullanıcıyı bekletme */
  if (cached) {
    return cached;
  }

  /* Cache yoksa ağ cevabını bekle */
  const networkResponse =
    await fresh;

  if (networkResponse) {
    return networkResponse;
  }

  /* Hiçbir kaynak yok */
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
   FETCH
   ═══════════════════════════════════════════════ */

self.addEventListener('fetch', event => {

  const request =
    event.request;

  /* Sadece GET */
  if (request.method !== 'GET') {
    return;
  }

  const url =
    new URL(request.url);


  /* ═══════════════════════════════════════════
     SAYFA GEZİNTİLERİ
     Her navigation isteğini nero.html'e bağla.
     Offline durumda da uygulama açılabilsin.
     ═══════════════════════════════════════════ */

  if (request.mode === 'navigate') {

    event.respondWith(
      staleWhileRevalidate(
        request,
        './nero.html'
      )
    );

    return;
  }


  /* ═══════════════════════════════════════════
     AYNI ORIGIN
     Cache-first + network refresh
     ═══════════════════════════════════════════ */

  if (url.origin === self.location.origin) {

    event.respondWith(
      staleWhileRevalidate(request)
    );

    return;
  }


  /* ═══════════════════════════════════════════
     ÇAPRAZ ORIGIN
     Google Fonts vb.

     Önce ağ.
     Ağ başarısızsa cache.
     ═══════════════════════════════════════════ */

  event.respondWith(

    (async () => {

      const cache =
        await caches.open(V);

      try {

        const response =
          await fetch(request);

        if (
          response &&
          (
            response.ok ||
            response.type === 'opaque'
          )
        ) {

          cache
            .put(
              request,
              response.clone()
            )
            .catch(() => {});

        }

        return response;

      } catch (error) {

        const cached =
          await cache.match(request);

        return (
          cached ||
          Response.error()
        );
      }

    })()

  );

});
