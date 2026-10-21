# Hero Portal 140 — Fildişi Kulüp

Seçilen 3. mockup uygulandı. Sıcak krem zemin, orman yeşili eylemler, bronz çizgiler ve serif başlıklar; ana sayfa, profil, liderlik, arkadaşlar, bildirimler ve ayarlar ortak açık tema kullanır. Oyun kartlarının özgün SVG çizimleri yeşil/fildişi paletine uyarlandı. Oyun motorlarının koyu kontrolleri kendi okunabilir renklerini korur.

Varsayılan ve eski varsayılan Hero teması bir kez Fildişi Kulüp'e geçer. Önceden açıkça seçilmiş diğer temalar korunur. Ayarlardan 9 tema seçilebilir; sonradan seçilen Hero koyu teması da yeniden yüklemede korunur.

`assets/ivory-club-hero.webp` 1536×1024, 115.878 bayttır. Yerel dosya ve `css/ivory.css` worker 140'ın çevrimdışı listesine eklendi. PWA simgesi, tema rengi ve kurtarma sayfası güncellendi.

Doğrulama: 6 genişlikte 5 sekme, 9 tema, 4 gerçek oyun giriş modülü, %80/%130/%100 ölçek, klavye, azaltılmış hareket, bağlantı hatası, form ve önbellek koruma testleri; gerçek HTTP üzerinde eski worker geçişi ve çevrimdışı kabuk. Mobil/masaüstü ve ayarlar ekran görüntüleri gözle incelendi. Hesap/veritabanı testleri bellek içi verilerle yapılır; canlı Google/Firebase izinleri ve gerçek oyuncular arası maç doğrulanmış değildir.

Görsel, yerleşik image_gen ile yeni üretildi; PNG çıktısı web yayını için WebP olarak sıkıştırıldı. Üretim istemi:

> Create a premium website hero background illustration, landscape 3:2, no text, no letters, no logos, no UI. High-end photorealistic art direction for an ivory and forest green boutique games club. Warm sunlit ivory limestone room with a tall softly blurred arched window at right, gentle olive plant shadow, polished cream stone tabletop. RIGHT half composition: large beautifully sculpted ivory chess knight in foreground with small bronze inlay at base, one dark forest green glazed chess pawn behind, small walnut backgammon board edge and ivory dice on the tabletop, a compact subtle stack of green and beige stone Tetris blocks near lower right. Elegant architectural still life, warm bronze details, luxury club atmosphere, subtle film grain, tactile marble and ceramic, exquisite restrained editorial styling, realistic light and shadows, no gold glitter, no neon, no fantasy sparks. LEFT 45% is largely empty warm ivory plaster and softly lit tabletop with very low detail so dark green HTML heading can be overlaid legibly. Objects all concentrated right, room visible, no cropped knight, careful generous composition. Color palette ivory #f4efe4, forest green #173d31, warm bronze #987342.

---

# Hero Portal 139 — oturum ve ödül regresyon taraması

138 tasarımı korunur; üç alternatif görünüm sohbet içinde konsept mockup olarak sunulmuştur. Tasarım seçimi uygulanmamıştır.

## 139 düzeltmeleri

- Beklemiş hesap/profil/admin yanıtı yeni oturuma uygulanmaz. İsim güncellemesi doğru UID'ye bağlı kalır; kayıt hatası başarı gibi gösterilmez.
- Store'un ilk eşzamanlı aboneliği bütün değişkenler başlatıldıktan sonra çalışır. Çıkış bakiye, rekor, envanter ve istatistikleri sıfırlar.
- Kaju kazanç/harcaması sunucu işlemi tamamlanmadan yerel başarı yazmaz. Çakışan bakiye güncellemeleri transaction kullanır; başarısız eski mağaza ödeme çağrısı da durur. Geçersiz/sonsuz sayılar ve bozuk geçmiş güvenle reddedilir.
- Günlük, VIP, görev, turnuva ve gelen transfer ödüllerinde `users/{uid}/heroRewardClaims` makbuzu ile bakiye aynı transaction içinde değişir. Tekrar deneme çift kredi vermez. Günlük seri bilgisi de aynı işlemde saklanır. Sabit ödüller oyun kazanım limitinden kesilmez; örneğin birincilik 5.000 Kaju'dur.
- Transfer temizliği başarısız olsa bile aynı transfer ikinci kez kredilenmez. Eski turnuva `claimed` bayrağı geriye uyumlu tutulur.
- Günlük yerel sayaçlar/görevler/çark hakkı UID bazında ayrılır; önceki global localStorage anahtarları silinmez. Eski global görev ilerlemesi hangi hesaba ait olduğu bilinmediği için yeni hesaba aktarılmaz.
- Görev ödeme hatası tekrar denenebilir; çark aynı oturumda yeniden açılarak üst üste başlatılamaz ve hesap değişimi sonrası diğer hesaba ödül yazmaz.
- Bildirim dinleyicisi çıkışta kapanır; eski callback yok sayılır. Aynı zaman damgalı farklı bildirimler korunur. Anahtarların erişilebilir adı ve durumu vardır. Portal kapalıyken bildirim teslim edildiği şeklindeki yanlış açıklama kaldırılmıştır.
- Turnuva paneli kapanınca zamanlayıcı durur ve ödül düğmesi hata sonrası kilitli kalmaz.

## 139 doğrulama

`PORTAL_CHROMIUM=/tmp/chromium node QA/portal-state.cjs` gerçek Auth/Store/Daily/Push/Economy modüllerini bellek içi Firebase SDK ile sınar: başlangıç, çıkış, gecikmiş hesap yanıtları, sayısal sınırlar, bozuk geçmiş, çakışan harcamalar/krediler, başarısız ödeme, 5.000 Kaju ödülü, çift talep, günlük ödül tekrarı, transfer temizleme hatası, görev yeniden deneme, bildirim yaşam döngüsü ve erişilebilir anahtarlar. Önceki UI, sosyal, form ve gerçek service worker testleri de çalıştırılır.

Üretim hesabına yazılmaz. Gerçek Google girişi, canlı Firebase kurallarının yeni makbuz alanına izin vermesi, fiziksel telefon ve oyuncular arası çevrimiçi maç test edilmemiştir. İstemci düzeltmeleri sunucu tarafında ödül yetkilendirmesinin yerine geçmez. Tüm portalın hatasız olduğu iddia edilmez.

---

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
