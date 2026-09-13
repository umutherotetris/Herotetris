# SÜKÛN r797 — Jewel Containment Authority

Base: r796

## Düzeltmeler
- r796'daki geniş `overflow:visible` otoritesi geri alındı; büyük yüzeyler gerçek kutu sınırlarına bağlandı.
- Berhetiyye Atlası `r754Grid`, mobilde tek sütuna düşüyor; uzun kaynak/şerh metni artık dekoratif çerçeveden taşmıyor.
- Atlas mini kartlarının yüksekliği içerikten hesaplanıyor; sabit/dar düğme asseti yerine orta kart asseti kullanılıyor.
- Ana sayaç, aksiyon satırı, Önceki/Baştan/Sonraki ve Zikir Ayarları normal document-flow içinde zorunlu hale getirildi.
- Eski pseudo-frame katmanları ana CTA, nav, Tefekkür, 28/99 Seyir ve ayar başlıklarında kapatıldı; çift çerçeve/çerçeve içinde çerçeve görünümü engellendi.
- 28/99 Seyir başlıkları, seçim alanları, durum/progress ve butonlar max-width/overflow sınırlarına alındı.
- Accordion başlıkları ağır `card-wide-ornate` yerine daha kontrollü `card-wide` frame ile sınırlandı.
- Alt oyuncu için sayfaya bottom-safe scroll alanı eklendi; dock içerik sonlarını sürekli örtmüyor.
- 430/360 px mobil kırılımlarında orb, sayaç kontrolleri, gridler ve seyir alanları yeniden ölçeklendirildi.

## Dokunulmayan motorlar
- PlaybackController / Global Queue
- pause/resume/stop
- 28/99 Seyir state makineleri
- sayaç/devir mantığı
- kayıt/TTS seçim mantığı
