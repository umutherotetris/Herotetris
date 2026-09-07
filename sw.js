/* SÜKÛN r710 — Audio Truth & Cinematic Stability */
'use strict';

const SURUM = 'r710';
const CACHE = 'sukun-r710-20260908a';

const CORE = [
  './nero.html',
  './manifest.webmanifest',
  './assets/tefekkur-sanctuary.webp',
  './assets/tefekkur-sanctuary-r710.webp',
  './assets/tefekkur-sanctuary-r710-small.webp'
];
const OPTIONAL = [
  './surumler.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];
const BUILD_MARKER='./__sukun_build_r710__.json';

const NOTLAR = [
  "r710 · Ses uzlaştırma döngüsü: r693/r637 fiziksel ses kanıtını ortak kullanır; değişmeyen Hub/Life durumları tekrar olay yayınlamaz. Hazırlık/kurtarma için sınırlı bekleme korunur. Sayaç görünür çiziminde güncel zikir durumu önce yayınlanır; sessiz kilit ekranı uzlaştırması DOM'u gereksiz çizmez. Cami, Mevlevî silueti ve su yansımalarıyla sinematik Tefekkür sahnesi; kompakt gerçek HTML kontrolleri. Android gerçek ses ve uzun kullanım doğrulaması ayrıca gereklidir.",
  "r709 · Sinematik Tefekkür sahnesi: gerçek kaynak görsellerden yazısız cami/Mevlevî arka planı, zümrüt-mavi ışıklar ve altın geometrik sayaç süsü; dar Hedef/Kalan kartları, kompakt ulaşılabilir kontroller. Ses, sayaç, seyir, kayıt ve r708 kaydırma otoriteleri korunur.",
  "Tefekkür üst ve alt sınırları tek kaydırma rezervine bağlandı; dış kapsayıcının ikinci alt boşluğu kaldırıldı.",
  "Tefekkürün belge kaydırması serbest bırakıldı; sabit ekran ve kart yüksekliği kilitleri kaldırıldı. Neon atmosfer ve mevcut gerçek kontrol sahipleri korundu.",
  "r706 · Onaylanan canlı neon atmosfer: mor–mavi–zümrüt dumanlar, ışıklı yörüngeler ve gerçek sayaç değişimine bağlı ışık dalgası. Görsel hareket/pil/görünürlük bütçesi; Tefekkürün ilgisiz sınıf değişikliklerinde gereksiz ölçümü ve dock boyutlarını silip yeniden yazma düzeltildi. Transport dokunma hedefleri 44 px. Android/kilit ekranı ve gerçek ses doğrulaması ayrıca gereklidir.",
  "Kısa yatay ekranlarda Tefekkürün mevcut sayaç ve kontrol panelleri iki sütunda düzenlenir; çıkış ve sayma kontrolleri görünür çalışma alanına yaklaşır.",
  "Tarayıcının Element, Node, HTMLElement ve DOMTokenList prototiplerine yapılan r703 müdahalesi kaldırıldı. Gereksiz yazımlar Tefekkür, sekmeler, seyir kartları, bildirimler ve tema modüllerinde yerel olarak engellenir.",
  "Açılış donmasının ana kaynağı ölçüldü ve giderildi: tema rengi eşleyicisi body'nin her class değişiminde getComputedStyle çağırıp senkron tam stil hesabı zorluyordu. Kare başına tek çağrıya indirildi ve tema imzası değişmediyse hesap hiç yapılmaz.",
  "28 İsim düğmesindeki değişmeyen metin yazımı ve kendini yeniden tetikleyen MutationObserver döngüsü giderildi.",
  "r700 tanısındaki yanlış görünürlük FAIL düzeltildi: gizli sekmenin çocuğunda display:flex bulunması, ekranda görünür olduğu anlamına gelmez.",
  "Onaylanan yeşil–mavi–mor neon Tefekküre Geç tasarımı aktif zikir adı ve anlamının altındaki doğal akışa entegre edildi.",
  "Akış barının Mini/Midi/Max, sürükleme, güvenli alan ve kaydırma geometrisi tek r699 otoritesinde birleştirildi; yarışan eski layout runtime’ları uyumluluk katmanına alındı.",
  "Tek görünür player: eski r170NowBtns satırının yeniden görünmesi ve görünmez tıklama alanı kaldırıldı; Mini/Midi/Max tek DOM ve gerçek kontrol sahipliği kullanır.",
  "Onaylanan neon Tefekkür düzeni gerçek DOM’a entegre edildi: Tefekkürden Çık, Hedef/Devir ve Ses rozetiyle aynı durum satırında; ayrı çıkış grid satırı kaldırıldı.",
  "Telefon araması/alarm gibi OS audio-focus kesintilerinde hidden sekmede AudioContext.resume() döngüsü artık işletim sistemiyle çekişmez; recovery yalnız görünür dönüşte tek akıştan yapılır.",
  "Sayaç muhasebesi tek delta-ledger altında birleştirildi: niyet/transport/voice kapısı tarafından reddedilen tekrar artık günlük zikir veya Esmâ kullanım sayacını artırmaz; bendir de gerçek sayaç ilerlemeden vurmaz.",
  "Section Identity düzeltildi: doğrudan/otomatik Esmâ ve Berhetiyye artık kategori adına bakılarak 99/28 Seyri diye yanlış kimliklenmez; gerçek journey state yoksa owner=mix ve başlık Zikir seansı kalır.",
  "r692 hedef zamanlayıcısındaki yeni bir mantık hatası kapatıldı: hidden sayaç tasarım gereği artmadığı için timer fire anında room>1 kontrolü her normal Ebced hedefini stale sanıp yeniden kuruyordu. r693 armed-ledger, source/key/target snapshotıyla sınırı exactly-once işler.",
  "r691 fiziksel raporunda normal otomatik Esmâ zikirinin kilitte hedef/ebced sınırını doğru zamanda geçmesine rağmen sonraki hedef zamanlayıcısının bazı isimlerde yeniden kurulmadığı görüldü; kilit kaynağı bir isimde kalırken dönüşte geçmiş süre sonraki Esmâlara dağıtılıp birkaç isim birden atlanabiliyordu.",
  "r690 fiziksel tanısındaki foreground-stale-28 kökü düzeltildi: pause sözleşmesinde run=false + paused=true artık canonical paused journey olarak tanınır; duraklatılmış seyir yanlış stale-owner uyarısı üretmez.",
  "Tam paket statik + fiziksel tanı taraması: r688 raporunda transport düğmelerinin touch-action değeri hâlâ pan-y çıkıyordu; r688 :where() kuralı eski ID !important specificity'sini yenemiyordu. r690 doğrudan son cascade otoritesi kullanır.",
  "Kilit ekranından dönüşteki 20–30+ saniyelik bekleme fiziksel logdan izole edildi: hidden native kayıt görünürde hâlâ playing sayılıp r651 graceful-drain yolunda stale currentTime/ended olayını bekliyordu.",
  "Fiziksel Android tanısı tıklama teslimindeki kaybı görünür kıldı: 68 pointerdown olayına karşı yalnız 20 click oluşmuştu; özellikle dock transport düğmeleri pan-y gesture sözleşmesindeydi.",
  "Tanı raporundaki gerçek AUDIO FAIL düzeltildi: zaten idle/ended olan sağlayıcıya cleanup stop gönderildiğinde registry artık sahte idle→stopping geçişi üretmiyor; fiziksel stop callback yine çalışıyor.",
  "Tam paket bütünlük ve interaction sweep.",
  "Regression Shield yanlış FAIL veriyordu. adaptive-dock-fit denetimi dock otoritesini r662'ye sabit eşitlikle bağlıyordu; modül r670'te r679'a yükselirken bu satır güncellenmemiş. Denetim gerçek geometriyi hiç ölçmeden koşulsuz FAIL basıyordu.",
  "Kaydırma handoff: dock contain kaldırıldı; iç yüzey kaymıyorsa hareket sayfaya geçer.",
  "İlk dokunuşu yutan legacy focus-calm wake-click listener emekli edildi.",
  "Kök neden düzeltildi: görünen Mini/Midi/Max #r588Play/#r588Stop transportu 28/99 Seyir aktifken artık autoStart/autoStop yoluna düşmez; doğrudan journey aggregate transportuna gider.",
  "28/99 Seyir dock Pause atomik hale getirildi: seyir aktifken okuyucu/mix sınıflandırmasına bakılmadan fiziksel mix ve auto-zikir ritmi önce donar, ardından journey state pause olur; foreground kuyruğuna düşmez.",
  "Max gerçek height otoritesine geçirildi; eski --r659-dock-fit-h artık Max'i küçük intrinsic yüksekliğe geri çekemez.",
  "Max akış barı tam çalışma görünümüne alındı: Tefekkürde gerçek içerik yüksekliği kadar büyür, zorunlu iç scroll yerine bütün kontroller aynı yüzeyde görünür.",
  "Hedef/Kalan/Devir/Ebced görünürlüğü focus-calm opaklık geçişlerinden ayrıldı; sayılar artık görünüp kaybolmaz.",
  "Adaptive dock rawGap'i yükseklik olarak kullanmayı bıraktı; dock intrinsic içerik ihtiyacı kadar büyür.",
  "ÇÖZÜLDÜ · Kapatma düğmesinin altındaki boşluk. Bir önceki sürümde gövde satırı içeriğe bağlanmıştı ama yalnız normal kipte tuttu; Tefekkür kipinde daha yüksek öncelikli bir kural satırı esnetmeye devam ediyordu.",
  "ÇÖZÜLDÜ · Akış barında Mini kipte görülen büyük boş alan. Kusur üç turdur yeniden üretilemiyordu, çünkü kip yalnız küçükten büyüğe doğru deneniyordu. Azalan yönde denenince hemen ortaya çıktı.",
  "Akış barının alt bandındaki süs satırları inceltildi. Ölçüm sorunu doğruladı: tutamaç ile kip seçici birlikte sabit elli piksel tutuyordu ve Mini kipte bu, barın dörtte birinden fazlasıydı. Tefekkür yuvası ile kapatma satırı göründüğünde pay daha da artıyordu.",
  "KRİTİK · Sistem Durumu ekranı hiç açılmıyordu. Tanılama denetimlerinden biri tanımsız bir değişkene başvuruyor ve ekran açılırken çöküyordu; hemen üstteki satır aynı veriyi başka bir adla alıyor, anlaşılan bir yeniden adlandırma yarım kalmış.",
  "Coupled Zikir–Dock Fit: bottom-docked akış barı artık yalnız kendi yüksekliğini değiştirmez. Uygulanan dock yüksekliği mevcut SukunLayoutEngine'e geri beslenir; Tefekkür/zikir çemberi ve sayaç alanı dock rezervine göre küçülüp büyüyerek ekranı birlikte paylaşır.",
  "Context-Aware Dock Profiles: Mini/Midi/Max artık yalnız zikir kartının altında kalan boşluğa sıkıştırılmaz. Her modun kullanılabilir bir intrinsic yüksekliği vardır; boşluk büyükse alanı doldurur, boşluk küçükse kontrollü overlay ile tam player içeriğini korur.",
  "Adaptive Dock r660 gerçek alt kenarı mevcut host yüksekliğinden değil visualViewport + computed bottom otoritesinden hesaplar; mod değişiminden sonra eski host yüksekliği yeni fit hesabını sınırlayamaz.",
  "Adaptive Bottom Sheet: Mini/Midi/Max bottom-docked iken sabit piksel yükseklikleri yerine visualViewport ile canonical zikir/Tefekkür yüzeyinin gerçek alt sınırı arasındaki kalan alanı tek r659 layout authority hesaplar.",
  "Clickless Recording Boundaries: kısa kendi kayıt tekrarlarında yeni ses 18 ms mikro attack ile açılır; doğal/trim sonundaki son ~28 ms dry+wet gain AudioParam ses saatiyle sıfıra iner. Main-thread gecikmesi transient fade zamanını kaydıramaz.",
  "Audio Continuity: özel Hû kapanış kaydı foreground playRecording/soft-stop zincirinden ayrıldı; kendi kısa WebAudio bus’ında çalar ve aktif zikir kaydını, SES/Arbiter/Now Playing/source state’ini artık superseded ile kesmez.",
  "Journey/Audio State Machine r656 uzlaştırması eklendi: aktif seyir fiziksel olarak PLAYING, provider run=true/paused=false ve AudioTruth userPaused=false iken 1.4 saniyeyi aşmış stale pause intenti otomatik temizlenir; USER_PAUSED → PLAYING_VISIBLE/PLAYING_HIDDEN gerçeğe döner.",
  "Echo Attachment Authority tekilleştirildi: journey-native ve journey-native-r648 aynı persistent native ses için tek canonical echo lease kabul edilir; aynı key/src/baked kombinasyonundaki ikinci attach fiziksel yeniden bağlama yapmaz.",
  "Terminal Journey Reconciliation güçlendirildi: 28/99 seyri Stop/Complete ile kapandıktan sonra run=false fakat paused=true kalan provider state artık gerçek terminal idle durumuna temizlenir; kullanıcı tarafından gerçekten Pause edilmiş seyir korunur.",
  "Hidden MediaSession Pause Intent Guard v2: aktif 28/99 seyri kilitteyken gelen ilk pause artık süre dolunca otomatik kullanıcı Pause’una çevrilmez; tek hidden pause platform ghost adayı olarak bastırılır.",
  "Wake-Edge Media Pause Guard eklendi: aktif 28/99 seyri kilitteyken gelen MediaSession pause komutu kısa doğrulama penceresine alınır; kilit açılışı sırasında oluşan platform kaynaklı ghost pause kalıcı userPaused latch’ine dönüşmez.",
  "Lock Stability / No-Recovery-Storm: r648 native lease kilitte pause olayı aldığında artık otomatik play/revive fırtınası başlatmaz; pause yalnız dormant transport durumu olarak kaydedilir.",
  "Pronunciation Integrity eklendi: native kendi kayıt okuması sırasında hiçbir stall/recovery yolu currentTime'ı 80 ms geri saramaz; hece ortası tekrarları engellenir.",
  "Regression & Soak Laboratory eklendi: 28/99 × kendi kayıt/TTS × görünür/kilit × normal/isim geçişi × continue/user pause-resume/system interruption-resume kombinasyonlarından oluşan 48 senaryoluk deterministik matris tek dokunuşla çalışır.",
  "Lock Screen Transport 2.0 eklendi: 28 İsim ve 99 Esmâ seyri kendi kayıt kullanırken ekran gizlenince aynı persistent native audio kaynağı gerçek loop transportuna devredilir; her tekrar için yeni JS play çağrısı gerekmez.",
  "Unified Journey / Audio State Machine eklendi: 28 İsim ve 99 Esmâ seyri için IDLE → PREPARING → PLAYING_VISIBLE → PLAYING_HIDDEN → SWITCHING → RECOVERING → USER_PAUSED → COMPLETE/ERROR durum sözleşmesi tek otoritede izlenir.",
  "Core Performance I: düşük riskli UI polling döngüleri sürekli interval yerine playback/state/input olaylarına bağlandı; ses/sayaç çekirdeği değiştirilmedi.",
  "Aktif isim satırının dikey ritmi rafine edildi: başlık, süs çizgileri ve alt künye daha kompakt nefes payıyla yeniden dengelendi; kısa ve uzun isimlerde üst blok gereksiz boşluk üretmez.",
  "Aktif isim başlığı optik merkez düzeltmesi: Berhetiyye/Esmâ adı ile iki yandaki süs/çizgi seti yeniden dengelendi; bilgi ikonu başlığın görsel merkezini kaydırmayacak şekilde simetrik nefes payı ve karşı denge ile ortalandı.",
  "Tefekkür ekranındaki aktif Berhetiyye/Esmâ adı doğrudan tıklanabilir bilgi tetikleyicisine dönüştürüldü; sayaç veya ses davranışı değişmeden açıklama kartı açılır.",
  "Journey Continuity Guard: 28 İsim ve 99 Esmâ seyirlerinde eski/stale bir kayıt callback’i superseded sonucu döndürse bile kullanıcı pause yapmadıysa aktif seyir artık hata diye kapanmaz; aynı tekrar kontrollü biçimde yeniden denenir.",
  "Transport-Gated Counter eklendi: görünür Tefekkür ekranında sesli otomatik zikir gerçek ses transportu duraklatılmışsa sayaç, tık, titreşim ve halka animasyonu ilerlemez.",
  "Echo Attachment Authority: 28/99 seyir kilit sesinde yankı artık ikincil autoplay tap'lerine bağımlı değil; görünürken tek persistent native medya dosyasına önceden işlenmiş echo WAV hazırlanır ve kilitte aynı medya elementi bunu çalar.",
  "Kilit ekranında 28/99 seyir için kullanılan persistent native kayıt yoluna Native Lock Echo Bridge eklendi; WebAudio askıya alınsa bile kendi kayıttaki yankı korunur.",
  "Audio Truth Reconciliation eklendi: Registry, AudioLife, AudioHub ve Foreground Arbiter tek canonical ses gerçeği altında uzlaştırılır; user pause/aggregate pause her zaman üstün gelir.",
  "Kendi kayıt varken TTS’e düşen yol kapatıldı: Esmâ için IndexedDB kaydı, Akıllı Seans/Düzen, 28/99 seyir, terkip, Foreground Queue ve tekil okuma yollarının tamamında TTS’ten önce zorunlu olarak aranır.",
  "Unified Foreground Queue / Session Arbitration eklendi: 28 İsim, 99 Esmâ, tekil/ek Esmâ, terkip ve sesli otomatik zikir aynı anda ikinci sözlü player açmak yerine tek foreground hakeminden geçer.",
  "28 İsim/Zikir akışında kilit ekranında hedef dolunca mantıksal isim ilerleyip native sesin eski isimde kalmasına yol açan hidden hazırlık kapısı düzeltildi.",
  "Akış barının görünür r588 kabuğu doğrudan sürüklenebilir hâle getirildi; eski gizli drag handle artık kullanıcı etkileşiminin sahibi değildir.",
  "State Authority katmanı currentZikirState, Audio Session Registry, currentFlowState, Voice Session Coordinator ve 28/99 seyir durumlarını tek canonical snapshot altında birleştirir.",
  "Dört geçişli skin seçimi iki güçlü yöne indirildi: varsayılan premium kabuk Osmanlı Mührü, modern alternatif Semerkant Neon oldu.",
  "28 İsim ve 99 Esmâ seyirleri gerçek son okuma tamamlandığında ortak bir tamamlanma mührüyle kapanır.",
  "Yeni sürüm bekleme durumunda takılı kalabiliyordu. Ölçüm: güncelleme doğru kuruluyor ve önbelleğe alınıyor, ama tasarım gereği bekliyor; devreye girmesi için kullanıcının Yenile bildirimine dokunması gerekiyor. Bekleme bilinçli bir tercih ve doğru — çalan bir zikri yarıda kesmemek için.",
  "KRİTİK · Uygulama boştayken kendi kendini besleyen bir arayüz fırtınası çalışıyordu. Ölçüm: on saniyede bin üç yüz altmış mutasyon, saniyede üç yüz on altı zamanlayıcı ve iki yüz on altı kare isteği. Referans değerler saniyede on dört ve altmış beşti. Bu yük telefonu ısıtan ve uzun görevleri doğuran asıl sebepti.",
  "r624 cihaz raporu, Derin Testin canlı __diag_* ses oturumlarını registryye ekleyip pauseAll/resumeAll çalıştırdığını ve Tekke kapısını rapor sırasında açık bıraktığını kanıtladı; tıklama kilidinin bu kaynağı kaldırıldı.",
  "Sistem Durumu paneline Tam Tanı ve Testler ile JSON Rapor için görünür, tek dokunuşlu girişler eklendi; sürüm satırının altında da doğrudan tanı düğmesi bulunur.",
  "28 İsim Seyri, playing sonrasında ended/error üretmeyen Android medya durumunu currentTime ilerlemesiyle algılar; aynı fiziksel kaynak bir kez uyandırılır, ilerlemezse güvenli ses yedeğine düşer.",
  "Aynı ses durumu artık periyodik playbackchange nabzıyla yeniden yayımlanmaz; yalnız anlamlı değişiklik arayüz abonelerini uyandırır.",
  "Arayüz geçişi görünür mini bar veya bayat aktif durumuna göre kilitlenmez; yalnız gerçek playing/stopping sağlayıcıları ve çalışan seyirler ses kabul edilir.",
  "r615 Klasik görünümü varsayılan ve ana düzen olarak korur; r616 Sade ile yeni zikir merkezli Odak görünümü Ayarlar içinden seçilebilir.",
  "Ana arayüz Bugün, Zikir, Seyirler ve Sesler olarak sadeleştirildi; çalışan ses ve seyir motorları değiştirilmeden aynı kontrollere bağlandı.",
  "Tefekkür üst sahnesinde r588 zBar sızıntısı kesin olarak kapatıldı; DİNLE/DÖNGÜ/KENDİ SESİN/NIYET düğmeleri artık üstte yarım kart olarak görünmez.",
  "Mini akış barı ana menünün tema camıyla eşleşir; Ayarlar içinden açılıp kapatılır ve yüzey şeffaflığı canlı ayarlanır. Metin/düğme opacitysi değişmez; Midi ve Max etkilenmez.",
  "Zikir sayaç kartı normal görünümde gerçek içeriği kadar uzar; tam ekran Tefekkürde taşan kontroller kart içinde dokunmatik olarak kaydırılabilir.",
  "Ekranın üstünde açıklanamayan bir gölge vardı; kaynağı canlı sitede ölçülerek bulundu. Tanıtım perdesi etkin durumda, tam ekran, en üst katmanda ve arkaplanı merkezde yüzde seksen sekiz, kenarlarda yüzde doksan yedi koyulukta bir degrade. Uygulama bu perdenin ardında kalıyor; ekranın ortası nispeten net, kenarlar karanlığa gömülü görünüyordu.",
  "ÇÖZÜLDÜ · Okumalar, Seyirler ve Araçlar kartlarının dar dikey şeritlere dönüşüp gezinme düğmelerinin üstüne binmesi. Sebep canlı sitede ölçülerek kesinleşti: kartların kapsayıcısı, Önceki ve Sonraki düğmelerini tutan gezinme kümesinin içine giriyor. O küme satır yönlü esnek yerleşim olduğu için kapsayıcı üç piksele sıkışıyor ve kartlar üç piksele iki yüz altmış iki piksellik şeritlere dönüşüyordu.",
  "Tefekkür düğmesi Mini kipte barın en altında kalıp kırpılıyordu. Bir önceki sürümde düğme kip satırının altına yerleştirilmişti; bar zaten kısa olduğu için düğme alt kenara denk geliyor ve yarısı görünmüyordu.",
  "Akış barında iki ayrı durdur ve başlat çifti aynı anda görünüyordu. Bar yeniden yazılırken eski dock düğmeleri kaldırılmamış, yalnız üzerine yenisi eklenmişti. Ölçüm ikisinin de görünür olduğunu doğruladı; kullanıcı hangisinin ne yaptığını bilemiyor ve barın üst kısmında koca bir boşluk kalıyordu.",
  "Max kipinde alt sıradaki gezinme ve oynat düğmeleri çerçeve dışında kalıyordu. Bir önceki turda Mini ve Midi düzeltilmiş ama Max atlanmıştı; orada sınır ekranın yüzde altmış dokuzu ya da beş yüz kırk pikseldi.",
  "Mini ve Midi kiplerinde alt sıradaki oynat ve durdur düğmeleri çeyreğinden kesiliyordu. Akış barı bu iki kipte sabit yükseklik sınırıyla ve taşma gizli olarak çiziliyordu; içerik sınırı aşınca alt sıra kırpılıyor, dokunma alanı da eksiliyordu.",
  "KRİTİK · Uygulama içi sürüm notları listesi hiç açılmıyordu. Notların tutulduğu veri bozulmuştu: her yeni sürüm eklenirken kapanış işaretinden sonra fazladan bir açılış köşeli parantezi yazılmış ve hiç kapatılmamış. Hata her eklemede biriktiği için yapı derinliği kayıttan kayıta tırmanmış ve veri tamamen ayrıştırılamaz hâle gelmişti.",
  "Mini/Midi/Max barın sağındaki küçültme düğmesi legacy owner hesabından ayrıldı; artık aktif akışta her koşulda premium kapsüle iner ve kapsüle dokununca aynı moda geri döner.",
  "Zikir başlamamışken r588 dock sahibinin #r170Now elemanını zorla görünür tutması kaldırıldı; bu durum eski bildirim drawerı çocuklarının dar dikey şeritler halinde Zikir sahnesine sızmasına yol açıyordu.",
  "Mini akış barında play ve stop düğmeleri mobil genişliklerde küçültülüp yeniden oranlandı; artık yarım görünmez ve sağ kenara taşmadan tam oturur.",
  "Bildirim ekranındaki büyük yerleşim bozulmasının kök nedeni düzeltildi: r588 akış barı drawer açıldığında canonical #r554AlertDrawer grid yapısını display:flex ile eziyordu; drawer yeniden tek kolonlu grid otoritesine döndürüldü.",
  "Akış barı temiz refactor edildi: Mini, Midi ve Max artık ayrı DOM katmanları değil, tek #r588DockShell içinde görünürlük seviyeleri olarak çalışır. r583/r585/r587 yarışan mod yüzeyleri emekli edildi.",
  "Akış barı mod geçişi yeniden kuruldu: Mini görünüm artık mod seçiciyi saklamaz; Mini → Midi → Max ve ters yönde aynı oturum içinde her zaman erişilebilir.",
  "Akış barı üç gerçek boyuta ayrıldı: Mini, Midi ve Max. Önceki sürümlerde Midi yalnız expanded sınıfını, Gizli ise üçüncü mod gibi kullanıyordu; bu yüzden üç farklı boyut oluşmuyordu.",
  "Akış barına görünür bir mod anahtarı eklendi: Mini, Midi ve Gizli. Kullanıcı artık aynı dock üstünden yoğunluk seviyesini tek dokunuşla seçebilir.",
  "Canlı akış barının eski zengin bilgi katmanı geri getirildi: ana akış başlığı, ses kaynağı, çalma durumu, aktif bölüm, arka plan katmanları ve TÜR/DURUM/KATMAN/SES/KALAN bilgileri yeniden görünür.",
  "Tekke aktif seansında geniş SÜKÛN dönüş düğmesi üst başlık satırından çıkarıldı; TEKKE markasıyla artık hiçbir genişlikte üst üste binmez.",
  "Tekke üst barındaki SÜKÛN düğmesi yatay olarak genişletildi; daralan flex davranışı sınırlandı ve yazı için güvenli bir minimum genişlik tanımlandı.",
  "Kendi kayıt oynatımındaki Blob nesne-kimliği çakışması kaldırıldı; IndexedDB aynı kaydı yeni Blob nesnesiyle döndürse bile Audio/MediaElementSource havuzu yeniden kurulmaz.",
  "99 Esmâ Seyri’nin kaybolmasına yol açan eski kategori görünürlük şartı kaldırıldı. Kart artık seçili zikir Esmâ, Berhetiyye, terkip veya başka bir kategori olsa da Zikir > SEYİRLER içinde kalıcı görünür.",
  "Ana zikir sesi için tek oturum sahipliği eklendi: 28 İsim Seyri, 99 Esmâ Seyri, tekil okuma ve çoklu terkip artık aynı ön-plan ses kanalında birbirinin üstüne binmez.",
  "Canlı akış barındaki bildirim rozetleri durumdan duruma yer değiştiren header grubundan çıkarıldı; barın tamamını kapsayan tek ve sabit bir üst raya taşındı.",
  "Sessiz başarısızlık deseni kod tabanında topluca tarandı. Desen şuydu: hata yutuluyor ya da eylem hiçbir şey yapmıyor, ama kullanıcıya başarılı deniyor.",
  "Reçete kartlarında da sessiz başarısızlık vardı; bir önceki sürümde bildirimlerde bulunan aynı desen. Karta basınca rozet koşulsuz uygulandı oluyordu: uygulayıcı sessizce çıksa da, patlasa da aynı yazı çıkıyordu.",
  "Esmâ Hatmi paneli Seyirler bölümünden kaldırıldı. Uygulamada iki ayrı Esmâü'l-Hüsnâ hatim sayma sistemi vardı ve ikisi aynı işi yapıyordu; bir arada durmaları hem kafa karıştırıyor hem de aynı sayacı iki yerden besleme riski taşıyordu. Seyirler artık yalnız ikisi: doksan dokuz Esmâ ve yirmi sekiz İsim.",
  "Kırmızı Neuro uyarılarındaki Uygula eylemi artık yeniden açılmış kartlarda da meta.rule kimliğinden çözülüp çalışır; çok eski kartlar id biçiminden geriye dönük desteklenir.",
  "Çalışan 99 Esmâ Seyri ile kilit açıldığında görünen 28 İsim Seyri, motorları değiştirilmeden Zikir içindeki SEYİRLER bölümüne taşındı.",
  "Seyir paneli ile zikir sayacı ayrı sayıyordu ve birbirinden kayabiliyordu; ekranda panel üç derken sayaç iki diyordu. Her ikisi de kendi tekrar sayısını tutuyordu.",
  "İki seyir aynı mantığa ve aynı düğme takımına getirildi. İnceleme sırasında beklenmedik bir şey çıktı: doksan dokuz Esmâ seyri, Berhetiyye'de yeni düzeltilen iki kusurun ikisini de taşıyordu.",
  "Yirmi sekiz isim seyrinde yan yana iki düğme de duraklat yazıyordu. Başlat düğmesi seyir çalışırken yazısını duraklata çeviriyor, hemen yanındaki ayrı duraklat düğmesi de zaten duraklat diyordu; hangisinin ne yaptığı anlaşılmıyordu.",
  "KRİTİK · Sayaç seyirde yanlış ebcedle sayıyordu. Seyir ismi değiştirirken kategoriyi ve sırayı yazıyor ama hedefi yeniden hesaplatmıyordu; önceki kategoriden kalan değer olduğu gibi duruyordu. Berhetîhin okunurken sayaç Rahmân'ın ebcedi olan iki yüz doksan sekizden geri sayıyor, oysa Berhetîhin altı yüz yirmi iki. Panel doğru sayıyı gösterirken sayaç başka bir sayıyla çalışıyordu.",
  "ÇÖZÜLDÜ · Yirmi sekiz isim seyri zikir sayacını hiç ilerletmiyordu. Sayaç bozuk değildi; seyre hiç bağlanmamıştı.",
  "Yirmi sekiz isim seyrinin başlat, duraklat, sonraki, bitir ve baştan düğmeleri tek sahibe alındı.",
  "Tempo artık her zikirde bir saniyeyle başlıyor. İsim değiştiğinde tempo bir önceki isimden devralınıyordu; kendi ses kaydı uzun olan bir isimden sonra beş altı saniyelik çevrim kalıyor ve yeni isim o ağır tempoyla başlıyordu.",
  "Derinleştirilen iz zinciri tamamladı ve kesin durdurmanın kendini beslediği ortaya çıktı. Sıra şöyle: belge düzeyindeki tık dinleyicisi tümünü durdur çağırıyor, o bütün sağlayıcıları süpürüyor, sıra ana karışım sağlayıcısına gelince onun durdurma işlevi kesin durdurmayı çağırıyor, kesin durdurma da içeride yeniden durdurma tetikliyor ve baştan başlıyor.",
  "Önceki sürümün izi işe yaradı ve iki şeyi kesinleştirdi. Tanımsız değişken hatası tamamen kayboldu; cihaz raporundaki yirmi beş kaydın hiçbiri artık o değil.",
  "KRİTİK · Tanımsız değişken hatasının asıl kaynağı bulundu. Hata etiketi baştan beri şu an çalan bilgisinin türetildiği yeri gösteriyordu; önceki iki sürümde aynı hatanın başka kopyaları düzeltilmişti ama bu üçüncüsü kalmıştı.",
  "KRİTİK · Tanılama ekranında biriken tanımsız değişken hatasının kaynağı bulundu ve kaldırıldı. Cihaz raporunda elli hata birikmişti ve hepsi aynı satırdan geliyordu.",
  "Yirmi sekiz isim seyrinin iki okumadan sonra durması araştırıldı. Cihaz raporu sebebin bir tümünü durdur çağrısı olduğunu kesinleştirdi; ses birleşiminin gerekçe alanında bu yazıyordu ve Berhetiyye sağlayıcısı duraklatılmış görünüyordu.",
  "Terkip Kur bölümü denetlendi; bir hata bulundu ve düzeltildi, ayrıca istenen kaydetme sistemi eklendi.",
  "Çoklu günlük ve gezegen saati Esmâ bildirimleri artık ilk isme gitmek yerine önerinin tamamını Terkibe ekle eylemiyle sırayla kuruyor.",
  "Çoklu Esmâ tertiplerinde her isim kendi kaydıyla ayrı kontrol ediliyor ve sesler bitiş sırasıyla art arda çalınıyor.",
  "Android'de bildirim panelindeki kaydırma kilidi giderildi. Ana merkez doğal sayfa akışında kayıyor; iç kaydırma yalnız akış barının çekmecesinde kalıyor.",
  "Bildirimlere ana sekme eklendi. Esmâ yeşil, Berhetiyye mor ve uyarı kırmızı sinyalleriyle ayrışıyor.",
  "Berhetiyye bildirim ayarı, 28 İsim Seyri'nin kilit politikasına bütünüyle bağlandı.",
  "Berhetiyye 28 İsim Seyri kilit açık değilken oluşturulmaz; kilit kapanırsa çalışan seyir durdurulur ve panel kaldırılır.",
  "Floating Neuro bildirimi universal player içine taşındı; Tefekkür modunda #neuroKart barın üstünü kapatamaz.",
  "Esmâ hedef geçişi exactly-once hale getirildi; aynı Esmâ/hedef için yinelenen transaction active kaydını ezmiyor.",
  "Diagnostics raporundaki Berhetiyye sağlayıcı hatası giderildi: başka IIFE içindeki registry artık seyirKes/seyirLoop gibi lexical işlevleri doğrudan çağırmıyor; SukunBerhetiyyeSeyir kamusal denetleyicisini kullanıyor.",
  "KRİTİK · Önceki iki sürümde getirilen bir kapsam hatası düzeltildi. Duraklatma sözleşmesi modülünde seyir durumu değişkenine kısa adıyla erişilmeye çalışılmıştı, ama o değişken bu modülde tanımlı değil; durum oraya pencere üzerinden geliyor.",
  "Yirmi sekiz isim seyri başlıyor ama anında duruyordu; durum satırında tüm seslerin durdurulduğu yazıyordu. Sebep bulundu: seyir kendi sesiyle kendini öldürüyordu.",
  "Yirmi sekiz isim seyri hiç başlamıyordu; Başlat düğmesine basınca sessizce hiçbir şey olmuyor, hata da vermiyordu.",
  "Okumalar, Seyirler ve Araçlar grupları ses ayarlarının üstüne alındı. Bu üç grup uygulamanın okuma ve seyir bölümlerine giden ana kapılar; zikir kartının en dibinde duruyorlardı.",
  "Uygulama artık bütün açılır bölümler kapalı başlıyor. Kırk üç bölümden yedisi açık geliyordu; Berhetiyye atlası, Okumalar grubu, Seyyidü'l-İstiğfar ve Kısımlar listesi açılır açılmaz uzun bir duvar hâlinde karşılıyordu.",
  "Kayıt okuma önbelleği kaldırıldı. İki sebeple.",
  "Kendi sesinle zikirdeki cızırtının kök nedeni kapatıldı. Her tekrarda yeni bir ses elemanı ve yeni bir medya kaynağı kuruluyordu. Medya kaynağı pahalıdır ve ürettiği düğüm asla yeniden kullanılamaz; bir elemana ikinci kez çağrılamadığı için her tekrar ses grafiğine kalıcı bir düğüm ekliyordu.",
  "Kilit ekranında duraklatma çalışıyor ama tekrar başlatma sesi geri getirmiyordu. Sebep bulundu ve kapatıldı.",
  "Kilitteyken isim ilerlememesinin kök nedeni bulundu ve kapatıldı. Kilit ekranında tekrar başlatma yapılmıyor; tek bir yerel ses elemanı aynı kaydı döndürüyor ve sayaç ancak ekran geri geldiğinde uzlaştırılıyordu. Yani kilitliyken sayaç hiç artmıyor, hedef kontrolü de sayaca baktığı için hiç tetiklenmiyordu. Ebced dolsa bile isim ilerlemiyor, ekran açılınca geçen süre toplu işlenip isim ancak o zaman değişiyordu.",
  "Kilit ekranında isim değişmiyordu; zincirin son halkası bulundu ve kapatıldı.",
  "Kilit ekranında hedef dolsa bile sıradaki isme geçilmiyor, aynı isim tekrarlanıp duruyordu. Kök neden bulundu ve bir önceki denemenin yanlış yere baktığı anlaşıldı.",
  "Kulaklık ve kilit ekranındaki başlatma düğmesi ölü kalıyordu; durdurma çalışıyor, tekrar başlatma çalışmıyordu. Cihaz raporu sebebi gösterdi: duraklatma sonrası duraklatıldı bayrağı yanlış kalıyor, durum çalıyor diyor ama çalan hiçbir sağlayıcı yok.",
  "Kilit ekranında seans sonraki isme geçmiyordu; aynı isim tekrarlanıp duruyor, ancak ekran açılınca yeni isme geçiliyordu. İsim sırası kilitliyken de ilerliyordu, ama sonraki ismin sesini hazırlayan çağrı gizliyken atlanıyordu. Kilit ekranı bu yüzden bir önceki isim için hazırlanmış parçayı çalmaya devam ediyordu.",
  "Tefekkürden Çık düğmesi enine daraltıldı. Eskiden genişliği ekranın yüzde yetmiş dördüne zorlanıyordu; yazı kısa olmasına rağmen ekranın neredeyse tamamını kaplıyor ve çemberi aşağıdan sıkıştırıyordu. Artık genişlik yazının kendisi kadar. Ölçüm: iki yüz doksan iki pikselden yüz yetmiş yedi piksele, üç yüz yirmi piksellik ekranda kaplama oranı yüzde doksan birden yüzde elli beşe indi.",
  "Kendi sesinle zikir çekerken kayıt her tekrarda IndexedDB'den yeniden okunuyordu. Kayıt artık bir kez okunup anahtarına göre saklanıyor; kayıt silinir veya bulunamazsa önbellekten düşüyor. En çok yirmi dört kayıt tutuluyor.",
  "Sekme çubuğu başlığın hemen altına alındı. Ambiyans, Frekanslar, Zikir, Düzen ve Tekke artık uygulama açılır açılmaz ilk ekranda duruyor.",
  "Sekme çubuğu yeniden yukarıda kalıyor. Ambiyans, Frekanslar, Zikir, Düzen ve Tekke çubuğu kaydırırken ekranın üstüne yapışıp yarı saydam ve bulanık zeminiyle orada duruyor.",
  "Ses yaşam döngüsü: kullanıcı duraklatması ile sistem kesintisi birbirinden ayrıldı; tek bir single-flight kurtarma kuyruğu kuruldu.",
  "Stabilizasyon II: Tefekkür, isim sunumu, gezinme, canlı bar ve canonical owner stil katmanları dosyanın sonundaki tek kritik stil otoritesinde birleştirildi.",
  "Stabilizasyon I: gezinme sahipliği bağlama göre tekilleştirildi. Normal zikirde sayaç, Akıllı Seans'ta dock, Tefekkür'de canonical sayaç tek görünür Önceki/Baştan/Sonraki yüzeyidir.",
  "r527’de yanlış üst öğeyle birlikte kaldırılan gerçek “Tefekkürden Çık” düğmesi geri getirildi. Üstteki işlevsiz × kalıntısı ise geri dönmedi.",
  "Tefekkür ekranındaki işlevsiz ve yanlış konumlanan “Tefekkürden Çık” öğesi DOM’dan tamamen kaldırıldı; eski yerleşim katmanının yarış anında ikinci bir “Tefekkür · Çık” düğmesi üretme yolu da kapatıldı.",
  "Berhetiyye'de artık Esmâü'l-Hüsnâ'daki gibi isim kartı görünüyor ve önceki ile sıradaki düğmeleriyle yirmi sekiz isim arasında gezinilebiliyor.",
  "KRİTİK · Kendi sesinle zikir çekerken her tekrarda kaydın tamamı yeniden çözülüyordu. Kayıt analizinin önbelleği bir WeakMap'ti ve anahtarı Blob nesnesinin kimliğiydi; oysa döngü her tekrarda kaydı IndexedDB'den yeniden okuyor ve her seferinde yepyeni bir Blob nesnesi dönüyor. Önbellek hiçbir zaman isabet etmiyordu.",
  "Önceki sürümde iki ortak yardımcı düzeltilmişti, ama ölçüm on altı kanalın düğümü bu yardımcılardan geçmeden, kendi tekrarlayan geri çağrılarının içinde doğrudan ürettiğini gösterdi. Desen hepsinde aynı: her olayda kaynak, süzgeç ve kazançtan oluşan bir zincir kurulup çıkışa bağlanıyor, hiç koparılmıyor.",
  "KRİTİK · Ses grafiği sürekli büyüyordu ve telefonu ısıtıyordu. Nota üreten her kanal, ürettiği düğümleri kanal kapanana kadar grafiğe bağlı bırakıyordu. Ölçüm: dört ninni açıkken dört dakikada üç bin altı yüz bir bağlantı yapılmış, sıfır tanesi kesilmişti — dakikada yaklaşık dokuz yüz düğüm.",
  "Uyku bölümüne dört ninni tınısı eklendi. Dördü de prosedürel; indirilecek ses dosyası yok, hepsi cihazda üretiliyor.",
  "Makam kartlarında bilgi düğmesi, önizleme oku ve açma anahtarı üst üste biniyordu. İki ayrı kusur aynı yerde birleşmişti.",
  "Seçili Esmâ şeridi artık zikir tablosunun içinde, kartın ilk öğesi olarak duruyor. Eskiden tablonun on iki piksel üstündeydi ve aynı iki bilgiyi — ismi ve ebcedi — tablonun içindeki satırlarla arka arkaya tekrar ediyordu. Ölçüm şeridin iki alan arasında sıkıştığını gösterdi: liste yüz otuz altı piksel yukarıda, tablo elli altı piksel aşağıda kalıyordu. Şerit artık tablonun başlığı; tekrar hissi kalktı.",
  "Açılış perdesi eklendi: mühür küçükten büyüğe gelir, vuruş anında iki halka dışa açılır, isim harf aralığı genişleyerek belirir. Toplam iki buçuk saniye; perdeye dokununca ya da kendiliğinden çekilir.",
  "Sıfat Muhasebesi eksiksiz yazılmış bir bölümdü — nefs mertebesine göre sıfat listesi, otuz günlük nokta grafiği, mühre işlenen altın elmas dizisi — ama seksen dokuz oturumda bir kez kullanılmamıştı. Sebebi özelliğin kendisi değil, hiçbir yerde hatırlatılmaması; düğmeyi bilerek aramak gerekiyordu.",
  "Emoji öneki geri dönüşü, önekten sonra harf bekliyordu; sayıyla başlayan etiketler geri dönüşe hiç ulaşmıyordu. Akış kuyruğundaki on ve otuz saniyelik sükût düğmeleri bu yüzden İngilizce modda Türkçe kalıyordu.",
  "İngilizce çeviride iki ayrı çeviri yolu vardı ve birbirini tutmuyordu. Sayfa taraması look() işlevini kullanıyor, JavaScript'ten çağrılan t() ise sözlüğe doğrudan bakıyordu; look() içindeki geri dönüşler t() tarafında hiç çalışmıyordu. Aynı metin bir yerde İngilizce çıkıp başka yerde Türkçe kalıyordu. Artık ikisi de tek yoldan geçiyor.",
  "Görünüm kademeleri tersine çalışıyordu. Sade mod uygulamanın zikir kütüphanesini kapatıp laboratuvarını açık bırakıyordu: Âyetü'l-Kürsî, Salavât, Seyyidü'l-İstiğfar, Nasuh Tövbesi, Delâil ve esmâ listesi gizleniyor; ama NeuroSync binaural laboratuvarı, Kimatik, Sweep, Spektrum, Frekans Kütüphanesi ve fotik uyarım her üç modda da görünüyordu.",
  "Uygulamanın yüzde kırkı, on sekiz bin üç yüz kırk iki satırlık tek ve isimsiz bir script bloğunda duruyordu; sekiz yüz kırk iki fonksiyon ve üç yüz üç üst düzey değişken dışarıdan hiç görünmüyordu. Son üç hata avında bulunanların çoğu tam olarak böyle isimsiz ortak alanlardan çıkmıştı.",
  "Gerçek cihazda alınan r512 tanılama raporu üzerine iki boşta-tüketim kaynağı kapatıldı. Derin süit 26 testin 24'ünü geçmişti; bu ikisini testler yakalamıyordu çünkü çökme değil pil tüketimi yapıyorlar.",
  "KRİTİK · r511 uzun basma girişi Android'de çalışmıyordu: tarayıcı yaklaşık 500 ms'de metin seçimini başlatıp Göster/Kopyala/Paylaş menüsünü ve arama çubuğunu açıyor, dokunuş dizisi touchcancel ile kesildiği için sayaç hiç dolmuyordu.",
  "KRİTİK · Sistem tanılaması ekranına mobilde ulaşılamıyordu. Sürüm etiketine iki çakışan işleyici bağlıydı: ilk dokunuş sürüm notları katmanını açıyor, katman etiketi örttüğü için 5 dokunuş sayacına kalan dört dokunuş hiç ulaşmıyordu. Masaüstünde Ctrl+Shift+D olduğu için sorun görünmez kalmış; masaüstü tarayıcısı olmayan cihazda tanılamaya giden yol yoktu.",
  "KRİTİK · Service Worker her açılışta 3,4 MB nero.html'i yeniden indiriyordu (cache:no-store) ve zaman aşımı yoktu; ağ yavaş ama ölü değilse önbellekteki kabuk hiç dönmüyor, uygulama beyaz ekranda asılı kalıyordu. Artık ağ 2,5 sn beklenir, yetişmezse önbellek anında verilir ve tazeleme arkaya atılır.",
  "4/8 Zikir bitiş/geçişi SukunZikirTransaction ile transaction yapısına alındı; hedef dolumu prepare → sesin settle olması → tek commit sırasını izler",
  "1/3 SukunViewportPolicy kuruldu: projedeki eski scrollIntoView çağrıları tek politikadan geçer; kullanıcı kaynaklı navigasyon serbest, background state/render kaydırmaları engellenir",
  "Nefs Mertebeleri, Nefs Merdiveni ve Enerji Merkezleri üzerinde basamak seçerken viewport artık korunur; zikir/sayaç sahnesine otomatik kaydırma yapılmaz",
  "Tefekkür sayaç kartının sağında görünen Tem kalıntısının kök nedeni bulundu: r487 ortak slider componenti eski Tempo .sldRow satırını display:grid!important ile yeniden görünür kılıyordu",
  "Oynatıcı ileri/geri düğmelerinin ekran okuyucu adı saniyede ~9 kez iki değer arasında gidip geliyordu: iki ayrı modül aynı etikete farklı değer yazıp birbirini eziyordu. Artık daha açıklayıcı olan ad korunuyor.",
  "Sayfayı izleyen 12 ayrı DOM gözlemcisi tek merkezî yayına indirgendi. Tarayıcı her değişiklik için gözlemci listesini baştan sona dolaştığından, tek bir yazım 12 kayıt defterine işleniyordu; artık bir kez işleniyor ve her abone yalnız kendi istediği kaydı alıyor. Ölçüm: 300 yazımlık yükte uyanan geri çağrı 559'dan 56'ya indi.",
  "Yedek dosyası geri yüklenirken değer içeriği de denetleniyor: kontrol karakteri taşıyan veya bozuk/yarım JSON içeren kayıtlar atlanıyor. Düz metin saklayan ayarlar bundan etkilenmiyor.",
  "KRİTİK: Geçmişi olan kullanıcılarda uygulama yarım açılıyordu. Yedekleme paneli, henüz tanımlanmamış bir veriye erişiyor ve hata fırlatıyordu; klasik bir script bloğunda bu, bloğun geri kalanını iptal eder. Ölçülen kayıp: Fâtiha Seyri, namaz vakti hesabı ve TÜM oynatma kontratı (13 modülün merkezî durdurma/duraklat katmanı) sessizce yok oluyordu. Temiz kurulumda görünmediği için fark edilmemişti.",
  "Geliştirici Tanılama paneline Layout Overflow / Clipping tarayıcısı eklendi; viewport taşması, hidden/clip atası altında kırpılan çocuk ve kendi içeriğini kırpan elemanlar ayrı türlerde raporlanır",
  "Sağ kenarda görünen yarım metin/fragment kalıntısı için taşma-kırpma hotfixi eklendi",
  "currentZikirState tek kaynak modeli eklendi; Z, ZIKIR ve aktif Akıllı Seans zikir adımı tek normalize snapshot altında birleştirildi",
  "Seçili Esmâ badge zengin gösterime yükseltildi: isim + sıra numarası + Ebced değeri aynı bileşende gösterilir",
  "Üst bölümde seçili esmayı görünür kılan r497 badge eklendi; Önceki / Sıradaki Esmâ satırının hemen altında Seçili Esmâ: N. İsim gösterilir",
  "Canlı bar çekirdeği kesin üç satırlı sisteme geçirildi: 1 Başlık + CANLI, 2 Önceki / Baştan / Sonraki, 3 Sayım / Kalan / Esmâ",
  "Canlı bar üst satır yerleşimi düzeltildi: CANLI rozeti başlık satırında sağa, Önceki / Baştan / Sonraki kendi ikinci satırına alındı",
  "Navigation flashing kökten giderildi: aynı DOM’u sırayla yeniden parent eden r491 restart runtime ve r493 navigation runtime kaldırıldı; tek r494 owner kaldı",
  "Navigation component: prev/reset/next tek factory + tek tooltip + tek mikro-etkileşim; CANLI rozeti küçültülüp sakin header alanına alındı.",
  "Prev/Reset/Next cluster: ana sayaç + Tefekkür + mini/midi canlı bar; CANLI badge küçültülüp sakin alana taşındı.",
  "Restart tek component: ana sayaç + Tefekkür + mini/midi bar aynı davranış ve aynı görsel bileşen; legacy proxy yok.",
  "Açılış kurtarma: navigation network-first; eski kırık shell cache artık query parametresini yutmaz. r488 global boot observer kaldırıldı.",
  "Zikri baştan başlat: ana sayaç + Tefekkür + universal bar; session memory yeni sıfır konumuyla güncellenir.",
  "Kontrol renkleri tema-native: toggle, slider ve info vurguları aktif tema --gold/--goldh/--teal tokenlarından türetiliyor.",
  "Toggle cascade: legacy yüksek-specificity switch kuralları component authority ile geçersiz; knob ray içinde tam merkezli.",
  "Berhetiyye niyet-gate: niyet sayaç değildir; niyet bitince 1 sayı=1 ses. Toggle/slider/info tek component sistemine alındı.",
  "Esmâ geçişi transactional: mevcut isim son kez okunmadan sayaç sıfırlanmaz ve sonraki Esmâ’ya geçilmez; ses atlama giderildi.",
  "Kilit ekranı pitch düzeltmesi: kendi kayıt preservesPitch native hız; TTS normal utterance kuyruğu, cüce/ince ses regresyonu giderildi.",
  "Hızlı tempo sesli zikir: 1 sayaç = 1 tamamlanan kayıt/TTS; 0.8 sn’de ses bitmeden sayı ilerlemez ve catch-up yapılmaz.",
  "Okuyucular üst üste binebiliyordu: yedi modülün \"çalıyor mu\" yoklaması window üzerinden bakıyordu ama bu modüller window'a atanmıyor — yoklama kalıcı false dönüyordu, yeni okuyucu başlarken öncekini durduran yedek yol hiç devreye girmiyordu.",
  "Universal bar: CANLI küçültüldü; mini/midi görünümde sayım, kalan ve Esmâ/Berhetiyye sıra bilgisi gösteriliyor.",
  "Tek dokunuş otomatik başlatma; kilitte kendi kayıt için 8D+yankı+tempo OfflineAudio ile native loopa basıldı; dönüşte anti-pop crossfade.",
  "Kilit ekranı zikir: kendi kayıt sürekli native audio loop; TTS uzun ön-kuyruk; dönüşte sessiz sayaç uzlaştırması. Yandaki Tefekkür girişi kaldırıldı.",
  "Kilit ekranı zikir devamlılığı: kayıt native audio, TTS resume köprüsü; Esmâ görünümü ayarı Genel Ayarlar/Görünüm bölümüne taşındı.",
  "Katman tekilleştirme: Tefekkür yalnız Zikir sekmesinde, isim animasyonu yalnız gerçek zikir başladıktan sonra; Sabit/Animasyon/Kapalı tek otoritede.",
  "Tefekkür girişi yalnız Zikir sekmesinde; Esmâ/Berhetiyye için Sabit–Animasyon–Kapalı tekil isim görünümü eklendi.",
  "Akıllı Seans: kendi kayıt öncelikli, yoksa erkek TTS; Tefekkür girişleri yazılı ve anlaşılır mini pill tasarımına geçti.",
  "Tefekkür final geometri: üst zikir nefes alanına kavuştu, Çık düğmesi sayaç başlığının altına alındı ve dev yan Tefekkür pill hatası kapatıldı.",
  "Canonical Tefekkür: tek grid/flex iskelet, ölçülen dock-safe layout, güçlendirilmiş audio recovery, source badge, session memory/summary, adaptif performans ve Diagnostics 2.0.",
  "Tefekkür sesli zikir düzeltmesi: kayıt varsa kayıt, yoksa TTS; sayaç okuma bitmeden ilerlemiyor.",
  "Tefekkür alanı iki panelli grid/flex iskeletine taşındı; üst görsel, alt kontrol yapısı ayrıştırıldı.",
  "Tefekkür çemberi, yan istatistikler ve alt kontrol slabı mücevher hissiyle yeniden dengelendi.",
  "Tefekkür üst başlık tipografisi inceltildi; sayaç alanına daha fazla dikey yer açıldı.",
  "Tefekkür slab kompaktlaştırma: ana/çık butonları küçültüldü, focus-calm görünürlüğü dengelendi ve sabit akış barı için güvenli alt rezerv büyütüldü.",
  "kilit ekranı toparlama + final Tefekkür layout: auto-zikir resume burst önlendi, tek audio recovery kapısı ve tek son CSS otoritesi eklendi.",
  "r458 audit fixes: release JSON, dinamik Diagnostics build, yedek sürümü, event-driven Tefekkür layout guard, statik playing görünümü ve observer lifecycle temizliği.",
  "Claude düzenlemesi: Tefekkür Control Island grid alanı cta olarak düzeltildi; halka/başparmak yerleşimi, Devir künyesi ve dock rezervi yeniden düzenlendi.",
  "Tefekkür Saymaya Başla hizası için zorunlu normalizasyon ve stray autoBtn gizleme düzeltmesi.",
  "Tefekkür Control Island repair: exit/−1 çakışması giderildi, ana CTA merkezlendi, island kompaktlaştırıldı ve Tefekkür mini dock başlangıcı eklendi.",
  "Diagnostics + regression: runtime probe, geliştirici ekranı, güvenli/derin test suite ve JSON tanılama raporu eklendi.",
  "Audio State Machine / Session Registry: play-pause-resume-stop-volume-state kontratı merkezileştirildi; aggregate transport registry üzerinden çalışıyor.",
  "Core Cleanup I: Tefekkür, dock/focus ve peek runtime sahipliği tek SukunUIRuntime altında birleştirildi; r452 görsel tasarımı donduruldu.",
  "nihai kalite turu: tefekkür minimalleştirildi, dock/control bar sadeleştirildi, tipografi ve boşluk sistemi standardize edildi.",
  "son premium rötuş: ana CTA güçlendirildi, yan butonlar inceltildi, zikir odak halkasına çok hafif nefes efekti eklendi.",
  "premium capsule: tefekkür üst kontrol adası tek bütün premium control island hâline getirildi; Hedef/Devir özeti kapsül içine taşındı.",
  "hizalama rötuşu: tefekkür üst kontrol adası ortalandı, Hedef/Devir özeti kontrollerin altına taşındı, CANLI rozeti handle ile çakışmayacak yere alındı.",
  "performans stabilizasyonu: global DOM observer ve render fırtınası kaldırıldı; tefekkür sürekli animasyonları statikleştirildi, dock senkronizasyonu tek koordinatörde birleştirildi.",
  "ses sözleşmesi denetimi: TTS watchdog yarışları, çift stop, Delâil kayıt-next, okuyucu provider kimliği ve hedefli bar stop davranışı sertleştirildi.",
  "stabilizasyon: Akıllı Seans Şimdi Çalıyor tek görünür renderer ve tek state akışına birleştirildi; eski r417–r421 üst üste render katmanları kaldırıldı.",
  "düzenleme, doğrulama, geri al ve hata kurtarma sistemi korunuyor.",
  "Detaylar paneli #r170Now dock ağacından çıkarılarak body-level portal yapıldı; eski dock swipe, overflow ve pointer-events zinciri artık Detaylar jestlerini yakalayamaz.",
  "Detaylar sheet shrink-wrap yapısına geçirildi; kısa içerik artık maksimum yüksekliğe zorlanıp altta büyük boş alan bırakmaz.",
  "Tefekkür focus-calm artık yalnız görsel sakinliktir; pointer-events:none kaldırıldı. Durdur/Saymaya Başla/−1/+ ve gezinme kontrolleri ilk dokunuşta doğrudan çalışır.",
  "Max > Detaylar için tek scroll owner kuruldu: #r170Now dış scroll'u kapanır, başlık sabit kalır ve yalnız #r674DetailsScroll kayar.",
  "Tefekkür bilgi yoğunluğu azaltıldı: Hedef/Kalan yan kartları, Hedef-Devir meta satırı ve ses rozeti küçültüldü; Tefekkürden Çık 30 px minimal kapsüle indi.",
  "Tefekkür/Zikir ekranı dikey bütçenin birinci sahibi yapıldı; Mini/Midi/Max Tefekkür sırasında daha düşük güvenli profil kullanır ve içerik fazlası yalnız player gövdesinde scroll eder.",
  "Tek boundary authority: Tefekkür sayaç kartı görünür dockta #r170Now.top, minimize durumda #r433DockPeek.top sınırına 8 px boşlukla doğrudan bağlanır."
];

function buildOfHtml(text){
  const m=String(text||'').match(/<meta\s+name=["']sukun-build["']\s+content=["']([^"']+)["']/i);
  return m?m[1]:'';
}
async function fetchReload(path){
  const req=new Request(path,{cache:'reload'});
  const res=await fetch(req);
  if(!res||!res.ok||res.type==='opaque')throw new Error('fetch '+path+' '+(res?.status||'failed'));
  return{req,res};
}
async function validateCore(path,res){
  if(path.includes('nero.html')){
    const text=await res.clone().text();
    if(buildOfHtml(text)!==SURUM)throw new Error('HTML build mismatch: '+buildOfHtml(text)+' != '+SURUM);
  }else if(path.includes('manifest.webmanifest')){
    const obj=await res.clone().json();
    if(!obj||obj.short_name!=='SÜKÛN'||!obj.start_url)throw new Error('manifest invalid');
    const start=new URL(obj.start_url,self.location.href);
    if(start.searchParams.get('v')!==SURUM)throw new Error('manifest build mismatch');
  }
  return true;
}
async function marker(cache){
  const r=await cache.match(BUILD_MARKER);
  if(!r)return null;
  try{return await r.json()}catch(e){return null}
}
async function kabuguHazirla(){
  const cache=await caches.open(CACHE);
  /* CORE tam değilse install başarısız olsun: yarım yeni sürüm asla aktive edilmez. */
  for(const path of CORE){
    const {req,res}=await fetchReload(path);
    await validateCore(path,res);
    await cache.put(req,res.clone());
  }
  /* Opsiyoneller güncellemeyi düşürmez. */
  await Promise.allSettled(OPTIONAL.map(async path=>{
    const {req,res}=await fetchReload(path);await cache.put(req,res.clone());
  }));
  const meta={v:SURUM,cache:CACHE,complete:true,at:Date.now(),core:CORE.slice()};
  await cache.put(BUILD_MARKER,new Response(JSON.stringify(meta),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}));
  return meta;
}
async function currentComplete(){
  const cache=await caches.open(CACHE);const m=await marker(cache);
  if(!m||m.v!==SURUM||m.complete!==true)return false;
  for(const path of CORE){if(!await cache.match(path,{ignoreSearch:true}))return false}
  return true;
}

self.addEventListener('install',event=>{
  /* skipWaiting YOK: güncelleme waiting'de kalır, kullanıcı Yenile derse aktive olur. */
  event.waitUntil(kabuguHazirla());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    if(!await currentComplete())throw new Error(SURUM+' cache incomplete — old worker preserved');
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('sukun-')&&k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
    const cs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    cs.forEach(c=>{try{c.postMessage({type:'SUKUN_SW_STATUS',v:SURUM,cache:CACHE,complete:true})}catch(e){}});
  })());
});

const AG_ZAMAN_ASIMI=2500;
function zamanliFetch(request,ms){
  return new Promise(resolve=>{let done=false;const t=setTimeout(()=>{if(!done){done=true;resolve(null)}},ms);fetch(request).then(r=>{if(!done){done=true;clearTimeout(t);resolve(r)}}).catch(()=>{if(!done){done=true;clearTimeout(t);resolve(null)}})});
}
async function shellCached(){
  const cache=await caches.open(CACHE);
  if(!(await marker(cache))?.complete)return null;
  return await cache.match('./nero.html',{ignoreSearch:true});
}
async function responseBuild(res){
  try{return buildOfHtml(await res.clone().text())}catch(e){return''}
}
async function kabukOncelikli(request){
  const cache=await caches.open(CACHE);
  const cached=await shellCached();
  const fresh=await zamanliFetch(new Request(request,{cache:'no-store'}),AG_ZAMAN_ASIMI);
  if(fresh&&fresh.ok&&fresh.type!=='opaque'){
    const b=await responseBuild(fresh);
    if(b===SURUM){
      /* Yalnız AYNI build mevcut worker cache'ine yazılabilir. */
      eventlessPut(cache,'./nero.html',fresh.clone());
      return fresh;
    }
    if(b&&b!==SURUM){
      /* Ağda daha yeni HTML var ama bu worker eski: sürümleri karıştırma. */
      try{self.registration.update()}catch(e){}
      if(cached)return cached;
      /* İlk kurulum gibi cache yoksa ağdaki sayfa son çare; yeni worker hemen kurulacaktır. */
      return fresh;
    }
  }
  if(cached){
    /* Arka plan refresh yalnız aynı buildse cache'e girer. */
    fetch(new Request(request,{cache:'no-store'})).then(async r=>{
      if(r?.ok&&(await responseBuild(r))===SURUM)eventlessPut(cache,'./nero.html',r.clone());
      else if(r?.ok)try{self.registration.update()}catch(e){}
    }).catch(()=>{});
    return cached;
  }
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SÜKÛN</title><body style="background:#05090c;color:#8fe9ff;font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px"><div><div style="font-size:44px;opacity:.75">۞</div><p>SÜKÛN çevrimdışı ve doğrulanmış önbellek yok.</p><p style="opacity:.6;font-size:14px">Bir kez çevrimiçi aç; sonrası çevrimdışı çalışır.</p></div>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}});
}
function eventlessPut(cache,key,res){cache.put(key,res).catch(()=>{})}

async function onbellekOncelikli(request){
  const url=new URL(request.url);
  const packaged=[...CORE,...OPTIONAL].some(path=>new URL(path,self.location.href).pathname===url.pathname);
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request,{ignoreSearch:packaged||!url.search});
  if(cached)return cached;
  try{
    const res=await fetch(request);
    if(res?.ok&&res.type!=='opaque'){
      if(url.pathname===new URL('./manifest.webmanifest',self.location.href).pathname)await validateCore('./manifest.webmanifest',res);
      eventlessPut(cache,request,res.clone());
    }
    return res;
  }catch(e){return Response.error()}
}

self.addEventListener('fetch',event=>{
  const request=event.request;if(request.method!=='GET')return;
  const url=new URL(request.url);if(url.origin!==self.location.origin)return;
  event.respondWith(request.mode==='navigate'?kabukOncelikli(request):onbellekOncelikli(request));
});

self.addEventListener('message',event=>{
  const d=event.data||{},port=event.ports?.[0];
  if(d.type==='SKIP_WAITING'){self.skipWaiting();return}
  if(d.type==='SURUM_NOTU'){try{port?.postMessage({v:SURUM,notlar:NOTLAR})}catch(e){};return}
  if(d.type==='STATUS'){
    event.waitUntil((async()=>{const cache=await caches.open(CACHE),m=await marker(cache);try{port?.postMessage({v:SURUM,cache:CACHE,complete:!!m?.complete,marker:m,error:m?'':'marker missing'})}catch(e){}})());return;
  }
  if(d.type==='CACHE_REFRESH'){
    event.waitUntil(kabuguHazirla().then(m=>{try{port?.postMessage({ok:true,v:SURUM,cache:CACHE,complete:!!m?.complete})}catch(e){}}).catch(e=>{try{port?.postMessage({ok:false,v:SURUM,error:String(e?.message||e)})}catch(_){}}));
  }
});
