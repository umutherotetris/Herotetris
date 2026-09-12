# RAPOR r780

- r779 tabanı üzerine geçildi.
- Ana şikâyet: arka plan sahneleri görünse de ana sayfa yüzeyleri hâlâ fazla opaktı.
- Uygulananlar:
  - `#prDashboard`, `#todayCard`, `#vakitBox`, `masterBar` ve ilişkili iç kartlarda transparanlık artırıldı.
  - Genel kart ailesinde koyu blok etkisi azaltıldı.
  - Berhetiyye zikir yüzeylerinde panel karartması azaltıldı; `#r717Scene` görünürlüğü korunarak sahne daha okunur hâle getirildi.
  - `manifest`, `sw.js`, build marker ve footer sürümü `r780` olarak güncellendi.
- Beklenen sonuç: ana sayfada ve Berhetiyye sahnelerinde arka plan görseli belirgin biçimde daha görünür olur.
