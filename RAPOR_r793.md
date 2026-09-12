# SÜKÛN r793 — Güncelleme Kurtarma Otoritesi

Taban: r792.

## Kök neden
- Eski service worker, ağdan daha yeni `nero.html` gördüğünde yeni sayfayı göstermek yerine kendi doğrulanmış eski shell'ini geri döndürüyordu.
- Yeni worker kurulumu sırasında CORE içindeki tek bir 404 / GitHub Pages yayılım gecikmesi install olayını düşürebiliyordu. Böylece `waiting` worker oluşmuyor, **Yenile** düğmesinin aktive edeceği hiçbir şey kalmıyordu.
- Sonuç: kullanıcı tekrar tekrar yenilese bile eski build görünmeye devam edebiliyordu. Bu cache temizleme problemi değil, update state-machine deadlock'uydu.

## r793 çözümü
- Navigasyon **network-first + build-aware**: ağda daha yeni build varsa doğrudan açılır ve worker update tetiklenir.
- Worker install artık assetlerden biri gecikti diye `redundant` olmaz; kritik shell doğrulaması bağımsız ve best-effort yürür.
- `skipWaiting()` otomatik; fakat controller değişimi aktif zikir/ses varken sayfayı zorla reload etmez.
- `__sukun_latest__.json` sabit güncel sürüm işareti eklendi.
- load / pageshow / online / görünürlük ve seyrek 60 sn kontrol ile update kendini toparlar.
- Eski cache yeni shell doğrulanmadan silinmez; çevrimdışı geri dönüş korunur.

## Dokunulmayan alanlar
Jewel UI, Tefekkür tap authority, ses oturumu, PlaybackController, sayaç, pause/stop/resume ve 28/99 seyir motorlarında işlevsel değişiklik yoktur.
