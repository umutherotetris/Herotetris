# SÜKÛN r714 — Etkileşim Performansı ve Dokunma Tanısı

**Tarih:** 8 Eylül 2026  
**Taban:** r713  
**Durum:** Kaynak ve kontrollü tarayıcı testleri başarılı. Fiziksel Android uzun kullanım ve kilit ekranı ses testi yapılmadı.

## 1. Neden bu sürüm?

r713 telefon tanısında yaklaşık dört dakikada 154 uzun görev, son iki dakikada 58 uygulama uzun görevi ve 187 ms tepe görev görüldü. Tefekkür çıkışı, dock ve arama etrafında gecikmeler vardı. Yeni tanı 108 pointercancel kaydetti; bu sayı tek başına 108 kayıp tıklama anlamına gelmez. Mütekebbir sesli sayımında bir voice-false geri alması kaydedildi. Önceki Kandil null hatası ve ses olay fırtınası aynı tanıda görünmüyordu.

## 2. Kaynak düzeltmeleri

**Zikir kartı / r600:** CPU profili eski ölçücünün her alt öğede getComputedStyle ve getBoundingClientRect çağırdığını gösterdi. Eski tefekkür çıkışı profilinde visibleRect fonksiyonuna yaklaşık 793 ms self time atfedilmişti. Ölçücü doğal scrollHeight ve sınırlı doğrudan çocuk geometrisiyle yeniden düzenlendi. İçerik büyüme/küçülme, Tefekkür ve mevcut kaydırma otoriteleri korunur. Yeni bir sürekli animasyon döngüsü eklenmedi.

**Erişilebilirlik:** Eski kuyruk her elemanda alt ağacın tamamını tekrar sorgulayıp TreeWalker oluşturuyordu. Yeni kuyruk eklenen alt ağacı bir kez işler, önceden işlenen düğümleri atlar ve işi kısa zaman dilimlerine böler. Elle verilmiş erişilebilir adlar, switch aria-checked ve Arapça lang kuralları korunur. Sentetik 120 satırlık testte alt ağaç sorguları 361→0, TreeWalker sayısı 361→1 oldu; her iki sürümde 720 aynı öznitelik yazımı gerçekleşti. Tek koşunun duvar saati süresi yeni sürümün her koşulda daha hızlı olduğunu kanıtlamaz. Önceden işlenmiş bir alt ağacın tamamen DOM dışındayken değiştirilip yeniden eklenmesi özel kenar durum olarak henüz doğrulanmadı.

**Genel arama:** innerText tabanlı dizinleme textContent temelli, gizli alt öğeleri ayıran çıkarımla değiştirildi. Kapalı ana sekmelerin de aranabilir kalması için önceki bir test regresyonu düzeltildi. Berhetiyye kilit/secret policy kontrolleri korunur. Kaynak seçimi ve arama sonuçlarının navigasyon sahipleri değiştirilmedi.

**Dokunma tanısı:** Native pointerdown/up/cancel ve click izleri artık hareket, scroll değişimi, hedefin DOM'dan ayrılması, hit-test değişimi ve belirsiz iptal olarak ayrılır. Tanı pasiftir; sentetik tıklama üretmez, preventDefault veya stopPropagation çağırmaz. İptal sayılarını kayıp tıklama olarak yorumlamaz.

**Sesli sayaç:** voice-false geri alma güvenliği korunur; mevcut ses/kayıt motoru değiştirilmedi. Kaynak ve sayaç kapısı bilgileri tanıya eklenir. Önceki telefon raporundaki tekil ses başarısızlığının fiziksel nedeni henüz kanıtlanmadığı için bu sürümde ses motoruna tahmini bir yama yapılmadı.

**Görsel ve mevcut özellikler:** r710–r713 sinematik sahne, tüm CSS ve sanat dosyaları, kayıt/IndexedDB, 28/99 seyir, tekil/terkip, sayaç, Kandil ve Pause/Stop düzeltmeleri korunur. Yeni skin veya ses motoru eklenmedi.

## 3. Doğrulama sonuçları

| Kontrol | Sonuç | Kapsam |
|---|---:|---|
| Kaynak regresyonları | 31/31 | JS/SW sözdizimi, ses ve sayaç otoriteleri, SW yükleme sözleşmesi |
| Tam HTML yerleşimi | 40/40 | 320×640, 390×844, 412×915, 640×360, 1280×900; Mini/Midi/Max, alt sınır, çıkış hit-test |
| Odaklı HTML | 9/9 | Gerçek native dokunuş, +/−, doğal büyüme/küçülme, arama, voice-false güvenliği, 15 sn idle |
| Pause/Stop yarışları | 12/12 | İzole kaynak/ses durum simülasyonu |
| Atmosfer regresyonları | 15/15 | İzole Node VM; ses ve sayaç sahibi korunumu |
| Erişilebilirlik eşdeğerliği | 2/2 sürüm | Aynı 120 satırlık DOM; etiket, lang ve switch kontrolleri |

Tam HTML testleri gerçek uygulama kaynaklarını Chromium'da çalıştırdı. Resimler yerel data URI olarak verildi ve harici ağ kapatıldı. Ses durum testlerinde sentetik fiziksel ses kullanıldı; Android'in ses donanımı, mikrofon, kulaklık ve kilit ekranının yerine geçmez. Yerel HTTP/SW kurulum testi ayrıca denendi; ortam 127.0.0.1 gezinmesini ERR_BLOCKED_BY_ADMINISTRATOR ile engelledi. Bu test başarılı sayılmadı. Kaynak tabanlı SW kurulum/önbellek sözleşmesi testleri geçti.

Önceki birleşik test süre aşımı ve ilk arama/erişilebilirlik regresyonları raporlanmış, düzeltilmiş ve ayrı testlerle yeniden doğrulanmıştır. Testlerin toplamı bağımsız başarı sayısı olarak pazarlanmaz; birden fazla kümede örtüşen kontroller bulunur.

## 4. Sürüm ve veri bütünlüğü

HTML meta, alt sürüm etiketi, manifest bağlantısı, manifest start_url/shortcuts, gömülü ve harici sürüm geçmişi, SW SURUM/CACHE/NOTLAR ve build marker r714 ile eşleşir. Önbellek: `sukun-r714-20260908a`. PWA kimliği `./nero.html` olarak korunur. Kullanıcı depolamasını silen bir işlem eklenmedi; ikonlar, sanat dosyaları ve mevcut CSS r713 ile byte-identical. Kaynak farkı ve SHA-256 listesi pakettedir.

## 5. Bilinen sınırlar ve sonraki adım

Bu sürüm bütün kilitlenmelerin bittiğini kanıtlamaz. Fiziksel Android'de uzun süreli Tefekkür/dock/arama kullanımı, gerçek sesle 28/99 seyir, ekran kilidi, kulaklık Pause/Stop/Resume ve voice-false kaynağı ayrıca doğrulanmalıdır. Uygulama tanısında kalan isteğe bağlı sistem tam ekranı ayar/API sözleşmesi bu performans sürümünde değiştirilmedi. Yeni telefon raporunda özellikle görünür uzun görevler ve cancelReasons/outcomes karşılaştırılmalıdır.

## 6. Kurulum ve geri dönüş

Önce Amel Defteri'nden yedek alın. ZIP içindeki nero.html, sw.js, manifest.webmanifest, surumler.json, build marker, ikonlar ve assets klasörünü birlikte aynı yayın dizinine yükleyin. Tarayıcı verilerini, IndexedDB'yi veya kayıtları silmeyin. Güncelleme sonrası alt etikette `build 2026-09-08-r714` görünmelidir. Canlı GitHub yayını bu çalışma sırasında yapılmadı. Sorun olursa tam r713 paketine dönülebilir; kullanıcı verileri temizlenmemelidir.
