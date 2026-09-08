# SÜKÛN r719

8 Eylül 2026 · Temel paket: r718 · Uygulama ailesi: v20.23

## Kullanımda değişenler

- **Tek görünüm seçimi:** Feyz, Osmanlı ve Semerkant aynı seçim grubunda yer alır. Araçlar ve Arayüz düzeni panelleri aynı seçimi gösterir. Osmanlı veya Semerkant seçildiğinde etkin Feyz katmanı kapanır; Feyz seçildiğinde tekrar açılır. Ayrı Feyz anahtarı kaldırıldı.
- **Tercih sürekliliği:** Önceki görünüm ve renk ayarları korunur. AMOLED veya Sabah Nuru, Feyz görünümünü geçici olarak devre dışı bıraktığında ayarlar bunu açıklar. Başka bir renk temasına dönüldüğünde saklanan Feyz görünümü yeniden uygulanır.
- **Güncel zikir başlığı:** Başlık metni ve görünürlüğü canlı düğümlerle karşılaştırılır. Başlık yeniden oluşturulduğunda, aynı zikir adı yeniden gösterilir. Aynı anda gelen olaylar tek çizim isteğinde birleştirilir. Her genel tıklamada çalışan gecikmeli başlık güncellemesi kaldırıldı.
- **Geri dönüş davranışı:** Gizli sayfada bekleyen başlık güncellemesi iptal edilir. Sayfadan ayrılınca gözlemci ayrılır; geri dönünce mevcut kaynak düğümlerine yeniden bağlanır. İsim animasyonunun bitişinde başlığın görünürlüğü tekrar değerlendirilir.
- **Dar ekranda okunurluk:** Alt gezinme, Önceki/Baştan/Sonraki, Tefekkürden Çık, ses kaynağı ve hedef/kalan etiketleri en az 11 piksel olarak düzenlendi. Çıkış metni gerektiğinde satıra bölünebilir. Görünüm seçenekleri 54 piksel yüksekliğinde üç düğme kullanır.

r718'in altın amblemi, geometrik deseni, turkuaz camları, mor ışık halkası ve ortak sahnesi bu sürümün görsel temelidir. Sayaç, ses, kayıt, zikir gezinmesi ve kaydırma sahipleri değiştirilmedi.

## Doğrulama

| Kontrol grubu | Geçen / toplam |
| --- | ---: |
| JavaScript, sürüm, çevrimdışı önbellek ve ana akışlar | 31 / 31 |
| Ambiyans ve hareket tercihi | 15 / 15 |
| Görsel yaşam döngüsü | 12 / 12 |
| Duraklatma niyeti | 12 / 12 |
| Önceki kilit/ses katmanlarının duraklatma sözleşmesi | 5 / 5 |
| Yeni görünüm ve başlık davranışları | 20 / 20 |
| Paket bütünlüğü ve varlık denetimi | 5 / 5 |
| **Toplam** | **100 / 100** |

Kontroller Node VM içinde gerçek kaynak modülleri ve sınırlı DOM/önbellek düzenekleriyle; ayrıca Python HTML ayrıştırıcısı ve görsel çözücüleriyle çalıştırıldı. Bunlar tarayıcı yerleşim veya fiziksel ses testleri değildir.

Canlı tarayıcı erişimi bu ortamın güvenlik politikası nedeniyle kullanılamadı. Gerçek cihazda 320–390 piksel ekran yerleşimi, Android kilit ekranı, mikrofon/kayıt ve kulaklık kontrolleri doğrulanmadı. “100 / 100” sonucu bu davranışların donanım üzerinde onaylandığı anlamına gelmez.

Kaynak bütünlüğü: r718'in 157 stil bloğu ve tüm görsel varlıkları korundu. Yeni bir stil bloğu eklendi. Statik HTML kimliklerinde tekrar yok. Ana ses, kayıt, sayaç ve gezinme modüllerinin değişmediği SHA-256 karşılaştırmasıyla denetlendi.

## Teknik süreklilik

- Mevcut `sukun.ui.shellSkin` anahtarı, Osmanlı/Semerkant seçimini tutmaya devam eder. `sukun.shell.r716` mevcut Feyz tercihidir; yeni depolama anahtarı eklenmedi.
- Tanılama ve onarım kodunun kullandığı `SukunShellSkin.get/set/skins` sözleşmesi korundu. Görünüm arayüzü ayrı `getAppearance/setAppearance/appearanceState/syncAppearance` yöntemlerini kullanır.
- `SukunR716Shell` ve `SukunFeyzShell` mevcut yaşam döngüsünün sahibidir. Görünüm bildirimi yalnız tercih, uygulama durumu veya renk teması değiştiğinde yayımlanır.
- Manifest kimliği `./nero.html` olarak korundu. Başlangıç adresi `./nero.html?v=r719`; Service Worker önbelleği `sukun-r719-20260908a` oldu.
- Kaynak farkı ve güncel test sonuçları `diagnostics/r719/` içindedir. Önceki sürümlerin raporları tarihsel kayıttır.

## Paketi kullanma

ZIP içeriğini birlikte çıkarın. Web/PWA kullanımında `nero.html`, `sw.js`, `manifest.webmanifest`, sürüm dosyaları, ikonlar ve `assets/` dizini aynı yayın kökünde bulunmalıdır. Sürüm yükseltirken site verilerini temizlemeyin; önceki kayıt ve tercihlerin sürekliliği mevcut anahtarlara dayanır.

## Kontrolleri yeniden çalıştırma

Paket kökünde Node ve gerekli Python paketleri (lxml, Pillow) ile:

```bash
node diagnostics/r719/test_source.cjs . > diagnostics/r719/source_results.json
node diagnostics/r719/test_atmosphere.cjs . > diagnostics/r719/atmosphere_results.json
node diagnostics/r719/test_visual_lifecycle.cjs . > diagnostics/r719/visual_lifecycle_results.json
node diagnostics/r719/test_pause_intent.cjs diagnostics/r719/journey-audio.js diagnostics/r719/pause_results.json
node diagnostics/r719/test_legacy_pause.cjs diagnostics/r719/lock-transport.js diagnostics/r719/audio-hub.js diagnostics/r719/legacy_results.json
node diagnostics/r719/test_ux.cjs . > diagnostics/r719/ux_results.json
python3 diagnostics/r719/verify_bundle.py /path/SUKUN_r718_TAM_PAKET.zip
```

`build_r719.py` yalnız teslim edilen r718 ZIP'ini temel alır. Paketteki güncel uygulama zaten derlenmiştir; normal kullanımda bu betiğin çalıştırılması gerekmez.
