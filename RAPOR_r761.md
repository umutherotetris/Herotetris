# RAPOR_r761 — Logo sahipliği düzeltmesi

## Sorun
r760 hazırlanırken kaldırılması istenen simge yanlış yorumlandı. Ana başlığın özgün **۞ SÜKÛN shimmer mührü** kaldırıldı; buna karşılık canlı üst bardaki `feyz-mark-r718.svg` tabanlı, Gemini benzeri ikincil marka işareti kaldı.

## Düzeltme
- r759 source-diff içindeki özgün header markup'ı birebir geri getirildi: `logo shimmer-logo` + `girih` + üç `spark` katmanı + `۞`.
- `#r616Topbar` içindeki `r616BrandMark` DOM öğesi kaldırıldı; yalnız **SÜKÛN** yazısı ve görünüm alt başlığı kaldı.
- r760'ın ana logoyu zorla gizleyen `display:none` kuralı kaldırıldı.
- Savunma amaçlı r761 CSS'i, başka eski bir modül `r616BrandMark` üretse bile üst barda görünmesini engeller.
- r760'ın sayaç merkezleme, transparan sahne ve mor-mavi ilerleme yayı değişiklikleri korunur.

## PWA sözleşmesi
- HTML build meta: `r761`
- Manifest start/shortcut/version: `r761`
- Service Worker SURUM/cache: `r761`
- Eski hatalı `__sukun_build_r757__.json` SW marker referansı: `__sukun_build_r761__.json` olarak onarıldı.

## Test kapsamı
Kaynak/VM regresyon testi ve statik release-contract kontrolleri çalıştırılmıştır. Fiziksel Android cihazında görsel doğrulama yapılmadı.
