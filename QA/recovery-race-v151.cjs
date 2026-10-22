// Run the actual recovery document with a deterministic service-worker lifecycle.
// Browser CacheStorage/settings are real; no production registration is touched.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765/Herotetris/';
const documentSource=()=>process.env.RECOVERY_V151_SOURCE_REF
 ?execFileSync('git',['show',process.env.RECOVERY_V151_SOURCE_REF+':hero-recover.html'],{cwd:root,encoding:'utf8'})
 :fs.readFileSync(path.join(root,'hero-recover.html'),'utf8');
let browser,failures=0;
async function run(mode){
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({mode,scope})=>{
  if(!location.pathname.endsWith('hero-recover.html'))return;
  const state={unregisters:0,registers:0,probes:0,switched:false,skips:0,removed:[]};
  const save=()=>sessionStorage.setItem('worker-fixture',JSON.stringify(state));
  const handlers=new Map();
  const sw={controller:null,addEventListener:(name,fn)=>{if(!handlers.has(name))handlers.set(name,new Set());handlers.get(name).add(fn);},removeEventListener:(name,fn)=>handlers.get(name)?.delete(fn)};
  function notify(){for(const fn of handlers.get('controllerchange')||[])fn();}
  let activationPending=false;
  function activate(){modern.state='activated';registration.active=modern;registration.waiting=null;sw.controller=modern;state.switched=true;save();notify();}
  const modern={state:'activated',scriptURL:scope+'sw.js',addEventListener(){},postMessage(data,ports){
   if(data?.type==='HERO_PING')ports?.[0]?.postMessage({type:'HERO_PONG',build:'151'});
   if(data?.type==='SKIP_WAITING'){
    state.skips++;save();if(!activationPending){activationPending=true;setTimeout(activate,20);}
   }
  }};
  const legacy={state:'activated',scriptURL:scope+'sw.js',postMessage(data){
   if(data?.type!=='HERO_PING')return;state.probes++;save();
   if(mode==='race'&&!state.switched)setTimeout(activate,20);
  }};
  function makeRegistration(active){return {
   scope,active,installing:null,waiting:null,removed:false,addEventListener(){},update:async()=>{},
   async unregister(){state.unregisters++;state.removed.push(this.active===modern?'modern':'legacy');this.removed=true;this.active=null;save();return true;}
  };}
  let registration=makeRegistration(legacy);sw.controller=legacy;
  sw.getRegistration=async()=>registration.removed?undefined:registration;
  sw.register=async()=>{
   state.registers++;
   if(registration.removed)registration=makeRegistration(legacy);
   if(mode==='race'){
    registration.active=modern;
    // The new worker can be active before this document changes controller.
    if(sw.controller!==modern)setTimeout(activate,50);
   }else{
    modern.state='installed';registration.waiting=modern;
   }
   save();return registration;
  };
  Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:sw});save();
 },{mode,scope:base});
 await page.route('**/*',route=>{
  const u=new URL(route.request().url());
  if(u.href.startsWith(base+'hero-recover.html'))return route.fulfill({contentType:'text/html',body:documentSource()});
  return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Hero Fixture</title><h1 id="portal-ready">Portal ready</h1>'});
 });
 await page.goto(base+'seed.html');
 await page.evaluate(async()=>{
  localStorage.setItem('hero_theme','emerald');
  await (await caches.open('unrelated-app-sentinel')).put('/other/sentinel',new Response('unrelated preserved'));
  await (await caches.open('sukun-legacy-sentinel')).put('/legacy/sentinel',new Response('legacy preserved'));
 });
 await page.goto(base+'hero-recover.html');
 await page.waitForURL(/\/Herotetris\/index\.html\?hero=/,{timeout:6000});
 await page.locator('#portal-ready').waitFor();
 const result=await page.evaluate(async()=>({
  worker:JSON.parse(sessionStorage.getItem('worker-fixture')),
  theme:localStorage.getItem('hero_theme'),
  unrelated:await (await (await caches.open('unrelated-app-sentinel')).match('/other/sentinel')).text(),
  legacy:await (await (await caches.open('sukun-legacy-sentinel')).match('/legacy/sentinel')).text()
 }));
 assert.deepEqual(errors,[]);await page.close();return result;
}
async function test(name,fn){try{await fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n'+e.stack);}}
(async()=>{
 const launch={headless:true};if(process.env.PORTAL_CHROMIUM)launch.executablePath=process.env.PORTAL_CHROMIUM;
 browser=await chromium.launch(launch);
 try{
  await test('a concurrently activated Hero worker stays registered and navigation waits for its controller',async()=>{
   const r=await run('race');assert.equal(r.worker.switched,true);
   assert.equal(r.worker.unregisters,0,'concurrent activation must not detach the new Hero registration');
   assert.deepEqual(r.worker.removed,[]);assert.equal(r.worker.registers,1);
   assert.equal(r.theme,'emerald');assert.equal(r.unrelated,'unrelated preserved');assert.equal(r.legacy,'legacy preserved');
  });
  await test('a modern worker waiting behind the legacy worker is promoted without detaching registration or clearing data',async()=>{
   const r=await run('legacy');assert.equal(r.worker.switched,true);assert.ok(r.worker.skips>0,'the existing waiting worker must be promoted');
   assert.equal(r.worker.unregisters,0);assert.deepEqual(r.worker.removed,[]);assert.equal(r.worker.registers,1);
   assert.equal(r.theme,'emerald');assert.equal(r.unrelated,'unrelated preserved');assert.equal(r.legacy,'legacy preserved');
  });
 }finally{await browser.close();}
 if(failures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exit(1);});
