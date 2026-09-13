# SÜKÛN r796 — Jewel UI Single Authority

## Hedef
Kullanıcının onayladığı referans yapıyı doğrudan mevcut DOM'a bağlamak; Jewel'i skin değil tek component otoritesi yapmak.

## Değişiklikler
- Ana zikir akışı: orb → Hedef/Kalan → -1 / ana CTA / +1 → Önceki/Baştan/Sonraki.
- Sayaç orb'ı r796 ring assetine bağlandı; eski ring dekorasyonu görsel otorite olmaktan çıkarıldı.
- Hedef/Kalan gerçek ornate stat kartlarına bağlandı.
- -1/+1 kullanıcı onaylı şeffaf asset sheet'ten birebir çıkarılan sabit assetleri kullanıyor.
- Tefekkür CTA ve 2×3 aksiyon araçları tek Jewel ailesine bağlandı.
- 28 ve 99 seyir aynı component sistemini kullanıyor: başlık, select kartları, progress, status, context, Sürdür ve alt kontroller.
- Akış & Seans / Kaynaklar / Araçlar / Okumalar / Seyirler / Zikir Ayarları ornate C-seviye kartlara bağlandı.
- Dinamik DOM yeniden üretiminde Jewel sınıflarının kaybolmaması için yalnız Zikir köklerini gözleyen dar MutationObserver eklendi.
- r795 geçici component authority kaldırıldı; r796 tek son otorite.

## İşlevsel sınır
Ses motoru, queue, sayaç mantığı, pause/resume/stop ve 28/99 state makineleri yeniden yazılmadı.
