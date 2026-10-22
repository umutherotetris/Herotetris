# HerOyun Portalı v151 — çakışma taraması, çevrimiçi oyun ve AI

Tarih: 22 Ekim 2026. Taban: v150, `5df370d26b4fafa651dbb7fd547cede85139672c`.

Bu sürüm Satranç, Tavla, Kelimecik ve Tetris/Macera motorlarını; bekleyen hamleler, çoklu dokunuş, animasyon, yeni oyun, arkadaş daveti ve bağlantı kopması açısından yeniden tarar. Ayrıca dört AI rakibinin karar kalitesini ve çevrimiçi oda paylaşımını geliştirir. Özgün 34 px parıltılı Diamond/taç, park ve sürükleme davranışları korunur.

## Ortak ekran ve oturum çakışmaları

- Aynı oyunun tekrar açılması veya farklı oyun dosyalarının ters sırada yüklenmesi birden fazla canlı motoru üst üste açabiliyordu. Portal artık açık oyunu korur; yükleme sürerken en son seçim geçerli olur. A→B→A gibi hızlı seçimler de sınandı. Doğrudan oyun açılışlarında ek tekrar korumaları vardır.
- Oyun kontrol merkezi kaldırılınca rehber/onay örtüsü ve eski olay dinleyicileri kalabiliyordu. Yeniden bağlama önceki kontrolü tamamen temizler; eski çıkış düğmesi yeni oyunu kapatamaz. Escape önce açık yardımcı pencereyi kapatır.
- Kelime biçiminde sonradan eklenen oyuncu panelinin canlı skor güncellemesi başlamıyordu. Rakip UID'si olmayan maçta iki skor alanı da aynı seçiciye denk gelebiliyordu. Skorlar rol bazında, kendi paneli içinde güncellenir.
- Geç gelen rakip profili yeni oyuncu panelinin üstüne yazabiliyordu. Panel istekleri sıralanır; geçersiz kalan istek yeni paneli değiştirmez. Uzun isimler 320 px panel içinde taşmadan kısalır.

## Satranç

Terfi, FEN ve onay pencereleri tek bekleyen işlem olarak yönetilir. Aynı terfi seçimi iki hamle gönderemez; animasyon sürerken yeni yerel/uzak hamle ortak animasyon durumunu ezemez. Bitmiş, sıra dışı veya artık yasal olmayan hamleler reddedilir. Yeniden başlatma ve sonuç, önceki turun pencerelerini ve tutulmuş taş durumunu temizler.

AI orta/zor düzeyde arama ufkunda taş alışverişlerini, geçerken almayı, terfileri ve şah kaçışlarını sınırlı olarak sürdürür. Şah altındaki konumu hamle yapmadan değerlendirmez. Süre/düğüm bütçesi dolarsa yarım taranmış kök hamleleri karıştırmak yerine son tamamlanan derinliği kullanır. Nominal kolay/orta/zor derinlikleri 1/2/3 olarak korunur.

Test ortamındaki temsilî zor aramalar yaklaşık 8–268 ms sürdü. 240 ms hedefi belirli düğüm aralıklarında kontrol edilir; kesin gerçek zaman garantisi veya Elo iddiası değildir.

## Tavla

- İkinci parmak ilk parmağın seçimini değiştiremiyor; yalnız hareketi başlatan pointer taşı bırakabilir/iptal edebilir. Pointer yakalama, tuval dışındaki bırakmayı da tamamlar.
- Sürüklenen/animasyonlu pulun kaynakta ikinci kez çizilmesi giderildi. Hedef konum varış sonrası yığın aralığını kullanır; pul eski pulun üzerine inip sonra sıçramaz. Bar çıkışı gerçek pul yuvasından başlar.
- İptal edilen hareket ve yalnız kaynak noktaya dokunma sonrasında uçan/sürüklenen çizim hemen temizlenir.
- AI, temas bittikten sonra gereksiz açık pul/kapı savunması yerine toplama dağılımını değerlendirir. Kazandıran hamle mutlak önceliklidir. İki renk için aynalanmış [4,3] örneğinde aynı 16 pip kalırken toplanan pul sayısı 9 yerine 10 olur; sonraki zarın bağımsız toplama beklentisi 10,5833'ten 11,8056'ya yükselir. Yeni arama derinliği eklenmez.

## Kelimecik

İptal edilmiş/ikinci pointer, raf değişiminden veya yeni turdan kalan sürükleme ve geç kalan joker seçimi artık yeni durumu değiştiremez. Aynı joker birden fazla seçici açamaz veya iki taş yaratamaz. Yeni oyun eski harf değişim kilidini sıfırlar; insan tur sayacı AI oynarken başlamaz.

AI artık sürpriz karelerin gerçek puan etkisini seçime dahil eder. Türkçe ve İngilizce örneklerinde aynı temel 4 puanlık kelime +25 kareyle 29, iki kat kareyle 8 puan kazandıran konuma yerleşir. Dönüşteki temel puan değişmez; bonus controller'da bir kez uygulanır. Eşit gerçek kazançta jokeri ve dengeli kalan rafı koruyan seçenek tercih edilir. Sözlük ve arama sınırları korunur; bütün tahtalarda matematiksel en iyi hamle garanti edilmez.

Arkadaş daveti artık uydurma altı karakterli Kelime odası bildirimi üretmez. Gerçek Kelime daveti ve ortak oyun kaydı oluşturulur; bildirim bu kayda bağlanır. Kabul edilen oyuncu, oda, torba tohumu ve dil iki tarafta aynıdır. Kabul işlemi oda üzerinde atomiktir; farklı hedef oyuncu veya ikinci misafir odayı devralamaz. Oda/bildirim yazımı ya da kabul sürerken iptal/çıkış yapılırsa geç gelen işlem yeni oturum açmaz. Misafir B'nin oyuncu paneli kendi B skorunu ve rakip A'nın adını gösterir.

## Tetris/Macera

- Sohbet, form, düzenlenebilir alan ve IME yazımı oyun kısayollarını tetiklemez. Basılı Space/P gibi tek seferlik tuşlar art arda sert bırakma/duraklatma yapmaz; yön tuşlarının tekrarı korunur.
- Yeniden bağlantı denemeleri tükendiğinde hayatta kalan oyuncunun sonucu bir kez tamamlanır; manuel kapatmadan kalan callback yeni maçı bitiremez.
- Zor AI bilinen sonraki taşı da planlar ve seçtiği yerleşimi görünür botun döndürme/hareket/düşme sırasıyla sınar. Erişemeyeceği hedefleri eler. Kolay/normal tek taş yaklaşımını korur.
- L→L testinde aynı bir satır temizlenirken tek taş planının bıraktığı bir delik, yeni zor planla sıfıra iner. Yüksek yığınlarda seçilen plan gerçek `aiTick/aiLock` ile oynatılıp tahmin edilen tahta ile karşılaştırılır.
- Arama en fazla 48 ilk yol + 6×48 devam yoluyla sınırlıdır. Ucuz ön sıralama test örneğinde gerçek yol simülasyonunu 12'ye düşürür. Chromium 4× CPU yavaşlatmasında 12 ölçüm ortalaması 28,75 ms, en yükseği 38,8 ms oldu. Bunlar fiziksel telefon ölçümü değildir; soğuk başlangıç/ortam yükü daha uzun sürebilir.

## Çevrimiçi kullanım

Sosyal arkadaş davetlerinde oyun dosyalarının yolu yanlış klasöre gidiyordu. Dört oyunun gerçek açılış yolu düzeltildi ve ortak portal açılış korumasına bağlandı. Açık oyun varken yeni davet gönderimi/kabulü mevcut bağlamı değiştirmez; önce ana menüye dönme bilgisi verilir.

Satranç, Tavla ve Tetris odalarında **Paylaş** düğmesi eklendi. Destekleyen telefonda yerel paylaşım menüsü açılır; destek yoksa oyun adı, kod, katılma açıklaması ve portal bağlantısı panoya kopyalanır. İptal, başarı olarak gösterilmez; pano reddedilince yanlış “kopyalandı” bilgisi verilmez. Paylaşım sürerken hızlı tekrar tıklamaları tek işlem kalır.

Üç gerçek oda ekranı 320/390 px genişlikte %80/%100/%130 ölçeklerde sınandı. Tetris paylaşım düğmesinin %130 ölçekte ekran altına taşması, lobi içeriğinin kaydırılabilir olmasıyla giderildi. Kod kopyalama ve paylaşım düğmeleri birbirini örtmez ve erişilebilir kalır.

## Eski sürümden güncelleme

Son gerçek worker testinde kurtarma sayfasının eski worker yanıtını beklerken etkinleşen yeni worker kaydını kaldırabildiği doğrulandı. Yalnız etkin worker'ı yeniden kontrol etmek de kontrol ile kaldırma arasındaki yarışı tamamen önlemiyordu. Kurtarma artık aynı kayıt üzerinde güncelleme yapar; `unregister` kullanmaz. Yeni worker'ın etkinleşmesi, sayfayı kontrol etmesi ve sürüm yanıtı doğrulanmadan ana sayfaya geçilmez. Gerçek eski Sükûn worker'ından geçiş, çevrimdışı açılış, ayar/önbellek korunması ve iki kontrollü geçiş yarışı geçti.

## Testler

Önceki paketlerle birlikte **37 Node paketi**, **16 Chromium paketi**, **61 JavaScript dosyasının** sözdizimi ve diff kontrolleri geçti. Yeni testler 58 Node + 29 tarayıcı test grubu içerir:

| Yeni paket | Grup |
| --- | ---: |
| `QA/chess-v151.mjs` | 9 |
| `QA/chess-ai-v151.mjs` | 4 |
| `QA/tavla-v151.mjs` | 8 |
| `QA/tavla-ai-v151.mjs` | 4 |
| `QA/kelime-v151.mjs` | 10 |
| `QA/kelime-invite-v151.mjs` | 7 |
| `QA/kelime-ai-v151.mjs` | 7 |
| `QA/tetris-v151.mjs` | 4 |
| `QA/tetris-ai-v151.mjs` | 5 |
| `QA/portal-overlap-v151.cjs` | 8 |
| `QA/invites-v151.cjs` | 8 |
| `QA/hud-v151.cjs` | 3 |
| `QA/room-share-v151.cjs` | 5 |
| `QA/lobbies-v151.cjs` | 3 |
| `QA/recovery-race-v151.cjs` | 2 |

Önceki perft/hamle kuralları, Tavla taş korunması, Kelime sözlük/torba değişimi, Tetris fizik/kayıt/stres ve portalın özgün ikon/tema/ölçek kontrolleri de tekrar geçti. Yeni hata regresyonlarının önceki v150 üzerinde başarısızlığı ayrıca doğrulandı; yeni özellik testlerinin tamamı eski sürüm için geçerli bir özellik sözleşmesi değildir.

## Sınırlar

Auth, Firebase, PeerJS ve yerel paylaşım sınırları test verileridir; üretim hesabına davet, mesaj veya ödül yazılmadı. Kelime testi iki gerçek modülü ortak bellek içi taşıma üzerinde çalıştırır. İki fiziksel cihazla canlı internet maçı, gerçek Android paylaşım paneli, Firebase üretim izinleri veya uzun pil testi yapılmadı. AI geliştirmeleri sınanan taktik/strateji örneklerinde ölçülmüştür; bütün konumlarda üstünlük garantisi değildir. Çevrimiçi maçta her iki oyuncu da v151'i yüklemelidir.
