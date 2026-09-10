# r759 güncellemesi

Çizgili tesbih, saydam merkez, altı nur topu ve mor/kırmızı/turkuaz dumansı vektörler eklendi. Güncel davranış ve kontroller: `RAPOR_r759.md`. Yeni dosyalar `assets/sukun-tesbih-weave-r759.svg` ve `assets/sukun-nur-mist-r759.svg`; Service Worker çekirdeğinde yer alır. Diğer görsel dosyaları değişmedi.

# SÜKÛN · Feyz Nur / r758

Bu tasarım r756 uygulamasına işlendi. Giriş dosyası `nero.html`.
Feyz görünümü açıkken yeni sahne ve çember kullanılır. Mevcut tema tercihi
korunur; açık sabah ve AMOLED tercihlerine bu katman uygulanmaz.

## Görsel dosyaları

| Dosya | Yerel çözünürlük | Kullanım |
| --- | --- | --- |
| `assets/sukun-nur-sanctuary-r757.png` | 887 × 1774 | Tüm sayfalara yayılan yazısız sahne |
| `assets/sukun-nur-ring-r757.png` | 1254 × 1254 | Altın işlemeli, inci ve ışık halkalı sayaç çemberi |
| `assets/sukun-nur-orbit-r757.svg` | Vektör | Bağımsız hareket eden ışık çizgileri |
| `design/sukun-nur-concept.png` | 887 × 1774 | Görsel yönü gösteren tasarım; çalışan uygulama ekran görüntüsü değildir |

PNG dosyaları üretim çıktısından byte düzeyinde aynı kopyalandı; yeniden
boyutlandırılmadı ve kayıplı sıkıştırılmadı. Bunlar 4K dosyalar değildir.
Master dosyaların üretim istemleri `design/PROMPTS.json` içindedir;
yerleşik image_gen kullanıldı.

## Katmanlar ve hareket

1. `#r717Scene` tek arka planı taşır. Sayaç kartında tekrarlayan ikinci bir
   sahne yerine şeffaf yüzey kullanılır. Mobilde küçük eski görsele geçilmez.
2. `#r716Flames` içindeki RGB master değişmeden korunur. r758 inline SVG filtresi siyah piksellerin alfasını sıfırlar; çok sönük pikselleri kademeli saydamlaştırır. `screen` katman karıştırması kullanılmaz.
3. Ana halka 64 saniyede, iki SVG ışık katmanı 28 ve 43 saniyede saat yönünün tersine döner. Sayı ve kontroller canlı HTML olarak kalır.
4. Mevcut `SukunR716Shell` hareket sahibidir. Ana zikir ve tefekkürde Canlı tercihi geçerlidir; Sabit, azaltılmış hareket, pil modu, gizli sekme ve bilgi penceresi dönüşü durdurur. Yeni sürekli JavaScript çizim döngüsü yoktur.

## Kurulum

ZIP içindeki `nero.html`, `sw.js`, `manifest.webmanifest`, `assets/` ve
diğer uygulama dosyalarını aynı kök dizin yapısıyla birlikte kullan.
Sadece HTML dosyasını taşımak yeni görselleri getirmez. Yeni üç çalışma
görseli Service Worker çekirdek önbelleğine eklenmiştir. Kilitli atlas
sayfaları r756'daki gibi istek üzerine yüklenir.

Uygulama bu çalışma sırasında canlı siteye yayımlanmadı. Gerçek cihazda
FPS, termal davranış, Android ses/kilit ekranı ve son görsel yerleşim
ölçülmedi. Dosya kalitesi korundu; tüm cihazlarda aynı akıcılık veya
konseptle piksel düzeyinde eşleşme garanti edilmez.

## Tekrar doğrulama

`node diagnostics/r757/test_all.cjs`

Bu komut izole kaynak/VM ve DOM-fixture testlerini çalıştırır; bir
tarayıcı veya fiziksel cihaz testi değildir. Birleşim raporu kökteki
`RAPOR_r758.md`, kaynak farkı `diagnostics/r758/SOURCE_DIFF.patch` içindedir.
