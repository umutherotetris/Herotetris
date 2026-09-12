# SÜKÛN r792 — Tefekkür Tap Authority

Taban: r791.

## Düzeltilen hata
- `Tefekküre Geç` görünür olduğu hâlde Android/Chromium'da dokunmanın işlev üretmediği akış için son hit-test/tap otoritesi eklendi.
- Düğme ve slot z-index/hit-test katmanına alındı; dekoratif glass/pseudo katmanlar pointer sahibi olamaz.
- Mobil `pointerup` gerçek düğme geometrisi içinde ve kayma ≤12px ise geçiş doğrudan canonical `SUKUN_TEFEKKUR.enter()` API'sine gider.
- Sonradan üretilen native `click` yakalanıp eski r700 handler'ın ikinci kez toggle ederek geri dönmesi engellenir.
- API beklenmedik biçimde erişilemezse yalnız tefekkür görünüm sınıflarını kurtaran fallback vardır; ses/kuyruk/sayaç sahipliğine dokunmaz.

## Jewel
- r791 assetleri `assets/jewel-ui-r792/` altında yeniden adlandırıldı. r792 deploy paketi kendi asset yolunu taşır.

## Korunan alanlar
- Global PlaybackController, ses oturumu, pause/stop/resume, 28/99 seyir ve sayaç çekirdeği değiştirilmedi.
