# HerOyun Portalı v147 — oyun ve oturum düzeltmeleri

Tarih: 21 Ekim 2026. Taban: v146, `3c116974f3c0758e52ad06224b37b7886b4e0a14`.
Kaynak: `umutherotetris/Herotetris`, `main`.

## Korunan görünüm

Orijinal Diamond/taç görselleri, 34 px boyutları, parıltı ve animasyonları, üstte otomatik park ve dokunarak/fareyle sürükleme davranışı korunur. Taç mevcut yönetici görünürlüğünü korur. Tema ve arayüz ölçeği tercihleri değiştirilmez. Yönlendirme sistemi yeniden yazılmadı; ikon ve tema CSS dosyaları değiştirilmedi.

## Satranç

- Tavladaki v146 hatasının benzeri: görünür kare koordinatları ikinci kez zoom'a bölünüyordu. Tıklama/sürükleme hesabı düzeltildi; %80, %85, %100 ve %130 ile iki yön sınandı.
- Yakalanan taş undo kaydından önce listeye ekleniyordu. Geri alma artık taş listesi ve konumu birlikte geri getirir.
- Eski AI/animasyon/gecikmiş işlemler kapanmış, yeniden açılmış veya pozisyonu değişmiş maça hamle uygulayamaz. Restart geçmişi/animasyonu/saatleri sıfırlar. Online tek taraflı restart/FEN engellendi.
- Reconnect `enPassant`, saat ve bitiş durumunu taşır; var olmayan çizim çağrısı kaldırıldı. Tam durum host'tan misafire kabul edilir.
- AI son arama katmanındaki matı materyal değerlendirmesinden önce görür; kesin matta daha kısa sonucu seçer ve bitmiş pozisyonlarda oynamaz.
- Eski Peer/oda/kanal ve zaman aşımı olayları yeni odaya karışamaz. Reconnect kanal açılınca tamamlanır; kapanış lobby/HUD kaynaklarını temizler.

## Tavla

- Açılışta gösterilen iki zar ilk turda kullanılır; kazanan oyuncu yeniden zar atmaz.
- Kayıtlı insan/AI turunda zarlar ve kullanılmış zar indeksleri korunur. AI yarım kalmış turu yeniden zar atmadan sürdürür.
- Undo/restart/kapanış eski AI, zar animasyonu ve otomatik tur sonu işlemlerini geçersiz kılar.
- Oynanabilir zar varken erken tur bitirme ve tekrarlanan tur sonu mesajı reddedilir.
- Kayıt/senkronizasyon girdileri tahta, zar ve pul sayılarıyla doğrulanır: her renkte toplam 15 pul korunmalıdır. Host misafir snapshot'ını kabul etmez; bitmiş durum korunur.
- Oda değişimi, bekleyen bağlantı ve reconnect zamanlayıcıları ait oldukları odayla sınırlandı.
- Kullanıcının bildirdiği beyaz 6–3 konumu gerçek dokunma/sürükleme testinde dört ölçek ve iki tahta yönünde tekrar doğrulandı.

## Tetris

- Yedek taş çağrıldığında doğuş alanı doluysa oyun doğru biter. Yeni taş önceki taşın kilit gecikmesini veya döndürme/T-spin bayrağını devralmaz. Kare O taşı dönerken kaymaz.
- Yerçekimi gücünün oluşturabildiği 5+ dolu satır skoru `NaN` yapmaz. Dört satırın üzerindeki her ek satır temel 100 puanla hesaplanır; mevcut seviye/hız/B2B çarpanları uygulanır. Golem gücü açıklamasındaki gibi alt sırayı temizler.
- JSON kayıtları özel güçlerin fonksiyonlarını saklayamıyordu. Devamda geçerli güç kimlikleri gerçek tanımlara bağlanır; kaydedilen özel güç tekrar çalışır.
- Gecikmiş skor/ödül yanıtları kapatılan, yeniden başlatılan veya hesabı değişen oyunda devam işlemi yapmaz. Ortak ödül ekranının gecikmiş servis yüklemesi de iptal edilen oturumu açmaz.
- Premium ödülün tekrar oyna işlemi çalışır; istatistik bir kez kaydedilir. AI tekrarında rakip tahtası/sonucu sıfırlanır; online tekrar oda lobisine döner.
- Rakibin elendiği mesajı kazananı hemen sonuçlandırır. Bozuk skor/sohbet ve sınırsız/sayısal olmayan çöp verisi reddedilir.
- Eski bağlantı olayları yeni odaya karışmaz. Lobby başlangıç gecikmesi yeni oda, hata, kopuş veya Geri ile iptal edilir; reconnect doğru lobiyi bir kez başlatır. HUD ve gecikmiş yeniden eşitlemeler temizlenir.

## Kelimecik

- Türkçe/İngilizce ve süreli eşleşme kuyrukları doğru yoldan iptal edilir; beklemiş oda kurma/temizleme işlemi yeni oturumu etkileyemez.
- Süreli oyun süresi yeni ve sürdürülen oturumda korunur; gerçek tur değişiminde yenilenir. Oyuncu üyeliği doğrulanır; süre galibiyeti transaction içinde kontrol edilir.
- İngilizce joker Q/W/X seçeneklerini içerir. Eski AI/durum/kutlama işlemleri kapanmış oyuna uygulanmaz.
- Yerel torba/raf tükenmesinde maç sonlanır, oyun sonu ödülü tekrarlanmaz; süre/pes sonucunda kazanan ve istatistikler doğru oyuncuya göre belirlenir.

## Çalıştırılan kontroller

Motor ve deterministik oturum testleri:

```sh
node QA/portal-engines.mjs
node QA/portal-game-network.mjs
node QA/chess-regressions.mjs
node QA/tavla-regressions.mjs
node QA/tavla-transport-regressions.mjs
node QA/kelime-regressions.mjs
node QA/kelime-ui-regressions.mjs
node QA/tetris-regressions.mjs
node QA/tetris-gameplay-extra.mjs
node QA/tetris-transport.mjs
node QA/tetris-lobby.mjs
```

Yedi gerçek Chromium test paketi:

```sh
node QA/tavla-input.cjs
node QA/portal-ui.cjs
node QA/portal-state.cjs
node QA/portal-forms.cjs
node QA/portal-flows.cjs
node QA/portal-worker.cjs
node QA/tetris-session-ui.cjs
```

Hepsi geçti. Ortam: Node 24.19.0, Playwright ve Chromium 133. Tarayıcı yürütülebilir dosyası `PORTAL_CHROMIUM` ile belirtilebilir. `js/` altındaki 60 JavaScript dosyasında `node --check` ve `git diff --check` geçti.

Tarayıcı doğrulaması altı ekran genişliği, beş portal sekmesi, dört gerçek oyun giriş modülü, 11 tema, özgün ikon/park/sürükleme, hesap/form/sosyal akış ve gerçek eski-worker geçişi/çevrimdışı kabuğu kapsar. Yeni Tetris tarayıcı testi gerçek JSON save/close/resume ve güç düğmesiyle +750 puanı, temiz AI tekrarını ve dolu alanda hold sonucunu sınar.

## Doğrulamanın sınırları

Hesap/Firebase testleri bellek içi veriler, Peer testleri deterministik sahte taşıma katmanı kullanır; üretim hesaplarına mesaj veya ödül yazılmadı. Fiziksel Android cihaz, iki gerçek oyuncu arasında canlı Firebase/PeerJS maçı, canlı sunucu güvenlik kuralları ve uzun süreli pil/bağlantı dayanımı ayrıca sınanmalıdır. Bu sürüm bütün olası hataların bittiği iddiası değildir. Kural ve oturum davranışı değiştiğinden çevrimiçi maçın iki tarafı da v147 kullanmalıdır.
