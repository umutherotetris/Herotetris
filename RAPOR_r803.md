# RAPOR r803

## Hedef
- Berhetiyye’ye geçerken çok hafif fade / glow blend eklemek.
- Aktivasyonda daha asil bir hissiyat vermek.
- Normal sayaca geri dönüşte sade bir çözülme animasyonu sağlamak.

## Yapılanlar
- Özel yüzük için `opacity + filter + transform` tabanlı yumuşak geçiş tanımlandı.
- Berhetiyye aktif olduğunda `r803-berhet-entering` sınıfı ile kısa ve hafif bir giriş animasyonu eklendi.
- Girişten sonra kısa süreli sakin bir glow hold durumu eklendi.
- Berhetiyye kapanınca `r803-berhet-exiting` sınıfı ile sade bir fade-out / çözülme animasyonu verildi.
- Sayaçtaki rakamlar da çok hafif nefes alır gibi eşlik edecek şekilde mikro animasyon aldı.
- Reduced motion tercihine saygı için animasyonlar erişilebilirlik modunda kapanır.

## Beklenen sonuç
- Normal sayaçtan Berhetiyye yüzüğüne geçiş daha akıcı görünür.
- Giriş gösterişli değil, kontrollü ve asil hissedilir.
- Geri dönüşte ani kesilme yerine temiz bir çözülme olur.
