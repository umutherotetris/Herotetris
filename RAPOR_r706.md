# SÜKÛN r706 — Canlı Neon Atmosfer ve Yerleşim Kararlılığı

Taban: kullanıcının sağladığı `SUKUN_r705_TAM_PAKET.zip`. Tarih: 7 Eylül 2026.

## Uygulanan tasarım

Onaylanan canlı atmosfer, Tefekkürün mevcut `tfRefinedLayout`, `zCountVisual`, gerçek isim başlığı ve gerçek kontrol düğmeleri üzerinde uygulandı. Mor, mavi ve zümrüt duman kıvrımları; ışık şuaları, kemer derinliği, inci yörüngeleri ve sayaç değişiminde dışarı yayılan bir ışık dalgası eklendi. Önizlemedeki örnek sayaç veya örnek ses durumu uygulamaya taşınmadı. Esmâ ve Berhetiyye kimliği mevcut kaynaklardan okunmaya devam eder.

Portrede halka merkezde, Hedef ve Kalan bilgileri halka altında; mevcut sayma, önceki/sonraki, baştan başlatma, ses kaynağı ve çıkış kontrolleri aynı kanonik sahiplerinde kalır. Kısa yatay ekranın r705 iki sütunlu düzeni korunur. Akış barının Mini/Midi/Max, duraklat/devam ve durdur düğmeleri gerçek transporta bağlıdır. Dokunma hedefleri en az 44 px olacak şekilde stil kuralları korunmuştur; bu ölçüler bu ortamda tarayıcıdan yeniden ölçülemedi.

Tefekkür üstündeki **Canlı / Sabit** düğmesi görsel hareketi yönetir. **Max** görünümünde üst satırda **Ambiyans** yoğunluk kaydırıcısı açılır. Kısa yatay ekranda bu kaydırıcı ek yer kaplamaması için gizlenir; Canlı/Sabit düğmesi kalır. Görsel tercihler yerel olarak saklanır. Sistem azaltılmış hareket veya uygulama pil profili etkinken hareket zorla açılmaz.

## Kaynakta doğrulanan ve düzeltilen sorunlar

1. **Gereksiz Tefekkür ölçümleri:** Gövdenin ilgisiz sınıf değişiklikleri, Tefekkür durumunda değişiklik olmasa da yeniden ölçüm ve performans yazımı planlıyordu. Abone artık gerçek Tefekkür giriş/çıkışını izler. Boyut değişimleri mevcut ResizeObserver ve pencere olaylarından gelir.
2. **Dock boyutlarının silinip tekrar yazılması:** Her yerleşim hesabı öncesinde, aynı otoritenin halen kullandığı yükseklikler eski ayar sanılarak kaldırılıyordu. Güncel boyutlar korunur; yalnız emekli ayarlar temizlenir. Değişmeyen stil değeri/önceliği tekrar yazılmaz. Tarayıcı prototiplerine müdahale edilmez.
3. **Arka planda gereksiz yerleşim planlama:** Gizli sayfada yeni dock yerleşim kareleri planlanmaz; görünür dönüşte mevcut olayla yeniden hesaplanır.
4. **Geçici düşük performans profilinin takılı kalması:** Uzun görevlerden sonra etkinleşen geçici pil profili, başka bir olay gelmezse süre dolduğunda kendini yenilemiyordu. Süre sonu için tek bir yeniden değerlendirme zamanlayıcısı eklendi. Kullanıcının kalıcı pil tercihi korunur.
5. **Değişmeyen DOM öznitelikleri:** Kanonik sahiplik, ekran profili ve etkin performans profili değişmeden yeniden yazılmaz.

Bu bulgular gereksiz iş ve olası takılma kaynaklarını azaltır. Android'deki bildirilen bütün kilitlenmelerin bunlardan kaynaklandığı veya tamamen giderildiği kanıtlanmış değildir.

## Yeni görsellerin çalışma bütçesi

- Canvas ve duman dokuları ilk Tefekkür girişinde bir kez oluşturulur; tekrar girişte çoğalmaz.
- Normal çizim sınırı 20 FPS'dir. Ardışık pahalı çizimlerde 10 FPS'ye iner ve daha sonra yeniden değerlendirilir. Bunlar kodda uygulanan sınırlardır; gerçek telefonda performans ölçümü değildir.
- Cihaz piksel oranı en fazla 1,25; çizim alanı boyutları en fazla 1200 × 1200 CSS piksel ile sınırlıdır.
- Görünmez sayfa, ekran dışı yüzey, Tefekkürden çıkış, açık detay/bildirim katmanı, azaltılmış hareket ve pil profili görsel döngüyü durdurur.
- Dekoratif katmanlar `pointer-events:none` ve `aria-hidden` kullanır. Sayaca veya ses oturumuna komut göndermezler; ses motoru veya yeni bir AudioContext oluşturmazlar.
- Mevcut ses/seyir motorları yeniden yazılmadı; 28/99 seyir, kayıt önceliği, kuyruk, duraklat/devam/durdur ve kilit ekranı regresyon sözleşmeleri kaynak testlerinden geçirildi.

## Doğrulama

| Kontrol | Sonuç |
|---|---|
| Mevcut kaynak regresyonları | 51/51 geçti |
| r706 ek davranış testleri | 15/15 geçti |
| Çalıştırılabilir satır içi betikler ve Service Worker sözdizimi | Geçti; mevcut 51 test içinde |
| HTML / manifest / SW / build işaretçisi / sürüm geçmişi uyumu | Geçti; mevcut 51 test içinde |
| Tek atmosfer ve tek sayaç gözlemcisiyle 10 çıkış/giriş | Geçti; izole VM |
| Gizlenme, ekran dışı durum, pil ve azaltılmış hareket | Geçti; izole VM |
| Canvas bağlamı bulunamazsa sabit dekor ve mevcut kontroller | Geçti; izole VM |

Testler Node VM ortamında kontrollü DOM, zamanlayıcı ve transport taklitleri kullanır. Gerçek CSS yerleşimi, fiziksel dokunma, duyulan ses veya Android donanım testi değildir. Yeni testlerin r705 üzerinde çalıştırıldığı negatif karşılaştırma da eklenmiştir: yeni özelliklerin yokluğundan kaynaklanan beklenen başarısızlıklar dahil olduğundan toplam başarısızlık sayısı r705'teki bug sayısı olarak yorumlanmamalıdır.

Canlı tarayıcı kontrolü denenmiştir. Yerel HTTP açılışı `ERR_BLOCKED_BY_CLIENT`, paylaşılan yerel dosyanın açılması ise tarayıcı URL güvenlik politikası tarafından engellenmiştir. Bu engel aşılmaya çalışılmadı. r706 için yeni tarayıcı ekran görüntüsü, gerçek dokunma ölçümü veya açılış CPU ölçümü üretilemedi. Paket içindeki önceki sürüm ekran görüntüleri ve tarayıcı raporları tarihî kanıttır; r706 doğrulaması değildir.

## Telefon üzerinde kalan kontrol

1. Tefekküre gir/çık; Mini/Midi/Max arasında geç; alt kontrolleri kaydırarak eriş ve çıkışın çalıştığını kontrol et.
2. Kendi kaydınla tekil zikir ve 28/99 seyir başlat. Akış barından duraklat, devam et ve bir kez durdur; ritim dahil tüm seslerin durduğunu kontrol et.
3. Ekranı kilitleyip isim geçişlerini ve kulaklık komutlarını dene. Kilit açılınca kullanıcı tarafından duraklatılan oturumun kendiliğinden başlamadığını kontrol et.
4. Yeni atmosferle takılma olursa Canlı/Sabit'i karşılaştır ve uygulamanın tanı raporunu al. Kayıtları veya site verilerini silmek gerekmez.

## Paket ve kurulum

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, üç ikon ve `__sukun_build_r706__.json` aynı dizine birlikte yüklenmelidir. Eski SW ile yeni HTML'yi karıştırmamak için paketin tamamını kullanın. Bu çalışma mevcut sunucuya dağıtım yapmamıştır.

Tekrar çalıştırma:

```sh
node diagnostics/test_r705.cjs .
node diagnostics/test_r706.cjs .
sha256sum -c CHECKSUMS_r706.sha256
```

`diagnostics/r706_existing_regressions.json` ve `diagnostics/r706_behavior_results.json` yeni sonuçları; `diagnostics/r706_changes.diff` r705 tabanından değişiklikleri içerir. Önceki rapor ve ölçümler `diagnostics/history/` altında tutulur.
