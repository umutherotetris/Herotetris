# SÜKÛN r712 — Kullanıcı Niyeti ve Sınırlı Seyir Kurtarması

**Tarih:** 8 Eylül 2026  
**Temel:** r711 tam paket  
**Kapsam:** Pause/Stop komutunun korunması, eski ses taşıyıcısı ile medya yankısı çakışmalarının giderilmesi ve otomatik kurtarmanın sınırlandırılması. r710/r711 sinematik görünümü korunur.

## Doğrulanan hata

r711'deki r656 seyir ses makinesi, kullanıcı Pause yaptıktan sonra fiziksel ses hâlâ çalıyor ve seyir mantıksal olarak running görünüyorsa 1,4 saniye sonra kullanıcı niyetini yeniden Play olarak kaydedebiliyordu. Böylece cihazın geç yanıt veren ses taşıyıcısı, kullanıcının açık duraklatma kararını tersine çevirebiliyordu. Kurtarma kodundaki `releasePauseGate` ve `markUserPlay` çağrıları da yeni kullanıcı komutu olmadan duraklatma kapısını açabiliyordu. r643 kilit taşıyıcısında ayrı bir 12 saniyelik niyet silme yolu, r220 medya durumu eşitlemesinde de fiziksel oynatma yankısını kullanıcı Play komutuna dönüştüren yol bulunuyordu.

Eski r656 üzerinde altı deterministik senaryonun beşi başarısız olarak yeniden üretildi. Bu kaynak hataları, kullanıcının Pause/Stop komutunun neden geri alınabildiğini açıklar. Telefonda yaşanan bütün kilitlenmelerin aynı nedenden kaynaklandığı veya gerçek cihazda tamamının giderildiği iddia edilmez.

## Uygulanan düzeltmeler

r656'nın mevcut genel API'si ve sürüm kimliği korunarak r712 revizyonu uygulandı. Açık Pause niyeti, fiziksel ses yankısı ile silinmez; çelişki en fazla bir kez tanı olayı olarak kaydedilir. Stop ayrı terminal niyet olarak tutulur. Bunları yalnız yeni kullanıcı Play/Resume/Start komutu veya ilgili açık terminal geçiş değiştirir. Eski asenkron kurtarmalar yeni kullanıcı komutu geldiğinde geçersizleşir; bekleme sonrasında da token, oturum sahibi, foreground çatışması ve kullanıcı duraklatması yeniden kontrol edilir.

Kurtarma aynı anda birden fazla başlatılmaz. Sonuçsuz otomatik denemeler en fazla üçle sınırlıdır ve kademeli bekleme kullanır. Denemeler tükenirse otomatik tekrar durur; yeni kullanıcı Play/Resume komutu yeniden deneme hakkı açar. Bu bir sonsuz retry döngüsü değildir ve sesin mutlaka başlayacağını garanti etmez. Tanınan sistem kesintisi kapısı, kullanıcı Play komutu taklit edilmeden uzlaştırılabilir; bilinmeyen veya kullanıcı kaynaklı duraklatma kapıları kendiliğinden açılmaz.

r643'ün 12 saniyelik otomatik Pause silme yolu kaldırıldı. r220'nin medya durumunu yansıtırken `markUserPlay` çağırması kaldırıldı; fiziksel oynatma bilgisi kullanıcı niyeti yerine geçmez. Mevcut gerçek Play/Pause/Stop girişleri korunmuştur. Yeni ses motoru, genel dokunma engelleyicisi veya kullanıcı verisine yazan bir çalışma zamanı eklenmedi.

## Korunan özellikler ve çakışma denetimi

r711'in hazırlık zaman aşımı, r710'un ses durumu döngüsü düzeltmesi, 28/99 Seyir, tekil zikir ve terkip, kayıt/TTS, sayaç/ledger ve mevcut akış barı korunur. r710 sinematik cami/Mevlevî sahnesi, üç WebP varlığı, ikonlar, 154 CSS bloğu ve kompakt Tefekkür yerleşimi bayt düzeyinde değiştirilmemiştir. HTML'de yalnız tanımlanan ses sahipleri, sürüm kimliği ve sürüm geçmişi değişmiştir. Kaynak parmak izleri ve r711'e karşı fark dosyası pakete eklenmiştir.

## Test sonuçları

| Denetim | Sonuç |
|---|---:|
| Pause/Stop ve kurtarma niyeti | 12/12 |
| Eski kilit taşıyıcısı ve medya yankısı | 5/5 |
| Mevcut kaynak regresyonları | 31/31 |
| Atmosfer regresyonları | 15/15 |
| Gerçek HTML etkileşim ve ses simülasyonu | 9/9 |
| Beş ekran boyutunda yerleşim | 40/40 |
| Kaynak ve yayın bütünlüğü | 8/8 |
| **Toplam kontrollü kontrol** | **120/120** |

Bu toplam kısmen örtüşen test kategorileridir; bağımsız hata sayısı veya fiziksel cihaz güvencesi değildir. r656 testleri sahte saat ve fiziksel kaynaklarla deterministik olarak çalıştırıldı. Eski r643/r220 fonksiyonları ayrıca gerçek kaynaklarından çıkarılarak sınandı. Tam uygulama HTML'si Chromium'da `set_content` ile, ağ engellenerek ve sanat varlıkları veri URI'siyle yüklendi. Gerçek ses donanımı simüle edildi.

Tam HTML testlerinde 20 ardışık dokunma, manuel sayaç/geri alma, hedef ve devir, sessiz uzlaştırma, Tefekkür çıkışı, ses durumu yarışları ve 15 saniyelik olay yükü geçti. Yerleşim 320×640, 390×844, 412×915, 640×360 ve 1280×900 boyutlarında Mini/Midi/Max, doğal kaydırma, tek alt rezerv ve çıkış hit-testleriyle doğrulandı. Eski kaynak ve atmosfer regresyonları ile bütün yürütülebilir script/SW sözdizimi denetimi de başarılıdır.

### Doğrulama sınırları

Fiziksel Android'de uzun süreli kullanım, gerçek kendi kayıt/TTS, kulaklık düğmeleri, telefon çağrısı, arka plan/ekran kilidi ve 28/99 Seyir geçişleri bu ortamda uçtan uca doğrulanmadı. Özellikle tarayıcının gerçek ses başlatma politikaları ve cihazın arka plan kısıtları simülasyonla kesin kanıtlanamaz. Sorun sürerse yeni tanı raporu ile olay sırası, oturum sahibi, duraklatma niyeti ve kurtarma bütçesi birlikte incelenmelidir. r712'yi bütün kilitlenmelerin kesin çözümü olarak değerlendirmeyin.

## Yayın ve veri güvenliği

HTML meta/footer, gömülü ve harici sürüm geçmişi, manifest bağlantısı/start URL/shortcuts, SW kayıt adresi, SURUM/CACHE ve yapı işaretçisi r712 ile eşitlendi. Önbellek: `sukun-r712-20260908a`. PWA'nın sabit kimliği `./nero.html` korunur. Önceki sürüm geçmişleri, kullanıcı onaylı güncelleme politikası ve r711'e dönüş için kaynak bilgileri muhafaza edilir. IndexedDB'yi veya tarayıcı kayıtlarını silen yeni işlem yoktur.

Kurulumdan önce Amel Defteri → Yedekleme bölümünden yedek alın. ZIP içindeki `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, `assets` klasörü, ikonlar ve `__sukun_build_r712__.json` dosyasını aynı yayın dizinine birlikte yükleyin. Yalnız HTML'yi değiştirmek yeterli değildir. Güncelleme bildiriminden yeni sürümü etkinleştirip yeniden açın; gerekirse `nero.html?v=r712` ile yeni HTML isteyin. Tarayıcı verilerini silmeyin. Bu oturumda GitHub'a canlı dağıtım yapılmadı.

`diagnostics` içinde kaynak farkı, script parmak izleri, özgün başarısızlıklar, yeni testler ve sonuçlar yer alır. Bütünlük testinin yeniden çalıştırılması için özgün r711 paketi bir klasöre çıkarılıp `SUKUN_R711_BASE` ortam değişkeni bu klasöre ayarlanabilir. Tek HTML görsel varlıkları gömülü taşır; tam çevrimdışı PWA kurulumu için ZIP kullanılmalıdır.
