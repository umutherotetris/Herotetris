# SÜKÛN r733 — Tefekkürde Durdur → Başla onarımı

## Olay ve tanı kanıtı
Temel: kullanıcı tarafından sağlanan r732 tam paketi ve 9 Eylül 2026 tarihli Android tanı kaydı. Rahmân (esma:0:nida) için 35/298 ilerleme ve kendi kayıt seçimi korunmuştu. Son Durdur, r588Stop üzerinde native click olarak alınmış, ardından tüm oturumlar idle olmuş ve foreground sahibi serbest bırakılmıştı. Tanı, son durdurmadan sonra yeni bir oynatma komutu göstermiyordu. Bu nedenle tek bir kök neden kesinleşmiş değildir; gerçek düğme olayının kaybolması ile başlatma yolunun reddi ayrı olasılıklardır. Kayıt dosyasının kendisi pakete eklenmemiştir.

## Uygulanan düzeltmeler
- Ana Başla düğmesindeki 620 ms'lik sessiz reddetme kaldırıldı. Bütün oynatma düğmeleri mevcut kanonik transporta gider.
- Asenkron stopAll temizliği sürerken gelen yeni Başla, temizliğin tamamlanmasını bekler. Aynı niyet ikinci oturum açmaz; yeni Durdur bekleyen başlangıcı iptal eder. Birbirine denk gelen eski stop işlemleri de tamamlanmadan yeni ses başlatılmaz.
- Gerçek Duraklat/Devam et, registry'nin yakaladığı oturumu sürdürür. Terminal Durdur sonrasında ise eski idle oturuma resume gönderilmez; yeni bağımsız zikir niyeti kurulur. 28/99 seyirlerin önceliği korunur.
- İlk rep() bekleme döndürdüğünde (niyet, meşgul ses veya geçici transport kapısı) otomatik oturum artık terminal stop ile yıkılmaz. Var olan scheduler bekleyip yeniden dener; gerçek okuma doğrulanmadan sayaç artırılmaz. Gerçek exception hâlâ stop ve hata raporu üretir.
- Logger ve mini oyuncu autoStart/autoStop sarmalayıcıları alt fonksiyonların sonucunu aynen iletir. Foreground hakemi başarısız başlangıçta sahibi serbest bırakır; kayıt önceliği ve ses üreticileri değiştirilmedi.
- Tanı raporuna restartR733 eklendi. En fazla 48 olaylık iz, native tıklama/pointer iptali, kabul edilen transport komutu, pending stop/start, iptal ve başlatma sonucunu ayırır. Ham ses veya kayıt içeriği toplanmaz. Kaydırmaya karşı sentetik click üretilmez.

## Doğrulama
- 31/31 kaynak ve Service Worker regresyonu geçti.
- 5/5 mevcut mini oynatıcı regresyonu geçti.
- 10/10 yeni yeniden başlatma regresyonu geçti: 35/298 korunumu, asenkron stop bariyeri, tekrar tıklama, yeni Stop ile iptal, aggregate Pause/Resume, 28/99 sahipliği, ilk ses beklemesi, exception sonrası retry ve sonuç iletimi.
- Mevcut 390×844 Chromium yerleşim/etkileşim koşusu 8/8 geçti: scroll, gezinme, perde kapanışı, ölçüm ertelemesi, Mini/Midi/Max ve Tefekkür çıkışı.
- Ek tam HTML Chromium koşusu 4/4 geçti: Tefekkür mini Durdur → Başla, ana Başla, bekleyen başlangıcın Durdur ile iptali ve yakalanmamış sayfa hatası bulunmaması. Ses/registry kontrollü taklitlerle sınandı; kullanıcıya ait gerçek kayıt kullanılmadı.

## Açık doğrulama sınırları
Gerçek Android üzerinde kullanıcının IndexedDB kaydını çalarak aynı olay yeniden üretilemedi. Fiziksel ses donanımı, kilit ekranı, kulaklık ve TTS üretimi bu koşuda doğrulanmadı. Kendi kaydınla başlatmanın tüm cihazlarda kesin çözüldüğü iddia edilmez. r733 tanı izi, sorun tekrar ederse hangi düğmenin native click aldığı ve hangi transport koşulunun engel olduğu bilgisini verecek. Kayıt/TTS, sayaç doğruluğu ve seyir geçişleri için gerçek cihaz regresyonu gereklidir.

## Paket bütünlüğü
HTML, manifest, Service Worker, build marker, sürüm geçmişi ve cache r733 ile eşitlenmiştir. Eski r732 release metadata'sı history altında korunmuştur. Paket dosya checksumları ve ZIP CRC doğrulanmıştır. Kullanıcı kayıtları ve mevcut uygulama verileri pakete alınmamış veya sıfırlanmamıştır.
