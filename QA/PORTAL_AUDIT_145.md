# Hero Portal v145 — İnceleme ve düzeltme raporu

Tarih: 21 Ekim 2026. Hedef: `umutherotetris/Herotetris` ana dalı.

## İkonlar ve kişiselleştirme

- Orijinal 💎 ve 👑, 34 px boyutları ve mevcut parıltı/animasyonları korunarak üst başlıkta arama düğmesinden önce park edilir.
- Fare veya dokunmayla taşınabilir. Varsayılan olarak her açılışta park edilir; kişiselleştirme ekranından son konumu hatırlama seçilebilir. “Şimdi üstte park et” mevcut konumu sıfırlar.
- Ölçekli görünümde sürükleme koordinatları düzeltildi; yeniden boyutlandırmada yüzen ikonlar ekran sınırlarına alınır. Yönetici tacının görünürlük yetkisi korunur.
- Profil → Kişiselleştir: oyuncu unvanı, 120 karakterlik açıklama, avatar, beş vurgu rengi, renkli çerçeve, arka plan ve favori oyun. Canlı önizleme, kaydetme ve görünümü sıfırlama bulunur.
- Bu yeni profil tercihleri **bu cihazda, hesap kimliğine göre ayrı** saklanır. Başka cihazlara veya diğer oyuncuların gördüğü herkese açık profile otomatik aktarılmaz. Mevcut hesap avatarı/fotoğrafı, hesap çerçevesi ve diğer hesap özellikleri kullanılmaya devam eder.
- Profil çerçevesinin `fire`, `purple` gibi kimliğinin doğrudan CSS rengi olarak kullanılması düzeltildi; kimlik gerçek renge çevrilir.

## Oyun motorlarında giderilen sorunlar

| Oyun | Bulgu | Düzeltme / doğrulama |
| --- | --- | --- |
| Satranç | Boş karedeki piyon tehdidi, normal ilerleme hamlesiyle karıştırılıyordu; rok kontrolü etkileniyordu. | Saldırılan kare hesabı taş hareketinden ayrıldı; piyon çaprazı ve rok geçişi test edildi. |
| Satranç | Motor yalnız vezire terfi üretiyordu. | Vezir, kale, fil ve at seçenekleri motorun yasal hamlelerine alındı. |
| Satranç | Yakalanamayan en passant hedefi tekrar anahtarını farklılaştırıyordu. | Anahtara yalnız yasal en passant mümkünse eklenir. Şahı açığa çıkaran en passant da test edildi. |
| Satranç | Çevrimiçi hamle koordinatları ve özel hamle bayrakları doğrudan uygulanıyordu. | Yerel yasal hamlelerle eşleştirme; hamle bayraklarını yerelde üretme; sıra/oyun sonu kontrolü. |
| Tavla | Büyük zarla toplamada daha uzaktaki pul yanlış aralıkta aranıyordu. | İki renk için en uzaktaki pul kuralı düzeltildi. |
| Tavla | Mümkünken iki zarı kullanma ve yalnız tek zar kullanılabiliyorsa büyüğünü kullanma kuralı eksikti. | Devam hamlelerini tarayan motor, izin verilen başlangıç hamlelerini süzer. |
| Tavla | Ağ mesajında `hit` türü bulunmayınca kırılan pul bar'a taşınmayabiliyordu. | Vuruş tahtadaki gerçek durumdan türetilir; 15 pulun korunması test edilir. |
| Tavla | Peş peşe gelen hamleler ve tur sonu, animasyon tamamlanmadan uygulanabiliyordu. | Hamle animasyonları süresince gelen ilgili mesajlar sıraya alınır. Yerel yasal hamle ve zar doğrulaması eklendi. |
| Kelimecik | İngilizce sözlük hazır değilken tüm kelimeler kabul edilebiliyordu. | Sözlük hazır olana kadar doğrulama başarısız olur ve açıklayıcı mesaj verir. |
| Kelimecik | Tahta dışı koordinatlar, geçersiz taş puanları ve hatalı önizleme girdileri denetlenmiyordu. | Sınır, harf, joker, puan ve tekrar kare kontrolleri; önizleme aynı doğrulama sonucunu kullanır. |
| Kelimecik | Gecikmeli AI/taş değişimi/sürükleme işlemleri kapanmış veya yeni açılan oyuna erişebiliyordu. | Gecikmeli işlemler ait oldukları oyun oturumuyla sınırlandı. |
| Tetris | Skor animasyonu başlangıçtaki hedefe bağlı kaldığından hızlı yeni puanları kaçırabiliyordu. | Her animasyon adımı güncel skoru izler; yeni oyun oturumuna taşmaz. |
| Tetris | Oyun kapanırken basılı tutulan kontrolün zamanlayıcısı ve skor animasyonu sürebiliyordu. | Kapanışta temizleme; eski oturumun yeni oyunu etkilemesini engelleme. |
| Tetris | Uygulama arka plana geçince solo oyun otomatik durmuyordu. | Solo oyun duraklatılır, kayıt alınır, zaman referansı sıfırlanır. Çevrimiçi maçı duraklatma davranışı değiştirilmedi. |

## Çalıştırılan doğrulamalar

- `node QA/portal-engines.mjs`: satranç başlangıcında 20 / 400 / 8902 hamle ağacı sayımları; rok, terfi, mat, en passant ve tekrar; tavla zar/toplama kuralları, hamle değişmezliği ve 160 tura kadar simülasyonda pul korunması; Kelimecik Türkçe/İngilizce sözlük, yükleme kapısı, joker, merkez puanı, geçersiz taş ve tohumlu torba.
- `node QA/portal-game-network.mjs`: gerçek tavla mesaj işleyicisine hızlı hamle/tur sonu gönderimi, vuruş ve sıra senkronu; Kelimecik kapatılan/değiştirilen oturum için gecikmeli işlem engeli. Ağ ve animasyon bağımlılıkları deterministik test verileridir.
- `QA/portal-ui.cjs`: 320/390/600/768/1024/1440 genişlik, beş portal ekranı, dört gerçek oyun giriş modülü, 11 tema, ölçek ayarları; park, sürükleme, kayıt, yönetici görünürlüğü; gerçek dokunma olayıyla sürükleme; kişiselleştirme kaydı, güvenli düz metin ve hesap ayrımı. Tetris gerçek modülünde skor güncelleme, sert düşüş, arka plan duraklatma ve kontrol basılıyken kapanış.
- `QA/portal-state.cjs`: hesap değişimi, cüzdan işlemleri, ödüller, bildirimler ve eski oturum yanıtları.
- `QA/portal-forms.cjs`: form hata kurtarma, alıcı seçimi, tekrar abonelik, Matrix arka planı temizliği ve uygulamayla sınırlı önbellek temizliği.
- `QA/portal-flows.cjs`: mesaj dinleyicileri, geç yanıt, güvenli metin, başarısız gönderim taslağı, doğru alıcı ve paneli hızlı kapat/aç.
- `QA/portal-worker.cjs`: eski SÜKÛN worker'ından geçiş, Hero çevrimdışı kabuğu, eksik modül yanıtları ve diğer uygulamaların verilerinin korunması.
- `js/` altında 60 JavaScript dosyası için `node --check`: sözdizimi hatası yok.
- Tavla zor AI'nın çift-altı dizisi ve satranç orta AI hamlesi motorun yasal hamleleriyle karşılaştırıldı.
- Mobil park yerleşimi ve kişiselleştirme penceresi ekran görüntüleri incelendi. Test sunucusunda renkli emoji yazı tipi bulunmadığından simgeler kutu görünebilir; üretimde cihazın orijinal emoji simgeleri kullanılır, yeni görsel eklenmedi.

## Sınırlar ve sonraki doğrulama

Bu tarama, sistemin hatasız olduğunun matematiksel garantisi değildir. Google/Firebase işlemleri testlerde bellek içi verilerle çalıştırıldı; gerçek hesaplara mesaj/ödül/para yazılmadı. Canlı Firebase güvenlik kuralları, iki fiziksel Android cihaz arasında gerçek ağ üzerinden maç, kopup bağlanma, uzun süreli pil/performans ve tüm oyun varyantlarının uzun maçları ayrıca doğrulanmalıdır. Oyun kuralları değiştiği için çevrimiçi maçta iki tarafın da v145'i yüklemesi gerekir.

Kurallar için başvurulan kaynaklar: [FIDE Satranç Kuralları](https://handbook.fide.com/chapter/e012023), [Backgammon Galore kuralları](https://bkgm.com/rules.html). Bu rapordaki hata bulguları ve test sonuçları proje kodundan elde edilmiştir.
