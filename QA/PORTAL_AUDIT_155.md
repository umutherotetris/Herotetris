# HerOyun v155 — Kaju ekonomisi ve Kozmo yaşam alanı

Tarih: 22 Ekim 2026. Yayın tabanı: v154 `d1d9a309e9fb8fe2e185e11beed721c2d7e3f91f`, ağaç `4f498400ec773c0fe8c75989ff2d9f68d6b109ee`.

Kullanıcı Kaju gönderme/alma, admin işlemleri ve ekonominin tamamının incelenmesini; ardından Kozmo sisteminin daha hareketli, sesli, etkileşimli ve premium hale getirilmesini istedi. Kaynakta doğrulanan hatalar aşağıda giderildi. Canlı Firebase kuralları ve giriş yapılmış üretim hesabı erişilebilir değildi; gerçek bir kullanıcının önceki başarısız işleminin tek kök nedeni olarak sunulmaz.

## Kaju kayıtları

- Gönderen bakiyesi, saat/gün/ay limitleri ve kalıcı gönderim kaydı aynı kendi-profil transaction'ında tutulur. Eşzamanlı sekmeler eski yerel sayaçlarla limiti aşamaz.
- Alıcıya yayın başarısız veya sonucu belirsizse kayıt bekler. Belirsiz yayına otomatik iade yapılmaz; aynı kimlikle yeniden yayın, alıcı makbuzuyla yalnız bir kez ödenir. Tekrar deneme başka bir gönderimi başarı kanıtı saymaz.
- İşlem kimliği SHA-256 ile gönderen hesabına bağlanır. HTTPS/WebCrypto bulunmazsa borç düşülmeden açıklama verilir. Bu adlandırma çakışma korumasıdır; sunucu yetkilendirmesi yerine geçmez.
- Tutarlar tam ve güvenli sayı, kullanıcı/işlem yolları geçerli anahtar olmak zorundadır. Bulunamayan alıcı için borç düşülmez. Geçersiz gelen kayıtlar ödeme yapılmadan inceleme için korunur.
- Admin işlemi gerçek uygulanan farkı, yeni bakiyeyi ve işlem geçmişini aynı hedef transaction'ında kaydeder. Sınırda kırpılan tutar doğru raporlanır; aynı işlem kimliği tekrar para üretmez. 1–9 Kaju admin eklemeleri de desteklenir; işlem tavanı 10.000.000 olarak ekranda belirtilir.
- Oyun kazanımının günlük 2.000 sınırı artık atomik sunucu profil sayacındadır. Güncel sunucu bakiyesi varken eski düşük ekran bakiyesi geçerli harcamayı reddetmez.
- Canlı profil/gelen gönderim dinleyicileri, hesap nesli korumaları, hesap bazlı geçmiş ve revizyonlu liderlik aynası eklendi. Eski Auth bildirimi onaylanmış bakiyeyi veya ücretli envanteri geriye döndürmez. Gecikmiş görev/turnuva import'u başka hesaba uygulanmaz.

## Mağaza, klan ve turnuva

Tüm mağaza ödeme yolları (çerçeve/tema, stil, boost, tüketim öğesi, kendine/arkadaşa yumurta, özel Kozmo, sandık ve paket) kalıcı satın alma kaydına geçti. Ücret ve seçilen ödüller birlikte ayrılır; yeniden yükleme/deneme yeni ücret veya yeni rastgele sonuç üretmez. Her teslimin kalıcı onayı vardır. Yumurta açılmış ya da özel yaratık sonradan silinmiş olsa da eski teslim yeniden oluşturulmaz. Sandık/paket Kaju tutarı oyun kazanım tavanına kırpılmaz. Çerçeve/tema gerçek mağaza sahipliğine yazılır. VIP fiyatı gösterilen ve uygulanan tutarda eşleşir.

v154'te `grantEgg` kimlik sözleşmesi değişmiş, mağazadaki eski nadirlik argümanlarıyla uyumsuz kalmıştı. Çağrılar açık kullanıcı + sabit teslim kimliği + doğrulanmış asgari nadirlik olarak düzeltildi.

Klan bağışı önce oyuncu profilinde ayrılır, sonra klan kasası/bağış makbuzu/bağışçı toplamı aynı klan transaction'ında tamamlanır. Silinmiş, dolmuş veya bozuk hedef için terminal iptal makbuzu yazılmadan iade yapılmaz; böylece geç gelen teslim ve iade birlikte gerçekleşmez. Bakiye tavanı iadeyi engelliyorsa kayıt korunur. Klan kapanması teslim makbuzlarını saklar. Admin kasa desteği de kararlı kimlik ve gerçek tutarla tek klan transaction'ındadır. Ekran hesap/klan değişiminde eski hedefi kullanmaz.

Admin ilerleme sıfırlaması cüzdan revizyonunu artırır; ödeme makbuzlarını, bekleyen gönderimleri ve limit sayaçlarını silerek eski işlemleri tekrar oynatmaz. Turnuva ödülü doğru hesaba/haftaya bağlanır; aynı ödül tekrar ödenmez, makbuz tutarı ve sonraki bildirimler hesap sınırını korur.

## Kozmo işleyişi

- Günlük ücretsiz hediye hakkı veya sonraki hediyenin 50 Kaju ücreti kalıcı gönderim niyetiyle birlikte ayrılır. Alıcı kutusunda sabit anahtar ve teslim tombstone'u bulunur; bir hediye diğer bekleyen hediyeyi ezmez. Alıcının kabulü de sabit yumurta + kalıcı kabul makbuzudur; temizleme hatası ikinci yumurta üretmez.
- Kuluçka, sunucudaki olgun yumurtayı tek Kozmos transaction'ında kaldırıp sabit yaratık ve kuluçka makbuzu oluşturur. Eski sekme, çift tıklama ve kayıp onay aynı yumurtadan ikinci yaratık çıkarmaz.
- Besleme hakkı yumurta başına yerel takvim gününde 3, aktif VIP için 5 olarak korunur. Fazladan besleme tam bir besin öğesi ayırır. Ayrılan hak/öğe, teslim kaydıyla takip edilir; hedef kalkmışsa terminal iptalden sonra yalnız bir kez iade edilir.
- Füzyonda taş ayrımı ve seçilmiş sonuç kalıcıdır. İki gerçek ebeveynin kaldırılması, sonuç yaratığı ve makbuz aynı Kozmos transaction'ındadır. Onayı iptal etmek taş tüketmez. Taş modu, sabit eşleşme tablosundan önce mevcut Görkemli havuzunu kullanarak ilan edilen garantiyi sağlar; taşsız sonuç oranları korunur.
- Aktif Kozmo seçimi `hero_active_kozmo:<uid>` içinde sahibiyle tutulur. Sahibi bilinmeyen eski global seçim yeni hesaba aktarılmaz. Normal türün tanımlı bonusu kullanılabilir; sayısal olmayan/sonsuz bonuslar etkisizdir. Silinen veya füzyonda tüketilen aktif yaratığın bonusu canlı koleksiyon dinleyicisiyle kaldırılır.

## Premium yaşam alanı

Seçili yoldaş için kozmik sahne, katmanlı ışıklar, hareketli yörüngeler, zemin ve mevcut SVG'nin büyük görünümü eklendi. Dokunma/sevme/oynama tepkileri, kısa konuşma balonları, tür sesleri, bilgi ve aktif yoldaş seçimi vardır. Koleksiyondan başka bir Kozmo seçilebilir. Henüz yaratık yoksa ilk yumurta aynı sahnede gerçek kuluçka fazı ve güvenli besleme eylemiyle görünür.

Ses varsayılan kapalıdır; kullanıcı açar. Ses ve hareket sayfa gizlenince durur, kapanışta sahnenin ses bağlamı/dinleyicileri/zamanlayıcıları temizlenir. Hareket azaltma tercihi desteklenir. İsim/metadata metin olarak yazılır; sahne SVG'sindeki aktif içerik ve dış bağlantılar temizlenir. Taç/Diamond varlıkları, ana 34 px ölçek ve sürükleme kodu değiştirilmedi.

Sevme/oynama sunum etkileşimidir; sahte kalıcı bağ seviyesi, XP veya Kaju ödülü eklenmedi. Sonraki ortak tasarım için öneriler: günlük sınırla artan bağ, kişiliğe özgü tepkiler, görsel evrim, sınırlı malzeme/dekor kazandıran keşifler ve yaşam alanı koleksiyonu. Bunlar bu sürümde uygulanmış özellikler olarak sunulmaz.

## Doğrulama

Son birleştirilmiş kaynakta **66/66 `QA/*.mjs` Node test paketi geçti** (43,94 saniye). **68 JavaScript dosyası sözdizimi** ve `git diff --check` temiz.

| Yeni paket | Kontrol grubu |
| --- | ---: |
| `kaju-transfers-v155.mjs` | 28 |
| `kaju-ui-v155.mjs` | 29 |
| `kaju-notify-v155.mjs` | 8 |
| `shop-purchases-v155.mjs` | 27 |
| `clan-economy-v155.mjs` | 24 |
| `tournament-kaju-v155.mjs` | 13 |
| `kozmos-gifts-v155.mjs` | 15 |
| `kozmos-hatch-v155.mjs` | 11 |
| `kozmo-care-v155.mjs` | 20 |
| `kozmo-active-v155.mjs` | 7 |
| `kozmo-stage-v155.mjs` | 12 |

Mevcut ödül/oyun/motor paketleri de bu 66 paket içinde geçti. Eski harici Playwright CJS tarayıcı paketleri çalıştırılmadı.

Cloud Chromium'da gerçek uygulama kaynaklarıyla, Firebase yerine yerel ve yeniden yüklemeye dayanıklı bellek SDK'sı kullanan kontrollü sayfada şu durumlar görüldü:

- Alice 1.000 → 900, Bob 50 → 150: 100 Kaju aktarımı. Tekrar talep ekstra ödeme oluşturmadı.
- Bob hesabı açıkken güvenilir test sunucusu +500: görünen ve kayıtlı bakiye 650 oldu.
- Admin +500: Bob 650 → 1.150, admin 800 kaldı. Admin −200: Bob 950, gösterilen gerçek fark −200.
- Yayını reddedilen 100: Alice 900 → 800, Bob 950 kaldı; ekran bekleyen teslim gösterdi. İzin düzelince Bob 1.050, Alice 800 kaldı; tekrar talep ikinci ödeme yapmadı.
- Teslimi reddedilen 500'lük yumurta: Alice 50.800 → 50.300, yumurta 0, bekleyen satın alma 1. Kurtarma sonrası bakiye 50.300, yumurta 1, bekleyen 0.
- Yeni yaşam alanından besleme: gerçek kuluçka fazı 0 → 1, beslenme 0 → 1, Kaju değişmedi.
- Nebula Kedi sevme/oynama tepkisi, aktif yoldaş seçimi, ses aç/kapat durumu ve Prizma Kalbi'ne geçiş görüldü. 320 px iframe'de kontroller kullanılabilir, yatay taşma yoktu (305 px kullanılabilir alan/305 px scrollWidth).

HTTP yönetilen önizlemede WebCrypto yokluğu borç düşmeden doğru açıklamayı üretti. Diğer gönderim ekran akışları için yalnız kopyalanmış test modülündeki kimlik üretimi kararlı yerel kimlik tablosuyla değiştirildi. Üretimdeki SHA-256 kodu Node'un gerçek WebCrypto'suyla ayrıca sınandı. Tarayıcı testi bu ayrım gizlenerek canlı Firebase testi gibi sunulmaz. Kaydedilen görsel `kozmo-preview-v155-20261022.jpg` kontrollü örnek koleksiyonuna aittir.

## Canlı ortam sınırı

Üretim bakiyesi, gerçek transfer, mesaj, hediye veya satın alma yapılmadı. Yeni kayıt alanları ve kendi-profil, klan, Kozmos ve alıcı kutusu transaction'ları için mevcut Firebase izinleri üretimde doğrulanamadı. Özellikle alıcı kutusu kök transaction'ları mevcut kurallara bağlıdır. İstemci kontrolleri sunucuda sahiplik/yetki/ödül doğrulamasının yerini tutmaz; Firebase kuralları değiştirilmedi veya gevşetilmedi.

Geçmişte kaydı tutulmadan kaybolmuş olabilecek tutarlar otomatik olarak iade edilmedi. Yeni sürüm belirsiz durumları kalıcı kayıt ve açık bekleme/yeniden deneme durumuyla korur; geçmiş gerçek kayıp için canlı kayıt incelemesi gerekir.
