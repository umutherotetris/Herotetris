# RAPOR r815

- r814 ekran görüntüsünde Berhetiyye çarkının Tefekkür sırasında kaybolup eski ince orbit/pseudo sayaç katmanlarının geri geldiği doğrulandı.
- Yeni çark asseti sağlam; sorun asset değil, Berhetiyye görsel state'inin Tefekkür görünümünde düşmesiydi.
- r815 session-latched görsel otorite ekler: Berhetiyye bir kez aktif olduğunda Tefekkür boyunca state korunur.
- `#r811BerhetRing` gerekirse yeniden oluşturulur ve `berhetiyye-ring-r815.png` zorla bağlanır.
- Generic `::before/::after`, canvas/svg/ring/orbit katmanları r815 state'inde kesin kapatılır.
- Açıkça başka bir kategori seçilince latch temizlenir.
