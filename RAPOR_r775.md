# SÜKÛN r775 — Berhetiyye Billur Saray aktivasyon onarımı

## Bulunan asıl hata
r774 Berhetiyye tema CSS/runtime blokları kapanmış `</body></html>` belgesinin arkasına eklenmişti. Android/WebView davranışında bu katman güvenilir bir document parçası değildi. Ayrıca saray arka planı yalnız `#tab-zkr` alanına verilmişti. Bu nedenle kullanıcıda arka plan ve kontrol skinleri hiç görünmeyebiliyordu.

## r775
- r773/r774 sonradan eklenmiş tema blokları kaldırıldı.
- Tek otorite `r775-berhet-palace` body sınıfıdır. CSS ve runtime gerçek `</body>` kapanışından önce bulunur.
- Billur Saray arka planı body seviyesinde `fixed` tam ekran uygulanır.
- Hedef/Kalan, −1/+1, Duraklat, Önceki/Baştan/Sonraki ve hedef/seyir yüzeyleri Berhetiyye skinine bağlandı.
- Aktivasyon yalnız custom eventlere bağlı değildir; canlı kategori, `.act` DOM durumu, 28 İsim Seyri ve aktif isim snapshot birlikte kontrol edilir.
- Sayaç/ses/kayıt/TTS/seyir/Global Playback işlev sahiplerine dokunulmadı.
