# HerOyun Portalı v148 — ikinci hata taraması

Tarih: 21 Ekim 2026. Taban: v147, `c036f9adaa35e898a908c628a22584494bed1e1f`.

Bu tarama önceki kontrollerin yakalamadığı oyun sonu, mola, kayıt, sürükleme ve uzun oturum yollarını kapsar. Orijinal Diamond/taç, 34 px boyutları, parıltı, otomatik park, sürükleme, tema ve ölçek tercihleri korunur. Yönlendirme ve görünüm sistemi yeniden yazılmadı.

## Bulunan ve giderilen sorunlar

### Satranç

- Süre dolması ve bazı beraberlik yolları sonuç/istatistik/ödül akışına girmiyordu; saat ve kayıt temizliği ortak sonuç yoluna bağlandı.
- Tekrarlanan pes/beraberlik mesajları sonucu tekrar işletebiliyordu. Sonuç bir kez işlenir; gecikmiş yanıtlar kapanmış, yeniden başlatılmış veya hesabı değişmiş oyunda devam edemez.
- Rakibin mat edebilecek materyali olmadığında süre dolması galibiyet sayılıyordu; çıplak şah gibi durumlarda beraberlik uygulanır.
- Terfi sonrası aynı renk karelerde kalan birden fazla filin ölü pozisyonu tanınmıyordu.
- Geçersiz sıra, rok, sayaç veya geçerken alma alanları bulunan FEN kabul edilebiliyordu; bu alanlar doğrulanır.
- Bekleyen hamle beraberlik penceresi açıkken tamamlanınca teklif bayrağı takılabiliyordu. Eski pencere güvenle kapanır; yeni pencerenin bayrağını silemez.

### Tavla

- Tekrarlanan terminal ağ mesajları ödülü tekrar işletebiliyordu. Sonuç ve ödeme bir kez yürütülür; hesap/oyun değişiminde eski devam işlemleri durur.
- Normal galibiyet maç istatistiğine kaydedilmiyordu; doğru rakip ve sonuçla kaydedilir.
- Kabul edilen molada hamle, tur sonu veya otomatik zar çalışabiliyordu. Mola bunları durdurur; bitiş, reddetme ve “Oyunu başlat” yolları ertelenmiş tamamlanmış turu ilerletir veya bekleyen zar/süreyi geri kurar.
- Geçersiz uzak hamle hamle süresi sınırını iptal edebiliyordu. Yerel süre aşımının sonucu da kayıt/ödül yoluna bağlandı.
- Birleşik insan hamlesi hemen kaydedilmiyor, toplama animasyonu karşı renk haznesinde gösteriliyordu.
- AI açık pul riskini rakibin gerçek hareket yönünün tersinden hesaplıyordu.
- Bozuk sohbet girdisi ve eski pes/beraberlik kaydından kalan zamanlayıcılar temizlendi.

### Kelimecik

- Aynı pencere içinde yeniden başlatılan tura eski AI/durum işlemleri karışabiliyordu; tur kimliğiyle sınırlandı.
- Premium ödül ekranının Tekrar Oyna sonucu kullanılmıyordu. Yerel/AI tekrar akışı, süreli oyunda zorluk ve süre korunarak çalışır.
- Skorda öndeyken pes eden oyuncu galip sayılabiliyordu; mağlubiyet kaydedilir ve galibiyet görevi ilerlemez.
- Yeni yerel/AI/kayıttan oyun önceki çevrimiçi rol veya pes bayrağını devralabiliyordu; yeni turda sıfırlanır.
- Beklemiş ödül yanıtları yeni tur veya farklı hesapta devam edemez.
- AI jokerleri yok sayıyordu. Artık raftaki gerçek jokerlerle geçerli atama yapar; joker harfi sıfır puanlı kalır ve gerçek raf yeterliliği kontrol edilir.

### Tetris

- Gelen çöp satırı oyuncunun veya AI'nın dolu üst hücrelerini oyun bitirmeden silebiliyordu. Taşma sonucu artık uygulanır; bitmiş kilitleme yeni taş üretmez. Büyük birikmiş AI saldırısı da sessizce kaybolmaz.
- Tahta üstünde kilitlenen parça görünmeden kaybolabiliyordu. Üst sınır sonucu uygulanır; antrenman ve tek kullanımlık Nexus koruması bu yolu da kapsar.
- Nexus/antrenman üst sıra temizliği alt yığını kaydırıyordu. İlgili üst hücreler temizlenir; alt yığın aynı yerde kalır.
- Gölge saldırı çarpanı ve Gölge/Elara savunma çarpanları tanımlı oldukları halde uygulanmıyordu. Gerçek saldırı ve biriken savunma payına bağlandı. Bir saldırı en fazla sekiz satırdır; çevrimiçi iki tarafın da v148 kullanması gerekir.
- Havada geçirilen bir kare kilit yenileme sayısını sıfırlayarak üst sınırı aşabiliyordu. Sayaç yeni taşla sıfırlanır. AI maç bitirdiğinde mevcut animasyon karesi de hemen durur.
- Yön değiştiren sürüklemede ölü bölge oluşuyor, yavaş aşağı sürüklemenin küçük adımları birikmiyordu. Hareket farkı biriktirilir; iptal ve yeni tur eski hareketi bırakır.
- Bozuk kayıt tahtası, kuyruk/torba veya sayılar yarım uygulanıp oyunu kullanılmaz hale getirebiliyordu. Kayıt uygulanmadan doğrulanır; geçersiz kayıtta yeni oyun açılır. Geçerli kesirli süre, skor, taş şekli/konumu/rengi ve güç kullanım sayaçları korunur.
- Geç yüklenen ana menü modülü eski 50 açılışın sürükleme dinleyicilerini son oyuna ekleyebiliyordu. Bağlama doğru oyun köküne sınırlandı; kapanışta dinleyiciler başlangıç sayısına döner.
- Bozuk başarımlar/istatistik/macera ilerleme biçimleri istatistik veya dünya seçimini çökertebiliyordu. Geçerli kayıtlar korunurken hatalı alanlar ve taşan sayılar süzülür.

## Doğrulama

Altı yeni deterministik test dosyasında **52 test grubu** geçti:

| Test | Grup |
| --- | ---: |
| `QA/chess-v148-regressions.mjs` | 9 |
| `QA/tavla-v148-regressions.mjs` | 15 |
| `QA/kelime-v148-regressions.mjs` | 9 |
| `QA/tetris-v148-regressions.mjs` | 9 |
| `QA/tetris-input-v148.mjs` | 4 |
| `QA/tetris-storage-v148.mjs` | 6 |

Önceki 11 motor/oturum test paketi de geçti. Satrançta ek hamle ağacı sayımları 97.862 / 43.238 / 9.467 olarak doğrulandı. Toplam 17 Node motor/oturum paketi çalıştırıldı.

Sekiz Chromium paketi: `tavla-input`, `portal-ui`, `portal-state`, `portal-forms`, `portal-flows`, `portal-worker`, `tetris-session-ui`, yeni `tetris-stress`. Bunlar gerçek modül ve DOM/canvas kodunu kullanır. Tavlanın 6–3 hamlesi dört ölçekte ve iki tahta yönünde tekrar sınanır; portal kontrolleri özgün ikonları ve altı ekran genişliğini kapsar.

Tetris stres testi: 50 gerçek JSON kaydet/kapat/devam döngüsü, ayrıca yeniden başlatmalar; 1.200 hareket döngüsü, 49 otomatik yeniden başlatma, 105 kahraman gücü ve 88 gem. Dokuz kahramanın gücü denendi; sonlu skor ve 20×10 tahta korundu. Kesirli süre ve geçerli taş verisi restore edildi; tek oyun/kontrol ve kapanışta dinleyici temizliği doğrulandı.

`js/` altındaki 60 JavaScript dosyasının sözdizimi ve diff kontrolü temiz. Node 24.19.0, Playwright/Chromium 133 kullanıldı. Chromium yolu `PORTAL_CHROMIUM` ile belirtilebilir.

## Açık tasarım konusu ve sınırlar

Macera yıldız hesabı ayrı bir tasarım konusu olarak kaldı: bölüm hedefe varınca hemen bitiyor; yıldız hesabı hedefin %120/%150'sini istiyor. Normal en fazla dört satırlık temizlemelerde dünyalar 2–8'in iki/üç yıldız eşiğine erişilemiyor. Özel güçlerle çoklu satır temizleme bazı küçük hedeflerde durumu değiştirebilir. Yıldızları süre, skor veya farklı eşiklerle hesaplama kararı bu düzeltmede değiştirilmedi.

Hesap/Firebase ve PeerJS sınırları deterministik test verileriyle çalıştırıldı; gerçek hesaplara ödül/mesaj yazılmadı. Fiziksel Android, iki gerçek oyunculu canlı bağlantı, sunucu kuralları ve saatler süren pil testi ayrıca gereklidir. Bu rapor bütün olası hataların bittiği anlamına gelmez. Çevrimiçi maçın iki tarafı da v148 kullanmalıdır.
