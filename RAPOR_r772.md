# SÜKÛN r772 — Aktif isim tek sahibe bağlandı

Tarih: 11 Eylül 2026 · Baz: r771

## Belirti

Zikir sahnesinde Arapça ad hep görünüyor, Latin yazımı bazen görünmüyordu.

## Gerçek sebep

Arapça ve Latin **iki ayrı elemandan** geliyor: Arapça `#zAr`, Latin `#r611CurrentZikirName`. Arapça'yı yazan yol tek. Latin'i yazan **üç ayrı blok** vardı:

- r744 (`r611` runtime) — satır 60038 / 60043
- r767 `latinSync()` — satır 72063 / 72066
- r768 aktif cam sahibi — satır 72216

Üçü de aynı iki alana yazıyor ama politikaları farklıydı:

| | alan listesi | gizlilik kapısı | sekme kapısı |
|---|---|---|---|
| r744 | `tr\|t\|nm` (`oku` yok) | var → metni boşaltır ve **gizler** | var |
| r767 | `tr\|t\|nm\|oku` | var → çıkar, dokunmaz | var |
| r768 | `tr\|t\|nm\|oku` | **yok** | **yok** |

Kilitli bir Berhetiyye adında r768 yazmak, r744 gizlemek istiyor; kazanan olay sırasına bağlı. Arapça ayrı elemanda olduğu için bu kavgadan hiç etkilenmiyor — belirti tam olarak bu yüzden asimetrik.

**İkinci katman:** r767 hero'yu `#zAr`'ın *içine*, r768 `#r768ActiveGlassHost`'un *altına* taşıyordu. r768'in `#zAr` üzerinde bir MutationObserver'ı var, yani her taşıma diğerini yeniden tetikliyordu — ikisi birbirini geri alıyordu. CSS'te bunun izi duruyor: hem `#zStage>.zAr>#r611CurrentZikirHero` hem `#r768ActiveGlassHost>#r611CurrentZikirHero` için ayrı kural setleri yazılmış.

**Üçüncü katman:** r768'in `sync()`'inde yalnız *açma* yolu vardı. Çözücü null dönünce hiçbir şey yapmıyor, bir önceki ad ekranda kalıyordu.

## Düzeltme

Dosyada zaten bir sahip-bayrağı deseni var (`__SUKUN_R768_ACTIVE_GLASS_OWNER__`) ve üç blok onu okuyup geri çekiliyor. r744 ile r767, bayrağı **okumayan iki yerdi**. İkisini de bağladım; ad ve görünürlük yazımı tek sahibe (r768) kaldı. r744 ölçü ve sınıf işini sürdürüyor, yalnız o iki alana el sürmüyor.

Sonra tek sahibe eksik olan politikaları verdim:
- Gizlilik kapısı artık çözücüde de uygulanıyor (`SukunSecretPolicy.secretStep`).
- Sekme kapısı eklendi.
- Görünürlük iki yönlü: çözücü sonuç veremezse veya sahne aktif değilse ad **gizleniyor**; bayat ad ekranda kalmıyor.

## Doğrulama

- `diagnostics/r772/test_name_owner_r772.py`: **8/8 PASS** — tek sahip bayrağı, 20 örneklemede hero'nun tek ebeveyni (`r768ActiveGlassHost`), gerçek seçim yolundan (`#esmaNextBtn`) ad takibi ve bayat ad kalmaması, Arapça görünürken Latin'in de görünmesi, sekme dışında gizlenip dönünce geri gelmesi, gizlilik kapısı + iki yönlü görünürlük + sekme kapısının kaynakta bulunması, 20 olay altında sıfır titreme, sıfır konsol hatası.
- `node diagnostics/r757/test_all.cjs`: **174/174 PASS**
- r771 testleri korundu: peek görsel-viewport **6/6**, taşlar **5/5**, görünüm **9/9**.
- 204 modül + `sw.js` sözdiziminden geçti.

## Kendi hatalarım (bu turda)

Testi iki kez yanlış yazdım ve ikisini de kendi testim yakaladı:
1. `Z.idx`'e doğrudan yazarak seçim değiştirmeye çalıştım; uygulama kendi seçim yolunu koruduğu için atama tutmuyordu. "Bayat ad" gibi görünen sonuç **test artefaktıydı**, uygulama hatası değil. Gerçek yola (`#esmaNextBtn`) geçince ad 0→1 ile birlikte `Yâ Rahmân → Yâ Rahîm` oldu.
2. Kaynak taramasında blok ayırıcıyı yanlış seçtim; kapı kodu yerindeyken "yok" raporladı.

## Sınır

Belirtiyi tarayıcıda **istediğim anda tekrar üretemedim**; kasa kilidi açıkken kapının nasıl davrandığı cihazınıza bağlı. Düzeltme yapısal olarak doğru, regresyon üretmiyor ve üç sahibin çatışmasını ortadan kaldırıyor — ama "şu belirti gitti" demeden önce telefonda bir tur bakmanız gerekiyor. Latin ad bir daha kaybolursa tanı dosyasını atın, `ui` ve `stateAuthority.ui` altındaki değerlerle birlikte tek sahibin çözücüsünü izleyebiliriz.

## Kurulum

Önce Amel Defteri yedeği al, r771 ZIP'ini sakla. HTML, SW, manifest, ikonlar ve `assets/` aynı köke birlikte yüklenmeli. Beklenen build: **2026-09-11-r772**. `skipWaiting` yok; güncelleme bekleyende kalır, "Yenile" dediğinde aktive olur.
