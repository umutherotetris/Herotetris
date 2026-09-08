# SÜKÛN r724 — Dar ekran düzeltmeleri

r723 üzerine iki sınırlı düzeltme:

- 380 px altındaki ses ikonu gizleme seçicisi, r722 görünürlük seçicisinin özgüllüğüne getirildi. Önceki kural daha zayıf kaldığı için Feyz görünümünde kazanamıyordu. Sonraki ve important olan gizleme kuralı artık aynı öncelikte.
- 360 px altındaki eski Çık kısaltması, modern Tefekkür yerleşiminde tam Tefekkürden Çık etiketiyle değiştirildi. Etiket gerektiğinde sözcükler arasından iki satıra bölünür. Erişilebilir ad zaten tamdı ve korunur.

Düğme yükseklikleri, referans ikon takımı ve renkler korunur. Mevcut kullanılabilirlik stil bloğu düzenlendi; ek stil bloğu, olay dinleyicisi veya dokunma katmanı eklenmedi.

## Doğrulama
31 kaynak/VM testi geçti. İkonun gösterme ve gizleme seçicilerinin eşitliği, çıkış etiketi kuralları ve SW asset yolları kaynak düzeyinde kontrol edildi. Tüm executable scriptler r723 ile karşılaştırıldı; yalnızca sürüm kimliği değerleri değişti. Ses oturumu, seyir, sayaç ve pause/resume kodları aynı kaldı.

Build, manifest ve SW r724 olarak eşitlendi. ZIP CRC ve SHA-256 doğrulandı. Önceki tanılama raporları tarihçe olarak saklandı; bu sürümün sonuçları diagnostics/r724 içindedir.

Canlı tarayıcı, hesaplanmış CSS yerleşimi, fiziksel Android ve ses donanımı testi yapılmadı.
