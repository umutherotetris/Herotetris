#!/usr/bin/env node
'use strict';
// Run: node diagnostics/test_r702.cjs [package-directory] [optional-baseline-directory]
// Source modules run in isolated VMs. Browser/hardware behavior is not simulated
// beyond the small DOM, timers, transport adapters and CacheStorage below.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const target=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const baseline=process.argv[3]&&path.resolve(process.argv[3]);
const read=(dir,name)=>fs.readFileSync(path.join(dir,name),'utf8');
function script(dir,id){const h=read(dir,'nero.html');const m=[...h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)].find(m=>new RegExp('\\bid=["\']'+id+'["\']').test(m[1]));assert(m,'Module exists: '+id);return m[2];}
const ticks=async(n=12)=>{for(let i=0;i<n;i++)await Promise.resolve()};
function bus(){const listeners=new Map();return {addEventListener(k,fn){if(!listeners.has(k))listeners.set(k,[]);listeners.get(k).push(fn)},removeEventListener(k,fn){listeners.set(k,(listeners.get(k)||[]).filter(x=>x!==fn))},dispatchEvent(e){for(const fn of [...(listeners.get(e.type)||[])])fn(e);return !e.defaultPrevented},listeners};}
function environment(extra={}){
 const timers=new Map(),nodes=new Map(),metrics={writes:0,focus:0},micro=[];let clock=100000,seq=0;
 const style=()=>{const map=new Map();return{setProperty:(k,v)=>map.set(k,String(v)),getPropertyValue:k=>map.get(k)||'',removeProperty:k=>map.delete(k)}};
 function element(id=''){
   const classes=new Set(),attrs=new Map();let text='';
   const e={...bus(),id,dataset:{},style:style(),children:[],hidden:false,disabled:false,clientHeight:844,clientWidth:390,scrollTop:0,scrollHeight:100,
     classList:{add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x),toggle(x,on){if(on===undefined)on=!classes.has(x);on?classes.add(x):classes.delete(x);return on}},
     setAttribute:(k,v)=>attrs.set(k,String(v)),getAttribute:k=>attrs.get(k)||null,removeAttribute:k=>attrs.delete(k),
     querySelector:()=>null,querySelectorAll:()=>[],getBoundingClientRect:()=>({x:0,y:0,width:390,height:100,top:0,bottom:100,left:0,right:390}),
     focus(){metrics.focus++},click(){this.onclick?.();this.dispatchEvent({type:'click',target:this})},
     appendChild(c){c.parentNode=this;this.children.push(c);if(c.id)nodes.set(c.id,c);return c},append(c){return this.appendChild(c)},insertBefore(c){return this.appendChild(c)},contains(c){return this.children.includes(c)},matches:()=>false,closest:()=>null};
   Object.defineProperty(e,'textContent',{get:()=>text,set:v=>{text=String(v);metrics.writes++}});
   if(id)nodes.set(id,e);return e;
 }
 const document={...bus(),readyState:'loading',hidden:false,visibilityState:'visible',documentElement:element(),body:element(),activeElement:null,fullscreenElement:null,
  getElementById:id=>nodes.get(id)||null,querySelector:s=>s.startsWith('#')?nodes.get(s.slice(1))||null:null,querySelectorAll:()=>[],createElement:()=>element()};
 const storage=new Map(),mediaHandlers=new Map();
 const c={...bus(),document,console:{log(){},warn(){}},URL,Promise,structuredClone,Math,JSON,Set,Map,Number,String,Object,Array,RegExp,
   CustomEvent:class{constructor(type,opt={}){this.type=type;this.detail=opt.detail}},
   navigator:{mediaSession:{setActionHandler:(k,fn)=>mediaHandlers.set(k,fn)}},
   localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)},
   setTimeout:(fn,ms=0)=>{const id=++seq;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),
   setInterval:()=>++seq,clearInterval(){},requestAnimationFrame:fn=>{const id=++seq;timers.set(id,{fn,ms:16});return id},cancelAnimationFrame:id=>timers.delete(id),
   queueMicrotask:fn=>micro.push(fn),performance:{now:()=>clock},innerWidth:390,innerHeight:844,
   getComputedStyle:()=>({display:'block',visibility:'visible',opacity:'1',paddingBottom:'0',position:'static'}),
   MutationObserver:class{constructor(fn){this.fn=fn}observe(){}disconnect(){}},ResizeObserver:class{observe(){}disconnect(){}},
   miniPlayingInfo:()=>({active:false,tam:[]}),hardStopAll:()=>true,
   ...extra};
 c.window=c;const context=vm.createContext(c);
 return {c,context,document,element,metrics,timers,storage,mediaHandlers,
  run:code=>vm.runInContext(code,context,{timeout:1000}),
  async flush(){for(let n=0;n<30;n++){await new Promise(setImmediate);const q=micro.splice(0);if(!q.length)return;for(const fn of q)fn();}throw Error('microtask loop')},
  timer(ms){const q=[...timers].filter(([,x])=>x.ms===ms);for(const [id,x] of q){timers.delete(id);x.fn()}},
  event(target,type,data={}){const e={type,defaultPrevented:false,preventDefault(){this.defaultPrevented=true},...data};target.dispatchEvent(e);return e}
 };
}
function load(env,dir,id){env.run(script(dir,id));return env.c;}
const tests=[];const test=(name,fn)=>tests.push({name,fn});

test('JavaScript syntax: every executable inline module and Service Worker',async dir=>{
 let count=0;for(const m of read(dir,'nero.html').matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  const type=m[1].match(/\btype=["']([^"']+)/)?.[1];if(type&&!['text/javascript','application/javascript','module'].includes(type))continue;
  new vm.Script(m[2],{filename:m[1]||'inline'});count++;
 }new vm.Script(read(dir,'sw.js'));return {executableModules:count,serviceWorkers:1};
});
test('Release metadata, manifest link, start URL and build marker agree',async dir=>{
 const h=read(dir,'nero.html'),build=h.match(/name="sukun-build" content="([^"]+)"/)[1];
 assert.equal(h.match(/manifest\.webmanifest\?v=([^"']+)/)[1],build);
 const manifest=JSON.parse(read(dir,'manifest.webmanifest'));assert.equal(new URL(manifest.start_url,'https://test/').searchParams.get('v'),build);
 assert.equal(JSON.parse(read(dir,`__sukun_build_${build}__.json`)).build,build);
 assert(read(dir,'sw.js').includes(`const SURUM = '${build}'`));
 const history=JSON.parse(read(dir,'surumler.json')),inline=JSON.parse(script(dir,'surumNotlari'));assert.equal(history[0].v,build);assert.deepEqual(history,inline);
 for(const icon of manifest.icons)assert(fs.existsSync(path.join(dir,icon.src)));
 return {build};
});
test('Unchanged 28-name state produces zero repeated text mutations',async dir=>{
 const e=environment({BERHET_SEYIR:{paused:false,run:false}});e.element('bsStart');load(e,dir,'r262-pause-contract');e.c.SukunPauseContract.bind();e.metrics.writes=0;
 for(let i=0;i<100;i++)e.c.SukunPauseContract.sync();assert.equal(e.metrics.writes,0);return {syncCalls:100,textMutations:0};
});
test('Tefekkür opens and exits while recording database never resolves',async dir=>{
 const e=environment({recInit:()=>new Promise(()=>{})});load(e,dir,'sukun-r530-tefekkur-mode-runtime');let done=false;e.c.SUKUN_TEFEKKUR.enter().then(()=>done=true);await ticks();assert(e.c.SUKUN_TEFEKKUR.active());assert(done);await e.c.SUKUN_TEFEKKUR.exit();assert(!e.c.SUKUN_TEFEKKUR.active());
});
test('Tefekkür view change preserves paused speech and audio context',async dir=>{
 let speechResumes=0,contextStarts=0;const e=environment({recInit:async()=>{},ac:()=>contextStarts++,speechSynthesis:{paused:true,resume(){speechResumes++}}});
 load(e,dir,'sukun-r530-tefekkur-mode-runtime');await e.c.SUKUN_TEFEKKUR.enter();assert.equal(speechResumes,0);assert.equal(contextStarts,0);
});
test('Escape exits with no retired focus button in the DOM',async dir=>{
 const e=environment();load(e,dir,'sukun-r530-tefekkur-mode-runtime');e.event(e.document,'DOMContentLoaded');e.timer(0);await e.c.SUKUN_TEFEKKUR.enter();e.event(e.document,'keydown',{key:'Escape'});assert(!e.c.SUKUN_TEFEKKUR.active());
});
test('Exit cancels delayed focus instead of focusing hidden counter',async dir=>{
 const e=environment();e.element('zCountVisual');load(e,dir,'sukun-r530-tefekkur-mode-runtime');await e.c.SUKUN_TEFEKKUR.enter();await e.c.SUKUN_TEFEKKUR.exit();e.timer(90);assert.equal(e.metrics.focus,0);
});
test('Tefekkür does not claim or close another component fullscreen',async dir=>{
 let exits=0;const e=environment();e.storage.set('sukun.tefekkur.systemFullscreen.v1','1');e.document.fullscreenElement=e.document.documentElement;e.document.exitFullscreen=async()=>exits++;
 load(e,dir,'sukun-r530-tefekkur-mode-runtime');await e.c.SUKUN_TEFEKKUR.enter();await e.c.SUKUN_TEFEKKUR.exit();assert.equal(exits,0);
});
function transportFixture(dir,{auto=true,paused=false,journey=''}={}){
 const calls=[],a={paused,providerIds:journey?[journey==='28'?'berhetiyye':'esma99']:[],mixCaptured:paused},j={run:!!journey,paused};
 const e=environment({SukunDirectZikirTransportR698:{state:()=>({auto}),start:()=>{calls.push('start');auto=true;return true},stop:()=>{calls.push('direct-stop');auto=false},clearStale(){}},
  SukunAudioSessionRegistry:{aggregateSnapshot:()=>a,aggregateState:()=>a.paused?'paused':auto?'playing':'idle',pauseAll:why=>{calls.push('pause:'+why);a.paused=true;j.paused=true},resumeAll:()=>{calls.push('resume');a.paused=false;j.paused=false;auto=true},stopAll:()=>{calls.push('stop-all');a.paused=false;auto=false;j.run=false;j.paused=false}},
  SukunJourneyAudioMachine:{intent:()=>{}},SukunForegroundArbiter:{clearQueue:()=>calls.push('clear-queue')}});
 if(journey)e.c[journey==='28'?'SukunBerhetiyyeSeyir':'SukunEsma99Seyir']={state:()=>j,resume:()=>{calls.push('journey-resume');j.paused=false},pause:()=>{calls.push('journey-pause');j.paused=true}};
 e.document.body.classList.add('sukun-zikir-tab');load(e,dir,'r698-transport-authority');return{e,calls,a,j};
}
test('Dock Pause captures all layers; Resume uses the captured session',async dir=>{
 const {e,calls,a}=transportFixture(dir);const t=e.c.SukunR698Transport;t.playPause('dock');assert(a.paused);assert(!calls.includes('direct-stop'));t.playPause('dock');assert(!a.paused);assert(calls.includes('resume'));assert(!calls.includes('start'));
});
for(const journey of ['28','99'])test(`${journey}-name journey Pause/Resume never starts independent auto`,async dir=>{
 const {e,calls,j}=transportFixture(dir,{journey});const t=e.c.SukunR698Transport;t.playPause('dock');assert(j.paused);t.playPause('dock');assert(!j.paused);assert(!calls.includes('start'));assert(!calls.includes('direct-stop'));
});
test('Main counter resumes aggregate pause before starting another session',async dir=>{
 const {e,calls}=transportFixture(dir,{paused:true,auto:false});e.c.SukunR698Transport.playPause('main');assert.deepEqual(calls,['resume']);
});
test('Main Stop is immediate even within the 620 ms start filter',async dir=>{
 const e=environment({Z:{auto:true},_r477AutoTapAt:Date.now(),SukunR698Transport:{playPause:()=>e.c.stops++,hasJourney:()=>false},stops:0});
 e.c.$=s=>e.document.querySelector(s);const b=e.element('autoBtn'),src=script(dir,'r514-core-zikir-sentez');const a=src.indexOf("$('#autoBtn').onclick=()=>{");e.run(src.slice(a,src.indexOf("$('#plusBtn').onclick",a)));b.click();assert.equal(e.c.stops,1);
});
test('Failed direct start reports false through the shared transport',async dir=>{
 const {e}=transportFixture(dir,{auto:false});e.c.SukunDirectZikirTransportR698.start=()=>false;assert.equal(e.c.SukunR698Transport.playPause('main'),false);
});
test('Global Stop clears queued work and stops the aggregate once',async dir=>{
 const {e,calls}=transportFixture(dir,{paused:true});e.c.SukunR698Transport.stop('dock');assert.equal(calls.filter(x=>x==='stop-all').length,1);assert(calls.indexOf('clear-queue')<calls.indexOf('stop-all'));
});
test('Initial reading exception releases auto latch and permits retry',async dir=>{
 let throws=true;const e=environment({Z:{auto:false,total:0},ZA:{kapali:true},rep:()=>{if(throws)throw Error('recording failure');return true},zUI(){},zAutoKur(){},lockOn(){},lockOff(){},S:{set(){}},zBekciDurdur(){},r476Stop(){},zikirSesAbortR696(){}});
 e.run('let _zAutoSon=0,_zAutoPlanSeq=0,_r485NiyetGateKey="";');const src=script(dir,'r514-core-zikir-sentez'),a=src.indexOf('let _r477AutoStarting=');
 e.run(src.slice(a,src.indexOf('window.SukunDirectZikirTransportR698=',a)));
 let result;try{result=e.c.autoStart()}catch(_){}assert.equal(result,false);assert.equal(e.c.Z.auto,false);assert.equal(e.run('_r477AutoStarting'),false);throws=false;assert.equal(e.c.autoStart(),true);
});
function registryFixture(dir){
 const e=environment({AudioLife:{userPaused:false,markUserPause(){this.userPaused=true},markUserPlay(){this.userPaused=false},markUserStop(){this.userPaused=true}}});load(e,dir,'r454-audio-session-registry-runtime');return e;
}
test('StopAll clears logical paused state of non-journey readers',async dir=>{
 const e=registryFixture(dir),r=e.c.SukunAudioSessionRegistry;let state='paused',stops=0;r.register('reader',{getState:()=>state,stop:()=>{stops++;state='idle'}});await r.stopAll();await ticks();assert.equal(stops,1);assert.equal(state,'idle');assert.notEqual(r.state('reader'),'paused');
});
test('StopAll reports an asynchronous provider failure',async dir=>{
 const e=registryFixture(dir),r=e.c.SukunAudioSessionRegistry;r.register('reader',{getState:()=> 'playing',stop:async()=>{throw Error('cleanup failed')}});assert.equal(await r.stopAll(),false);
});
test('Delayed StopAll completion preserves the owner of a newer Play',async dir=>{
 const e=registryFixture(dir),r=e.c.SukunAudioSessionRegistry;let release,s='playing';r.register('reader',{priority:90,getState:()=>s,play:()=>{s='playing'},stop:()=>{s='idle'}});r.register('mix',{priority:0,getState:()=> 'idle',stop:()=>new Promise(resolve=>release=resolve)});
 const stopped=r.stopAll();r.play('reader');await ticks();release(true);await stopped;await ticks();assert.equal(r.controllerSnapshot().active,'reader');assert.equal(r.state('reader'),'playing');
});
test('First hidden MediaSession Pause is honored; repeated Pause is idempotent',async dir=>{
 const e=registryFixture(dir),r=e.c.SukunAudioSessionRegistry;let state='playing',pauses=0;e.document.hidden=true;e.c.SukunBerhetiyyeSeyir={state:()=>({run:true,paused:state==='paused'})};
 r.register('berhetiyye',{priority:105,getState:()=>state,pause:()=>{pauses++;state='paused'}});e.c.SukunMediaSessionWakeGuard.handlePause();assert.equal(state,'paused');assert(r.aggregateSnapshot().paused);e.c.SukunMediaSessionWakeGuard.handlePause();assert.equal(pauses,1);
});
test('MediaSession Play clears aggregate pause after native lock resume',async dir=>{
 const e=registryFixture(dir),r=e.c.SukunAudioSessionRegistry;let state='playing';r.register('reader',{priority:95,getState:()=>state,pause:()=>{state='paused'},resume:()=>{state='playing'},play:()=>{state='playing'}});r.pauseAll('ui:test');e.c.SukunLockAudio={duraklatildi:()=>true,surdur:()=>true};e.mediaHandlers.get('play')();await ticks();assert(!r.aggregateSnapshot().paused);assert.equal(state,'playing');
});
test('Queued single/terkip stays silent during pause and resumes in FIFO order',async dir=>{
 const order=[],e=environment({AudioLife:{userPaused:true},SukunAudioSessionRegistry:{aggregateSnapshot:()=>({paused:e.c.AudioLife.userPaused})},SukunVoiceResolver:{playItem:async()=>{order.push('single');return {ok:true}}},SukunTerkipVoice:{play:async()=>{order.push('terkip');return{ok:true}}}});
 load(e,dir,'r635-unified-foreground-runtime');const a=e.c.SukunForegroundArbiter;a.enqueueCaptured({cat:'esma',idx:0,item:{t:'A'}});a.enqueueCaptured({cat:'terkip',idx:0,item:{tr:'B'}});await e.flush();assert.deepEqual(order,[]);assert.equal(a.snapshot().queue.length,2);e.c.AudioLife.userPaused=false;e.event(e.c,'sukun:audioaggregatechange');await e.flush();assert.deepEqual(order,['single','terkip']);assert.equal(a.snapshot().queue.length,0);
});
test('Queued duplicate identity is merged; Stop cancels queued work',async dir=>{
 const e=environment({SukunBerhetiyyeSeyir:{state:()=>({run:true})}});load(e,dir,'r635-unified-foreground-runtime');const a=e.c.SukunForegroundArbiter;a.enqueueCaptured({cat:'esma',idx:1,item:{t:'A'}});a.enqueueCaptured({cat:'esma',idx:1,item:{t:'A'}});await e.flush();assert.equal(a.snapshot().queue.length,1);a.clearQueue('stop');assert.equal(a.snapshot().queue.length,0);
});
test('Restored session never starts audio on Exit or navigation gesture',async dir=>{
 const e=environment({Z:{auto:false},starts:0,autoStart:()=>e.c.starts++,saveSoon(){},saveNow(){},restore(){},read(){},MEMKEY:'memory'}),src=script(dir,'r530-tefekkur-canonical-runtime');
 const start=src.indexOf('function cancelPending(){')>=0?src.indexOf('function cancelPending(){'):src.indexOf('function resumePending(){'),end=src.indexOf('\n/* ── 6.',start);
 e.run('let pendingResume={auto:true,audio:{}};'+src.slice(start,end));e.c.resumePending({target:{closest:()=>null}});e.c.resumePending({target:{closest:()=>({id:'tefExitBtn'})}});assert.equal(e.c.starts,0);
});
test('Tefekkür dock drag bounds reserve a readable surface at five screen sizes',async dir=>{
 const sizes=[[320,640],[390,844],[360,740],[640,360],[1280,900]],results=[];
 for(const [w,h] of sizes){const e=environment({innerWidth:w,innerHeight:h});e.document.documentElement.clientHeight=h;e.document.body.classList.add('sukun-tefekkur-mode');e.element('r170Now').getBoundingClientRect=()=>({height:Math.min(200,h*.4)});load(e,dir,'r633-flow-dock-placement-runtime');const b=e.c.SukunFlowDockPlacement.bounds();assert(b.top>=Math.min(112,h*.3),JSON.stringify({w,h,b}));results.push({width:w,height:h,minimumDockTop:b.top});}return results;
});
test('Missing alert drawer does not consume Escape',async dir=>{
 const e=environment();load(e,dir,'r633-flow-dock-placement-runtime');const event=e.event(e.document,'keydown',{key:'Escape'});assert.equal(event.defaultPrevented,false);
});
test('Reading surface follows live dock drag before pointer release',async dir=>{
 const e=environment(),style=e.document.documentElement.style;
 e.document.body.classList.add('sukun-tefekkur-mode','r699-dock-active');
 style.setProperty('--r699-host-h','200px');style.setProperty('--r699-bottom','8px');
 style.setProperty('--r699-surface-bottom','220px');
 load(e,dir,'r633-flow-dock-placement-runtime');e.c.SukunR699Layout.setY(-60);
 assert.equal(style.getPropertyValue('--r699-surface-bottom'),'280px');
});

function serviceWorker(dir){
 const scope='https://sukun.test/app/',base=new URL('sw.js',scope).href,cacheMap=new Map(),events=new Map();let online=true,overrideManifest=null;
 const absolute=x=>new URL(typeof x==='string'?x:x.url,scope).href;
 class RequestWithBase extends Request{constructor(input,opt){super(typeof input==='string'?absolute(input):input,opt)}}
 function cache(){const data=new Map();return {async put(key,value){data.set(absolute(key),value.clone())},async match(key,opt={}){const u=new URL(absolute(key));for(const [k,v] of data){const a=new URL(k);if(opt.ignoreSearch?a.origin===u.origin&&a.pathname===u.pathname:k===u.href)return v.clone()}},data};}
 const caches={async open(k){if(!cacheMap.has(k))cacheMap.set(k,cache());return cacheMap.get(k)},async keys(){return [...cacheMap.keys()]},async delete(k){return cacheMap.delete(k)},async match(key,opt){for(const c of cacheMap.values()){const r=await c.match(key,opt);if(r)return r}}};
 const self={location:new URL(base),registration:{scope,update:async()=>{}},clients:{claim:async()=>{},matchAll:async()=>[]},addEventListener:(k,fn)=>events.set(k,fn),skipWaiting(){}};
 const c={self,caches,URL,Request:RequestWithBase,Response,console,Promise,setTimeout,clearTimeout,
  fetch:async req=>{if(!online)throw Error('offline');const file=new URL(absolute(req)).pathname.replace(new URL(scope).pathname,'');if(file==='manifest.webmanifest'&&overrideManifest)return new Response(JSON.stringify(overrideManifest));return new Response(read(dir,file),{headers:{'Content-Type':file.endsWith('.html')?'text/html':'application/json'}})}};
 vm.createContext(c);vm.runInContext(read(dir,'sw.js'),c);
 return {c,cacheMap,events,request:x=>new RequestWithBase(x),offline:()=>online=false,manifest:o=>overrideManifest=o,async install(){let p;events.get('install')({waitUntil:x=>p=x});await p;}};
}
test('Offline versioned manifest resolves from the current package cache',async dir=>{
 const s=serviceWorker(dir);await s.install();s.offline();const build=JSON.parse(read(dir,'manifest.webmanifest')).start_url.split('v=')[1];const res=await s.c.onbellekOncelikli(s.request('manifest.webmanifest?v='+build));assert(res.ok);assert.equal((await res.json()).short_name,'SÜKÛN');
});
test('Installer rejects a manifest from a different release',async dir=>{
 const s=serviceWorker(dir),m=JSON.parse(read(dir,'manifest.webmanifest'));m.start_url='./nero.html?v=r999';s.manifest(m);await assert.rejects(s.install(),/manifest build mismatch/);
});
test('Installer rejects mismatched HTML and does not mark cache complete',async dir=>{
 const s=serviceWorker(dir),fetch=s.c.fetch;s.c.fetch=async r=>r.url.endsWith('/nero.html')?new Response('<meta name="sukun-build" content="r999">'):fetch(r);await assert.rejects(s.install(),/HTML build mismatch/);for(const cache of s.cacheMap.values())assert(![...cache.data.keys()].some(x=>x.includes('__sukun_build_')));
});
test('Old cache entry cannot replace an asset from the current cache',async dir=>{
 const s=serviceWorker(dir),old=await s.c.caches.open('sukun-ancient');await old.put('surumler.json',new Response('[{"v":"old"}]'));await s.install();s.offline();const res=await s.c.onbellekOncelikli(s.request('surumler.json'));assert.notEqual((await res.json())[0].v,'old');
});

async function suite(dir){const results=[];for(const t of tests){try{const detail=await t.fn(dir);results.push({name:t.name,status:'PASS',...(detail===undefined?{}:{detail})})}catch(e){results.push({name:t.name,status:'FAIL',error:String(e.message)})}}return {package:path.basename(dir),total:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results};}
module.exports={environment,script,load,test,suite,ticks};
if(require.main===module) (async()=>{const result={kind:'isolated-source-regression',date:new Date().toISOString(),limitations:['DOM fixtures are not a browser layout engine.','No physical audio, Android lock screen, microphone or headset validation.'],target:await suite(target)};if(baseline)result.baseline=await suite(baseline);console.log(JSON.stringify(result,null,2));process.exitCode=result.target.failed?1:0;})().catch(e=>{console.error(e);process.exitCode=1});
