/* SÜKÛN r409 — dayanıklı aynı-kaynak PWA kabuğu */
'use strict';

const SURUM = 'r409';
const CACHE = 'sukun-r409-20260821a';

const KABUK = [
  './nero.html',
  './manifest.webmanifest',
  './sukun-icon.svg',
  './icon-192.png',
  './icon-512.png'
];

const NOTLAR = [
  'Ambiyans kartlarına detay ve kullanım ipucu paneli eklendi; benzer seslerin farkları özellikle Şelale, yağmur, dalga, gece ve gürültü renklerinde açıklanıyor.',
  'Tefekkür kontrolü uzun floating bardan çıkarıldı; çalarken mini player içine, boşta küçük kompakt kapsüle taşındı ve eski collision konumlandırması devre dışı bırakıldı.',
  'Tefekkürden Çık düğmesi floating katmandan çıkarılıp zikir çemberinin altındaki sayaç akışına taşındı; sayaç eylemleriyle üst üste binme giderildi.',
  'Mini oynatıcı ana başlığı sabitlendi; beat, taşıyıcı, bant, motor ve ambiyans ayrıntıları tek satırlık Çalan Detayları akışına taşındı.',
  'Akıllı Seans zikir kaynak doğrulaması düzeltildi; Korunma Okumaları Felâk, Nâs, İhlâs ve Kalem kaynaklarını yeniden doğru çözüyor.',
  'Üst SÜKÛN marka başlığı ve sakin altın animasyonu geri getirildi; r194 shimmer görünürlük çakışması düzeltildi.',
  'Tefekkür modunda Çık düğmesi yatay alt aksiyona taşındı; Berhetiyye isimleri tek satıra sabitlendi.',
  'Kendi Sesin kartındaki çift mikrofon ikonu tekilleştirildi; Now Playing başlık kararlılığı da korundu.',
  'Ortak Seçim modeli eklendi: Zikir, Berhetiyye, Frekans ve AI seanslarında seçili öğe tek state üzerinden Seç-Hedef/Süre/Ses-Akışa ekle/Başlat davranışına bağlandı.',
  'Berhetiyye, Frekans ve AI seansları seç-ayarla-başlat-kontrol et-bitir ortak davranış diline bağlandı; playback düğme metinleri merkezi duruma göre eşitleniyor.',
  'UX akış katmanı eklendi: Seans Merkezi kuyruk durumuna göre eylemleri etkinleştiriyor, modal kapatma ve seçili öğeyi görünür tutma davranışları standartlaştırıldı.',
  'UI/UX denetiminde sabit alt katmanlar, mini player, zikir nav, Tefekkür, toast, adaptif ve sonuç pencereleri mobil safe-area sözleşmesine bağlandı.',
  'Adaptif Seans ve Seans Sonucu yüzen düğmeleri kaldırılıp Düzen sekmesindeki bütünleşik Seans Merkezine taşındı.',
  'Seans Sonu Değerlendirme ve sonuç hafızası eklendi; yeni AI seansları yalnız müdahalelerden değil hangi reçetelerin iyi veya zorlayıcı sonuçlandığından da öğreniyor.',
  'Adaptif Hafıza geçmiş geri bildirimlerden saat, seans aşaması ve frekans örüntülerini çıkarıp yeni AI seanslarını başlamadan kontrollü biçimde kişiselleştiriyor.',
  'Adaptif Seans Motoru kullanıcı geri bildirimine göre aktif adımı koruyup kalan Global Queueyu güvenli sınırlar içinde yeniden düzenleyebiliyor.',
  'AI Reçete 5–10 adımlı nefes, frekans, zikir, sükût ve ambiyans seanslarını doğrulayıp Global Queueya aktarabiliyor.',
  'AI Reçete çıktısı yerel SÜKÛN envanterine doğrulanan yapılandırılmış plana ve Global Queue aktarımına dönüştürüldü.',
  'AI Rehberi Groq, OpenRouter, Gemini ve Anthropic arasında otomatik fallback ve circuit breaker kullanan çoklu sağlayıcı mimarisine geçirildi.',
  'Berhetiyye gizlilik politikası favoriler, kayıtlı seanslar, ses kütüphanesi, stüdyo, istatistik, yedek/geri yükleme ve Now Playing katmanlarına genişletildi.',
  'Berhetiyye Global Queue erişimi mevcut şifre kilidine bağlandı; kilitliyken gizli öğe görünmez, eklenmez ve restore edilmez.',
  'Kalıcı Global Queue zikir, sükût, frekans ve ayrı okuyucuları tek motorlar-arası sırada çalıştırıyor.',
  'Global Queue kuyruk ve kaldığı öğeyi cihazda saklıyor; yarım kalan akış sürdürülebiliyor.',
  'Felâk → Nâs → 2 dk sükût → 6 Hz → Berhetiyye 1–7 → Salavât örnek şablonu eklendi.',
  'Global Now Playing Store aktif modül, bölüm, kaynak, tekrar, ilerleme ve kalan süreyi tek state içinde yayınlıyor.',
  'Mini oynatıcı ve MediaSession aynı Now Playing state’inden besleniyor.',
  'Destekleyen kilit ekranlarında MediaSession position state ile gerçek veya tahmini konum yayınlanıyor.',
  'Tüm okuyucular sukun:nowplayingchange olayına ve PlaybackController.subscribe API’sine bağlanabiliyor.',
  'Duraklatılan bütün gerçek oynatıcı kontrolleri aynı düğmede Devam Ettir durumuna geçiyor.',
  'Akıllı Seans ana Başlat düğmesi oynarken Duraklat, duraklatılmışken Devam Ettir olarak çalışıyor.',
  'Okuyucular, Hatim, Letâif, Hizbü’l-Vikâye, Fâtiha ve Berhetiyye Seyri ortak pause/resume diline bağlandı.',
  'Mini oynatıcı ve Şimdi Çalıyor ikonlarının erişilebilir adları oynatma durumuyla eşitleniyor.',
  'Gerçek stop eylemleri Duraklat etiketinden ayrıldı; Ses Halkası Bitir olarak gösteriliyor.',
  'Akıllı Seans için dokunulabilir süre-oranlı zaman çizelgesi eklendi.',
  'Her adım için bağımsız ses seviyesi kayıt, TTS ve frekans motoruna uygulanıyor.',
  'Adım sonu otomatik geç veya burada bekle davranışı seçilebilir.',
  'Zikirlerde sabit, süreli ve kullanıcı Sonraki diyene kadar koşullu tekrar destekleniyor.',
  'Kayıtlı seanslar favori şablon olarak yıldızlanıp tek dokunuşla yüklenebilir.',
  'r252 düzenleme, doğrulama, geri al ve hata kurtarma sistemi korunuyor.'
];

async function kabuguHazirla() {
  const cache = await caches.open(CACHE);

  /*
   * Tek bir eksik opsiyonel ikon
   * bütün Service Worker kurulumunu düşürmesin.
   */
  await Promise.allSettled(
    KABUK.map(async yol => {
      const req = new Request(yol, {
        cache: 'reload'
      });

      const res = await fetch(req);

      if (res && res.ok) {
        await cache.put(req, res.clone());
      }
    })
  );
}


/* ─────────────────────────────────────
   INSTALL
───────────────────────────────────── */

self.addEventListener('install', event => {
  event.waitUntil(
    kabuguHazirla()
      .then(() => self.skipWaiting())
  );
});


/* ─────────────────────────────────────
   ACTIVATE
───────────────────────────────────── */

self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(
              key =>
                key.startsWith('sukun-') &&
                key !== CACHE
            )
            .map(key => caches.delete(key))
        )
      ),

      self.clients.claim()
    ])
  );
});


/* ─────────────────────────────────────
   NETWORK FIRST
   Sayfa navigasyonları
───────────────────────────────────── */

async function agOncelikli(request) {
  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type !== 'opaque'
    ) {
      const cache = await caches.open(CACHE);

      cache
        .put(request, response.clone())
        .catch(() => {});
    }

    return response;

  } catch (_) {

    return (
      await caches.match(
        request,
        { ignoreSearch: true }
      )
    ) || (
      await caches.match(
        './nero.html',
        { ignoreSearch: true }
      )
    ) || Response.error();
  }
}


/* ─────────────────────────────────────
   CACHE FIRST
   Statik uygulama kaynakları
───────────────────────────────────── */

async function onbellekOncelikli(request) {
  const cached = await caches.match(
    request,
    { ignoreSearch: true }
  );

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);

    if (
      response &&
      response.ok &&
      response.type !== 'opaque'
    ) {
      const cache = await caches.open(CACHE);

      cache
        .put(request, response.clone())
        .catch(() => {});
    }

    return response;

  } catch (_) {

    return Response.error();
  }
}


/* ─────────────────────────────────────
   FETCH
───────────────────────────────────── */

self.addEventListener('fetch', event => {
  const request = event.request;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    request.mode === 'navigate'
      ? agOncelikli(request)
      : onbellekOncelikli(request)
  );
});


/* ─────────────────────────────────────
   MESSAGE API
───────────────────────────────────── */

self.addEventListener('message', event => {
  const veri = event.data || {};


  if (veri.type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }


  if (veri.type === 'SURUM_NOTU') {
    const port =
      event.ports &&
      event.ports[0];

    if (port) {
      port.postMessage({
        v: SURUM,
        notlar: NOTLAR
      });
    }
  }


  if (veri.type === 'CACHE_REFRESH') {
    const port =
      event.ports &&
      event.ports[0];

    event.waitUntil(
      kabuguHazirla()
        .then(() => {
          try {
            if (port) {
              port.postMessage({
                ok: true,
                v: SURUM
              });
            }
          } catch (_) {}
        })
    );
  }
});
