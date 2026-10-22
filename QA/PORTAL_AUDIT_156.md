# Hero Portal v156 — doğrulama raporu

Tarih: 22 Ekim 2026. v155 üzerine uygulanan kaynak güncellemesi.

## Uygulanan değişiklikler

- Rekorlar, XP, eşya tüketimi ve maç istatistikleri sunucu onayıyla sonuçlanır. Eşzamanlı işlemler monoton rekorları veya sayaçları geriye götürmez. İşlemler başlangıçtaki hesap sahibine bağlıdır; belirsiz onaylar için kararlı makbuzlar kullanılır.
- Ödül ekranı gerçek yatırılan Kaju/XP tutarını gösterir; kazanç ve maç görevlerini ikinci kez saymaz. Kapanan ekranın animasyonları, zamanlayıcıları ve geciken inceleme açılışı temizlenir.
- Admin paneli seçili hedefi, işlem sahibini ve güncel rolü doğrular. Bildirim/işlem kilitleri, güvenilir arama, nick kayıt işlemleri, korunmuş hesaplar, yeniden sürdürülebilen temizlik ve doğru hata bildirimleri eklendi. Portal kaydı silinirken finansal makbuzlar tutulur; Firebase kimlik hesabının silindiği iddia edilmez.
- Moderasyon gerçek tüketilen kick yollarını kullanır. Güncel admin/operatör yetkileri, korunmuş hedefler ve atomik IP işlemleri denetlenir; IP banının kaldırılması daha sonraki bağımsız banı kaldırmaz.
- Dört oyunda premium tahta/taş/blok malzemeleri ve dar/yatay ekran yerleşimleri. Portalın `.hero-grid` stilinin Tetris kahramanlarını gizlemesi giderildi.
- Tetris antrenman turu ödül/rekor/dünya açılışından çıkarılır. Kelimecik'in eksik Store bağlantısı ve yerel pes etme akışı düzeltildi. Satranç ipucu yalnız onaylı eşya tüketiminden sonra gösterilir. Tavlada bağlantı hatası galibiyet sayılmaz.
- Gerçek konum kayıtları, bağımsız grafik tekrar oynatma ve sınırlı hesaplamaya dayanan maç değerlendirmesi. Arşiv bu hesap ve cihazdaki son 12 maçla sınırlıdır; kayıt sınırı veya depolama hatası gizlenmez.
- Ortak oda durumları, sekme kaydırma konumunun korunması ve aktif maça dönüş. Tetris yerel oyunlarda duraklar; diğer oyunlarda/çevrimiçi maçlarda sürelerin sürebileceği belirtilir. Hesap değişimi eski oyunu devam kaydı yazmadan kapatır. Devam kayıtları hesaplara ayrıdır.
- İşlem Merkezi: gerçek bakiye, cihaz geçmişi, hesap makbuzları, mağaza/klan/Kozmo teslimatları ve mevcut makbuzlardan kurtarma. “Alıcıya gönderildi”, alıcının aldığı anlamında kullanılmaz.
- Ana arkadaş ekranında sınırlı nick araması ve doğrudan oyun daveti; arkadaş isteği ve bildirimi atomik kaydedilir.
- Herkese aynı UTC günlük bulmaca, kazanılmış üç rozetin seçilebildiği başarı vitrini ve 2–8 kişilik özel mini turnuva. Turnuva her eşleşme için iki oyuncunun aynı sonucu onaylamasını ister; Kaju ücreti veya ödülü yoktur.

## Doğrulama

- `QA/*.mjs`: 77/77 paket geçti. Yeni kapsam: admin 25, moderasyon 19, Store 48, ödül 18, ortak merkezler 21, oda/maça dönüş 13, devam sahipliği 8, Tetris 16, satranç/tavla 18, sosyal 11 ve Kelime premium senaryoları.
- Tüm oyun motorlarının ve mevcut regresyon paketlerinin kontrolleri korundu. JS sözdizimi ve `git diff --check` temiz.
- Tarayıcı: gerçek kaynak modüllerinin yalnız veri/kimlik sınırları bellek SDK'sına yönlendirilen ayrı kopyasında masaüstü, 320/360 px ve 740×360 görünümler. İşlem Merkezi, günlük bulmaca çözümü, iki test hesabıyla turnuva katılımı, aktif maça dönüş, Kelimecik maç sonu ve grafik inceleme çalıştırıldı. Admin panelinde yalnız test hesabı/oyuncu araması yapıldı; hesap değişince panelin kapandığı ve ana arkadaş ekranındaki nick aramasının çalıştığı görüldü.
- Orijinal 34 px taç/Diamond görselleri, park ve sürükleme davranışları korunmuştur.

## Doğrulanamayan sınırlar

Üretim Firebase kuralları ve giriş yapılmış gerçek hesaplar bu çalışma ortamında bulunmuyor. İstemci korumaları sunucu yetkilendirmesinin yerine geçmez. Özellikle yeni `privateTournaments/<kod>` yolu için canlı okuma/yazma yetkileri ve sunucu tarafındaki üye/kurucu/sonuç kısıtları ayrıca doğrulanmalıdır. İzin reddinde arayüz başarı göstermez. Gerçek kullanıcıya Kaju/hediye/davet gönderilmedi; canlı ban, silme veya sıfırlama yapılmadı. PeerJS ile iki gerçek cihaz arasındaki ağ koşulları uçtan uca sınanmadı.
