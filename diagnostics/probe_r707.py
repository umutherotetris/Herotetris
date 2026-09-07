from playwright.sync_api import sync_playwright
import json,time
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
 context=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,reduced_motion='reduce')
 page=context.new_page(); errors=[]
 page.on('pageerror',lambda e: errors.append(str(e)))
 page.on('console',lambda m: errors.append('console: '+m.text) if m.type=='error' else None)
 t=time.time(); response=page.goto('http://127.0.0.1:8765/nero.html?diag=1',wait_until='domcontentloaded',timeout=60000)
 print('HTTP',response.status,'LOAD',round(time.time()-t,2),flush=True)
 page.wait_for_timeout(2500)
 print('ERRORS',json.dumps(errors[:15],ensure_ascii=False),flush=True)
 print('STATE',json.dumps(page.evaluate('''() => ({build:document.querySelector('meta[name=sukun-build]')?.content,body:document.body.className,state:document.readyState,elements:['acilisPerde','tfRefinedLayout','r170Now','r588DockShell','r659DockBody','r554AlertDrawer','r434InlineDetails'].map(id=>[id,!!document.getElementById(id)]),layout:window.SukunR699Layout?.snapshot?.()})'''),ensure_ascii=False),flush=True)
 page.screenshot(path='diagnostics/r706_initial.png',full_page=True)
 browser.close()
