# HerOyun Portalı v149 — oyun motoru taraması

Tarih: 21 Ekim 2026. Taban: v148, `cdbef9985259900010ab55b10f529f6885070363`.

Bu tarama saf hamle kuralları, AI hamle üretimi, fizik zamanı, hücre/taş korunması ve puan hesaplarına odaklandı. Önceki arayüz ve oturum testleri de yeniden çalıştırıldı. Orijinal Diamond/taç, 34 px boyutları, parıltı, park ve sürükleme davranışları korunur.

## Doğrulanan ve giderilen hatalar

### Tetris: hücre kaybı ve düşüş zamanı

- Yerçekimi gem'i, tilt/mıknatıs ve bazı kahraman güçleri yerleşmiş blokları aktif parçanın içine taşıyabiliyordu. Sonraki kilitleme dolu hücrelerin üzerine yazarak hücre kaybettiriyordu. Örnek: altı yerleşmiş hücre ve dört hücreli O parçası toplam on yerine altı hücre olarak kalıyordu.
- Tahta dönüşümünden sonra aktif parçanın sığdığı konum kontrol edilir; gerekiyorsa yukarı güvenli konuma alınır. Kilitleme de dolu hücrelerin üzerine yazmayı reddeder; uygun durumda mevcut Nexus/antrenman kurtarması kullanılır.
- Zamanlayıcı düşüşte geçen sürenin kalanını siliyor ve kare başına en fazla bir adım ilerliyordu. 100 ms aralıkta 1.000 ms geçen kare yalnız bir hücre düşürüyordu. Oyuncu ve AI artık düşüş aralıklarını ve kalan süreyi korur.
- Zemin kilitleme gecikmesi kronolojik uygulanır; yeni taşa kalan süre aktarılır. Aynı karede seviye/hız değişirse yeni hız kullanılır. Büyük gecikmeler sınırlı işlenir, kalan zaman borcu sonraki karelere taşınır.
- Hayatta kal modunda birden fazla 30 saniyelik eşik geçilince yalnız bir hız artışı uygulanıyordu; geçilen eşik sayısı dikkate alınır.

### Macera yıldızları

Önceki yıldız hesabı hedefin %120/%150'sini istiyordu; oyun hedefte hemen bittiğinden normal dört satıra kadar temizlemelerle bölümlerin çoğunda bu puanlara erişilemiyordu. Fazladan satır ölçütü korunup eşikler ulaşılabilir yapıldı:

| Tamamlama | Yıldız |
| --- | ---: |
| Hedef kadar satır | 1 |
| Son temizlemede hedef +1 satır | 2 |
| Son temizlemede hedef +2 veya daha fazla satır | 3 |

Eksik/geçersiz sonuç sıfır yıldız döndürür. Ölçüt dünya seçiminde gösterilir. Sekiz dünyanın hepsi normal hamlelerle üç yıldız alabilir; önceden kazanılmış yüksek yıldızlar düşük tekrar sonucuyla azalmaz.

### Satranç: süre sonunda materyal hesabı

Tek atın rakip şah+vezire, aynı renk fillerin rakip şah+kale/vezire karşı materyal hesabı yanlış pozitif dönebiliyordu. Taraf bazında mat yeterliliği düzeltildi; iki renk, karşı renk filler ve yardımcı materyal örnekleri sınandı.

Bağımsız karşılaştırmada python-chess 1.11.2 ile 1.200 yasal konumun hamle, şah tehdidi ve genel yetersiz materyal sonucu uyuştu. Özel konumlarda derinlik üç hamle sayıları 97.862 / 2.812 / 9.467 / 62.379 olarak doğrulandı. Referans kod projeye veya çalışma bağımlılıklarına eklenmedi.

### Tavla: bitmiş oyunda hamle üretimi

Sonuç bitmiş olduğu halde eski sıra ve zar bilgisi kalırsa motor/AI karşı renge hamle üretebiliyordu. Bitmiş oyunda yasal hamle listesi boş ve tur tamamlanmış kabul edilir.

Bağımsız, mesafe yönüne göre hesap yapan kural karşılaştırıcısı 321 konum, 1.448 yasal geçiş ve 225 tam AI turunda normal hamle kurallarıyla uyuştu. Bar girişi, zarların azami kullanımı, büyük zar, çiftler, toplama, ayna simetrisi ve normal/mars/katmerli sonuçlar sınandı. Bu normal konum örneklerinde başka kural uyuşmazlığı bulunmadı.

### Kelimecik: puan ve AI kelime üretimi

- Mevcut tahta hücresindeki bozuk sayı/metin puanı yanlış veya sonsuz skor üretebiliyordu; eksik/sparse satırlar hata fırlatabiliyordu. Tahta hücreleri ve taş puanları doğrulanır.
- AI yalnız raf ve tek mevcut harften arama yapıyordu. Tahtadaki birkaç harfi birlikte kullanan uzatmaları ve yalnız çapraz kelimelerle bağlanan paralel hamleleri kaçırıyordu. Gerçek sözlükte AD + Z → ADZ ve ACINI + C → ACINIC örnekleri bunu gösterdi.
- Yeni arama sözlük ağacında mevcut tahta harflerini, rafı, jokerleri ve çapraz kelimeleri birlikte takip eder. Arama sınırları/zorluk seçimi korunur; geçerli raftan taş kullanımı ve sıfır puanlı jokerler doğrulanır.
- İngilizce sözlük yüklenmeden başlanan arama boş indeksi kalıcı tutabiliyordu; sözlük kaynağı değişince indeks yenilenir.
- Kayıtlı tahtadaki eski joker biçimi ile yeni joker yerleştirmesinin biçimi ayrıldı. Yeni joker açık `assigned` değeri olmadan kabul edilmez; geçerli commit sonrası tahta geçerli kalır.
- Motor ve sonuç ekranındaki bingo bonusu 30 olarak korundu; rehberdeki hatalı 50 ifadesi 30 yapıldı.

## Testler

Beş yeni Node dosyasında 27 test grubu geçti:

| Dosya | Grup |
| --- | ---: |
| `QA/chess-engine-v149.mjs` | 3 |
| `QA/tavla-engine-v149.mjs` | 3 |
| `QA/kelime-engine-v149.mjs` | 9 |
| `QA/tetris-oracle-v149.mjs` | 9 |
| `QA/adventure-engine-v149.mjs` | 3 |

Yeni `QA/tetris-power-v149.cjs` gerçek modül/canvas ve gerçek gem/düşürme düğmeleriyle üç tarayıcı test grubu içerir. Önceki sürümde bu üç grup başarısızdı; yeni kaynakta hücre korunması, 1.000 ms düşüş ve düzensiz karelerin zaman kalanı geçti. Böylece toplam 30 yeni test grubu eklendi.

Önceki 17 motor/oturum paketiyle birlikte **22 Node paketi**, yeni testle birlikte **9 Chromium paketi**, **60 JavaScript dosyasının** sözdizimi ve diff kontrolleri geçti. Chromium paketleri: tavla-input, portal-ui, portal-state, portal-forms, portal-flows, portal-worker, tetris-session-ui, tetris-stress, tetris-power-v149.

Ek değişmezlik kontrolleri: satrançta 1.000 hamle; Tetris'te 700 taş çekilişi, her taşın dört dönüşü, kilitlemede 499→500 ms sınırı, değişen hız ve büyük zaman borcunun küçük karelerle aynı sonuca ulaşması. Gerçek tarayıcı stres testi 50 JSON kayıt/kapat/devam döngüsü, 1.200 hareket döngüsü ve dokuz kahramanın gücünü içerir. Altı ekran genişliği, 11 tema, özgün ikonlar ve tavlanın dört ölçekte 6–3 hamlesi de tekrar geçti.

## Sınırlar ve kaynak

Hesap/Firebase ve PeerJS sınırları deterministik test verileridir; üretim hesabına ödül veya mesaj yazılmadı. Fiziksel Android, iki gerçek cihaz arasında canlı maç, sunucu kuralları ve saatler süren pil testi yapılmadı. Bağımsız karşılaştırmalar örneklem ve belirli değişmezler için kanıttır; tüm olası konumların hatasızlığı anlamına gelmez.

Kelime AI'sı sınırlandırılmış arama yapar; bütün konumlarda matematiksel en yüksek skoru garanti etmez. Gerçek sözlükte dolu raf+joker örnekleri test ortamında yaklaşık 110–130 ms sürdü; fiziksel telefonda performans ayrıca ölçülmelidir.

Satranç materyal referansı: [python-chess resmî kaynak kodu](https://python-chess.readthedocs.io/en/latest/_modules/chess.html#Board.has_insufficient_material). Materyal değerlendirmesi tüm konumsal ölü pozisyonlarını çözme iddiası taşımaz.
