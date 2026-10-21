# HerOyun Portalı v150 — bütün oyun motorlarının tekrar taraması

Tarih: 21 Ekim 2026. Taban: v149, `0a3a1f665930079450090ffe9af9be60281c2f50`.

Satranç, Tavla, Tetris/Macera ve Kelimecik yeniden tarandı. Bu tur kayıt sonrası motor durumu, bekleyen dokunuşlar, taş korunması, güç zamanlaması ve farklı kare sürelerinde sonuç tutarlılığına odaklandı. Orijinal 34 px Diamond/taç, parıltı, park/sürükleme davranışları, tema ve ölçek korunur.

## Giderilen hatalar

### Satranç

- FEN'den alınan tam hamle sayacı motor durumunda tutulmuyordu. Örneğin 47. hamledeki konum tekrar kopyalandığında sayaç 1 oluyordu. Sayaç artık içe aktarma, siyah hamlesi, kayıt/devam, geri alma ve yeniden bağlantıda korunur. Eski kayıtlarda mevcut geçmişten varsayılan üretilir.
- Kayda dönünce hamle geçmişi veri olarak yükleniyor, ekranda yeniden oluşturulmuyordu. Geçmiş artık saat, tekrar konumları ve alınan taşlarla birlikte geri gelir.

### Tavla

- İşletim sistemi/tarayıcı tarafından iptal edilen bir dokunuş hamleye dönüşebiliyordu; iptal artık hareketi bırakır.
- Geri alma veya yeni oyun sırasında basılı tutulan eski hedef, bırakıldığında eski konumdan hamle yapabiliyordu. Geri alma ve yeniden başlatma bekleyen giriş durumunu temizler.
- Eski birleşik hamlenin ilk adımı uygulanıp ikinci geçersiz adımı da gönderilebiliyordu. Bütün adımlar güncel motor durumunda doğrulanır; biri geçersizse tahta, geri alma listesi ve gönderim değişmez. Geçerli iki zarlı hamleler çalışmaya devam eder.

### Kelimecik

- Önizleme rafı bazı tur geçişlerinde kalıcı rafla aynı diziye bağlanıyordu. Deneme taşı yerleştirmek kalıcı raftan taş eksiltebiliyor; AI turu bitince önizlemedeki taşı yeniden yaratabiliyor veya oyun erkenden bitebiliyordu. Önizleme rafı ayrı tutulur, AI sırasında yapılan geçerli denemeler korunur ve yalnız çakışan kareler geri çağrılır.
- AI, sürpriz karelerden kazanılan ek taşları çekmiyordu. Artık insanla aynı ek taş hesabını kullanır; toplam taş sayısı korunur.
- Kayıt oyun dilini içermiyordu. İngilizce kayıt kendi dili ve sözlüğüyle açılır.
- Çevrimiçi harf değişiminde çıkarılan taşlar torbaya dönmüyordu. Değiştirilen taşlar ortak `bagReturns` sırasına eklenir; iki istemci başlangıç torbası ve bu ek sıradan aynı torbayı kurar. Kalan taş göstergesi ve yeniden bağlantı bu durumu kullanır. Ek alanı olmayan eski odalar boş dönüş sırasıyla açılır. Karşılıklı maçta iki oyuncu da v150 yüklemelidir.

### Tetris ve Macera

- Kayıt; birikmiş düşüş zamanı, kilit süresi/sıfırlama sayısı, son dönüş bilgisi, yerçekimi zaman borcu ve kalan yavaşlatma süresini kaybediyordu. Yeni kayıt bu alanları korur; eski kayıtlar varsayılanlarla açılır. Geçersiz yeni alanlar reddedilir.
- Zaman gücü duvar saatine bağlı olduğu için duraklatmada tükeniyordu. Süre yalnız işlenen oyun zamanında azalır, kayıt/devam ve geri sayımda korunur. Güç aynı karede biterse kalan zaman normal hızla işlenir.
- Güç panelini kapatmak elle duraklatılmış oyunu başlatabiliyor; P tuşu panel açıkken simülasyonu çalıştırabiliyordu. Panel önceki duraklatmayı korur ve manuel geçişte kapanır. Bitmiş oyunda gem tıklaması puanı/envanteri değiştirmez.
- Geciken geri sayım karesi yalnız bir basamak işleyip süre kalanını siliyordu. Geçen tüm 800 ms basamakları ve kalan süre korunur.
- AI önce bütün kareyi, oyuncu sonra bütün kareyi oynadığı için kazanan kare boyutuna göre değişebiliyordu. İki tahta sıradaki düşüş, hareket, kilit veya güç bitiş zamanına kadar birlikte ilerletilir; eşzamanlı olaylar aynı öncelikle çözülür. İş yükü sınırlıdır ve kalan süre taşınır.
- Kare ortasında biten oyun karenin tamamını süreye ekliyordu. Saat artık gerçekleşen olaydan önce tüketilen süreyle ilerler; gerçek Sprint bitişi ve bonusu gecikmiş karede aynı kalır.
- Hayatta Kal hız artışı geçmiş sürenin tamamına erken uygulanabiliyordu. Zaman 30 saniyelik eşiklerde bölünür ve yeni hız yalnız eşikten sonra kullanılır.

## Doğrulama

Altı yeni Node dosyasında **38 test grubu**, yeni gerçek modül/Canvas tarayıcı dosyasında **5 test grubu** geçti:

| Yeni paket | Grup |
| --- | ---: |
| `QA/chess-v150.mjs` | 7 |
| `QA/tavla-v150.mjs` | 5 |
| `QA/kelime-v150.mjs` | 8 |
| `QA/kelime-exchange-v150.mjs` | 2 |
| `QA/tetris-v150.mjs` | 11 |
| `QA/tetris-timing-v150.mjs` | 5 |
| `QA/tetris-resume-v150.cjs` | 5 |

Önceki paketler dahil **28 Node paketi**, **10 Chromium paketi**, **60 JavaScript dosyasının** sözdizimi ve diff kontrolleri geçti. Son saat değişikliğinden sonra Tetris'in dört tarayıcı paketi tekrar geçti. Diğer altı tarayıcı paketi de bu sürüm kaynaklarıyla geçti.

Öne çıkan senaryolar:

- Satrançta sayaç 47→48, rok, FEN kopyalama, saat/geçmiş/tekrar, eski kayıt, yeniden bağlantı ve geri alma.
- Tavla'da iptal edilen dokunuş/sürükleme, geri alma/yeni oyun sırasında basılı hedef, atomik birleşik hamle ve geçerli birleşik hamle.
- İki gerçek Kelime çevrimiçi modülü ile bellek içi Firebase taşıması: Türkçe ve İngilizcede ayrı ayrı 20 karşılıklı değişim; harf ve joker bazında tam envanter korunması, ilk torba sonrasındaki geri dönen taşları çekme ve iki tarafın yeniden bağlanması.
- Tetris'te gerçek JSON kayıt/kapat/devam; 75 ms düşüş birikimi, 350 ms kilit, 12 sıfırlama, dönüş işareti, 125 ms zaman borcu ve 4.000 ms güç korunması.
- AI/oyuncu bitişlerinin 1, 5, 10 ve 100 ms karelere bölünmesi aynı kazananı ve 1/9/10 ms gerçek bitiş sürelerini verir. Gerçek Sprint temizlemesi 1/10/100/1.000 ms karelerde aynı süre ve 18.200 skoru verir.
- Hayatta Kal'da 30/60 saniye hız sınırları; iki eşiği aşan tek 30.400 ms kare ile 37 ms kareler aynı tahta, parça, kuyruk, torba, puan ve zaman durumunu verir.
- Bağımsız zamanlama karşılaştırıcısında yavaşlatma bitişi, hız değişimleri, 2.400.000 ms zaman borcu ve JSON devam eşdeğerliği.
- Önceki satranç perft/1.000 hamle, Tavla 321 konum/1.448 geçiş/225 AI turu, Kelime sözlük/AI ve Tetris 50 kayıt döngüsü/1.200 hareket stres kontrolleri de geçti.

## Sınırlar

Hesap, Firebase ve PeerJS sınırları deterministik test verileridir; üretim hesabına ödül veya mesaj yazılmadı. Çevrimiçi torba testi iki gerçek modülü çalıştırır, fakat iki fiziksel cihaz arasında canlı servis testi değildir. Fiziksel Android, sunucu güvenlik kuralları ve saatler süren pil testi yapılmadı. Bu sonuçlar sınanan senaryolar için kanıttır; tüm olası konumların hatasızlığını garanti etmez.
