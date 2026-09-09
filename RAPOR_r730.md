# SÜKÛN r730 — Saydam Feyz ve mini Tefekkür girişi

## Görsel değişiklik
Feyz ortak kart dolgusu yaklaşık %86–93 opaklıktan %38–56 seviyesine indirildi. Üst/alt gezinme barları, ikincil kart/düğmeler, mini akış yüzeyi, Tefekkür ambiyans/hedef/kalan/ses alanları daha saydam yapıldı. Sahnenin alt koyu perdesi %70 yerine %32; kartlarda arka plan bulanıklığı kaldırıldı, gezinme ve akış barında 3 px kullanıldı.

Metin ve ikon opaklığı azaltılmadı. Birincil eylem ve çıkış renkleri korunur. Ayar/modal yüzeylerinin mevcut daha koyu zemini korunur. Değişiklik yalnızca Feyz etkin olduğunda uygulanır.

## Mini akış barı
Üst sıraya, marka yazısının yerine ikonlu Tefekkür düğmesi eklendi. Canlı durum rozeti ve bildirimler korunur; dar genişlikte kimlik grubu satıra bölünebilir. Düğme en az 44 px yüksekliğinde; oynat/durdur satırına ek sütun getirmez. Yalnız Mini görünümde, Tefekkür dışında görünür.

Yeni olay dinleyicisi eklenmedi: mevcut akış barı click sahibi düğmeyi işler ve SUKUN_TEFEKKUR.enter çağırır. Başlat/durdur/ses sahipliği değişmez. Eski kaldırılmış Tefekkür yuvası canlandırılmadı. Aktif modda tekrar giriş yapılmaz; hazır olmayan veya reddedilen giriş için kısa bildirim vardır.

## Kontroller
31 genel kaynak/VM regresyonu ve 5 mini giriş davranış kontrolü geçti. Mini girişin kayıt veritabanını beklemeden ve duraklatılmış sesi başlatmadan modu açması, aktif modda tekrarlanmaması, hata bildirimi, mevcut play/stop yönlendirmesi kontrol edildi. SW/manifest/build kimliği, yerel asset yolları ve ZIP CRC/SHA-256 doğrulandı.

Bu turda canlı tarayıcı, hesaplanmış CSS geometrisi, piksel/kontrast ölçümü ve gerçek Android dokunması test edilmedi. Dar ekranda üst sıranın gerçek cihaz görünümü henüz doğrulanmadı. Geçmiş sürümlerin tarayıcı raporları bu sürümün kanıtı değildir.
