# Hero Portal Android

`tr.heroyun.portal` · sürüm 1.59 (kod 159) · Android 6.0 ve üzeri.

Bu APK, Hero Portal'ın canlı HTTPS sürümünü Android'den açar. Varsayılan
tarayıcı destekliyorsa özel sekme, desteklemiyorsa normal tarayıcı kullanılır.
Destekleyen özel sekmelerde çubuklar açık renkte olur; sayfayı kaydırırken
adres çubuğu oyun alanına daha çok yer açmak için gizlenebilir.
Google oturumu, oyun kayıtları ve çevrimiçi oyun bağlantıları tarayıcıda kalır;
APK şifre veya hesap verisi işlemez. Çevrimiçi oyun için internet gerekir.
Web güncellemeleri aynı Portal adresinde görünür, APK'nın yeniden kurulması gerekmez.

## Derleme

Android SDK Platform 36, Build Tools 36.0.0, JDK (veya Java + Eclipse ECJ)
ve ZIP gerekir. Resmî SDK Manager üzerinden SDK bileşenlerini
kurup `ANDROID_HOME` değişkenini ayarlayın. Var olan Hero Portal imzalama
anahtarını kullanın; bir güncelleme için yeni anahtar üretmeyin.

```sh
export ANDROID_HOME="/path/to/android-sdk"
export HERO_KEYSTORE="/private/path/hero-portal.p12"
export HERO_KEYPASS_FILE="/private/path/hero-portal.pass"
bash android/build-apk.sh ../Hero-Portal-v159.apk
```

`ANDROID_JAR` ve `ANDROID_BUILD_TOOLS` ile ayrı SDK konumları
verilebilir. `HERO_ECJ_JAR` yalnızca `javac` yerine ECJ kullanılacaksa
tanımlanır. Parola dosyasını ve PKCS12 arşivini erişimi kısıtlı, ayrı bir
yerde saklayın; bunları Git'e veya APK dosyasına eklemeyin.
Derleme APK'yı hizalar, imzalar ve imzayı doğrular. Uygulama kimliği ile imza
anahtarı sürümler boyunca aynı kalmalı; her Android güncellemesinde sürüm
kodu artırılmalıdır.

İlk paket için kullanılan özel anahtar kaynak depoya eklenmez. Gelecekteki
APK güncellemelerinde aynı imzayı kullanabilmek için anahtarın yayıncıya ait
güvenli ve kalıcı bir yedeği gerekir; geçici derleme ortamı bunun yerini tutmaz.
