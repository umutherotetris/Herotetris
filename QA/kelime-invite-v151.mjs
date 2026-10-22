// Real invite transport/controllers with a shared memory Firebase; no live writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const ref=process.env.KELIME_V151_SOURCE_REF;
const read=p=>ref?execFileSync('git',['show',ref+':'+p],{encoding:'utf8'}):fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const online=read('js/games/kelime-online.js'),controller=read('js/games/kelime.js');
const noop=()=>{},clone=v=>v===undefined?undefined:structuredClone(v),defer=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
let moduleNo=0,failures=0;
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.stack);}}
function backend(){
 const data={},listeners=new Map(),hooks={};let id=0;
 const path=p=>typeof p==='string'?p:p.path;
 const get=p=>path(p).split('/').filter(Boolean).reduce((v,k)=>v?.[k],data)??null;
 function write(p,v){const parts=path(p).split('/').filter(Boolean);let obj=data;for(const k of parts.slice(0,-1))obj=obj[k]??={};if(v===null)delete obj[parts.at(-1)];else obj[parts.at(-1)]=clone(v);}
 const snapshot=v=>({val:()=>clone(v),exists:()=>v!==null});
 const emit=p=>{p=path(p);for(const [key,cbs]of listeners)if(p===key||p.startsWith(key+'/'))for(const cb of [...cbs])cb(snapshot(get(key)));};
 const fdb={ref:(_db,p)=>p,push:p=>({key:'id'+(++id),path:path(p)+'/id'+id}),
 set:async(p,v)=>{if(hooks.set)await hooks.set(path(p),v);write(p,v);emit(p);},
 update:async(p,patch)=>{for(const[k,v]of Object.entries(patch))write(path(p)+'/'+k,v);emit(p);},
 remove:async p=>{write(p,null);emit(p);},get:async p=>snapshot(get(p)),
 runTransaction:async(p,fn)=>{if(hooks.transaction)await hooks.transaction(path(p));const next=fn(clone(get(p)));if(next===undefined)return {committed:false,snapshot:snapshot(get(p))};write(p,next);emit(p);return {committed:true,snapshot:snapshot(next)};},
 onValue:(p,cb)=>{p=path(p);if(!listeners.has(p))listeners.set(p,new Set());listeners.get(p).add(cb);queueMicrotask(()=>{if(listeners.get(p)?.has(cb))cb(snapshot(get(p)));});return()=>listeners.get(p)?.delete(cb);},
 onDisconnect:()=>({set:async()=>{},cancel:async()=>{},remove:async()=>{}})};
 return {data,get,write,hooks,fdb,listeners};
}
async function mod(bus,uid){
 globalThis.__inviteV151={Auth:{getState:()=>({uid,displayName:uid})},fdb:bus.fdb,db:{}};
 const src=online.replace("import { Auth, db, fdb } from '../auth.js';",'const {Auth,fdb,db}=globalThis.__inviteV151;');
 const module=await import('data:text/javascript;base64,'+Buffer.from(src+'\n// '+moduleNo++).toString('base64'));delete globalThis.__inviteV151;return module;
}
await test('a real English friend invite notification joins the same room on both clients',async()=>{
 const b=backend(),A=await mod(b,'alice'),B=await mod(b,'bob');let sent,accepted,matched;
 await A.sendInvite('bob','Bob',{onSent:s=>sent=s,onAccepted:s=>accepted=s},{lang:'en'});
 const notification=Object.values(b.get('userNotifs/bob'))[0];
 assert.equal(notification.gameId,sent.gameId);assert.equal(notification.gameInviteId,sent.inviteId);assert.equal(notification.lang,'en');assert.equal(notification.inviteCode,undefined);
 assert.equal(b.get('kelimeGames/'+sent.gameId).lang,'en');
 await B.acceptInvite({id:notification.gameInviteId,gameId:notification.gameId,fromName:'alice'},{onMatched:s=>matched=s});
 assert.equal(accepted.gameId,matched.gameId);assert.equal(accepted.seed,matched.seed);assert.equal(accepted.lang,'en');assert.equal(matched.lang,'en');assert.equal(accepted.oppUid,'bob');assert.equal(matched.oppUid,'alice');
 assert.equal(A.getSession().role,'A');assert.equal(B.getSession().role,'B');assert.equal(b.get('kelimeGames/'+sent.gameId+'/status'),'active');
});
await test('a friend room cannot be claimed by an outsider or overwritten by a second guest',async()=>{
 const b=backend(),A=await mod(b,'alice'),B=await mod(b,'bob'),B2=await mod(b,'bob'),X=await mod(b,'outsider');let sent,joins=0,errors=0;
 await A.sendInvite('bob','Bob',{onSent:s=>sent=s});const inv={id:sent.inviteId,gameId:sent.gameId};
 await X.acceptInvite(inv,{onMatched:()=>joins++,onError:()=>errors++});assert.equal(joins,0);assert.equal(errors,1);
 await Promise.all([B.acceptInvite(inv,{onMatched:()=>joins++}),B2.acceptInvite(inv,{onMatched:()=>joins++})]);
 assert.equal(joins,1);assert.equal(b.get('kelimeGames/'+sent.gameId+'/players/B'),'bob');
});
await test('cancel while creating a friend room cannot revive it or send a late notification',async()=>{
 const b=backend(),A=await mod(b,'alice'),gate=defer(),entered=defer();let sent=0;
 b.hooks.set=async p=>{if(p.startsWith('kelimeGames/')){entered.resolve();await gate.promise;}};
 const pending=A.sendInvite('bob','Bob',{onSent:()=>sent++});await entered.promise;await A.cancelInvite();gate.resolve();await pending;
 assert.equal(A.getSession(),null);assert.equal(sent,0);assert.equal(Object.keys(b.get('kelimeGames')||{}).length,0);assert.equal(b.get('userNotifs/bob'),null);
});
await test('cancel during notification persistence removes the room, invite and late notification',async()=>{
 const b=backend(),A=await mod(b,'alice'),gate=defer(),entered=defer();
 b.hooks.set=async p=>{if(p.startsWith('userNotifs/')){entered.resolve();await gate.promise;}};
 const pending=A.sendInvite('bob','Bob',{});await entered.promise;await A.cancelInvite();gate.resolve();await pending;
 assert.equal(A.getSession(),null);assert.equal(Object.keys(b.get('kelimeGames')||{}).length,0);assert.equal(Object.keys(b.get('kelimeInvites/bob')||{}).length,0);assert.equal(Object.keys(b.get('userNotifs/bob')||{}).length,0);
});
await test('leaving during atomic acceptance cannot recreate a guest session',async()=>{
 const b=backend(),A=await mod(b,'alice'),B=await mod(b,'bob'),gate=defer(),entered=defer();let sent,matched=0;
 await A.sendInvite('bob','Bob',{onSent:s=>sent=s});b.hooks.transaction=async()=>{entered.resolve();await gate.promise;};
 const pending=B.acceptInvite({id:sent.inviteId,gameId:sent.gameId},{onMatched:()=>matched++});await entered.promise;await B.leaveRoom();gate.resolve();await pending;
 assert.equal(B.getSession(),null);assert.equal(matched,0);assert.equal(b.get('kelimeGames/'+sent.gameId+'/status'),'invited');assert.equal(b.get('kelimeGames/'+sent.gameId+'/players/B'),null);
});
function fn(name){const start=controller.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,name);const s=controller.slice(start),next=/\n(?:async )?function \w+\(/.exec(s);return next?s.slice(0,next.index):s;}
await test('real controller consumes host and guest contexts through native Kelime invites',async()=>{
 for(const role of ['host','guest']){
  const actions=[],element={addEventListener:noop,querySelector:()=>element};
  const c=vm.createContext({G:{root:{querySelector:()=>element}},KL_LANG:'tr',klSetLang:l=>actions.push(['lang',l]),esc:s=>s,stopInviteListen:noop,
   KO:{sendInvite:(...a)=>actions.push(['send',...a]),acceptInvite:(...a)=>actions.push(['accept',...a])}});
  vm.runInContext(['startKelimeInviteContext','doSendInvite','doAcceptInvite'].map(fn).join('\n'),c);
  const invite={id:'true-invite',gameId:'true-room',fromUid:'alice'};
  await c.startKelimeInviteContext({role,targetUid:'bob',oppNick:'Bob',lang:'en',invite});
  assert.equal(actions[0][1],'en');assert.equal(actions[1][0],role==='host'?'send':'accept');
  if(role==='host'){assert.equal(actions[1][1],'bob');assert.equal(actions[1][2],'Bob');}else assert.equal(actions[1][1].gameId,'true-room');
 }
});
await test('late HUD imports and profile loads cannot mount into a replacement round',async()=>{
 for(const phase of ['import','profile']){
  const loaded=defer(),created=defer();let creates=0,mounts=0,destroys=0,opts;
  const root={querySelector:()=>null,appendChild:()=>mounts++};
  const G={root,_setupToken:{},role:'B',names:{A:'alice',B:'bob'},state:{scores:{A:11,B:42}}};
  const c=vm.createContext({G,window:{},console,hudFixture:{load:()=>loaded.promise}});
  vm.runInContext(fn('_injectKelimeHUD').replace("import('../hud.js')",'hudFixture.load()'),c);c._injectKelimeHUD();
  if(phase==='import')G._setupToken={};
  loaded.resolve({createVsHUD:options=>{creates++;opts=options;return created.promise;}});await Promise.resolve();await Promise.resolve();
  if(phase==='import'){assert.equal(creates,0);continue;}
  assert.equal(opts.myScore(),42,'guest sees their own B score');assert.equal(opts.oppScore(),11);assert.equal(opts.oppNick,'alice');
  G._setupToken={};created.resolve({el:{},destroy:()=>destroys++});await Promise.resolve();await Promise.resolve();
  assert.equal(mounts,0);assert.equal(destroys,1);assert.equal(opts.myScore(),0,'stale HUD score callback detaches from the new round');
 }
});
if(failures)process.exitCode=1;
