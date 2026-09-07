# SÜKÛN r709 — açılış kilitlenmesi ve normalleştirici çakışması

**Tarih:** 7 Eylül 2026 · **Taban:** kullanıcının r708 tam paketi
**Kapsam:** Açılış performansı ve yerleşim okuyan normalleştiricilerin çağrı sıklığı.
Ses motoru, sayaç, seyir, kayıt önceliği, Tefekkür yerleşimi ve r706/r707 atmosferine dokunulmadı.

Ölçümler gerçek Chromium'da, **HTTP üzerinden** (`python3 -m http.server`), 390×844
mobil görünüm, dokunmatik ve mobil kullanıcı ajanıyla yapıldı. r708 raporunda
"yerel HTTP/file navigasyonu engellendiği için `set_content` kullanıldı" denmişti;
burada gerçek sunucu üzerinden ölçülebildi.

---

## Ölçülen durum (r708)

| An | DOM değişikliği | Ana iş parçacığı kilitlenmeleri |
|---|---|---|
| Açılıştan 5 sn sonra | ~362/sn | 301, 342, 347, **1733**, 827, 487, 488, 326 ms |
| Açılıştan 20 sn sonra | ~2/sn | yok |
| Açılıştan 40 sn sonra | ~4/sn | yok |

Kalıcı bir döngü yok. Uygulama ekranda görünüyor ama **ilk ~20 saniye kullanılabilir
değil**, sonra tamamen sakinleşiyor.

**"Çakışma" hissinin kaynağı büyük ihtimalle bu.** Ana iş parçacığı 1,7 saniye
kilitliyken dokunuşlar kuyruğa giriyor; kilit çözülünce hepsi birden boşalıyor.
Kullanıcı tarafından bu, "bastım olmadı, tekrar bastım iki şey birden oldu" diye
yaşanır.

Görsel çakışmayı ayrıca taradım (`diagnostics/probe_collision.py`): **yinelenen id yok,
gerçek hit-test çakışması yok.** Tarayıcının işaretlediği 14 "üstü örtülü buton",
açılış turu kartının (`#onboardCard`) modal olarak sayfayı örtmesinden ibaret —
beklenen davranış, hata değil.

---

## Bulunan ve düzeltilen hatalar

### 1. `syncAmbAccHeights` — profildeki en pahalı kalem (1652 ms)

Fonksiyon belge geneli MutationObserver'dan çağrılıyor:

```js
const mo=new MutationObserver(()=>{clearTimeout(sync._t);sync._t=setTimeout(sync,80)});
```

Açılışta saniyede 362 DOM değişikliği olduğu için bu zamanlayıcı sürekli yeniden
kuruluyor ve fonksiyon defalarca çalışıyor. Her çalışmada her akordeon için
`inner.scrollHeight` okunuyor — bu okuma tarayıcıyı **senkron yerleşime** zorlar.

r703'te oku/yaz sarmalını ayırmıştım; o düzeltme yerinde ve korundu. Ama asıl
sorun çağrı sayısıymış.

**Düzeltme:** akordeonların durumu (sayı + açık/kapalı + içerik + genişlik) bir
imzayla saklanıyor. İmza değişmediyse hiç ölçüm yapılmıyor.

### 2. Sahiplik çakışması: `repairAmbience` ↔ `syncAmbAccHeights`

Aynı özelliği iki sistem çekiştiriyordu:

```js
function repairAmbience(){
  ...
  if(acc.classList.contains('open'))body.style.removeProperty('max-height');  // siler
  else body.style.maxHeight='0px';
  try{window.syncAmbAccHeights?.()}catch(e){}                                 // geri yazar
}
```

`repairAmbience` açık panellerde `max-height`'i siliyor, hemen ardından onu geri
yazan fonksiyonu çağırıyordu. İmza kapısı eklenince bu çağrının atlanma riski
doğduğu için `repairAmbience` artık `syncAmbAccHeights(true)` ile **zorla**
çağırıyor. Sahiplik tek noktada kaldı, davranış birebir korundu (test: açık
panelde `2px`, kapalıda `0px` — r708 ile aynı).

### 3. `zMegaHost` genişlik düzeltmesi (`duzelt`, 951 ms)

Şuralara bağlıydı: her tıklama (`setTimeout 60`), `resize`, dört özel olay ve iki
sabit zamanlayıcı. Her çalışmada iki `getBoundingClientRect()` ile yerleşim
zorluyordu.

**Düzeltme:** çağrılar kare başına tek sefere toplandı. Yaptığı iş ve sonucu aynı.

### 4. Aynı değeri tekrar yazan DOM çağrıları

r703'te eklediğim koruma **r708'de düşmüş** (paketin içinde yok). Geri kondu.
Bir attribute'a aynı değeri yazmak DOM'da yine de mutation kaydı üretir; kayıt
merkezî yayını uyandırır, yayın aboneleri normalleştirmeye zorlar, onlar da yazar.
Ölçümde bir açılışta **859 gereksiz yazım** yutuldu.

---

## Sonuç

Aynı koşullarda, iki sürüm arka arkaya:

| | r708 | r709 |
|---|---|---|
| DOMContentLoaded | 9,2 sn | **6,7 sn** |
| `load` | 11,0 sn | **8,3 sn** |
| Sakinleşme | ~13 sn | **~11 sn** |
| JS CPU (açılış + 20 sn) | 5462 ms | **4614 ms** |
| En uzun kilitlenme | **1733 ms** | **411 ms** |
| Kilitlenme sayısı (6 sn'de) | 10 | **4** |
| Açılış sonrası DOM değişikliği | ~362/sn | **~125/sn** |

Regresyonlar: `test_r702` 31/31, `test_r705` 51/51, `test_r706` 15/15.
187 satır içi betiğin tamamı sözdizimi denetiminden geçti. Konsol JS hatası yok,
eksik kaynak (404) yok.

### r708 paketindeki mevcut bir tutarsızlık

`diagnostics/test_r707.cjs`, **değiştirilmemiş r708 paketinde de** 2/8 başarısız:
betik sayısını 187'ye ve build etiketini `r707`'ye sabitlemiş, r708 ise 190 betik
ve `r708` etiketiyle geliyor. Bu benim değişikliğimden kaynaklanmıyor —
r708 raporundaki "106/106" iddiası kendi paketindeki bu testle örtüşmüyor.
Sürüme sabitlenmiş testler her yeni yayında bu şekilde kırılır.

---

## Kalan asıl sorun — mimari

Açılış 6,7 saniyeye indi ama sıfırlanmadı, çünkü profildeki en büyük kalem hâlâ
`(program)`: **4,8 MB'lık tek dosyanın ayrıştırılması ve derlenmesi.** İçinde 187
çalıştırılabilir satır içi betik var ve ayrıştırıcı ilerlerken hepsi sırayla
çalışıyor. Bu iş bitmeden hiçbir şey etkileşimli olamaz. Hiçbir JS yaması bunu
çözemez.

r703'te bunun için tembel yükleme eklemiştim (NeuroSync motoru ve iki tanılama
bloğu `type="text/x-sukun-lazy"` ile işaretlenip ilk kullanımda ayrıştırılıyordu,
~930 ms). **O da r708'de düşmüş.** Bu sürüme geri koymadım: aradan beş yayın geçti,
blok sınırları değişmiş olabilir ve yanlış blok tembelleştirmek uygulamayı bozar.
İstenirse ayrı bir adımda, blok blok ölçüp yeniden yapılabilir.

Ölçüm bu kabın işlemcisinde. Gerçek Samsung cihazda süreler daha uzun olacaktır.

---

## Doğrulanamayanlar

- **Gerçek Android cihaz.** Ölçüm masaüstü Chromium'da, mobil görünüm ve mobil
  kullanıcı ajanıyla yapıldı.
- **Ses.** Web Audio çıkışı, kulaklık, mikrofon, kendi kayıtların, uzun süreli çalma.
- **Kilit ekranı / MediaSession.** Ekran kapalıyken isim geçişi, kulaklık tuşu.
- **Samsung Internet.** Yalnız Chromium motoru denendi.

Ayrıca r703'te not ettiğim ve hâlâ bakılmamış olan konu duruyor: sayfa açılışında
hiç ses çalınmamışken `AudioNode.connect` çağrıları `disconnect`'ten çok fazla.
Uzun oturumlarda ses düğümü birikmesi anlamına gelebilir; gerçek cihazda uzun
çalma testiyle bakılmalı.

---

## Testleri çalıştırmak

```sh
node diagnostics/test_r702.cjs .          # 31 kaynak regresyonu
node diagnostics/test_r705.cjs .          # 51
node diagnostics/test_r706.cjs .          # 15 atmosfer davranışı

python3 -m http.server 8899 &             # tarayıcı ölçümleri için gerekli
python3 diagnostics/probe_steady.py       # açılış / sakinleşme / kilitlenme
python3 diagnostics/probe_cpu.py          # açılış CPU profili
python3 diagnostics/probe_ab.py r709      # yük, sakinleşme, JS CPU
python3 diagnostics/probe_collision.py    # yinelenen id, hit-test, katman örtüşmesi
python3 diagnostics/probe_smoke.py        # işlevsel kontrol
```

## Paket

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, üç ikon ve
`__sukun_build_r709__.json` aynı dizine birlikte yüklenmeli. Sürüm etiketleri
(HTML meta, görünen etiket, manifest, SW sürümü/kayıt adresi/önbellek adı,
yapı işaretçisi, gömülü ve harici sürüm geçmişi) r709 ile hizalı.
Önbellek adı `sukun-r709-20260907a`. `CHECKSUMS_r709.sha256` dosyaları doğrular.
IndexedDB, kayıtlar ve localStorage'a dokunulmadı.
