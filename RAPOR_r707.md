# SÜKÛN r707 — Kaydırma ve Dokunma Kararlılığı

**Tarih:** 7 Eylül 2026  
**Temel:** Kullanıcının sağladığı `SUKUN_r706_TAM_PAKET.zip`  
**Kapsam:** 706 atmosferinin korunması, kaydırma ve hit-test otoritesinin onarılması. Bu bir tasarım değişimi veya ses motoru yeniden yazımı değildir.

## Yapılan düzeltmeler

1. **Tefekkür kaydırması:** Sabit gövde/sekme yüksekliği ve taşma kilitleri kaldırıldı. Belge doğal olarak uzayabilir; alt içerik için oyuncu yüksekliğine göre güvenli alan ayrılır. Kartların ve kontrollerin üst üste binmesine yol açan eski yükseklik kurallarına karşı son CSS otoritesi eklendi.
2. **Mini/Midi/Max:** Dock yüksekliği gerçek içerik sınırlarıyla ölçülür. Kaydırılabilirlik tahmini yükseklik yerine `scrollHeight > clientHeight` üzerinden belirlenir. Mod değişimi artık kaydırmayı sıfırlamaz; tarayıcının otomatik anchoring kaydırması gerektiğinde önceki konum, yeni sınırlar içinde korunur.
3. **Max içerik taşması:** Eski grid ve sabit 36 piksel aksiyon satırı kuralları düzeltildi. İçerik ölçümü sırasında doğal yükseklik, normal kullanımda ise sınırlı iç kaydırma uygulanır. Dokunma hedefleri en az 44 piksel olacak biçimde korunur.
4. **Tıklama ve modal sahipliği:** Dekoratif atmosfer katmanları dokunmaları yakalamaz. Kapalı modal/backdrop etkileşime girmez; açık detay ve bildirim yüzeyleri kendi içinde kaydırılabilir. Bildirim çekmecesi kapanırken önceden mevcut olan `inert` ve `aria-hidden` durumu geri yüklenir; kapanmış tetikleyiciye odak zorlanmaz.
5. **Tefekkürden Çık:** Önceki CSS otoritesinin gizleyebildiği çıkış satırı, Tefekkür düzeninde açıkça görünür kılındı. Açma, kapama ve çıkış hit-testleri izole tarayıcı testlerinde doğrulandı.
6. **Frekans kontrolü:** Taşıyıcı frekans düğmesinin pencere genelindeki mouse/touchmove dinleyicileri kaldırılarak yalnız ilgili düğmeye ait pointer capture kullanıldı. Pointer cancel/up temizliği ile dokunma sahipliği sınırlandı.
7. **Kaydırma koruması:** Açıkça istenen navigasyon ve yeni kullanıcı hareketi, arka plan kaydırma bastırmasından öncelikli hâle getirildi. Gecikmiş konum geri yüklemesi yeni bir kullanıcı kaydırmasını geri alamaz.

## Korunan işlevler

706'nın mor–mavi–zümrüt neon atmosferi, duman/şua animasyonları, sayaç ve seyir verileri, mevcut ses oturumu ve kayıt önceliği, 28/99 seyirleri, TTS, terkipler, duraklatma/durdurma motorları ve diğer uygulama modülleri korunmuştur. Kaynak parmak izi testi, yalnız hedeflenen modüller ile sürüm notlarının değiştiğini; çekirdek modülün taşıyıcı düğme bölümü dışındaki kodunun aynı kaldığını doğrular. Önceki ses sorunlarının tamamının fiziksel cihazda giderildiği iddia edilmez.

## Doğrulama

| Kontrol | Sonuç |
|---|---:|
| Mevcut kaynak regresyonları | 51 / 51 geçti |
| 706 atmosfer davranış testleri | 15 / 15 geçti |
| 707 odaklı kaynak ve modül karşılaştırmaları | 8 / 8 geçti |
| İzole Chromium yerleşim/hit-test testleri | 16 / 16 geçti |
| **Toplam** | **90 / 90 geçti** |

İzole Chromium testleri, uygulamanın gerçek CSS kuralları ve yerleşim çalışma zamanı ile kontrollü DOM üzerinde 320×640, 390×844, 640×360 ve 1280×900 boyutlarında çalıştırıldı. Belge/dock kaydırması, mod geçişinde konumun korunması, çıkış düğmesi ve modal aç/kapat davranışları denetlendi. Bunlar tam uygulamanın uçtan uca testi değildir.

**Sınır:** Tam uygulamanın yerel HTTP üzerinden Chromium'a açılması bu çalışma ortamının yönetici politikası nedeniyle engellendi. Bu engel aşılmadı. Fiziksel Android, WebView/PWA, gerçek dokunma, kulaklık/medya tuşları, kilit ekranında ses ve sayaç ilerlemesi veya duyulan ses kalitesi doğrulanmış değildir. Kaynak testlerinin geçmesi, bu cihaz senaryolarının kesin çözüldüğü anlamına gelmez.

## Paket ve kurulum

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, ikonlar ve r707 yapı işaretçisi aynı dizine aittir. HTML/manifest/SW sürümleri r707'ye eşitlenmiştir. Önceki sürüm raporları ve checksum dosyaları geçmiş klasöründe tutulmuştur. `CHECKSUMS_r707.sha256` aktif paketin dosya bütünlüğünü doğrular.

Tam paketi aynı yayın dizinine birlikte yükleyin. Önce mevcut kullanıcı kayıtlarını yedekleyin; tarayıcı verilerini, IndexedDB'yi veya yerel kayıtları silmeyin. Mevcut PWA'nın güncelleme mekanizmasıyla yeni Service Worker'ın etkinleşmesini bekleyip sürümün r707 olduğunu doğrulayın. Sunucuya dağıtım yapılmadı. Android üzerinde özellikle Tefekkürde uzun kaydırma, Mini→Midi→Max, açık bildirimden çıkış, iki ses kaynağı arasında geçiş, pause/resume/stop ve kilit ekranı seyir geçişleri ayrıca denenmelidir.

## Denetim dosyaları

`diagnostics/test_r707.cjs`, `diagnostics/test_layout_r707.py`, ilgili sonuç JSON'ları, `r707_changes.diff`, değiştirilen modül kopyaları, CSS otoritesi ve `r706_source_fingerprints.json` pakete eklenmiştir. Parmak izleri özgün r706 arşivinden türetilmiştir; kişisel kullanıcı verileri paketlenmemiştir.
