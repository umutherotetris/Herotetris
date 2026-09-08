# SÜKÛN r716 — Feyz Kabuğu, Assetler ve Güvenli Alev Halkası

**Tarih:** 8 Eylül 2026  
**Taban:** r715 çalışma paketi  
**Durum:** Kaynak ve kontrollü Chromium testleri tamamlandı. Fiziksel Android, gerçek ses donanımı ve kilit ekranı henüz doğrulanmadı.

## 1. Görsel entegrasyon

r715’teki genel gradyan kabuğu gerçek, yazısız ve yerel assetlerle yeniden düzenlendi. Zümrüt–mavi–mor cam paneller, altın süs çizgileri, üst başlık, mevcut dört bölümlü gezinme, ana sayfa, zikir, seyirler, sesler, araçlar ve mevcut modal bileşenleri aynı görsel dili paylaşır. Yeni sahte sayfalar veya ekran görüntüsünden yapılmış butonlar yoktur. Gerçek DOM kimlikleri ve olay sahipleri korunur. Önceki r710 cami/Mevlevî sahnesi ortak arka plan olarak kullanılır; yeni `feyz-mark.svg`, `feyz-ornament.svg`, `feyz-flame-ring.svg` ve şeffaf 600×600 WebP halka asseti pakettedir. PWA ikonları aynı özgün vektör mühürden üretilmiştir.

Alev halkası ayrı, pointer-events:none dekor katmanıdır. Dumansız, kıvrımlı mor alev çizgileri statik görsel asset olarak çizilir; yalnız mevcut Canlı tercihi izin verdiğinde dönüş/pulse animasyonu uygulanır. Yeni sürekli canvas veya ses zamanlayıcısı eklenmedi. Önceki ağır atmosfer canvas’ı Feyz kabuğunda çizim yapmaz. Sabit, azaltılmış hareket, pil profili ve sayfa yaşam döngüsü kuralları korunur. Performans yöneticisi etkin profili pil moduna alırsa alevin durması beklenen davranıştır. Mevcut ses, kayıt, sayaç ve seyir motorları değiştirilmedi.

Tefekkür çemberi hafif yukarı taşındı. Görselin dış sınırı Hedef/Kalan’dan ayrı tutulur. Test edilen beş ekran boyutunda Mini/Midi/Max için ölçülen en küçük boşluk 17 px oldu. Alt kontrol yüzeyleri ayrı z-index ve kapalı yüzeylerle korunur. Kabuk ayarlardan kapatılabilir; kapatıldığında alev DOM’da gizlenir, yeniden açılınca görünür. Kayıtlı renk teması silinmez ve eski kabuk kalıcı olarak değiştirilmez.

## 2. Eski sürümden taşınan kusurlar

r715’teki harici ve gömülü sürüm geçmişi eşit değildi: yeni kayıt eklenirken r714’ün gömülü kaydı yanlışlıkla yer değiştirmişti. Tam geçmiş r715’in harici kaydından yeniden oluşturuldu; 241 kayıt korunur. r716 sürüm etiketinin başlangıçta eski v20.21 yazması da v20.23 olarak düzeltildi. Kabuk kapatıldığında stilini kaybeden alev görselinin görünür kalabilmesi, bağımsız hidden kuralıyla giderildi. Bunlar kaynakta gerçek ve tekrarlanabilir düzeltmelerdir.

## 3. Tamamlanan kontrollü doğrulamalar

| Küme | Sonuç | Kapsam |
|---|---:|---|
| Kaynak regresyonu | 31/31 | JS/SW sözdizimi, sürüm bütünlüğü, ses ve sayaç otoriteleri, SW önbellek sözleşmesi |
| Gerçek HTML tarayıcı | 57/57 | 320×640, 390×844, 412×915, 640×360, 1280×900; Mini/Midi/Max, boşluk, dock alt sınırı, çıkış hit-test, sayaç, gezinme, arama, voice-false |
| Canlı hareket | 7/7 | Canlı alev, kabuk kapatma/açma, Sabit/Canlı, pil kısıtı, sayfa yaşam döngüsü, native sayaç |
| Atmosfer kaynak regresyonu | 15/15 | Mevcut atmosfer sahibi ve durum sözleşmesi |
| Pause/Stop kaynak simülasyonu | 5/5 | Güncel r643 ve r220 kaynaklarından çıkarılan kilit/medya niyeti senaryoları |

Kümelerin bir kısmı aynı davranışları tekrar sınar; toplamları bağımsız hata sayısı değildir. İlk birleşik ekran koşusu süre sınırına takıldı; tamamlanmış sayılmadı. Beş ekran boyutu ayrı işlemlerde tamamlandı. İlk kaynak denetimindeki eski r715 geçmiş uyumsuzluğu giderildi. Önceki 5 Pause/Stop denemesinin üçünün yanlışlıkla dizin yolu verilmesi nedeniyle başarısız olması uygulama hatası değildi; gerçek güncel kaynaklar çıkarılarak 5/5 yeniden çalıştırıldı. Canlı testte adaptif performansın kendiliğinden pil moduna geçmesi ilk beklentiyi bozdu; test uygulamanın mevcut performans otoritesine göre düzeltildi ve 7/7 geçti. Bu ara koşular başarılı gibi sayılmadı.

Chromium testleri gerçek HTML kaynaklarını, yerel assetleri ve native dokunmaları kullanır. Ağ engellenmiş, Service Worker kontrollü HTML testinde kapatılmıştır. Ses ve kilit senaryoları fiziksel Android, mikrofon, kulaklık veya duyulan ses kalitesinin yerine geçmez. Gerçek cihazda uzun kullanım, kilit ekranı ve kayıt/TTS akışı ayrıca doğrulanmalıdır. Önceki telefon raporundaki `voice-false` nedeninin fiziksel kaynağı henüz kanıtlanmadığından güvenli geri alma davranışı korunmuş, ses motoruna tahmini bir onarım yapılmamıştır.

## 4. Kaynak, sürüm ve veri bütünlüğü

HTML meta, alt sürüm etiketi, manifest ve shortcut URL’leri, SW SURUM/CACHE/NOTLAR, gömülü/harici geçmiş ve build marker r716 ile eşleşir. Önbellek `sukun-r716-20260908a`; PWA kimliği `./nero.html` korunur. Yeni assetlerin tamamı SW önbellek listesinde yer alır. Kullanıcı kayıtları, IndexedDB, Amel Defteri ve kişisel ayarlar silinmez. Dağıtım arşivi özel telefon tanılarını, ses kayıtlarını veya eski sürümlerin ham çalışma klasörlerini içermez. Kaynak farkı, test sonuçları ve SHA-256 listesi pakettedir.

## 5. Kurulum ve geri dönüş

Önce Amel Defteri’nden yedek alın. ZIP içindeki `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, `__sukun_build_r716__.json`, ikonlar ve `assets` klasörünü birlikte aynı yayın dizinine yükleyin. Tarayıcı verilerini veya IndexedDB’yi silmeyin. Güncelleme sonrası alt etikette `build 2026-09-08-r716` görünmelidir. Canlı GitHub yayını bu çalışma sırasında yapılmadı. Sorun olursa r715/r714 yedeğine dönülebilir; kullanıcı verileri temizlenmemelidir.
