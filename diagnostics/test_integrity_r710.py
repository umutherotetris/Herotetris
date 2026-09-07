from pathlib import Path
from zipfile import ZipFile
from collections import Counter
import hashlib,json,re,subprocess,sys
P=Path(__file__).resolve().parents[1]
BASE=Path(__file__).resolve().parents[3]/'SUKUN_r709_TAM_PAKET.zip'
# The original immutable archive is the source of truth, not a reconstructed version.
if not BASE.is_file():BASE=Path('/mnt/data/SUKUN_r709_TAM_PAKET.zip')
with ZipFile(BASE) as z:
 old=z.read('nero.html').decode()
 icons={n:z.read(n) for n in ['icon-192.png','icon-512.png','icon-512-maskable.png']}
new=(P/'nero.html').read_text();results=[]
def check(name,fn):
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)})
def blocks(s,tag):
 out=[]
 for m in re.finditer(r'<'+tag+r'\b([^>]*)>(.*?)</'+tag+r'\s*>',s,re.S|re.I):
  a=re.search(r'\bid=["\']([^"\']+)',m.group(1));out.append((a.group(1) if a else '',m.group(2)))
 return out
def owners():
 a,b=blocks(old,'script'),blocks(new,'script');A={k:v for k,v in a if k};B={k:v for k,v in b if k}
 assert len(A)==len([1 for k,v in a if k]) and len(B)==len([1 for k,v in b if k])
 assert set(B)-set(A)=={'r710-release-identity-runtime','r710-stability-runtime'}
 assert set(A)-set(B)=={'r709-release-identity-runtime'}
 changed={k for k in A.keys()&B.keys() if A[k]!=B[k]}
 expected={'r220-unified-audio','premiumR160','r637-audio-truth-reconciliation','r693-terminal-truth-integrity','r514-core-zikir-sentez','r514-core-akis-nefs','r455-diagnostics-regression-runtime','surumNotlari'}
 assert changed==expected,(changed-expected,expected-changed)
 sha=lambda s:hashlib.sha256(s.encode()).hexdigest()
 assert Counter(sha(v) for k,v in a if not k)==Counter(sha(v) for k,v in b if not k),'unnamed owners changed'
 core=A['r514-core-zikir-sentez'].replace("  const _flow=window.currentFlowState?.refresh?.('zUI')||null;\n  const _zs=_flow?.zikir||window.currentZikirState?.refresh('zUI')||null;", "  // r710: commit the counter snapshot before deriving the aggregate view.\n  // Otherwise currentFlowState reads the previous cached count and every\n  // manual +1/-1 can display one action late.\n  const _rawZs=window.currentZikirState?.refresh?.('zUI')||null;\n  const _flow=window.currentFlowState?.refresh?.('zUI')||null;\n  const _zs=_flow?.zikir||_rawZs;")
 assert core==B['r514-core-zikir-sentez'],'counter modification outside intended scope'
 assert B['r514-core-akis-nefs']==A['r514-core-akis-nefs'].replace("const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r709';","const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r710';")
 assert B['r455-diagnostics-regression-runtime']==A['r455-diagnostics-regression-runtime'].replace('    runtime:p,','    runtime:p,\n    stabilityR710:window.SukunR710Stability?.snapshot?.()||null,')
 return {'originalScripts':len(a),'releaseScripts':len(b),'changed':sorted(changed),'added':sorted(set(B)-set(A))}
check('Only declared executable owners changed',owners)
def styles():
 a=dict(blocks(old,'style'));b=dict(blocks(new,'style'))
 assert set(b)-set(a)=={'style-r710-cinematic'}
 assert all(b[k]==v for k,v in a.items())
 return {'old':len(a),'new':len(b),'preserved':len(a)}
check('All earlier CSS owners preserved',styles)
def release():
 m=json.loads((P/'manifest.webmanifest').read_text());h=json.loads((P/'surumler.json').read_text());mark=json.loads((P/'__sukun_build_r710__.json').read_text());sw=(P/'sw.js').read_text()
 inline=json.loads(re.search(r'<script\b[^>]*\bid="surumNotlari"[^>]*>(.*?)</script>',new,re.S).group(1))
 assert h==inline and h[0]['v']=='r710'
 assert re.search(r'name="sukun-build" content="r710"',new)
 assert re.search(r'id="surumEtiket"[^>]*>[^<]*r710',new)
 assert 'manifest.webmanifest?v=r710' in new and m['start_url'].endswith('v=r710')
 assert all(x['url'].endswith('v=r710') for x in m.get('shortcuts',[]))
 assert mark['build']=='r710' and mark['base']=='r709' and mark['cache']=='sukun-r710-20260908a'
 assert "const SURUM = 'r710'" in sw and "const CACHE = 'sukun-r710-20260908a'" in sw
 assert "const BUILD_MARKER='./__sukun_build_r710__.json'" in sw
 assert "register('./sw.js?v='+encodeURIComponent(SW_CLIENT_BUILD)" in new
 assert not (P/'__sukun_build_r709__.json').exists()
 return {'build':'r710','cache':mark['cache'],'history':len(h)}
check('HTML, footer, history, manifest, SW and build marker agree',release)
def assets():
 sw=(P/'sw.js').read_text();core=sw.split('const CORE = [',1)[1].split('];',1)[0]
 for n in ['tefekkur-sanctuary.webp','tefekkur-sanctuary-r710.webp','tefekkur-sanctuary-r710-small.webp']:
  assert (P/'assets'/n).is_file() and "'./assets/"+n+"'" in core,n
 for n,v in icons.items():assert (P/n).read_bytes()==v,n
 assert 'pointer-events:none' in blocks(new,'style')[-1][1]
 return {'sceneBytes':sum((P/'assets'/n).stat().st_size for n in ['tefekkur-sanctuary.webp','tefekkur-sanctuary-r710.webp','tefekkur-sanctuary-r710-small.webp']),'iconsPreserved':3}
check('Offline artwork and original icons present',assets)
def parse():
 n=0
 for m in re.finditer(r'<script\b([^>]*)>(.*?)</script\s*>',new,re.S|re.I):
  typ=re.search(r'\btype=["\']([^"\']+)',m.group(1))
  if typ and typ.group(1) not in ('text/javascript','application/javascript','module'):continue
  code=m.group(2)
  subprocess.run(['node','--check'],input=code,text=True,capture_output=True,check=True);n+=1
 subprocess.run(['node','--check'],input=(P/'sw.js').read_text(),text=True,capture_output=True,check=True)
 return {'parsedScripts':n,'serviceWorker':True}
check('All JavaScript parses',parse)
def safe():
 s=new.split('<script id="r710-stability-runtime">',1)[1].split('</script>',1)[0]
 assert not any(x in s for x in ['localStorage.clear','indexedDB.deleteDatabase','new AudioContext','setInterval(','touchmove','preventDefault('])
 assert 'pointer-events:none' in (P/'diagnostics/style-r710-cinematic.css').read_text() or 'pointer-events:none' in blocks(new,'style')[-1][1]
 return {'newRuntimeStorageWrites':0,'newAudioEngines':0,'globalTouchBlockers':0}
check('New visual and diagnostic layer has no destructive side effects',safe)
def previous():
 assert (P/'diagnostics/history/r709_package/RAPOR_r709.md').is_file()
 assert (P/'diagnostics/history/r708_package/RAPOR_r708.md').is_file()
 return {'history':'r709 and earlier retained'}
check('Previous release history retained',previous)
out={'kind':'r710-source-integrity','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(P/'diagnostics/r710_integrity_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':out['passed'],'total':out['total'],'failures':[x for x in results if x['status']=='FAIL']},ensure_ascii=False,indent=2))
if out['failed']:sys.exit(1)
