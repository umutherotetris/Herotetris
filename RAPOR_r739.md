# RAPOR r739

Temel: r738
Tarih: 2026-09-09

## Hedef
- Berhetiyye uzun isimlerinde başlık taşması / parçalanması / flashing hissini gidermek
- Özellikle “Ya Hutirin” gibi uzun adların tek parça ve stabil görünmesini sağlamak
- Tefekkür hero başlığındaki süslemeleri geri getirmek

## Yapılan düzeltmeler
- Tefekkür hero başlığında Berhetiyye kategorisi için isim metni tek satıra sabitlendi.
- Kelime içi kırılma kapatıldı; taşarsa nazik ellipsis uygulanır.
- Berhetiyye adlarında olası tekrar/çoğalma metni normalize edildi.
- “Yâ/Ya” öneki Berhetiyye görünümünde tek ve sade “Ya ” biçimine çekildi.
- Tefekkürde toast/show sınıfı gelse bile hero artık kaybolmuyor; flashing etkisi bastırıldı.
- Yan süs çizgileri ve ❧ bezemeleri geri getirildi.

## Beklenen sonuç
- Başlıkta “Ya Hutirin” tek merkezde, sakin ve okunur görünür.
- “Bi. Ya Hutirin / Bi. Hutirin” gibi çiftleşme-parçalanma görünmez.
- Tefekkür başlığı yeniden süslü ama temiz görünür.
