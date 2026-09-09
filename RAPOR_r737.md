# RAPOR r737

Temel: r736
Tarih: 2026-09-09

## Yapılanlar
- Akış barının üst satırı daha premium ve dengeli hale getirildi.
- SÜKÛN markası, CANLI rozeti ve bildirim düğmeleri arasındaki boşluklar sıkılaştırıldı.
- Görünür Sistem Durumu / tanı düğmesi kullanıcı arayüzünden kaldırıldı.
- SES TANILAMA bölümü varsayılan olarak gizlendi.
- Mühür yüzüğüne gizli jest eklendi:
  - 7 dokunuş: Gizli Kasa
  - 9 dokunuş: Tanı / diag erişimi
- 7. dokunuştaki kasa açılışı kısa gecikmeyle planlandı; kullanıcı 9’a tamamlarsa kasa yerine tanı erişimi açılır.

## Neden
Tanı araçlarının görünür olması son kullanıcı için yanlış ve gereksiz bir yüzey oluşturuyordu. Bu revizde tanı araçları uzman erişimine çekildi; kullanıcı tarafı daha sade ve daha güvenli hale geldi.

## Not
Bu yama, ses motoru ve sayaç mantığını değiştirmez. Değişiklikler üst akış barı, görünür tanı girişleri ve yüzük gizli jestiyle sınırlıdır.
