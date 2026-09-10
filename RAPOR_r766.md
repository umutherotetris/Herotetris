# SÜKÛN r766 — Aktif isim cam host düzeltmesi

## Yapılan düzeltme
- `zAr` alanı yalnız Arapça satır değil, artık **aktif isim cam hostu** olarak davranacak şekilde güçlendirildi.
- `#r611CurrentZikirHero`, `#zAr` içine taşındı.
- `Ya Şemhâbârûhin` gibi aktif Berhetiyye/Esmâ adı artık boşta sahne üzerinde değil, **üstteki cam çerçevenin içinde** görünür.
- Auto-fit tek satır mantığı korundu.

## Stil etkisi
- Cam perde daha tutarlı: Arapça satır üstte, aktif isim altında, aynı lüks yüzey içinde.
- Yumuşak gold/teal ışıma korundu.
- Küçük ekranlarda isim sığdırma davranışı iyileştirildi.

## Teknik not
- Bu düzeltme esasen `nero.html` CSS + runtime DOM yerleşimi düzeltmesidir.
- `sw.js`, `manifest.webmanifest` ve build marker `r766` olarak eşitlendi; böylece cache karışması azalır.
