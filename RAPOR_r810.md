# RAPOR r810

## r809 ekranlarından görülen sorunlar
- Berhetiyye sayaç yüzüğü bazı anlarda tamamen kayboluyor, legacy mühür/canvas çizgileri görünüyordu.
- 28 İsim Seyri ekranında Bitir bazı anlarda jewel skinini kaybediyor; butonların altında dekoratif kırıntılar görünüyordu.
- Bunun ana nedeni r809 skin state’inin geçici kategori durumlarında düşebilmesi ve ayrı injected counter yüzeyinin legacy sayaçtan kopmasıydı.

## r810 çözümü
- Ayrı injected sayaç tamamen kaldırıldı.
- İşlev sahibi olan mevcut `#zCountVisual` korunup, Berhetiyye yüzüğü doğrudan tek `::before` katmanında çizildi.
- Legacy ring/canvas/glow/progress çocukları Berhetiyye’de tamamen gizlendi; sadece `cntNums` görünür.
- Berhetiyye state’i artık sticky/consensus mantığıyla tutulur: geçici internal kategori değişimi skin düşürmez.
- 28/99 seyir ve ana jewel butonların `::before/::after` katmanları zorla kapatıldı; dekoratif kırıntıların önü kesildi.
- Dock peek kompakt cam olarak kaldı; jewel görseli kullanılmıyor.
