# RAPOR r811

## Kök neden
- r810 Berhetiyye aktifliğini doğrudan `Z.cat` üzerinden okuyordu. Favoriler veya seyir sahipliği sırasında gerçek kaynak Berhetiyye olduğu halde görünüm kategorisi `fav`/başka geçici state olabiliyordu.
- r810 girişinde `data-r809-berhet` kaldırıldığı için r798 binder yeniden çalışıyor ve Berhetiyye özel katmanlarını tekrar normalize ediyordu. Bu, flashing ve skin düşmesine yol açıyordu.
- Sayaç yüzüğü pseudo-element olduğu için eski pseudo sahipleriyle aynı yüzeyde yarışıyordu.

## r811
- Kategori kaynağı `currentZikirState.snapshot().cat` ile canonical hale getirildi; favori ve seyir durumları doğru biçimde Berhetiyye sayılır.
- Berhetiyye açıkken `data-r809-berhet=1` kasıtlı olarak korunur; r798/r604 legacy binders geri çekilir.
- Sayaç yüzüğü pseudo-element değil, tek gerçek `img#r811BerhetRing` katmanıdır.
- Eski sayaç mandala/flame/canvas katmanları Berhetiyye’de gizlenir.
- Tefekkür sayaç geometrisi ayrıca sabitlenir.
- Önceki/Baştan/Sonraki data-attribute ile skinlenir.
- Bitir dahil 28/99 seyir kontrol grubu tek skin sahibinde tutulur.
- Gizli oyuncu barı her durumda ekran ortasına sabitlenir.
