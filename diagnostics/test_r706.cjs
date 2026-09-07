'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {environment,script}=require('./test_r702.cjs');
const dir=path.resolve(process.argv[2]||path.join(__dirname,'..'));const results=[];
function test(name,fn){try{const detail=fn();results.push({name,status:'PASS',detail})}catch(e){results.push({name,status:'FAIL',error:e.stack})}}
function canonical(){
 let handler;const calls={mount:0,begin:0,end:0,save:0,measure:0,perf:0,owner:0};
 const e=environment({SukunLifecycleHub:{onBodyClass(fn){handler=fn}},mount(){calls.mount++},beginSummary(){calls.begin++},endSummary(){calls.end++},saveSoon(){calls.save++},schedule(){calls.measure++},applyPerf(){calls.perf++},scheduleOwnerCheck(){calls.owner++}});
 const s=script(dir,'r530-tefekkur-canonical-runtime');e.run(s.slice(s.indexOf('let wasTef='),s.indexOf('let countBound=')));return{e,calls,fire:()=>handler()};
}
test('Unrelated body class events do not remeasure or rewrite Tefekkür',()=>{const f=canonical();for(let i=0;i<100;i++){f.e.document.body.classList.add('unrelated-'+i);f.fire()}assert.equal(f.calls.measure,0);assert.equal(f.calls.perf,0);return f.calls});
test('Entering and leaving still mounts, saves and measures once each',()=>{const f=canonical();f.e.document.body.classList.add('sukun-tefekkur-mode');f.fire();f.fire();f.e.document.body.classList.remove('sukun-tefekkur-mode');f.fire();assert.deepEqual(f.calls,{mount:1,begin:1,end:1,save:2,measure:2,perf:2,owner:2});});
test('Legacy cleanup preserves current dock dimensions across repeated measurements',()=>{
 const e=environment(),h=e.element('r170Now'),s=script(dir,'r633-flow-dock-placement-runtime');
 e.c.$=id=>e.document.getElementById(id);e.c.root=e.document.documentElement;e.c.B=e.document.body;
 for(const [k,v] of [['height','244px'],['min-height','0px'],['max-height','800px']])h.style.setProperty(k,v);
 e.c.root.style.setProperty('--r659-dock-fit-h','244px');e.c.root.style.setProperty('--r671-zcard-h','999px');
 const start=s.indexOf('function clearLegacy()'),end=s.indexOf('let modalTrigger',start);assert(start>=0&&end>start);e.run(s.slice(start,end));
 for(let i=0;i<100;i++)e.c.clearLegacy();assert.equal(h.style.getPropertyValue('height'),'244px');assert.equal(e.c.root.style.getPropertyValue('--r659-dock-fit-h'),'244px');assert(!e.c.root.style.getPropertyValue('--r671-zcard-h'));
});
test('Repeated geometry writes are suppressed locally and priority changes still apply',()=>{
 const e=environment(),s=script(dir,'r633-flow-dock-placement-runtime');const start=s.indexOf('function r706Style(');assert(start>=0);e.run(s.slice(start,s.indexOf('\nfunction mode()',start)));
 let writes=0,value='',priority='';const style={getPropertyValue:()=>value,getPropertyPriority:()=>priority,setProperty(k,v,p){writes++;value=v;priority=p}};
 for(let i=0;i<100;i++)e.c.r706Style(style,'height','244px','important');assert.equal(writes,1);e.c.r706Style(style,'height','244px','');assert.equal(writes,2);
});
test('Hidden layout events do not enqueue animation frames',()=>{const e=environment();e.document.hidden=true;e.run(script(dir,'r633-flow-dock-placement-runtime'));e.c.SukunR699Layout.schedule('hidden-transport');assert.equal(e.timers.size,0)});
test('Temporary performance fallback expires without an unrelated UI event',()=>{
 const e=environment(),s=script(dir,'r530-tefekkur-canonical-runtime');let now=1000;e.c.Date={now:()=>now};e.c.perf={requested:'dengeli',until:31000};e.c.perfReleaseTimer=0;e.document.body.classList.add('sukun-tefekkur-mode');const start=s.indexOf('function applyPerf()'),end=s.indexOf('\ntry{new PerformanceObserver',start);e.run(s.slice(start,end));e.c.applyPerf();assert.equal(e.document.body.dataset.perfEffective,'pil');now=31011;e.timer(30010);assert.equal(e.document.body.dataset.perfEffective,'sakin');
});
test('Performance fallback expiry preserves the user-selected battery profile',()=>{
 const e=environment(),s=script(dir,'r530-tefekkur-canonical-runtime');e.c.perf={requested:'pil',until:0};e.c.perfReleaseTimer=0;e.document.body.dataset.perf='pil';const start=s.indexOf('function applyPerf()'),end=s.indexOf('\ntry{new PerformanceObserver',start);e.run(s.slice(start,end));assert.equal(e.c.applyPerf(),'pil');assert.equal(e.timers.size,0);
});
function atmosphere({tef=false,reduced=false,canvasMissing=false}={}){
 let classHandler,intersectHandler;const observers=[];let draws=0;const media={matches:reduced,addEventListener(){},removeEventListener(){}};
 const context={setTransform(){},clearRect(){draws++},drawImage(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillRect(){},createRadialGradient(){return{addColorStop(){}}}};
 const e=environment({matchMedia:()=>media,devicePixelRatio:3,SukunLifecycleHub:{onBodyClass(fn,options){classHandler=fn;if(options?.immediate)fn();return()=>{classHandler=null}}},IntersectionObserver:class{constructor(fn){intersectHandler=fn}observe(){}disconnect(){}},MutationObserver:class{constructor(fn){this.fn=fn;observers.push(this)}observe(el,options){this.el=el;this.options=options}disconnect(){this.disconnected=true}}});
 const create=e.document.createElement;e.document.createElement=tag=>{const el=create(tag);if(tag==='canvas')el.getContext=()=>canvasMissing?null:context;return el};
 const root=e.element('tfRefinedLayout'),counter=e.element('zCountVisual'),count=e.element('cntBig');root.isConnected=true;
 root.getBoundingClientRect=()=>({left:0,top:0,width:390,height:560});counter.getBoundingClientRect=()=>({left:100,top:150,width:190,height:190});
 const canvas=e.element('r706Smoke');canvas.getContext=()=>canvasMissing?null:context;
 for(const id of ['r706Motion','r706Intensity','r706IntensityValue'])e.element(id);
 if(tef)e.document.body.classList.add('sukun-tefekkur-mode');e.run(script(dir,'r706-atmosphere-runtime'));e.event(e.document,'DOMContentLoaded');
 return{e,root,counter,count,canvas,api:e.c.SukunAtmosphereR706,observers,media,draws:()=>draws,enter(){e.document.body.classList.add('sukun-tefekkur-mode');classHandler()},exit(){e.document.body.classList.remove('sukun-tefekkur-mode');classHandler()},offscreen(v){intersectHandler?.([{isIntersecting:!v}])},frame(){e.timer(16)}};
}
test('Atmosphere is lazy and leaves audio / counters untouched before entry',()=>{const f=atmosphere();assert.equal(f.api.snapshot().canvas,false);assert.equal(f.e.timers.size,0);assert.equal(f.count.textContent,'');f.enter();assert(f.api.snapshot().canvas);assert(f.api.snapshot().moving);assert.equal(f.count.textContent,'')});
test('Hidden page cancels pending frames and preserves counter',()=>{const f=atmosphere({tef:true});f.frame();const before=f.draws();f.e.document.hidden=true;f.e.event(f.e.document,'visibilitychange');assert(!f.api.snapshot().rafPending);assert(!f.api.snapshot().resizePending);f.frame();assert.equal(f.draws(),before);assert.equal(f.count.textContent,'');});
test('Repeated exit and reentry keep one canvas / counter observer',()=>{const f=atmosphere({tef:true});for(let i=0;i<10;i++){f.exit();assert(!f.api.snapshot().rafPending);f.enter();}assert.equal(f.root.children.filter(n=>n.id==='r706Atmosphere').length,1);assert.equal(f.observers.filter(n=>n.el===f.count).length,1)});
test('Reduced motion produces a static atmosphere with no loop',()=>{const f=atmosphere({tef:true,reduced:true});f.frame();assert(!f.api.snapshot().moving);assert(!f.api.snapshot().rafPending);assert(f.draws()>0)});
test('Offscreen and battery profile stop rendering; visible return resumes',()=>{const f=atmosphere({tef:true});f.offscreen(true);assert(!f.api.snapshot().rafPending);f.offscreen(false);assert(f.api.snapshot().rafPending);f.e.document.body.dataset.perf='pil';f.api.refresh();assert(!f.api.snapshot().rafPending)});
test('Missing canvas context still leaves the canonical counter usable',()=>{const f=atmosphere({tef:true,canvasMissing:true});assert(!f.api.snapshot().canvas);assert(!f.api.snapshot().rafPending);assert.equal(f.counter.id,'zCountVisual');assert.equal(f.root.children.filter(n=>n.id==='r706AtmosphereControls').length,1)});
test('Canvas backing resolution is capped even on a high-DPR phone',()=>{const f=atmosphere({tef:true});f.frame();assert.equal(f.canvas.width,Math.round(390*1.25));assert.equal(f.canvas.height,Math.round(560*1.25))});
test('Disposal cancels frames, disconnects observers and does not restart',()=>{const f=atmosphere({tef:true});f.api.dispose();assert(!f.api.snapshot().rafPending);assert(!f.api.snapshot().resizePending);assert(f.observers.every(o=>o.disconnected));f.api.refresh();assert(!f.api.snapshot().rafPending)});
console.log(JSON.stringify({kind:'r706-isolated-behavior-tests',environment:'Node VM; not browser rendering or Android hardware',total:results.length,passed:results.filter(x=>x.status==='PASS').length,failed:results.filter(x=>x.status==='FAIL').length,results},null,2));
if(results.some(x=>x.status==='FAIL'))process.exitCode=1;
