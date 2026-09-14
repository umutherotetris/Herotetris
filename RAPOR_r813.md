# RAPOR r813 — Berhetiyye sticky visual authority

## Ekran görüntülerinde kalan gerçek hata
- Berhetiyye seçili olmasına rağmen Tefekkür sırasında `data-r811-berhet` geçici olarak düşebiliyordu.
- Bu anda özel yüzük kayboluyor, eski ince mandala/orbit çizgileri geri geliyor, Tefekkür nav düğmeleri glass görünüme dönüyor ve mini player tekrar geniş koyu yüzeye kaçıyordu.
- 28 İsim Seyri içindeki `Bitir` de eski skin yarışından zaman zaman düşüyordu.

## r813 çözümü
- Berhetiyye state'i artık playback/view category yerine önce gerçek kullanıcı seçimi (`Z.cat`, favori `_src`) üzerinden çözülür.
- Tefekkür aktifken Berhetiyye görsel kontratı sticky tutulur; geçici flow/category raporu özel görünümü kapatamaz.
- Berhetiyye'den çıkış yalnız kesin bir kullanıcı kategori değişiminde yapılır.
- Ring host değişirse/yeniden çizilirse `r811BerhetRing` otomatik geri takılır; observer yalnız childList izler, style/class feedback loop oluşturmaz.
- `data-r474-name-category=berhet` için CSS emergency guard eklendi; bir karelik state boşluğunda bile eski orbit/mandala görünmez.
- `Bitir` düğmesi inline-important jewel skin ile sabitlendi.
- Minimize player 300 px (dar cihazda 286 px) kompakt jewel bara zorlandı.

## Beklenen test
1. Berhetiyye normal sayaç: yüzük sürekli görünür.
2. Tefekküre gir: yüzük kaybolmaz, eski ince daire/çizgi dönmez.
3. Tefekkürden çık: aynı state korunur.
4. 28 İsim Seyri: `Bitir` dahil tüm düğmeler tam jewel.
5. Alttaki `Oynatıcıyı göster`: geniş siyah/füme raf üretmez.
