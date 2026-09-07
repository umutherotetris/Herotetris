#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {environment,script,load,test,suite,ticks}=require('./test_r702.cjs');
const BUILD=fs.readFileSync(path.join(__dirname,'..','nero.html'),'utf8').match(/name="sukun-build" content="([^"]+)"/)[1];
const target=path.resolve(process.argv[2]||path.join(__dirname,'..')),baseline=process.argv[3]&&path.resolve(process.argv[3]);
function curtain(dir){const h=fs.readFileSync(path.join(dir,'nero.html'),'utf8');return [...h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(m=>m[1].includes("var perde=document.getElementById('acilisPerde')"))[1];}
function opening(dir,context=null){let calls=0,gongs=0,resumes=0;const e=environment({ctx:context,ac(){calls++;e.c.ctx={state:'suspended',resume(){resumes++;return Promise.resolve()}}},gongSentez(){gongs++},huSentez(){}});const p=e.element('acilisPerde');e.run(curtain(dir));return{e,p,counts:()=>({calls,gongs,resumes})};}
test('Cold opening timer does not allocate the audio engine',async dir=>{const f=opening(dir);f.e.timer(620);assert.deepEqual(f.counts(),{calls:0,gongs:0,resumes:0});});
test('Opening timer preserves an already suspended audio context',async dir=>{let resumes=0;const f=opening(dir,{state:'suspended',resume(){resumes++;return Promise.resolve()}});f.e.timer(620);assert.equal(resumes,0);assert.equal(f.counts().calls,0);});
test('Opening gesture and later timer produce a single gong',async dir=>{const f=opening(dir);f.e.event(f.p,'pointerdown');f.e.timer(620);assert.equal(f.counts().gongs,1);assert.equal(f.counts().calls,1);});
test('Unrelated body classes cause no repeated theme style calculations',async dir=>{
 let reads=0,observer;const e=environment({MutationObserver:class{constructor(fn){this.fn=fn;observer=this}observe(el,opt){this.opt=opt}},getComputedStyle:()=>{reads++;return{getPropertyValue:()=> '#05090c'}}});
 const meta=e.element();meta.isConnected=true;e.document.querySelector=s=>s==='meta[name="theme-color"]'?meta:null;
 load(e,dir,'r176-visual-state');e.event(e.document,'DOMContentLoaded');e.timer(16);assert.equal(reads,1);
 for(let i=0;i<100;i++){e.document.body.className='dock-'+i;if(observer.opt.attributeFilter.includes('class'))observer.fn([]);e.timer(16)}
 assert.equal(reads,1);e.document.body.setAttribute('data-tema','gul');observer.fn([]);e.timer(16);assert.equal(reads,2);
});
test('Unchanged journey cards generate no repeated text mutations',async dir=>{
 const src=script(dir,'r616-friendly-ui-runtime'),e=environment(),nodes=new Map();let state={i:0,totalDone:0};
 for(const id of ['.r616JourneyState','.r616JourneyProgress i','.r616JourneyCount','.r616JourneyRepeat','[data-r616-journey-action]'])nodes.set(id,e.element());
 e.c.q=s=>nodes.get(s);e.c.journeyState=()=>state;
 const helpers=src.split('\n').filter(x=>x.startsWith('const r704Attr=')||x.startsWith('const r704Text=')).join('\n');
 e.run(helpers+'\n'+src.slice(src.indexOf('function updateJourneyCard('),src.indexOf('function renderJourneys(')));
 e.c.updateJourneyCard({},'99');e.metrics.writes=0;for(let i=0;i<100;i++)e.c.updateJourneyCard({},'99');assert.equal(e.metrics.writes,0);
 state={i:1,totalDone:3};e.c.updateJourneyCard({},'99');assert.equal(nodes.get('.r616JourneyCount').textContent,'1 / 99 isim');
});
function lifecycleStop(dir,held){
 const life={userPaused:held,state:held?'paused':'playing',busy:()=>false,reconcileUserPaused(v){this.userPaused=v},set(v){this.state=v}};
 const e=environment({MINI:{paused:held},AudioLife:life,SukunAudioHub:{userPaused:held,set(){}},SukunAudioSessionRegistry:{aggregateSnapshot:()=>({paused:held})},autoStop(){}}),src=script(dir,'premiumR160');
 const start=src.indexOf("try{if(typeof autoStop==='function')"),end=src.indexOf("try{if(typeof frStart==='function')",start);assert(start>=0&&end>start);e.run(src.slice(start,end));e.c.autoStop();return{e,life};
}
test('Delayed auto Stop preserves aggregate pause after the scheduler stops',async dir=>{const {e,life}=lifecycleStop(dir,true);e.timer(20);assert.equal(life.userPaused,true);assert.equal(life.state,'paused');assert(e.c.SukunAudioHub.userPaused);});
test('Explicit Stop still resolves to idle when there is no pause',async dir=>{const {e,life}=lifecycleStop(dir,false);e.timer(20);assert.equal(life.userPaused,false);assert.equal(life.state,'idle');});
test('Terminal reconciliation cannot clear a newer aggregate pause',async dir=>{
 let cleared=0;const e=environment({MINI:{paused:true},SukunAudioSessionRegistry:{aggregateSnapshot:()=>({paused:true}),reconcilePauseGate:()=>cleared++},AudioLife:{reconcileUserPaused:()=>cleared++}});load(e,dir,'r654-terminal-audio-reconcile');assert.equal(e.c.SukunTerminalAudioReconcile.reconcile('old-stop'),false);assert.equal(cleared,0);
});
function buildProbe(dir,{http=200,throws=false,sw=BUILD}={}){
 const e=environment({BUILD,clean:String,freeze:x=>x,safe:(fn,other)=>{try{return fn()}catch(_){return other}},SukunUpdateManager:{snapshot:()=>({workerVersion:sw})},fetch:async()=>{if(throws)throw Error('offline');return{ok:http===200,status:http,json:async()=>({build:BUILD})}}}),src=script(dir,'r632-state-authority-regression-shield');
 e.document.querySelector=()=>({content:BUILD});const start=src.indexOf('async function probeBuild(){'),end=src.indexOf('lastBuildProbe=freeze(result);return lastBuildProbe;',start)+'lastBuildProbe=freeze(result);return lastBuildProbe;'.length;
 assert(start>=0&&end>start);e.run('let lastBuildProbe=null;'+src.slice(start,end)+'\n}');return e.c.probeBuild();
}
function contractRepair(dir,paused,wasAuto,aggregatePause){
 const e=environment({MINI:{paused,wasAuto},miniPlayingInfo:()=>({active:false}),audit:()=>({ok:true}),refresh(){},SukunAudioSessionRegistry:{aggregateSnapshot:()=>({paused:aggregatePause})}}),src=script(dir,'r438-audio-contract-guard');
 const start=src.indexOf('function repair(){'),end=src.indexOf('/* Playback',start);assert(start>=0&&end>start);e.run(src.slice(start,end));e.c.repair();return e.c.MINI;
}
test('Delayed audio repair preserves the captured auto counter and resume state',async dir=>{const s=contractRepair(dir,true,true,true);assert(s.paused);assert(s.wasAuto)});
test('Standalone mini pause preserves a saved auto counter without an aggregate gate',async dir=>{const s=contractRepair(dir,true,true,false);assert(s.paused);assert(s.wasAuto)});
test('Audio repair still removes an orphan pause with no captured source',async dir=>{const s=contractRepair(dir,true,false,false);assert.equal(s.paused,false);assert.equal(s.wasAuto,false)});
test('Retired daily splash callback safely skips a missing or partial card',async dir=>{
 const e=environment({S:{get(){return''},set(){throw Error('missing card marked seen')}},DAILY_WORDS:[{t:'Test',s:'Source'}]}),src=script(dir,'r514-core-icons-ambience');e.c.$=selector=>e.document.getElementById(selector.slice(1));e.run(src.slice(src.indexOf('function dailyShow('),src.indexOf('function splashOut(')));
 assert.doesNotThrow(()=>e.c.dailyShow(true));e.element('dailyCard');assert.doesNotThrow(()=>e.c.dailyShow(true));
});
test('Existing daily splash still renders and records its shown state',async dir=>{
 let seen=0;const e=environment({S:{get(){return''},set(){seen++}},DAILY_WORDS:[{t:'Test',s:'Source'}],splashTimer:null,splashOut(){}}),src=script(dir,'r514-core-icons-ambience');for(const id of ['dailyCard','dcText','dcSrc'])e.element(id);
 e.c.$=selector=>e.document.getElementById(selector.slice(1));e.run(src.slice(src.indexOf('function dailyShow('),src.indexOf('function splashOut(')));e.c.dailyShow(true);assert.equal(e.document.getElementById('dcText').textContent,'«Test»');assert.equal(seen,1);
});
test('Load timers do not initialize unused Tekke or NeuroSync panels',async dir=>{
 let factories=0;const e=environment({Tekke:{hazirla(){factories++}},Neuro:{hazirla(){factories++}}}),src=script(dir,'r514-core-yedek-vird');let start=src.indexOf('  /* r704: COLD_START_PANELS');if(start<0)start=src.indexOf('  /* ── r99: PANELLERİ ARKA PLANDA KUR');assert(start>=0);e.run(src.slice(start,src.indexOf("  if(typeof scrimInit==='function')",start)));e.event(e.c,'load');e.timer(1500);e.timer(3000);assert.equal(factories,0);
});
for(const [name,factory] of [['Tekke','__tekkeFabrika'],['Neuro','__neuroFabrika']])test(name+' first open initializes once; closing an unopened panel stays cold',async dir=>{
 const html=fs.readFileSync(path.join(dir,'nero.html'),'utf8'),start=html.indexOf('window.'+name+'=(function(){');assert(start>=0);const end=html.indexOf('})();',start)+5;let creates=0,opens=0;const e=environment({[factory]:()=>{creates++;return{open(){opens++},close(){}}}});e.run(html.slice(start,end));e.c[name].close();assert.equal(creates,0);e.c[name].open();e.c[name].open();assert.equal(creates,1);assert.equal(opens,2);
});
test('Missing build marker cannot be reported as a successful self-check',async dir=>{assert.equal((await buildProbe(dir,{throws:true})).ok,false)});
test('HTTP error build marker cannot pass with a plausible JSON body',async dir=>{assert.equal((await buildProbe(dir,{http:404})).ok,false)});
test('Old Service Worker makes the runtime build check fail',async dir=>{assert.equal((await buildProbe(dir,{sw:'r698'})).ok,false)});
test('Matching marker and Service Worker pass the runtime build check',async dir=>{assert.equal((await buildProbe(dir)).ok,true)});
(async()=>{const result={kind:'r704-isolated-source-regression',date:new Date().toISOString(),target:await suite(target)};if(baseline)result.baseline=await suite(baseline);console.log(JSON.stringify(result,null,2));process.exitCode=result.target.failed?1:0})().catch(e=>{console.error(e);process.exitCode=1});
