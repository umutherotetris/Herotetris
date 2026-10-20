# Hero Portal ana sayfa yenilemesi

`index.html` oyunları ilk sıraya taşır; masaüstünde dört, telefonda iki sütun kullanır. Yeni `css/portal.css` ana sayfanın görsel katmanını yönetir. Oyunların mevcut modülleri ve hesap/ekonomi kimlikleri korunur.

- Yakınlaştırma serbest, oyun kartları semantik düğmeler, gezinme bağlantıları gerçek hedeflidir.
- Klavye odağı, oyunlara atlama, aktif menü bildirimi ve azaltılmış hareket tercihi desteklenir.
- `portal.js` hesap servisleri yüklenirken gezinmeyi açar; bağlantı hatasında tekrar deneme sunar.
- Skor, Store'un `best.tetris` alanından okunur ve sıfıra dönebilir. XP ilerleme çubuğunun erişilebilir değeri güncellenir.
- Ayrı `hero.webmanifest` ve Hero SVG simgesi kullanılır. Kök `sw.js` Hero Portal 137 worker'ıdır; geçerli Hero HTML'sini eski SÜKÛN kabuğuyla değiştirmez. Önbellek yalnız `/Herotetris/` kapsamına ait Hero alanından okunur; diğer uygulamaların önbellekleri ve oyuncu kayıtları silinmez.
- `js/portal-worker.js` hesap servislerinden bağımsız başlar. `hero-recover.html`, eski r820 worker'ın kontrol ettiği tarayıcıyı aynı `sw.js` adresindeki yeni worker'a geçirir ve gerçek `HERO_PONG` yanıtından sonra ana sayfaya yönlendirir. Yalnız bu geçiş sayfasındaki `sukun-build` etiketi eski worker ile uyumluluk içindir; uygulama sürümü değildir.
- Var olmayan `dailysummary.js` isteği kaldırılır.

## Doğrulama

Playwright kurulu bir Node ortamında:

```sh
node QA/portal-ui.cjs
node QA/portal-worker.cjs
```

İsteğe bağlı `PORTAL_CHROMIUM` değişkeni Chromium yürütülebilir dosyasını; `PORTAL_SCREENSHOTS` mevcut bir ekran görüntüsü klasörünü belirtir.

Başarılı kontroller: 320, 390, 600, 768, 1024, 1440 px genişliklerinde taşma; beş menü hedefi; klavye ile dört gerçek oyun modülünün açılışı; atlama bağlantısı/odak; skor sıfırlama ve XP değeri; kayıtlı tema; azaltılmış hareket; servis bağlantısı kesildiğinde görünür kurtarma.

`portal-worker.cjs` ayrı bir yerel HTTP sunucusunda gerçek eski r820 worker'ını çalıştırarak hatayı yeniden üretir. Ardından gerçek kurtarma sayfasıyla yalnız bu kapsamdaki eski kaydın kaldırılıp aynı adreste yeni worker'ın kurulmasını, `HERO_PONG` doğrulamasını, ana sayfanın çevrimiçi/çevrimdışı yanıtlarını, eksik JS isteklerinin HTML almamasını, diğer sayfa yollarını ve önbellek/ayarların korunmasını sınar. Ağ kesintisi sunucu düzeyinde de uygulanır; bu akış hesap modüllerine veya canlı veritabanına bağlanmaz.

Hesap ve Store modülleri bu testte bellek içi örneklerle değiştirilir, diğer uygulama ve oyun modülleri gerçek dosyalardan çalışır. Canlı Google oturumu, veritabanı işlemleri, çevrimiçi eşleşme ve Android cihaz davranışı bu testle doğrulanmış sayılmaz. Test hiçbir gerçek hesaba veri yazmaz.
