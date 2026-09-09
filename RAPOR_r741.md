# SÜKÛN r741 — Sabit Tefekkür başlığı

**Temel:** r740 · **Tarih:** 9 Eylül 2026

## Sorun ve kapsam
Kullanıcının “bir öyle bir böyle” ifadesi, başlığın farklı görünümler arasında gidip gelmesini anlatıyordu; “Bi” ismin bir parçası değildi. r739'un metin ayıklaması yanlış yaklaşımdı ve r740'ta kaldırılmıştı. r740'ta kalan `currentZikirState` bağı, akıllı seansın geçici adımını seçili Tefekkür başlığına taşıyabiliyordu. Eski isim görünümü kuralları da Tefekkürde ayrı animasyon/gizleme düzenleri kuruyordu. Fiziksel Android'deki her olayın birebir izi bulunmadığından bu kaynak çakışmaları gözlenen davranışla uyumlu, doğrulanabilir nedenlerdir; cihazdaki tek neden oldukları iddia edilmez.

## Uygulanan düzeltme
Başlık seçili `Z` kaydından ve kanonik `ZIKIR` matrisinden okunur. Akıllı seansın geçici adı, oynatma, sayaç veya başka bir ses sağlayıcısı bu metni değiştiremez. Favori kaynak eşlemesi ve mevcut gizli içerik politikası korunur. Genel metin kesme/tekrar temizleme işlemi yapılmaz; isimlerin Arapçası, okunuşu, ebcedi ve kayıt anahtarları değiştirilmez.

`renderZikir` seçim değişikliğini yalnız gerçekten farklı bir kaynak kimliği çizildiğinde bildirir. Aynı kaydın tekrar çizilmesi giriş animasyonunu yeniden başlatmaz. Başlık yazıcısı oynatma ve akıllı seans olaylarını dinlemez; görünürlük ve genişlik değişimleri yalnız gerekli yerleşim hesaplarını tetikler. Eski Tefekkür isim perdesi ve Animasyon/Kapalı gizleme istisnaları kaldırıldı; normal ekran tercihleri korunur. r740'ın simetrik süsleme ve tam metinli adaptif tipografisi korunur.

## Doğrulama
- source: 31/31 geçti.
- mini: 5/5 geçti.
- restart: 10/10 geçti.
- failure: 8/8 geçti.
- transport: 7/7 geçti.
- ring: 6/6 geçti.
- focusedBrowser: 5/5 geçti.
- fullSmoke: 3/3 geçti.

Odaklı Chromium testleri gerçek başlık kodunu ve isim matrisini kullanır: 30 akıllı seans/oynatma/sayaç olayı boyunca Hûtîrin değişmedi; Sabit/Animasyon/Kapalı tercihleri, 320–428 px genişlikler, Mini/Midi/Max, uzun isimler ve favori kimliği kontrol edildi. Tam HTML Chromium smoke testinde akıllı seansın farklı isim göstermesi başlığı değiştirmedi; Tefekkürden çıkış sayacı korudu. Ekran görüntüsü `diagnostics/r741/r741_hutirin_390.png` içindedir.

Kaynak regresyonları tarayıcı veya fiziksel cihaz testi değildir. r741 için yeni gerçek medya oynatma testi yapılmadı; önceki r738/r740 ses kanıtları yalnız taban kanıtıdır. Gerçek Android, kullanıcı kaydı, TTS, kulaklık ve kilit ekranı ayrıca doğrulanmalıdır. Canlı GitHub kurulumu değiştirilmedi.

## Paket bütünlüğü
HTML, manifest, SW/cache adı, build marker ve sürüm geçmişi eşitlendi. Manifest kimliği/scope, kayıtlar ve kullanıcı verileri korunur. Eski sürüm metaverileri `diagnostics/history` altında saklanır. ZIP CRC ve dosya SHA-256 kontrolü yapılır.
