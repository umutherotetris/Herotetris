# SÜKÛN r770 — Mücevher Sarayı · üçüncü görünüm

Tarih: 11 Eylül 2026 · Baz: r769

## Ne eklendi

Yüklediğin gece sarayı görselinin yönü — safir gece, sıcak altın çerçeve, çok taşlı vurgular — üçüncü bir görünüm olarak kabuğa girdi: **Mücevher Sarayı** (`mucevher`).

Mevcut ikisi tek renk ailesi üzerinden çalışıyordu: Osmanlı Mührü sıcak bakır-altın, Semerkant Neon soğuk turkuaz-mor. Üçüncüsünün ayrı durması için tek renk yerine **çok taşlı** bir yön seçildi:

| | zümrüt | yakut | ametist | safir | altın |
|---|---|---|---|---|---|
| Mücevher | `#3ddda6` | `#ff5f80` | `#a874ff` | `#4f8dff` | `#f2d18a` |

Yüzey `#06202f` safir gecesi, çizgi rengi `rgba(242,209,138,.24)` altın tel.

Görsel katman:
- Başlığın altında ince, çok taşlı bir ray (zümrüt → altın → yakut → ametist → safir).
- Kartlarda altın tel iç kenar; ana kartta taçlı çift kemer.
- Alt kenarda ve iki yanda fener sıcaklığı, üstte ay ışığı — görseldeki su yansıması ve fener havuzları buradan.
- Birincil eylem düğmesinde sıcak altın kenar.
- Seçicide dört görünümün örnek şeridi birbirinden ilk bakışta ayrılıyor.

Görünüm seçicisi üç sütundan iki sütuna alındı; dört seçenek 2x2 oturuyor, dördüncüsü tek başına satırda kalmıyor.

## Sözleşmeye sadık kalındı

Skin değişimi yalnız **CSS değişkenleri ve data katmanında** yaşıyor. Motor, oturum, transport, sayaç ve DOM sahipliği bu turda hiç değişmedi. Eski kayıtlar korunuyor: `halvet` → Semerkant, `jewel` → Mücevher, tanınmayan değer → Osmanlı Mührü.

Dokunulan yerler: r619 ve r620 runtime'larındaki kayıt/normalizasyon, Regression Shield'in skin sözleşmesi ve onarım yolu, seçici ızgarası, bir yeni stil bloğu (`r770-mucevher-skin`).

## Kendi hatam

İlk denemede ana kartın köşelerine taş parıltısı koymak için `#r616HomeHero::after` sözde-öğesini kullandım. O sözde-öğe kabuğun kendi büyük ışık şekliymiş; `box-shadow` ile ezince kart iri yeşil bir lekeye döndü. Ekran görüntüsünde görüp geri aldım. Süs istenirse yeni bir DOM öğesi gerekiyor, o da skin sözleşmesini bozardı — bu yüzden mücevher vurgusu rayda ve kenar çizgilerinde kaldı.

## Doğrulama

- `node diagnostics/r757/test_all.cjs`: **174/174 PASS** (source 31, mini 5, restart 10, failure 8, transport 7, ring 6, audit 15, storage 15, settings_queue 8, studio 19, ui 13, visual_sources 18, repairs 11, seal 8).
- `diagnostics/r770/test_skin_r770.py`: **9/9 PASS** — kayıt, uygulama, kalıcılık, üç görünümün gerçekten farklı olması, Shield sözleşmesi, seçici düzeni ve taşma, yeniden yüklemede korunma, eski değer eşlemesi, sıfır konsol hatası.
- 204 çalıştırılabilir modül ve `sw.js` sözdiziminden geçti; bloklar arası sözcüksel çakışma yok.
- Servis işçisi `sukun-r770-20260911a` ile kuruldu, 28 dosya önbelleğe alındı, çevrimdışı açılışta build `r770` ve seçili görünüm `mucevher` korundu.

## Sınırlar

Fiziksel Android, gerçek ekran kalibrasyonu ve PWA kurulumu bu ortamda test edilmedi. Renkler masaüstü Chromium'da ölçüldü; telefon ekranında altının sıcaklığı farklı düşebilir, istersen tek değişkenle (`--r619-gold`) ayarlarız.

Görseldeki mücevherli halka ve fotoğrafik saray arka planı bu turda **yapılmadı**: ikisi de sayaç çizimine ve yeni görsel varlıklara dokunmayı gerektiriyor, skin sözleşmesinin dışına çıkıyor. İstersen ayrı bir tur olarak ele alırız.

## Kurulum

Önce Amel Defteri yedeği al, r769 ZIP'ini sakla. HTML, SW, manifest, ikonlar ve `assets/` aynı köke birlikte yüklenmeli. Beklenen build: **2026-09-11-r770**. `skipWaiting` yok; güncelleme bekleyende kalır, "Yenile" dediğinde aktive olur.
