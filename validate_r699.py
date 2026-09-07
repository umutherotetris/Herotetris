from pathlib import Path
from bs4 import BeautifulSoup
import collections, hashlib, json, re, subprocess, tempfile, zipfile
root=Path('/mnt/data/sukun_sources');src=root/'r698';out=root/'r699'
html=(out/'nero.html').read_text();soup=BeautifulSoup(html,'html.parser')
old=BeautifulSoup((src/'nero.html').read_text(),'html.parser')
assert soup.select_one('meta[name="sukun-build"]')['content']=='r699'
assert 'build 2026-09-07-r699' in soup.select_one('#surumEtiket').get_text()
assert "register('./sw.js?v=r699'" in html
assert "__sukun_build_r699__.json" in html
assert len(soup.find_all('script'))==len(old.find_all('script'))==185
assert [x.get('id') for x in soup.find_all('script')]==[x.get('id') for x in old.find_all('script')]
assert [str(x) for x in soup.find_all('style')]==[str(x) for x in old.find_all('style')]
assert collections.Counter(x['id'] for x in soup.find_all(id=True)).most_common(1)[0][1]==1
assert set(x['id'] for x in soup.find_all(id=True))==set(x['id'] for x in old.find_all(id=True))
manifest=json.loads((out/'manifest.webmanifest').read_text());marker=json.loads((out/'__sukun_build_r699__.json').read_text())
assert marker['build']=='r699'
assert manifest['start_url'].endswith('?v=r699') and all(x['url'].endswith('?v=r699') for x in manifest['shortcuts'])
assert manifest['id']==json.loads((src/'manifest.webmanifest').read_text())['id']
sw=(out/'sw.js').read_text();assert "const SURUM = 'r699'" in sw
assert "const BUILD_MARKER='./__sukun_build_r699__.json'" in sw
assert "const CACHE = 'sukun-r699-20260907a'" in sw
embedded=json.loads(soup.select_one('#surumNotlari').string);external=json.loads((out/'surumler.json').read_text())
assert embedded[0]==external[0] and embedded[0]['v']=='r699'
assert embedded[1:]==json.loads(BeautifulSoup((src/'nero.html').read_text(),'html.parser').select_one('#surumNotlari').string)
assert external[1:]==json.loads((src/'surumler.json').read_text())
assert "const VERSION='r699'" in soup.select_one('#r640-zikir-transport-gate').get_text()
assert 'version:\'r699\'' in html
assert 'window.SukunZikirTransaction?.cancelUnconfirmed?.(reason)' in html
assert 'abortPending?.(\'auto-stop\')' in html
js=[]
for n,tag in enumerate(soup.find_all('script')):
 typ=tag.get('type','').lower()
 if typ in ('','text/javascript','application/javascript','module') and not tag.get('src'):
  js.append((tag.get('id') or str(n),tag.string or tag.get_text()))
with tempfile.TemporaryDirectory() as d:
 for n,(name,body) in enumerate(js):
  f=Path(d)/f'{n}.js';f.write_text(body)
  r=subprocess.run(['node','--check',str(f)],capture_output=True,text=True)
  if r.returncode:raise RuntimeError(f'Syntax {name}: {r.stderr}')
 for name in ['sw.js']:
  r=subprocess.run(['node','--check',str(out/name)],capture_output=True,text=True)
  if r.returncode:raise RuntimeError(r.stderr)
icons=['icon-192.png','icon-512.png','icon-512-maskable.png']
assert all((src/f).read_bytes()==(out/f).read_bytes() for f in icons)
print(json.dumps({'build':'r699','inlineJavascriptChecked':len(js),'scriptNodes':len(soup.find_all('script')),'domIds':len(soup.find_all(id=True)),'duplicateIds':0,'cssPreserved':True,'domIdentifiersPreserved':True,'releaseHistoryPreserved':True,'manifestSynchronized':True,'serviceWorkerSynchronized':True,'markerPresent':True,'iconsPreserved':True,'syntax':'PASS'},ensure_ascii=False,indent=2))
