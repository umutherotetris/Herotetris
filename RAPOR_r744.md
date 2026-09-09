# SÜKÛN r744 — Ana sayaç düzeni ve kayıt güvenliği

Taban: r743. Sürüm tarihi: 9 Eylül 2026.

## Ana zikir ekranı

- Seçili isim, ana sayaçta da Tefekkür ile aynı başlık yapısını kullanır. Eski beş sütunlu yerleşimin yeni başlığı dar bir sütuna sıkıştırması giderildi. İsim harf ortasında bölünmez; uzun adlar mevcut ölçümle küçülür, gerektiğinde sözcük sınırından sarılır.
- Çember üstte; Hedef ve Kalan, altında iki eşit sütunda. Eski üç sütunlu ana düzenle Tefekkürden kalan çocuk konumlarının çakışması kaldırıldı.
- Ana sayaç rakamları Tefekkürdeki Georgia yazı tipi ve düzenli rakam biçimiyle gösterilir. Ana kontrol satırı kompakt, yan düğmeler 44 px tabanındadır.
- Seçim, hedef ve sayaç değerleri görünüm geçişlerinde değiştirilmez. Kilitli özel isimlerin gizlilik denetimi korunur.

## Kullanıcının r743 tanı kaydı

İncelenen dosya: `sukun-diagnostics-r743-2026-09-09T20-19-06-119Z.json`.

- Güvenli tanı kümesinde 27 kontrolden 26'sı geçmiş, bir tam ekran kontrolü başarısız olmuş. JavaScript çalışma hatası kaydedilmemiş. HTML ve Service Worker r743 olarak eşleşiyor; önbellek tamamlanmış.
- Tam ekran kontrolü gerçek API `r702` olmasına rağmen tam olarak `r530` bekliyordu. Kontrol artık yöntemleri, iki farklı seçeneği ve seçili tercih tutarlılığını doğrular. Eksik yöntem veya bozuk tercih hâlâ hata üretir.
- “Oynatıcıyı göster” kapsülünün görünür alttan 104,8 px taştığı kaydedilmiş. Mevcut yerleşim sahibi artık gizli oynatıcı dönüş düğmesini gerçek dikdörtgeniyle görünür alana oturtur. Kaydırma ve dokunma sırasında mevcut işlem ertelemesi korunur; yeni gözlemci veya sürekli döngü eklenmez. Farklı anlarda güncellenen viewport ölçümleri olası neden olarak test edildi; cihazdaki kesin neden için tarayıcı iz kaydı yoktur.
- Ana sayaç yerleşimi tanıya eklendi. Hedef/Kalan'ın çemberin altında aynı satırda olması ve ismin başlık alanına sığması ölçülür. Ana sayaç gizliyse bu kontrol atlanır.
- Uzun görevler ve geçmişte 6004 ms ana iş parçacığı gecikmesi görülmüş. Dosya çağrı yığını içermiyor; bu gecikmenin kök nedeninin çözüldüğü iddia edilmiyor. Olay fırtınası kaydedilmemiş.

Özet bulgular ve kaynak dosyanın SHA-256 değeri `diagnostics/r744/user_diagnostic_findings.json` içindedir. Kişisel tanı dosyasının tamamı dağıtım paketine kopyalanmadı.

## Kayıt stüdyosu

- Normalleştirme/kırpma başladığı kaydın anahtarını korur. İşlem sırasında başka kayıt seçmek, ilk kaydın sesini ikinci kaydın üzerine yazamaz.
- Geç tamamlanan analiz ve kayıt listesi güncellemeleri yeni seçimi veya dalga görünümünü geri çeviremez. Aynı anda ikinci düzenleme engellenir.
- Kayıt hazırlığına yeniden dokunmak hazırlığı iptal eder. Geç gelen mikrofon izni iptal edilmiş oturuma aitse akış serbest bırakılır.
- Kayıt parçaları, mikrofon ve önizleme kaynakları kendi oturumuna aittir. Eski kaydın durma olayı yeni kaydın kaynaklarını kapatamaz; yeni kayıt önceki saklama işlemini bekler.
- Boş veya hata veren kayıt mevcut sesin üzerine yazılmaz. Saklama hatası başarı mesajıyla örtülmez; denetimler yeniden kullanılabilir olur.
- Dalga önizlemesi kurulamazsa çalışan ses kaydı korunur. Kurulum/çalışma hatalarında mikrofon izleri kapatılır.
- Sessizlik kırpma ve dalga görünümü tüm kanalları dikkate alır. Yalnız sağ kanaldaki ses korunur; tamamen sessiz kayıt kısa bir kuyrukla değiştirilmez.
- Normalleştirme öncesi örnek tepe değeri her ses örneğinden hesaplanır; önceki seyrek örneklemenin kaçırdığı kısa tepe seslerinin yol açtığı kırpılma önlenir. Bu, örnekler arası “true peak” ölçümü değildir.

## Doğrulama

137 kaynak/VM kontrolü geçti:

- source: 31/31 geçti.
- mini: 5/5 geçti.
- restart: 10/10 geçti.
- failure: 8/8 geçti.
- transport: 7/7 geçti.
- ring: 6/6 geçti.
- audit: 15/15 geçti.
- storage: 15/15 geçti.
- settings_queue: 8/8 geçti.
- studio: 19/19 geçti.
- ui: 13/13 geçti.

Yeni stüdyo kümesi 19, UI/tanı kümesi 13 kontroldür. Stüdyonun ilk 15 kontrolünden 14'ü r743'te başarısızdı. UI kümesinin r743 sonuçları da paket içindedir; yeni koruma/kontrol bulunmaması nedeniyle başarısız olan maddeler mevcut işlev hatalarından ayrı okunmalıdır.

Testler paket içindeki gerçek JavaScript modüllerini Node VM'de çalıştırır. Kontrollü DOM, ses, mikrofon, IndexedDB ve CacheStorage örnekleri kullanılır. WAV çıktı örnekleri çözümlenerek incelenir. Eski durdurma bariyeri, kayıt önceliği, sayaç-ses kredisi, 28/99 seyir, yedekleme/geri yükleme ve Service Worker kontrolleri yeniden çalıştırılmıştır.

Gerçek tarayıcı, Android telefon, mikrofon, TTS, kilit ekranı veya kulaklık testi bu sürümde yapılmadı. UI kontrolleri kaynak/DOM geometrisi örneklerine dayanır; yeni ekranın piksel görünümü gerçek cihazda doğrulanmış değildir. Önceki sürümlerin tarayıcı kayıtları tarihsel kanıttır.

169 stil bloğundan yalnız `r740-canonical-name-style` değişti. 16 görsel/ikon dosyası korundu. Davranış değişiklikleri dört mevcut modülde; sürüm notları ve kimliği ayrıca güncellendi. Kesin kimlik, dosya ve bütünlük sayıları `SUKUN_r744_RELEASE.json` içindedir. ZIP CRC ve dosya SHA-256 denetimi yapıldı.

## Paket kullanımı

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, `__sukun_build_r744__.json` ve `assets/` birlikte yayımlanmalıdır. Kök paket yapısı korunur. Otomatik dağıtım yapılmadı.

Düzeltmeyi r743 tabanından yeniden üretmek için:

```sh
python3 diagnostics/r744/patch.py /tam/yol/SUKUN_r743_TAM_PAKET.zip
python3 diagnostics/r744/ui_patch.py
python3 diagnostics/r744/release.py prepare /tam/yol/SUKUN_r743_TAM_PAKET.zip
node diagnostics/r744/test_all.cjs
python3 diagnostics/r744/release.py package /tam/yol/SUKUN_r743_TAM_PAKET.zip
```

`patch.py` yalnız HTML'yi r743 tabanından yeniden üretir. `ui_patch.py` bu taban yamasından sonra bir kez uygulanır. Ardından sürüm hazırlama, test ve paketleme sırası izlenir. Test edilmiş dosyalar değişirse paketleme durur.
