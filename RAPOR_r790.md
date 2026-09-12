# SÜKÛN r790 — Jewel UI Component Pass

## Yapılanlar
- r789 tabanı korunarak görsel katman tek aileye çekildi.
- Yeni metinsiz SVG asset kartları `assets/jewel-ui-r790/` altında üretildi.
- Akış & Seans, Kaynaklar, Araçlar, Okumalar, Seyirler, Zikir Ayarları, Hedef/Kalan ve mini oynatıcı aynı çerçeve ailesine bağlandı.
- 28 İsim Seyri: seçim alanları, ilerleme, durum, bilgi paneli, Sürdür ve alt kontroller tek tasarım diline alındı.
- Eski `overflow:hidden` kaynaklı taş/çerçeve ucu kırpılmalarına karşı ilgili hostlar `overflow:visible` yapıldı.

## Korunan teknik sözleşmeler
- Ses oturumu sahipliği değiştirilmedi.
- 28/99 seyir motorları değiştirilmedi.
- pause / stop / resume akışı değiştirilmedi.
- Gerçek düğmeler ve event listener sahipliği korunur; assetler yalnız dekoratif pseudo-element katmanıdır.
- Yeni MutationObserver eklenmedi.

## Asset kartları
`ASSET_CARDS_r790.json` bileşen→asset eşlemesini taşır.
