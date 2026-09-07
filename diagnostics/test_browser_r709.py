from pathlib import Path
from playwright.sync_api import sync_playwright
import base64,json,sys
P=Path(__file__).resolve().parent.parent
html=(P/'nero.html').read_text()
art=base64.b64encode((P/'assets/tefekkur-sanctuary.webp').read_bytes()).decode()
html=html.replace("url('./assets/tefekkur-sanctuary.webp')", "url('data:image/webp;base64,"+art+"')")
results=[]
def check(name,fn):
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)})
def prepare(page):
 page.route('**/*',lambda r:r.abort())
 page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.add_style_tag(content='#acilisPerde,#onboardCard,#dailyCard{display:none!important}')
 page.evaluate('''() => {const p=document.getElementById('acilisPerde');if(p){p.hidden=true;p.classList.add('bitti')}document.body.classList.remove('r608-opening-active','r610-opening-active');for(const id of ['onboardCard','dailyCard']){const e=document.getElementById(id);if(e)e.hidden=true}}''')
 page.evaluate('window.SUKUN_TEFEKKUR.enter()')
 page.wait_for_timeout(180)
 page.evaluate('''() => {document.body.classList.add('r431-dock-visible','r591-flow-active');document.body.classList.remove('r433-dock-hidden');window.SukunDockSize.set('mini');window.SukunR699Layout.measure('r709-test-mini');window.SukunSanctuaryR709.reconcile()}''')
 page.wait_for_timeout(140)
def geometry(page):
 return page.evaluate('''() => {
 const $=id=>document.getElementById(id);const box=e=>{if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return{top:r.top,bottom:r.bottom,width:r.width,height:r.height,display:s.display,overflow:s.overflowY}};
 const shown=e=>{if(!e||e.hidden)return false;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return s.display!=='none'&&s.visibility!=='hidden'&&r.width>1&&r.height>1};
 const host=$('r170Now'),peek=$('r433DockPeek'),dock=shown(host)?host:shown(peek)?peek:null;
 return {scrollY,docHeight:document.documentElement.scrollHeight,viewport:innerHeight,card:box(document.querySelector('#tab-zkr>.card.zCtl')),root:box($('tfRefinedLayout')),ring:box($('zCountVisual')),stats:[...document.querySelectorAll('#tfRefinedLayout .zCounterSide')].map(box),auto:box($('autoBtn')),nav:box($('r494TefNavSlot')),exit:box($('tefExitBtn')),dock:box(dock),dockKind:dock===host?'host':dock===peek?'peek':'none',wrapPadding:getComputedStyle(document.querySelector('.wrap')).paddingBottom,reserve:parseFloat(document.documentElement.style.getPropertyValue('--r699-content-reserve'))||0,scene:!!$('r709SceneArt'),mandala:!!$('r709Mandala'),build:document.querySelector('meta[name=sukun-build]').content,footer:$('surumEtiket')?.textContent};
 }''')
def mode(page,m):
 page.evaluate('''m => {window.SukunDockSize.set(m);window.SukunR699Layout.measure('r709-test-'+m)}''',m);page.wait_for_timeout(100)
def layout(page):
 g=geometry(page);assert g['scene'] and g['mandala'],g
 assert g['ring'] and g['ring']['width']<=225,g
 assert all(x['height']<=48 for x in g['stats']),g
 assert all(x['width']>=44 and x['height']>=44 for x in [g['auto'],g['exit']]),g
 assert all(x['width']>0 for x in g['stats']),g
 assert g['root']['width']<=page.evaluate('innerWidth')+1,g
 assert abs(float(g['wrapPadding'].replace('px','')))<1,g
 return {k:g[k] for k in ['root','ring','stats','auto','exit','dock','reserve']}
def bottom(page):
 page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');page.wait_for_timeout(80)
 g=geometry(page);assert g['dock'],g
 if g['scrollY']>1:
  gap=g['dock']['top']-g['card']['bottom'];assert 6<=gap<=18,{'gap':gap,'geometry':g}
 return {'scrollY':g['scrollY'],'gap':g['dock']['top']-g['card']['bottom'],'reserve':g['reserve']}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,640),(390,844),(412,915),(640,360),(1280,900)]:
  c=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=w<700,has_touch=w<700,reduced_motion='reduce',service_workers='block')
  page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  try:prepare(page)
  except Exception as e:results.append({'name':f'{w}x{h} startup','status':'FAIL','error':str(e)});c.close();continue
  check(f'{w}x{h} source and release identity',lambda: {'build':geometry(page)['build'],'footer':geometry(page)['footer']} if geometry(page)['build']=='r709' and 'r709' in geometry(page)['footer'] and not errors else (_ for _ in ()).throw(AssertionError(errors or 'release mismatch')))
  for m in ['mini','midi','max']:
   mode(page,m)
   check(f'{w}x{h} {m} compact geometry',lambda:layout(page))
   check(f'{w}x{h} {m} bottom boundary',lambda:bottom(page))
  def hit():
   mode(page,'mini');page.locator('#tefExitBtn').scroll_into_view_if_needed();page.wait_for_timeout(50)
   r=page.locator('#tefExitBtn').bounding_box();x=r['x']+r['width']/2;y=r['y']+r['height']/2
   target=page.evaluate('''([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.id||null''',[x,y]);assert target=='tefExitBtn',{'target':target,'rect':r}
   page.mouse.click(x,y);page.wait_for_timeout(70);assert not page.evaluate("document.body.classList.contains('sukun-tefekkur-mode')")
   return {'target':target,'exited':True}
  check(f'{w}x{h} native exit hit-test',hit)
  if w==390:
   page.evaluate('window.SUKUN_TEFEKKUR.enter()');page.wait_for_timeout(100)
   page.evaluate('''() => {document.body.classList.add('r431-dock-visible','r591-flow-active');window.SukunDockSize.set('mini');window.SukunR699Layout.measure('r709-screen')}''');page.wait_for_timeout(100)
   page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(P/'diagnostics/r709_full_html_390x844.png'))
  if errors:results.append({'name':f'{w}x{h} uncaught browser errors','status':'FAIL','error':errors})
  c.close()
 browser.close()
out={'kind':'r709-full-HTML-controlled-Chromium','environment':'Actual application HTML via set_content; artwork supplied as local data URI; network blocked; visual playback fixture; no physical Android or audible audio','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(P/'diagnostics/r709_browser_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'passed':out['passed'],'total':out['total'],'failures':[x for x in results if x['status']=='FAIL']},ensure_ascii=False,indent=2))
if out['failed']:sys.exit(1)
