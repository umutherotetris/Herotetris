SÜKÛN r701 — UI/UX Geometry Integrity
7 Eylül 2026

Temel: kullanıcı tarafından sağlanan r700 tam paket.

Mini/Midi/Max doğal içerik yüksekliği, güvenli sürükleme sınırları, tek oynatma satırı, okunur istatistikler ve bildirim hizalaması düzeltildi. Kısa ekranlarda Tefekkür kartı ile player gövdesi bağımsız doğal kaydırılır; Max çıkış ve gezinmeyi örtmez. Dar genişlikte kontroller kartı genişletmez. Gizle/geri getir durumu render tarafından geri alınmaz.

Kurulum: ZIP içindeki dosyaları birlikte, mevcut uygulamanın aynı HTTPS origin ve dizinine yayınlayın. Tek başına nero.html güncellemek, eski SW/manifest önbelleğini bırakabilir. Mevcut kayıt ve kullanıcı verilerini korumak için tarayıcı/site verilerini silmeyin. Service worker yeni sürümü aldığında uygulamayı yeniden açın.

Doğrulama: 24 tarayıcı yerleşim senaryosu, 39/39 read-only regresyon kontrolü, 183 çalıştırılabilir betik sözdizimi. Android cihazda gerçek kayıt/TTS, kilit ekranı, telefon görüşmesi, kulaklık ve kurulu PWA yaşam döngüsü bu testlerde çalıştırılmadı.

Kaynakta ses, kayıt, sayaç ve seyir iş mantığı korunmuştur; yalnızca dört mevcut yerleşim runtime'ı, mevcut dock görünürlük davranışı, sürüm kayıtları ve r701 arayüz katmanı değiştirilmiştir.
