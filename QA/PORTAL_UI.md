# Hero Portal ana sayfa yenilemesi

`index.html` oyunları ilk sıraya taşır; masaüstünde dört, telefonda iki sütun kullanır. Yeni `css/portal.css` ana sayfanın görsel katmanını yönetir. Oyunların mevcut modülleri ve hesap/ekonomi kimlikleri korunur.

- Yakınlaştırma serbest, oyun kartları semantik düğmeler, gezinme bağlantıları gerçek hedeflidir.
- Klavye odağı, oyunlara atlama, aktif menü bildirimi ve azaltılmış hareket tercihi desteklenir.
- `portal.js` hesap servisleri yüklenirken gezinmeyi açar; bağlantı hatasında tekrar deneme sunar.
- Skor, Store'un `best.tetris` alanından okunur ve sıfıra dönebilir. XP ilerleme çubuğunun erişilebilir değeri güncellenir.
- Ayrı `hero.webmanifest` ve Hero SVG simgesi kullanılır. Depodaki SÜKÛN dosyaları ile kök service worker bu değişikliğin kapsamında düzenlenmemiştir.
- Var olmayan `dailysummary.js` isteği kaldırılır.

## Doğrulama

Playwright kurulu bir Node ortamında:

```sh
node QA/portal-ui.cjs
```

İsteğe bağlı `PORTAL_CHROMIUM` değişkeni Chromium yürütülebilir dosyasını; `PORTAL_SCREENSHOTS` mevcut bir ekran görüntüsü klasörünü belirtir.

Başarılı kontroller: 320, 390, 600, 768, 1024, 1440 px genişliklerinde taşma; beş menü hedefi; klavye ile dört gerçek oyun modülünün açılışı; atlama bağlantısı/odak; skor sıfırlama ve XP değeri; kayıtlı tema; azaltılmış hareket; servis bağlantısı kesildiğinde görünür kurtarma.

Hesap ve Store modülleri bu testte bellek içi örneklerle değiştirilir, diğer uygulama ve oyun modülleri gerçek dosyalardan çalışır. Canlı Google oturumu, veritabanı işlemleri, çevrimiçi eşleşme ve Android cihaz davranışı bu testle doğrulanmış sayılmaz. Test hiçbir gerçek hesaba veri yazmaz.
