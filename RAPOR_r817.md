# RAPOR r817 — Sayaç / Çark Stabilite Turu

## Ana sorun
r813, r815 ve r816 katmanları aynı sayaç görünürlüğüne ayrı ayrı müdahale ediyordu. Özellikle r815'in 700 ms watchdog'u eski Berhetiyye kilidini yeniden kurabildiği için kategori/tefekkür geçişlerinde çark kaybolması veya kısa flashing oluşabiliyordu.

## Düzeltmeler
- r813 otoritesine **generic sayaç hard-veto** eklendi.
- r815 `shouldLatch()` artık r816/r817 generic otoritesini aşamıyor.
- Generic moda geçerken r815 session latch açıkça temizleniyor.
- r817'de **tek sayaç sahibi** katmanı eklendi: `berhet` veya `generic`.
- Berhetiyye aktifken yalnız premium mücevher çarkı + sayaç sayıları görünür.
- Generic modda Berhetiyye görseli tamamen kapatılır; normal ring/canvas/halo/progress katmanları tekrar açılır.
- `Kendi sesin`, `bsStatus`, `es99Status`, `cntSub` satırlarında dar ekran taşmaları sıkılaştırıldı.
- Kategori, tefekkür, seyir, current-zikir ve DOM hydration geçişlerinde aynı state çözücü tekrar çalışıyor.

## Test matrisi
1. Normal zikir → Berhetiyye → normal zikir.
2. Berhetiyye → Tefekkür → çıkış.
3. 28 İsim Seyri başlat/duraklat/bitir → sayaç görünümü.
4. 99 İsim Seyri → normal zikir sayaç görünümü.
5. Kendi kayıt aktif/pasif → durum satırı taşma kontrolü.
6. Hızlı kategori geçişi sırasında flashing kontrolü.
