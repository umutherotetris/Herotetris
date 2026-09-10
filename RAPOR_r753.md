# SÜKÛN r753 — Berhetiyye bağlamını bütün yüzeylere yayma

## Yapılan iş
- r752’de yalnız aktif Berhetiyye bilgi kartında görünen **premium kaynak derinliği**, artık diğer ilgili yüzeylere de yayıldı.
- Aşağıdaki yüzeyler zenginleştirildi:
  1. **Berhetiyye isim listesi** (`#zList`, rich list görünümü): her isimde mini meta şerit
  2. **Berhetiyye Atlası** (`#berhetAtlasBody`): aktif isim için geniş bağlam bloğu
  3. **Atlas karşılaştırma kutusu** (`#r170Compare`): A/B isimlerini ruhânî damar ve unsur eşleşmesiyle karşılaştıran yeni kartlar
  4. **28 İsim Seyri paneli** (`#berhetSeyir`): o anki isim için bağlam kartı
- Böylece kullanıcı yalnız bilgi katmanında değil, seçim, karşılaştırma ve seyir akışında da aynı semantik dili görür.

## Tasarım / içerik ilkesi
- Unsur, esîr, menzil ve **7 Ruhânî Damar** verileri korunurken bunların **yorum katmanı** olduğu açık tutuldu.
- “Hepsine yay” talebine uygun biçimde tek bir premium kartı çoğaltmadım; onun bilgisini her yüzeye uygun yoğunlukta yeniden biçimlendirdim. Bu daha doğruydu. Çünkü her yere aynı blok yapıştırılsaydı arayüz şişerdi ve seyir akışı hantallaşırdı.

## Teknik notlar
- Patch, mevcut r752 akışını kırmamak için **ek style + ek script** olarak eklendi.
- Değişiklikler DOM güncellemelerini izleyerek kendini yeniler; temel render fonksiyonlarını agresif biçimde ezmez.
- Manifest / SW / build marker `r753` olarak güncellendi.

## Üretilen dosyalar
- `nero.html`
- `manifest.webmanifest`
- `sw.js`
- `SUKUN_r753_RELEASE.json`
- `__sukun_build_r753__.json`
