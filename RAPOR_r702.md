# SÜKÛN r702 — hata düzeltme sürümü

Tarih: 7 Eylül 2026. Taban: kullanıcının gönderdiği `SUKUN_r701_TAM_PAKET.zip`.

r702, yalnız sürüm etiketi değişikliği değildir. Tefekkür, ortak ses kontrolü, otomatik zikir, sözlü kuyruk ve çevrimdışı paket akışında doğrulanan hatalar mevcut modüllerde düzeltildi. Yeni bir paralel ses motoru, ikinci yerleşim yöneticisi veya sürekli çalışan test döngüsü eklenmedi.

## Düzeltilen davranışlar

| Alan | r701'deki sorun | r702 davranışı |
|---|---|---|
| Arayüz yükü | 28 İsim başlat düğmesinin aynı metni yeniden yazması, DOM gözlemcisini tekrar tetikliyordu. | Metin yalnız değiştiğinde yazılır; aynı gözlemci turundaki çift eşitleme kaldırıldı. Akış barının aynı canlı durum ve oynatma metinlerini yeniden yazması da önlendi. |
| Tefekkür girişi | Kayıt veritabanının yanıtı bekleniyor, duraklatılmış konuşma görünüm geçişinde sürdürülebiliyordu. | Görünüm hemen açılır; kayıt anahtarları arka planda tek işlemle yenilenir. Giriş ses başlatmaz. Kayıt → TTS önceliğini mevcut çözümleyici yönetir. |
| Tefekkür çıkışı | Eski giriş düğmesi yokken Escape ve tam ekran dinleyicileri kurulmadan çıkılıyordu. Çıkıştan sonra gecikmiş sayaç odağı çalışabiliyordu. | Dinleyiciler eski düğmeden bağımsız kurulur; gecikmiş odak iptal edilir. Başka bir bileşenin açtığı tam ekran sahiplenilmez. Açık pencerenin tükettiği Escape yeniden işlenmez. |
| Tekil zikir duraklatma | Akış barındaki Duraklat, doğrudan otomatik zikir Stop işlevini çağırıyordu. Devam, yakalanmış miks yerine yeni başlangıca gidebiliyordu. | Barın Duraklat/Devam eylemleri ortak pause/resume üzerinden aynı oturumları yönetir. Ana sayacın Durdur eylemi korunur. |
| 28/99 seyir ve kuyruk | Genel duraklatmada boşalan sözlü sahiplik, sıradaki tekil/terkip işini başlatabiliyordu. | Duraklatma kapısı açıkken kuyruk ilerlemez; Devam sonrasında mevcut FIFO ve aynı kimliği birleştirme davranışı korunur. Seyir sırasında bağımsız otomatik zikir başlatılmaz. |
| Medya tuşları | Gizli ekrandaki ilk duraklatma komutu bastırılıyordu. Yerel kilit sesi sürdürülünce genel duraklatma durumu temizlenmeden dönülebiliyordu. | İlk MediaSession pause komutu uygulanır; tekrarlanan pause aynı oturumu tekrar duraklatmaz. Medya Play, genel duraklatma durumunu da çözer. |
| Tümünü Durdur | Seyir dışındaki okuyucuların kendi Stop temizliği çağrılmıyor, mantıksal paused işaretleri kalabiliyordu. | Her etkin okuyucunun temizliği çağrılır, ardından fiziksel miks durdurulur. Geciken eski Stop tamamlanması yeni Play sahibini silemez. Asenkron temizleme hatası sonuçta bildirilir. |
| Başlatma hatası | İlk okuma hatası otomatik zikir başlatma kilidini açık bırakabiliyordu. Hızlı Durdur başlangıç filtresine takılıyordu. | Hatalı başlangıç temizlenir ve yeniden denenebilir. Etkin akışın hızlı Durdur/Duraklat komutu başlangıç filtresinde yutulmaz. |
| Seans belleği | Geri yüklenen otomatik seans, çıkış veya gezinme dahil herhangi bir dokunuşta ses başlatabiliyordu. | İlerleme geri yüklenir; ses ancak normal oynatma kontrolü üzerinden başlar. Çıkış sesi başlatmaz. |
| Tefekkür yerleşimi | Barın yukarı sürüklenmesi okuma alanını daraltabiliyor; klavye açıkken alt sınır yanlış ekrana göre hesaplanıyordu. | Mini/Midi/Max ve sürükleme sınırları okuma alanı ayırır. Okuma alanının alt sınırı sürükleme sırasında güncellenir ve görsel ekran ofsetini içerir. |
| Sürüm/çevrimdışı açılış | HTML manifest bağlantısı r700, sayfa r701; üst başlık r632 idi. Sorgu içeren manifest çevrimdışı önbelleğe eşleşmiyordu. | Başlık, HTML, manifest, SW ve yapı işaretçisi r702 ile eşleşir. Paket varlıkları mevcut sürüm önbelleğinden bulunur; başka sürüme ait manifest kurulumu reddedilir. |

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Karşılaştırmalı kaynak regresyonları | **r702: 31/31 geçti. r701: 7/31 geçti; 24 senaryoda sorun yeniden üretildi.** Bu sayılar ayrı hata adedi değildir. |
| JavaScript sözdizimi | 183 çalıştırılabilir satır içi betik ve `sw.js` başarıyla derlendi. |
| Statik DOM | 959 kimlik kontrol edildi; yinelenen kimlik yok. |
| Stil ve içerik korunumu | 148 stil bloğu r701 ile aynı; yerleşim düzeltmesi mevcut geometri yöneticisindedir. İkon dosyaları değişmedi. |
| Dar/yatay/geniş ekran sınır hesabı | 320×640, 390×844, 360×740, 640×360 ve 1280×900 için izole geometri kontrolleri geçti. Bunlar gerçek tarayıcı çizimi değildir. |
| Çevrimdışı paket | Sürümlü manifest, eski önbellek ayrımı ve karışık HTML/manifest reddi izole CacheStorage testlerinde geçti. |
| Canlı tarayıcı | r701'de zikir → Tefekkür → sayaç başlatma görüldü. Sonraki etkileşimde tarayıcı bağlantısı zaman aşımına uğradı; r702 uçtan uca görsel kontrolü tamamlanamadı. Bu, uygulamanın donduğuna tek başına kanıt sayılmadı. |
| Gerçek cihaz sesi | Android/Samsung Browser, ekran kilidi, kulaklık, mikrofon, kişisel ses kayıtları ve uzun süreli çalma bu ortamda fiziksel cihaz üzerinde doğrulanmadı. |

Kaynak testleri gerçek modül kodlarını izole Node VM ortamlarında çalıştırır. DOM, taşıma sağlayıcıları, zamanlayıcı ve önbellek için küçük test taklitleri kullanılır. Dolayısıyla 31/31 sonucu gerçek cihaz sesinin veya bütün ekran yerleşimlerinin kusursuz olduğuna dair garanti değildir.

## Paketi kullanma

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, üç ikon ve `__sukun_build_r702__.json` aynı dizinde tutulmalıdır. Mevcut kurulumun aynı adres ve dizinindeki uygulama dosyalarını r702 dosyalarıyla güncelleyin. PWA/Service Worker için HTTPS veya localhost gerekir. Uygulama güncelleme sunduğunda yenileyin; görünen sürüm r702 olmalıdır. Kayıt veritabanı adları ve uygulama kimliği değiştirilmedi.

Paket kökünde Node.js ile testler yeniden çalıştırılabilir:

```sh
node diagnostics/test_r702.cjs .
```

r701 klasörü de varsa aynı karşılaştırma:

```sh
node diagnostics/test_r702.cjs . /r701-klasorunun/tam/yolu
```

`diagnostics/r702_regression_results.json` test sonuçlarını, `diagnostics/r702_static_audit.json` kaynak bütünlüğünü, `diagnostics/r702_changes.diff` değişiklikleri içerir. Önceki sürüm raporları `diagnostics/history/r701_package/` altında saklanmıştır; onlar r702 test sonucu değildir. `CHECKSUMS_r702.sha256` bu paketin dosyalarını doğrular.

Gerçek cihazda kalan kontrol: kendi kayıtlı ve kayıtsız tekil zikir; 28/99 seyir; terkip kuyruğu; ilk basışta Duraklat → Devam → Durdur; ekran kilidinde isim geçişi; kulaklık tuşu; Tefekkürde Mini/Midi/Max ve sürükleme; bildirimi kapatıp Tefekkürden çıkış. Bu kontroller tamamlanmadan “bütün cihaz hataları bitti” sonucu çıkarılmamalıdır.
