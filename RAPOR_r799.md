# SÜKÛN r799 — Berhetiyye Doğal Kristal Sayaç Yüzüğü

## Değişiklik
- r798 genel Jewel sayaç görseli korunur.
- `body.r778-berhet-palace` aktif olduğunda sayaç arka planı tek sahipli Berhetiyye yüzüğüne geçer.
- Yeni asset: `assets/berhetiyye-premium/berhetiyye-ring-r799.png`.
- Ametist, yakut, safir ve zümrüt tonlarında doğal kristal kümeleri ile kalın altın/bronze gövde kullanılır.
- Sayaç rakamları ayrı DOM katmanında kaldığı için dönüş sırasında okunabilirlik kaybolmaz.

## Dönüş sözleşmesi
- Yüzük yalnız canlı Berhetiyye seansında döner.
- Yön: saat yönünün tersi (`0deg → -360deg`).
- Dönüş sırasında `scale`, `skew` veya perspektif dönüşümü uygulanmaz; yalnız Z ekseni rotasyonu vardır.
- Reduced-motion tercihi animasyonu kapatır; düşük performans modunda animasyon yavaşlar.

## Korunan sahipler
Ses motoru, Global Queue, sayaç değeri, Hedef/Kalan, kendi kayıt/TTS, Pause/Resume/Stop ve 28/99 Seyir state makineleri değiştirilmedi.
