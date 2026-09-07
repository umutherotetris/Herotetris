'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(__dirname+'/r699/nero.html','utf8');
function script(id){const a=html.indexOf('<script id="'+id+'">');assert(a>=0,id);const b=html.indexOf('</script>',a);return html.slice(html.indexOf('>',a)+1,b)}
const txCode=html.slice(html.indexOf('const ZikirTransitionTxn=window.SukunZikirTransaction='),html.indexOf('function r482CommitTransition(',html.indexOf('const ZikirTransitionTxn=window.SukunZikirTransaction=')));
function environment(){
 const events={},timers=new Map();let clock=0,next=0;
 const Z={cat:'esma',idx:0,count:0,total:0,devir:0,target:2,auto:true,adv:true,autoId:null};
 const stats=[],writes=[];let stops=0;
 const win={addEventListener:(k,fn)=>(events[k]??=[]).push(fn),dispatchEvent:()=>{},SukunUsageStatsRollbackR695:(...x)=>stats.push(x),SukunR698Voice:{ready:()=>{},fail:()=>{}},SukunAudioSessionRegistry:{aggregateSnapshot:()=>({paused:false})},AudioLife:{snapshot:()=>({userPaused:false})}};
 const doc={hidden:false,body:{classList:{add:()=>{},remove:()=>{}}},addEventListener:(k,fn)=>(events[k]??=[]).push(fn),getElementById:()=>({textContent:'İsim'})};
 const ctx={window:win,document:doc,Z,S:{set:(...x)=>writes.push(x)},Date:{now:()=>clock},Math,Number,String,Object,Array,Set,Promise,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:clock+ms});return id},clearTimeout:id=>timers.delete(id),zikirSesliAktifMi:()=>true,ZIKIR_BIRLIKTE:false,zUI:()=>{},zAutoKur:()=>{},autoStop:()=>{stops++;Z.auto=false;win.SukunZikirTransportGate.reset('auto-stop')},ZIKIR:{esma:{items:[{},{}]}},zikirSonuSes:()=>{},tozSac:()=>{},zikirTamam:()=>{},zHedefSecimeUyarla:()=>{},renderZikir:()=>{},SukunHaptics:{devir:()=>{}},console};
 vm.createContext(ctx);vm.runInContext(txCode,ctx);vm.runInContext(script('r640-zikir-transport-gate'),ctx);
 function tick(ms){clock+=ms;for(let i=0;i<100;i++){const due=[...timers].filter(([,t])=>t.at<=clock);if(!due.length)break;for(const [id,t] of due){timers.delete(id);t.fn()}}}
 function count(target=2){Z.target=target;const g=win.SukunZikirTransportGate,t=g.beforeCount();assert(t&&t!==false);const cert={id:t.id,status:'pending'};Z.count++;Z.total++;let tx=null;if(Z.count>=Z.target)tx=win.SukunZikirTransaction.prepare({cat:Z.cat,idx:Z.idx,target:Z.target,adv:true,voiceCert:cert});assert.equal(g.afterCount(t,tx,cert),true);return {t,cert,tx}}
 return{ctx,Z,win,doc,stats,writes,tick,count,get stops(){return stops}};
}
let passed=0;function test(name,fn){fn();passed++;console.log('PASS',name)}
test('unconfirmed target cannot commit via watchdog or lifecycle rescue',()=>{const e=environment(),{t,cert,tx}=e.count(1),T=e.win.SukunZikirTransaction;assert.equal(T.commitCurrent('watchdog-hard'),false);assert.equal(e.Z.idx,0);assert.equal(e.Z.devir,0);assert.equal(T.confirmVoice(tx,cert),false);assert.equal(e.win.SukunZikirTransportGate.voiceResult(t,true,tx),true);assert.equal(T.commitCurrent('voice-end'),true);assert.equal(T.commit(tx,'duplicate'),false);assert.equal(e.Z.devir,1);assert.equal(e.Z.idx,1)});
test('failed spoken repetition restores exactly one own delta',()=>{const e=environment(),{t}=e.count(2);assert.equal(e.Z.total,1);assert.equal(e.win.SukunZikirTransportGate.voiceResult(t,false,null),false);assert.equal(e.Z.total,0);assert.equal(e.Z.count,0);assert.equal(e.stats.length,1);assert.equal(e.stats[0][0],1);assert.equal(e.stops,1);assert.equal(e.win.SukunZikirTransportGate.snapshot().failure,true)});
test('stop invalidates stale callback and preserves new session',()=>{const e=environment(),{t,tx}=e.count(1);e.win.SukunZikirTransportGate.abortPending('auto-stop');e.Z.auto=false;e.Z.auto=true;e.win.SukunZikirTransportGate.reset('auto-start');const n=e.count(1);assert.equal(e.win.SukunZikirTransportGate.voiceResult(t,false,tx),false);assert.equal(e.Z.count,1);assert.equal(e.Z.total,1);assert.equal(e.win.SukunZikirTransportGate.voiceResult(n.t,true,n.tx),true);assert.equal(e.win.SukunZikirTransaction.commit(n.tx),true);assert.equal(e.Z.devir,1)});
test('pause/resume retains the in-flight lease',()=>{const e=environment(),{t}=e.count(2),g=e.win.SukunZikirTransportGate;e.win.AudioLife.snapshot=()=>({userPaused:true});g.reconcile('pause');assert.equal(g.snapshot().held,true);e.win.AudioLife.snapshot=()=>({userPaused:false});g.reconcile('resume');assert.equal(g.snapshot().activeToken.id,t.id);assert.equal(g.voiceResult(t,true,null),true);e.tick(100);assert.equal(g.snapshot().activeToken,null);assert.equal(e.stops,0)});
test('conflicting newer counter edit is not overwritten',()=>{const e=environment(),{t}=e.count(2);e.Z.count=4;e.Z.total=4;assert.equal(e.win.SukunZikirTransportGate.voiceResult(t,false,null),false);assert.equal(e.Z.count,4);assert.equal(e.Z.total,4);assert.equal(e.win.SukunZikirTransportGate.snapshot().conflicts,1);assert.equal(e.stats.length,0)});
test('manual spoken transaction requires its own success certificate',()=>{const e=environment(),cert={id:99,status:'pending'},T=e.win.SukunZikirTransaction,tx=T.prepare({cat:'esma',idx:0,target:1,adv:true,voiceCert:cert});assert.equal(T.commitCurrent('lifecycle'),false);cert.status='success';assert.equal(T.confirmVoice(tx,cert),true);assert.equal(T.commit(tx,'voice-end'),true);assert.equal(T.commit(tx,'late-duplicate'),false)});
test('cancelling an old transaction cannot cancel a newer one',()=>{const e=environment(),T=e.win.SukunZikirTransaction,a=T.prepare({cat:'esma',idx:0,target:1}),b=T.prepare({cat:'esma',idx:0,target:2});assert.equal(T.cancel('stale',a),false);assert.equal(T.isCurrent(b),true)});


test('failed hold survives idle reconciliation until an explicit new start',()=>{const e=environment(),{t}=e.count(2),g=e.win.SukunZikirTransportGate;g.voiceResult(t,false,null);g.reconcile('late-audio-event');assert.equal(g.snapshot().failure,true);assert.equal(g.snapshot().held,true);g.reset('auto-start');assert.equal(g.snapshot().failure,false)});
test('duplicate failure cannot roll back a second repetition',()=>{const e=environment(),{t}=e.count(2),g=e.win.SukunZikirTransportGate;g.voiceResult(t,false,null);e.Z.auto=true;g.reset('auto-start');const n=e.count(2);assert.equal(g.voiceResult(t,false,null),false);assert.equal(e.Z.total,1);assert.equal(g.voiceResult(n.t,true,null),true);assert.equal(e.Z.total,1)});
async function startRace(){
 const e=environment();e.Z.auto=false;let resolves=[],repCalls=0,prepareCalls=0;
 const audio={state:'suspended',resume(){return new Promise(resolve=>resolves.push(resolve))}};
 e.ctx.ctx=audio;e.ctx.ac=()=>{};e.ctx.r476Prime=()=>{};e.ctx.r476Prepare=()=>{prepareCalls++};e.ctx.lockOn=()=>{};e.ctx.lockOff=()=>{};e.ctx.rep=()=>{repCalls++;e.Z.count++;e.Z.total++};e.ctx.zAutoKur=()=>{};e.ctx.zikirAcilisAna=()=>{};e.ctx.ZA={kapali:true};e.ctx._zAutoSon=0;e.ctx._zAutoPlanSeq=0;e.ctx._r485NiyetGateKey='';e.ctx.zBekciDurdur=()=>{};e.ctx.zikirSesAbortR696=()=>{};e.ctx.r476Stop=()=>{};
 e.win.SukunR698Voice={begin:()=>{},ready:()=>{},cancel:()=>{},fail:()=>{}};e.win.SukunR698PendingStart=null;
 const source=html.slice(html.indexOf('let _r477AutoStarting=false'),html.indexOf('/* ════════════════════════════════════════════════════════════\n   6) ARAYÜZ BAĞLARI',html.indexOf('let _r477AutoStarting=false')));
 vm.runInContext(source,e.ctx);
 assert.equal(e.ctx.autoStart(),true);assert.equal(repCalls,0);
 e.ctx.autoStop();audio.state='running';resolves.shift()();await new Promise(setImmediate);
 assert.equal(repCalls,0);assert.equal(e.Z.auto,false);
 audio.state='suspended';assert.equal(e.ctx.autoStart(),true);assert.equal(repCalls,0);
 audio.state='running';resolves.shift()();await new Promise(setImmediate);
 assert.equal(repCalls,1);assert.equal(e.Z.auto,true);assert.equal(prepareCalls,1);
 e.ctx.autoStop();assert.equal(e.Z.auto,false);
 console.log('PASS pending AudioContext start cannot resurrect after Stop');passed++;
}
startRace().then(()=>console.log(`\n${passed} isolated transport regression tests passed.`)).catch(e=>{console.error(e);process.exitCode=1});
