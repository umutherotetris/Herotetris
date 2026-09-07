# SÜKÛN r708 — Tefekkür Sınırı ve Sürüm Eşitlemesi

**Tarih:** 7 Eylül 2026  
**Temel:** Kullanıcının r707 tam paketi  
**Kapsam:** Tefekkür yerleşimi ve sürüm yayın zinciri. Yeni ses motoru veya tasarım değişimi yoktur.

## Kök neden ve düzeltme

### Çift alt boşluk
r707'de Tefekkür sekmesi `--r699-content-reserve` kadar alt boşluk ayırırken dış `.wrap` kapsayıcısı da eski dock kuralları nedeniyle aynı rezervi tekrar ekliyordu. Gerçek HTML ile Chromium'da 390×844 boyutunda sekme rezervi 263 px, dış kapsayıcının ek rezervi 307 px olarak ölçüldü. Bu, kartın altına büyük bir boş alan ekliyor ve sayfanın sonuna kaydırıldığında başlığı yukarı taşıyordu.

r708, Tefekkür için dış kapsayıcının ikinci rezervini sıfırlar. Daha eski yüksek özgüllüklü seçicilerin bunu geri getirmemesi için kural, yalnız Tefekkür köküne bağlanmıştır. İç sekme, görünür dock veya gizli peek için mevcut r699 ölçümünün ürettiği tek rezervi kullanır. Kartın ve kontrollerin doğal yüksekliği korunur; büyük bir sabit kart yüksekliği ya da yeni bir scroll kilidi getirilmez. Üst başlangıç payı güvenli alanla birlikte en az 12 px, kısa yatay görünümde en az 8 px'dir.

### Girişte kaydırma
Tefekküre açıkça girildiğinde önceki sayfanın kaydırma konumu başlangıcı yukarıda bırakabiliyordu. Yeni giriş yardımcısı yalnız açık girişte belgeyi başa alır. İki karelik yerleşme düzeltmesi daha yeni bir pointer, touch, wheel veya klavye hareketi algılarsa iptal edilir. Normal sayaç güncellemeleri, mod geçişleri veya arka plan olayları sayfayı başa almaz. Global scroll prototiplerine yeni müdahale eklenmedi.

### Sürüm etiketi ve Service Worker
r707 paketinin HTML meta etiketi r707 iken görünür footer r702, SW kayıt adresi de r704 olarak kalmıştı. Bunlar kaynak dosyanın içindeki gerçek uyumsuzluklardı; yalnız tarayıcı önbelleği sorunu değildi.

r708'de görünür etiket meta build değerinden üretilir. HTML meta, footer, gömülü ve harici sürüm geçmişi, manifest başlangıç/kısayol URL'leri, SW sürümü, SW kayıt adresi, cache adı ve yapı işaretçisi r708 ile eşitlendi. Önbellek adı `sukun-r708-20260907a` oldu. Mevcut SW'nin doğrulanmış yeni kabuğu kurma, bekleyen güncellemeyi kullanıcı onayıyla etkinleştirme ve yalnız uygulamaya ait eski cache adlarını temizleme politikası korunur. IndexedDB, kayıtlar veya localStorage silinmez.

## Doğrulama

| Denetim | Sonuç |
|---|---:|
| Mevcut kaynak regresyonları | 51/51 |
| r706 atmosfer davranış regresyonları | 15/15 |
| Tam HTML Chromium yerleşim ve etkileşim senaryoları | 32/32 |
| r707 kaynak bütünlüğü ve r708 yayın eşitlemesi | 8/8 |
| **Toplam** | **106/106** |

Tam HTML, Chromium'a `set_content` ile yüklenip gerçek uygulama scriptleri çalıştırıldı. Dış ağ kaynakları kapatıldı; aktif akış görünürlüğü ses başlatılmadan test durumu olarak kuruldu. 320×640, 390×844, 412×915, 640×360 ve 1280×900 boyutlarında Mini/Midi/Max sınırları, belge sonu kaydırması, giriş konumu ve gerçek çıkış düğmesi hit-test'i denetlendi. 390×844 boyutunda gizli peek ve geri açma ayrıca sınandı. Sayfanın sonunda kaydırma gereken senaryolarda kart–bar aralığı yaklaşık 12 px ölçüldü. Başlık artık girişte önceki scroll konumuyla yukarıda kalmıyor.

İlk gizli-bar testinde gerçek ses sahibi olmadan yalnız görünürlük sınıfları kurulduğundan uygulamanın normal sahiplik denetimi peek'i açmadı. Test düzeneği görsel bir test sahibiyle düzeltildi; kaynak kodu bu test için değiştirilmedi. Son koşu 32/32 geçmiştir. İlk CSS denemesinde eski seçici dış rezervi geri getiriyordu; özgüllük düzeltildikten sonra gerçek ölçümde dış rezerv 0 px oldu.

**Sınır:** Bu testler fiziksel Android, gerçek kullanıcı kayıtları, duyulan ses, kilit ekranı, kulaklık medya düğmeleri veya telefona dağıtılmış PWA üzerinde uçtan uca doğrulama değildir. Yerel HTTP/file navigasyonu ortamın yönetici politikasıyla engellendiği için tam HTML kontrollü tarayıcı belgesine yüklendi. Gerçek cihazda kalan sorunlar ayrıca raporlanmalıdır.

## Korunan işlevler ve kaynak denetimi

r706 neon duman/şua/yörünge atmosferi ve r707 dokunma CSS'i byte düzeyinde aynı kaldı. r707'nin 187 scriptinden 183'ü aynen korundu. Değişen dört mevcut script: sürüm geçmişi, SW kayıt istemcisi, Tefekkür girişinde tek çağrı ve yerleşim otoritesinde sürüm/kapsam sınıfı. İki yeni küçük script, giriş kaydırması ve görünür sürüm etiketini yönetir. Ses, sayaç, kayıt önceliği, 28/99 seyir, terkip, pause/resume/stop ve animasyon motorlarına müdahale edilmedi. Üç ikonun baytları da r707 ile aynıdır.

## Kurulum ve sürüm kontrolü

Tam paketteki `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, üç ikon ve `__sukun_build_r708__.json` aynı yayın dizinine birlikte yüklenmelidir. Dosyaları tek tek farklı sürümlerden karıştırmayın. Önce uygulamanın kendi yedekleme işleviyle kayıtlarınızı yedekleyin; tarayıcı verilerini silmeyin. Uygulama güncelleme bildiriminde yeni sürümü etkinleştirin; ardından sayfayı yeniden açıp footer ve tanı build değerinin r708 olduğunu kontrol edin. Gerekirse `nero.html?v=r708` adresiyle sunucudan yeni HTML istenebilir. Buradan canlı GitHub yayınına dosya yüklenmedi; paket yerel olarak hazırlanmıştır.

`diagnostics` içinde mevcut testler, yeni tam HTML testi, sonuç JSON'ları, kaynak bütünlüğü testi, 707 kaynak geçmişi ve ekran doğrulama görüntüsü bulunur. `CHECKSUMS_r708.sha256` arşivdeki dosyaları doğrular. r707 raporu ve yapı işaretçisi geçmiş klasöründe saklanmıştır.
