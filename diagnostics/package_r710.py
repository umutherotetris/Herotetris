from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import base64,hashlib,json,shutil,difflib,re,collections,subprocess
ROOT=Path(__file__).resolve().parents[1]
OUT=Path('/mnt/data')
RELEASE=OUT/'sukun_r710_release'
BASE=OUT/'SUKUN_r709_TAM_PAKET.zip'
with ZipFile(BASE) as z:old=z.read('nero.html').decode()
new=(ROOT/'nero.html').read_text()
# Preserve a reviewable source diff and byte-level provenance against the original r709.
d=ROOT/'diagnostics'
(d/'r710_changes.diff').write_text(''.join(difflib.unified_diff(old.splitlines(keepends=True),new.splitlines(keepends=True),fromfile='r709/nero.html',tofile='r710/nero.html')))
def blocks(s,tag):
 return [{'id':(re.search(r'\bid=["\']([^"\']+)',m.group(1)).group(1) if re.search(r'\bid=["\']([^"\']+)',m.group(1)) else ''),'sha256':hashlib.sha256(m.group(2).encode()).hexdigest(),'bytes':len(m.group(2).encode())} for m in re.finditer(r'<'+tag+r'\b([^>]*)>(.*?)</'+tag+r'\s*>',s,re.S|re.I)]
(d/'r710_source_inventory.json').write_text(json.dumps({'base':'r709','build':'r710','baseHtmlSha256':hashlib.sha256(old.encode()).hexdigest(),'releaseHtmlSha256':hashlib.sha256(new.encode()).hexdigest(),'baseScripts':blocks(old,'script'),'releaseScripts':blocks(new,'script'),'baseStyles':blocks(old,'style'),'releaseStyles':blocks(new,'style')},ensure_ascii=False,indent=2)+'\n')
report='''# SÜKÛN r710 — Ses Durumu Stabilizasyonu ve Sinematik Tefekkür

**Tarih:** 8 Eylül 2026  
**Temel:** Kullanıcının r709 tam paketi  
**Kapsam:** Tekrarlayan ana iş parçacığı kilitlenmesi, sayaç durum yayın sırası, r709→r710 yayın bütünlüğü ve onaylanan görsel dilin geliştirilmesi.

## 1. Kilitlenme: doğrulanan kaynak ve düzeltme

r709'daki r693 terminal ses uzlaştırıcısı ile r637 Audio Truth aynı mantıksal oturum durumunu farklı biçimde yorumluyordu. Fiziksel ses bulunmadığında bir modül Hub/AudioLife durumunu idle'a indirirken diğeri kayıt/oturum etiketinden playing'i yeniden kurabiliyordu. Gerçek HTML'deki sayaç işlemi sonrasında bu karşılıklı olay yayınları ana iş parçacığını meşgul eden bir döngüye dönüştü. İlgili orijinal ve düzeltilmiş kaynaklar, olay izleri ve fark dosyası diagnostics içinde saklanmıştır.

r637 artık mantıksal registry playing bilgisini tek başına duyulabilir ses kanıtı saymaz; r693 ile aynı fiziksel gözlem kaynağını kullanır. Hub ve AudioLife, durum değişmediyse aynı durum olayını yeniden yayınlamaz. r693 yeniden giriş koruması ve 80 ms birleştirilmiş zamanlayıcı kullanır. Meşru hazırlık/kurtarma durumu 2,5 saniyelik sınırlı pencereyle korunur. İlk denemede tekrar döngüsü üreten ertelenmiş uzlaştırma çözümü geri alınmıştır. Yeni genel touchmove engelleyicisi, sahte tıklama veya ses motoru kopyası eklenmemiştir.

Bu düzeltme doğrulanmış olay döngüsünü hedefler; fiziksel Android üzerinde her olası kilitlenmenin ortadan kalktığı iddiası değildir.

## 2. Sayaç ve işlem bütünlüğü

Görünür zUI çiziminde currentZikirState güncellenmeden currentFlowState okunabiliyordu. Önceki snapshotın ekrana bir işlem geriden yansımasını önlemek için önce canonical zikir durumu, ardından aggregate akış durumu yenilenir. Gerçek kullanıcı dokunmasıyla +1/−1, hedef tamamlama, devir ve geri alma doğrulandı.

Önceki r709 ve ilk r710 testlerindeki bir başarısızlık ayrıca yanlış test varsayımından kaynaklanıyordu: __r476SilentCatchup açıkken rep() DOM'u bilerek çizmez. Bu, gizli/kilit ekranı sayımının sözleşmesidir; görünür kullanıcı dokunması testi değildir. Düzeltilmiş testler görünür sayımı normal modda, sessiz uzlaştırmayı ise ayrı senaryoda denetler. Gizli modun sayaç davranışı değiştirilmedi. Testlerin ilk hatalı sonuçları ve düzeltme izleri korunmuştur.

## 3. Görsel entegrasyon

r709'un kompakt, gerçek HTML tabanlı Tefekkür kontrolleri korunup sinematik sanat sahnesi geliştirildi. Ay ışıklı cami ve kemerler, Mevlevî silueti, su yansımaları ve zümrüt–mavi neon dumanlar ayrı WebP varlıklarıdır. Üst/alt sahne bütünlüğü, cam yüzeyler ve sayaç çevresindeki ışık/altın geometrik süsler güçlendirildi. Gerçek isim, sayaç, Hedef/Kalan, kayıt, gezinme ve çıkış düğmeleri resmin içine gömülmez. Görsel varlıklar pointer-events:none katmanında kalır; mevcut r706 animasyon motoru ve hareket bütçesi kullanılır. Yeni sürekli animasyon veya ses zamanlayıcısı eklenmez.

Bu, onaylanan mockup'ın çalışan ve farklı ekranlara uyarlanan sürümüdür; her cihazda piksel piksel aynı görüntü olduğu iddia edilmez. r708 tek alt rezervi ve doğal kaydırma, r709 kompakt ölçüleri ve mevcut Mini/Midi/Max sahipleri korunur.

## 4. Son doğrulama

| Denetim | Sonuç | Kapsam |
|---|---:|---|
| Kaynak ve SW regresyonları | 31/31 | İzole Node VM, sürüm kimliği ve offline cache sözleşmeleri |
| Gerçek HTML çalışma testleri | 9/9 | Native dokunma, +1/−1, hedef/devir/undo, 20 ardışık dokunma, sessiz uzlaştırma, ses durum simülasyonu, 15 sn olay yükü, çıkış |
| Gerçek HTML yerleşim | 40/40 | 320×640, 390×844, 412×915, 640×360, 1280×900; Mini/Midi/Max, sınırlar ve çıkış |
| Atmosfer regresyonları | 15/15 | İzole animasyon/observer/performans davranışı |
| Kaynak ve yayın bütünlüğü | 7/7 | Değişen modül kapsamı, tüm eski CSS, ikonlar, assetler, JS parse, meta/manifest/SW/geçmiş |
| **Toplam** | **102/102** | Birbirinden farklı kapsamları olan kontrollü kontroller |

Tarayıcı testleri gerçek uygulama HTML'sini Chromium'a set_content ile yükler; görsel dosyaları yerel data URI üzerinden sağlanır. Testler gerçek cihazın ses donanımını, Android arka plan sınırlamalarını, kulaklık düğmelerini veya dağıtılmış GitHub PWA güncellemesini taklit etmez. Fiziksel Android'de uzun süreli kullanım, kilit ekranında 28/99 Seyir, kendi kayıt/TTS, Pause/Stop/Resume ve telefon çağrısı dönüşü ayrıca doğrulanmalıdır. Önceki başarısız denemeler başarı toplamına katılmamıştır.

## 5. Sürüm ve kurulum

HTML meta/footer, gömülü ve harici sürüm geçmişi, manifest bağlantısı, manifest start URL/shortcuts, SW kayıt adresi, SW SURUM/CACHE ve build marker r710 ile eşitlendi. Cache adı **sukun-r710-20260908a**. Yeni üç sanat varlığı SW CORE içindedir. Kullanıcı verilerini veya IndexedDB'yi silen bir işlem eklenmemiştir. Orijinal ikonlar ve önceki sürüm geçmişi korunmuştur.

Önce uygulamanın Amel Defteri → Yedekleme bölümünden verileri yedekleyin. ZIP içindeki nero.html, sw.js, manifest.webmanifest, surumler.json, assets klasörü, ikonlar ve __sukun_build_r710__.json dosyasını aynı yayın dizinine birlikte yükleyin. Yalnız HTML'yi değiştirmek yeterli değildir. Uygulama güncelleme bildiriminden yeni sürümü etkinleştirip yeniden açın; gerekirse nero.html?v=r710 ile yeni HTML isteyin. Tarayıcı verilerini veya kayıtları silmeyin. Bu oturumda canlı GitHub yayınına dosya yüklenmemiştir.

Tek HTML dağıtımı üç sanat varlığını içerir; tam çevrimdışı PWA kurulumu için ZIP kullanılmalıdır. diagnostics klasörü testleri, önceki raporları, kaynak farklarını ve bütünlük kayıtlarını içerir. Testleri yeniden çalıştırmak için Node.js, Python/Playwright ve Chromium gerekir. Kaynak bütünlüğü testi orijinal r709 arşivini /mnt/data/SUKUN_r709_TAM_PAKET.zip konumunda bekler; orijinal arşiv bir başka yerdeyse testte BASE yolunu güncelleyin.
'''
(ROOT/'RAPOR_r710.md').write_text(report)
(d/'README_r710.md').write_text('r710, orijinal r709 tam paketinin kaynakları üzerine sınırlı değişikliklerle oluşturuldu. r710_changes.diff ve r710_source_inventory.json kaynak provenansını taşır. Testlerin kapsamı RAPOR_r710.md içinde açıklanmıştır. Kaynak bütünlüğü testinin yeniden çalışması için orijinal r709 arşivi gerekir. Gerçek Android ve yayınlanmış PWA doğrulaması yapılmamıştır.\n')
# Ensure the build is not silently mixed with an earlier release.
assert json.loads((ROOT/'surumler.json').read_text())[0]['v']=='r710'
assert json.loads((ROOT/'__sukun_build_r710__.json').read_text())['cache']=='sukun-r710-20260908a'
for name in ['r710_source_results.json','r710_runtime_results.json','r710_layout_results.json','r710_atmosphere_results.json','r710_integrity_results.json']:
 x=json.loads((d/name).read_text());x=x.get('target',x);assert x.get('failed',x['total']-x['passed'])==0,name
# A compact release keeps the old source history and all current verification artifacts.
if RELEASE.exists():shutil.rmtree(RELEASE)
RELEASE.mkdir();(RELEASE/'assets').mkdir();(RELEASE/'diagnostics').mkdir()
for n in ['nero.html','sw.js','manifest.webmanifest','surumler.json','__sukun_build_r710__.json','icon-192.png','icon-512.png','icon-512-maskable.png','RAPOR_r710.md']:
 shutil.copy2(ROOT/n,RELEASE/n)
for f in (ROOT/'assets').iterdir():
 if f.is_file():shutil.copy2(f,RELEASE/'assets'/f.name)
shutil.copytree(d/'history',RELEASE/'diagnostics/history')
keep=['README_r710.md','r710_changes.diff','r710_source_inventory.json','test_r710_source.cjs','test_r702.cjs','test_r706.cjs','test_r710_runtime.py','test_layout_r710.py','test_integrity_r710.py','r710_source_results.json','r710_runtime_results.json','r710_layout_results.json','r710_atmosphere_results.json','r710_integrity_results.json','r710_full_html_390x844.png','r710_counter_repro.log','r710_final_core_repro.log','r710_first_repro.log','r710-stability-runtime.js','style-r710-cinematic.css','r710-r220-unified-audio.js','r710-r637-audio-truth-reconciliation.js','r710-r693-terminal-truth-integrity.js','r710-premiumR160.js','source_r220-unified-audio.js','source_r637-audio-truth-reconciliation.js','source_r693-terminal-truth-integrity.js','source_premiumR160.js','trace_audio_states.log','trace_audio_detail.log','probe_count_sequence.py','probe_count_real.py','probe_count_sequence.log','probe_count_real.log','r710_runtime_console.log','r710_layout_console.log']
for n in keep:
 f=d/n
 if f.is_file():shutil.copy2(f,RELEASE/'diagnostics'/n)
shutil.copy2(Path(__file__),RELEASE/'diagnostics/package_r710.py')
# A convenience single-file version carries the same real HTML and artwork.
single=new
for f in (ROOT/'assets').glob('*.webp'):
 single=single.replace("url('./assets/"+f.name+"')","url('data:image/webp;base64,"+base64.b64encode(f.read_bytes()).decode()+"')")
(OUT/'SUKUN_r710_nero.html').write_text(single)
# Current-release checksums cover every file except the checksum document itself.
paths=sorted(f for f in RELEASE.rglob('*') if f.is_file())
checks=[]
for f in paths:checks.append(hashlib.sha256(f.read_bytes()).hexdigest()+'  '+f.relative_to(RELEASE).as_posix())
(RELEASE/'CHECKSUMS_r710.sha256').write_text('\n'.join(checks)+'\n')
paths=sorted(f for f in RELEASE.rglob('*') if f.is_file())
zip_path=OUT/'SUKUN_r710_TAM_PAKET.zip'
with ZipFile(zip_path,'w',ZIP_DEFLATED,compresslevel=7) as z:
 for f in paths:z.write(f,f.relative_to(RELEASE).as_posix())
with ZipFile(zip_path) as z:
 assert z.testzip() is None
 for line in (RELEASE/'CHECKSUMS_r710.sha256').read_text().splitlines():
  h,name=line.split('  ',1);assert hashlib.sha256(z.read(name)).hexdigest()==h,name
 assert json.loads(z.read('__sukun_build_r710__.json'))['build']=='r710'
 assert json.loads(z.read('surumler.json'))[0]['v']=='r710'
for n in ['RAPOR_r710.md','CHECKSUMS_r710.sha256']:shutil.copy2(RELEASE/n,OUT/n)
shutil.copy2(d/'r710_full_html_390x844.png',OUT/'SUKUN_r710_onizleme.png')
print(json.dumps({'package':str(zip_path),'bytes':zip_path.stat().st_size,'files':len(paths),'checksums':len(checks),'singleHtmlBytes':(OUT/'SUKUN_r710_nero.html').stat().st_size,'sourceHash':hashlib.sha256(new.encode()).hexdigest()},ensure_ascii=False,indent=2))
