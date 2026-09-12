# SÜKÛN r789 — Berhetiyye No-Flash Skin Authority

## Kök neden
`r778` görsel otoritesi `#berhetSeyir` kontrollerine legacy cam/gradient arka planı inline `!important` ile yazarken, `r788` MutationObserver bir sonraki frame'de mücevher PNG'sini tekrar yazıyordu. Bu iki yazıcı aynı düğmenin `background-image` alanında yarıştığı için ekran cam ve mücevher görünüm arasında yanıp sönüyordu.

## r789 çözümü
- Berhetiyye kontrolü **tek gerçek DOM butonu** olarak kalır.
- Mücevher görseli yalnız `::before` dekor katmanında bulunur.
- Skin için MutationObserver / click / change repaint zinciri yoktur.
- `r778 ctrl()` ilgili düğmelerin background/border alanına yazmaz.
- 28 İsim Seyri düğmeleri `body.r778-berhet-palace` durumundan bağımsız olarak doğrudan `#berhetSeyir` altında skinlenir. Böylece geçici body-state uzlaşması bile seyir butonlarını düz stile düşüremez.

## Korunanlar
Zikir çemberi, ses oturumu, pause/stop/resume, sayaç motoru, sahneler ve r786 mobil geometri değiştirilmedi. r788 assetleri aynen yeniden kullanılır.
