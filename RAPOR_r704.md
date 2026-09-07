# SÜKÛN r704 — hata düzeltme ve doğrulama raporu

7 Eylül 2026 · Taban: kullanıcı tarafından sağlanan `SUKUN_r703_TAM_PAKET.zip`.

r703 üzerine doğrulanmış DOM, açılış ve duraklatma düzeltmeleri uygulandı. Bu paket tek dosyalı uygulama yapısını korur. “Bütün cihazlarda tüm hatalar giderildi” sonucu çıkarılmamalıdır; aşağıda tamamlanan kontroller ve kapsam sınırları ayrıdır.

## Düzeltilenler

1. **Duraklatılan sayacın devam bilgisi kayboluyordu.** Otomatik sayacı askıya almak için çağrılan iç `autoStop`, 20 ms sonraki bildiriminde kullanıcı duraklatmasını temizliyordu. Ayrıca eski `r438` ses onarımı, fiziksel ses kalmadığında duraklatılmış sayacı da bitmiş oturum sayıp `MINI.paused` ve `MINI.wasAuto` değerlerini siliyordu. Her iki yol, saklanan duraklatma durumunu artık korur; terminal uzlaştırma da yeni bir duraklatmayı ezmez. Gerçek Durdur komutu durumları temizlemeyi sürdürür.

2. **r703 genel DOM müdahalesi tarayıcı sözleşmelerini bozuyordu.** `Element`, `Node`, `HTMLElement` ve `DOMTokenList` prototiplerine yapılan değişiklik kaldırıldı. `hidden="until-found"`, boş/boşluklu sınıf adlarının doğrulanması, `Symbol` değeri için hata üretimi ve attribute adının bir kez dönüştürülmesi doğal davranışına döndü. Gereksiz yazımlar uygulamanın Tefekkür, seyir kartı, sekme, bildirim ve tema kodlarında yerel olarak önlenir.

3. **Tema rengi gereksiz stil hesabı yaptırıyordu.** Kaynak CSS'de gövde arka planını seçen `data-tema` izlenir. Oynatma, Tefekkür ve bar boyutu sınıfları artık tema rengini yeniden hesaplattırmaz. 100 ilgisiz sınıf değişimi ve gerçek tema değişimi ayrı ayrı sınandı.

4. **Açılışta kullanılmayan işler çalışıyordu.** Açılış perdesinin zamanlayıcısı boşta ses motoru kuramaz veya askıdaki bağlamı sürdüremez. Dokunma ve zamanlayıcının aynı gongu iki kez çalması önlendi. Tekke/NeuroSync için 1,5 ve 3 saniye sonra yapılan zorunlu panel kurulumu kaldırıldı; mevcut `open` ve nefes egzersizi girişleri gerektiğinde fabrikayı kurar. İlk açılışta kurulum maliyeti ilgili panele taşınır.

5. **Eski günlük kartı açılış hatası veriyordu.** Karşılaştırma tarayıcısında `dailyShow` içinde `Cannot set properties of null (setting 'textContent')` yakalandı. Gecikmeli çağrı, kart ve iki metin alanı mevcutsa çalışır. Eksik karta yazmaz veya gösterilmemiş içeriği görülmüş diye kaydetmez.

6. **Yinelenen arayüz işi ve yanlış sürüm sonucu.** Seyir kaynak gözlemcisi aynı karedeki yenilemeleri birleştirir; aynı tema tercihi yeniden olay yayımlamaz. Sürüm denetimi artık okunamayan/HTTP hatası dönen yapı işaretçisini ve eski Service Worker'ı başarılı göstermez.

## Doğrulama

- **51/51 kaynak regresyonu geçti.** Aynı genişletilmiş testler r703 üzerinde 37/51 geçti; 14 kontrol başarısız oldu. Bunlar izole JavaScript ortamında gerçek kaynak fonksiyonlarını çalıştırır; cihaz testi değildir.
- **6/6 izole doğal DOM tarayıcı kontrolü geçti.** r703 genel müdahalesi aynı altı kontrolden beşini bozuyordu.
- **Canlı akış:** 390×844 görünümünde Tefekkür açıldı, sayaç başlatıldı ve 13'te duraklatıldı. Duraklatmadan 42 saniye sonra, Mini/Midi/Max geçişleri boyunca sayaç 13 ve Devam Ettir düğmesi görünür kaldı. Devam ettirilince 24'e ilerledi; Durdur sonrasında 28'de sabit, ses yaşam döngüsü `idle`, tüm duraklatma bayrakları kapalı bulundu. Tefekkürden çıkış çalıştı. Tekke panelinin ilk kullanımda açılması ve kapatılması ayrıca tarayıcıda doğrulandı.
- 183 çalıştırılabilir satır içi betik ve Service Worker sözdizimi temiz. 960 statik kimlikte tekrar ve yerel dosya bağlantılarında eksik bulunmadı. 148 CSS bloğu ve üç ikon r703 ile aynı. Sürüm geçmişi 229 kayıt; r703'ün önceki 228 kaydı korunur.
- HTML, manifest, Service Worker, sürüm notları ve `__sukun_build_r704__.json` aynı sürümü gösterir.

## Açılış ölçümü

| Ölçüm | r703 | r704 |
|---|---:|---:|
| DOMContentLoaded | 8,71 sn | 2,41 sn |
| load | 10,39 sn | 3,31 sn |
| İlk 40 sn içindeki uzun görevlerin toplamı | 8.023 ms | 2.228 ms |
| En uzun görev | 1.466 ms | 485 ms |
| Son uzun görevin başlangıcı | 11,89 sn | 3,97 sn |
| Yakalanan açılış JavaScript hatası | 1 — dailyShow | 0 |

Bu, aynı yönetilen masaüstü Chromium ortamında 390×844 iframe içinde, uygulamaya dokunmadan alınan birer 40 saniyelik gözlemdir. Önbellek, kayıtlı tercihler ve ortam yükü nedeniyle kontrollü bir cihaz kıyaslaması sayılmaz. Uzun görev toplamı CPU profilinin toplamı değildir; bu ölçümden genel bir hızlanma yüzdesi çıkarmıyorum. Ham sonuçlar `diagnostics/r704_browser_results.json` içindedir.

r703 raporundaki `(program)` kaleminin tamamını ayrıştırma/derleme süresi saymak, tek başına bu etiketten kanıtlanamaz. Bu sürümde gözlenen gereksiz işler somut çağrı yerlerinde azaltıldı. İlk ekranın ağır tek dosya yapısı devam eder; donmanın bütün koşullarda bittiği iddia edilmez.

## Kapsam sınırları

Tarayıcı otomasyonundaki bazı tıklamalar 3 saniyelik iç süre sınırına takıldı; görünür kontrol tekrar denenerek akış tamamlandı. Bu nedenle tüm arayüz işlemleri için kesintisiz yanıt garantisi verilmez. Gerçek Android/Samsung Internet, mikrofon, kullanıcı kayıtları, duyulan ses kalitesi, kulaklık tuşları, kilit ekranı ve uzun süreli çalma denenmedi. PWA önbellek ve güncelleme sözleşmesi kaynak testleriyle doğrulandı; HTTP iframe oturumu, kurulu PWA veya gerçek çevrimdışı cihaz testi yerine geçmez.

## Paketi kullanma ve testleri tekrarlama

Arşivi çıkarın; `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, üç ikon ve yapı işaretçisi aynı dizinde kalsın. Mevcut web kurulumunda bu dosyaları birlikte güncelleyin. Bu çalışma bir sunucuya dağıtım yapmadı.

Paket kökünde:

```sh
node diagnostics/test_r704.cjs .
sha256sum -c CHECKSUMS_r704.sha256
```

`diagnostics/test_dom_r704.html` tarayıcıda açılarak izole DOM karşılaştırması tekrarlanabilir. Sonuçlar, statik denetim ve r703→r704 kaynak farkı `diagnostics/` içindedir. Eski raporlar ve önceki ölçüm betikleri `diagnostics/history/` altında sürüm bağlamlarıyla korunmuştur; güncel başarı sonucu sayılmazlar.
