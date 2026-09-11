# SÜKÛN r771 — Sayaç halkasına taşlar ve peek görsel-viewport takibi

Tarih: 11 Eylül 2026 · Baz: r770

## 1 · Mücevherler

Zikir sayacının halkası Mücevher Sarayı görünümünde taşlandı: altın yuva üzerinde saat yönünde **12 taş** (zümrüt, ametist, yakut, safir sırayla) ve aralarında **12 inci**, ardında sıcak fener yansıması. Görseldeki mücevherli halkanın dili bu.

Nasıl yapıldı: taşların hepsi `#ringHost::before` üzerinde duran **25 radial-gradient**. Animasyon yok, canvas yok, yeni DOM öğesi yok. Her taş üç kademeli (parlak yüz → ana renk → koyu faset kenarı), bu yüzden küçük boyutta düz bir nokta değil, kesilmiş taş gibi okunuyor.

Yerleşim kararları:
- Taş kuşağı yarıçapın %35–43'ünde; ilerleme yayı (%47.8), mühür canvası ve rakamlar DOM sırasında sonra geldiği için taşların **üstünde** kalıyor. Okunurluk düşmüyor, `pointer-events:none` olduğu için dokunuşu yemiyor.
- `#ringHost::before` ve `::after` bu dosyada hiç kullanılmıyordu; önce kontrol edildi. r770'te `#r616HomeHero::after`'ı ezip kartı yeşil bir lekeye çevirmiştim — o hata tekrarlanmadı.
- Görsel efektler kapalıyken ve düşük performans profilinde halo tamamen kapanır, taşlar kalır.
- Diğer iki görünüm hiç etkilenmez: Osmanlı ve Semerkant'ta `::before` sıfır gradient üretiyor (ölçüldü).

İlk denemede altın yuva taşların çok içinde kaldı: `radial-gradient`'in varsayılan `farthest-corner` boyutlandırmasında yüzde duraklar öğe genişliğine değil köşe uzaklığına göre ölçekleniyor. `circle farthest-side` ile düzeltildi; yuva artık taşların tam altında.

## 2 · Tanıdan çıkan hata: peek ekranın altında kalıyordu

r770 cihaz tanısındaki tek YÜKSEK bulgu yine `#r433DockPeek` idi: görünür alanın **48.4px altında** (r743'te 104.8px). Tanıdaki sayılar sebebi net gösterdi:

```
adaptiveDockLayout.peek  = {top: 685.4, bottom: 739.4, offset: 8}
layout.viewportHeight    = 747.4        (layout viewport)
overflowDebug.viewport.h = 691          (görsel viewport, URL çubuğu açık)
```

Yerleştirme kodu **yanlış değil**: `placePeek` görsel viewport'un altına göre hizalıyor ve çalıştığı anda doğru sonuç veriyor. Sorun **ne zaman çalıştığı**. Android'de URL çubuğu görünüp kaybolurken layout viewport sabit kalır, görsel viewport kısalır; `position:fixed` peek layout viewport'a göre yerleştiği için çubuk geri gelince görünür alanın dışında kalıyor. O an tam `measure()` pan kapısında bekletiliyor (parmak ekranda), dolayısıyla düzeltme gecikiyor.

Düzeltme: pahalı `measure()` yoluna ve pan erteleme davranışına **dokunulmadı** — onlar mobil kaydırma jank'ini azaltmak için bilerek böyle. Yanına yalnız peek'i tazeleyen ucuz bir yol açıldı: kare başına en fazla bir kez, viewport imzası değişmediyse tek okuma bile yapmadan, pan kapısına takılmadan. `window.SukunPeekViewportR771` ile tanıya da açıldı ve `adaptiveDockLayout.peek` anlık görüntüsü gerçek konumu bildirmeye devam ediyor.

## Doğrulama

- `node diagnostics/r757/test_all.cjs`: **174/174 PASS**
- `diagnostics/r771/test_peek_viewport_r771.py`: **6/6 PASS** — kontrol edilebilir bir `visualViewport` sahtesiyle URL çubuğu simüle edildi; çubuk görününce peek görünür alanda kalıyor, **parmak ekrandayken bile** düzeliyor, viewport değişmediğinde 40 olay tek ölçüm üretmiyor, tanı anlık görüntüsü gerçek konumu bildiriyor. Testler boş dikdörtgen üzerinden geçmesin diye her adımda peek yüksekliği (54px) ayrıca doğrulanıyor.
- `diagnostics/r771/test_jewels_r771.py`: **5/5 PASS** — taşlar yalnız Mücevher'de, rakamların altında, dokunuşu yemiyor, 320/360/390/412px'te ölçekleniyor ve taşma yok.
- `diagnostics/r770/test_skin_r770.py`: **9/9 PASS**
- 204 çalıştırılabilir modül + `sw.js` sözdiziminden geçti; bloklar arası sözcüksel çakışma yok.

## Tanıda görülüp bu turda düzeltilmeyenler

- **Uzun görevler:** 113 saniyede 94 uzun görev, en uzunu 163ms; `setTimeout` ~106/sn, `requestAnimationFrame` ~138/sn (iki sürekli döngü). Tanının kendi WARN'u da bunu işaret ediyor. Kaynağını bulmak profilleme gerektiriyor, kör bir yama doğru olmaz.
- **`unresolved-cancel 11` ve `no-click-observed 3`** (125 pointerdown içinde). Kaydırma kaynaklı 84 iptal normal, bu ikisi değil — ama bu oturumda örneklem küçük.
- **TEFEKKÜR / “İsteğe bağlı sistem tam ekranı”** hâlâ FAIL: sözleşme hiç yazılmamış. Eksik özellik, bozulmuş davranış değil.
- LIFECYCLE WARN'u (gerçek arka plan/geri dönüş gözlenmedi) 113 saniyelik oturumun doğal sonucu, hata değil.

**İyi haber:** r743'te bildirdiğim `ui.tefekkur` / `stateAuthority.ui.tefekkur` çelişkisi bu tanıda **yok**; ikisi de `false`. Regression Shield 39/39 PASS, `runtime.errors` boş.

## Sınırlar

Peek düzeltmesi kontrol edilebilir bir `visualViewport` sahtesiyle doğrulandı — bu, gerçek Android URL çubuğu davranışının **modeli**, kendisi değil. Fiziksel cihazda bir tur daha tanı alıp `#r433DockPeek` bulgusunun kaybolduğunu görmek gerekiyor. Taşların rengi masaüstü Chromium'da ölçüldü; telefonda altın sıcak düşerse tek değişkenle ayarlanır.

## Kurulum

Önce Amel Defteri yedeği al, r770 ZIP'ini sakla. HTML, SW, manifest, ikonlar ve `assets/` aynı köke birlikte yüklenmeli. Beklenen build: **2026-09-11-r771**. `skipWaiting` yok; güncelleme bekleyende kalır, "Yenile" dediğinde aktive olur.
