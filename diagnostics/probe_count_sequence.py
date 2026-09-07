from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json
P=Path(__file__).resolve().parents[1]
h=(P/'nero.html').read_text()
for name in ['tefekkur-sanctuary.webp','tefekkur-sanctuary-r710.webp','tefekkur-sanctuary-r710-small.webp']:
 h=h.replace("url('./assets/"+name+"')","url('data:image/webp;base64,"+base64.b64encode((P/'assets'/name).read_bytes()).decode()+"')")
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='block')
 page=c.new_page();page.route('**/*',lambda r:r.abort());page.set_content(h,wait_until='domcontentloaded',timeout=60000)
 page.add_style_tag(content='#acilisPerde,#onboardCard,#dailyCard{display:none!important}')
 page.evaluate("() => {const e=document.getElementById('acilisPerde');if(e){e.hidden=true;e.classList.add('bitti')}document.body.classList.remove('r608-opening-active','r610-opening-active');for(const id of ['onboardCard','dailyCard']){const e=document.getElementById(id);if(e)e.hidden=true}}")
 page.evaluate('window.SUKUN_TEFEKKUR.enter()');page.wait_for_timeout(350)
 page.evaluate('''() => {
 window.__countTrace=[];
 const snap=()=>({raw:Z.count,shown:document.getElementById('cntBig').textContent,model:currentZikirState.snapshot().count,flow:currentFlowState.snapshot().zikir?.count,source:currentFlowState.snapshot().zikir?.source,smart:R170?.Player?.playing,smartPaused:R170?.Player?.paused});
 const log=(what)=>{__countTrace.push({what,...snap()});if(__countTrace.length>100)__countTrace.shift()};
 const old=zUI;zUI=function(){log('zUI-before');const r=old.apply(this,arguments);log('zUI-after');return r};
 currentZikirState.subscribe(s=>log('zikir-publish:'+s.reason),{immediate:false});
 currentFlowState.subscribe(s=>log('flow-publish:'+s.reason),{immediate:false});
 window.__r476SilentCatchup=true;log('baseline');
 }''')
 page.locator('#plusBtn').scroll_into_view_if_needed();page.locator('#plusBtn').tap()
 print('AFTER PLUS',json.dumps(page.evaluate('__countTrace'),ensure_ascii=False,indent=2))
 page.wait_for_timeout(150)
 print('SETTLED',json.dumps(page.evaluate('({raw:Z.count,shown:cntBig.textContent,z:currentZikirState.snapshot(),flow:currentFlowState.snapshot().zikir})'),ensure_ascii=False,default=str)[:6000])
 page.locator('#undoBtn').tap();print('AFTER UNDO',json.dumps(page.evaluate('__countTrace.slice(-20)'),ensure_ascii=False,indent=2))
 c.close();b.close()
