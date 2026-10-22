# HerOyun Portalı v152 — bağlantı, davet ve oturum düzeltmeleri

Tarih: 22 Ekim 2026. Yayın tabanı: v151, `6616923ea996b3cb8aaf9a27c70745e4e4987089`.

v151'in dört oyundaki AI geliştirmeleri, oda paylaşımı, kontrol merkezi ve animasyon düzeltmeleri korunur. Bu sürüm yeniden bağlantı, bekleyen girişler, arkadaş daveti ve kayıt/devam akışlarını sağlamlaştırır. CSS, özgün 34 px parıltılı Diamond/taç görselleri, park ve sürükleme davranışları değiştirilmedi.

## Portal ve arkadaş davetleri

- Koleksiyon, son oyun ve sosyal davetler aynı başlatıcıyı kullanır. Açık oyun korunur. Normal kartlar hızlı seçilirse en son seçim geçerli olur; A→B→A ve ters sırada tamamlanan dosya yüklemeleri tek oyun açar.
- Davet hazırlığı kendi açılışını korur. Başka oyun açma isteği bir davetin bağlamını değiştiremez. Davet penceresi kapatılırsa gecikmiş işlem yeni oyunun üzerine açılamaz; başarısız açılış bağlam bırakmaz.
- Hesap değiştiğinde bekleyen davet açılışı iptal olur. Kabul bildiriminin silinmesi daveti kabul eden hesabın kimliğine bağlıdır.
- Sosyal panelde Kelimecik'in gerçek davetleri de görünür. Bağlı portal bildirimi varsa aynı davet ikinci kez listelenmez. Bildirimi kaldırmak alttaki daveti tekrar ortaya çıkarmaz; temizleme ve ayrı kaldırma işlemleri gerçek daveti de temizler.
- Davetler beş dakikalık süreyle tutarlıdır. Başarısız yükleme veya açık başka oyun nedeniyle kabul edilemeyen bildirim korunur. Başarılı açılışta oyuncu kartı ve sosyal örtü oyunun önünde kalmaz.

## Satranç

Yeniden bağlanan host güncel tahtayı gönderene, misafir geçerli tahtayı uygulayana kadar hamle kilidi korunur. Bekleyen animasyon bitmeden eski tahta eşitlenmez. Başarısız gönderim yalnız yerel tahtada hamle oluşturmaz.

Eski konumdan kalan sürükleme, önbellekteki yasal hamle, terfi seçimi ve onay penceresi güncel konumu değiştiremez. Hamle tekrar güncel motorda doğrulanır. Oda açılması ve yeniden bağlantı, sinyal bağlantısı hiç açılmasa bile süreyle sınırlıdır; eski oturumun geri çağrıları yeni odayı değiştiremez.

AI arama bütçesi tükenmeden önce tek hamlelik matları denetler. İki renkte de sıfır zaman/bir düğüm bütçesinde mat kaçırılmaz; mat olmayan durumda yasal geri dönüş hamlesi ve giriş konumu korunur. Bu düzeltme bir Elo veya bütün konumlarda üstünlük iddiası değildir.

## Tavla

Kopuk bağlantıda veya eşitleme sırasında hamle, zar ve otomatik zar engellenir. Eşitleme, sıradaki uzak hamleler ve animasyon tamamlanınca güncel konumu gönderir; doğru zamanda kontrolü açar. Gönderilemeyen hamle yerel tahtayı değiştirmez. Bağlantı kesilince eski pointer sahibi temizlenir. Oda ve yeniden bağlantı süre aşımı, bekleyen ikinci misafir ve eski oturum olayları sınırlandırıldı.

## Kelimecik

- Rastgele odaya katılım atomiktir. Host aramayı bitirirken misafir katılırsa silinmiş oda yeniden oluşturulmaz.
- Davet gönderimi/kabulü iptal ve oturum kimliğine bağlıdır. İptal edilen işlem geç gelince oyun açmaz. Kabul yalnız davet edilen oyuncunun boş ve bekleyen odasına yapılır.
- Oda dili, rakip kimliği ve iki oyuncunun devam listesi korunur. İngilizce davet Türkçe torbayla açılmaz. Portal bildirimi gerçek oyun ve davet kimliklerini taşır.
- Canlı maçın rafı kullanıcı/oda/tohum bağıyla yalnız kendi cihazında saklanır. Aynı tarayıcıda yeniden açıldığında güncel taşlar geri gelir. Gerekli eski rafı olmayan cihazda başlangıç harfleri yeniden üretilmez; açıklayıcı hata gösterilir. Süreli maçların mevcut sunucu rafı davranışı korunur.
- Boş torbada son harfi oynayan oyuncunun maçı aynı hamlede biter.
- İptal edilmiş dokunuş, ikinci pointer, değişmiş raf taşı, eski tur sürüklemesi ve geç gelen joker seçimi güncel taşları değiştiremez. Joker aynı taşı iki kez tüketemez veya dolu kareyi ezemez.

## Tetris

İki taraf da yeniden bağlantıda kendi skor/satır durumunu gönderir ve rakibin durumunu ister. Rakip adı lobi geçişinde kaybolmaz. Dinleyici ve gecikmiş eşitleme doğru maç/turla sınırlıdır.

Yeniden bağlantı denemeleri tükenince maç **kesintiye uğramış, kazananı olmayan** sonuçla kapanır. Galibiyet, skor kaydı ve ödül yazılmaz. Bu, v151 raporundaki zafer davranışının yerine geçer: iki istemcinin de bağlantısı kesilebildiği için ikisine de zafer vermek doğru değildir. Davet adı ve kodu HTML olarak yorumlanmaz.

## Doğrulama

Birleştirilmiş kaynak üzerinde `QA/*.mjs` altındaki **45 Node paketi geçti**. Bunlar v151 AI paketlerini, önceki motor/kayıt regresyonlarını ve aşağıdaki 67 ek kontrol grubunu içerir:

| Paket | Grup |
| --- | ---: |
| `chess-online-v151.mjs` | 12 |
| `chess-transport-v151.mjs` | 7 |
| `chess-ai-v152.mjs` | 1 |
| `tavla-online-v151.mjs` | 9 |
| `kelime-online-v151.mjs` | 13 |
| `kelime-input-v151.mjs` | 11 |
| `tetris-online-v151.mjs` | 6 |
| `portal-launch-v151.mjs` | 8 |

Yeni dosyaların bir kısmı çalışma başındaki v151 adıyla kalır; bu rapordaki sonuçlar birleştirilmiş v152 kaynaklarına aittir. 63 JavaScript dosyasının sözdizimi ve diff kontrolleri geçti. Bağımsız satranç hamle sayımı/1.000 hamle, Tavla taş korunması/AI turları, Kelime sözlük ve torba, Tetris fizik/zamanlama/kayıt kontrolleri de paketlerdedir.

Kelime AI süre testi eşzamanlı yoğun çalışmada bir kez sınırı aştı; sınır değiştirilmedi. İzole tekrar ve ardından bütün 45 paketin sıralı son turu geçti. Fiziksel telefon performansı ölçülmedi.

## Doğrulama sınırları

Firebase/PeerJS testleri kontrollü bellek içi taşıma ve olaylar kullanır; üretim hesabına davet, mesaj veya ödül yazılmadı. İki fiziksel cihaz arasında canlı servis maçı ve üretim Firebase izinleri doğrulanmadı. Hostun eşitlemesi esas alınır; bağlantı kopma anında kaybolan paketler için onay/tekrar gönderim protokolü eklenmedi. Canlı Kelime raf kurtarma aynı cihaz/tarayıcıyla sınırlıdır.

Tarayıcıda ara kaynakta satranç AI açılışı, kapanışı, açık oyunun üstüne başka oyun açılmaması ve Tavla mod ekranı gözlendi. Tarayıcı bağlantısı daha sonra hata verdiği için birleştirilmiş v152 üzerinde tam Chromium/Android turu tamamlanmadı; eski tarayıcı paketlerinin geçmiş sonuçları bu sürümde yeniden çalıştırılmış sayılmaz. `QA/invites-v151.cjs` ortak başlatıcı davranışını sınayacak şekilde, worker paketi v152 beklentisiyle güncellendi; bu tur çalıştırılmadılar.

Çevrimiçi maçta iki oyuncunun da v152 yüklemesi önerilir. Bu kontroller bütün olası hata durumlarının bittiği anlamına gelmez.
