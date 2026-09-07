# SÜKÛN r701 — Tefekkür Tanı Düzeltmesi

Tarih: 7 Eylül 2026  
Temel: SÜKÛN r700 tam paket  
Kapsam: Yanlış görünürlük FAIL'ini düzeltmek; mevcut giriş/çıkış, ses ve sayaç sahipliğini korumak.

## Kullanıcı raporundan bulgu

r700 raporunda tefekkür girişinin tekliği ve doğru DOM yuvası PASS iken görünürlük FAIL idi. Aynı kayıtta arayüzün ana sayfada/idle olduğu, tefekkürün kapalı olduğu ve zikir sekmesi sınıfının bulunmadığı görülüyor. r700 testi, sekme gizliyken bile düğmenin 44×44 px geometriye sahip olmasını şart koşuyordu. Çocuğun display:flex olması, display:none olan atanın onu görünür kıldığı anlamına gelmez. Bu yüzden rapor, butonun aktif zikirde kayıp olduğunu kanıtlamıyordu.

Tam r700 uygulaması Chromium'da açılarak aynı yanlış FAIL ana sayfada üretildi. Zikre geçince buton 326×56 px göründü ve ilgili kontrol PASS oldu. Gerçek tıklamayla tefekküre giriş ve canonical çıkış çalıştı; ana sayfaya dönüşte giriş yeniden gizlendi.

## r701 değişikliği

- Eski r700 giriş tanısı yerine bağlam farkında r701 kontrolü kondu. Tek düğme, doğru DOM sahibi ve emekli yuvanın bulunmaması denetlenmeye devam ediyor.
- Görünürlük, yalnız düğmenin kendi display değeriyle değil, ata zincirinin gerçek render ve etkileşim durumuyla değerlendiriliyor. Gizli sekme 44 px şartından muaf; fakat görünür zikir bağlamında girişin saklanması artık FAIL.
- Aktif zikirde girişin en az 44×44 px ve etkileşime açık olması; tefekkürde girişin gizli, mevcut canonical çıkışın görünür ve en az 44×44 px olması doğrulanıyor. Diğer sekmelerde girişin etkin bir görünür kontrol olarak sızması kabul edilmiyor.
- Tanı, açık tanılama penceresinin beklenen hit-test perdesini yanlış arıza saymıyor. Gerçek tıklama ayrıca tarayıcı testinde sınanıyor.
- Onaylanan r700 butonunun DOM, CSS ve handler kodları değiştirilmedi. r530 tefekkür motoru, ses/seyir/kayıt/TTS/sayaç iş mantığı ve tüm stil blokları r700 ile aynıdır. Yeni observer, timer, oynatıcı veya alternatif çıkış eklenmedi.
- Görünen sürüm, manifest başlangıç adresi, SW kaydı/önbelleği, build işareti ve sürüm geçmişi r701'e eşlendi. Uygulama kimliği, kapsamı ve eski geçmiş korundu; SW'nin cache/aktivasyon algoritması değişmedi.

## Doğrulama ve sınırlar

Tam kaynak Chromium testinde 320×640, 384×747, 390×844 ve 640×360 ekranlarında ana sayfa → zikir → tefekkür → çıkış → yeniden giriş/çıkış → ana sayfa akışı gerçekleştirildi. 20 bağlam kontrolünün tamamı PASS; tek giriş/çıkış, 44 px hedefler, gerçek tıklama, sayaç kimliği ve ses state değişmezliği doğrulandı. Sayfa JavaScript hatası oluşmadı. Negatif testte girişin gizlenmesi, devre dışı kalması, kopyalanması ve canonical çıkışın gizlenmesi beklenen FAIL'i verdi; geri yüklemeler PASS oldu (11 kontrol). Testler yeni, boş ve yalıtılmış tarayıcı profilinde yapıldı; kullanıcı verilerine dokunulmadı.

Tam güvenli testin diğer alanlarında, büyük HTML'in set_content ile tek seferde yüklenmesinden kaynaklanan 832–1469 ms başlangıç long-task kayıtları FAIL olarak raporlandı. Bunlar saklanmadı ve tefekkür kontrolü sonucuna dahil edilmedi. Kullanıcının gerçek r700 raporunda ise en yüksek uygulama long-task süresi 150 ms idi. Bu bakım sürümü performans motorunu değiştirmez veya eski performans sorunlarının çözüldüğünü iddia etmez.

Bütün yürütülebilir JavaScript bloklarının sözdizimi, CSS parse/tekillik, build-SW-manifest tutarlılığı, sürüm geçmişi, SW algoritması ve kaynak değişiklik sınırları ayrıca denetlendi. Ayrıntılar diagnostics/static_audit.json, r701_full_browser.json ve r701_negative_tests.json dosyalarındadır.

Gerçek Android cihazında kilit ekranı, telefon çağrısı, kulaklık kumandası, kayıt/TTS ve uzun süreli ses testi yapılmadı. Önceki ses veya sayaç hatalarının giderildiği iddia edilmiyor. Uygulama paketinin tüm dosyalarını birlikte yayımlayın ve yeni SW'nin etkinleşmesini bekleyin. Yerel kayıtları/IndexedDB'yi ve kullanıcı yedeklerini silmeyin. Kullanıcının ham tanı JSON'u, kişisel verilerin dağıtım paketine eklenmemesi için pakete konmadı.
