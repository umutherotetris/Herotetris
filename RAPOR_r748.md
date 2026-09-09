# RAPOR r748 — Service Worker güncelleme onarımı

## Bulunan kök hata
r747 paketindeki `sw.js` içinde sürüm sözleşmesi parçalanmıştı:

- HTML meta build: `r747`
- Manifest start URL: `r747`
- Service Worker cache: `sukun-r747-20260910a`
- **Service Worker SURUM: `r741`**
- **Build marker: `__sukun_build_r741__.json`**

Worker kurulumunda `nero.html` indirildikten sonra `buildOfHtml(text) !== SURUM` kontrolü çalıştığı için `r747 != r741` sonucu oluşuyor ve install reddediliyordu. Böylece eski worker korunuyor, yeni görsel paket sunucuda olsa bile uygulama eski shell'i göstermeye devam ediyordu.

## r748 düzeltmesi
- HTML build → `r748`
- Manifest `start_url` ve shortcut → `?v=r748`
- SW `SURUM` → `r748`
- SW cache → `sukun-r748-20260910b`
- SW `BUILD_MARKER` → `./__sukun_build_r748__.json`
- Fiziksel build marker dosyası → `__sukun_build_r748__.json`
- Sürüm geçmişine r746/r747/r748 eklendi.
- Görsel r746/r747 entegrasyonları korunmuştur.

## Güncelleme davranışı
Mevcut eski worker yeni `sw.js` dosyasını gördüğünde update kontrolü başlatabilir. r748 worker başarılı kurulduktan sonra uygulamadaki “Yenile” eylemiyle waiting worker aktive edilir. Aktivasyon tamamlandığında eski `sukun-*` cache'leri temizlenir.

## Not
Canlı GitHub Pages sunucusuna bu ortamdan yükleme yapılmadı. ZIP içindeki sözleşme statik olarak doğrulandı; gerçek cihazdaki mevcut eski worker davranışı yükleme sonrası ayrıca gözlenmelidir.
