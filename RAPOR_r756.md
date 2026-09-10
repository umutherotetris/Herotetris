# RAPOR_r756 — İpeksi kart ve Berhetiyye sayfa geçişleri

## 1. Detay kartı
- r755’teki **eski kart flashing koruması** aynen korunur.
- Kart kabuğu yaklaşık **320 ms** süren yumuşak bir `fade + hafif yükselme + scale` hareketiyle açılır.
- Premium içerik hazır olduğunda satırlar ayrı bir kısa **content bloom** ile görünür.
- Kapatma düğmesi, backdrop ve Escape ile kapanış yaklaşık **180 ms** yumuşak çıkış alır; ardından mevcut `SukunActiveNameInfo.close()` çalışır.

## 2. Berhetiyye kaynak sayfası
- Mevcut r749 viewer mimarisi değiştirilmedi; `img.src` değişimleri izlenir.
- Sayfa değişiminde eski görüntü kısa fade/blur ile söner.
- Yeni görüntü yüklenince sağ/sol yönü hissedilen hafif yatay hareketle yerleşir.
- Önceki/sonraki, swipe, klavye ve r754 “kaynağa git” butonları aynı viewer üzerinden geçtiği için yeni hareket bunların tamamına uygulanır.
- Ağ/yükleme olayı kaçarsa 650 ms güvenlik zaman aşımı görüntüyü görünmez durumda bırakmaz.

## 3. Erişilebilirlik
- `prefers-reduced-motion: reduce` etkinse yeni animasyonların tamamı kapatılır.

## Değiştirilmeyenler
- Zikir sayacı
- Ses motoru
- Berhetiyye veri matrisi
- Kaynak sayfalarının içeriği
- r755 flashing düzeltmesi
