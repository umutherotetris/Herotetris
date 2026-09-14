# SÜKÛN r819 — Sayaç Cerrahi Yeniden Kurulum

Bu sürümde sayaç sistemi üst üste yama eklemek yerine tek sahipli bir render mimarisine geçirildi.

## Kök değişiklikler
- r813/r815/r816/r817/r818 sayaç otoritesi scriptleri ve ring guard katmanları kaldırıldı.
- r811 yalnız Berhetiyye buton/atlas görsel dili için bırakıldı; sayaç render etme görevi yok.
- `#zCountVisual` eski JS için DOM'da kalıyor fakat görsel katmanları artık boyanmıyor.
- Yeni `#r819CounterStage` sayaç hostunun kardeşi olarak çiziliyor; eski sayaç CSS'lerinden fiziksel olarak izole.
- Konumlandırma transform ile değil, hostun gerçek `offsetLeft/offsetTop/offsetWidth/offsetHeight` geometrisi üzerinden yapılıyor.
- Sayı ve yüzde eski gerçek sayaçtan `MutationObserver` ile yeni sahneye aynalanıyor.
- Sahneye dokunma/Enter/Space gerçek `#zCountVisual` tıklamasına aktarılıyor; sayım motoru değişmedi.

## İki ayrı çark
- Normal zikir: `assets/sukun-nur-ring-r757.png`
- Berhetiyye: `assets/berhetiyye-premium/berhetiyye-ring-r819.png`
- İki çark da tek r819 renderer tarafından yönetiliyor.

## State
- Berhetiyye seçimi, aktif state, 28 İsim Seyri ve Berhetiyye hero bağlamı tek resolver ile değerlendirilir.
- Normal kategoriye kesin seçim yapıldığında Berhetiyye state'i bırakılır.
- Eski r809/r813/r815/r816/r817/r818 state bayrakları r819 tarafından temizlenir.

## Ek UI düzeltmesi
- `Kendi sesin` dar ekranda tek satır ellipsis ile sınırlanır.
- Seyir durum satırları dar genişlikte taşmayacak şekilde korunur.

## Build / cache
- HTML meta build: r819
- ekrandaki sürüm etiketi: r819
- manifest: r819
- service worker cache: r819
- Berhetiyye ve normal ring assetleri SW precache listesine alındı.
