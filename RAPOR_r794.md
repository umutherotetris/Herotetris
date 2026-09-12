# SÜKÛN r794 — Jewel Hard Bind

## Kök neden
Ekrandaki 28 İsim Seyri düğmelerinin düz cam kalması cache kaynaklı değildi. İki bağımsız sorun birlikteydi: eski r778 CSS kuralları bazı Berhetiyye panel pseudo-elementlerini `display:none!important` ile kapatıyordu; yeni r790/r792 katmanı ise bazı yerlerde yalnız `background-image` değiştiriyor, `display` otoritesini geri almıyordu. Ayrıca görsel dil dış SVG yollarına bağlı kaldığı için eksik/stale asset klasörü aynı semptomu üretebiliyordu.

## r794 çözümü
- Kritik Jewel SVG'leri `nero.html` içine data URI olarak gömüldü.
- 28 İsim Seyri paneli, Seyir Bağlamı, durum şeridi ve tüm seyir kontrolleri pseudo-element yerine gerçek DOM elemanının `background-image` katmanına bağlandı.
- Eski `::before` katmanları bu kapsamda bilinçli olarak kapatıldı; hit-test ve mevcut click handler sahipliği korunuyor.
- 99 Esma Seyri, ana zikir CTA/navigasyon, Hedef-Kalan, accordionlar, araç satırı ve Tefekkür CTA için aynı self-contained fallback uygulandı.
- Ses oturumu, sayaç, pause/stop/resume ve 28/99 seyir state makinelerine dokunulmadı.
