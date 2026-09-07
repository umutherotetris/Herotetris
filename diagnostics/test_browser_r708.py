from pathlib import Path
from playwright.sync_api import sync_playwright
import json,sys
D=Path(__file__).resolve().parent.parent
html=(D/'nero.html').read_text(encoding='utf-8')
results=[]
def check(name,fn):
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)})

def geometry(page):
 return page.evaluate('''() => {
 const $=id=>document.getElementById(id);
 const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {top:r.top,bottom:r.bottom,height:r.height,width:r.width,display:s.display,overflow:s.overflowY,paddingBottom:s.paddingBottom}};
 const card=document.querySelector('#tab-zkr>.card.zCtl'),wrap=document.querySelector('.wrap'),tab=$('tab-zkr'),host=$('r170Now'),peek=$('r433DockPeek');
 const shown=e=>{if(!e||e.hidden)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
 const dock=shown(host)?host:shown(peek)?peek:null;
 return {scrollY:scrollY,docHeight:document.documentElement.scrollHeight,viewport:innerHeight,card:rect(card),wrap:rect(wrap),tab:rect(tab),dock:rect(dock),dockKind:dock===host?'host':dock===peek?'peek':'none',host:rect(host),peek:rect(peek),topPadding:getComputedStyle(tab).paddingTop,wrapPadding:getComputedStyle(wrap).paddingBottom,reserve:parseFloat(document.documentElement.style.getPropertyValue('--r699-content-reserve'))||0,mode:window.SukunR699Layout?.snapshot()?.mode,bodyScroll:document.body.scrollHeight,focus:document.body.classList.contains('sukun-tefekkur-mode')};
 }''')

def prepare(page):
 page.route('**/*',lambda r:r.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.add_style_tag(content='#acilisPerde,#onboardCard,#dailyCard{display:none!important}')
 page.evaluate('''() => {const p=document.getElementById('acilisPerde');if(p){p.hidden=true;p.classList.add('bitti')}document.body.classList.remove('r608-opening-active','r610-opening-active');for(const id of ['onboardCard','dailyCard']){const e=document.getElementById(id);if(e)e.hidden=true}}''')
 page.evaluate('window.SUKUN_TEFEKKUR.enter()')
 page.wait_for_timeout(160)
 page.evaluate('''() => {document.body.classList.add('r431-dock-visible','r591-flow-active');document.body.classList.remove('r433-dock-hidden');window.SukunDockSize.set('mini');window.SukunR699Layout.measure('r708-test-mini')}''')
 page.wait_for_timeout(160)

def set_mode(page,mode):
 page.evaluate('''m => {const b=document.body;b.classList.remove('r588-mode-mini','r588-mode-midi','r588-mode-max');b.classList.add('r588-mode-'+m);window.SukunR699Layout.measure('r708-test-'+m)}''',mode)
 page.wait_for_timeout(80)

def bottom_check(page):
 page.evaluate('''() => window.scrollTo(0,document.documentElement.scrollHeight)''')
 page.wait_for_timeout(70)
 g=geometry(page)
 assert g['dock'],g
 assert abs(g['wrap']['bottom']-g['tab']['bottom'])<2,g
 assert abs(float(g['wrapPadding'].replace('px','')))<.2,g
 assert abs(g['tab']['height']-g['card']['bottom']+g['tab']['top']-g['reserve'])<80,g
 if g['scrollY']>1:
  gap=g['dock']['top']-g['card']['bottom']
  assert gap>=7 and gap<=16,{'gap':gap,'geometry':g}
  g['gap']=gap
 assert g['dock']['bottom']<=g['viewport']+1,g
 return {k:g[k] for k in ['scrollY','docHeight','viewport','gap','mode','dockKind','wrapPadding','reserve'] if k in g}

with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,640),(390,844),(412,915),(640,360),(1280,900)]:
  context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=w<700,has_touch=w<700,reduced_motion='reduce')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:prepare(page)
  except Exception as e:
   results.append({'name':f'{w}x{h}: full HTML startup','status':'FAIL','error':str(e)});context.close();continue
  check(f'{w}x{h}: full HTML startup',lambda: {'build':page.evaluate("document.querySelector('meta[name=sukun-build]').content"),'errors':errors} if not errors and page.evaluate("document.querySelector('meta[name=sukun-build]').content")=='r708' else (_ for _ in ()).throw(AssertionError(errors)))
  for mode in ['mini','midi','max']:
   set_mode(page,mode)
   check(f'{w}x{h}: {mode} single reading boundary',lambda:bottom_check(page))
  def entry():
   page.evaluate('''() => {window.SUKUN_TEFEKKUR.exit();window.scrollTo(0,document.documentElement.scrollHeight)}''')
   page.wait_for_timeout(60)
   page.evaluate('window.SUKUN_TEFEKKUR.enter()')
   page.wait_for_timeout(90)
   g=geometry(page)
   assert g['focus'] and abs(g['scrollY'])<1,g
   assert g['card']['top']>=8,g
   # A fresh explicit entry must not steal a later user scroll.
   page.evaluate('window.scrollTo(0,120)')
   page.wait_for_timeout(130)
   assert page.evaluate('window.scrollY')>0
   return {'entryScroll':0,'userScrollPreserved':True,'cardTop':g['card']['top']}
  check(f'{w}x{h}: entry reset and later scroll',entry)
  def exit_hit():
   set_mode(page,'mini')
   page.locator('#tefExitBtn').scroll_into_view_if_needed(timeout=5000)
   page.wait_for_timeout(50)
   r=page.locator('#tefExitBtn').bounding_box();assert r and r['width']>=44 and r['height']>=44,r
   x=r['x']+r['width']/2;y=r['y']+r['height']/2
   target=page.evaluate('''([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.id||null''',[x,y])
   assert target=='tefExitBtn',{'target':target,'rect':r}
   page.mouse.click(x,y);page.wait_for_timeout(80)
   assert not page.evaluate("document.body.classList.contains('sukun-tefekkur-mode')")
   return {'target':target,'height':r['height'],'exited':True}
  check(f'{w}x{h}: native exit hit-test',exit_hit)
  if w==390:
   # A genuinely hidden player is a different surface from Mini.
   page.evaluate('window.SUKUN_TEFEKKUR.enter()');page.wait_for_timeout(80)
   def hidden():
    page.evaluate('''() => {const original=window.SukunUniversalDock;window.SukunUniversalDock={...original,owner:()=> 'r708-visual-fixture'};window.SukunDockVisibility.setHidden(true);window.SukunR699Layout.measure('r708-hidden')}''');page.wait_for_timeout(80)
    g=geometry(page);assert g['dockKind']=='peek',g
    return bottom_check(page)
   check('390x844: hidden peek single boundary',hidden)
   def restore():
    page.evaluate('''() => {window.SukunDockVisibility.setHidden(false);window.SukunR699Layout.measure('r708-restore')}''');page.wait_for_timeout(100)
    assert geometry(page)['dockKind']=='host'
    return bottom_check(page)
   check('390x844: restore Mini without stale reserve',restore)
   page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(D/'diagnostics/r708_full_html_390x844.png'))
  if errors:results.append({'name':f'{w}x{h}: uncaught browser errors','status':'FAIL','error':errors})
  context.close()
 browser.close()
output={'kind':'r708-full-HTML-Chromium-layout','environment':'Actual application HTML and scripts loaded with set_content; offline resources; simulated active-flow visibility, no physical Android or real audio playback','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(D/'diagnostics/r708_browser_results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':output['passed'],'total':output['total'],'failures':[x for x in results if x['status']=='FAIL']},ensure_ascii=False,indent=2))
if output['failed']:raise SystemExit(1)
