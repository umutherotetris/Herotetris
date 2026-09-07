from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,shutil
P=Path(__file__).resolve().parents[1]
OUT=Path('/mnt/data')
report='''# SÜKÛN r709 — Sinematik Tefekkür Entegrasyonu

**Tarih:** 8 Eylül 2026  
**Temel:** Kullanıcının r708 tam paketi  
**Kapsam:** Onaylanan mistik görsel dilin gerçek uygulamaya entegrasyonu, kompakt kontroller ve Mini dock yoğunluğu.

## Uygulanan tasarım

Onaylanan görsel konseptin sanat parçalarından, arayüz yazıları ve eski sayaç grafikleri içermeyen ayrı bir 768×1280 WebP sahne oluşturuldu. Ay ışıklı cami ve minare siluetleri, kemer dokusu, Mevlevî silueti ve yeşil–mavi atmosfer kullanılır. Uygulamanın gerçek metinleri, aktif isim düğmesi, sayacı ve bütün kontrolleri HTML olarak kalır; resim üzerindeki sahte düğmeler kullanılmaz. Sahne 44.990 bayttır ve çevrimdışı kurulumun zorunlu dosyasıdır.

r706'nın mevcut duman, ışık, yörünge ve sayaç değişimine bağlı ışık dalgası motoru korunmuştur. Yeni statik altın geometrik süs yalnızca sayaç katmanına eklenir. Dekorların tamamı hit-test dışındadır. Canlı/Sabit ve görsel yoğunluk kontrolleri mevcut r706 sahibini kullanır; azaltılmış hareket ve pil bütçesi korunur. Yeni ses veya render zamanlayıcısı açılmaz.

Tefekkür içinde Hedef/Kalan iki dar ve 46 px yüksekliğinde karttır. Sayma kontrolleri 44–46 px dokunma hedeflerini koruyarak kompaktlaştırılmıştır. Önceki/Baştan başlat/Sonraki, ses kaynağı, hedef/devir ve canonical çıkış aynı gerçek DOM sahipleriyle düzenlenmiştir. Kısa portre ekranlarda halka yaklaşık 198 px, daha geniş/yüksek ekranlarda 224 px'e kadar çıkar. Uzun isimler ve küçük ekranlar doğal dikey akışta kalır.

Mini dock Tefekkür sırasında zaten ana sahnede bulunan sayaç/ilerleme ve isim satırını tekrar etmez. Bildirimler, sürükleme tutamacı, Mini/Midi/Max, Başlat/Durdur ve gizleme korunur. Midi/Max ayrıntıları kaldırılmamıştır. r708'in tek alt rezervi ve doğal belge kaydırması korunur. Yerleşimde yeni sabit yükseklik veya global touchmove engeli yoktur.

## Kaynak ve veri bütünlüğü

r708'in 178 adlandırılmış yürütülebilir script sahibinden yalnız SW kayıt istemcisinin varsayılan build kimliği değişti; eski release-identity modülü r709 ile değiştirildi ve tek yeni görsel runtime eklendi. Bütün önceki CSS sahipleri aynen korunur. Ses, sayaç, kayıt, seyir, canonical Tefekkür, dock yerleşimi ve r706 atmosfer scriptleri bayt düzeyinde aynıdır. Üç ikon da korunmuştur. Yeni görsel runtime, kayıt veritabanı veya kullanıcı ayarlarına yazmaz.

HTML meta/footer, manifest, SW kayıt adresi, cache, sürüm geçmişi ve yapı işaretçisi r709 ile eşitlendi. Cache: `sukun-r709-20260908a`. Yeni sahne SW CORE içine alındı; eski uygulamaya ait cache temizleme ve kullanıcı onaylı güncelleme politikası korunur. IndexedDB ve tarayıcı kayıtları silinmez.

## Doğrulama sonuçları

| Denetim | Sonuç |
|---|---:|
| Tam HTML, kontrollü Chromium; 5 ekran boyutu × Mini/Midi/Max, sınır ve çıkış | 40/40 PASS |
| r706 atmosfer davranış regresyonları | 15/15 PASS |
| r708→r709 kaynak/yayın bütünlüğü | 8/8 PASS |
| Ek düğme ve gezinme hit-test denetimi | 9/9 PASS |

390×844 ekran görüntüsünde Tefekkür kartı ve Mini dock arasında yaklaşık 8 px boşluk ölçüldü. 320×640, 390×844, 412×915, 640×360 ve 1280×900 düzenlerinde doğal kaydırma ve ana kontrollerin ölçüleri doğrulandı. Tam HTML, ortamın yerel/HTTP gezinmeyi engellemesi nedeniyle `set_content` ile yüklendi; görsel test için veri URI'si kullanıldı. Gerçek yayın dosyasında harici yerel WebP kullanılır.

**Doğrulama sınırı:** Genişletilmiş manuel sayaç testinde, gerçek ses/oturum hazırlığı yapılmayan simülasyondaki programatik +1 çağrısı 0→0 kaldı. Bu test sonucu `r709_controls_results.json` içinde saklanmıştır; manuel sayaç işlevinin uçtan uca geçtiği iddia edilmemektedir. Mevcut sayaç motoru değiştirilmedi. Fiziksel Android, gerçek kullanıcı kayıtları, duyulan ses, kilit ekranı, kulaklık kontrolleri ve dağıtılmış PWA ayrıca test edilmelidir. Eski r707 testlerinin sabit script sayısı/sürüm beklentileri yeni sürüm için geçerli olmadığından kaynak bütünlüğü r708 tabanına karşı yeniden yazılmıştır.

## Kurulum

Tam ZIP içindeki `nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, `assets/tefekkur-sanctuary.webp`, üç ikon ve yapı işaretçisi aynı yayın dizinine birlikte yüklenmelidir. Yalnız HTML'yi değiştirmek yeni görselin ve SW'nin doğru kurulumu için yeterli değildir. Önce uygulamanın kendi yedekleme işleviyle kayıtları yedekleyin; tarayıcı verilerini silmeyin. Güncelleme bildiriminde yeni sürümü etkinleştirip yeniden açın. Footer ve tanı build değerleri r709 olmalıdır. Gerekirse `nero.html?v=r709` ile yeni HTML isteyin. Canlı GitHub yayınına buradan dosya yüklenmemiştir.

Tek HTML dağıtımı görseli veri URI'si olarak içerir; tam PWA kurulumu için ZIP kullanılmalıdır. `diagnostics` klasöründe kaynaklar, mevcut testler, yeni test sonuçları, ekran görüntüsü ve önceki sürüm geçmişi bulunmaktadır. SHA-256 dosyası arşiv içeriğini doğrular.
'''
(P/'RAPOR_r709.md').write_text(report)
# Keep the extended, inconclusive manual-count probe as evidence, not a passing test.
probe=P/'diagnostics/r709_controls_results.json'
if probe.exists():probe.rename(P/'diagnostics/r709_extended_controls_results.json')
# The one-shot source builder is retained for provenance, with the requirement
# to begin from the original r708 archive clearly documented.
(P/'diagnostics/README_r709.md').write_text('r709 kaynakları r708 tam paketinden üretilmiştir. build_r709.py tek seferlik kaynak dönüştürücüdür; yeniden çalıştırmadan önce temiz r708 dosyalarını geri yükleyin. r709_extended_controls_results.json içindeki manuel sayım denemesi geçmemiştir ve üretim doğrulaması sayılmaz.\n')
# Single HTML with embedded artwork for a convenient local visual preview.
s=(P/'nero.html').read_text()
import base64
s=s.replace("url('./assets/tefekkur-sanctuary.webp')", "url('data:image/webp;base64,"+base64.b64encode((P/'assets/tefekkur-sanctuary.webp').read_bytes()).decode()+"')")
(OUT/'SUKUN_r709_nero.html').write_text(s)
# Main release keeps only its required image. The small inline-preview JPEG is
# not part of the PWA shell or the shipped source package.
(P/'assets/tefekkur-inline-preview.jpg').unlink(missing_ok=True)
(P/'assets/tefekkur-sanctuary-preview.jpg').unlink(missing_ok=True)
paths=sorted(x for x in P.rglob('*') if x.is_file() and not x.name.startswith('.'))
checks=[]
for f in paths:
 if f.name=='CHECKSUMS_r709.sha256':continue
 checks.append(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.relative_to(P).as_posix())
(P/'CHECKSUMS_r709.sha256').write_text('\n'.join(checks)+'\n')
paths=sorted(x for x in P.rglob('*') if x.is_file() and not x.name.startswith('.'))
zip_path=OUT/'SUKUN_r709_TAM_PAKET.zip'
with ZipFile(zip_path,'w',ZIP_DEFLATED,compresslevel=7) as z:
 for f in paths:z.write(f,f.relative_to(P).as_posix())
with ZipFile(zip_path) as z:
 assert z.testzip() is None
 for line in (P/'CHECKSUMS_r709.sha256').read_text().splitlines():
  h,name=line.split('  ',1);assert hashlib.sha256(z.read(name)).hexdigest()==h,name
 assert json.loads(z.read('__sukun_build_r709__.json'))['build']=='r709'
for name in ['RAPOR_r709.md','CHECKSUMS_r709.sha256'] :shutil.copy2(P/name,OUT/name)
shutil.copy2(P/'diagnostics/r709_full_html_390x844.png',OUT/'SUKUN_r709_onizleme.png')
print(json.dumps({'package':str(zip_path),'bytes':zip_path.stat().st_size,'files':len(paths),'checksum_entries':len(checks),'single_html_bytes':(OUT/'SUKUN_r709_nero.html').stat().st_size},ensure_ascii=False))
