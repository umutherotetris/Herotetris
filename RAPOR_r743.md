# SÜKÛN r743 — Yedekleme ve duraklatma düzeltmeleri

Temel: r742 · Tarih: 9 Eylül 2026

## Bulunan ve düzeltilen hatalar

**Eksik yedeğin başarılı görünmesi.** IndexedDB açma/okuma hataları ve okunamayan ses Blob'ları boş veri gibi döndürülüyordu. Engellenmiş açılış, yalnız `abort` olayı ve işlem başlatma istisnası bazı vaatleri sonuçsuz bırakıyordu. Artık hata çağırana iletilir; bağlantı kapatılır, önizleme ve dışa aktarma eksik kayıtlarla başarılı sayılmaz. Hiç kayıt deposu olmayan yeni kurulum geçerli boş yedek üretmeye devam eder.

**Geri yüklemede yanlış başarı ve kısmi ayar yazımı.** Ses yazımındaki senkron istisna artık tek kayıt atlanarak geçilmez; o deponun yazma işlemi iptal edilir. Asenkron hata, iptal ve çözümlenemeyen ses verisi başarısızlık olarak döner. Ayarların tamamı yazılmadan önce doğrulanır. Ayar yazımı kota hatası verirse aynı işlemde yazılan ayarlar önceki değerlerine döndürülür; geri alma başarısızsa bu da açıkça bildirilir. Geri yükleme ekranı başarısızlıkta başarı mesajı göstermez ve uygulamayı yeniden yüklemez.

**Yedekte eksik içerik ve tercihler.** Kayıtlı seanslar, favori seanslar, 99 Esmâ seyri ilerlemesi ve kullanılan yeni görünüm/akış barı/ses efekti tercihleri açık izin listesine eklendi. API anahtarları, tanılama ve oturuma özel izinler yedeğe eklenmez. Kilitli içerik için mevcut süzme kuralları kullanılır. Eski ayar yedekleri, normal sesler, özel ambiyans ve hibrit ambiyans biçimleri korunur.

**Genel duraklatmayı aşan yeni okuma.** Kuyruk boş ve ses sahibi yokken `AudioResolver` veya doğrudan terkip isteği genel duraklatma durumunu kontrol etmeden başlayabiliyordu. Artık bu istekler de bekler. Devam komutu sırayı yürütür; Durdur bekleyen istekleri iptal eder. Aktif 28/99 seyirlerinin kendi ses sahipliği değiştirilmedi.

## Doğrulama

105 kaynak/VM kontrolünün tamamı geçti: önceki 82 kontrol ve 23 yeni kontrol.

- source: 31/31 geçti.
- mini: 5/5 geçti.
- restart: 10/10 geçti.
- failure: 8/8 geçti.
- transport: 7/7 geçti.
- ring: 6/6 geçti.
- audit: 15/15 geçti.
- storage: 15/15 geçti.
- settings_queue: 8/8 geçti.

İlk depolama taramasında 15 senaryonun 12'si r742'de başarısız oldu. Depolama düzeltmesinden sonra eklenen 8 kapsam/kuyruk kontrolünün 4'ü, ilgili düzeltmeler yapılmadan önce başarısız oldu. Başlangıç sonuçları ve son sonuçlar `diagnostics/r743` içinde yer alır; bu iki başlangıç dosyası aynı kod anına ait değildir.

Yeni testler gerçek kaynak fonksiyonlarını kontrollü IndexedDB, FileReader, depolama ve olay modellerinde çalıştırır. Senkron yazma hatası, asenkron kota hatası, engellenmiş açılış, yalnız iptal olayı, bozuk ses çözümlemesi, ayar geri alma, başarısız geri yüklemede ekran davranışı, yedek gidiş/dönüşü, duraklatmada yeni istek ve FIFO devamı sınanır. Bunlar fiziksel IndexedDB veya gerçek ses testleri değildir.

190 çalıştırılabilir HTML modülü ve Service Worker sözdizimi kontrolünden geçti. Yerel varlık referansları, statik kimlikler, manifest kimliği/kapsamı, HTML/SW sürüm eşleşmesi ve build karmaları kontrol edildi. Stil blokları ve görsel dosyaları r742 ile aynı. r742'nin eski ses sonucu, durdurma bariyeri, SVG simgeleri ve önbellek indirme düzeltmeleri korunur. ZIP CRC ve paketteki dosyaların SHA-256 değerleri doğrulandı.

## Doğrulama sınırları

r743 için gerçek tarayıcı yerleşimi, fiziksel Android, kullanıcı kaydı, TTS, kulaklık veya kilit ekranı testi yapılmadı. Önceki sürümlerden gelen tarayıcı kanıtları r743'te yeniden çalıştırılmış sayılmaz. Her olası hatanın giderildiği iddia edilmez.

Geri yükleme farklı IndexedDB veritabanları ve localStorage arasında tek atomik işlem değildir. İlk ses deposu tamamlanıp ikinci depo başarısız olursa ilkinde aktarılan kayıtlar kalır; ekran aktarılan sayıyı ve eksik kalan işlemi bildirir, uygulamayı yeniden yüklemez. Bir deponun yazım hatasında kendi işlemi iptal edilir. Ayar geri alma güvencesi depolamanın geri yazmaya izin vermesine bağlıdır; aksi durum hata mesajında belirtilir.

r740'a ait dört eski `.json` tanı dosyası düz metin konsol günlüğüdür. Tarihsel kanıtın içeriği korundu; yeni sonuç dosyaları geçerli JSON'dur. Canlı siteye dağıtım yapılmadı.

## Yeniden çalıştırma

Paket klasöründe `node diagnostics/r743/test_all.cjs` çalıştırılır. `SOURCE_DIFF.patch` r742'ye göre değişiklikleri gösterir. `patch.py` ve `release.py`, kaynak r742 ZIP yolu verilerek yeniden üretilebilir. r742 sürüm metaverileri `diagnostics/history/r742_release` altında korunur.
