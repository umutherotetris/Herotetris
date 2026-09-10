# SÜKÛN r758 · Şeffaf çember, mobil açıklamalar ve dönüş onarımı

Taban: r757. r756 kaynak içeriği ve önceki ses/sayaç düzeltmeleri korunur.

## Düzeltilen nedenler

- Siyah çember görseli gerçek alfa içermiyordu; `screen` kuralı yalnız belirli sayaç yerleşimlerine uygulanıyor ve katman izolasyonu sonucu siyah kare görünüyordu. Her iki yerleşimde aynı SVG renk matrisi siyahın alfasını sıfırlar. RGB ana dosya değiştirilmedi. Çok sönük pikseller kademeli saydamlaşır; parlak işlemelerin RGB değerleri korunur. Bu, bağımsız saydam PNG dosyası değil, tarayıcının çizim filtresidir.
- Önceki stil ana halkada `animation:none!important` uyguluyordu; hareket kapısı da yalnız tefekkürü kabul ediyordu. Ana zikir ve tefekkür aynı hareket sahibini kullanır. Halka 64, ışık katmanları 28 ve 43 saniyede, saat yönünün tersine bir tur döner. Eski çakışan dış yörünge kaldırılır. Sabit, azaltılmış hareket, pil, kapalı sekme ve açık bilgi penceresi hareketi durdurur.
- Eski opak tefekkür zemini ve yinelenen dekor katmanları kaldırıldı; ortak arka plan görünür bırakıldı. Metin merkezinde okumayı destekleyen sınırlı bir tonlama vardır.
- Yedi basamaklı yatay grid, kapsayıcıların otomatik asgari genişliğini büyütüp tüm açıklama kartını taşırıyordu. Grid zinciri daralabilir hale getirildi; basamaklar dikey sıralanır, mobil bilgi kutuları tek sütuna iner, uzun ifadeler sarılır.
- Bilgi kartı canlı sayaç olaylarında tetikleyici konumuna taşınıyordu. Artık kullanılabilir viewport içinde sabitlenir; yalnız viewport boyutu değişince geometrisi güncellenir. İçerik doğal dikey kaydırılır, kapatma düğmesi üstte kalır. Yeniden açma ve kapanma odağı güvenli hale getirildi; sayfa kapanışında bilgi katmanının kilidi temizlenir.

## Doğrulama

166/166 kaynak, izole VM/DOM-fixture ve stil sözleşmesi kontrolü geçti.
Yeni 11 kontrol; ana zikir hareketi, sayfa/katman geçişleri, 320–390 px ve yatay viewport geometrisi, 100 sayaç olayı boyunca okuma konumunun korunması, kapanış odağı, siyah-alfa hesabı, dönüş yönü ve daralabilir kart kurallarını kapsar.

Tarayıcıda hesaplanmış CSS, gerçek dokunma, GPU/FPS ve Android cihaz testi yapılmadı. Stil ve matematik kontrolleri, telefonda görsel doğrulamanın yerini tutmaz. Tıklama/kaydırma sorunuyla ilişkili bulunan nedenler düzeltildi; tüm cihazlarda sorunsuzluk iddiası yoktur.

Tekrar çalıştırma: `node diagnostics/r757/test_all.cjs` (r758 kontrollerini de çalıştırır).
Sonuç: `diagnostics/r758/verification.json`; fark: `diagnostics/r758/SOURCE_DIFF.patch`.

## Kullanım

ZIP içeriğini `assets/` dahil birlikte kullan. Alt sürüm etiketinde r758 görünmelidir. Canlı siteye dağıtım yapılmadı.
Cihazda özellikle: Canlı modda ana sayaç ve tefekkür dönüşü; açıklamayı en alta kaydırıp kapatma; açık kart sırasında sayım; Sabit/Canlı geçişi kontrol edilmelidir.
