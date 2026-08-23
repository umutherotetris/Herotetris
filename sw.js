/* SÜKÛN r486 — dayanıklı aynı-kaynak PWA kabuğu */
'use strict';

const SURUM = 'r486';
const CACHE = 'sukun-r486-20260823a';

const KABUK = [
  './nero.html',
  './manifest.webmanifest',
  './sukun-icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

const NOTLAR = [
  'r486 Toggle cascade: legacy yüksek-specificity switch kuralları component authority ile geçersiz; knob ray içinde tam merkezli.',
  'r485 Berhetiyye niyet-gate: niyet sayaç değildir; niyet bitince 1 sayı=1 ses. Toggle/slider/info tek component sistemine alındı.',
  'r482 Esmâ geçişi transactional: mevcut isim son kez okunmadan sayaç sıfırlanmaz ve sonraki Esmâ’ya geçilmez; ses atlama giderildi.',
  'r481 Kilit ekranı pitch düzeltmesi: kendi kayıt preservesPitch native hız; TTS normal utterance kuyruğu, cüce/ince ses regresyonu giderildi.',
  'r480 Hızlı tempo sesli zikir: 1 sayaç = 1 tamamlanan kayıt/TTS; 0.8 sn’de ses bitmeden sayı ilerlemez ve catch-up yapılmaz.',
  'r479 Okuyucular üst üste binebiliyordu: yedi modülün "çalıyor mu" yoklaması window üzerinden bakıyordu ama bu modüller window\'a atanmıyor — yoklama kalıcı false dönüyordu, yeni okuyucu başlarken öncekini durduran yedek yol hiç devreye girmiyordu.',
  'r479 Berhetiyye 28 İsim Seyri oynatma kontratına hiç kaydolmuyordu; artık merkezi durdurma, global duraklat ve Şimdi Çalıyor akışına dahil.',
  'r479 Sağlık denetimi çalan modül için yanlış "provider state bayat" uyarısı üretip onarım rutinini sağlıklı oturuma müdahale ettiriyordu.',
  'r479 Boşta duran ekranda saniyede binlerce gereksiz DOM yazımı vardı; 11 koşulsuz yazım idempotent yapıldı (6 saniyede 11.057 → 3.454 mutasyon).',
  'r479 Ambiyans anahtarları 44x24\'e çıkarıldı (dokunma hedefi asgarisi); satır yüksekliği aynı kaldı, anahtar düğmesi orantılandı.',
  'r479 Oynatıcı tutamağının ekran okuyucu adı yoktu; eklendi.',
  'r479 Uygulama ikonları (icon-192, icon-512, sukun-icon.svg) depoda yoktu ve manifest üçünü de işaret ettiği için hepsi 404 dönüyordu — Android yükleme istemi bu yüzden çalışmıyordu. İkonlar vektörden yeniden üretildi, ayrıca adaptif maske için güvenli alanlı maskable sürüm eklendi.',
  'r478 Universal bar: CANLI küçültüldü; mini/midi görünümde sayım, kalan ve Esmâ/Berhetiyye sıra bilgisi gösteriliyor.',
  'r477 Tek dokunuş otomatik başlatma; kilitte kendi kayıt için 8D+yankı+tempo OfflineAudio ile native loopa basıldı; dönüşte anti-pop crossfade.',
  'r476 Kilit ekranı zikir: kendi kayıt sürekli native audio loop; TTS uzun ön-kuyruk; dönüşte sessiz sayaç uzlaştırması. Yandaki Tefekkür girişi kaldırıldı.',
  'r475 Kilit ekranı zikir devamlılığı: kayıt native audio, TTS resume köprüsü; Esmâ görünümü ayarı Genel Ayarlar/Görünüm bölümüne taşındı.',
  'r474 Katman tekilleştirme: Tefekkür yalnız Zikir sekmesinde, isim animasyonu yalnız gerçek zikir başladıktan sonra; Sabit/Animasyon/Kapalı tek otoritede.',
  'r473 Tefekkür girişi yalnız Zikir sekmesinde; Esmâ/Berhetiyye için Sabit–Animasyon–Kapalı tekil isim görünümü eklendi.',
  'r472 Akıllı Seans: kendi kayıt öncelikli, yoksa erkek TTS; Tefekkür girişleri yazılı ve anlaşılır mini pill tasarımına geçti.',
  'r471 Tefekkür final geometri: üst zikir nefes alanına kavuştu, Çık düğmesi sayaç başlığının altına alındı ve dev yan Tefekkür pill hatası kapatıldı.',
  'r470 Canonical Tefekkür: tek grid/flex iskelet, ölçülen dock-safe layout, güçlendirilmiş audio recovery, source badge, session memory/summary, adaptif performans ve Diagnostics 2.0.',
  'r469 Tefekkür sesli zikir düzeltmesi: kayıt varsa kayıt, yoksa TTS; sayaç okuma bitmeden ilerlemiyor.',
  'r468 Tefekkür alanı iki panelli grid/flex iskeletine taşındı; üst görsel, alt kontrol yapısı ayrıştırıldı.',
  'r467 Tefekkür çemberi, yan istatistikler ve alt kontrol slabı mücevher hissiyle yeniden dengelendi.',
  'r466 Tefekkür üst başlık tipografisi inceltildi; sayaç alanına daha fazla dikey yer açıldı.',
  'r465 Tefekkür slab kompaktlaştırma: ana/çık butonları küçültüldü, focus-calm görünürlüğü dengelendi ve sabit akış barı için güvenli alt rezerv büyütüldü.',
  'r464 kilit ekranı toparlama + final Tefekkür layout: auto-zikir resume burst önlendi, tek audio recovery kapısı ve tek son CSS otoritesi eklendi.',
  'r463 r458 audit fixes: release JSON, dinamik Diagnostics build, yedek sürümü, event-driven Tefekkür layout guard, statik playing görünümü ve observer lifecycle temizliği.',
  'r458 Claude düzenlemesi: Tefekkür Control Island grid alanı cta olarak düzeltildi; halka/başparmak yerleşimi, Devir künyesi ve dock rezervi yeniden düzenlendi.',
  'r457 Tefekkür Saymaya Başla hizası için zorunlu normalizasyon ve stray autoBtn gizleme düzeltmesi.',
  'r456 Tefekkür Control Island repair: exit/−1 çakışması giderildi, ana CTA merkezlendi, island kompaktlaştırıldı ve Tefekkür mini dock başlangıcı eklendi.',
  'r455 Diagnostics + regression: runtime probe, geliştirici ekranı, güvenli/derin test suite ve JSON tanılama raporu eklendi.',
  'r454 Audio State Machine / Session Registry: play-pause-resume-stop-volume-state kontratı merkezileştirildi; aggregate transport registry üzerinden çalışıyor.',
  'r453 Core Cleanup I: Tefekkür, dock/focus ve peek runtime sahipliği tek SukunUIRuntime altında birleştirildi; r452 görsel tasarımı donduruldu.',
  'r452 nihai kalite turu: tefekkür minimalleştirildi, dock/control bar sadeleştirildi, tipografi ve boşluk sistemi standardize edildi.',
  'r451 son premium rötuş: ana CTA güçlendirildi, yan butonlar inceltildi, zikir odak halkasına çok hafif nefes efekti eklendi.',
  'r450 premium capsule: tefekkür üst kontrol adası tek bütün premium control island hâline getirildi; Hedef/Devir özeti kapsül içine taşındı.',
  'r449 hizalama rötuşu: tefekkür üst kontrol adası ortalandı, Hedef/Devir özeti kontrollerin altına taşındı, CANLI rozeti handle ile çakışmayacak yere alındı.',
  'r448 performans stabilizasyonu: global DOM observer ve render fırtınası kaldırıldı; tefekkür sürekli animasyonları statikleştirildi, dock senkronizasyonu tek koordinatörde birleştirildi.',
  'r447: tek oynatıcı Mini/Geniş iki seviyeli premium dock oldu; Tefekkür Focus otomatik sakinleşiyor ve tüm mikro hareketler 180–220 ms SÜKÛN motion diline bağlandı.',
  'r446: Tefekkür sayaç kontrolleri premium Control Island düzenine geçirildi; ana eylem, −/+ ve çıkış daha net ve erişilebilir hale getirildi.',
  'r445: Tefekkürde kalan flashing/titreme katmanları kapatıldı; breath halo ve pulse tint bastırıldı.',
  'r444: Tefekkürde Tefekkürden Çık ve Saymaya Başla, −/+ arasındaki kompakt merkez stack içine taşındı; sayaç sahnesi kısaldı ve görsel hiyerarşi sadeleştirildi.',
  'r443: Tefekkür bar kontrolü ikon-only yapıldı; yaklaşık 520 ms uzun basmada açıklama balonu açılıyor ve uzun basma modu yanlışlıkla tetiklemiyor.',
  'r442: Tefekkür kontrolü tek bara taşındı; Tefekkür barı kompaktlaştırıldı, −1/+1 yukarı alındı ve sayaç başlatma kontrolleri için güvenli alan ayrıldı.',
  'r441: gizli oynatıcı geri çağırma görünümü Geniş düğme / Yan sekme olarak seçilebilir ve tercih yerel olarak saklanır.',
  'r440: gizli oynatıcıyı geri-aç butonu büyütüldü, netleştirildi ve daha kolay tıklanır hale getirildi.',
  'r439: Detaylar panelinde tüm aktif katmanların ayrı ses/kapatma kontrolleri geri geldi; ana pause/stop bütün miks katmanlarını yönetiyor.',
  'r438 ses sözleşmesi denetimi: TTS watchdog yarışları, çift stop, Delâil kayıt-next, okuyucu provider kimliği ve hedefli bar stop davranışı sertleştirildi.',
  'Delâil bar Durdur doğrudan aktif okuyucuyu kesiyor; Vikâye tek Durdur düzenine ve sağlam kayıt→TTS fallback akışına geçirildi.',
  'Tekke oynatıcısı isteğe bağlı: seans başlarken dock otomatik açılmıyor; Tekke üstündeki küçük Oynatıcı düğmesiyle gösterilip gizleniyor.',
  'Tekke giriş kapısı açıkken SÜKÛN geri dönüş düğmesi kapı katmanının üstüne alındı; giriş yapmadan ana uygulamaya dönülebiliyor.',
  'Dock Detaylar artık ayrı sheet değil: tek oynatıcı içinde mini-akordeon; aktif sesleri ayrı kısma/kapatma, ambiyans süresi, frekans vuruşu, zikir temposu, okuma hızı, ton, yankı ve 8D aynı yüzeyde.',
  'Tek docka Detaylar ve Gizle eklendi: Detaylar eski gelişmiş Şu An Çalanlar sayfasını açıyor; Gizle oynatıcıyı alta indirip küçük geri çağırma tutamacı bırakıyor.',
  'Yarım kalan Global Queue restore durumunda playback sayılmıyor; boşta kalan sabit bar kapanıyor. Tümünü Durdur Global Queue ve Akıllı Seansı da kesin sıfırlıyor.',
  'Flash-free owner lock: tek dock artık sabit compositor yüzeyinde kalıyor; Akıllı Seans ile global miks görünürlük için yarışmıyor ve show/display animasyonu yeniden başlamıyor.',
  'Tek oynatıcı yüzeyi: Akıllı Seans, ambiyans, frekans ve diğer eşzamanlı sesler tek r170 dock içinde birleşiyor; global mini/döngü barları ayrı görünmüyor.',
  'Akıllı Seans çalışırken ikinci global mini oynatıcı ve hub içindeki küçük tekrar durum satırı gizleniyor; seans bittiğinde bağımsız ses varsa mini bar geri geliyor.',
  'SÜKÛN başlığı, Akıllı Seans başlığı ve Tefekkür sahnesine düşük opaklıklı soyut hat kıvrımları eklendi; kutsal kelime dekor olarak kullanılmadı.',
  'Tefekkür tipografisi sakinleştirildi; Akıllı Seans Ayarlar geçişi ipeksi hale getirildi; Şimdi Çalıyor yüzeyi Tefekkür diliyle birleştirildi.',
  'Akıllı Seans kartları sade-premium görünüme geçirildi; ayar satırları toparlandı. Tefekkür moduna daha derin ve huzurlu bir nur sisi atmosferi eklendi.',
  'Devam/Duraklat nefes animasyonu inceltildi: oynarken hafif altın, duraklatınca loş; bitime 30 saniye kala aynı dil hafif kehribar ısınıyor.',
  'Devam/Duraklat görseli hızlı blink yerine nefes gibi yavaş altın nabza geçirildi; mini oynatıcı halkası da sakinleştirildi.',
  'Tekke sekmesindeki ۞ logo ile Tekke etiketi gerçek #tekkeTab markup üzerinde ayrıldı; logo yukarı taşındı ve mobilde çakışma engellendi.',
  'r422 stabilizasyon: Akıllı Seans Şimdi Çalıyor tek görünür renderer ve tek state akışına birleştirildi; eski r417–r421 üst üste render katmanları kaldırıldı.',
  'Aktif adım, ses kaynağı, faz, sıradaki adım, mod/tekrar/ara, seviye ve kalan süre aynı anda sabit alanlarda gösteriliyor; kaynak seans başlamadan önceden çözülüyor.',
  'Kalan süre doğrudan state üzerinden okunuyor; son 30 saniyede sakin kehribar vurgu korunuyor. Frekans adımları duraklatılıp devam ettirildiğinde kalan süre korunuyor.',
  'Akıllı Seans kartları mobilde özet görünüm + isteğe bağlı Ayarlar yapısına geçirildi; kaynak rozeti kartta önceden görünür.',
  'Sürüm kimliği HTML, Service Worker, cache, footer ve yedek dosya adında r422 olarak eşitlendi.',
  'Akıllı Seans Şimdi Çalıyor kartı sabitlendi: Seans, Adım, Kaynak, Detay ve Süre ayrı satırlarda; frekans/ses/sükût bilgileri artık birbirinin yerine zıplamıyor.',
  'Akıllı Seans sükût adımları artık Şimdi Çalıyor barında süre anonsu + canlı geri sayım gösteriyor; her süre için kendi anons kaydı varsa TTS yerine o çalıyor.',
  'Akıllı Seans Oluşturucu mobilde yeniden yerleştirildi: iç kuyruk scrollu kaldırıldı, adım ayarları satırlara ayrıldı ve Şimdi Çalıyor için gerçek alt boşluk ayrıldı.',
  'Global Queue zikir adımları sessizdi: AudioResolver köprüsü window.R168 üzerinden aranıyordu, o ise hiç tanımlı değildi — zikir adımı hiç ses çalmadan geçiyordu, düzeltildi.',
  'Ambiyans rozetleri kendi MutationObserver\'ını tetikleyen sonsuz döngü kuruyordu; boştaki DOM yazımı saniyede ~1.500\'den ~150\'ye indi (%90 azalma).',
  'Hizbü\'l-Vikâye Sonraki düğmesi liste sonunu aşabiliyordu; 15 kısımlık gerçek sınır uygulanıyor.',
  'Letâif Seyri Şimdi Çalıyor bilgisi (başlık, sıra, ilerleme) boş geliyordu; beş letâif yeniden görünür.',
  'Kendi sesin kayıtları çözümlenirken her seferinde yeni AudioContext açılıyordu; ana bağlam yeniden kullanılıyor.',
  'Ekran kapalıyken boşa dönen arayüz yoklamaları durduruldu — pil tüketimi azaldı.',
  'Uygulama kabuğu artık önce önbellekten açılıyor, güncel kopya arkada tazeleniyor: açılış ağ turunu beklemiyor ve her açılışta 3 MB indirilmiyor.',
  'Tema rengi ve açılış ekranı rengi uygulamanın gerçek zemin rengiyle eşitlendi; Android için maskable ikon eklendi.',
  'Tefekkürden Çık düğmesi zikir çemberinin hemen altına normal akışta taşındı; yarı şeffaf kırmızı-mor-mavi neon kapsül olarak yenilendi.',
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

/*
 * r414 — ÖNBELLEK ÖNCE, ARKADA TAZELE (stale-while-revalidate)
 *
 * Eskiden burası network-first idi: her açılışta 3 MB'lık nero.html
 * ağdan yeniden çekiliyor, mobil veride hem yavaş hem pahalı oluyordu.
 * Çevrimdışı çalışmak üzere tasarlanmış bir uygulamada bu ters bir tercih.
 *
 * Yeni davranış: önbellekteki kabuk ANINDA döner (açılış ağ turu beklemez),
 * güncel kopya arka planda indirilip önbelleğe yazılır. Yeni sürüm zaten
 * nero.html içindeki updatefound/SKIP_WAITING akışıyla kullanıcıya
 * «Yeni sürüm hazır · Yenile ✦» olarak bildiriliyor — veri kaybı yok.
 */
async function kabukOncelikli(request) {
  const cached = await caches.match(request, { ignoreSearch: true })
             || await caches.match('./nero.html', { ignoreSearch: true });

  const tazele = fetch(request)
    .then(async response => {
      if (response && response.ok && response.type !== 'opaque') {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone()).catch(() => {});
      }
      return response;
    })
    .catch(() => null);

  if (cached) {
    /* Arka plan tazelemesi cevap dönmeyi geciktirmesin. */
    return cached;
  }

  return (await tazele) || Response.error();
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
      ? kabukOncelikli(request)
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
