# RAPOR r809 — Berhetiyye flashing / layout authority fix

## Kök neden
r808 runtime, `document.body` altındaki tüm subtree üzerinde `style/class/hidden` attribute değişimlerini izliyordu. Aynı runtime ardından butonların inline stillerini `!important` ile yeniden yazdığı için kendi MutationObserver’ını tekrar tetikleyen bir feedback loop oluşuyordu. Bu, mobilde flashing, kısa süreli skin değişimi ve layout kayması üretebiliyordu.

## r809 değişiklikleri
- r244 `SukunFloatingCollision` self-triggering style observer Berhetiyye aktifken no-op yapıldı.
- r727 `SukunZCtlFlow` otomatik min-height ölçüm/yazım döngüsü Berhetiyye aktifken durduruldu; eski min-height temizleniyor.
- r808 görsel sahibi ve global MutationObserver tamamen kaldırıldı.
- Berhetiyye görselleri CSS-only tek otoriteye taşındı.
- Yalnız kategori durumunu izleyen iki dar observer kaldı; `style` gözlenmiyor.
- r798 binder, Berhetiyye aktifken layout/skin yeniden yazmıyor.
- Özel zikirmatik legacy `zCountVisual` yüzeyinden ayrıldı; yalnız doğal kristal yüzük dönüyor.
- `bsPause/es99Pause` duplicate kontrol düğümleri kalıcı gizli; canonical `bsStart/es99Start` play/pause sahipliği korunuyor.
- `Oynatıcıyı göster` için raster jewel skin kaldırıldı; sabit glass dock kullanılıyor.
- Akış & Seans / Kaynaklar / Araçlar başlıklarında iç metin alanı büyütüldü.

## Beklenen sonuç
- Scroll sırasında ve sayım değişirken flashing belirgin biçimde bitmeli.
- Player peek artık geniş jewel görseliyle metnin üstüne binmemeli.
- Sayaç ve seyir kontrolleri kategori state değişimlerinde yer değiştirmemeli.
