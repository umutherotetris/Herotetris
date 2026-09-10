# RAPOR_r762 — Sticky ana menü + daha şeffaf ana sayfa

## Sticky menü
- Ambiyans, Frekanslar, Zikir, Düzen, Bildirimler ve Tekke ana navigasyonu tekrar `position: sticky` oldu.
- Eski r532 teşhisindeki scroll-owner sözleşmesi yeniden kuruldu: normal sayfada `body.r699-layout` ayrı dikey kaydırma kabı değildir; belge kaydırması sticky için referans olur.
- Menü üstte kaldığında yarı saydam blur kullanır; bilgi overlayleri açıldığında z-index düşürülür.

## Ana sayfa transparanlığı
- Büyük marka/header kartı koyu opak yüzeyden daha hafif cama çevrildi.
- Kişisel Merkez (`#prDashboard`) ve iç metrik kartları daha şeffaf hale getirildi.
- Master bar ve Bugün kartı da aynı cam yoğunluğuna yaklaştırıldı.
- Body üzerindeki karartma perdesi azaltıldı; arka plan görseli daha belirgin hale geldi.

## Korunanlar
- r761 ana logo/marka sahipliği korunur.
- Berhetiyye, Tefekkür, ses transportu, sayaç ve kayıt işlevlerine dokunulmadı.
