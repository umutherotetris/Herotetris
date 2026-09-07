SÜKÛN r699 — Voice Transaction Integrity
7 Eylül 2026

Bu paket r698 üzerine uygulanmış tam uygulama kaynaklarını içerir. Orijinal r698 paketi değiştirilmedi.

Kurulum: nero.html, sw.js, manifest.webmanifest, surumler.json, build işaretçisi ve üç ikon dosyasını aynı dizine birlikte yükleyin. Eski dosyaların yalnız bir kısmını değiştirmeyin. HTTPS üzerinden yeni service worker etkinleşip uygulama yenilendikten sonra alt sürüm etiketinin r699 olduğunu doğrulayın. Tarayıcı verilerini veya kullanıcı kayıtlarını silmeyin.

Düzeltme: Sesli doğrudan zikirde sayım ve hedef geçişi okuma başarı sertifikasına bağlandı. Stop/abort eski ses callbacklerinin yeni oturuma müdahalesini engeller. Başarısız sayım yalnız kendi kesin deltasını geri alır; arada yapılan kullanıcı değişikliklerini ezmez. Pause/resume bekleyen sesin sahipliğini korur. Seyir, gizli sayaç, kayıt önceliği ve r698 görsel düzeni korunmuştur.

Doğrulama: 10 izole yarış testi, 39/39 yerleşik regresyon kontrolü, 182 JavaScript sözdizimi kontrolü ve Chromium başlangıç testi geçti. Fiziksel Android'de kilit ekranı, telefon görüşmesi, kulaklık ve uzun seyir testleri yapılmadığından bunların geçtiği iddia edilmez.

QA dizininde rapor ve yeniden çalıştırılabilir kaynak testleri bulunur. Tarayıcı smoke testi yerel Playwright/Chromium gerektirir.
