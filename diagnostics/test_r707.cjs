'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {environment,script}=require('./test_r702.cjs');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const results=[];
function test(name,fn){try{const detail=fn();results.push({name,status:'PASS',detail})}catch(e){results.push({name,status:'FAIL',error:e.stack})}}
const src=script(dir,'r633-flow-dock-placement-runtime');

test('Intrinsic measurement includes overflowing child content',()=>{
 const e=environment();e.c.$=id=>e.document.getElementById(id);
 const start=src.indexOf('function naturalHeight('),end=src.indexOf('\nfunction clearLegacy()',start);
 assert(start>=0&&end>start);e.run(src.slice(start,end));
 const shell=e.element('shell'),body=e.element('body'),footer=e.element('footer'),grip=e.element('grip');
 shell.getBoundingClientRect=()=>({height:250});body.scrollHeight=100;body.scrollTop=0;body.getBoundingClientRect=()=>({top:10});
 const child=e.element('child');child.getBoundingClientRect=()=>({bottom:510});body.children=[child];
 footer.getBoundingClientRect=()=>({height:44});grip.getBoundingClientRect=()=>({height:44});
 assert.equal(e.c.naturalHeight(shell,body,footer,grip),588);
 return{intrinsic:588,oldScrollHeight:100};
});
test('Mode transitions never explicitly reset the dock scroll',()=>{
 assert(!src.includes('body.scrollTop=0'));assert(src.includes('if(changedMode)modeLast=m'));
 assert(src.includes('body.scrollHeight>body.clientHeight+2'));
 assert(!src.includes("'r699-body-scroll',!drawer&&need>desired+2"));
});
test('Hidden dock clears stale overflow classes',()=>{
 assert(src.includes("B.classList.remove('r699-dock-active','r699-body-scroll','r699-overflow')"));
});
test('Drawer releases only the inert and aria state it owns',()=>{
 const start=src.indexOf("let modalTrigger="),end=src.indexOf("document.addEventListener('keydown'",start);assert(end>start);
 const e=environment();e.c.$=id=>e.document.getElementById(id);e.c.B=e.document.body;e.c.safe=(fn,fallback)=>{try{return fn()}catch(_){return fallback}};
 const shell=e.element('r588DockShell'),host=e.element('r170Now'),drawer=e.element('r554AlertDrawer');
 host.classList.add('r554-alert-open');drawer.hidden=false;shell.inert=false;drawer.querySelector=()=>null;
 e.c.SukunDockDetails={close(){}};e.c.SukunAlertCenter={close(){}};e.run(src.slice(start,end));
 e.c.modalSync();assert.equal(shell.inert,true);assert.equal(shell.getAttribute('aria-hidden'),'true');
 host.classList.remove('r554-alert-open');drawer.hidden=true;e.c.modalSync();
 assert.equal(shell.inert,false);assert.equal(shell.getAttribute('aria-hidden'),null);assert(e.document.getElementById('r699ModalBackdrop').hidden);
 shell.inert=true;shell.setAttribute('aria-hidden','custom');host.classList.add('r554-alert-open');drawer.hidden=false;e.c.modalSync();host.classList.remove('r554-alert-open');drawer.hidden=true;e.c.modalSync();
 assert.equal(shell.inert,true);assert.equal(shell.getAttribute('aria-hidden'),'custom');
});
test('Viewport preserve cannot roll back a newer user gesture',()=>{
 const e=environment();let clock=1000,y=50;const native=[];
 class Element{constructor(){this.isConnected=true}getBoundingClientRect(){return{top:100}}closest(){return null}scrollIntoView(arg){native.push(arg)}}
 e.c.Element=Element;e.c.performance={now:()=>clock};e.c.scrollY=y;e.c.scrollTo=(x,v)=>{y=v;e.c.scrollY=v};e.c.scrollBy=(x,v)=>{y+=v;e.c.scrollY=y};
 e.c.document.documentElement.scrollTop=50;e.run(script(dir,'r508-viewport-policy'));const api=e.c.SukunViewportPolicy,el=new Element();
 api.suppress(500,'background');el.scrollIntoView();assert.equal(native.length,0);
 api.allow(()=>el.scrollIntoView(),'user-navigation');assert.equal(native.length,1);
 api.markUserIntent('pointer');el.scrollIntoView();assert.equal(native.length,2);
 clock=3000;api.preserve(()=>{y=150;e.c.scrollY=150;api.markUserIntent('pointer')},{ms:520});
 e.timer(90);e.timer(220);assert.equal(y,150);return{nativeCalls:native.length,scrollY:y};
});
test('Carrier drag is pointer-owned and never binds window touchmove',()=>{
 const s=script(dir,'r514-core-zikir-sentez'),start=s.indexOf('function knobKur(){'),end=s.indexOf("$('#carSld').addEventListener",start);assert(end>start);
 const e=environment({FR:{c:180},knobTirtilCiz(){},knobCiz(){},knobHzOran:()=>.5,knobOranHz:v=>v*1000,knobUygula:v=>e.c.lastHz=v,saveSettings:()=>e.c.saves++});e.c.saves=0;e.c.lastHz=0;
 const k=e.element('carKnob');k.setPointerCapture=id=>e.c.captured=id;k.releasePointerCapture=()=>{e.c.captured=null};
 e.run(s.slice(start,end)+'\nknobKur();');
 assert.equal((e.c.listeners.get('touchmove')||[]).length,0);
 e.event(k,'pointerdown',{pointerId:3,pointerType:'touch',isPrimary:true,clientX:10,clientY:100});
 assert.equal(e.c.captured,3);e.event(k,'pointermove',{pointerId:3,clientX:10,clientY:48});assert(e.c.lastHz>500);
 e.event(k,'pointercancel',{pointerId:3});assert.equal(e.c.captured,null);assert.equal(e.c.saves,1);
 const before=e.c.lastHz;e.event(k,'pointermove',{pointerId:3,clientX:10,clientY:0});assert.equal(e.c.lastHz,before);
 return{pointerCapture:true,windowTouchmoveListeners:0};
});
test('All unrelated executable script owners remain byte-identical to r706',()=>{
 const crypto=require('node:crypto');
 const baseline=JSON.parse(fs.readFileSync(path.join(dir,'diagnostics/r706_source_fingerprints.json'),'utf8'));
 const after=fs.readFileSync(path.join(dir,'nero.html'),'utf8');
 const scripts=[...after.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].map(m=>({id:m[1].match(/\bid=["']([^"']+)/)?.[1]||'',code:m[2]}));
 const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
 assert.equal(scripts.length,baseline.script_count);
 let unchanged=0;
 for(let i=0;i<scripts.length;i++){
   const b=baseline.scripts[i],a=scripts[i];assert.equal(a.id,b.id);
   if(['r633-flow-dock-placement-runtime','r508-viewport-policy','r514-core-zikir-sentez','surumNotlari'].includes(a.id))continue;
   assert.equal(sha(a.code),b.sha256,a.id);unchanged++;
 }
 const core=scripts.find(x=>x.id==='r514-core-zikir-sentez').code;
 const strip=s=>s.slice(0,s.indexOf('function knobKur(){'))+s.slice(s.indexOf("$('#carSld').addEventListener",s.indexOf('function knobKur(){')));
 assert.equal(sha(strip(core)),baseline.core_without_carrier_knob_sha256);
 return{unchangedExecutableModules:unchanged,modifiedCoreScope:'carrier knob only'};
});
test('Release metadata and required files agree',()=>{
 const h=fs.readFileSync(path.join(dir,'nero.html'),'utf8'),sw=fs.readFileSync(path.join(dir,'sw.js'),'utf8'),m=JSON.parse(fs.readFileSync(path.join(dir,'manifest.webmanifest'))),notes=JSON.parse(fs.readFileSync(path.join(dir,'surumler.json')));
 assert(h.includes('name="sukun-build" content="r707"'));assert(h.includes('manifest.webmanifest?v=r707'));assert(sw.includes("const SURUM = 'r707'"));assert(sw.includes("const BUILD_MARKER='./__sukun_build_r707__.json'"));assert(m.start_url.endsWith('v=r707'));assert.equal(notes[0].v,'r707');
 for(const n of ['nero.html','sw.js','manifest.webmanifest','surumler.json','icon-192.png','icon-512.png','icon-512-maskable.png','__sukun_build_r707__.json'])assert(fs.existsSync(path.join(dir,n)));
});
console.log(JSON.stringify({kind:'r707-focused-source-tests',environment:'Node VM and source comparison; not physical Android',total:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results},null,2));
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
