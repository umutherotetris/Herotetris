# Hero Portal v157 — 23 Kasım 2026

Bu sürüm v156 üzerine mobil yerleşim ve çevrimiçi oturum düzeltmeleri getirir. Aurora, taç ve Diamond görselleri, ölçüsü ve sürükleme/park davranışı korunur.

| Alan | Düzeltilen davranış |
|---|---|
| Oda davetleri | Paylaşım metnindeki `Oda kodu:` satırı harf harf ayrıştırılır. Kesik/geçersiz kod bağlanma isteği yaratmaz. Oda girişleri etiketli ve Enter ile kullanılabilir. |
| Satranç / Tavla | Tamamlanmayan ilk bağlantı odayı kilitlemez. Sinyal ve oyun kanalı ayrı değerlendirilir. Yeniden bağlantı ve tahta eşitleme sınırlandırılır; başarısız gönderim tek taraflı beraberlik/teslim sonucu yazmaz. Satrançta hızlı rakip hamlesi animasyon sırasında saklanır; bağlantı kesikken saat sonucu çıkmaz. |
| Tetris | Bağlantı veya eşitleme beklerken çevrimiçi oyun durur. Gönderilemeyen saldırılar eşitlemede tekrar sayılmadan uygulanır. Kopma galibiyet sayılmaz. |
| Kelimecik | Canlı arama kuyruğu yenilenir, iptal yalnız kendi oda kaydını siler. Bağlantıya göre hamleler kilitlenir, dönünce oturum güncellenir. Eski hamle/teslim önceki turu ezmez; belirsiz onayda kaydedilen raf geri yüklenebilir. |
| Mobil arayüz | 320/360 px ve kısa yatay görünüm için panel, sağ ray, oda ve oyun kontrolleri iyileştirildi. Sohbet mobil klavye ile görünür alana uyum sağlar. Tahta geç gelen oyuncu paneliyle birlikte yeniden sığdırılır. Oyun öndeyken portalın arkadaki kontrolleri odak almaz. Dört oyun da Birlikte filtresinde bulunabilir. |
| Android | İmzalı `tr.heroyun.portal`, 1.57 / 157, minimum Android 6.0. Canlı HTTPS portalını Android tarayıcı özel sekmesinde açar; APK oyunları çevrimdışı paketlemez ve Play Store'a gönderilmemiştir. |

## Doğrulama

- Tüm Node regresyon paketleri; ek olarak Satranç/Tavla 14, Tetris 10, Kelimecik 10 çift istemci ağ senaryosu. Mobil yerleşim 7 grup ve oda paylaşım metni testi.
- Chromium'da iki ayrı oyun istemcisi: 320/360 px ve 740×360 boyutlar. Bağlantı/katılma, kesinti ve geri dönüş geçişleri Tetris, Satranç, Tavla için yapay PeerJS veri kanalıyla; Kelimecik için ortak izole RTDB benzetimiyle çalıştırıldı. Satranç yatay taşması 407 nümerik alt sınırından, 360 yüksekliğindeki ekranda 352'ye düzeldi. Canlı oyunculara ait veri kullanılmadı.
- Açık PeerJS sunucusuna ayrıca oda oluşturma ve ikinci uçtan gerçek bağlanma denemesi yapıldı. Satranç kodu üretildi; uçtan uca veri kanalı doğrulanamadı. Gerçek iki telefon, farklı Wi-Fi/mobil ağlar, TURN koşulları ve üretim Firebase yetkileri doğrulanmadı. Yerel test bunların yerine geçmez.
- APK; manifest/paket kimliği, ZIP ve zipalign, v1/v2/v3 imza kontrolleri geçti. Fiziksel cihaza kurulmadı. SHA-256: `c4628e634d8d797c2bce99332dcf6d9b4ee7f14814f3890423677c1703536dab`.
