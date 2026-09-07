from pathlib import Path
from bs4 import BeautifulSoup
import json,re,hashlib
P=Path(__file__).resolve().parents[1]
html=P/'nero.html'
s=html.read_text()
s=s.replace('<meta name="sukun-build" content="r708">','<meta name="sukun-build" content="r709">',1)
s=s.replace('SÜKÛN v20.21 — build 2026-09-07-r708','SÜKÛN v20.21 — build 2026-09-08-r709',1)
s=s.replace("const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r708';","const SW_CLIENT_BUILD=document.querySelector('meta[name=\"sukun-build\"]')?.content||'r709';",1)
# Preserve the old release module but make its identity derive from metadata.
identity='''(()=>{
'use strict';
const meta=document.querySelector('meta[name="sukun-build"]');
const build=meta?.content||'r709',date='2026-09-08';
const label=document.getElementById('surumEtiket');
if(label){const text='SÜKÛN v20.21 — build '+date+'-'+build;if(label.textContent!==text)label.textContent=text;label.dataset.sukunBuild=build;}
window.SukunReleaseIdentity=Object.freeze({build,version:'r709',snapshot:()=>({build,footer:label?.textContent||'',meta:meta?.content||''})});
})();'''
s=re.sub(r'(<script id="r708-release-identity-runtime">).*?(</script>)',lambda m:m.group(1).replace('r708-release-identity','r709-release-identity')+identity+m.group(2),s,count=1,flags=re.S)
# Release history is data, not source code. Keep all previous notes unchanged.
notes='r709 · Sinematik Tefekkür sahnesi: gerçek kaynak görsellerden yazısız cami/Mevlevî arka planı, zümrüt-mavi ışıklar ve altın geometrik sayaç süsü; dar Hedef/Kalan kartları, kompakt ulaşılabilir kontroller. Ses, sayaç, seyir, kayıt ve r708 kaydırma otoriteleri korunur.'
# Keep the complete structured history and prepend one new release record.
history_re=r'(<script type="application/json" id="surumNotlari">)(.*?)(</script>)'
m=re.search(history_re,s,re.S)
if not m:raise RuntimeError('embedded release history not found')
history=json.loads(m.group(2))
history.insert(0,{'v':'r709','t':'8 Eylül 2026','b':[notes]})
s=s[:m.start()]+m.group(1)+json.dumps(history,ensure_ascii=False,indent=2)+m.group(3)+s[m.end():]
# Styles and scripts are intentionally appended last. No existing module is replaced.
css=(P/'diagnostics/style-r709-sanctuary.css').read_text()
js=(P/'diagnostics/r709-sanctuary-runtime.js').read_text()
s=s.replace('</body>','<style id="r709-sanctuary-style">\n'+css+'\n</style>\n<script id="r709-sanctuary-runtime">\n'+js+'\n</script>\n</body>',1)
html.write_text(s)
# External metadata and offline shell.
manifest=json.loads((P/'manifest.webmanifest').read_text())
manifest['start_url']='./nero.html?v=r709'
for shortcut in manifest.get('shortcuts',[]):shortcut['url']='./nero.html?v=r709'
(P/'manifest.webmanifest').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
sw=P/'sw.js';t=sw.read_text().replace('/* SÜKÛN r708 — Focus Boundary and Release Identity */','/* SÜKÛN r709 — Cinematic Sanctuary */',1)
t=t.replace("const SURUM = 'r708';","const SURUM = 'r709';",1).replace("const CACHE = 'sukun-r708-20260907a';","const CACHE = 'sukun-r709-20260908a';",1)
t=t.replace("const BUILD_MARKER='./__sukun_build_r708__.json';","const BUILD_MARKER='./__sukun_build_r709__.json';",1)
t=t.replace("  './manifest.webmanifest'\n", "  './manifest.webmanifest',\n  './assets/tefekkur-sanctuary.webp'\n",1)
t=t.replace('const NOTLAR = [','const NOTLAR = [\n  '+json.dumps(notes,ensure_ascii=False)+',',1)
sw.write_text(t)
(P/'__sukun_build_r708__.json').rename(P/'diagnostics/history/r708_package/__sukun_build_r708__.json') if (P/'diagnostics/history/r708_package').exists() else None
if (P/'__sukun_build_r708__.json').exists():
 (P/'diagnostics/history/r708_package').mkdir(parents=True,exist_ok=True)
 (P/'__sukun_build_r708__.json').rename(P/'diagnostics/history/r708_package/__sukun_build_r708__.json')
(P/'__sukun_build_r709__.json').write_text(json.dumps({'build':'r709','date':'2026-09-08','feature':'cinematic-sanctuary-compact-ui','base':'r708'},ensure_ascii=False,indent=2)+'\n')
versions=json.loads((P/'surumler.json').read_text())
if isinstance(versions,list):versions.insert(0,notes)
elif isinstance(versions,dict):
 for key,value in versions.items():
  if isinstance(value,list) and value and isinstance(value[0],str):value.insert(0,notes);break
else:raise RuntimeError('unknown history format')
(P/'surumler.json').write_text(json.dumps(versions,ensure_ascii=False,indent=2)+'\n')
print('built',html.stat().st_size,'bytes; scripts',len(BeautifulSoup(s,'html.parser').find_all('script')))
