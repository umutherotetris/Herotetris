# SÜKÛN · Feyz Nur / r757

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
2. `#r716Flames` içindeki PNG ayrıntılı çemberi taşır. Dosya RGB'dir;
   gerçek alfa kanalı yoktur. Siyah zemin CSS `mix-blend-mode: screen`
   ile ışık olarak birleştirilir. Uygulamaya dama desenli taslak eklenmedi.
   Bu birleştirme, hedef arka planla renkleri doğal olarak etkileştirir;
   her zeminde aynı piksel rengini koruduğu iddia edilmez.
3. Aynı çemberde iki SVG ışık katmanı 28 ve 43 saniyelik ters yönlü
   dönüşlerle hareket eder. İşlemeli ana halka sabit kalır. Sayı, yüzde,
   hedef ve düğmeler canlı HTML öğeleridir.
4. Hareketin sahibi mevcut `SukunR716Shell` modülüdür. Yeni sürekli
   JavaScript çizim döngüsü kurulmaz. Canlı Tefekkür görünümünde hareket
   eder; Sabit, azaltılmış hareket, pil modu, gizli sekme, bilgi kartı ve
   kaynak görüntüleyici durumlarında dekoratif hareket durur.
5. Berhetiyye kartları gerçek veri ve okunabilir metin kullanır. Unsur
   simgeleri cihaz emojisi yerine SVG'dir. Yedi basamak dar ekranda yatay
   kaydırılır; açıklamalar içerikten çıkarılmaz.

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
`RAPOR_r757.md`, kaynak farkı `diagnostics/r757/SOURCE_DIFF.patch` içindedir.
