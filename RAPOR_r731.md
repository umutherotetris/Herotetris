# SÜKÛN r731 — Kompakt Mini ve Tefekkür Dokunma Düzeltmesi

## Temel ve kapsam
r730 tam paketinin üzerine uygulanmıştır. Ses motorları, kayıt/TTS çözümleyicisi, seyirler, sayaç işlemleri ve r699 yerleşim otoritesi değiştirilmedi. Yeni kural yalnız mevcut Mini akış kabuğunun görünümünü düzenler; Midi/Max ve bildirim çekmecesi kendi yerleşimlerini korur.

## Düzenlemeler
- Mini istatistik kartları gizlendi; ayrıntılar Midi/Max'ta korunur. Aktif zikir adı ve ses kaynağı iki satırda, ilerleme ince bir çizgide gösterilir.
- Tefekkür düğmesi ve üç bildirim düğmesi 44 px dokunma alanına sahiptir. 360 px ve altında Tefekkür yalnız ikona, durum etiketi noktaya dönüşür. Kontrollerin işlevleri ve mevcut click sahipleri korunur.
- Sürükleme kolu korunarak mini gövde içeriğe göre küçültüldü. Yerleşim yüksekliği r699 tarafından ölçülür; sabit bir CSS yüksekliğiyle zorlanmaz.
- Tefekkürde sayaç başlat/azalt/artır ve çıkış düğmeleri için en az 44 px yüksekliğe sahip, eski yoğunluk kurallarından daha güçlü bir CSS kuralı eklendi.
- Tefekkür girişi aktif modda tekrar çalıştırılmaz; çıkış başarılı tamamlanmayı bildirir. Mini girişte senkron hata yakalama eklendi. Çıkışın ses veya sayacı yeniden başlatan bir çağrısı yoktur.

## Ölçüm ve kontroller
Kaynak/VM regresyonları 31/31, mini giriş regresyonları 5/5 ve bellek içi Chromium tam HTML kontrolleri 4/4 geçti. 390×844 portre görünümünde Mini yüksekliği 255 px'ten 198 px'e indi. Tefekkür çıkışı ve sayaç eylemleri 44 px; yatay taşma yok. Sentetik duraklatılmış oturumda giriş/çıkış sonrasında sayaç ve indeks değişmedi, autoStart/autoStop çağrısı oluşmadı. Ekran görüntüleri ve ayrıntılı sonuçlar diagnostics/r731 içindedir.

## Açık doğrulama sınırları
Tam uygulama, ortamın URL gezinme politikası nedeniyle doğrudan HTTP üzerinden açılamadı; kaynak HTML ve paket içi görseller belleğe alınarak Chromium'da çalıştırıldı. Bu test gerçek Android kilidi, kulaklık kumandası, mikrofon, kayıt veritabanı veya fiziksel ses üretimi yerine geçmez. Kullanıcının bildirdiği, oynatma sürerken Tefekkürden çıkınca esmanın baştan okunması sorunu canlı kayıtla yeniden üretilemedi; sayaç geri sarma veya zorla ses yeniden başlatma gibi riskli bir yama yapılmadı. Gerçek cihazda devam ederse r731 tanı raporu ile ses sahibi ve işlem dizisi üzerinden incelenmelidir.

## Paket bütünlüğü
HTML meta, görünür sürüm, manifest, SW önbelleği, sürüm geçmişi ve build marker r731 ile uyumludur. SHA-256 listesi ve ZIP CRC doğrulaması pakete dahildir. Önceki sürümün rapor ve kimlik dosyaları diagnostics/history/r730_release altında korunmuştur.
