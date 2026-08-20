/* SÜKÛN r174 — küçük, aynı-kaynaklı uygulama kabuğu önbelleği */
'use strict';

const SURUM = 'r174';
const CACHE = 'sukun-' + SURUM + '-20260820';

const KABUK = [
  './nero.html',
  './manifest.webmanifest',
  './sukun-icon.svg',
  './sukun-icon-192.png',
  './sukun-icon-512.png'
];

const NOTLAR = [
  'Berhetiyye yazımı Menbaʿ Uṣûli’l-Hikme’nin 1951 matbu şerhiyle satır satır karşılaştırıldı.',
  '28 ismin ebcedi kaynak yazımından yeniden hesaplandı; toplam 18.787 olarak doğrulandı.',
  'Şemsü’l-Maârif ve Menbaʿın Bûnî’ye aidiyeti kesin eser adı yerine tartışmalı nispet olarak gösteriliyor.',
  'Kaynak metni, varyant okunuş, mekanik ebced ve Nero tefekkür yorumu ayrı katmanlara ayrıldı.',
  'Letâif ve erbaîn açıklamalarındaki kaynak kesinliği ile tarikatlara göre değişen yorum sınırı düzeltildi.'
];

/* ---------------------------------------------------------
 * INSTALL
 * Uygulama kabuğunu önbelleğe alır.
 * --------------------------------------------------------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(cache => cache.addAll(KABUK))
      .then(() => self.skipWaiting())
  );
});

/* ---------------------------------------------------------
 * ACTIVATE
 * Eski SÜKÛN önbelleklerini temizler ve yeni SW'yi
 * açık sekmeler için hemen devreye alır.
 * --------------------------------------------------------- */
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

/* ---------------------------------------------------------
 * NETWORK FIRST
 * Sayfa gezinmelerinde önce ağı dener.
 * Ağ yoksa önbelleğe, ardından nero.html'e döner.
 * --------------------------------------------------------- */
async function agOncelikli(request) {
  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE);

      cache.put(request, response.clone()).catch(() => {
        // Önbelleğe yazma hatası uygulamayı durdurmasın.
      });
    }

    return response;
  } catch (_) {
    const cachedPage = await caches.match(request, {
      ignoreSearch: true
    });

    if (cachedPage) {
      return cachedPage;
    }

    const fallback = await caches.match('./nero.html', {
      ignoreSearch: true
    });

    if (fallback) {
      return fallback;
    }

    return Response.error();
  }
}

/* ---------------------------------------------------------
 * CACHE FIRST
 * Statik dosyalarda önce önbelleği kullanır.
 * Dosya yoksa ağdan getirip önbelleğe ekler.
 * --------------------------------------------------------- */
async function onbellekOncelikli(request) {
  const cached = await caches.match(request, {
    ignoreSearch: true
  });

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (response && response.ok) {
      const cache = await caches.open(CACHE);

      cache.put(request, response.clone()).catch(() => {
        // Önbelleğe yazma hatası uygulamayı durdurmasın.
      });
    }

    return response;
  } catch (_) {
    return Response.error();
  }
}

/* ---------------------------------------------------------
 * FETCH
 * Sadece GET ve aynı origin isteklerini ele alır.
 * Navigasyonlarda network-first,
 * diğer statik kaynaklarda cache-first kullanılır.
 * --------------------------------------------------------- */
self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(agOncelikli(request));
    return;
  }

  event.respondWith(onbellekOncelikli(request));
});

/* ---------------------------------------------------------
 * MESSAGE
 * Sayfadan gelen Service Worker komutlarını işler.
 * --------------------------------------------------------- */
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
