# RAPOR_r746 — Esmâ kart entegrasyonu

## Yapılanlar
- Esmâ-ül Hüsnâ / Berhetiyye için aktif zikir sahnesine yeni bir **bilgi kartı** eklendi.
- Kart; Arapça isim, Türkçe başlık, kısa açıklama, ebced/meta çipleri ve bağlamsal etiketler gösteriyor.
- Kartın tamamı dokunulabilir yapıldı; tıklanınca mevcut aktif isim detay katmanını açacak şekilde bağlandı.
- Zikir listesi, kompakt mod dışında **kart görünümüne** yükseltildi.
- Geniş listede her öğeye sıra numarası, Arapça isim ve kısa anlam önizlemesi eklendi.
- `renderList()` güvenli biçimde override edilerek mevcut kategori mantığı ve kompakt tek satır davranışı korundu.
- `renderZikir()` wrapper ile sahne kartı her seçim değişiminde yenilenir hâle getirildi.
- Build/manifest/service worker sürümü r746 olarak güncellendi.

## Korunanlar
- Tek sıra kompakt liste davranışı
- Arama akışı
- Mevcut `#r611CurrentZikirName` detay tetikleyicisi
- Var olan sayaç/tefekkür sahiplik yapısı

## Dikkat
- Bu sürüm görsel entegrasyon ağırlıklıdır; davranışsal ses akışı veya sayaç mantığına müdahale edilmedi.
- Bazı isimlerde anlam alanı boşsa kart kısa açıklamayı mevcut veri alanlarından türetir.
