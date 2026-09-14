# RAPOR r807 — Berhetiyye tek otorite temizliği

- r778/r779/r781/r783/r784/r785/r786/r789/r799/r806 görsel/layout otoriteleri HTML kaynağından fiziksel olarak kaldırıldı.
- Eski r778 runtime, inline `!important` boyama yapan observer ile birlikte kaldırıldı; uyumluluk için yalnız state API shim bırakıldı.
- r783 ring observer kaldırıldı; yüzüğün dönüşünün tek sahibi r807 oldu.
- Berhetiyye sayaçta generic ring/glow/mandala/progress katmanları gizlendi; yalnız özel yüzük ve sabit sayı metni kaldı.
- Tefekküre Geç / Tefekkürden Çık, altı yardımcı düğme, sayaç aksiyonları, gezinme ve 28/99 seyir kontrolleri tek stil sözleşmesine alındı.
- Oynatıcı barı için içerik rezervi artırıldı ve mobil genişlik sınırlandı.

Bu sürüm bir override yaması değil; önceki çakışan sahiplik bloklarının kaldırılması üzerine kuruludur.
