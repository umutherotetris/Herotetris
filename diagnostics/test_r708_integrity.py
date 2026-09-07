from pathlib import Path
from zipfile import ZipFile
from bs4 import BeautifulSoup
import hashlib,json,re,subprocess
D=Path(__file__).resolve().parent.parent
BASE=D/'diagnostics/history/r707_package/SUKUN_r707_TAM_PAKET.zip'
with ZipFile(BASE) as z: original=z.read('nero.html').decode('utf-8'); old_files={n:z.read(n) for n in ['icon-192.png','icon-512.png','icon-512-maskable.png']}
current=(D/'nero.html').read_text(encoding='utf-8')
old=BeautifulSoup(original,'html.parser');new=BeautifulSoup(current,'html.parser')
sha=lambda s:hashlib.sha256(s.encode('utf-8')).hexdigest()
def scripts(s):return [(m.group(1).split('id="')[1].split('"')[0] if 'id="' in m.group(1) else '',m.group(2)) for m in re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script>',s)]
a,b=scripts(original),scripts(current)
assert len(b)==len(a)+2,(len(a),len(b)) # release identity + focus entry; history is existing
changed=[]
for i,(id,code) in enumerate(a):
 assert b[i][0]==id,(i,id,b[i][0])
 if code!=b[i][1]:changed.append(id)
assert set(changed)=={'surumNotlari','r514-core-akis-nefs','r633-flow-dock-placement-runtime','sukun-r530-tefekkur-mode-runtime'},changed
old_client=dict(a)['r514-core-akis-nefs'];new_client=dict(b)['r514-core-akis-nefs']
assert new_client==old_client.replace("const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r706';","const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r708';",1).replace("navigator.serviceWorker.register('./sw.js?v=r704',{updateViaCache:'none'})","navigator.serviceWorker.register('./sw.js?v='+encodeURIComponent(SW_CLIENT_BUILD),{updateViaCache:'none'})",1)
assert [x[0] for x in b[len(a):]]==['r708-focus-entry-runtime','r708-release-identity-runtime']
old_layout=dict(a)['r633-flow-dock-placement-runtime'];new_layout=dict(b)['r633-flow-dock-placement-runtime']
assert new_layout==old_layout.replace("const VERSION='r707'","const VERSION='r708'",1).replace("if(!B.classList.contains('r707-scroll'))B.classList.add('r707-scroll');","if(!B.classList.contains('r707-scroll'))B.classList.add('r707-scroll');if(!B.classList.contains('r708-boundary'))B.classList.add('r708-boundary');",1)
old_entry=dict(a)['sukun-r530-tefekkur-mode-runtime'];new_entry=dict(b)['sukun-r530-tefekkur-mode-runtime']
assert new_entry==old_entry.replace("  wake();\n\n  /* r530:","  wake();\n  window.SukunR708Focus?.enter?.();\n\n  /* r530:",1)
assert new.find('style',id='r707-scroll-hit-test-authority').string==old.find('style',id='r707-scroll-hit-test-authority').string
assert new.find('style',id='r706-atmosphere-style').string==old.find('style',id='r706-atmosphere-style').string
assert [x for x in new.find_all('style') if x.get('id')=='r708-single-boundary']
assert all((D/n).read_bytes()==data for n,data in old_files.items())
assert 'localStorage.clear(' not in dict(b)['r708-focus-entry-runtime']
assert 'indexedDB.deleteDatabase(' not in dict(b)['r708-focus-entry-runtime']
assert not (D/'__sukun_build_r707__.json').exists()
marker=json.loads((D/'__sukun_build_r708__.json').read_text());manifest=json.loads((D/'manifest.webmanifest').read_text());notes=json.loads((D/'surumler.json').read_text());sw=(D/'sw.js').read_text()
assert marker['build']=='r708' and marker['base']=='r707'
assert new.find('meta',attrs={'name':'sukun-build'})['content']=='r708'
assert 'build 2026-09-07-r708' in new.find(id='surumEtiket').text
assert 'manifest.webmanifest?v=r708' in current
assert "const SURUM = 'r708'" in sw and "const CACHE = 'sukun-r708-20260907a'" in sw
assert "const BUILD_MARKER='./__sukun_build_r708__.json'" in sw
assert "register('./sw.js?v='+encodeURIComponent(SW_CLIENT_BUILD)" in current
assert manifest['start_url'].endswith('v=r708') and manifest['shortcuts'][0]['url'].endswith('v=r708')
assert notes[0]['v']=='r708' and notes==json.loads(new.find('script',id='surumNotlari').string)
assert 'sukun-r707-20260907a' not in sw
assert 'caches.delete(k)' in sw and "k.startsWith('sukun-')" in sw
# Native JS parse, including the new executable modules.
for id,code in b:
 if id not in {'r514-core-akis-nefs','r633-flow-dock-placement-runtime','sukun-r530-tefekkur-mode-runtime','r708-focus-entry-runtime','r708-release-identity-runtime'}:continue
 subprocess.run(['node','--check'],input=code,text=True,capture_output=True,check=True)
subprocess.run(['node','--check'],input=sw,text=True,capture_output=True,check=True)
report={'kind':'r708-source-integrity','passed':8,'total':8,'failed':0,'checks':['All previous executable owners preserved except scoped layout/entry/update-client edits and release history','r633 geometry logic unchanged except release identity and scope class','Canonical entry has exactly one additional focus call','r706 atmosphere and r707 interaction CSS byte-identical','All three icons preserved','HTML, footer, history, manifest, SW, cache and marker agree','No added user-data deletion; original cache activation policy retained','All modified executable modules and Service Worker pass JavaScript syntax'],'previousScriptCount':len(a),'currentScriptCount':len(b),'modifiedOwners':changed,'newOwners':[x[0] for x in b[len(a):]],'unchangedOwners':len(a)-len(changed),'baselineSha256':hashlib.sha256(original.encode()).hexdigest(),'currentSha256':hashlib.sha256(current.encode()).hexdigest()}
(D/'diagnostics/r708_integrity_results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
