# Release 148 — outcomes, breaks, gestures and long sessions

Second bug pass fixes duplicate/missing match outcomes, paused Tavla turn continuation, Kelimecik replay/jokers, Tetris overflow/shields/garbage passives, gesture reversal and slow drag, malformed saves and leaked delayed game controls. Original parked draggable jewels and portal presentation remain unchanged. See [PORTAL_AUDIT_148.md](PORTAL_AUDIT_148.md) for 52 new regression groups, extended browser stress coverage, the unchanged adventure star-design issue and verification limits. Both online players must use v148.

---

# Release 147 — game rules and session lifecycle

Scoped fixes across chess, Tavla, Tetris and Kelimecik, with deterministic regressions and seven passing Chromium suites. Preserves the original 34px sparkling jewels, parked draggable controls, scale preference and portal navigation. See [PORTAL_AUDIT_147.md](PORTAL_AUDIT_147.md) for concrete findings, changed behavior, validation and limits. Both players should load v147 before an online match.

---

# Release 146 — scaled Tavla input correction

Fix canvas hit testing at non-default UI scales. Pointer client coordinates and getBoundingClientRect already share viewport units; removing the second zoom division maps touches and drags to the visible checker. The reported white 6–3 position now permits the home checker to move from point 5 to point 2 using 3, leaving 6 available.

Regression: QA/tavla-input.cjs reconstructs the reported position and runs the real canvas/pointer handlers. Before the fix, selection fails at 85% scale. After the fix, touch selection and movement pass at 80%, 85%, 100% and 130%, in both board orientations; a scaled mouse drag also passes. Account/network calls are fixtures. Existing engine, remote-move and worker checks also pass. No artwork, jewel behavior or saved scale preference changes.

---

# Release 145 — parked jewels, personal profile and game-engine corrections

Original 34px sparkling jewels start in header parking slots, remain draggable by mouse/touch, and can remember their last position by preference. Drag calculations use viewport coordinates consistently at non-default UI scales. Resize clamps floating controls to the viewport. The crown remains admin-only. A native personalization dialog provides per-account/device title, bio, avatar, accent, frame, background, favorite game and parking preferences. Profile frame IDs now resolve to their actual colors.

Chess: separate attacked-square logic from pawn movement; enforce same-color castling rook; expose all four promotions; validate remote moves against local legal moves; normalize repetition keys for uncapturable en passant. Tavla: correct oversized bearing-off rule, enforce maximum dice usage and higher-die rule, derive hit data locally, reject invalid remote moves/dice and sequence animation-bound remote moves before end-turn. Kelimecik: no dictionary bypass during EN loading, validate tile coordinates/points and preview input, prevent delayed callbacks affecting closed/replacement sessions. Tetris: follow the current score during animation, release held-control timers and score animation on close, pause solo play on backgrounding.

Validation and limitations: see PORTAL_AUDIT_145.md. Original jewel artwork/effects are unchanged.

---

# Release 144 — original sparkling jewels

Restores the original diamond and crown emoji markup from commit 8d4faf9. Removes the replacement SVG markup and all jewel-specific portal/ivory/lobby/Aurora styling overrides, so the unchanged original components.css supplies the 34px controls, 14px symbols, cyan/magenta and gold glow, pulse, floating crown and three animated sparks per control. No new jewel artwork or effects are introduced. Draggable mounting, saved-position keys, UI scale setting and original social/admin actions remain intact. Reduced-motion preference continues to be respected.

Validation: existing portal UI suite, including original symbols, dimensions and animation names, absence of replacement images, drag and saved-position persistence, social/admin panel actions and UI scale persistence. Backend/account calls use fixtures. Worker migration/offline checks cover the refreshed style URLs.

---

# Release 143 — restore draggable diamond and crown

Both jewel controls mount on the document body again and always use the existing drag handler. Header docking and position overrides are removed. Their saved-position keys, social/admin actions, admin-only crown visibility and hide preferences remain unchanged. Aurora visuals remain; floating controls return to the pre-Aurora 40px size on desktop and mobile, with compact 22px artwork. Worker 143 refreshes the changed shell and styles.

Validation: portal-ui includes pointer dragging both jewels, no accidental panel opening during a drag, saved positions restored after reload, both original panel actions, pre-Aurora control dimensions and persistence of the existing UI scale preference. Account/backend writes are mocked. Worker migration/offline checks also run.

---

# Release 142 — selected Aurora concept

The user selected mockup 2 after reviewing the three-alternative PDF. Aurora uses the approved purple/cyan/magenta palette, dimensional illustrated game cards, glass surfaces and direct per-game play actions. The former large selected-game stage is removed; contextual guides are native dialogs opened from each game card. Search focuses the matching playable card and clears a conflicting collection filter. Favorites and successful-open recents remain device-local.

The diamond is restored as a blue faceted SVG and still opens the existing social hub. The gold crown is now also a local SVG in the header, retains admin-only visibility and opens the original admin panel. No account permission, wallet logic or admin gate is changed. Existing visibility preferences remain available. No mockup avatars, online labels or invented metrics were copied into production. The friends panel links to the real friends screen.

Art is a newly generated four-quadrant illustration atlas, encoded as one 341,280-byte WebP without resizing or composition changes. CSS selects each quadrant. New imagery and both jewel icons are precached by worker 142. Aurora is the eleventh palette; the previous default Lounge migrates once, while explicitly selected alternate palettes remain.

Validation: portal-ui across six widths and five routes; eleven themes; real game entry modules for all four games; modal focus/escape, search, favorites, recents, history, score/XP, connection failure; diamond opens social; crown absent for guest and present/touchable at 320/390/768/1440 for an admin fixture; crown opens admin panel and disappears again on logout. Account/backend writes remain mocked. Desktop and mobile screenshots checked, including contrast scrim and fixed-header icon placement. Live Google/Firebase account rules and real remote multiplayer sessions are not proven by these fixtures.

---

# Release 141 — Hero Lounge / play-first UX

Replaces the long editorial landing page with a functional player lobby. Desktop sidebar navigation, mobile bottom navigation, above-the-fold game switcher, contextual game stage, guide dialogs, Turkish-aware search, solo/together/favorites discovery, device-local favorites and last successfully opened game. Account/progress/rituals move into a side panel on desktop and follow the game collection on mobile. All four launch buttons still use the existing lazy-loaded engines and boot recovery. No fake live counts, fabricated history, or implied saved-game continuation.

Navigation now adds history entries on user navigation and restores routes with browser Back/Forward. Search selection returns to the lobby with focus on the selected launch action. Native modal dialogs provide keyboard trapping, Escape and focus restoration. Removing a focused favorite restores focus to the filter. Social launcher moves into the header to avoid covering game filters; it has an explicit accessible label and an inline SVG icon. Admin drag bounds distinguish desktop side navigation from mobile bottom navigation. Hero Lounge is a tenth palette; existing non-ivory preferences survive migration and every palette uses the new structure.

Higgsfield was explicitly requested. Two requested image generations were rejected before submission with `Requires basic plan or higher`. No Higgsfield image was generated or used. The release uses original code-native SVG geometry and the existing local game art. No new host, subscription, or AI integration was created.

Validation (account writes mocked): portal-ui across 320/390/600/768/1024/1440 widths, five routes, ten themes, four real game entry modules, browser history, switcher, contextual help, search/empty results, favorites/persistence/focus, successful-open recents, score/XP, scale settings and failed-network recovery; forms and worker migration checks. Desktop/mobile/settings screenshots visually inspected. Live Google sign-in, Firebase rules and actual remote multiplayer require live-account/device testing; do not interpret the fixture suite as verification of those services.

---

# Hero Portal 140 — Fildişi Kulüp

Seçilen 3. mockup uygulandı. Sıcak krem zemin, orman yeşili eylemler, bronz çizgiler ve serif başlıklar; ana sayfa, profil, liderlik, arkadaşlar, bildirimler ve ayarlar ortak açık tema kullanır. Oyun kartlarının özgün SVG çizimleri yeşil/fildişi paletine uyarlandı. Oyun motorlarının koyu kontrolleri kendi okunabilir renklerini korur.

Varsayılan ve eski varsayılan Hero teması bir kez Fildişi Kulüp'e geçer. Önceden açıkça seçilmiş diğer temalar korunur. Ayarlardan 9 tema seçilebilir; sonradan seçilen Hero koyu teması da yeniden yüklemede korunur.

`assets/ivory-club-hero.webp` 1536×1024, 115.878 bayttır. Yerel dosya ve `css/ivory.css` worker 140'ın çevrimdışı listesine eklendi. PWA simgesi, tema rengi ve kurtarma sayfası güncellendi.

Doğrulama: 6 genişlikte 5 sekme, 9 tema, 4 gerçek oyun giriş modülü, %80/%130/%100 ölçek, klavye, azaltılmış hareket, bağlantı hatası, form ve önbellek koruma testleri; gerçek HTTP üzerinde eski worker geçişi ve çevrimdışı kabuk. Mobil/masaüstü ve ayarlar ekran görüntüleri gözle incelendi. Hesap/veritabanı testleri bellek içi verilerle yapılır; canlı Google/Firebase izinleri ve gerçek oyuncular arası maç doğrulanmış değildir.

Görsel, yerleşik image_gen ile yeni üretildi; PNG çıktısı web yayını için WebP olarak sıkıştırıldı. Üretim istemi:

> Create a premium website hero background illustration, landscape 3:2, no text, no letters, no logos, no UI. High-end photorealistic art direction for an ivory and forest green boutique games club. Warm sunlit ivory limestone room with a tall softly blurred arched window at right, gentle olive plant shadow, polished cream stone tabletop. RIGHT half composition: large beautifully sculpted ivory chess knight in foreground with small bronze inlay at base, one dark forest green glazed chess pawn behind, small walnut backgammon board edge and ivory dice on the tabletop, a compact subtle stack of green and beige stone Tetris blocks near lower right. Elegant architectural still life, warm bronze details, luxury club atmosphere, subtle film grain, tactile marble and ceramic, exquisite restrained editorial styling, realistic light and shadows, no gold glitter, no neon, no fantasy sparks. LEFT 45% is largely empty warm ivory plaster and softly lit tabletop with very low detail so dark green HTML heading can be overlaid legibly. Objects all concentrated right, room visible, no cropped knight, careful generous composition. Color palette ivory #f4efe4, forest green #173d31, warm bronze #987342.

---

# Hero Portal 139 — oturum ve ödül regresyon taraması

138 tasarımı korunur; üç alternatif görünüm sohbet içinde konsept mockup olarak sunulmuştur. Tasarım seçimi uygulanmamıştır.

## 139 düzeltmeleri

- Beklemiş hesap/profil/admin yanıtı yeni oturuma uygulanmaz. İsim güncellemesi doğru UID'ye bağlı kalır; kayıt hatası başarı gibi gösterilmez.
- Store'un ilk eşzamanlı aboneliği bütün değişkenler başlatıldıktan sonra çalışır. Çıkış bakiye, rekor, envanter ve istatistikleri sıfırlar.
- Kaju kazanç/harcaması sunucu işlemi tamamlanmadan yerel başarı yazmaz. Çakışan bakiye güncellemeleri transaction kullanır; başarısız eski mağaza ödeme çağrısı da durur. Geçersiz/sonsuz sayılar ve bozuk geçmiş güvenle reddedilir.
- Günlük, VIP, görev, turnuva ve gelen transfer ödüllerinde `users/{uid}/heroRewardClaims` makbuzu ile bakiye aynı transaction içinde değişir. Tekrar deneme çift kredi vermez. Günlük seri bilgisi de aynı işlemde saklanır. Sabit ödüller oyun kazanım limitinden kesilmez; örneğin birincilik 5.000 Kaju'dur.
- Transfer temizliği başarısız olsa bile aynı transfer ikinci kez kredilenmez. Eski turnuva `claimed` bayrağı geriye uyumlu tutulur.
- Günlük yerel sayaçlar/görevler/çark hakkı UID bazında ayrılır; önceki global localStorage anahtarları silinmez. Eski global görev ilerlemesi hangi hesaba ait olduğu bilinmediği için yeni hesaba aktarılmaz.
- Görev ödeme hatası tekrar denenebilir; çark aynı oturumda yeniden açılarak üst üste başlatılamaz ve hesap değişimi sonrası diğer hesaba ödül yazmaz.
- Bildirim dinleyicisi çıkışta kapanır; eski callback yok sayılır. Aynı zaman damgalı farklı bildirimler korunur. Anahtarların erişilebilir adı ve durumu vardır. Portal kapalıyken bildirim teslim edildiği şeklindeki yanlış açıklama kaldırılmıştır.
- Turnuva paneli kapanınca zamanlayıcı durur ve ödül düğmesi hata sonrası kilitli kalmaz.

## 139 doğrulama

`PORTAL_CHROMIUM=/tmp/chromium node QA/portal-state.cjs` gerçek Auth/Store/Daily/Push/Economy modüllerini bellek içi Firebase SDK ile sınar: başlangıç, çıkış, gecikmiş hesap yanıtları, sayısal sınırlar, bozuk geçmiş, çakışan harcamalar/krediler, başarısız ödeme, 5.000 Kaju ödülü, çift talep, günlük ödül tekrarı, transfer temizleme hatası, görev yeniden deneme, bildirim yaşam döngüsü ve erişilebilir anahtarlar. Önceki UI, sosyal, form ve gerçek service worker testleri de çalıştırılır.

Üretim hesabına yazılmaz. Gerçek Google girişi, canlı Firebase kurallarının yeni makbuz alanına izin vermesi, fiziksel telefon ve oyuncular arası çevrimiçi maç test edilmemiştir. İstemci düzeltmeleri sunucu tarafında ödül yetkilendirmesinin yerine geçmez. Tüm portalın hatasız olduğu iddia edilmez.

---

# Hero Portal 138 — premium tasarım ve portal düzeltmeleri

Ana sayfa koyu grafit, şampanya tonları ve Manrope tipografisiyle yeniden tasarlandı. Oyun koleksiyonu, oyuncu ilerlemesi ve beş portal sekmesi aynı görsel sistemi kullanır. Beş özgün SVG çizimi haricî medya olmadan çalışır. Türkçe karakterli Manrope fontları ve sürümü sabit PeerJS 1.5.4 yerel olarak sunulur; OFL ve MIT lisansları ilgili klasörlerdedir.

## Görünüm ve kullanım

- Dört oyun kartı gerçek düğmedir; mobilde iki, masaüstünde dört sütun kullanır.
- Mobil kahraman görseli korunur, temel eylem oyun koleksiyonuna gider. Yan sekmelerden `#games` bağlantısı da doğru ana ekranı açar.
- Profil, liderlik, arkadaş ve bildirim başlıkları içerikle hizalanır. Ayarlar ve portal pencereleri aynı yüzey/renk sistemini kullanır.
- Klavye odağı, atlama bağlantısı, görünür aktif menü, azaltılmış hareket tercihi ve büyütme korunur.
- Liderliğin Kaju bakiyesine göre ilk 20 oyuncuyu gösterdiği açıkça belirtilir.

## Düzeltilen davranışlar

- Konuşma değişiminde eski mesaj/okundu/yazıyor dinleyicileri kapatılır. Gecikmiş kişi yanıtı yeni konuşmayı değiştiremez.
- Gönderim boyunca alıcı sabit tutulur; konuşma değişse bile bildirim doğru kişiye gider. Başarısız gönderimde taslak korunur.
- Sosyal panelin hızlı kapat/aç geçişi yeniden açılan paneli gizleyemez. Profil güncellemeleri aynı hesabın açık konuşmasını koparmaz.
- Kaju alıcısı yalnız tam isim eşleşmesi veya açık öneri seçimiyle belirlenir; tek kısmi sonuç otomatik alıcı olmaz.
- Giriş, isim ve transfer hataları formları kalıcı olarak kilitlemez. Öneriler güvenli, klavyeyle kullanılabilen DOM düğmeleridir.
- Profil arka planı varsayılana dönünce eski Matrix çizimi temizlenir. Avatar/kozmetik ve mesaj verileri uygun biçimde doğrulanır/kaçışlanır.
- Tekrarlanan arayüz başlangıcı çift abonelik oluşturmaz. Aynı oyun yüklenirken ikinci yükleme başlatılmaz; asenkron açılış hataları yakalanır.
- Teknik hata ayrıntıları konsolda kalır; kullanıcıya yeniden deneme bilgisi gösterilir. Uzayan başlangıç bağlantısı görünür kurtarma sunar.
- Liderlik ve arkadaş profilleri klavyeyle açılabilir; liderlik boş/hata durumunda yeniden yüklenebilir.
- Normal önbellek temizliği yalnız bu projenin `hero-portal:<scope pathname>:` alanını siler. Tema, oturum, IndexedDB ve diğer uygulamaların verileri korunur. Tam sıfırlama da tüm origin depolarını silmez.

## Worker ve yayın

`sw.js` Hero Portal 138 worker'ıdır. Yalnız gerçek Hero ana sayfası için doğrulanmış çevrimdışı kabuk sunar. Diğer sayfalara veya eksik JavaScript dosyalarına yanlış HTML dönmez. Görseller, yerel fontlar ve kabuğun kullandığı tam gezinme adresi önceden alınır.

`hero-recover.html` eski r820 SÜKÛN worker kontrolünü yalnız birebir proje kaydı için yeniler. Gerçek `HERO_PONG` yanıtı alınmadan ana sayfaya yönlenmez. Bu geçiş sayfasının `sukun-build` etiketi yalnız tarihî worker uyumluluğu içindir; ürün sürümü değildir. Oyuncu kayıtları ve diğer uygulamaların önbellekleri silinmez.

## Doğrulama

Playwright kurulu ortamda:

```sh
node QA/portal-ui.cjs
node QA/portal-flows.cjs
node QA/portal-forms.cjs
node QA/portal-worker.cjs
```

`PORTAL_CHROMIUM` isteğe bağlı Chromium yürütülebilir dosyasını belirtir. `PORTAL_SCREENSHOTS` mevcut bir ekran görüntüsü klasörü belirtir.

- UI: 320, 390, 600, 768, 1024, 1440px genişliklerinde beş sekme; kart taşmaları; klavye/odak; gerçek dört oyun giriş modülü; skor ve XP; sekiz tema/ayar; arayüz boyutu; yerel font/çizim/PeerJS ve bağlantı hataları.
- Sosyal akış: eski dinleyiciler, gecikmiş kişi okuması, aynı hesabın profil güncellemesi, güvenli avatar/kozmetik, başarısız gönderim, sabit alıcı ve hızlı kapat/aç yarışları.
- Formlar: çift abonelik, tam alıcı eşleşmesi, isim ve transfer ağ hataları, güvenli öneriler, arka plan sıfırlama ve proje kapsamındaki önbellek temizliğinde veri koruma.
- Worker: gerçek tarihî r820 dosyasıyla yanlış SÜKÛN ekranı yeniden üretilir; gerçek HTTP/Chromium üzerinde geçiş, worker yanıtı, çevrimdışı kabuk/gezinme, eksik dosyalar ve depolama koruması doğrulanır.

Hesap ve veritabanı testleri bellek içi örnekler kullanır; gerçek hesaba yazılmaz. Canlı Google girişinin, gerçek oyuncular arası çevrimiçi eşleşmenin ve fiziksel Android cihazın uçtan uca doğrulandığı iddia edilmez. Oyun giriş modülleri gerçektir; tüm oyun motoru kurallarının eksiksiz sınanması bu portal güncellemesinin kapsamı değildir.
