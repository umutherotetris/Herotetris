# RAPOR r808 — Berhetiyye Katman İzolasyonu

## Ekran görüntülerinden doğrulanan kök nedenler
- Sayaçta seçilen kristalli yüzüğün üzerinde eski inci/halka görseli hâlâ görünüyordu. Bu, aynı `#zCountVisual` içinde legacy görsel katmanların yeniden devreye girebildiğini gösteriyordu.
- 28 İsim Seyri’nde iki ayrı `Duraklat` görünüyordu. `#bsPause` HTML olarak hidden olmasına rağmen sonraki `display:flex!important` kuralları hidden davranışını eziyordu.
- `Bitir` ve bazı yarım satır kontrollerinde dekoratif parçalar ayrı katman gibi görünüyordu.
- Alt `Oynatıcıyı göster` kartı Berhetiyye kaplamasına rağmen eski yüksek-specificity dock CSS’ine yeniliyordu.

## r808 yaklaşımı
1. **Legacy r778 sınıfı artık hiç eklenmiyor.** Böylece r780 ve daha eski `.r778-berhet-palace` seçicileri Berhetiyye görünümüne karışamıyor.
2. **Sayaç fiziksel olarak ayrıldı.** Berhetiyye aktifken eski `#zCountVisual` tamamen gizleniyor; yeni `#r808BerhetCounter` yalnızca seçilen kristalli yüzük + sayı + yüzde katmanlarından oluşuyor. Tıklama eski sayma motoruna proxy edilir; sayaç mantığı değiştirilmez.
3. **`bsPause` / `es99Pause` zorla hidden.** Tek Başlat/Duraklat/Sürdür düğmesi kalır.
4. **Kontroller inline `!important` tek sahipli kaplamaya alındı.** Bu özellikle dock ve yolculuk kontrollerinde eski yüksek-specificity CSS’in yeniden baskın çıkmasını engeller.
5. **Host flashing kapatıldı.** Berhetiyye seyir kartlarında legacy wake/tap animasyonları görsel olarak devre dışıdır.

## Beklenen sonuç
- Kristalli Berhetiyye yüzüğünün üzerinde ikinci inci halka görünmez.
- 28 İsim Seyri’nde tek Duraklat/Sürdür kontrolü görünür.
- Bitir / önceki / sonraki / yeniden başlat kontrolleri birbirinden kopuk dekoratif parçalar üretmez.
- Alt oynatıcı Berhetiyye özel kaplamasını korur.
