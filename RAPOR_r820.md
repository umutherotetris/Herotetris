# SÜKÛN r820 — root-entry / cache recovery surgery

## Kesin teşhis
Kullanıcının ekran görüntüsünde alt sürüm etiketi hâlâ `r815` gösteriyordu. Bu, r819 sayaç cerrahisinin tarayıcıya hiç ulaşmadığını kanıtlıyor. Dolayısıyla önceki ekran görüntüsü r819 render sonucu değildi; eski kabuk/SW/cache çalışıyordu.

## r820 müdahalesi
- Yeni `index.html` eklendi. Root GitHub Pages girişi artık sürümlü bir boot trampoline kullanıyor.
- `index.html` ve `r820-reset.html` üzerinde `meta[name=sukun-build]=r820` var. Eski SW navigation kodu daha yeni build gördüğünde bu belgeyi cache yerine ağdan vermek zorunda kalır.
- Boot trampoline eski `sukun-*` Cache Storage kayıtlarını siler, mevcut SW registration'larını unregister eder ve `nero.html?v=r820&boot=<timestamp>` adresine geçer.
- `sw.js` r820 cache adına taşındı; `index.html` ve `nero.html` core shell'e eklendi.
- Manifest başlangıç adresi root `index.html?v=r820` yapıldı.
- Berhetiyye ring asseti benzersiz `berhetiyye-ring-r820.png` adına kopyalandı; eski görsel cache anahtarından ayrıldı.
- HTML footer kimliği görünür şekilde `SÜKÛN v20.69 — build 2026-09-14-r820` olur.

## Doğrulama ölçütü
Root sayfa açıldıktan sonra footer `r815` değil `r820` göstermelidir. Footer r820 olmadan sayaç/ring sonucu değerlendirilmemelidir.
