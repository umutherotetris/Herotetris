# SÜKÛN r757 — r756 + r744 birleşimi / Feyz Nur

Temel: gönderilen SUKUN_r756_TAM_PAKET.zip. Önceki çalışma: r744.
Karşılaştırma r756'nın r741 çekirdeğinden ayrıldığını gösterdi; r742–r744
onarımları r756'nın sonraki içerik ve görsel eklerine taşındı.

## Korunanlar

- r746/r747 kart geliştirmeleri, r749 Esmâ kaynak veri kümesi, Berhetiyye
  kaynakları ve r754 kaynak sıçramaları korundu.
- Esmâ kaynak veri modülü ve 31 eski görsel dosyası byte düzeyinde aynı.
- 15 sayfalık Berhetiyye atlası kurulumda ön yüklenmez; erişim kapısı korunur.

## Birleştirilen düzeltmeler

- Ana sayaçta yatay isim başlığı, çember altında yan yana Hedef/Kalan,
  kompakt kontroller ve gizli oynatıcı dönüş düğmesinin viewport sınırı.
- Tanıda eski API sürümüne bağlı yanlış hata yerine gerçek yetenek denetimi.
- Kayıt stüdyosunda seçilen kaydın değişmesi, eşzamanlı kayıt hazırlığı,
  boş/hatalı ses, mikrofon temizliği, stereo kırpma ve tepe analizi korumaları.
- Eski ses sonucunun yeni esmâyı etkilemesini engelleyen seçim kimliği,
  durdurma hatasında yeni başlatmayı bekleten kapı ve sabit taşıma simgesi.
- Yedekleme/geri yüklemede tamamlanma ve hata bildirimi, kaydedilen
  ayarların kapsamı; SW yenilemelerinde tek indirme ve ön doğrulama.

## Bu birleşimde giderilen yeni sorunlar

- r756 başlığında başka bir modülün kapalı kapsamındaki zikirTabActive()
  çağrısı vardı. Başlık kendi görünürlük sözleşmesine geri alındı.
- Berhetiyye kartı kendi DOM değişikliklerini gözleyip yeniden üretiyordu.
  Zengin içerik artık açılmadan önce ana çizici tarafından tek aşamada hazırlanır.
  Sayaç sayısının değişmesi aynı açıklamayı yeniden üretmez.
- Kaynak görüntüleyicide her sayfa değişimi eski overflow değerinin üzerine
  hidden yazıyordu. İlk açılış değeri ve önceliği artık bir kez saklanır.
- Sayfa geçişindeki biriken load dinleyicileri ve aynı animasyonu ikinci kez
  başlatan güvenlik zamanlayıcısı iptal edilebilir tek geçişle değiştirildi.
- Escape yalnız üstteki görüntüleyiciyi veya bilgi kartını kapatır;
  arkadaki Tefekkür görünümüne geçmez.
- Azaltılmış hareket ayarında kartın opacity:0 kalması düzeltildi.
- Geç kaynak bağlantılarında kilit yeniden denetlenir, kapanınca resim src'si silinir.
- Manifest bağlantısı, geçmişin v/t/b sözleşmesi, HTML, SW ve build işareti eşitlendi.

## Görsel geliştirmeler

- Ayrıntılı, yazısız Nur sahnesi tüm Feyz yüzeyine yayıldı; sayaç kartının
  aynı sahneyi yeniden döşemesi kaldırıldı. Cam yüzeyler inceltildi.
- 1254 × 1254 işlemeli PNG çember, bağımsız iki vektör ışık katmanı ve canlı
  sayaç DOM'u birleştirildi. PNG kaynakları yeniden sıkıştırılmadı.
- Altın/camgöbeği detaylar, SVG unsur simgeleri ve yatay kaydırılabilir
  yedi basamak görünümü Berhetiyye bilgi kartına uygulandı.
- Kaynak görselleri, üretim istemleri ve teknik açıklama design/ içindedir.

## Doğrulama

- source: 31/31
- mini: 5/5
- restart: 10/10
- failure: 8/8
- transport: 7/7
- ring: 6/6
- audit: 15/15
- storage: 15/15
- settings_queue: 8/8
- studio: 19/19
- ui: 13/13
- visual_sources: 18/18

Toplam 155/155 kaynak/VM kontrolü geçti. Benzersiz HTML kimlikleri,
yerel varlık yolları, JS sözdizimi, paket CRC ve SHA-256 bütünlüğü denetlendi.
CSS bloklarının yapısal dengesi kontrol edildi; hesaplanmış tarayıcı yerleşimi
bu testlerin kapsamına girmez.

Bu çalışma sırasında tarayıcı görsel testi veya fiziksel Android testi
yapılmadı. Gerçek FPS, ses çıkışı, mikrofon, kulaklık ve kilit ekranı
deneyimi doğrulanmadı. PNG dosyası kaliteli bir tasarım kaynağıdır;
tek başına çalışan arayüzü veya animasyon akıcılığını kanıtlamaz.
Canlı siteye yayımlama yapılmadı.
