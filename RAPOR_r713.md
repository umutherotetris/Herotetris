# SÜKÛN r713 — Kandil Yaşam Döngüsü ve Durum Güvenilirliği

**Tarih:** 8 Eylül 2026  
**Temel:** Kullanıcının gerçek r712 tam paketi  
**Kapsam:** Telefon tanısındaki somut hataların dar kapsamlı onarımı. Sinematik Tefekkür ve mevcut özellikler korunur.

## Telefon tanısı ve doğrulanan kök neden

Kullanıcının r712 JSON kaydında aynı null `classList` istisnası altı kez, 26396/26403 satırlarında oluştu. Kandil öğesi NeuroSync'in tembel şablonundaydı; ancak 60 saniyelik hareketsizlik zamanlayıcısı bu şablon açılmadan çalışıyordu. Böylece olmayan öğe üzerinde gösterme/gizleme işlemi hata üretiyordu. Kaynakta yeniden üretildi ve DOM sahipliği düzeltildi.

Kayıtta 477 uzun görev ve en fazla 418 ms kayıtlı uygulama görevi vardı. Olay fırtınası sayısı sıfırdı. Yaklaşık 415 saniyelik en büyük gecikme, uzun gizli ekran dönemini de kapsadığından tek başına yedi dakikalık görünür donma kanıtı değildir. Bu sürümde görünür gecikme ayrı ölçülür. İsteğe bağlı sistem tam ekranı denetimindeki başarısızlık bu sürümün kapsamı dışındadır; tarayıcı tam ekran izni garanti edilemez.

## Kod değişiklikleri

Kandil tekil, bağımsız DOM katmanına taşındı. Eksik öğede null erişimi yapılmaz. Gösterme/gizleme işlemleri güvenli ve tekrar çağrılabilir hâle getirildi. Tek bir hareketsizlik son kontrolü ve yalnız açıkken çalışan saat güncellemesi kullanılır. Aktif ses, Tefekkür, açık diyalog veya gizli ekran sırasında Kandil açılmaz; görünür kullanıcı etkileşimiyle kapanır. Kandil'in boşta ekranı uyanık tutma isteği kaldırıldı; sesin mevcut kilit ekranı taşıyıcısına müdahale edilmedi. Yeni kalıcı kullanıcı ayarı veya veritabanı yazması eklenmedi.

AudioLife'a kullanıcı komutu sıra numarası ve terminal Stop niyeti eklendi. Gecikmiş `autoStop` ve genel Stop sonuçları, araya yeni komut girerse eski durumu yazamaz. Fiziksel `playing` yankısı açık kullanıcı Pause/Stop kararını tersine çeviremez. Tekrarlanan Pause da terminal Stop'u silmez; terminal niyet yalnız açık Play/Resume ile serbest kalır. Durum eşitliği kontrolünden önce yankı normalleştirilir. Bu düzeltme, r712'nin mevcut seyir kurtarma bütçesini değiştirmez ve yeni ses motoru kurmaz.

r711 tanısı, görünür ekran gecikmesini arka plan/uyku süresinden ayıracak şekilde revize edildi. Son 24 uzun görev için süre ve yakın kullanıcı etkileşimi bilgisi tutulur; bu ilişki bir JavaScript stack trace veya kesin suçlu modül tespiti değildir. Tanı geçmişi sınırlıdır; yeni sürekli render veya ses zamanlayıcısı eklenmedi.

## Korunan özellikler ve kaynak farkı

28/99 Seyir, tekil zikir, terkip, kendi kayıt/TTS, sayaç/ledger, mini/midi/max akış barı ve r710 sinematik sahnesi korunur. 154 CSS bloğunun 153'ü bayt düzeyinde aynıdır; yalnız Kandil'in gizliyken dokunma yakalamasını engelleyen kural değişmiştir. Üç WebP sanat varlığı ve ikonlar r712 ile bayt düzeyinde aynıdır. Değişen kaynak sahipleri ve SHA-256 parmak izleri `diagnostics/r713_source_inventory.json` ile `r713_changes.diff` içinde yer alır. Mevcut özelliklerin fiziksel cihazda uçtan uca doğrulandığı iddia edilmez.

## Doğrulama sonuçları

| Denetim | Sonuç |
|---|---:|
| Kandil, Stop/Pause ve tanı odaklı testleri | 13/13 |
| Mevcut kaynak regresyonları | 31/31 |
| Atmosfer regresyonları | 15/15 |
| Gerçek HTML etkileşim/ses simülasyonu | 8/8 |
| Bağımsız 15 saniyelik bekleme testleri | 2/2 |
| Beş ekran boyutunda yerleşim | 40/40 |
| Kaynak ve yayın bütünlüğü | 8/8 |
| **Toplam kontrollü kontrol** | **117/117** |

Bu kategoriler kısmen örtüşür; toplam bağımsız hata sayısı veya cihaz güvencesi değildir. İlk 11 odaklı kontrol özgün r712 üzerinde başarısız olarak yeniden üretildi. Son sürümde bunlara iki ek terminal niyet senaryosu eklendi. Gerçek HTML'de 20 native dokunma, sayaç/geri alma, hedef ve devir, sessiz sayaç uzlaştırması, ses durumu simülasyonu ve Tefekkür çıkışı geçti. İki bağımsız 15 saniyelik beklemede olay fırtınası görülmedi. Beş ekran boyutunda Mini/Midi/Max yerleşimleri ve çıkış hit-testleri geçti.

### Testlerin sınırı ve açık noktalar

Birleşik tarayıcı koşuları bazı aşamalarda süre sınırına takıldı; bu koşular başarılı sayılmadı. Tamamlanan senaryolar bağımsız işlemlerde tekrarlandı. Chromium HTML testleri yerel `set_content`, engellenmiş ağ ve veri URI'si sanat varlıklarıyla yürütüldü. Sesin fiziksel durumu simüle edildi. Gerçek Android'de kendi kayıt/TTS, mikrofon, kulaklık, telefon çağrısı, ekran kilidi ve uzun 28/99 Seyir geçişleri bu oturumda uçtan uca doğrulanmadı. Dolayısıyla bütün kilitlenmelerin kesin bittiği söylenemez. Raporlanan uzun görevlerin gerçek modül kaynağı da henüz ölçülmüş bir stack trace ile belirlenmedi.

## Yayın, yedek ve geri dönüş

HTML meta/footer, gömülü ve harici sürüm geçmişi, manifest, SW ve yapı işaretçisi r713 ile eşleştirildi. Önbellek: `sukun-r713-20260908a`. PWA kimliği `./nero.html` olarak korunur. Yeni IndexedDB veya kullanıcı verisi silme işlemi yoktur. Önceki r712 kaynak paketi değiştirilmedi ve geri dönüş tabanı olarak saklanmalıdır.

Kurulumdan önce Amel Defteri'nden yedek alın. ZIP içindeki `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, `assets`, ikonlar ve `__sukun_build_r713__.json` dosyasını aynı yayın dizinine birlikte yükleyin. Yalnız HTML'yi değiştirmek PWA güncellemesi için yeterli değildir. Güncellemeyi etkinleştirip yeniden açın; gerekirse `nero.html?v=r713` ile güncel HTML isteyin. Tarayıcı verilerini silmeyin. Bu oturumda canlı GitHub dağıtımı yapılmadı.

`diagnostics` klasöründe özgün hata kanıtının kişisel içerik içermeyen özeti, kaynak farkları, test dosyaları ve sonuçlar bulunur. Tek HTML yalnız görsel varlıkları gömer; tam çevrimdışı PWA kurulumu için ZIP kullanılmalıdır.
