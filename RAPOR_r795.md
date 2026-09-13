# SÜKÛN r795 — Jewel UI Component Authority

## Amaç
r795 bir skin yaması değil, görsel component refactor sürümüdür. Aynı işlev ailesindeki kontroller artık sürüm bazlı selector yamaları yerine ortak Jewel sınıfları kullanır.

## Kök neden
r778, r790, r792 ve r794 katmanları aynı DOM üzerinde farklı pseudo-element, direct-background ve body-state kuralları taşıyordu. Dinamik 28/99 seyir mountları veya başka CSS katmanları devreye girdiğinde yalnız bazı kontroller Jewel kalıyor, diğerleri legacy cam stile dönüyordu.

## Yapılanlar
- r790/r792/r794 geçici Jewel görsel otoriteleri `nero.html` içinden kaldırıldı.
- `body.sukun-jewel-ui` altında tek token/component/layout otoritesi kuruldu.
- Gerçek raster mücevher assetleri `assets/jewel-r795/` altında kanonik isimlerle toplandı. Assetlerde canlı yazı/sayı yoktur; metin, durum ve hit-target DOM'da kalır.
- Ana sayaç Hedef/Kalan, −1/+1, Duraklat/Devam ve navigasyon ortak button/stat sınıflarına bağlandı.
- Zikir araç satırı 2×3 mobil Jewel gridine bağlandı: Dinle, Döngü, Kendi Sesin, Niyet, Favori, Nasıl?.
- Tefekküre Geç primary Jewel component oldu; mevcut r792 tap davranış otoritesi korunur.
- 28 İsim ve 99 Esmâ Seyri aynı `.jewel-journey` sözleşmesini kullanır. Başlık, select, progress, status ve aksiyonlar tek aileden gelir.
- Akış & Seans, Kaynaklar, Araçlar, Okumalar, Seyirler ve Zikir Ayarları aynı Jewel accordion componentine bağlandı.
- Yeni geniş DOM observer eklenmedi; mevcut r656 `sukun:domhydrate` bus'ı kullanıldı.

## Değişmeyen motorlar
Ses oturumu sahipliği, Global PlaybackController/queue, sayaç semantiği, pause/stop/resume, kayıt/TTS, 28/99 seyir state makineleri ve lock-screen continuity değiştirilmedi.
