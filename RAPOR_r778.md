# SÜKÛN r778 — Berhetiyye Billur Saray

## Kök neden
r777 paketinde yeni görsel dosyalar bulunmasına rağmen HTML meta, manifest ve service worker hâlâ r775 kimliğini taşıyordu. Tarayıcı bu nedenle eski r775 shell/cache zincirinde kalabiliyordu; sahne ve skinler görünmüyordu.

## r778 düzeltmeleri
- HTML meta + görünür footer + manifest + SW SURUM + SW CACHE + build marker tek sürümde **r778** olarak senkronlandı.
- r776'da doğrulanan güçlü visual-authority tabanı geri alındı ve yeni onaylanan assetlerle genişletildi.
- Varsayılan Berhetiyye sahnesi: Ayasofya ve altında görünen billur saray.
- Sayaç: safir/yakut/zümrüt/amethyst vurgulu yeni kristal yüzük.
- Kontroller: mücevherli mavi-safir ağırlıklı buton seti.
- **Otomatik + 6 sahne** seçicisi eklendi. Otomatik mod Berhetiyye isim sırasına göre sahneyi değiştirir.
- Esmâü'l-Hüsnâ veya başka kategoriye geçilince, ya da Zikir alanından çıkılınca Berhetiyye visual authority temizlenir ve önceki SÜKÛN stilleri geri yüklenir.
- 28 İsim Seyri tamamlanma olayında skin kapanır; tekrar başlatılınca yeniden açılır.
