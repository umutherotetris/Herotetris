# SÜKÛN r806 — Berhetiyye tek otorite düzeltmesi

## Kök neden
r802, r803 ve daha sonraki hotfix yaklaşımında aynı Berhetiyye sayaç ve kontrol elemanlarına birden fazla CSS/JS katmanı sahip olmaya çalışıyordu. Geçici body sınıfı değişimleri, MutationObserver tetiklemeleri ve tefekkür DOM taşımaları sonucunda yüzük boyutu, buton kaplaması ve metin ölçüleri sırayla birbirini ezebiliyordu.

## r806 değişiklikleri
- r802/r803 sayaç switch ve animasyon katmanları fiziksel olarak kaldırıldı.
- Berhetiyye görsel durumu `html[data-r806-berhet=1]` üzerinden tek otoriteye bağlandı.
- Geçici state dalgalanmasına karşı 650 ms hysteresis eklendi; flashing azaltıldı.
- Zikirmatikte legacy glow/rings/progress/mandala katmanları Berhetiyye aktifken görünmez; yalnız özel yüzük ve sayaç rakamları kalır.
- Özel yüzük tek boyut otoritesiyle ortalanır ve saat yönünün tersine yavaş döner.
- Tefekküre Geç ve Tefekkürden Çık dahil ana kontroller doğrudan Berhetiyye jewel assetlerini kullanır.
- 6 yardımcı buton, Önceki/Baştan/Sonraki ve 28/99 seyir butonları mobilde taşmayacak grid ölçülerine sabitlendi.
- Atlas ve seyir başlıkları daha küçük ve kontrollü tipografiyle sınırlandı.
- r803 tam paket baz alındı; bu sürüm gerçek tam pakettir ve assets/sw/manifest dosyalarını içerir.
