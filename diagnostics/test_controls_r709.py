from pathlib import Path
from playwright.sync_api import sync_playwright
import json,base64
P=Path(__file__).resolve().parent.parent
html=(P/'nero.html').read_text().replace("url('./assets/tefekkur-sanctuary.webp')","url('data:image/webp;base64,"+base64.b64encode((P/'assets/tefekkur-sanctuary.webp').read_bytes()).decode()+"')")
results=[]
def check(name,fn):
 try:results.append({'name':name,'status':'PASS','detail':fn()})
 except Exception as e:results.append({'name':name,'status':'FAIL','error':str(e)})
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,reduced_motion='reduce',service_workers='block')
 page=c.new_page();page.route('**/*',lambda r:r.abort());page.set_content(html,wait_until='domcontentloaded',timeout=60000)
 page.add_style_tag(content='#acilisPerde,#onboardCard,#dailyCard{display:none!important}')
 page.evaluate('''() => {const p=document.getElementById('acilisPerde');if(p){p.hidden=true;p.classList.add('bitti')}document.body.classList.remove('r608-opening-active','r610-opening-active');window.SUKUN_TEFEKKUR.enter();document.body.classList.add('r431-dock-visible','r591-flow-active');window.SukunDockSize.set('mini');window.SukunR699Layout.measure('r709-controls')}''');page.wait_for_timeout(200)
 def hit(id):
  loc=page.locator('#'+id);loc.scroll_into_view_if_needed();page.wait_for_timeout(60)
  r=loc.bounding_box();assert r and r['width']>=44 and r['height']>=44,r
  x=r['x']+r['width']/2;y=r['y']+r['height']/2
  target=page.evaluate('''([x,y])=>document.elementFromPoint(x,y)?.closest('button,[role="button"],input')?.id||null''',[x,y]);assert target==id,{'id':id,'hit':target,'rect':r}
  return {'id':id,'target':target,'width':r['width'],'height':r['height']}
 for id in ['autoBtn','undoBtn','plusBtn','tefExitBtn','r706Motion','r588Play','r588Stop','r588Hide']:
  check(id+' visible native hit target',lambda id=id:hit(id))
 def navs():
  buttons=page.locator('#r494TefNavSlot .r494NavBtn');assert buttons.count()==3
  return [hit(buttons.nth(i).get_attribute('id')) for i in range(3)]
 # The navigation buttons have data-action but may not have ids.
 def navhit():
  out=[]
  for i in range(3):
   loc=page.locator('#r494TefNavSlot .r494NavBtn').nth(i);loc.scroll_into_view_if_needed();page.wait_for_timeout(30)
   r=loc.bounding_box();assert r and r['width']>=44 and r['height']>=44,r
   x=r['x']+r['width']/2;y=r['y']+r['height']/2
   action=page.evaluate('''([x,y])=>document.elementFromPoint(x,y)?.closest('.r494NavBtn')?.dataset.action||null''',[x,y]);assert action==loc.get_attribute('data-action'),{'expected':loc.get_attribute('data-action'),'actual':action}
   out.append(action)
  return out
 check('Previous / restart / next retain native hit ownership',navhit)
 def count():
  page.locator('#plusBtn').scroll_into_view_if_needed();page.wait_for_timeout(40)
  before=int(page.locator('#cntBig').inner_text());page.locator('#plusBtn').click();page.wait_for_timeout(40);after=int(page.locator('#cntBig').inner_text());assert after==before+1,(before,after)
  page.locator('#undoBtn').click();page.wait_for_timeout(40);restored=int(page.locator('#cntBig').inner_text());assert restored==before,(before,restored)
  return {'before':before,'afterPlus':after,'afterUndo':restored}
 check('Actual plus and undo handlers update the original counter',count)
 def motion():
  loc=page.locator('#r706Motion');loc.scroll_into_view_if_needed();before=loc.get_attribute('aria-pressed');loc.click();page.wait_for_timeout(40);after=loc.get_attribute('aria-pressed');assert before!=after or after=='false'
  return {'before':before,'after':after}
 check('Visual motion control retains its real handler',motion)
 c.close();b.close()
out={'kind':'r709-native-controls-controlled-Chromium','total':len(results),'passed':sum(x['status']=='PASS' for x in results),'failed':sum(x['status']=='FAIL' for x in results),'results':results}
(P/'diagnostics/r709_controls_results.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,ensure_ascii=False,indent=2))
if out['failed']:raise SystemExit(1)
