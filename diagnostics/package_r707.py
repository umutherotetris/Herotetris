from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import shutil, hashlib, json, subprocess, re, datetime
root=Path('/mnt/data')
work=root/'sukun_r707_work'
release=root/'sukun_r707_release'
source=root/'SUKUN_r706_TAM_PAKET.zip'
if release.exists(): shutil.rmtree(release)
release.mkdir()
with ZipFile(source) as z:
    assert z.testzip() is None
    for item in z.infolist():
        dest=(release/item.filename).resolve()
        assert dest.is_relative_to(release.resolve())
        if item.is_dir(): dest.mkdir(parents=True,exist_ok=True)
        else:
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_bytes(z.read(item))
history=release/'diagnostics/history/r706_package'
history.mkdir(parents=True,exist_ok=True)
for n in ['RAPOR_r706.md','CHECKSUMS_r706.sha256','__sukun_build_r706__.json']:
    shutil.move(str(release/n),str(history/n))
for n in ['nero.html','sw.js','manifest.webmanifest','surumler.json','__sukun_build_r707__.json']:
    shutil.copy2(work/n,release/n)
for p in (work/'diagnostics').iterdir():
    if p.is_file() and ('r707' in p.name or p.name=='r706_source_fingerprints.json'):
        shutil.copy2(p,release/'diagnostics'/p.name)
# Preserve an exact copy of the original r706 package as provenance without changing the active application.
(report:=release/'RAPOR_r707.md').write_text('''# SÜKÛN r707 — Kaydırma ve Dokunma Kararlılığı

**Tarih:** 7 Eylül 2026  
**Temel:** Kullanıcının sağladığı `SUKUN_r706_TAM_PAKET.zip`  
**Kapsam:** 706 atmosferinin korunması, kaydırma ve hit-test otoritesinin onarılması. Bu bir tasarım değişimi veya ses motoru yeniden yazımı değildir.

## Yapılan düzeltmeler

1. **Tefekkür kaydırması:** Sabit gövde/sekme yüksekliği ve taşma kilitleri kaldırıldı. Belge doğal olarak uzayabilir; alt içerik için oyuncu yüksekliğine göre güvenli alan ayrılır. Kartların ve kontrollerin üst üste binmesine yol açan eski yükseklik kurallarına karşı son CSS otoritesi eklendi.
2. **Mini/Midi/Max:** Dock yüksekliği gerçek içerik sınırlarıyla ölçülür. Kaydırılabilirlik tahmini yükseklik yerine `scrollHeight > clientHeight` üzerinden belirlenir. Mod değişimi artık kaydırmayı sıfırlamaz; tarayıcının otomatik anchoring kaydırması gerektiğinde önceki konum, yeni sınırlar içinde korunur.
3. **Max içerik taşması:** Eski grid ve sabit 36 piksel aksiyon satırı kuralları düzeltildi. İçerik ölçümü sırasında doğal yükseklik, normal kullanımda ise sınırlı iç kaydırma uygulanır. Dokunma hedefleri en az 44 piksel olacak biçimde korunur.
4. **Tıklama ve modal sahipliği:** Dekoratif atmosfer katmanları dokunmaları yakalamaz. Kapalı modal/backdrop etkileşime girmez; açık detay ve bildirim yüzeyleri kendi içinde kaydırılabilir. Bildirim çekmecesi kapanırken önceden mevcut olan `inert` ve `aria-hidden` durumu geri yüklenir; kapanmış tetikleyiciye odak zorlanmaz.
5. **Tefekkürden Çık:** Önceki CSS otoritesinin gizleyebildiği çıkış satırı, Tefekkür düzeninde açıkça görünür kılındı. Açma, kapama ve çıkış hit-testleri izole tarayıcı testlerinde doğrulandı.
6. **Frekans kontrolü:** Taşıyıcı frekans düğmesinin pencere genelindeki mouse/touchmove dinleyicileri kaldırılarak yalnız ilgili düğmeye ait pointer capture kullanıldı. Pointer cancel/up temizliği ile dokunma sahipliği sınırlandı.
7. **Kaydırma koruması:** Açıkça istenen navigasyon ve yeni kullanıcı hareketi, arka plan kaydırma bastırmasından öncelikli hâle getirildi. Gecikmiş konum geri yüklemesi yeni bir kullanıcı kaydırmasını geri alamaz.

## Korunan işlevler

706'nın mor–mavi–zümrüt neon atmosferi, duman/şua animasyonları, sayaç ve seyir verileri, mevcut ses oturumu ve kayıt önceliği, 28/99 seyirleri, TTS, terkipler, duraklatma/durdurma motorları ve diğer uygulama modülleri korunmuştur. Kaynak parmak izi testi, yalnız hedeflenen modüller ile sürüm notlarının değiştiğini; çekirdek modülün taşıyıcı düğme bölümü dışındaki kodunun aynı kaldığını doğrular. Önceki ses sorunlarının tamamının fiziksel cihazda giderildiği iddia edilmez.

## Doğrulama

| Kontrol | Sonuç |
|---|---:|
| Mevcut kaynak regresyonları | 51 / 51 geçti |
| 706 atmosfer davranış testleri | 15 / 15 geçti |
| 707 odaklı kaynak ve modül karşılaştırmaları | 8 / 8 geçti |
| İzole Chromium yerleşim/hit-test testleri | 16 / 16 geçti |
| **Toplam** | **90 / 90 geçti** |

İzole Chromium testleri, uygulamanın gerçek CSS kuralları ve yerleşim çalışma zamanı ile kontrollü DOM üzerinde 320×640, 390×844, 640×360 ve 1280×900 boyutlarında çalıştırıldı. Belge/dock kaydırması, mod geçişinde konumun korunması, çıkış düğmesi ve modal aç/kapat davranışları denetlendi. Bunlar tam uygulamanın uçtan uca testi değildir.

**Sınır:** Tam uygulamanın yerel HTTP üzerinden Chromium'a açılması bu çalışma ortamının yönetici politikası nedeniyle engellendi. Bu engel aşılmadı. Fiziksel Android, WebView/PWA, gerçek dokunma, kulaklık/medya tuşları, kilit ekranında ses ve sayaç ilerlemesi veya duyulan ses kalitesi doğrulanmış değildir. Kaynak testlerinin geçmesi, bu cihaz senaryolarının kesin çözüldüğü anlamına gelmez.

## Paket ve kurulum

`nero.html`, `sw.js`, `manifest.webmanifest`, `surumler.json`, ikonlar ve r707 yapı işaretçisi aynı dizine aittir. HTML/manifest/SW sürümleri r707'ye eşitlenmiştir. Önceki sürüm raporları ve checksum dosyaları geçmiş klasöründe tutulmuştur. `CHECKSUMS_r707.sha256` aktif paketin dosya bütünlüğünü doğrular.

Tam paketi aynı yayın dizinine birlikte yükleyin. Önce mevcut kullanıcı kayıtlarını yedekleyin; tarayıcı verilerini, IndexedDB'yi veya yerel kayıtları silmeyin. Mevcut PWA'nın güncelleme mekanizmasıyla yeni Service Worker'ın etkinleşmesini bekleyip sürümün r707 olduğunu doğrulayın. Sunucuya dağıtım yapılmadı. Android üzerinde özellikle Tefekkürde uzun kaydırma, Mini→Midi→Max, açık bildirimden çıkış, iki ses kaynağı arasında geçiş, pause/resume/stop ve kilit ekranı seyir geçişleri ayrıca denenmelidir.

## Denetim dosyaları

`diagnostics/test_r707.cjs`, `diagnostics/test_layout_r707.py`, ilgili sonuç JSON'ları, `r707_changes.diff`, değiştirilen modül kopyaları, CSS otoritesi ve `r706_source_fingerprints.json` pakete eklenmiştir. Parmak izleri özgün r706 arşivinden türetilmiştir; kişisel kullanıcı verileri paketlenmemiştir.
''',encoding='utf-8')
# Re-run portable tests against the actual release copy.
checks=[('test_r705.cjs','r707_existing_regressions.json'),('test_r706.cjs','r707_atmosphere_regressions.json'),('test_r707.cjs','r707_focused_results.json')]
for test,out in checks:
    result=subprocess.run(['node',str(release/'diagnostics'/test),str(release)],capture_output=True,text=True,check=True)
    (release/'diagnostics'/out).write_text(result.stdout,encoding='utf-8')
    d=json.loads(result.stdout); r=d.get('target',d)
    assert r['failed']==0,(test,r.get('failed'))
    print(test,r['passed'],'/',r['total'])
# Exact release coherence and source preservation.
html=(release/'nero.html').read_text()
sw=(release/'sw.js').read_text()
manifest=json.loads((release/'manifest.webmanifest').read_text())
marker=json.loads((release/'__sukun_build_r707__.json').read_text())
assert marker['build']=='r707' and manifest['start_url'].endswith('v=r707')
assert "const SURUM = 'r707'" in sw and 'sukun-r707-20260907a' in sw
assert 'manifest.webmanifest?v=r707' in html
assert (release/'surumler.json').read_text().find('"r707"')>=0
assert not (release/'__sukun_build_r706__.json').exists()
# Bundle manifests are computed only after all active files have been finalized.
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
checksum=release/'CHECKSUMS_r707.sha256'
files=sorted(p for p in release.rglob('*') if p.is_file() and p!=checksum)
checksum.write_text(''.join(f'{sha(p)}  {p.relative_to(release).as_posix()}\n' for p in files))
archive=root/'SUKUN_r707_TAM_PAKET.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(release.rglob('*')):
        if p.is_file(): z.write(p,p.relative_to(release).as_posix())
with ZipFile(archive) as z:
    assert z.testzip() is None
    for line in z.read('CHECKSUMS_r707.sha256').decode().splitlines():
        digest,name=line.split('  ',1)
        assert hashlib.sha256(z.read(name)).hexdigest()==digest,name
    assert z.read('nero.html')== (release/'nero.html').read_bytes()
for n in ['RAPOR_r707.md','nero.html','CHECKSUMS_r707.sha256']:
    shutil.copy2(release/n,root/n)
print(json.dumps({'archive':str(archive),'bytes':archive.stat().st_size,'sha256':sha(archive),'file_count':len(files)+1,'report':str(root/'RAPOR_r707.md'),'standalone':str(root/'nero.html'),'checksums':'PASS'},ensure_ascii=False,indent=2))
