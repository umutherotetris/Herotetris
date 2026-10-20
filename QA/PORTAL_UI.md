# Hero Portal 138 — premium tasarım ve portal düzeltmeleri

Ana sayfa koyu grafit, şampanya tonları ve Manrope tipografisiyle yeniden tasarlandı. Oyun koleksiyonu, oyuncu ilerlemesi ve beş portal sekmesi aynı görsel sistemi kullanır. Beş özgün SVG çizimi haricî medya olmadan çalışır. Türkçe karakterli Manrope fontları ve sürümü sabit PeerJS 1.5.4 yerel olarak sunulur; OFL ve MIT lisansları ilgili klasörlerdedir.

## Görünüm ve kullanım

- Dört oyun kartı gerçek düğmedir; mobilde iki, masaüstünde dört sütun kullanır.
- Mobil kahraman görseli korunur, temel eylem oyun koleksiyonuna gider. Yan sekmelerden `#games` bağlantısı da doğru ana ekranı açar.
- Profil, liderlik, arkadaş ve bildirim başlıkları içerikle hizalanır. Ayarlar ve portal pencereleri aynı yüzey/renk sistemini kullanır.
- Klavye odağı, atlama bağlantısı, görünür aktif menü, azaltılmış hareket tercihi ve büyütme korunur.
- Liderliğin Kaju bakiyesine göre ilk 20 oyuncuyu gösterdiği açıkça belirtilir.

## Düzeltilen davranışlar

- Konuşma değişiminde eski mesaj/okundu/yazıyor dinleyicileri kapatılır. Gecikmiş kişi yanıtı yeni konuşmayı değiştiremez.
- Gönderim boyunca alıcı sabit tutulur; konuşma değişse bile bildirim doğru kişiye gider. Başarısız gönderimde taslak korunur.
- Sosyal panelin hızlı kapat/aç geçişi yeniden açılan paneli gizleyemez. Profil güncellemeleri aynı hesabın açık konuşmasını koparmaz.
- Kaju alıcısı yalnız tam isim eşleşmesi veya açık öneri seçimiyle belirlenir; tek kısmi sonuç otomatik alıcı olmaz.
- Giriş, isim ve transfer hataları formları kalıcı olarak kilitlemez. Öneriler güvenli, klavyeyle kullanılabilen DOM düğmeleridir.
- Profil arka planı varsayılana dönünce eski Matrix çizimi temizlenir. Avatar/kozmetik ve mesaj verileri uygun biçimde doğrulanır/kaçışlanır.
- Tekrarlanan arayüz başlangıcı çift abonelik oluşturmaz. Aynı oyun yüklenirken ikinci yükleme başlatılmaz; asenkron açılış hataları yakalanır.
- Teknik hata ayrıntıları konsolda kalır; kullanıcıya yeniden deneme bilgisi gösterilir. Uzayan başlangıç bağlantısı görünür kurtarma sunar.
- Liderlik ve arkadaş profilleri klavyeyle açılabilir; liderlik boş/hata durumunda yeniden yüklenebilir.
- Normal önbellek temizliği yalnız bu projenin `hero-portal:<scope pathname>:` alanını siler. Tema, oturum, IndexedDB ve diğer uygulamaların verileri korunur. Tam sıfırlama da tüm origin depolarını silmez.

## Worker ve yayın

`sw.js` Hero Portal 138 worker'ıdır. Yalnız gerçek Hero ana sayfası için doğrulanmış çevrimdışı kabuk sunar. Diğer sayfalara veya eksik JavaScript dosyalarına yanlış HTML dönmez. Görseller, yerel fontlar ve kabuğun kullandığı tam gezinme adresi önceden alınır.

`hero-recover.html` eski r820 SÜKÛN worker kontrolünü yalnız birebir proje kaydı için yeniler. Gerçek `HERO_PONG` yanıtı alınmadan ana sayfaya yönlenmez. Bu geçiş sayfasının `sukun-build` etiketi yalnız tarihî worker uyumluluğu içindir; ürün sürümü değildir. Oyuncu kayıtları ve diğer uygulamaların önbellekleri silinmez.

## Doğrulama

Playwright kurulu ortamda:

```sh
node QA/portal-ui.cjs
node QA/portal-flows.cjs
node QA/portal-forms.cjs
node QA/portal-worker.cjs
```

`PORTAL_CHROMIUM` isteğe bağlı Chromium yürütülebilir dosyasını belirtir. `PORTAL_SCREENSHOTS` mevcut bir ekran görüntüsü klasörü belirtir.

- UI: 320, 390, 600, 768, 1024, 1440px genişliklerinde beş sekme; kart taşmaları; klavye/odak; gerçek dört oyun giriş modülü; skor ve XP; sekiz tema/ayar; arayüz boyutu; yerel font/çizim/PeerJS ve bağlantı hataları.
- Sosyal akış: eski dinleyiciler, gecikmiş kişi okuması, aynı hesabın profil güncellemesi, güvenli avatar/kozmetik, başarısız gönderim, sabit alıcı ve hızlı kapat/aç yarışları.
- Formlar: çift abonelik, tam alıcı eşleşmesi, isim ve transfer ağ hataları, güvenli öneriler, arka plan sıfırlama ve proje kapsamındaki önbellek temizliğinde veri koruma.
- Worker: gerçek tarihî r820 dosyasıyla yanlış SÜKÛN ekranı yeniden üretilir; gerçek HTTP/Chromium üzerinde geçiş, worker yanıtı, çevrimdışı kabuk/gezinme, eksik dosyalar ve depolama koruması doğrulanır.

Hesap ve veritabanı testleri bellek içi örnekler kullanır; gerçek hesaba yazılmaz. Canlı Google girişinin, gerçek oyuncular arası çevrimiçi eşleşmenin ve fiziksel Android cihazın uçtan uca doğrulandığı iddia edilmez. Oyun giriş modülleri gerçektir; tüm oyun motoru kurallarının eksiksiz sınanması bu portal güncellemesinin kapsamı değildir.
