// Production Kelime RTDB module with independent client identities, listeners,
// simulated reconnects and two-party commits. No external database is contacted.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const transport=fs.readFileSync(new URL('../js/games/kelime-online.js',import.meta.url),'utf8');
const ui=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const clone=v=>v==null?v:structuredClone(v);
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),release:()=>resolve()};};
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
let imports=0,passed=0;
function bus(){
 const files=new Map(),clients=new Set(),writes=[],hooks={};let clock=1000000,id=0;
 const data={};
 const get=p=>p.split('/').reduce((v,k)=>v?.[k],data)??null;
 const set=(p,v)=>{let at=data;const parts=p.split('/');for(const k of parts.slice(0,-1))at=at[k]??={};if(v===null)delete at[parts.at(-1)];else at[parts.at(-1)]=clone(v);};
 const snap=v=>({val:()=>clone(v),exists:()=>v!=null});
 function emit(path,skip){
  for(const c of clients){if(c===skip || !c.connected || c.muted)continue;
   for(const link of [...c.listeners])if(link.path===path||path.startsWith(link.path+'/'))link.fn(snap(get(link.path)));
  }
 }
 async function open(uid,device=uid){
  const local=files.get(device)||new Map();files.set(device,local);
  const c={uid,connected:true,muted:false,listeners:new Set(),disconnects:new Map(),timers:new Set(),arms:0};
  clients.add(c);
  const fdb={
   ref:(_db,path)=>path,push:()=>({key:'r'+ ++id}),
   get:async path=>{await hooks.get?.(c,path);return snap(get(path));},
   set:async(path,v)=>{await hooks.set?.(c,path,v);if(!c.connected)throw Error('offline');writes.push([c.uid,'set',path]);set(path,v);emit(path);},
   remove:async path=>{if(!c.connected)throw Error('offline');writes.push([c.uid,'remove',path]);set(path,null);emit(path);},
   update:async(path,patch)=>{await hooks.update?.(c,path,patch);if(!c.connected)throw Error('offline');writes.push([c.uid,'update',path]);for(const[k,v]of Object.entries(patch))set(path+'/'+k,v);emit(path);},
   runTransaction:async(path,change,opts)=>{
    assert.equal(opts.applyLocally,false,'callbacks must not publish unconfirmed state');
    await hooks.before?.(c,path);
    if(!c.connected)throw Error('offline');
    const value=change(clone(get(path)));
    if(value===undefined)return {committed:false,snapshot:snap(get(path))};
    const saved=clone(value);
    writes.push([c.uid,'transaction',path]);set(path,saved);emit(path);
    await hooks.after?.(c,path,saved);
    return {committed:true,snapshot:snap(saved)};
   },
   onValue:(path,fn,error)=>{
    const link={path,fn,error};c.listeners.add(link);
    queueMicrotask(()=>{if(c.listeners.has(link))fn(snap(path==='.info/connected'?c.connected:get(path)));});
    return ()=>c.listeners.delete(link);
   },
   onDisconnect:path=>({set:async v=>{c.disconnects.set(path,v);c.arms++;},cancel:async()=>c.disconnects.delete(path)})
  };
  globalThis.__kelime157={Auth:{getState:()=>({uid:c.uid,displayName:c.uid})},db:{},fdb,
   localStorage:{getItem:k=>local.get(k)??null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},
   Date:{now:()=>clock},setInterval:fn=>{c.timers.add(fn);return fn;},clearInterval:fn=>c.timers.delete(fn)};
  const source=transport.replace("import { Auth, db, fdb } from '../auth.js';",'const {Auth,db,fdb,localStorage,Date,setInterval,clearInterval}=globalThis.__kelime157;');
  c.module=await import('data:text/javascript;base64,'+Buffer.from(source+'\n// '+imports++).toString('base64'));
  delete globalThis.__kelime157;return c;
 }
 function online(c,yes){
  c.connected=yes;
  if(!yes){for(const [path,v]of c.disconnects){set(path,v);emit(path,c);}c.disconnects.clear();}
  for(const l of c.listeners)if(l.path==='.info/connected')l.fn(snap(yes));
 }
 return {open,online,get,set,emit,writes,hooks,advance:ms=>clock+=ms,now:()=>clock};
}
const queue='kelimeQueue/waiting_tr';
const room=(extra={})=>({seed:3,status:'active',players:{A:'alice',B:'bob'},names:{A:'Alice',B:'Bob'},turn:'A',lang:'tr',bagPointer:14,passStreak:0,...extra});
const tile=(letter,points=1)=>({letter,points,joker:false});
async function test(name,fn){await fn();console.log('PASS '+name);passed++;}

await test('live wait renews past the original lease, and two peers agree on room and seed',async()=>{
 const b=bus(),a=await b.open('alice'),g=await b.open('bob');let A,B;
 await a.module.findMatch({onMatched:d=>A=d});const original=b.get(queue);
 for(let i=0;i<5;i++){b.advance(12000);for(const tick of a.timers)await tick();}
 assert.equal(b.get(queue).gameId,original.gameId);assert.equal(b.get(queue).ts,b.now());
 await g.module.findMatch({onMatched:d=>B=d});
 assert.equal(A.gameId,B.gameId);assert.equal(A.role,'A');assert.equal(B.role,'B');assert.equal(A.seed,B.seed);assert.equal(a.timers.size,0);
 await Promise.all([a.module.leaveRoom(),g.module.leaveRoom()]);
});
await test('late cancellation or disconnect cannot erase a replacement same-account queue offer',async()=>{
 const b=bus(),old=await b.open('alice','phone'),next=await b.open('alice','desktop');
 await old.module.findMatch({});const oldId=b.get(queue).gameId,gate=deferred();let entered=false;
 b.hooks.before=async(c,path)=>{if(c===old&&path===queue){entered=true;await gate.promise;}};
 const cancel=old.module.cancelSearch();while(!entered)await Promise.resolve();
 await next.module.findMatch({});const newId=b.get(queue).gameId;assert.notEqual(oldId,newId);
 gate.release();await cancel;b.online(old,false);
 assert.equal(b.get(queue).gameId,newId);assert.equal(b.get('kelimeGames/'+oldId),null);
 assert.ok(![...old.disconnects.keys(),...next.disconnects.keys()].some(p=>p===queue));
 await next.module.leaveRoom();
});
await test('async registration survives disconnect and deadline starts at pairing, not queue entry',async()=>{
 const b=bus(),a=await b.open('alice'),g=await b.open('bob');let B;
 const mode={mode:'async',turnHours:12};
 await a.module.findMatch({},mode);const wait=b.get('kelimeQueue/async12_tr');
 assert.equal(b.get('kelimeGames/'+wait.gameId+'/deadline'),null);
 b.online(a,false);b.advance(6*3600000);
 await g.module.findMatch({onMatched:d=>B=d},mode);await flush();
 assert.equal(B.gameId,wait.gameId);assert.equal(B.room.deadline,b.now()+12*3600000);
 assert.equal(b.get('kelimeGames/'+wait.gameId+'/racks'),null);
});
await test('active connection loss locks moves, then actual RTDB reconnect re-arms presence',async()=>{
 const b=bus(),a=await b.open('alice');b.set('kelimeGames/m',room());
 await a.module.resumeGame('m',{});await flush();
 const phases=[];a.module.subscribeConnection(v=>phases.push(v));
 const arms=a.arms;b.online(a,false);
 assert.equal(b.get('kelimeGames/m/presence/A'),false);
 await assert.rejects(a.module.pushMove({turn:'B'}));
 const writes=b.writes.length;await a.module.heartbeat();assert.equal(b.writes.length,writes);
 b.advance(6000);b.online(a,true);await flush();
 assert.deepEqual(phases,[true,false,true]);assert.ok(a.arms>arms);
 assert.equal(b.get('kelimeGames/m/presence/A'),true);
 assert.equal(b.get('kelimeGames/m/lastSeen/A'),b.now());
 await a.module.pushMove({turn:'B',lastMove:{who:'A',pass:true,ts:b.now()}});
 await a.module.leaveRoom();assert.equal(a.listeners.size,0);
});
await test('same-account delayed turn commit cannot overwrite another tab or publish a stale rack',async()=>{
 const b=bus(),a=await b.open('alice','tab1'),stale=await b.open('alice','tab2');
 b.set('kelimeGames/m',room());await a.module.resumeGame('m',{});await stale.module.resumeGame('m',{});
 const gate=deferred();let entered=false;
 b.hooks.before=async(c,path)=>{if(c===stale&&path==='kelimeGames/m'){entered=true;await gate.promise;}};
 const late=assert.rejects(stale.module.pushMove({turn:'B',scores:{A:4,B:0},'racks/A':[tile('Z')]}));
 while(!entered)await Promise.resolve();
 await a.module.pushMove({turn:'B',scores:{A:22,B:0},'racks/A':[tile('A')]});
 gate.release();await late;
 assert.equal(b.get('kelimeGames/m/scores/A'),22);assert.equal(b.get('kelimeGames/m/racks'),null);
 await stale.module.leaveRoom();let message;
 await stale.module.resumeGame('m',{onError:v=>message=v});
 assert.match(message,/cihaz/,'a second device cannot replace the confirmed private rack');
});
await test('unacknowledged committed exchange restores the exact rack after reconnect',async()=>{
 const b=bus(),a=await b.open('alice');b.set('kelimeGames/m',room());
 await a.module.resumeGame('m',{});await a.module.saveRack([tile('A')]);
 b.hooks.after=async(c,path)=>{if(path==='kelimeGames/m'){b.online(c,false);throw Error('ack lost');}};
 await assert.rejects(a.module.pushMove({turn:'B',bagPointer:15,'racks/A':[tile('Z',4)]}));
 assert.equal(b.get('kelimeGames/m/racks'),null);
 await a.module.leaveRoom();
 const reload=await b.open('alice');let restored;
 await reload.module.resumeGame('m',{onResumed:d=>restored=d});
 assert.deepEqual(restored.room.racks.A,[tile('Z',4)]);
 assert.equal(restored.room.turn,'B');
});
await test('late move racing peer resignation cannot change the confirmed result',async()=>{
 const b=bus(),a=await b.open('alice'),g=await b.open('bob');b.set('kelimeGames/m',room());
 await a.module.resumeGame('m',{});await g.module.resumeGame('m',{});
 const gate=deferred();let entered=false;
 b.hooks.before=async(c,path)=>{if(c===a&&path==='kelimeGames/m'){entered=true;await gate.promise;}};
 const late=assert.rejects(a.module.pushMove({turn:'B',scores:{A:12,B:0}}));
 while(!entered)await Promise.resolve();
 await g.module.pushMove({status:'over',resignedBy:'B',drawOffer:null});
 gate.release();await late;await a.module.markGameOver();
 assert.equal(b.get('kelimeGames/m/status'),'over');assert.equal(b.get('kelimeGames/m/resignedBy'),'B');
 assert.equal(b.get('kelimeGames/m/scores/A'),null);
});
await test('room snapshot and write cannot drive an account that replaced the actor',async()=>{
 const b=bus(),a=await b.open('alice');b.set('kelimeGames/m',room());await a.module.resumeGame('m',{});
 let roomCallbacks=0;a.module.subscribeRoom(()=>roomCallbacks++);await flush();const count=roomCallbacks;
 const gate=deferred();let entered=false;
 b.hooks.before=async(c,path)=>{if(c===a&&path==='kelimeGames/m'){entered=true;await gate.promise;}};
 const late=assert.rejects(a.module.pushMove({turn:'B',scores:{A:8,B:0}}));
 while(!entered)await Promise.resolve();
 a.uid='replacement';b.emit('kelimeGames/m');gate.release();await late;
 assert.equal(roomCallbacks,count);assert.equal(b.get('kelimeGames/m/turn'),'A');
 await a.module.leaveRoom();assert.equal(a.listeners.size,0);
});
function fn(name){const start=ui.search(new RegExp('^(?:async )?function '+name+'\\(','m'));assert.ok(start>=0);const tail=ui.slice(start),next=/\n(?:export )?(?:async )?function \w+\(/.exec(tail);return tail.slice(0,next?next.index:undefined);}
await test('a confirmed remote result wins over a rejected local write without a false interruption',async()=>{
 let decline,verdict,interrupted=0;
 const c=vm.createContext({G:{online:true,role:'A',_setupToken:{},pending:[],state:{board:[],scores:{A:0,B:0},turn:'A'}},
  KO:{pushMove:()=>new Promise((_r,reject)=>decline=reject)},
  onlineGameOver:(_m,_v,result)=>verdict=result,onlineInterrupted:()=>interrupted++});
 vm.runInContext(['applyRemote','sendOnlinePatch','onlineOutcome','isMyTurn'].map(fn).join('\n'),c);
 const sending=c.sendOnlinePatch({turn:'B'});
 c.applyRemote({status:'over',resignedBy:'B'},true);
 decline(Error('older room version'));await sending;
 assert.equal(verdict,'win');assert.equal(interrupted,0);
 c.G._onlineConnection=false;assert.equal(c.isMyTurn(),false);
 assert.equal(await c.sendOnlinePatch({status:'over',resignedBy:'A'}),false);
});
await test('opponent heartbeat clocks need not match, and unrelated snapshots cannot reset silence',async()=>{
 let now=9e6;
 const c=vm.createContext({G:{online:true,role:'A',_setupToken:{},pending:[],state:{board:[],scores:{A:0,B:0},turn:'A'}},
  Date:{now:()=>now},renderAll:()=>{},handleDrawOffer:()=>{}});
 vm.runInContext(fn('applyRemote'),c);
 c.applyRemote({lastSeen:{B:1000}});
 assert.equal(c.G._oppLastSeen,now,'peer phone can have a very different wall clock');
 now+=12000;c.applyRemote({lastSeen:{A:now,B:1000}});
 assert.equal(c.G._oppLastSeen,now-12000,'only a new opponent beat extends grace');
 c.applyRemote({lastSeen:{B:2000}});
 assert.equal(c.G._oppLastSeen,now);
});
console.log('PASS '+passed+' Kelime v157 network groups');
