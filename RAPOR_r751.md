# RAPOR_r751 — Ana zikir sayacında aktif isim tek satır düzeltmesi

## Sorun
Ana zikir sayacı üstündeki aktif isim bazı Berhetiyye isimlerinde dar ekranda kelime içinden kırılıyor, metin bir satır düzenini kaybedip yamulmuş görünüyordu. Özellikle “Yâ Kazhîrin” gibi adlar bir an doğru, bir an bozuk hissi veriyordu.

## Çözüm
- Aktif isim başlığı artık yalnız tefekkürde değil, normal zikir sayacında da görünür hâle getirildi.
- Başlık için tefekkürdeki estetik hat çizgisi ve merkezleme mantığı kullanıldı.
- Dar ekranda yazı otomatik küçülür; normal zikir sayacında çok satıra düşmesine izin verilmez.
- Kelime içi kırılma, dengesiz sarmal görünüm ve optik merkez kayması giderildi.
- SW / manifest / build marker sürümleri r751 olarak senkronlandı.

## Beklenen sonuç
- “Yâ Kazhîrin”, “Yâ Hûtîrin” ve benzeri isimler ana sayaçta tek satır, merkezli ve premium görünür.
- Bilgi ikonu başlığı kaydırmaz; optik merkez korunur.
