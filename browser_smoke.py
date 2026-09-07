import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path('/mnt/data/sukun_sources')
async def inspect(browser,version):
 context=await browser.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,service_workers='block')
 page=await context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 text=(ROOT/f'r{version}/nero.html').read_text()
 await page.set_content(text,wait_until='domcontentloaded',timeout=30000)
 await page.wait_for_timeout(500)
 data=await page.evaluate('''() => ({build:document.querySelector('meta[name="sukun-build"]')?.content,ready:document.readyState,gate:window.SukunZikirTransportGate?.version,transaction:window.SukunZikirTransaction?.version,dock:window.SukunR698UI?.snapshot?.(),ids:[...document.querySelectorAll('[id]')].map(e=>e.id),scripts:[...document.scripts].length,body:document.body.className,shield:window.SukunRegressionShield?.snapshot?.(),checks:window.SukunRegressionShield?.runSuite?.()})''')
 ids=data.pop('ids');data['duplicateIds']=sorted({x for x in ids if ids.count(x)>1});data['domIds']=len(ids);data['pageErrors']=errors[:15]
 await context.close();return data
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  out={}
  for v in ['698','699']:
   try:out[v]=await inspect(browser,v)
   except Exception as e:out[v]={'error':str(e)}
   print(v,json.dumps(out[v],ensure_ascii=False,default=str)[:4000],flush=True)
  await browser.close()
 (ROOT/'browser_smoke_r699.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str))
asyncio.run(main())
