# SÜKÛN r729 — Görsel hareket tercihi ve ambiyans açıklığı

Temel: Kullanıcının yüklediği r728. Tarih: 9 Eylül 2026.

## Düzeltilen hata
Pil profili veya sistemin azaltılmış hareket tercihi etkinken Canlı/Sabit düğmesine dokunmak, kayıtlı hareket seçimini zorla still olarak kaydediyordu. Geçici kısıt kalktıktan sonra da hareket kapalı kalabiliyordu.

Artık kısıt altındaki dokunma yalnızca nedeni bildirir ve mevcut durumu eşitler; tercihi veya depolamayı değiştirmez. Kısıt kalkınca kullanıcının önceki seçimi geçerlidir. Kullanıcı özellikle Sabit seçmişse o seçim de korunur. Kısıt yokken normal Canlı/Sabit geçişi kaydedilmeye devam eder.

## Kullanım açıklığı
- Hareket düğmesinin başlığında ve erişilebilir adında geçici kısıtın nedeni gösterilir.
- Görsel ambiyans çubuğunun yüzde değeri aria-valuetext ile ilk açılışta ve her input olayında güncellenir.
- Çubuk açıklaması bunun görsel yoğunluk olduğunu, ses seviyesini değiştirmediğini belirtir.
- Kompakt bar ölçüleri ve bütün CSS r728 ile aynı bırakıldı.

## Kontroller
51 kaynak/VM kontrolü geçti: 31 genel regresyon, 20 ambiyans davranış kontrolü. Bunların beşi yeni hata ve tercih korunması senaryolarıdır. Geçici pil kısıtı, azaltılmış hareket, kullanıcı tarafından seçilmiş Sabit, normal geçiş ve yüzde açıklaması kontrol edildi.

Kaynak karşılaştırması: davranışı değişen tek modül r706-atmosphere-runtime. Diğer değişiklikler sürüm kimliği ve notlarıdır. r728 containment, dock/modal, sayaç, kayıt, seyir ve pause/resume kodları korunur. CORE ve OPTIONAL listeleri r728 ile birebir aynıdır. Yerel SW asset yolları, sürüm/manifest/SW eşleşmesi, ZIP CRC ve SHA-256 doğrulandı.

Bu turda canlı tarayıcı, ekran okuyucu, fiziksel Android, mikrofon, kulaklık veya kilit ekranı testi yapılmadı. Paketteki r728 tarayıcı raporları önceki sürümden devralınmış tarihçedir; r729 için yeni tarayıcı kanıtı değildir.

## Açık konular
r728 raporundaki DOM hydration uzun görevleri, voice-false/restored:false olayının saha araştırması ve 28/99 Seyri kilit ekranı testleri bu sınırlı düzeltmeyle çözülmüş sayılmaz.
