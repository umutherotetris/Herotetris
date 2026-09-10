# RAPOR r749 — Berhetiyye ve Esmâ kaynak entegrasyonu

## Berhetiyye kaynağı
- `Berhetiyye_Cosmic_Architecture.pdf` 15 sayfa olarak incelendi.
- Her sayfa 1280 px genişlikte WebP'ye dönüştürülerek `assets/berhetiyye-cosmic/` altına yerleştirildi.
- Görseller yalnız Gizli Kasa açıldıktan sonra DOM'a bağlanır; kilitleme sırasında galeriden kaldırılır.
- Tam ekran sayfa görüntüleyici, önceki/sonraki, klavye okları, Escape ve yatay kaydırma hareketi eklendi.
- Atlas içindeki havâs, ay menzili, ebced, element, zaman/mekân ve ruhânî yorumlar kaynak/yorum katmanı olarak etiketlendi; nass veya bilimsel doğrulama gibi sunulmadı.

## Esmâ kaynağı
- `Esmâ Kartları · Diriliş r50` içindeki 99 kayıt kaynak verisi olarak gömüldü.
- Kaynak dosya 98 benzersiz isim içeriyor: `Allah` iki kez bulunuyor; `Ehad` ve `Vâlî` için ayrı kaynak kartı yok.
- SÜKÛN'un mevcut 99'luk zikir sırası değiştirilmedi. Arapça isim eşlemesiyle 97 mevcut isim kaynakla derinleştirildi; `0. Allah` Lafza-i Celâl kartı kaynak bilgi kapısı oldu.
- Seçili Esmâ için yeni `Esmâ Kaynak Derinliği` panelinde anlam, tevhid zikri, mahiyet, âyet, hadis aktarımı, Peygamberimizdeki tecelli, kâinattaki tecelli, tersinme/gölge ve dengeleyici esmâlar gösteriliyor.
- Aktif isim bilgi kartına da özet kaynak katmanı bağlandı.

## Sürüm ve önbellek
- HTML build, manifest, Service Worker, cache ve build marker `r749` olarak eşitlendi.
- Berhetiyye sayfa görselleri install sırasında önceden çekilmez; kasa açıldıktan sonra istek üzerine yüklenip normal runtime cache'e girer.
- r748 SW sözleşme onarımı ile r746/r747 görsel katmanları korunur.

## Doğrulama
- Yeni r749 runtime bloğu ve paketteki klasik JavaScript blokları Node sözdizimi denetiminden geçti; özel `text/x-sukun-tpl` şablonları JS olarak değerlendirilmedi.
- Chromium mobil smoke testi: r749 açılışı, mevcut Tefekkür sayaç koruması ve akıllı isim başlığı regresyonu 3/3 geçti; `pageerror` oluşmadı.
- Kaynak entegrasyonu smoke testi 6/6 geçti: 99 kayıt / 98 benzersiz kaynak adı / 97 mevcut Esmâ eşleşmesi, Ehad için güvenli eksik-kaynak davranışı, `0. Allah` kartı, Berhetiyye 15 sayfa mount ve kilitleme-unmount akışı doğrulandı.
- Berhetiyye görsel dosyaları kasanın metin haritası gibi kriptografik olarak şifrelenmiş değildir; paket içinde varlık dosyalarıdır. Uygulama arayüzünde yalnız kasa açıldıktan sonra yüklenir. Bu ayrım kullanıcıya yanlış güvenlik iddiası vermemek için açık tutuldu.
