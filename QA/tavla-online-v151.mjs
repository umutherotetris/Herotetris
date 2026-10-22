// Real Tavla controller/transport functions, isolated UI/Peer and deterministic clock.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const source=fs.readFileSync(new URL('../js/games/tavla.js',import.meta.url),'utf8');
const transport=fs.readFileSync(new URL('../js/games/tavla-mp.js',import.meta.url),'utf8');
const noop=()=>{};
function fn(name){
 const m=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),next=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
 return (next?rest.slice(0,next.index+1):rest).replace(/^export /,'');
}
function controller(names){
 const state=engine.newGame();state.dice=[6,3];
 const buttons=new Map();
 const root={querySelector:key=>{if(!buttons.has(key))buttons.set(key,{style:{},textContent:''});return buttons.get(key);}};
 const s={state,mode:'online',online:true,isHost:false,rolled:true,playerColor:'w',gameEnded:false,_turnToken:{},undoStack:[],root};
 const sent=[],timers=[],statuses=[],mp={connected:true,send:m=>sent.push(structuredClone(m))};
 const c=vm.createContext({G:s,...engine,TavlaMP:mp,Sound:new Proxy({},{get:()=>noop}),console,AUTO_ROLL:true,AUTO_ROLL_MS:5000,
  setTimeout:(cb,ms)=>{timers.push({cb,ms});return timers.length;},setInterval:(cb,ms)=>{timers.push({cb,ms});return timers.length;},clearTimeout:noop,clearInterval:noop,cancelAnimationFrame:noop,
  clearAutoRollTimer:noop,clearMoveGrace:noop,updateControls:noop,updateTurn:noop,updateStatus:m=>statuses.push(m),draw:noop,saveAIGame:noop,
  startAutoRollTimer:noop,endTurn:noop,afterTurn:noop,animateDiceRoll:cb=>cb(),onWin:noop,startBearAnim:noop,
 });
 vm.runInContext(names.map(fn).join('\n'),c);
 return {c,s,sent,timers,statuses,mp,buttons};
}
const tests=[];const test=(name,run)=>tests.push([name,run]);
test('disconnected and pending-sync online actions cannot mutate or send',()=>{
 for(const blocked of ['oppLeft','_syncPending','transport']){
  const f=controller(['canInteract','canInteractRoll','canPassNow','doMove','rollAndShow','endTurn','startAutoRollTimer','updateControls']);
  if(blocked==='transport')f.mp.connected=false;else f.s[blocked]=true;
  const before=JSON.stringify(f.s.state),move=engine.allLegalMoves(f.s.state)[0];
  assert.equal(f.c.canInteract(),false);f.c.doMove(move);assert.equal(JSON.stringify(f.s.state),before);assert.equal(f.sent.length,0);
  f.s.state.used=[0,1];f.s.canPass=true;assert.equal(f.c.canPassNow(),false);f.c.endTurn();assert.equal(f.s.state.turn,'w');
  f.c.updateControls();assert.equal(f.buttons.get('[data-el="passBtn"]').style.display,'none');
  f.s.state.dice=[];f.s.state.used=[];f.s.rolled=false;assert.equal(f.c.canInteractRoll(),false);f.c.rollAndShow();
  assert.equal(f.s.state.dice.length,0);f.c.startAutoRollTimer();assert.equal(f.timers.length,0);
 }
});
test('disconnect clears held gesture and reconnect stays locked until valid snapshot',()=>{
 const f=controller(['onRemoteMessage','applyFullSync','canInteract']);
 f.s.playerColor='b';f.s.tapTarget={from:12,to:9,die:3};f.s.dragging=true;f.s.dragPos={x:5,y:5};f.s.activePointerId=17;f.s.dragFrom=12;
 f.c.onRemoteMessage('disconnected');assert.equal(f.s.oppLeft,true);assert.equal(f.s._syncPending,true);assert.equal(f.s.tapTarget,null);assert.equal(f.s.dragging,false);
 assert.equal(f.s.activePointerId,null);assert.equal(f.s.dragFrom,null,'recovery cannot retain a pointer owner from the previous connection');
 f.c.onRemoteMessage('reconnected');assert.equal(f.s._syncPending,true);assert.equal(f.sent.at(-1).type,'resync_request');assert.equal(f.c.canInteract(),false);
 const invalid=engine.newGame();invalid.points[0]=0;f.c.applyFullSync({gameState:invalid,rolled:false});assert.equal(f.s._syncPending,true);
 const next=engine.newGame();next.turn='b';next.dice=[6,3];f.c.applyFullSync({gameState:next,rolled:true});
 assert.equal(f.s._syncPending,false);assert.equal(f.s.oppLeft,false);assert.equal(f.c.canInteract(),true);assert.match(f.statuses.at(-1),/pul seç/);
});
test('host sync waits for received move animation and resumes a completed turn',()=>{
 const f=controller(['sendFullSync']);f.s.isHost=true;f.s._syncPending=true;f.s.remoteMoving=true;
 f.c.sendFullSync();assert.equal(f.sent.length,0);assert.equal(f.s._syncPending,true);assert.equal(f.timers.length,1);
 f.s.remoteMoving=false;const mv=engine.allLegalMoves(f.s.state)[0];f.s.state=engine.applyMove(f.s.state,mv);f.timers.shift().cb();
 assert.equal(f.sent.length,1);assert.equal(f.sent[0].type,'fullsync');assert.deepEqual(f.sent[0].state.gameState,f.s.state);assert.equal(f.s._syncPending,false);
 let passes=0;f.c.endTurn=()=>passes++;f.s._syncPending=true;f.s.state.used=[0,1];f.c.sendFullSync();assert.equal(passes,1);
});
test('valid guest sync restores automatic roll and deferred end-turn',()=>{
 for(const completed of [false,true]){
  const f=controller(['applyFullSync']);let autos=0,passes=0;f.c.startAutoRollTimer=()=>autos++;f.c.endTurn=()=>passes++;
  f.s.playerColor='b';f.s._syncPending=true;const next=engine.newGame();next.turn='b';
  if(completed){next.dice=[6,3];next.used=[0,1];}
  f.c.applyFullSync({gameState:next,rolled:completed});assert.equal(autos,completed?0:1);assert.equal(passes,completed?1:0);
 }
});
test('failed sends keep move, roll, pass and host sync unapplied',()=>{
 const f=controller(['doMove','rollAndShow','endTurn','sendFullSync']);f.mp.send=()=>false;
 const before=JSON.stringify(f.s.state);f.c.doMove(engine.allLegalMoves(f.s.state)[0]);assert.equal(JSON.stringify(f.s.state),before);
 f.s.state.used=[0,1];const token=f.s._turnToken;f.c.endTurn();assert.equal(f.s.state.turn,'w');assert.equal(f.s._turnToken,token);
 f.s.state.dice=[];f.s.state.used=[];f.s.rolled=false;f.c.rollAndShow();assert.equal(f.s.rolled,false);assert.equal(f.s.state.dice.length,0);
 f.s.isHost=true;f.s._syncPending=true;f.c.sendFullSync();assert.equal(f.s._syncPending,true);
});
function peersFixture(){
 const peers=[],timers=new Map();let timer=0;
 class Events{handlers={};on(t,cb){(this.handlers[t]??=[]).push(cb);}emit(t,d){for(const cb of this.handlers[t]||[])cb(d);}}
 class Connection extends Events{open=false;send(){if(this.fail)throw Error('channel closed');}close(){this.open=false;this.emit('close');}establish(){this.open=true;this.emit('open');}}
 class Peer extends Events{connections=[];destroyed=false;constructor(){super();peers.push(this);}connect(){const c=new Connection();this.connections.push(c);return c;}destroy(){this.destroyed=true;}}
 const c=vm.createContext({window:{Peer},console,setTimeout:(cb,ms)=>{timers.set(++timer,{cb,ms});return timer;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(transport.replace('export const TavlaMP','const TavlaMP').replace('export default TavlaMP;','this.mp=TavlaMP;'),c);
 return {mp:c.mp,peers,timers,fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`timer ${ms}`);timers.delete(entry[0]);entry[1].cb();}};
}
test('initial signaling timeout closes transport and ignores a late open',()=>{
 const f=peersFixture(),events=[];f.mp.joinRoom('ABC234',t=>events.push(t));const p=f.peers[0];
 f.fire(12000);assert.deepEqual(events,['error']);assert.equal(p.destroyed,true);p.emit('open');assert.equal(p.connections.length,0);assert.equal(f.mp.connected,false);
});
test('reconnect signaling timeout retries and eventually terminates',()=>{
 const f=peersFixture(),events=[];f.mp.joinRoom('ABC234',t=>events.push(t));const p=f.peers[0];p.emit('open');p.connections[0].establish();p.connections[0].close();
 for(let i=0;i<6;i++){f.fire(8000);f.fire(10000);}
 assert.equal(events.filter(t=>t==='reconnect_failed').length,1);assert.equal(f.mp.reconnecting,false);assert.equal(f.mp.connected,false);assert.equal(f.timers.size,0);
});
test('send exception reports failure and starts a single owned reconnect',()=>{
 const f=peersFixture(),events=[];assert.equal(f.mp.send({type:'move'}),false);
 f.mp.joinRoom('ABC234',t=>events.push(t));const p=f.peers[0];p.emit('open');const c=p.connections[0];c.establish();
 assert.equal(f.mp.send({type:'hello'}),true);c.fail=true;assert.equal(f.mp.send({type:'move'}),false);
 assert.equal(events.filter(t=>t==='disconnected').length,1);assert.equal(f.mp.reconnecting,true);assert.equal(f.peers.length,2);
 assert.equal(f.mp.send({type:'move'}),false);assert.equal(f.peers.length,2);
});
test('Tavla open is idempotent and invitations remain valid for five minutes',()=>{
 const make=ctx=>{
  let created=0,invites=0;const data=new Map([['hero_invite_ctx',JSON.stringify(ctx)]]);
  const node={style:{},addEventListener:noop};const root={querySelector:()=>node,querySelectorAll:()=>[]};
  const c=vm.createContext({G:null,AUTO_ROLL:false,Sound:{},Date:{now:()=>1000000},document:{createElement:()=>{created++;return root;},body:{appendChild:n=>{n.isConnected=true;}}},injectCSS:noop,closeAll:noop,
    localStorage:{getItem:k=>data.get(k)||null,removeItem:k=>data.delete(k)},_startInviteTavla:()=>invites++});
  vm.runInContext(fn('openTavla'),c);return {c,data,counts:()=>({created,invites})};
 };
 const f=make({game:'tavla',code:'ABC234',role:'guest',ts:1000000-240000});f.c.openTavla();f.c.openTavla();assert.deepEqual(f.counts(),{created:1,invites:1});assert.equal(f.data.has('hero_invite_ctx'),false);
 for(const invalid of [{code:123456},{role:'bad'},{ts:1000001},{ts:700000}]){
  const f=make({game:'tavla',code:'ABC234',role:'guest',ts:999999,...invalid});f.c.openTavla();assert.equal(f.counts().invites,0);assert.equal(f.data.has('hero_invite_ctx'),false);
 }
});
let failed=0;for(const [name,run]of tests){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
if(failed)process.exitCode=1;
