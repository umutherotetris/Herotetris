# 🎮 Hero Tetris Ultra — APK Build & Play Store Rehberi

## Yöntem: TWA (Trusted Web Activity)

GitHub Pages siteni Android uygulamasına sarar. Chrome motoru kullanır, tüm özellikler çalışır.

---

## Gereksinimler

- Android telefon (Termux kurulu)
- Node.js (Termux'ta)
- GitHub Pages aktif: `https://umutherotetris.github.io/Herotetris/`
- Google Play Developer hesabı (tek seferlik 25$)

---

## ADIM 1: Termux Kurulumu

```bash
# Paketleri güncelle
pkg update && pkg upgrade -y

# Node.js kur
pkg install nodejs -y

# Java kur (imzalama için)
pkg install openjdk-17 -y

# Bubblewrap kur (Google'ın TWA aracı)
npm install -g @nicolo-ribaudo/bubblewrap
```

## ADIM 2: TWA Projesi Oluştur

```bash
# Proje klasörü
mkdir ~/hero-tetris-app && cd ~/hero-tetris-app

# Bubblewrap init
bubblewrap init --manifest https://umutherotetris.github.io/Herotetris/manifest.json
```

**Sorular gelecek, şöyle cevapla:**

| Soru | Cevap |
|------|-------|
| App name | Hero Tetris Ultra |
| Short name | HeroTetris |
| App URL | https://umutherotetris.github.io/Herotetris/ |
| Status bar color | #090912 |
| Nav bar color | #090912 |
| Theme color | #00E5FF |
| Background color | #090912 |
| Icon | (varsayılan veya kendi ikonun) |
| Signing key | Yeni oluştur |

## ADIM 3: APK Build

```bash
# APK oluştur
bubblewrap build

# Çıktı: app-release-signed.apk
ls -la *.apk
```

## ADIM 4: Test Et

```bash
# Telefonuna kopyala
cp app-release-signed.apk /sdcard/Download/

# Dosya yöneticisinden aç ve kur
```

---

## ADIM 5: Play Store'a Yükleme

### 5.1 Developer Hesabı
1. https://play.google.com/console adresine git
2. 25$ ödeyerek hesap oluştur
3. Kimlik doğrulama (1-2 gün sürebilir)

### 5.2 Uygulama Oluştur
1. "Create app" tıkla
2. Bilgileri doldur:
   - App name: **Hero Tetris Ultra**
   - Language: Türkçe
   - App or game: **Game**
   - Free or paid: **Free**
3. Content rating soruları cevapla
4. Target audience: 13+

### 5.3 Store Listing (Mağaza Sayfası)

**Başlık:** Hero Tetris Ultra

**Kısa açıklama:**
```
Süper kahramanlarla Tetris! 5 karakter, 8 dünya, online multi, turnuva ve daha fazlası!
```

**Uzun açıklama:**
```
🎮 Hero Tetris Ultra — Tetris'i yeniden keşfet!

🦸 5 Süper Kahraman: Superman, Spiderman, Krypto, Batman, Flash
⚡ Her karakterin özel güçleri ve pasif yetenekleri var
🗺️ 8 Dünyalık macera modu + epik boss savaşları
🌐 Online multiplayer + global chat
🏟️ Turnuva modu (4-8 kişi)
🪙 Kaju ekonomisi, ödül çarkı, mağaza
🎫 Battle Pass, sezon sistemi
🃏 24 kartlık koleksiyon
🎪 3 mini oyun
📊 Detaylı istatistik ve analitik
🏰 Klan sistemi
📅 Günlük görevler ve giriş ödülleri

Ücretsiz, reklamsız, tamamen offline oynanabilir!
```

### 5.4 Ekran Görüntüleri
- Minimum 2 ekran görüntüsü gerekli
- Önerilen boyut: 1080x1920 (telefon dikey)
- Menü, oyun içi, karakter seçimi, profil ekranlarından al

### 5.5 APK Yükle
1. Production → Create new release
2. APK veya AAB dosyasını sürükle
3. Release notes yaz: "İlk sürüm — v43"
4. Review and publish

---

## ALTERNATİF: PWA Olarak Dağıtım

APK yapmadan da oyunu dağıtabilirsin:

1. Kullanıcılar linki açar: `https://umutherotetris.github.io/Herotetris/`
2. Chrome → ⋮ menü → "Ana ekrana ekle"
3. Uygulama gibi çalışır (tam ekran, ikon)
4. Offline destek PWA service worker ile

---

## Manifest Dosyası (Gerekirse)

GitHub repo'na `manifest.json` ekle:

```json
{
  "name": "Hero Tetris Ultra",
  "short_name": "HeroTetris",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#090912",
  "theme_color": "#00E5FF",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Digital Asset Links (TWA için zorunlu)

GitHub repo'na `.well-known/assetlinks.json` ekle:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "io.github.umutherotetris.herotetris",
    "sha256_cert_fingerprints": ["BURAYA_SHA256_FINGERPRINT"]
  }
}]
```

SHA256 fingerprint almak için:
```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android
```

---

## Sorun Giderme

| Sorun | Çözüm |
|-------|-------|
| Bubblewrap bulunamıyor | `npm install -g @nicolo-ribaudo/bubblewrap` |
| Java bulunamıyor | `pkg install openjdk-17` |
| APK kurulmuyor | Ayarlar → Bilinmeyen kaynaklar → İzin ver |
| Chrome bar görünüyor | Digital Asset Links doğru ayarlanmamış |
| Firebase çalışmıyor APK'da | Authorized domains'e package name ekle |

---

*Hero Tetris Ultra v43 — Mart 2026*
