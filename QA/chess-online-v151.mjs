// Actual chess controller and transport callbacks with deterministic services.
// This verifies ordering and lifecycle locally; no production room is contacted.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/chess-engine.js';
const source=fs.readFileSync(new URL('../js/games/chess.js',import.meta.url),'utf8');
function fn(name){
 const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);
 const rest=source.slice(start),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return end?rest.slice(0,end.index+1):rest;
}
const noop=()=>{};
function fixture(color='w'){
 const nodes=new Map(),timers=[],sent=[],animations=[],transport={connected:true,sendOK:true};let handler,promotion;
 const root={isConnected:true,querySelector:s=>{
  if(!nodes.has(s))nodes.set(s,{style:{},classList:{add:noop,remove:noop,toggle:noop},getContext:()=>({}),querySelector:root.querySelector,
   addEventListener:(type,cb)=>{nodes.get(s)[type]=cb;}});
  return nodes.get(s);
 }};
 const c=vm.createContext({...engine,G:{root},window:{addEventListener:noop},document:{},console,
  createVsHUD:async()=>({destroy:noop}),Resume:{clearSnapshot:noop},Sound:new Proxy({},{get:()=>noop}),
  navigator:{},setTimeout:(cb,ms)=>timers.push({cb,ms}),performance:{now:()=>0},requestAnimationFrame:cb=>animations.push(cb),
  fitCanvas:noop,updateTurn:noop,updateCaptured:noop,updateStatus:noop,updateClockDisplay:noop,draw:noop,maybeAIMove:noop,
  setupClock:noop,setupChat:noop,updatePanels:noop,sendHello:noop,onHello:noop,
  closeAll:noop,clearHistoryUI:noop,addHistoryRow:noop,rebuildHistoryUI:noop,stopClockTick:noop,startClockTick:noop,
  showPromotion:(_color,cb)=>{promotion=cb;},
  ChessMP:{get connected(){return transport.connected;},__setHandler:cb=>{handler=cb;},send:m=>{if(transport.sendOK)sent.push(m);return transport.sendOK;}}
 });
 const names=['startGame','_canPlayNow','onBoardPointerDown','onBoardPointerMove','onBoardPointerUp','onBoardPointerCancel','onBoardClick','doMove','sendMoveOnline','sendFullSync','applyFullSync','onRemoteMessage','finishMove'];
 vm.runInContext(names.map(fn).join('\n').replace("import('../game-home.js')","Promise.resolve({mountGameHome:()=>({})})")+'\nthis.api={startGame,_canPlayNow,onBoardPointerDown,onBoardPointerUp,doMove,applyFullSync,onRemoteMessage,sendFullSync};',c);
 c.api.startGame(root,'online',{playerColor:color});
 return {c,root,nodes,sent,animations,transport,timers,emit:(...a)=>handler(...a),promote:chosen=>promotion(chosen),run(ms){const i=timers.findIndex(t=>t.ms===ms);assert.ok(i>=0,`timer ${ms}`);timers.splice(i,1)[0].cb();}};
}
let failed=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
test('online input and dispatch stop immediately when channel drops',()=>{
 const h=fixture(),before=engine.toFEN(h.c.G.state);h.transport.connected=false;
 assert.equal(h.c.api._canPlayNow(),false);
 h.c.api.doMove({from:{r:6,c:4},to:{r:4,c:4}});
 assert.equal(h.animations.length,0);assert.equal(h.sent.length,0);assert.equal(engine.toFEN(h.c.G.state),before);
});
test('host stays locked until its snapshot is sent; guest stays locked until snapshot applies',()=>{
 const host=fixture(),guest=fixture('b');
 for(const h of [host,guest]){h.emit('disconnected');h.emit('reconnected');assert.equal(h.c.G.oppLeft,true);assert.equal(h.c.G.syncPending,true);}
 host.c.api.doMove({from:{r:6,c:4},to:{r:4,c:4}});assert.equal(host.animations.length,0);
 host.run(400);assert.equal(host.sent[0].type,'fullsync');assert.equal(host.c.G.oppLeft,false);
 const e4=engine.resolveLegalMove(host.c.G.state,{from:{r:6,c:4},to:{r:4,c:4}});
 host.c.api.doMove(e4);assert.equal(host.sent[1].type,'move','first new move is ordered after snapshot');
 guest.emit('message',host.sent[0]);assert.equal(guest.c.G.syncPending,false);assert.equal(guest.c.G.oppLeft,false);
 guest.emit('message',host.sent[1]);assert.equal(guest.animations.length,1,'guest accepts the ordered host move');
});
test('failed snapshot send cannot unlock the host',()=>{
 const h=fixture();h.emit('disconnected');h.emit('reconnected');h.transport.sendOK=false;h.run(400);
 assert.equal(h.c.G.oppLeft,true);assert.equal(h.c.G.syncPending,true);assert.equal(h.sent.length,0);
});
test('failed local send cannot apply a move to only one board',()=>{
 const h=fixture();h.transport.sendOK=false;const before=engine.toFEN(h.c.G.state);
 h.c.api.doMove({from:{r:6,c:4},to:{r:4,c:4}});assert.equal(h.animations.length,0);assert.equal(engine.toFEN(h.c.G.state),before);
});
test('snapshot requested while an old animation is pending waits for its committed board',()=>{
 const h=fixture();h.c.G.animating=true;h.emit('disconnected');h.emit('reconnected');h.run(400);assert.equal(h.sent.length,0);assert.equal(h.c.G.syncPending,true);
 h.c.G.state=engine.applyMove(h.c.G.state,engine.resolveLegalMove(h.c.G.state,{from:{r:6,c:4},to:{r:4,c:4}}));h.c.G.animating=false;h.run(100);
 assert.equal(h.sent[0].state.turn,'b');assert.equal(h.sent[0].state.board[4][4].t,'p');assert.equal(h.c.G.syncPending,false);
});
test('invalid reconnect snapshot cannot unlock guest or replace its board',()=>{
 const h=fixture('b'),before=engine.toFEN(h.c.G.state);h.emit('disconnected');h.emit('reconnected');
 h.c.api.applyFullSync({board:[],turn:'w'});assert.equal(h.c.G.oppLeft,true);assert.equal(engine.toFEN(h.c.G.state),before);
});
test('drag begun on another position cannot execute after undo or FEN replacement',()=>{
 const h=fixture();h.c.G.mode='local';
 h.c._eventCell=()=>({sq:{r:6,c:4},px:1,py:1});h.c.api.onBoardPointerDown({pointerId:7});
 assert.equal(h.c.G._drag.state,h.c.G.state);h.c.G._drag.moved=true;
 h.c.G.state=engine.newGame();h.c._eventCell=()=>({sq:{r:4,c:4},px:1,py:1});h.c.api.onBoardPointerUp({pointerId:7});
 assert.equal(h.animations.length,0);assert.equal(h.c.G._drag,null);
});
test('cached illegal move is revalidated before any animation or network send',()=>{
 const h=fixture();h.c.api.doMove({from:{r:6,c:4},to:{r:3,c:4},double:true});
 assert.equal(h.sent.length,0);assert.equal(h.animations.length,0);
 h.c.api.doMove({from:{r:6,c:4},to:{r:4,c:4},castle:'q'});
 assert.equal(h.sent.length,1);assert.equal(h.sent[0].move.castle,undefined,'special flags come from engine');
});
test('promotion picker opened before a disconnect cannot send a lost move',()=>{
 const h=fixture();h.c.G.state=engine.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1');
 h.c.api.doMove({from:{r:1,c:0},to:{r:0,c:0},promotion:'q'});h.emit('disconnected');h.promote('n');
 assert.equal(h.sent.length,0);assert.equal(h.animations.length,0);
});
test('duplicate move received during animation cannot replace its animation',()=>{
 const h=fixture('b'),move={type:'move',move:{from:{r:6,c:4},to:{r:4,c:4}}};
 h.c.api.onRemoteMessage(move);const animation=h.c.G.anim;h.c.api.onRemoteMessage(move);
 assert.equal(h.animations.length,1);assert.equal(h.c.G.anim,animation);
});
test('old confirmation cannot resign or draw a restarted position',()=>{
 let yes,calls=0;const c=vm.createContext({G:{state:engine.newGame(),root:{appendChild:noop}},document:{createElement:()=>({remove:noop,querySelector:s=>({addEventListener:(_t,cb)=>{if(s==='.ccf-yes')yes=cb;}})})}});
 vm.runInContext(fn('showConfirm')+'\nthis.confirm=showConfirm;',c);c.confirm('test',()=>calls++);c.G.state=engine.newGame();yes();assert.equal(calls,0);
 c.confirm('test',()=>calls++);yes();assert.equal(calls,1,'current confirmation still works');
});
test('opening chess twice does not mount a second active root',()=>{
 let mounts=0;const c=vm.createContext({G:{root:{isConnected:true}},injectCSS:()=>mounts++,document:{createElement:()=>{throw Error('duplicate root');}}});
 vm.runInContext(fn('openChess')+'\nopenChess();',c);assert.equal(mounts,0);
});
if(failed)process.exitCode=1;
