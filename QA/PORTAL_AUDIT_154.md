# HerOyun Portalı v154 — günlük çark ve görev ödülleri

Tarih: 22 Ekim 2026. Yayın tabanı: v153 `0877883cbc8e73944f21c3bfe9fdb68e82278551`, ağaç `b3f0552c876075599f92eb3dea1f19cf278993a9`.

Kullanıcı günlük çark ve görev ödülü almanın başarısız olduğunu bildirdi. Hata mesajı ve canlı hesap oturumu bu çalışmada elde edilemedi. Aşağıdaki uygulama hataları kaynak ve kontrollü testlerle doğrulandı; kullanıcının canlı başarısızlığının tek kök nedeni olarak sunulmaz.

## Bulunan hatalar

- Çarkın Kaju ödülü, oyun kazanımları için kullanılan günlük tavana takılabiliyor veya kırpılabiliyordu.
- XP yazma hatası genel `addXP` içinde gizleniyordu; çark başarı mesajı gösterip hakkı tüketebiliyordu.
- Yumurta teslim hatası gizleniyor, ek Kaju'nun gerçekten yatırıldığı denetlenmiyordu. Kısmi işlemin tekrarı yinelenen ödül oluşturabiliyordu.
- Görev paneli, başka sekmede veya önceki denemede alınmış bir ödülün doğrulanmış kaydını yerel “Alındı” durumu ile uzlaştıramıyordu.
- Panelin kapatılıp açılması, hesap/gün değişimi ve bekleyen işlem sırasında başka görevin ilerlemesi yeterince korunmuyordu.

## Düzeltme

Sekiz çark dilimi aynı kullanıcı/gün makbuzunu kullanır. Seçilen ödül ile Kaju veya XP kaydı aynı profile transaction içinde, yerel erken onay kapalı olarak yazılır. Tekrar deneme ve farklı dilimden ikinci çağrı yeni bir ödül vermez; kaydedilmiş sonuç döner. Sabit çark ödülü oyun kazanım tavanından kırpılmaz; toplam bakiye tavanı korunur. VIP çarpanı sunucu profilinden okunur. Genel oyun `addXP` sözleşmesi değiştirilmedi; çark artık bu işlevin hata gizleyen yolunu kullanmaz.

Yumurta, çark makbuzuna bağlı sabit kimlikle ikinci, tekrar denenebilir aşamada teslim edilir. Teslim kaydı yumurta açıldıktan veya silindikten sonra da kalır; eski ödül yeniden yumurta oluşturmaz. Kaju bonusu önceden kaydolup yumurta aşaması başarısız olursa tekrar deneme yalnız eksik teslimi tamamlar. İki farklı veritabanı kökü tek atomik işlem olarak sunulmaz.

Yerel çark hakkı, görev ilerlemesi ve başarı mesajı tam teslim onayını bekler. Bekleme sürerse “sunucu onayı/bağlantı bekleniyor” durumu gösterilir; zaman aşımı belirsiz işlemi iptal olmuş gibi gösterip yeniden ödül seçtirmez. İzin reddi ile bağlantı hatası ayrı açıklanır. Kaydedilmiş sonuç farklı bir dilimse çarkın işaretçisi gerçek sonuca hizalanır.

Görev ödülleri doğrulanmış makbuzdan bakiye ve tutarı okur. Önceden alınmış ödül yeniden ödenmeden “Alındı” durumuna getirilir. Kayıt reddinde hak korunur. Bekleyen talepler hesap/gün ve görevle bağlıdır; güncel görev ilerlemeleri birleştirilir, eski panelin gecikmiş sonucu başka hesabı değiştiremez.

Aktif portal `economy.js` görevlerini kullanıyor; çağrılmayan eski `quests.js` sistemi değiştirilmedi. `daily.js` giriş serisi mevcut ortak Kaju makbuzu yolunu kullanmaya devam eder.

## Doğrulama

Birleştirilmiş son kaynakta **55/55 `QA/*.mjs` Node test paketi geçti** (30,8 saniye). **63 uygulama JavaScript dosyasının sözdizimi** ve `git diff --check` temiz.

| Yeni paket | Kontrol grubu | Kapsam |
| --- | ---: | --- |
| `reward-store-v154.mjs` | 12 | Onay, ret/yeniden deneme, aynı günlük makbuz, VIP, XP, kimlik, null ile ilk callback, doğrulanmış tutar |
| `economy-rewards-v154.mjs` | 21 | Gerçek çark/görev callback'leri, tüm dilimler, başarısız ve kısmi teslim, tekrar/panel/gün/hesap, gecikme ve ilerleme birleştirme |
| `egg-reward-v154.mjs` | 8 | Sabit teslim, tekrar, silinmiş/açılmış yumurtayı yeniden üretmeme, ret ve hesap sınırı |

Cloud Chromium üzerinden gerçek Store/Economy/Kozmos kaynaklarının kullanıldığı, Firebase yerine yalnız yerel bellek SDK'sı çalışan bir test sayfasında şu akışlar gözlendi:

- İzin reddi: Kaju 100 kaldı; başarı/harcanmış hak yerine açıklama ve yeniden deneme gösterildi.
- İzin düzeldikten sonra aynı çark: 100 → 150 Kaju.
- “Çarkı Çevir” görevi: 1/1; ödül alındıktan sonra 150 → 200 Kaju ve “Alındı”.
- XP dilimi: Kaju 100 kaldı, toplam XP 0 → 40.
- Yumurta dilimi: Kaju 100 → 150 ve yumurta sayısı 0 → 1.

Üretim hesabına, gerçek kullanıcıya, mesaja veya ödül bakiyesine bu testlerle yazılmadı. Eski Playwright CJS paketleri yeniden çalıştırılmadı. Tasarım, CSS, taç/Diamond görselleri, ölçek ve sürükleme kodları değiştirilmedi.

## Doğrulama sınırları

Canlı Firebase kuralları ve kullanıcının giriş yapılmış oturumu erişilebilir değildi. Profile ve Kozmos kökünde transaction yazmasına izin verilmesi gerekir; mevcut kurallar değiştirilmedi veya gevşetilmedi. Gerçek bir `PERMISSION_DENIED` sorununun sunucu tarafında çözüldüğü iddia edilemez. Yeni ekran bu durumu genel “günlük sınır” uyarısının arkasına saklamaz.

v153'teki yerel kullanılmış çark işaretleri otomatik silinmedi. O sürümde başarılı ödeme de makbuzsuz olabildiği için geçmişte başarılı ödeme ile yanlış başarı mesajı yalnız bu işaret üzerinden ayırt edilemez. Belirsiz geçmiş kayıplar otomatik iade edilmedi; geçmiş canlı kayıt ve işlem geçmişi incelenmeden çift ödeme yaratılmaz.

Gün anahtarı önceki sürümlerdeki UTC gününü korur. Bu sürüm takvim politikasını değiştirmez. Yeni kayıt işlemi hesap ve başladığı günle bağlıdır.
