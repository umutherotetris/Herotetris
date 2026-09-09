# SÜKÛN r732 — Dokunma, Kaydırma ve Gezinme Kararlılığı

## Temel ve kök nedenler
r731 tam paketinin üzerine uygulanmıştır. İnceleme, eski yerleşim otoritelerinin aynı yüzeye müdahale ettiğini gösterdi. r699 ölçümü, gövdenin grid/overflow durumunu geçici olarak değiştirebiliyordu; r508 gecikmeli scroll restorasyonu kullanıcının yeni hareketini geri alabiliyordu. Gizli/suspended panel sahipliği ve kapalı perdeler de tıklama engeli oluşturabilecek kalıcı durumlar taşıyordu. Bu kaynak düzeyi riskler giderildi. Fiziksel Android’deki tüm belirtilerin aynı nedenden kaynaklandığı kanıtlanmış değildir.

## Düzeltmeler
- r699 ölçümü artık scrollportu yeniden kurmadan, görünür çocukların gerçek içerik yüksekliğini okur. Mini/Midi/Max geçmiş ölçümü yeni yüksekliğe taşınmaz.
- Dokunma ve kaydırma sırasında geometri ölçümleri birleştirilerek ertelenir. Parmak bırakılıp hareket durulduğunda tek sahip yeniden ölçer. Sürükleme yalnız gerçek tutamaçta native pan davranışını devre dışı bırakır.
- r508 restorasyonu yeni kullanıcı girdisi veya scroll başladığında geçersiz olur. Yerleşim ölçümü gövde scrollTop’unu geri yazmaz. Scroll olayları artık alakasız arka plan scrollIntoView çağrılarına uzun süreli izin vermez.
- Aynı ana ekrana yeniden geçiş sayfayı gereksiz yere başa döndürmez. Ana sayfa, Zikir, Seyirler ve Sesler geçişleri korunur.
- Eski panellerin kapanması, inert ve perde sahipliği, modal/detay/araçlar katmanlarının hit-test sınırları düzenlendi. Gerçek açık panelin kendi kaydırma alanı ve klavye odağı korunur.
- 320 px’de gizlenen Ayarlar düğmesi geri getirildi; üstteki üç ikon 44 px dokunma alanı ile yerleşir.
- Tefekkür Mini’de eski CSS’nin gizlediği aktif isim, ses kaynağı ve ince ilerleme satırı geri getirildi. Mini/Midi/Max geçişinden sonra çıkış sabit oyuncunun altında kalırsa yalnız kullanıcı kip değiştirdiğinde uygun görünür konuma alınır. Kaydırma ve zikir sırasında otomatik sayfa sıfırlaması yapılmaz.
- Ses oturumu, foreground kuyruğu, kayıt/TTS, 28/99 seyir, sayaç işlemleri ve kanonik Tefekkür giriş/çıkış sahipleri değiştirilmedi.

## Doğrulama
31/31 kaynak/VM, 5/5 mini yönlendirme, 4/4 tam HTML yerleşim ve 390×844’te 8/8 etkileşim kontrolü geçti. Gerçek Chromium wheel kaydırması, ana ekran geçişleri, araç panelinin açılıp kapanması, ertelenmiş geometri, scroll restorasyonu, Mini/Midi/Max geçişleri, Tefekkür çıkışına gerçek dokunma ve iç içe eski panel sahipliği sınandı. Sayaç/indeks korunumu ve autoStart/autoStop çağrısı oluşmaması sentetik duraklatılmış oturumda kontrol edildi. Kaynak karşılaştırması ses ve sayaç sahiplerinin değişmediğini doğruladı.

## Açık doğrulama sınırları
Tam HTML ortam kısıtları nedeniyle bellekte, yerel paket görselleriyle çalıştırıldı. Gerçek Android parmak kaydırması test edilmedi; test sürücüsünün sentetik touch scroll davranışı boş bir sayfada dahi güvenilir değildi. 320 px’de ayarlar ve temel gezinme kontrolleri geçti, fakat sonraki kapsamlı koşu tamamlanmadı; bu nedenle tüm küçük ekran senaryoları geçmiş sayılmıyor. Kilit ekranı, kulaklık, mikrofon, gerçek kayıt veritabanı ve canlı ses üretimi kapsam dışıdır. Tefekkürden çıkınca çalan kaydın başa dönmesi canlı kayıtla yeniden üretilemedi; çözülmüş iddiası yoktur.

## Paket bütünlüğü
HTML, sürüm geçmişi, manifest, SW, build marker ve cache r732 ile eşitlendi. Eski sürüm kayıtları history altında tutuldu. Paket SHA-256, tüm dosya checksumları, ZIP CRC ve referans verilen varlıkların varlığı doğrulanmıştır.
