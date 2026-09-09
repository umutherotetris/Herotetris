# SÜKÛN r738 — Sıkı ses, erişim ve paket bütünlüğü taraması

**Temel:** r737 · **Tarih:** 9 Eylül 2026 · **Kapsam:** kaynak ve izole testler, gerçek Chromium medya/yerleşim kontrolleri. Fiziksel Android testi değildir.

## 1. Başlangıçta yeniden üretilen bulgular
- r737 kaynak regresyonu doğru paket köküyle çalıştırıldığında 30/31 geçti. `surumler.json` hâlâ r734 ile başlıyordu. Raporlanan HTML SHA-256 da gerçek r737 HTML'siyle uyuşmuyordu. Eski klasörlerden parametresiz çalıştırılan bazı testler yanlış dosya yoluna bakmıştı; önceki sonuçlar bu nedenle yeni sürümün doğrulaması sayılamaz.
- Yeni yedi transport senaryosunun beşi r737'de başarısızdı. Stop → Play → Stop → Play dizisinde ikinci Play, iptal edilmiş ilk `pendingStart` tarafından yutulabiliyordu. `stopAll()` false dönse veya bağımsız `direct.stop()` asenkron bitse bile yeni ses erken açılabiliyordu. Aktif seyir sahipliği ve çift tıklama senaryoları da denetlendi.
- Görünür footer tanı düğmesi kaynakta hâlâ duruyordu. Sürüm notları, 5 dokunuş/uzun basma, Ctrl+Shift+D/O ve gelişmiş araç menüsünde ek tanı girişleri vardı. r737 yüzük yaması eski 7 dokunuş dinleyicisinin üzerine ikinci bir sahip ekliyordu.

## 2. Uygulanan düzeltmeler
### Ses ve sayaç
- `pendingStart` artık kullanıcı niyet nesline bağlıdır. Yeni Stop eski niyeti iptal eder; sonraki Play yeni niyet olarak kabul edilir. Aynı bekleyen niyetin tekrar basılması ikinci bir oturum açmaz.
- Registry `stopAll()` ve bağımsız `direct.stop()` sonuçları aynı asenkron temizlik bariyerinde beklenir. False/rejection başarıya çevrilmez. Temizlik başarısızsa yeni ses açılmaz; durum tanıya kaydedilir ve kullanıcı yeni bir temizleme denemesi yapabilir. Başarısız bir temizliği zorla başarılı sayan zaman aşımı eklenmedi.
- Pause/Resume, 28/99 seyir API'leri, kayıt önceliği, geçici sayaç hakkı ve doğrulanmış hedef geçişi korunur. Kaydı silme, sayacı sıfırlama veya kalıcı veri migrasyonu yapılmadı.

### Tanı erişimi
- Gerçek footer düğmesi, dashboard tanı düğmesi, sürüm notlarındaki tanı düğmesi ve gelişmiş araç menüsündeki doğrudan giriş kaldırıldı. Eski sürüm uzun basma/5 dokunuş ve geliştirici klavye kısayolları emekli edildi.
- Tek yüzük jest sahibi kuruldu: 7 dokunuştan sonra 1100 ms içinde devam edilmezse mevcut şifreli kasa açılır; 9 dokunuş doğrudan tam tanıyı açar. Klavye aktivasyonu bir kez sayılır. Tanı kapatılınca erişim durumu bırakılır.
- Tam tanı ve basit tanı girişleri açılıştan önce aynı yetki durumunu denetler. Normal kullanıcıya açık arama, kayıt, günlük/yedekleme, tüm sesleri durdurma ve ses kurtarma işlevleri korunur. Gizli jest bir güvenlik doğrulaması değildir; uygulama koduna erişen kişiye karşı koruma sağlamaz.

## 3. Doğrulama sonuçları
- Kaynak/Service Worker regresyonu: **31/31**.
- Mini oynatıcı: **5/5**.
- Önceki yeniden başlatma testleri: **10/10**.
- Başarısız ses/sayaç/seyir testleri: **8/8**.
- Yeni asenkron temizlik ve son niyet yarış testleri: **7/7** (r737 başlangıcı 2/7).
- Yüzük/klavye/kasa/gizli erişim kaynak testleri: **6/6**.
- Gerçek Chromium HTMLMediaElement ve sentetik WAV ile kayıt yolu, Stop → Play, sayaç, günlük ve rozet kontrolleri: **5/5**. IndexedDB okuma katmanı sentetik dosyayla değiştirilmiştir.
- Tam tanı aç/kapat Chromium smoke: **geçti**; açılış 162 ms, kapatınca scroll kilidi geri bırakıldı. Güvenli/Derin Test kendiliğinden başlatılmadı.
- 428×926 Mini/Midi/Max yerleşim kontrolleri: **3/3**, ek sayfa-hatası kontrolü geçti. 320/390 eski yerleşim testleri yeniden çalıştırıldı; çoklu çalıştırma süre sınırında kesildiği için tamamı ayrı bir yeni sonuç olarak sayılmadı.

## 4. Sınırlar ve riskler
Gerçek Android'de kullanıcının IndexedDB kaydı, TTS motoru, kilit ekranı, kulaklık ve uzun süreli 28/99 seyirleri bu ortamda doğrulanamaz. Özellikle işletim sisteminin askıya aldığı veya hiç sonuçlandırmadığı bir ses temizliği için fiziksel cihaz kanıtı gerekir. Bu sürümde başarısız temizlik otomatik olarak başarılı sayılmaz; gerçek sesin duyulduğu da yalnız `start()` kabulünden çıkarılmaz. Tam bir cihaz garantisi verilmez.

## 5. Paket bütünlüğü
Manifest ID/scope ve mevcut kullanıcı veri anahtarları korunmuştur. HTML, manifest, SW, cache adı, build marker ve sürüm geçmişi r738 ile eşitlenmiştir. Gerçek HTML hash'i yeniden hesaplandı. ZIP CRC ve dosya SHA-256 doğrulaması yapılmıştır. Paket, kullanıcının kişisel kayıtlarını veya tanı yüklemelerini içermez. Önceki r737 paketi ayrı geri dönüş noktası olarak korunur.
