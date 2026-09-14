# RAPOR r804

## Odak
- Berhetiyye aktifken mobil yerleşim dağınıklığını toplamak
- Yazı kaymalarını ve üst üste binmeleri azaltmak
- Ana kontrol, seyir kontrolü ve yardımcı butonların Berhetiyye özel skin kapsamını güçlendirmek
- Flashing algısını azaltmak için agresif geçişleri baskılamak

## Yapılanlar
- Zikir yardımcı buton grid’i yeniden dengelendi; metin sarımı ve ikon hizası sıkılaştırıldı.
- Ana sayaç alanında rakam/etiket katmanı merkeze sabitlendi.
- -1 / başlat / +1 bloğu mobilde taşmayacak ölçülere çekildi.
- Ana gezinme satırı (Önceki / Baştan / Sonraki) tek satır ve kontrollü yükseklikle zorlandı.
- 28 İsim Seyri kontrol gridi 3 kolon yerine 2 kolon + tam satır büyük buton mantığına alındı; bu sayede çakışma azaltıldı.
- Berhetiyye’de görünmesi gereken birkaç buton için skin değişkenleri final override ile güçlendirildi.
- Flashing üretmeye yatkın bazı animasyon/transition katmanları sadeleştirildi.

## Beklenen Sonuç
- Yazılar daha az kayar, butonlar daha az taşar.
- Seyir kontrolü üst üste binmek yerine okunur bloklar halinde görünür.
- Berhetiyye özel buton kapsaması daha tutarlı olur.
- Görsel gürültü ve flashing algısı azalır.
