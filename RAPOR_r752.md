# SÜKÛN r752 — Berhetiyye premium kaynak kartı entegrasyonu

## Yapılan ana işler
- Berhetiyye aktif isim bilgi kartı tamamen yükseltildi.
- Kart artık yalnız satır satır metin göstermiyor; ilgili isim için:
  - uygulama yorumu
  - şerhte karşılık
  - tefekkür işareti
  - ebced / menzil / adet
  - unsur ve tabiat bağlamı
  - ilgili unsur grubundaki kardeş isimler
  - 7 Ruhânî Damar içindeki yeri (varsa vurgulu)
  - varyant notu
  birlikte tek premium kartta gösteriliyor.
- Görsel dil, çalışma kısmında hazırlanan neon-cam-altın mockup yönüne yaklaştırıldı.

## Entegrasyon mantığı
- Mevcut `r642` aktif isim açıklama katmanı bozulmadı.
- Yalnız `cat === "berhet"` durumunda kart post-process edilerek premium sürüme çevrildi.
- Esmâ tarafı ve diğer zikir tipleri eski davranışını korur.

## Kaynak temelli bağlar
- Element / Esîr haritası eşleşmeleri yorum katmanı olarak işlendi.
- 7 Ruhânî Damar görselindeki 1–7 sıra, ilgili isim kartına bağlandı.
- Bu bağlar kesin nass gibi değil, açıkça sembolik / tasavvufî bağlam etiketiyle gösterilir.

## Sürüm senkronizasyonu
- HTML meta build: `r752`
- Service Worker: `r752`
- Manifest: `r752`
- Build marker: `__sukun_build_r752__.json`
- Cache: `sukun-r752-20260910a`

## Not
- Bu iş kullanıcı isteğine uygundur: görsellerdeki bilgiyi SÜKÛN içine gömülü, canlı ve ilgili isme özel bilgi kartı hâline getirir.
