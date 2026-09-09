# SÜKÛN r734 — Ses doğruluğu, engellemeyen günlük ve bildirim düzeni

## Dayanak ve bulgular
Temel r733 ve 9 Eylül 2026 tarihli Android tanı kaydı. Rahmân (esma:0:nida) 72/298 ve kendi kayıt tercihiyle görünüyordu. Son Mini Başla native click olarak alınmış ve komut accepted olmuştu; sayı 72’ye ilerlemişti. Son Durdur da alınmış, sonrasında fiziksel ses idle ve sahip boştu. Son başarısızlık voice-false olarak kaydedilmişti. Tanı son Durdur’dan sonra yeni Başla göstermediğinden kullanıcının sonraki denemesinin tam nedeni kesinleşmez. Ekran görüntüsü günlük değerlendirme katmanının zikir kontrollerini örttüğünü ayrıca doğrular.

## Yapılan değişiklikler
- Başarısız sesli otomatik zikir artık çalışıyor görünerek Başla’yı Duraklat’a çevirmiyor. Açık bir Yeniden dene durumu, kanonik Stop bariyerinden geçerek yeni bağımsız oturum kuruyor. Kayıt seçimi, mevcut sayaç, hedef ve Esmâ korunuyor. Yeni Durdur bekleyen yeniden başlamayı iptal ediyor.
- Görünür seri sesli zikrin geçici sayaç hakkı niyet ve meşgul ses kontrollerinden sonra alınıyor. Bir önceki doğrulanmamış hak sonuçlanmadan ikinci hak açılamıyor. Başarısızlık, Durdur veya oturum değişimi yalnız kendi henüz doğrulanmamış tekrarını geri alıyor; daha sonra elle değiştirilen sayılar ve tamamlanan okumalar korunuyor. Eski neslin geç gelen sonucu yeni oturumu etkileyemiyor.
- Ses başarıyla tamamlanmadan hedef/sonraki Esmâ geçişi yapabilen tahmini watchdog kaldırıldı. Başlatma kabulü ile gerçek ses sonucunu ayıran, ham kayıt içermeyen sınırlı tanı izi eklendi. Eski kayıt>TTS önceliği, 28/99 seyir sahipleri ve gerçek Pause/Resume yolu korunuyor.
- Günlük değerlendirmesinin gizli durumuna bütün temalarda kesin öncelik verildi. Tefekkürde ve canlı/duraklatılmış seansta görünmüyor; normal ekranda küçük, isteğe bağlı ve 8 saniye sonra kapanan, arka planı kilitlemeyen bir bildirim. Puan, gösterildiği günlük kaydına bağlanıyor.
- Onaylanan neonik düzen esas alınarak Mini/Midi/Max üst satırı toparlandı. Bildirim rozetleri ikon düğmelerinin içinde, kompakt ve taşmadan görünür; gizli rozetler dokunma yakalamıyor. Ana Başla etiketinin çocuk DOM düğümleri her render’da yeniden yaratılmıyor; aktif parmak hedefi korunuyor.

## Doğrulama
- Kaynak/Service Worker regresyonu: 31/31.
- Mini oynatıcı regresyonu: 5/5.
- Önceki yeniden başlatma uyumluluk testleri: 10/10.
- Yeni başarısız ses, tek geçici sayaç sahibi, durdurma, geç gelen callback, manuel değişiklik, retry iptali ve seyir sahipliği testleri: 8/8.
- Tam HTML’de gerçek HTMLAudioElement ve yapay WAV ile Rahmân Stop → Play, kayıt kaynağı ve sayaç korunumu; günlük, rozet ve sayfa hatası kontrolleri: 5/5. IndexedDB okuma katmanı testte sağlanan sentetik kayıtla değiştirilmiştir; ses motoru ve HTML medya öğesi gerçektir.
- Chromium 320×640, 390×844 ve 428×926: her genişlikte Mini/Midi/Max rozet taşması, yatay taşma ve tefekkürde günlük gizliliği geçti (9 yerleşim senaryosu ve 3 sayfa-hatası kontrolü). Android cihazda gerçek parmak/ekran donanımı testi değildir.

## Sınırlar ve sonraki kontrol
Kullanıcının gerçek IndexedDB kayıt dosyası ve Android fiziksel ses çıkışı bu çalışma ortamında bulunmuyor. Dolayısıyla gerçek cihazdaki Rahmân hatasının tek kök nedeni kesin olarak saptanmış veya bütün cihazlarda çözülmüş ilan edilemez. Kendi kayıt/TTS, kilit ekranı, kulaklık ve uzun süreli seyir regresyonları gerçek cihazda gereklidir. Yeni tanı, kabul edilen Başla ile gerçek sesin sonuçlanmasını ayırarak sonraki tekrarı daha belirleyici kılacak. Bu sürüm kalıcı uygulama verilerini sıfırlamaz veya kayıtları pakete koymaz.

## Paket bütünlüğü
HTML, manifest, Service Worker, build marker, sürüm geçmişi ve cache r734 ile eşitlenmiştir. Manifest kimliği/scope korunur. r733 sürüm belgeleri history altında saklanır. Dosya SHA-256 ve ZIP CRC doğrulaması yapılmıştır. Testler yalnız belirtilen kapsamda geçmiştir.
