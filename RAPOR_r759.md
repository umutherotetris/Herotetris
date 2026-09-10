# SÜKÛN r759 · Canlı zikir mührü

Taban r758; r756 kaynakları, ses/sayaç düzeltmeleri ve r758 mobil açıklama onarımı korunur.

## Görsel değişiklikler

- Eski 28 noktalı, 11 adımlı çizgili örgü vektör olarak geri geldi. Sayaçla aydınlanan gerçek MUHR tesbih taneleri de yeniden görünür. Statik örgü 96 saniyede saat yönünün tersine döner; canlı taneler sayımla ilerler.
- Merkezdeki radyal koyu dolgu ve sayı kutusunun dolgusu kaldırıldı. Sayı, arka plan üzerinde okunurluğunu koruyan metin gölgesine sahip; ortada opak disk yok.
- Altı nur topu 19–39 saniyelik farklı yörüngelerde, saat yönünün tersine döner. Turkuaz, mor ve pembe-kırmızı parıltılar bulunur.
- Saydam vektör dumansı kurdeleler 37 ve 53 saniyelik dönüş, 9 ve 13 saniyelik yumuşak yoğunluk değişimi taşır. Hareket CSS üzerinden yürür; yeni JavaScript çizim döngüsü eklenmedi.
- r757 ana PNG dosyaları yeniden boyutlandırılmadı, değiştirilmedi. r758 siyah-alfa çizim filtresi korunur. Yeni SVG dosyaları saydam zeminlidir.

## Hata ve çakışma incelemesi

Geri getirilen eski MUHR çiziminin, Feyz Sabit modunda veya görünmezken bağımsız döngü çalıştırabildiği bulundu. Çizim artık mevcut Feyz hareket sahibine uyar; gizli sekmede, Sabit/azaltılmış hareket/pil ve bilgi penceresinde sürekli animasyon durur. Sayı değişince taneler güncellenebilir. Feyz kapatıldığında eski temanın çizim sahipliği geri verilir. Efekt katmanlarının tamamı pointer-events:none; doğal dokunma ve kaydırma alanlarına müdahale etmez.

174/174 kaynak, VM/DOM-fixture, stil ve vektör sözleşmesi kontrolü geçti. Bunların 8'i yeni mühür davranışlarına aittir. Test komutu: `node diagnostics/r757/test_all.cjs`.

Tarayıcıda gerçek yerleşim, dokunma, FPS/GPU ve Android cihaz testi yapılmadı. Bu kontroller gerçek cihaz doğrulaması yerine geçmez; tüm hataların bittiği iddia edilmez.

## Kurulum

`nero.html`, `sw.js`, `manifest.webmanifest` ve `assets/` dahil paketin tamamını birlikte kullan. Etikette r759 görünmelidir. Canlı modda hareket, Sabit modda durağan görünüm beklenir. Canlı siteye dağıtım yapılmadı.
