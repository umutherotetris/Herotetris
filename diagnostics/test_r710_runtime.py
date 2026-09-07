from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,time,sys
P=Path(__file__).resolve().parents[1]
html=(P/'nero.html').read_text()
for name in ['tefekkur-sanctuary.webp','tefekkur-sanctuary-r710.webp','tefekkur-sanctuary-r710-small.webp']:
 art=base64.b64encode((P/'assets'/name).read_bytes()).decode()
 html=html.replace("url('./assets/"+name+"')","url('data:image/webp;base64,"+art+"')")
results=[]
def check(name,fn):
 print('START',name,flush=True)
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)[:1200]})
 print('END',name,results[-1]['status'],flush=True)
def init(page):
 page.route('**/*',lambda r:r.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.add_style_tag(content='#acilisPerde,#onboardCard,#dailyCard{display:none!important}')
 page.evaluate("() => {const e=document.getElementById('acilisPerde');if(e){e.hidden=true;e.classList.add('bitti')}document.body.classList.remove('r608-opening-active','r610-opening-active');for(const id of ['onboardCard','dailyCard']){const e=document.getElementById(id);if(e)e.hidden=true}}")
 page.evaluate('window.SUKUN_TEFEKKUR.enter()');page.wait_for_timeout(350)
def ev(page,code):return page.evaluate('() => '+code)
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='block')
 page=ctx.new_page();page.set_default_timeout(5000)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 init(page)
 check('r710 identity and live canonical controls',lambda:(lambda d: d if d['build']=='r710' and d['class'] and d['count']==0 else (_ for _ in ()).throw(AssertionError(d)))(ev(page,"({build:document.querySelector('meta[name=sukun-build]').content,class:document.body.classList.contains('r710-sanctuary'),count:Z.count})")))
 def counter():
  page.evaluate('window.__r476SilentCatchup=false;Z.tick=false;Z.vib=false')
  page.locator('#plusBtn').scroll_into_view_if_needed()
  page.locator('#plusBtn').tap()
  a=ev(page,"({raw:Z.count,shown:Number(document.getElementById('cntBig').textContent)})")
  assert a=={'raw':1,'shown':1},a
  page.locator('#undoBtn').tap()
  b=ev(page,"({raw:Z.count,shown:Number(document.getElementById('cntBig').textContent)})")
  assert b=={'raw':0,'shown':0},b
  page.locator('#plusBtn').tap()
  c=ev(page,"({raw:Z.count,shown:Number(document.getElementById('cntBig').textContent)})")
  assert c=={'raw':1,'shown':1},c
  return [a,b,c]
 check('native touch +1/-1 immediate counter coherence',counter)
 def counts():
  page.evaluate('window.__r476SilentCatchup=false;Z.tick=false;Z.vib=false;Z.target=3;Z.count=2;Z.devir=0;Z.adv=false;zUI()')
  page.locator('#plusBtn').tap()
  v=ev(page,"({raw:Z.count,shown:Number(document.getElementById('cntBig').textContent),devir:Z.devir,target:Z.target})")
  assert v['raw']==0 and v['shown']==0 and v['devir']==1,v
  page.locator('#undoBtn').tap()
  u=ev(page,"({raw:Z.count,shown:Number(document.getElementById('cntBig').textContent),devir:Z.devir})")
  assert u['raw']==2 and u['shown']==2 and u['devir']==0,u
  return {'completed':v,'undone':u}
 check('target transition and undo ledger',counts)
 def silent_catchup():
  return page.evaluate('''() => {
   Z.target=33;Z.count=0;Z.devir=0;Z.adv=false;Z.auto=false;zUI();
   const before=cntBig.textContent;
   window.__r476SilentCatchup=true;try{SukunZikirRep()}finally{window.__r476SilentCatchup=false}
   const silent={raw:Z.count,shown:cntBig.textContent};
   if(silent.raw!==1||silent.shown!==before)throw Error('silent catchup contract');
   zUI();const visible={raw:Z.count,shown:Number(cntBig.textContent)};
   if(visible.raw!==1||visible.shown!==1)throw Error('visible catchup reconciliation');
   return {silent,visible};
  }''')
 check('silent lock-screen catchup preserves deferred DOM contract',silent_catchup)
 def repeated_taps():
  page.evaluate('window.__r476SilentCatchup=false;Z.tick=false;Z.vib=false;Z.target=99;Z.targetMode="fixed";Z.count=0;Z.devir=0;Z.adv=false;Z.auto=false;zUI()')
  plus=page.locator('#plusBtn');undo=page.locator('#undoBtn');plus.scroll_into_view_if_needed()
  for i in range(1,11):
   plus.tap();d=ev(page,"({raw:Z.count,shown:Number(cntBig.textContent)})")
   assert d=={'raw':i,'shown':i},(i,d)
  for i in range(9,-1,-1):
   undo.tap();d=ev(page,"({raw:Z.count,shown:Number(cntBig.textContent)})")
   assert d=={'raw':i,'shown':i},(i,d)
  return {'nativeTaps':20,'finalCount':0,'duplicates':0}
 check('twenty native taps, no lost or duplicate counts',repeated_taps)

 def probe_audio():
  return page.evaluate('''async()=>{
   const H=window.SukunAudioHub,L=window.AudioLife,T=window.SukunAudioTruth,R=window.SukunR693Integrity;
   window.__r710Fixture=false;L.register('r710-test',()=>window.__r710Fixture);
   let events=0;const on=()=>events++;window.addEventListener('sukun:audiostate',on);
   L.markUserPlay('r710-test');H.userPaused=false;H.set('playing','ghost');
   R.reconcile('r710-ghost');T.refresh('r710-ghost');
   const ghost={hub:H.state,life:L.state,truth:T.snapshot().state};
   await new Promise(r=>setTimeout(r,250));const after=events;
   L.markUserPause('r710-user-pause');H.userPaused=true;H.set('paused','r710-user-pause');R.reconcile('r710-user-pause');T.refresh('r710-user-pause');
   const pause={hub:H.state,life:L.state,userPaused:L.userPaused,truth:T.snapshot().state};
   L.markUserPlay('r710-user-play');H.userPaused=false;L.set('idle','r710-test-reset');H.set('idle','r710-test-reset');
   window.__r710Fixture=true;L.set('playing','r710-physical');R.reconcile('r710-physical');T.refresh('r710-physical');
   const physical={hub:H.state,life:L.state,truth:T.snapshot().state};
   window.__r710Fixture=false;R.reconcile('r710-physical-end');T.refresh('r710-physical-end');
   const ended={hub:H.state,life:L.state,truth:T.snapshot().state};
   L.set('preparing','r710-prepare');R.reconcile('r710-prepare');T.refresh('r710-prepare');
   const pending={life:L.state,truth:T.snapshot().state};
   await new Promise(r=>setTimeout(r,2700));R.reconcile('r710-expire');T.refresh('r710-expire');
   const expired={life:L.state,truth:T.snapshot().state};
   window.removeEventListener('sukun:audiostate',on);
   return{ghost,after,pause,physical,ended,pending,expired,events};
  }''')
 def audio():
  d=probe_audio();assert d['ghost']=={'hub':'idle','life':'idle','truth':'idle'},d
  assert d['pause']['life']=='paused' and d['pause']['userPaused'],d
  assert d['physical']['truth']=='playing' and d['physical']['life']=='playing',d
  assert d['ended']['life']=='idle' and d['ended']['truth']=='idle',d
  assert d['pending']['life']=='preparing',d
  assert d['expired']['life']=='idle',d
  assert d['after']<25 and d['events']<100,d
  return d
 check('audio truth, physical play, pause latch, terminal and pending grace',audio)
 def soak():
  before=ev(page,"({terminal:SukunR693Integrity.snapshot().reconciles,truth:SukunAudioTruth.snapshot().seq})")
  page.wait_for_timeout(15000)
  after=ev(page,"({terminal:SukunR693Integrity.snapshot().reconciles,truth:SukunAudioTruth.snapshot().seq})")
  assert after['terminal']-before['terminal']<35 and after['truth']-before['truth']<35,{'before':before,'after':after}
  return {'before':before,'after':after}
 check('fifteen-second idle event-storm soak',soak)
 def modal():
  page.evaluate("window.SukunDockSize.set('mini');window.SukunR699Layout.measure('r710-modal')")
  page.locator('#tefExitBtn').scroll_into_view_if_needed()
  box=page.locator('#tefExitBtn').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']/2
  hit=page.evaluate('([x,y])=>document.elementFromPoint(x,y)?.closest("button")?.id',[x,y])
  assert hit=='tefExitBtn',hit
  page.locator('#tefExitBtn').tap()
  assert not ev(page,"document.body.classList.contains('sukun-tefekkur-mode')")
  return {'hit':hit,'exited':True}
 check('canonical exit native hit-test',modal)
 check('no uncaught browser errors',lambda:True if not errors else (_ for _ in ()).throw(AssertionError(errors)))
 ctx.close();browser.close()

def layout_suite():
 from pathlib import Path
 import subprocess
 original=(P/'diagnostics/test_browser_r709.py').read_text()
 original=original.replace("geometry(page)['build']=='r709'", "geometry(page)['build']=='r710'").replace("'r709' in geometry(page)['footer']", "'r710' in geometry(page)['footer']")
 original=original.replace("art=base64.b64encode((P/'assets/tefekkur-sanctuary.webp').read_bytes()).decode()\nhtml=html.replace(\"url('./assets/tefekkur-sanctuary.webp')\", \"url('data:image/webp;base64,\"+art+\"')\")", "for name in ['tefekkur-sanctuary.webp','tefekkur-sanctuary-r710.webp','tefekkur-sanctuary-r710-small.webp']:\n art=base64.b64encode((P/'assets'/name).read_bytes()).decode()\n html=html.replace(\"url('./assets/\"+name+\"')\",\"url('data:image/webp;base64,\"+art+\"')\")")
 original=original.replace("r709_browser_results.json","r710_layout_results.json").replace("r709_full_html_390x844.png","r710_full_html_390x844.png")
 original=original.replace("kind':'r709-full-HTML", "kind':'r710-full-HTML")
 (P/'diagnostics/test_layout_r710.py').write_text(original)
 r=subprocess.run([sys.executable,str(P/'diagnostics/test_layout_r710.py')],capture_output=True,text=True,timeout=180)
 return {'returncode':r.returncode,'stdout':r.stdout[-3000:],'stderr':r.stderr[-1000:]}
# Layout is executed in a separate process so its result remains independent.
if '--with-layout' in sys.argv:
 d=layout_suite();check('full HTML responsive layout suite',lambda:d if d['returncode']==0 else (_ for _ in ()).throw(AssertionError(d)))
out={'kind':'r710-runtime','environment':'Fresh isolated Chromium, actual HTML and native touch; synthetic physical audio state only, not Android audio hardware','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(P/'diagnostics/r710_runtime_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':out['passed'],'total':out['total'],'failures':[x for x in results if x['status']=='FAIL']},ensure_ascii=False,indent=2))
if out['failed']:sys.exit(1)
