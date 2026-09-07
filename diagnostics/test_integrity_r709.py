from pathlib import Path
from bs4 import BeautifulSoup
from zipfile import ZipFile
import hashlib,json,re,subprocess
P=Path(__file__).resolve().parents[1]
with ZipFile('/mnt/data/SUKUN_r708_TAM_PAKET.zip') as z:
 old=z.read('nero.html').decode();old_icons={n:z.read(n) for n in ['icon-192.png','icon-512.png','icon-512-maskable.png']}
new=(P/'nero.html').read_text();a=BeautifulSoup(old,'html.parser');b=BeautifulSoup(new,'html.parser');checks=[]
def check(name,fn):
 try:checks.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:checks.append({'name':name,'status':'FAIL','error':str(e)})
def scripts(s):return {x.get('id'):x.get_text() for x in s.find_all('script') if x.get('id') and x.get('type','') not in ['application/json','application/ld+json']}
A,B=scripts(a),scripts(b)
old_client="const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r708';"
new_client=old_client.replace('r708','r709')
def owners():
 assert set(B)-set(A)=={'r709-release-identity-runtime','r709-sanctuary-runtime'}
 assert set(A)-set(B)=={'r708-release-identity-runtime'}
 changed=[k for k in A.keys()&B.keys() if A[k]!=B[k]]
 assert changed==['r514-core-akis-nefs'],changed
 assert B[changed[0]]==A[changed[0]].replace(old_client,new_client,1)
 return {'old':len(A),'new':len(B),'changed':changed,'added':sorted(set(B)-set(A))}
check('Executable owners unchanged except release client and new visual runtime',owners)
def visual():
 oldstyles={x.get('id'):x.get_text() for x in a.find_all('style') if x.get('id')};newstyles={x.get('id'):x.get_text() for x in b.find_all('style') if x.get('id')}
 assert all(newstyles[k]==v for k,v in oldstyles.items())
 assert set(newstyles)-set(oldstyles)=={'r709-sanctuary-style'}
 for id in ['r706-atmosphere-style','r707-scroll-hit-test-authority','r708-single-boundary'] :assert newstyles[id]==oldstyles[id]
 return {'previousStyleOwners':len(oldstyles),'added':['r709-sanctuary-style']}
check('All old styles including scroll and atmosphere authorities preserved',visual)
def audio():
 for id in ['r514-core-zikir-sentez','r514-core-letaif-kayit','r514-core-yedek-vird','r530-tefekkur-canonical-runtime','r633-flow-dock-placement-runtime','r706-atmosphere-runtime','r698-transport-authority']:
  assert A[id]==B[id],id
 for k in ['r709-sanctuary-runtime']:
  assert not any(x in B[k] for x in ['AudioContext','speechSynthesis','mediaSession','localStorage.clear','indexedDB.deleteDatabase','dispatchEvent(new MouseEvent'])
 return {'unchanged':['audio','counter','recording','journey','canonical tefekkür','dock placement','atmosphere']}
check('Audio, counter, recording, journey and placement owners byte-identical',audio)
def release():
 m=json.loads((P/'manifest.webmanifest').read_text());marker=json.loads((P/'__sukun_build_r709__.json').read_text());notes=json.loads((P/'surumler.json').read_text());sw=(P/'sw.js').read_text()
 assert b.find('meta',attrs={'name':'sukun-build'})['content']=='r709'
 assert b.find(id='surumEtiket').text.endswith('r709')
 assert notes[0]['v']=='r709' and notes==json.loads(b.find('script',id='surumNotlari').string)
 assert marker['build']=='r709' and marker['base']=='r708'
 assert 'manifest.webmanifest?v=r709' in new
 assert m['start_url'].endswith('v=r709') and all(x['url'].endswith('v=r709') for x in m['shortcuts'])
 assert "const SURUM = 'r709'" in sw and "const CACHE = 'sukun-r709-20260908a'" in sw
 assert "const BUILD_MARKER='./__sukun_build_r709__.json'" in sw
 assert "register('./sw.js?v='+encodeURIComponent(SW_CLIENT_BUILD)" in new
 assert not (P/'__sukun_build_r708__.json').exists()
 return {'build':'r709','cache':'sukun-r709-20260908a'}
check('Footer, metadata, manifest, SW, cache and history synchronized',release)
def assets():
 sw=(P/'sw.js').read_text();assert "'./assets/tefekkur-sanctuary.webp'" in sw.split('const CORE = [')[1].split('];')[0]
 assert (P/'assets/tefekkur-sanctuary.webp').is_file()
 for n,data in old_icons.items():assert (P/n).read_bytes()==data,n
 assert 'url(\'./assets/tefekkur-sanctuary.webp\')' in new
 return {'artBytes':(P/'assets/tefekkur-sanctuary.webp').stat().st_size,'iconsPreserved':3}
check('Local art included in atomic offline shell; original icons preserved',assets)
def safety():
 code=B['r709-sanctuary-runtime'];style=b.find('style',id='r709-sanctuary-style').get_text()
 assert 'pointer-events:none' in style and '#r709SceneArt' in style
 assert 'r709-sanctuary' in style and 'sukun-tefekkur-mode' in style
 assert 'localStorage.' not in code and 'indexedDB.' not in code
 assert 'AudioContext' not in code and 'speechSynthesis' not in code
 assert 'MutationObserver' in code and 'childList:true' in code
 return {'scope':'Tefekkür only','dataWrites':0,'audioChanges':0}
check('Decorative hit-test isolation, no new data or audio mutations',safety)
def parse():
 count=0
 for id,code in B.items():
  node=b.find('script',id=id)
  if node.get('type','') not in ('','text/javascript','application/javascript','module'):continue
  subprocess.run(['node','--check'],input=code,text=True,capture_output=True,check=True);count+=1
 subprocess.run(['node','--check'],input=(P/'sw.js').read_text(),text=True,capture_output=True,check=True)
 return {'parsedScripts':count,'serviceWorker':True}
check('All executable JavaScript and Service Worker parse',parse)
def legacy():
 assert (P/'diagnostics/history/r708_package/RAPOR_r708.md').is_file()
 assert (P/'diagnostics/history/r708_package/CHECKSUMS_r708.sha256').is_file()
 assert (P/'diagnostics/history/r708_package/__sukun_build_r708__.json').is_file()
 return {'previousReleasePreserved':'r708'}
check('Previous release retained in diagnostic history',legacy)
out={'kind':'r709-source-integrity','total':len(checks),'passed':sum(x['status']=='PASS' for x in checks),'failed':sum(x['status']=='FAIL' for x in checks),'checks':checks}
(P/'diagnostics/r709_integrity_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False,indent=2))
if out['failed']:raise SystemExit(1)
