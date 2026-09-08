# SÜKÛN r728 — Containment Çelişkisinin Çözümü ve Paket Hijyeni

**Tarih:** 9 Eylül 2026
**Temel:** r727
**Kapsam:** `content-visibility` kapsamı ve servis işçisi asset listesi. Ses, sayaç, kayıt, seyir ve görsel kabuk sahipleri değişmedi; JavaScript davranışı r727 ile aynı.

## 1 · `content-visibility:auto` ile doğal akış sahibi çelişiyordu

r214'ten beri `.card` seçicisi `content-visibility:auto` + `contain-intrinsic-size:1px 260px` alıyordu; bu, zikir denetim kartını da kapsıyordu. İki ölçülmüş sonuç:

**Paint containment sürekli açık.** İzole testte, `content-visibility:auto` olan bir kartın dışına taşan çocuk hiç boyanmadı — beklenen kırmızı pikselin yerinde siyah arka plan vardı; aynı çocuk normal kartta göründü. Hit-test de aynı sonucu verdi. Yani r600 doğal akış sahibinin, akış dışı içerik sığsın diye kartın minimum yüksekliğini genişletme işi baştan boşa gidiyordu: o içerik zaten boyanmıyordu.

**Atlanan kart gerçek boyutunu bildirmiyor.** Görüntü alanı dışına çıkan bir kart 830/828/828 yerine 290/288/288 bildirdi — yani `contain-intrinsic-size` yer tutucusunu. Ölçücü böyle bir anda çalışırsa `needed` değerini uydurma sayılardan hesaplar. Ayrıca kartlar ilk kez görüntülendiğinde belge yüksekliği 9580'den 10660'a sıçradı; bu, kaydırma sırasında konum kaymasının kaynağıdır.

**Düzeltme.** Zikir kartı (`.card:not(.zCtl)`) kapsamdan çıkarıldı — sekmesinin ana içeriği olduğu için atlanmasından kazanç zaten yoktu. Kalan dört kartta `contain-intrinsic-size:auto 1px auto 260px` kullanılıyor: bir kez görüntülenmiş kart tekrar atlandığında gerçek boyutunu hatırlar, belge yüksekliği sıçramaz.

**Yerleşim etkisi ölçüldü:** kart içindeki 2.968 elemanın konum ve boyutunda containment açık/kapalı arasında **sıfır fark**; gürültü tabanı da sıfır. Belge yüksekliği aynı. Beş sekmenin tam sayfa piksel karşılaştırmasında dört sekme birebir aynı; zikir sekmesindeki %0,6'lık farkın %91'i yüksek kontrastlı metin kenarında — paint containment kalkınca değişen yazı antialias'ı, yerleşim değil.

## 2 · Servis işçisi kurulumunu bloklayan kullanılmayan assetler

`CORE` listesi "eksikse kurulum başarısız olsun" sözleşmesiyle çalışıyor. Bu listede uygulamanın hiç referans vermediği üç dosya vardı: `feyz-mark.svg`, `feyz-flame-ring.svg`, `feyz-flame-ring.webp`. HTML yalnız bunların `-r718` sürümlerini kullanıyor. Kullanılmayan bir dosyanın 404 vermesi tüm güncellemeyi düşürebilirdi. Üçü de `OPTIONAL`'a alındı: hâlâ önbelleğe alınıyorlar (kaçırdığım bir referans olma ihtimaline karşı) ama artık kurulumu bloklamıyorlar. `CORE` 18'den 15 girişe indi ve her girişin HTML'de gerçek referansı olduğu doğrulandı.

Hiçbir yerde — HTML, servis işçisi, manifest, sürüm dosyaları — referansı olmayan üç artık dosya paketten çıkarıldı: `feyz-app-icon-r718.svg`, `feyz-app-icon-maskable-r718.svg`, `feyz-flame-ring-r718.svg`. Gerekirse r726/r727 ZIP'lerinden geri alınabilirler.

## Doğrulama
- **11/11 gerçek tarayıcı bataryası** (`diagnostics/r728/test_full_r728.py`): build kimliği, sıfır konsol/sayfa hatası, zikir kartının containment dışında ve diğer kartların `auto` intrinsic boyutta olması, containment değişiminin yerleşim-nötr olduğu, beş sekmede taşma yokluğu, tüm görünür kontrollerin hatasız tıklanması, r727'nin dokunma düzeltmelerinin korunması, `sukun-r728-20260909a` önbelleğiyle çevrimdışı açılış, erişilebilirlik.
- **8/8 izole akış testi** (`diagnostics/r728/test_flow_r728.py`): r726 ve r727 davranış sözleşmelerinin tamamı korunuyor.
- 190 çalıştırılabilir inline blok + `sw.js` için `node --check`: 0 hata; bloklar arası sözcüksel çakışma: 0. Tüm JSON dosyaları geçerli.
- `CORE`/`OPTIONAL` bütünlüğü: eksik dosya yok, HTML'in istediği her asset önbellek listesinde.

**Sınır:** Bu testler gerçek Android dokunması, ses duyumu, mikrofon, kulaklık veya kilit ekranı değildir. Containment kaldırmanın gerçek cihazdaki kaydırma etkisi ayrıca ölçülmelidir; buradaki kanıt yerleşimin değişmediği ve çelişen iki mekanizmanın ayrıldığıdır.

## Devralınan açık konular
r726'dan gelen ve bu turda ele alınmayanlar: DOM hydration kaynaklı uzun görevler, r725 modal/dock düzeltmesinin fiziksel Android doğrulaması, `voice-false / restored:false` olayının gerçek sayaç kaybı mı seyir sahipliği geçişi mi olduğu, 28/99 Seyri için kilit ekranı ve donanım transport saha testi, isteğe bağlı sistem tam ekran sözleşmesi.

## Kurulum
Önce Amel Defteri yedeği alın, r727 ZIP'ini saklayın. HTML, SW, manifest, ikonlar ve `assets/` aynı köke birlikte yüklenmeli. Tarayıcı verilerini/IndexedDB'yi silmeyin. Beklenen build: **2026-09-09-r728**. `skipWaiting` yok; güncelleme bekleyende kalır, "Yenile" dediğinizde aktive olur.
