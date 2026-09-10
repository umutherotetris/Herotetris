# RAPOR_r750 — Durdur düğmesi renk düzeltmesi

## Sorun
Premium yayma katmanı `.dockItem.danger` sınıfını mor/magenta aileye çektiği için üst paneldeki global **DURDUR** düğmesi geri alınamaz eylem hissini kaybediyordu. Ekranda stop düğmesi, tefekkürden çık butonuna fazla benziyor ve okunurluk düşüyordu.

## Çözüm
- Sadece `#stopAll.dockItem.danger` hedeflenerek özel stil override eklendi.
- Düğme kırmızı/gül tonlu belirgin bir gradyana taşındı.
- İkon rengi ve etiket kontrastı güçlendirildi.
- Hover/focus/active durumları ayrıca düzeltildi.
- SW / manifest / build marker sürümleri r750 olarak senkronlandı.

## Etki
- Diğer `.danger` butonlar (ör. tefekkürden çık, tehlikeli yardımcı butonlar) olduğu gibi kalır.
- Sadece ana üst paneldeki **DURDUR** düğmesi görsel olarak netleşir.
