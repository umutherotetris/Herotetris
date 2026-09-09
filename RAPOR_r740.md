# SÜKÛN r740 — Berhetiyye başlığı ve flashing düzeltmesi

**Temel:** r738 · **Tarih:** 9 Eylül 2026 · **Kapsam:** Kanonik isim sunumu, Tefekkür başlığı, dekoratif geometri ve regresyon koruması.

## 1. Kök neden
r739, başlığı düzeltemedi. Yeni bir isim yazıcısı eski r611 ve r678 yazıcılarının üzerine eklenmişti. r739'un metin ayıklama düzenli ifadesinde kaçış karakteri hatası da bulunuyordu. Eski isim perdesi ile sabit başlık birbirini görünür/gizli yapabiliyor; r699 ve r706 CSS kuralları süslemeleri kapatıyordu. Bu, kullanıcının gördüğü iki farklı metin ve göz kırpmasıyla uyumlu somut bir kaynak çakışmasıdır. Fiziksel Android'deki her olayın birebir iz kaydı olmadığı için tek neden olduğu kesinleştirilmemiştir.

Kanonik 28'li matriste 10. isim (index 9) **Hûtîrin** olarak kayıtlıdır. “Bi” bu ismin parçası değildir. Verinin `tr`, `oku`, Arapça, ebced, kaynak/varyant ve kayıt anahtarı alanları değiştirilmedi.

## 2. Uygulama
- r739'un hatalı ayıklama ve ek yazıcı yaması taşınmadı. r738'in ses açısından denetlenmiş tabanı kullanıldı.
- r611, tek görsel isim sahibi olarak yeniden düzenlendi. İsim `currentZikirState` kimliğiyle eşleşen kanonik `ZIKIR` kaydından alınır; Berhetiyye ve Esmâ için yalnız eksikse bir kez “Yâ” öneki eklenir. Genel bir metin kesme/tekrar silme işlemi yoktur.
- r678'in ses için nidâ sarmalayıcısı korunup yalnız rakip görsel yazıcısı kaldırıldı. r612'nin ikinci MutationObserver'ı emekli edildi.
- Eski isim perdesinin Tefekkürdeki gösterimi kendi üretim kapısından engellendi. Normal ekrandaki isim bildirimi tercihleri ve işlevleri korunur. Başlık, toast sınıfına göre gizlenmez.
- Başlık DOM'u tek bir merkez satırına alındı: eşit genişlikte iki yan süsleme alanı ve gerçek ortadaki isim. r699/r706'nın eski süsleme gizleme kuralları kaldırıldı.
- Yazı ölçümü yalnız isim/kimlik veya genişlik değişince yapılır. Uzun isimler ölçülerek küçültülür; çok uzun çok kelimeli başlıklar gerekirse kelime sınırında satırlanır. Kayan yazı, kelime içi kırılma ve metin ellipsis'i kullanılmaz.
- Ses motoru, sayaç, hedef, kayıt seçimi, 28/99 seyir sahipliği, gizli kasa ve 7/9 yüzük erişimi değiştirilmedi. Kullanıcı verileri silinmez veya sıfırlanmaz.

## 3. Doğrulama
| Kontrol | Sonuç |
| --- | --- |
| Kaynak ve SW regresyonu | 31/31 |
| Mini oynatıcı | 5/5 |
| Önceki yeniden başlatma | 10/10 |
| Ses/sayaç hata senaryoları | 8/8 |
| Asenkron durdurma yarışları | 7/7 |
| Yüzük erişimi | 6/6 |
| Yeni Chromium başlık kontrolleri | 4/4 |

Chromium'da Hûtîrin seçilip eski DOM'a kasıtlı olarak `Yâ Hûtîrin Bi.` yazıldı. Kanonik başlık `Yâ Hûtîrin` kaldı; 12 art arda sayaç/oynatma olayı sonrasında yalnız ilk doğru metin yazımı görüldü, başlık görünür kaldı ve sayaç korundu. 320, 360, 390 ve 428 px'de Mini/Midi/Max olmak üzere 12 yerleşim durumu geçti. Diğer uzun Berhetiyye ve normal Esmâ isimleri, tam metin ve ortalama kontrolünden geçti. Tefekkürden çıkışın sayaç/otomatik oynatma durumunu değiştirmediği kontrol edildi. Gerçek HTML ekran görüntüsü `diagnostics/r740/r740_hutirin_390.png` içindedir.

r740'ta 185 ilgisiz inline JavaScript modülü r738 ile birebir aynıdır. Kaynak üzerinde çalışan ses regresyonları geçmiştir. Gerçek WAV uzun oynatma kontrolü yeniden denenmiş, fakat ortam süre sınırında tamamlanmamıştır; yeni bir medya başarı sonucu olarak sayılmamıştır. r738'in önceki sentetik WAV kanıtı yalnız taban kanıtıdır. Gerçek Android, kullanıcı kaydı, TTS, kulaklık ve kilit ekranı ayrıca doğrulanmalıdır.

## 4. Paket bütünlüğü
HTML, manifest, SW, cache adı, build marker, sürüm geçmişi ve SHA-256 eşitlendi. Manifest kimliği/scope ve kalıcı veri anahtarları korunur. ZIP içindeki dosyalar SHA-256 ve CRC ile doğrulandı. r738 ve r739 önceki paketler ayrı geri dönüş noktalarıdır; canlı GitHub kurulumu değiştirilmedi.
