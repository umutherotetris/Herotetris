# SÜKÛN r699 — UI/UX ve etkileşim denetimi

Tarih: 7 Eylül 2026. Kaynak: SUKUN_r698_TAM_PAKET.zip. Çıktı: r699 tam paket. Önceki sürümün dosyaları ve mevcut kullanıcı verileri değiştirilmedi.

## Giderilen sorunlar

- Birbiriyle yarışan r659/r671/r673/r679/r680 geometri ve Max katmanları tek r699 yerleşim otoritesine bağlandı. Eski dış API çağrıları için uyumluluk yüzeyleri bırakıldı.
- Host yüksekliği, doğal içerik yüksekliği, güvenli alan, alt gezinme rezervi ve sürükleme sınırları tek hesapta birleştirildi. Eski inline/CSS yüksekliklerinin yeni hesabı ezmesi engellendi.
- Mini/Midi/Max içerikleri ve sabit transport satırı ayrıldı; içerik büyüdüğünde panel kendi içinde kayar. Max'te gereksiz boşluk ve alt kontrolün kesilmesi giderildi.
- Tefekkürde çember, sayaç, −1/+1, Saymaya Başla, Önceki/Baştan/Sonraki, ses kaynağı ve Çık gerçek DOM sınıflarıyla responsive düzene alındı. Dar ekranlarda eski sabit min-width ve sabit yükseklik çatışmaları kaldırıldı. Alt içeriğe erişim native scroll ve dock rezerviyle sağlandı.
- Kısa yatay ekranda Max yüksekliği sınırlanarak tüm okuma alanını kaplaması önlendi. Kalan içerik iç panelde kaydırılır.
- Bildirim çekmecesinin bağımsız sürükleme/konumlandırma sahibi kaldırıldı. Tek modal, tek liste scroll sahibi, görünür backdrop, odak yönetimi ve Escape kapatma eklendi. Ana bildirim sayfasına geçişte açık çekmece kapatılır.
- Detaylar düğmesi canonical API'ye bağlandı; eski ikinci açılma yolu kaldırıldı. Portal, tek açılışta scroll sıfırlama ve uzun içerikte native kaydırma korunur.
- Sürükleme tutamacı pointer capture, hareket eşiği ve klavye konumlandırması kullanır. İptal edilen sürükleme sonraki gerçek düğme tıklamasını yutmaz. Dekoratif halkalar ve efektler hit-test dışında tutuldu.
- UI güncelleme/DOM taşıma işlemleri, mevcut düğümler doğru sıradaysa yeniden yapılmayacak şekilde idempotent hale getirildi. Bu, eski render sırasında odak ve yerleşim sıçramalarını azaltır.
- Sürüm etiketleri, manifest, service worker cache anahtarı, build marker ve sürüm geçmişi r699 ile eşleştirildi. Eski sürüm notları ve r695/r696/r698 motor sürümleri korunur.

## Doğrulama

Statik: 184 çalıştırılabilir inline JavaScript bloğu, 147 CSS bloğu ve 958 ID incelendi. JavaScript sözdizimi hatası: 0; CSS ayrıştırma hatası: 0; yinelenen ID: 0. Kaynak dışı HTML şablonları JavaScript gibi ayrıştırılmadı. Service worker ayrıca ayrı JavaScript dosyası olarak kontrol edildi.

Chromium 144 üzerinde 320×640, 360×740, 390×844, 768×1024 ve 640×360 ekranlarında yerleşim senaryoları çalıştırıldı. Son turda 320×640, 390×844 ve 640×360 için Mini/Midi/Max, Tefekkür, bildirim çekmecesi ve Detaylar yeniden sınandı. Testler gerçek tarayıcı DOM/CSS motorunda, simüle edilmiş aktif akışla yürütüldü.

390×844 dokunma testinde Play=1, Stop=1. Pointer sürüklemesi konumu −100 px, klavye hareketi −128 px yaptı. 24 satırlık bildirim listesi 1055/1055 px kaydırma sınırına, uzun Detaylar içeriği 815/815 px sınırına ulaştı. Drawer kapanışı ve Detaylar portalı doğrulandı. Kısa yatay ekranda Max 216 px ile sınırlanıp iç kaydırma alanı korundu.

## Korunan kapsam ve sınırlar

Ses motorları, kayıt/TTS önceliği, r695 sayaç ve istatistik ledger'ı, r696 kesinti kurtarması, r698 transport komutları, seyrin iş mantığı, kayıt veritabanları ve kullanıcı tercihleri bu UI çalışmasında yeniden tasarlanmadı. Kullanıcı verileri silinmez; mevcut uygulama depolamasıyla yerinde güncelleme amaçlanır.

Bütün cihaz/tema/dil kombinasyonlarında sıfır hata garantisi verilemez. Gerçek Android kilit ekranı, telefon araması, Bluetooth/kulaklık tuşları, mikrofon izinleri, gerçek kendi kayıt dosyaları, TTS sesleri ve service worker'ın kurulu PWA üzerindeki güncelleme döngüsü fiziksel cihazda ayrıca doğrulanmalıdır. Simüle edilmiş akışta başarılı dokunma testi, sesin gerçekten üretildiği anlamına gelmez.

## Kurulum

Paketin içindeki uygulama dosyalarını aynı sunucu klasörüne birlikte koyun. Yalnız nero.html dosyasını eski sw.js veya eski manifest ile karıştırmayın. Mevcut PWA'da güncelleme tamamlandıktan sonra uygulamanın kendi Yenile akışını kullanın; kullanıcı kayıtlarını veya site verilerini temizlemeyin. Geri dönüş gerekirse özgün r698 paketi saklanmıştır.
