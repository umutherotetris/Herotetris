# SÜKÛN r715 — Feyz Shell Theme Integration

Tarih: 2026-09-08
Baz sürüm: r714

## Yapılanlar
- Tüm uygulamaya yeni **Feyz Shell** görsel kabuğu giydirildi.
- Genel arka plana tefekkür sahnesi tabanlı düşük opaklıklı mistik doku eklendi.
- Header, sekme çubuğu, kartlar, dock ve alt/üst navigasyon cam görünümlü premium yüzeye taşındı.
- Butonlar kapsül formda yeniden parlatıldı; ana aksiyonlar zümrüt–mavi, çıkış/durdurma aksiyonları mor ağırlıklı işlendi.
- Girdi alanları ve seçim kutuları yeni tema ile uyumlu hale getirildi.
- Tefekkür/Zikir sahnesinde sayaç çemberi hafif yukarı alındı.
- Sayaç çevresine mor neon alev halkası eklendi; maske ve z-index düzeniyle Hedef/Kalan kutularının üstüne taşmaması hedeflendi.
- Kullanıcının kayıtlı tema tercihi yoksa ilk açılışta **kuzey** teması varsayılan atanır.
- Build kimliği r715 olarak güncellendi: HTML meta, manifest, SW, sürüm kaydı ve build marker hizalandı.

## Değişen Dosyalar
- `nero.html`
- `sw.js`
- `manifest.webmanifest`
- `surumler.json`
- `__sukun_build_r715__.json`

## Not
- Bu sürümde odak görsel shell entegrasyonudur; r714 performans davranışları korunmuştur.
- Gerçek Android cihazda özellikle şu başlıklar ayrıca doğrulanmalıdır:
  - Tefekkür ekranında Hedef/Kalan ile halka arası mesafe
  - Mini/Midi/Max dock geçişleri
  - Kayıt/TTS ve Pause/Stop akışı
  - Service Worker cache yenilenmesi
