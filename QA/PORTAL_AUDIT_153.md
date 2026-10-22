# HerOyun Portalı v153 — oyun ve oturum düzeltmeleri

Tarih: 22 Ekim 2026. Yayın tabanı: v152, `3d4bd4675e03d956fc90979da8adbd30d416976a`, ağaç `26f05f588d1a6e3877ef071a240086d2a00f20b1`.

## Değişiklikler

### Satranç, Tavla ve Tetris bağlantıları

İlk oda kurulumu, sinyal hizmeti hiç cevap vermezse 12 saniyede hata verir. Kod hazır olduğunda bu süre sınırı kalkar; arkadaş bekleyen hazır oda açık kalır. Satranç/Tavla/Tetris'te süresi dolan ilk katılım taşıması kapatılır; geç gelen olaylar başarısız girişten sonra hayalet maç açamaz. Satranç ve Tavla'da açık P2P kanalı yalnız sinyal hizmetinin hatası nedeniyle yok edilmez.

### Tavla

Pes etme, beraberlik ve mola onayları tek görünür pencereye, maça, konuma ve tura bağlıdır. Eski pencere, yeniden başlatılmış/eşitlenmiş/bitmiş oyunu değiştiremez; aynı cevap iki kez işlenmez. Kolay ve orta AI, erişilebilir bir anlık kazanma dizisini rastgele düşük tercih yüzünden atlamaz. AI oyuncu kartı artık genel Rakip yerine Yapay Zekâ/🤖 gösterir.

### Kelimecik

- Üç dakikalık rakip sessizliği yerel galibiyet yazmaz. Kesintiye uğramış maç kazanan belirlenmeden kapanır; ortak oda ve iki oyuncunun devam indeksleri korunur.
- Hamle, pas, harf değişimi, pes etme ve beraberlik yazmaları aynı oyun/turla bağlıdır. Yazma beklerken ikinci onay engellenir. Reddedilen yazma sonuç üretmez, oyunu yerelde durdurur ve son onaylanmış canlı rafın kurtarılmasını korur. Firebase'in erken yerel bitiş bildirimi yazma onayına kadar sonuç üretmez.
- Yerel davet listesi ve atomik davet kabulü aynı beş dakikalık bitiş sınırını kullanır.
- Devam listesine geç gelen yükleme/oyuna dönme callbacks'i yeni ekranı açamaz.
- AI aramasında kolay/orta/zor için 100/250/700 ms işbirlikli süre bütçesi vardır; mevcut düğüm/değerlendirme sınırları da korunur. Süre dolunca bulunan yasal adaylardan seçim yapılır. Zor seviye, bulunmuş adaylar içinde en iyi sıralananı seçer.

AI sınırı tepki süresi ile arama derinliği arasında tercihtir; her konumda güç artışı iddiası değildir. Aynı İngilizce orta oyun örneğinde önceki üç ölçüm 2122/1083/389 ms ve 60/60/60 puandı; 700 ms bütçeyle 713/379/228 ms ve 49/60/60 puan ölçüldü. İlk sözlük/trie hazırlığı ve çöp toplama duraklamaları bu arama bütçesi kapsamında değildir. Bunlar fiziksel telefon ölçümleri değildir.

### Sosyal alan

Takma adla arkadaş ekleme, tanımsız sendFriendRequest çağrısı yüzünden çalışmıyordu; mevcut istek/bildirim kaydıyla uyumlu işlev eklendi. Eski hesabın bildirimleri ve gecikmiş arkadaş sorguları yeni hesabın panelini değiştiremez. Hesap değişiminden sonra bekleyen takma ad sorgusu yeni kimlikten istek göndermez; kullanıcının bu sırada yazdığı yeni metin korunur.

## Doğrulama

Birleştirilmiş son kaynakta **52/52 QA/*.mjs Node paketi geçti**. Önceki motor, AI, hamle sayımı, zar/taş korunması, sözlük/puanlama, fizik, kayıt, oturum ve taşıma regresyonlarına ek olarak yeni paketler:

| Paket | Kapsam |
| --- | --- |
| chess-join-v153.mjs | Başarısız giriş ve geç olaylar |
| room-readiness-v153.mjs | Satranç/Tavla oda hazır olma süresi ve açık kanalı koruma |
| tavla-confirm-v153.mjs | Onay penceresi yaşam döngüsü |
| tavla-ai-v153.mjs | İki renk/üç seviyede erişilebilir kazanma |
| kelime-recovery-v153.mjs | Kesinti, davet süresi, eski ekran ve yazma onayı — 18 grup |
| kelime-deadline-v153.mjs | Deterministik süre kesilmesi, yasal en iyi mevcut aday, girdi korunması — 4 grup |
| social-account-v153.mjs | Hesap sınırları ve gerçek takma ad istek yolu — 7 grup |

Mevcut Tetris taşıma paketine sessiz host, hazır host ve süresi dolan misafir kontrolleri eklendi. Eski satranç fixture'ı yeni hostu hazır olarak işaretler ve iptal edilmiş eski timeout'u açıkça çalıştırarak izolasyonu kontrol eder. Yeni hazır olma regresyonu v152 üzerinde beklendiği gibi başarısız oldu. Kelime yazma testleri gerçek yeni yardımcıyı kullanır ve onayı bekler. Test süre sınırları gevşetilmedi.

İlk birleşik tur 49/51 geçti: yeni host süresinin doğru biçimde tetiklediği eski fixture düzeltildi; AI'nın 4 saniyelik sınırı bir kez aşıldı. Aynı test izole olarak geçti; buna rağmen sadece düğüm sınırının yavaş cihazda geçen süreyi sınırlamadığı görülerek süre bütçesi eklendi. Son 52 paketin sıralı turu 30,1 saniyede, bütün mevcut kalite testleri değişmeden geçti.

63 uygulama JavaScript dosyasının sözdizimi ve git diff --check kontrolleri geçti. Özgün taç/Diamond görselleri, 34 px ölçek, park/sürükleme kaynakları ve tüm CSS dosyaları değişmedi. Tavla oyuncu kartında yalnız AI kimliği düzeltildi.

## Tarayıcı gözlemleri ve açık kalan doğrulama

Cloud Chromium üzerinden Sites önizlemesi kullanıldı. Masaüstünde zor satranç AI açılışı, e4/Nf6 hamleleri ve geçmişi gözlendi. 390 px iframe görünümünde Tavla AI tahtası, Kelimecik AI açılışı ve Tetris AI başlama/sert bırakma/duraklatma akışları denendi. Bu ilk tur son sürüm hazırlığından önceki kaynak kopyasındaydı. Birleştirilmiş v153 (meta etiketi doğrulandı) 320 px görünümünde ana ekran, Tavla AI kartı, pes onayı/iptali/kapanışı ve satranç online lobi kontrol edildi. Iframe ölçüsü mobil CSS kontrolüdür; fiziksel Android dokunma/performance testi değildir.

Gerçek sinyal hizmetiyle v153 satranç hostu oda kodu üretti. Aynı bulut tarayıcıda ikinci istemcinin katılımı oda bulunamadı sonucuyla başarısız oldu; başarılı iki taraflı maç olarak sayılmadı. Kök neden bu denemede belirlenmedi. Üretim alanında iki fiziksel cihazlı maç, NAT/ICE bağlantısı, yeniden bağlanma ve Firebase izinleri hâlâ doğrulanmadı. Üretim kullanıcılarına davet/mesaj/ödül gönderilmedi.

Eski Playwright CJS tarayıcı paketleri bu tur yeniden çalıştırılmadı; önceki sonuçları v153 sonucu olarak sunulmaz. P2P hamleler için paket onayı/yeniden gönderme ve Kelime için sunucuda sıra/sürüm karşılaştırmalı hamle transaction protokolü bu sürümün kapsamında değildir. Sunucu kabul edip onayı istemciye ulaşmayan belirsiz yazılarda raf mutabakatı ayrıca işlem kimliği/sürüm protokolü gerektirir. Canlı Kelime raf kurtarma aynı tarayıcı/cihazla sınırlıdır.

Bu testler bütün olası hata durumlarının bittiği veya her ağda online maçın çalıştığı anlamına gelmez.
