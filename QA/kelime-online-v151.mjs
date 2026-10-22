// Actual Kelime Firebase module with two deterministic peers; no production service writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../js/games/kelime-engine.js';
const source=fs.readFileSync(new URL('../js/games/kelime-online.js',import.meta.url),'utf8');
const uiSource=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const clone=x=>x===undefined?undefined:structuredClone(x),noop=()=>{};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let moduleNo=0,groups=0;
function bus(){
 const data={},listeners=new Map(),hooks={},disconnects=[],storage=new Map();let next=0;
 const get=p=>p.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data)??null;
 function put(p,v){const keys=p.split('/').filter(Boolean);let at=data;for(const k of keys.slice(0,-1))at=at[k]??={};if(v===null)delete at[keys.at(-1)];else at[keys.at(-1)]=clone(v);}
 const snap=v=>({val:()=>clone(v),exists:()=>v!==null});
 const emit=p=>{for(const[path,cbs]of listeners)if(p===path||p.startsWith(path+'/'))for(const cb of [...cbs])cb(snap(get(path)));};
 const fdb={ref:(_db,p)=>p,push:()=>({key:'id'+(++next)}),
  get:async p=>snap(get(p)),
  set:async(p,v)=>{if(hooks.set)await hooks.set(p,v);put(p,v);emit(p);},
  remove:async p=>{if(hooks.remove)await hooks.remove(p);put(p,null);emit(p);},
  update:async(p,patch)=>{if(hooks.update)await hooks.update(p,patch);for(const[k,v]of Object.entries(patch))put(p+'/'+k,v);emit(p);},
  runTransaction:async(p,fn)=>{if(hooks.transaction)await hooks.transaction(p);const v=fn(clone(get(p)));if(v===undefined)return {committed:false,snapshot:snap(get(p))};put(p,v);emit(p);return {committed:true,snapshot:snap(get(p))};},
  onValue:(p,cb)=>{if(!listeners.has(p))listeners.set(p,new Set());listeners.get(p).add(cb);queueMicrotask(()=>{if(listeners.get(p)?.has(cb))cb(snap(get(p)));});return()=>listeners.get(p)?.delete(cb);},
  onDisconnect:p=>({set:async()=>{disconnects.push(p);},cancel:async()=>{},remove:async()=>{}})};
 async function peer(uid){
  globalThis.__kelime151={Auth:{getState:()=>({uid,displayName:uid.toUpperCase()})},db:{},fdb,localStorage:{getItem:k=>storage.get(uid+':'+k)??null,setItem:(k,v)=>storage.set(uid+':'+k,v)}};
  const rewritten=source.replace("import { Auth, db, fdb } from '../auth.js';",'const {Auth,db,fdb,localStorage}=globalThis.__kelime151;');
  const mod=await import('data:text/javascript;base64,'+Buffer.from(rewritten+'\n// '+moduleNo++).toString('base64'));
  delete globalThis.__kelime151;return mod;
 }
 return {get,put,hooks,listeners,disconnects,storage,peer};
}
function invited(extra={}){return {seed:91,status:'invited',invited:'bob',players:{A:'alice'},names:{A:'ALICE'},presence:{A:true},lang:'en',...extra};}
function room(extra={}){return {seed:91,status:'active',players:{A:'alice',B:'bob'},names:{A:'ALICE',B:'BOB'},presence:{},lang:'en',turn:'A',bagPointer:14,...extra};}
async function test(name,fn){await fn();groups++;console.log('PASS '+name);}
await test('random matching joins two peers atomically with matching language',async()=>{
 const b=bus(),a=await b.peer('alice'),guest=await b.peer('bob');let A,B;
 await a.findMatch({onMatched:d=>A=d},{lang:'en'});
 await guest.findMatch({onMatched:d=>B=d},{lang:'en'});
 assert.equal(A.gameId,B.gameId);assert.equal(A.role,'A');assert.equal(B.role,'B');assert.equal(A.seed,B.seed);
 assert.equal(b.get('kelimeGames/'+A.gameId+'/status'),'active');assert.equal(b.get('kelimeGames/'+A.gameId+'/players/B'),'bob');
});
await test('host cancellation between queue claim and room join cannot recreate ghost room',async()=>{
 const b=bus(),guest=await b.peer('bob');b.put('kelimeQueue/waiting_en',{uid:'alice',name:'Alice',ts:Date.now(),gameId:'host'});
 b.put('kelimeGames/host',room({players:{A:'alice'},status:'waiting'}));let matched=0,error='';
 b.hooks.transaction=async p=>{if(p==='kelimeGames/host')b.put(p,null);};
 await guest.findMatch({onMatched:()=>matched++,onError:e=>error=e},{lang:'en'});
 assert.equal(matched,0);assert.ok(error);assert.equal(b.get('kelimeGames/host'),null);
});
await test('cancel during invite room creation cannot recreate session or invite',async()=>{
 const b=bus(),a=await b.peer('alice'),gate=deferred();b.hooks.set=async p=>{if(p==='kelimeGames/id1')await gate.promise;};
 let sent=0,matched=0;const pending=a.sendInvite('bob','Bob',{onSent:()=>sent++,onAccepted:()=>matched++},{lang:'en'});
 await Promise.resolve();await Promise.resolve();await a.cancelInvite();gate.resolve();await pending;
 assert.equal(a.getSession(),null);assert.equal(b.get('kelimeGames/id1'),null);assert.equal(b.get('gameInvites/bob/id2'),null);assert.equal(sent+matched,0);
});
await test('cancel during invite publication removes late notification and waiting room',async()=>{
 const b=bus(),a=await b.peer('alice'),gate=deferred();let started=false;b.hooks.set=async p=>{if(p.startsWith('gameInvites/')){started=true;await gate.promise;}};
 const pending=a.sendInvite('bob','Bob',{});while(!started)await Promise.resolve();await a.cancelInvite();gate.resolve();await pending;
 assert.equal(a.getSession(),null);assert.equal(b.get('kelimeGames/id1'),null);assert.equal(b.get('gameInvites/bob/id2'),null);
});
await test('two peers carry invitation language, opponent identity and resumable indexes',async()=>{
 const b=bus(),a=await b.peer('alice'),guest=await b.peer('bob');let A,B;
 await a.sendInvite('bob','Bob',{onAccepted:d=>A=d},{lang:'en'});
 const inv={id:'id2',...b.get('gameInvites/bob/id2')};assert.equal(inv.lang,'en');
 await guest.acceptInvite(inv,{onMatched:d=>B=d});
 assert.equal(A.lang,'en');assert.equal(B.lang,'en');assert.equal(A.oppUid,'bob');assert.equal(B.oppUid,'alice');
 assert.equal(a.getSession().waiting,false);assert.equal(guest.getSession().seed,A.seed);
 assert.equal(b.get('kelimeMyGames/alice/id1').oppUid,'bob');assert.equal(b.get('kelimeMyGames/bob/id1').oppUid,'alice');
 assert.equal(b.get('gameInvites/bob/id2'),null);assert.equal((await guest.listMyGames()).length,1);
});
await test('outsiders, occupied rooms and finished invitations cannot overwrite player B',async()=>{
 for(const [uid,extra] of [['mallory',{}],['bob',{players:{A:'alice',B:'carol'},status:'active'}],['bob',{status:'over'}]]){
  const b=bus(),p=await b.peer(uid);b.put('kelimeGames/invite',invited(extra));let matched=0,error='';
  const before=clone(b.get('kelimeGames/invite'));await p.acceptInvite({id:'x',gameId:'invite'},{onMatched:()=>matched++,onError:e=>error=e});
  assert.deepEqual(b.get('kelimeGames/invite'),before);assert.equal(matched,0);assert.ok(error);assert.equal(p.getSession(),null);
 }
});
await test('accept rechecks cancellation inside atomic transaction',async()=>{
 const b=bus(),p=await b.peer('bob'),gate=deferred();b.put('kelimeGames/invite',invited());let entered=false,matched=0;
 b.hooks.transaction=async()=>{entered=true;await gate.promise;};const pending=p.acceptInvite({id:'x',gameId:'invite'},{onMatched:()=>matched++});
 while(!entered)await Promise.resolve();await p.leaveRoom();gate.resolve();await pending;
 assert.equal(b.get('kelimeGames/invite/status'),'invited');assert.equal(b.get('kelimeGames/invite/players/B'),null);assert.equal(matched,0);
});
await test('cancel racing accepted match preserves active room for resume',async()=>{
 const b=bus(),p=await b.peer('alice');await p.sendInvite('bob','Bob',{});const gate=deferred();let entered=false;
 b.hooks.remove=async p=>{if(p==='gameInvites/bob/id2'){entered=true;await gate.promise;}};
 const pending=p.cancelInvite();while(!entered)await Promise.resolve();b.put('kelimeGames/id1/players/B','bob');b.put('kelimeGames/id1/status','active');gate.resolve();await pending;
 assert.equal(b.get('kelimeGames/id1/status'),'active');assert.equal(b.get('kelimeGames/id1/players/B'),'bob');assert.equal(b.get('kelimeGames/id1/presence/A'),false);
});
await test('late old invitation listener cannot accept a replacement session',async()=>{
 const b=bus(),p=await b.peer('alice');let called=0;await p.sendInvite('bob','Bob',{onAccepted:()=>called++});
 const old=[...b.listeners.get('kelimeGames/id1')][0];await p.cancelInvite();await p.sendInvite('carol','Carol',{});const replacement=p.getSession();
 old({val:()=>invited({players:{A:'alice',B:'bob'}})});assert.equal(called,0);assert.equal(p.getSession(),replacement,'old listener cannot replace the current invitation');assert.equal(p.getSession().waiting,true);
});
await test('resume cancellation during presence write cannot reopen closed UI',async()=>{
 const b=bus(),p=await b.peer('alice'),gate=deferred();b.put('kelimeGames/r',room());let entered=false,called=0;
 b.hooks.update=async(_path,patch)=>{if(patch['presence/A']===true){entered=true;await gate.promise;}};
 const pending=p.resumeGame('r',{onResumed:()=>called++});while(!entered)await Promise.resolve();await p.leaveRoom();gate.resolve();await pending;
 assert.equal(called,0);assert.equal(p.getSession(),null);
});
await test('live rack survives new module/reload without publishing private rack',async()=>{
 const b=bus(),a=await b.peer('alice');b.put('kelimeGames/r',room());await a.resumeGame('r',{});
 const rack=[{letter:'Z',points:10,joker:false},{letter:'',points:0,joker:true}];await a.saveRack(rack);
 const next=[rack[1],{letter:'E',points:1,joker:false}];await a.pushMove({turn:'B',bagPointer:18,'racks/A':next});
 assert.equal(b.get('kelimeGames/r/racks'),null,'live rack never enters shared room');await a.leaveRoom();
 const reloaded=await b.peer('alice');let restored;await reloaded.resumeGame('r',{onResumed:d=>restored=d});assert.deepEqual(restored.room.racks.A,next);
 const foreign=await b.peer('bob');let invalid=false,error='';await foreign.resumeGame('r',{onResumed:()=>invalid=true,onError:e=>error=e});
 assert.equal(invalid,false,'progressed game must not recreate an initial rack on another device');assert.match(error,/cihaz/);
});
function fn(name){const at=uiSource.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(at>=0,name);const s=uiSource.slice(at),next=/\n(?:async )?function \w+\(/.exec(s);return next?s.slice(0,next.index):s;}
await test('actual online controller persists changed live rack on exchange and reload',async()=>{
 const b=bus();engine.setLanguage('en');const seed=91,initial=engine.buildBagSeeded(seed),board=Array.from({length:15},()=>Array(15).fill(null));
 b.put('kelimeGames/r',room({boardStr:JSON.stringify(board),scores:{A:0,B:0},passStreak:0}));
 let p=await b.peer('alice'),restored;await p.resumeGame('r',{onResumed:d=>restored=d});
 const c=vm.createContext({...engine,G:{root:{querySelector:()=>({})}},KO:p,KL_LANG:'en',klSetLang:engine.setLanguage,stopTurnTimer:noop,
  buildGameDOM:noop,renderAll:noop,renderScores:noop,setLastMove:noop,handleDrawOffer:noop,trackBest:noop,flashStatus:noop,scorePopup:noop,sndBingo:noop,confetti:noop,sndWord:noop,sndPick:noop,
  haptic:noop,updateExchangeBtn:noop,window:{},afterGame:noop,startOnlineHeartbeat:noop});
 vm.runInContext(['syncOnlineBag','startOnline','applyRemote','recallConflictingPending','performExchange','sendOnlinePatch'].map(fn).join('\n'),c);
 c.startOnline(restored.role,restored.gameId,restored.oppName,restored.seed,restored);await Promise.resolve();
 assert.deepEqual(clone(c.G.rackView),initial.slice(0,7));c.performExchange([0,1]);for(let i=0;i<6;i++)await Promise.resolve();
 const expected=clone(c.G.rackView);assert.notDeepEqual(expected,initial.slice(0,7));assert.equal(b.get('kelimeGames/r/racks'),null);
 await p.leaveRoom();p=await b.peer('alice');await p.resumeGame('r',{onResumed:d=>restored=d});assert.deepEqual(restored.room.racks.A,expected);
});
await test('last online tile ends exhausted-bag game in the same committed move',async()=>{
 let patch;const tile={letter:'A',points:1,joker:false};
 const c=vm.createContext({...engine,G:{online:true,role:'A',state:{board:Array.from({length:15},()=>Array(15).fill(null)),scores:{A:0,B:0},racks:{},bagPointer:100},bag:Array(100).fill(tile),rackView:[],pending:[{r:7,c:7,...tile}],selected:null},
  isMyTurn:()=>true,validatePlacement:()=>({ok:true,score:2,words:[],bingo:false}),applySurprises:()=>({doubleMul:1,extraPoints:0,extraTiles:0,hits:[]}),
  currentTurn:()=> 'A',commitMove:noop,trackBest:noop,trackRecords:noop,setLastMove:noop,celebrate:noop,renderAll:noop,onlineGameOver:noop,KO:{pushMove:p=>patch=p}});
 vm.runInContext(['submitMove','sendOnlinePatch','onlineOutcome'].map(fn).join('\n'),c);c.submitMove();assert.equal(patch.status,'over');assert.deepEqual(clone(patch['racks/A']),[]);assert.equal(c.G.pending.length,0);
});
engine.setLanguage('tr');console.log(`PASS ${groups} Kelime v151 online groups.`);
