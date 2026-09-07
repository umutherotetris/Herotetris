from pathlib import Path
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
import json,time
D=Path(__file__).resolve().parent.parent
soup=BeautifulSoup((D/'nero.html').read_text(),'html.parser')
# Use the real CSS cascade and real layout runtime, but controlled inert DOM.
styles='\n'.join(t.string or t.get_text() for t in soup.find_all('style'))
script=soup.find('script',id='r633-flow-dock-placement-runtime').string
fixture='''<!doctype html><html lang="tr"><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>'''+styles+'''</style></head><body class="r699-layout r707-scroll r588-dock-ready r591-flow-active r431-dock-visible r588-mode-max sukun-tefekkur-mode r485-controls r706-neon r698-ui"><main><div class="wrap"><section id="tab-zkr"><div id="zStage"><div style="height:65px">Zikir başlığı</div></div><div class="card zCtl"><div id="tfRefinedLayout"><div class="tfVisualPanel"><div class="zCounterRow cntRow"><div class="zCounterSide"><small>HEDEF</small><b>99</b></div><div id="zCountVisual"><div class="cntNums"><b id="cntBig">12</b></div></div><div class="zCounterSide"><small>KALAN</small><b>87</b></div></div></div><div class="tfControlPanel"><div class="zCounterActions"><button id="undoBtn">−</button><button id="autoBtn">Saymaya Başla</button><button id="plusBtn">+</button></div><div class="tfStatusRow"><div class="tfMetaWrap" id="cntSub">Hedef 99</div><div class="tfExitRow"><button id="tefExitBtn">Tefekkürden Çık</button></div></div><div id="r494TefNavSlot"><div class="r494NavCluster"><button class="r494NavBtn">Önceki</button><button class="r494NavBtn" data-action="reset">Baştan</button><button class="r494NavBtn">Sonraki</button></div></div></div><div id="r706Atmosphere" aria-hidden="true"><div class="r706Arch"></div><div class="r706Lightfall"></div></div></div></div><div style="height:420px">Alt içerik</div></section></div></main><div id="r170Now" class="r588-authority"><div id="r588DockShell"><div id="r659DockBody"><div class="r588Top"><span class="r588Identity">SÜKÛN</span><button id="r588Details">Detaylar</button></div><div class="r588Main"><div class="r588Signal">◉</div><div class="r588Text"><b id="r588Title">Aktif Zikir</b></div></div><div class="r588Stats">12 / 99</div><div class="r588Meta"><span>Ses kaynağı</span><span>Devir 1</span></div><div class="r588Actions">'''+''.join('<div class="r588Action" style="min-height:65px">Katman '+str(i)+'</div>' for i in range(12))+'''</div><div class="r707TestLongContent" style="height:1100px;min-height:1100px">Long scrollable content</div></div><div class="r588Mode"><div class="r588ModeSeg"><button data-r588-mode="mini">Mini</button><button data-r588-mode="midi">Midi</button><button data-r588-mode="max">Max</button></div><div class="r588Transport"><button id="r588Play">▶</button><button id="r588Stop">■</button></div><button id="r588Hide">▾</button></div></div><div id="r554AlertDrawer" hidden><div class="r554DrawerHead"><button id="r554DrawerClose">Kapat</button></div><div class="r554DrawerFilters">Filtre</div><div id="r607DrawerMaint">Bakım</div><div id="r554DrawerList">'''+''.join('<p style="height:65px">Bildirim '+str(i)+'</p>' for i in range(20))+'''</div></div></div><div id="r677DetailsBackdrop" aria-hidden="true"></div><div id="r434InlineDetails" class="r677-details-portal" hidden><div class="r434Head"><button id="r677DetailsClose">Kapat</button></div><div id="r674DetailsScroll">'''+''.join('<p style="height:65px">Detay '+str(i)+'</p>' for i in range(20))+'''</div></div><script>window.SukunDockDetails={close(){document.body.classList.remove('r434-inline-details-open');document.getElementById('r434InlineDetails').hidden=true}};window.SukunAlertCenter={close(){document.getElementById('r554AlertDrawer').hidden=true;document.getElementById('r170Now').classList.remove('r554-alert-open')}};window.__clicks={};document.addEventListener('click',e=>{let b=e.target.closest('button');if(b)window.__clicks[b.id||b.textContent]=(window.__clicks[b.id||b.textContent]||0)+1});</script></body></html>'''
results=[]
def check(name,fn):
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)})
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 for w,h in [(320,640),(390,844),(640,360),(1280,900)]:
  context=browser.new_context(viewport={'width':w,'height':h},device_scale_factor=1,is_mobile=w<700,has_touch=w<700,reduced_motion='reduce')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.route('**/*',lambda route:route.abort())
  page.set_content(fixture,wait_until='domcontentloaded',timeout=60000)
  page.add_script_tag(content=script)
  page.wait_for_timeout(350)
  def inspect():
   return page.evaluate('''() => {const $=id=>document.getElementById(id);const cs=id=>getComputedStyle($(id));const d=$('r659DockBody');return{docScroll:Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-innerHeight,bodyPosition:getComputedStyle(document.body).position,tabPosition:cs('tab-zkr').position,bodyOverflow:getComputedStyle(document.body).overflowY,dockOverflow:cs('r659DockBody').overflowY,dockScroll:d.scrollHeight-d.clientHeight,hostHeight:$('r170Now').getBoundingClientRect().height,viewport:innerHeight,mode:window.SukunR699Layout.snapshot()?.mode,errors:[]}}''')
  def basic():
   x=inspect();assert x['docScroll']>250,x;assert x['bodyPosition']!='fixed',x;assert x['tabPosition']!='fixed',x;assert x['dockOverflow']=='auto',x;assert x['dockScroll']>100,x;assert x['hostHeight']<=h,x
   page.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');page.wait_for_timeout(80);assert page.evaluate('window.scrollY')>100
   assert not errors,errors;return x
  check(f'{w}x{h}: document, dock and viewport',basic)
  def mode():
   x=page.evaluate('''() => {let b=document.body,d=document.getElementById('r659DockBody');d.scrollTop=100;for(const m of ['mini','midi','max']){b.classList.remove('r588-mode-mini','r588-mode-midi','r588-mode-max');b.classList.add('r588-mode-'+m);window.SukunR699Layout.measure('test-'+m);if(Math.abs(d.scrollTop-100)>1)throw Error('scroll reset in '+m+': '+d.scrollTop)}return{scrollTop:d.scrollTop,snapshot:window.SukunR699Layout.snapshot()}}''');return{'scrollTop':x['scrollTop'],'mode':x['snapshot']['mode']}
  check(f'{w}x{h}: Mini/Midi/Max preserve scroll',mode)
  def hit():
   page.evaluate('''() => {const el=document.getElementById('tefExitBtn');window.scrollTo(0,el.getBoundingClientRect().top+scrollY-70)}''');page.wait_for_timeout(80)
   r=page.locator('#tefExitBtn').bounding_box();assert r and r['y']>=0 and r['y']+r['height']<=h,r
   x=r['x']+r['width']/2;y=r['y']+r['height']/2
   target=page.evaluate('''([x,y])=>document.elementFromPoint(x,y)?.closest('button')?.id||null''',[x,y]);assert target=='tefExitBtn',{'target':target,'rect':r}
   page.mouse.click(x,y);assert page.evaluate("window.__clicks.tefExitBtn||0")==1
   return{'target':target,'rect':r}
  check(f'{w}x{h}: exit button receives native click',hit)
  def modal():
   page.evaluate('''() => {const h=document.getElementById('r170Now'),d=document.getElementById('r554AlertDrawer');h.classList.add('r554-alert-open');d.hidden=false;window.SukunR699Layout.measure('drawer-open')}''')
   x=page.evaluate('''() => ({inert:document.getElementById('r588DockShell').inert,backdrop:!document.getElementById('r699ModalBackdrop').hidden})''');assert x['inert'] and x['backdrop'],x
   page.evaluate('''() => {window.SukunAlertCenter.close();window.SukunR699Layout.measure('drawer-close')}''')
   x=page.evaluate('''() => ({inert:document.getElementById('r588DockShell').inert,backdrop:document.getElementById('r699ModalBackdrop').hidden})''');assert not x['inert'] and x['backdrop'],x
   page.evaluate('''() => {document.body.classList.add('r434-inline-details-open');document.getElementById('r434InlineDetails').hidden=false}''')
   assert page.evaluate("getComputedStyle(document.getElementById('r677DetailsBackdrop')).pointerEvents")=='auto'
   page.evaluate('''() => {window.SukunDockDetails.close();window.SukunR699Layout.measure('details-close')}''')
   assert page.evaluate("getComputedStyle(document.getElementById('r677DetailsBackdrop')).pointerEvents")=='none'
   return{'drawerReleased':True,'detailsBackdropReleased':True}
  check(f'{w}x{h}: modal open/close hit-test ownership',modal)
  if w==390:
   page.screenshot(path=str(D/'diagnostics/r707_isolated_390x844.png'),full_page=True)
  context.close()
 browser.close()
output={'kind':'r707-isolated-Chromium-layout','environment':'Local set_content fixture using actual CSS and layout runtime; not the full app, network navigation or Android hardware','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(D/'diagnostics/r707_layout_results.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
print(json.dumps({'passed':output['passed'],'total':output['total'],'failures':[x for x in results if x['status']=='FAIL']},ensure_ascii=False,indent=2))
if output['failed']:raise SystemExit(1)
