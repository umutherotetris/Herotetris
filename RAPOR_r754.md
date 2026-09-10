# SÜKÛN r754 — Berhetiyye derin Tefekkür + kaynak sıçrama + ayrı premium tema

## 1. Tefekkür ekranına daha derin bağ
Aktif zikir Berhetiyye olduğunda `#tfRefinedLayout` içindeki canonical kontrol alanına kompakt bir **Berhetiyye kaynak bağlamı** kartı eklenir. Kart:
- aktif ismi,
- görsel kaynakta varsa Element / Esîr grubunu,
- 7 Ruhânî Damar içindeki basamağını,
- SÜKÛN’un mevcut menzil / unsur verisini,
- kısa tefekkür işaretini
birlikte gösterir.

Kart `tfRefinedLayout` dışına çıkmadığı için önceki Tefekkür DOM sahipliği kuralını bozmaz.

## 2. Kaynak sayfasına tek dokunuş
Berhetiyye bağlam kartlarında üç tür kaynak sıçraması eklendi:
- **İsim matrisi**: 28 isim içindeki sıraya göre ilgili 1–7 / 8–14 / 15–21 / 22–28 görseline gider.
- **Element / Esîr**: isim gönderilen element görselinde yer alıyorsa doğrudan Element ve Esîr Haritası sayfasını açar.
- **7 Ruhânî Damar**: isim yedi basamak görselinde geçiyorsa doğrudan o kaynak sayfasını açar.

Mevcut kilit politikası korunur; Berhetiyye kilidi açık değilse kaynak görseli açılmaz.

## 3. Berhetiyye için ayrı premium tema dili
Berhetiyye seçiliyken uygulama `r754-berhet-theme` sınıfını alır. Zikir sahnesi, Berhetiyye atlası, 28 İsim Seyri, aktif isim ve bilgi kartı;
- derin gece mavisi,
- camgöbeği / mor ışık,
- altın detay
üçlüsünde ayrı bir kimlik kazanır. Boyut veya kontrol hiyerarşisi değiştirilmeden yalnız görsel dil ayrıştırılır.

## Kaynak ile mevcut veri çatışması
Gönderilen **Element ve Esîr Haritası** bazı isimleri SÜKÛN’un mevcut `unsur` alanından farklı bir grupta gösterebilir. r754 bunu sessizce düzeltmez veya birini diğerinin yerine koymaz. Kartta:
- **Görsel kaynak eşlemesi**
- **SÜKÛN mevcut veri katmanı**
ayrı ayrı gösterilir ve uyuşmazlık varsa açık bir katman ayrımı notu çıkar.

## Sürüm senkronizasyonu
- HTML meta: `r754`
- Manifest: `r754`
- Service Worker: `r754`
- Cache: `sukun-r754-20260910a`
- Build marker: `__sukun_build_r754__.json`

Ayrıca r753 paketinde kalan `r752` HTML build meta uyuşmazlığı r754 oluşturulurken düzeltilmiştir.
