// Confirmed chess regressions; real engine and UI functions, deterministic UI/transport fixtures.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/chess-engine.js';
import { chooseMove } from '../js/games/chess-ai.js';
const source=fs.readFileSync(new URL('../js/games/chess.js',import.meta.url),'utf8');
function fn(name){const begin=source.indexOf(`function ${name}(`);assert.ok(begin>=0,name);let end=source.indexOf('\nfunction ',begin+1);return source.slice(begin,end<0?source.length:end);}
const noop=()=>{};
function game(state=engine.newGame()){
 return {state,mode:'local',playerColor:'w',aiColor:'b',aiDifficulty:'easy',captured:{w:[],b:[]},undoStack:[],moveHistory:[],posHistory:[engine.positionKey(state)],lastMove:null,autoFlip:false,gameEnded:false,root:{querySelector:()=>null},clock:null};
}
function harness(session){
 const raf=[],timers=[],sent=[];
 const context=vm.createContext({G:session,...engine,chooseMove,performance:{now:()=>0},requestAnimationFrame:f=>raf.push(f),setTimeout:f=>timers.push(f),console,
 Sound:new Proxy({},{get:()=>noop}),ChessMP:{connected:true,send:m=>sent.push(m)},Resume:{clearSnapshot:noop},
 draw:noop,updateStatus:noop,updateTurn:noop,updateCaptured:noop,updatePanels:noop,updateClockDisplay:noop,addHistoryRow:noop,rebuildHistoryUI:noop,saveChessResume:noop,maybeAIMove:noop,onGameEnd:noop,onGameEndDraw:noop,moveToNotation:()=>'',stopClockTick:noop,startClockTick:noop});
 vm.runInContext(['doMove','sendMoveOnline','finishMove','applyAndContinue','undoMove','sendFullSync','applyFullSync'].map(fn).join('\n')+'\nthis.api={doMove,undoMove,finishMove,sendFullSync,applyFullSync};',context);
 return {context,raf,timers,sent,api:context.api};
}
let failures=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
test('scaled chess touch/click and drag coordinates select the visible square',()=>{
 for(const scale of [.8,.85,1,1.3])for(const flip of [false,true]){
  const rect={left:19,top:71,width:360*scale,height:360*scale};
  const G={boardPx:360,margin:20,cell:40,flip,canvas:{getBoundingClientRect:()=>rect},_drag:{pointerId:1}};
  const context=vm.createContext({G,window:{__uiScale:scale},draw:noop});
  vm.runInContext(['_canvasScale','_eventCell','xyToCell','onBoardPointerMove',...(source.includes('function _zc(')?['_zc']:[])].map(fn).join('\n')+'\nthis.pick=_eventCell;this.drag=onBoardPointerMove;',context);
  const px=20+4.5*40,py=20+6.5*40,event={clientX:rect.left+px*scale,clientY:rect.top+py*scale,pointerId:1};
  const result=context.pick(event);assert.equal(result.sq.r,flip?1:6,`row scale ${scale}`);assert.equal(result.sq.c,flip?3:4,`column scale ${scale}`);
  context.drag(event);assert.ok(Math.abs(G._drag.px-px)<1e-8);assert.ok(Math.abs(G._drag.py-py)<1e-8);
 }
});
test('capture undo restores the captured list and full position',()=>{
 let state=engine.newGame();for(const c of [{from:{r:6,c:4},to:{r:4,c:4}},{from:{r:1,c:3},to:{r:3,c:3}}])state=engine.applyMove(state,engine.resolveLegalMove(state,c));
 const session=game(state),h=harness(session),before=JSON.stringify(state);
 h.api.doMove(engine.resolveLegalMove(state,{from:{r:4,c:4},to:{r:3,c:3}}));h.raf.shift()(250);
 assert.deepEqual(Array.from(session.captured.w),['p']);h.api.undoMove();assert.deepEqual(Array.from(session.captured.w),[]);assert.equal(JSON.stringify(session.state),before);
});
test('delayed AI cannot play in a reopened/restarted or finished game',()=>{
 for(const change of ['reopen','restart','ended']){
  const state=engine.applyMove(engine.newGame(),{from:{r:6,c:4},to:{r:4,c:4},double:true}),session=game(state);session.mode='ai';const h=harness(session);let moves=0;
  h.context.finishMove=()=>moves++;vm.runInContext(fn('maybeAIMove')+'\nthis.scheduleAI=maybeAIMove;',h.context);h.context.scheduleAI();assert.equal(h.timers.length,1);
  if(change==='reopen')h.context.G={...session,state:engine.newGame()};else if(change==='restart')session.state=engine.newGame();else session.gameEnded=true;
  h.timers.shift()();assert.equal(moves,0,change);
 }
});
test('old animation cannot apply to a replaced position or reopened game',()=>{
 for(const reopen of [false,true]){
  const session=game(),h=harness(session),m=engine.resolveLegalMove(session.state,{from:{r:6,c:4},to:{r:4,c:4}});h.api.finishMove(m);
  const next=game();if(reopen)h.context.G=next;else session.state=next.state;
  h.raf.shift()(250);assert.equal((reopen?next:session).state.board[6][4]?.t,'p');assert.equal((reopen?next:session).moveHistory.length,0);
 }
});
test('full sync retains en passant, clock and ended state, redraws and never accepts guest authority',()=>{
 const host=game(engine.applyMove(engine.newGame(),{from:{r:6,c:4},to:{r:4,c:4},double:true}));host.mode='online';host.clock={w:50,b:49};host.gameEnded=true;
 const tx=harness(host);tx.api.sendFullSync();const guest=game();guest.mode='online';guest.playerColor='b';const rx=harness(guest);let renders=0;rx.context.draw=()=>renders++;
 rx.api.applyFullSync(tx.sent[0].state);assert.deepEqual(JSON.parse(JSON.stringify(guest.state.enPassant)),{r:5,c:4});assert.equal(guest.gameEnded,true);assert.equal(guest.clock.w,50);assert.equal(renders,1);
 const before=JSON.stringify(host.state);tx.api.applyFullSync({...tx.sent[0].state,turn:'b'});assert.equal(JSON.stringify(host.state),before,'host ignores fullsync from guest');
});
test('AI sees mate at search horizon instead of taking material',()=>{
 const state=engine.fromFEN('7k/r4Q2/6K1/8/8/8/8/8 w - - 0 1'),random=Math.random;
 try{Math.random=()=>.9;for(const difficulty of ['easy','medium','hard']){const move=chooseMove(state,difficulty);assert.equal(engine.gameStatus(engine.applyMove(state,move)),'checkmate',difficulty);}}finally{Math.random=random;}
});
test('AI stops in insufficient-material and fifty-move terminal positions',()=>{
 for(const fen of ['7k/8/6K1/8/8/8/8/8 w - - 0 1','7k/8/6K1/8/8/8/8/R7 w - - 100 1'])assert.equal(chooseMove(engine.fromFEN(fen),'easy'),null);
});
if(failures)process.exitCode=1;

// PeerJS transport fixture exercises actual chess-mp module, not the network.
const {ChessMP}=await import('../js/games/chess-mp.js');
const transportTimers=[],peers=[];
class Emitter {constructor(){this.handlers={};this.open=false;}on(type,fn){(this.handlers[type]??=[]).push(fn);}emit(type,...args){for(const fn of this.handlers[type]||[])fn(...args);}close(){this.open=false;this.emit('close');}send(){} }
class Peer extends Emitter {constructor(){super();peers.push(this);this.connections=[];}connect(code){this.connections.push(code);return new Emitter();}destroy(){this.destroyed=true;} }
const originalWindow=globalThis.window,originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
globalThis.window={Peer};globalThis.setTimeout=(fn)=>{transportTimers.push(fn);return transportTimers.length;};globalThis.clearTimeout=noop;
try{
 test('closed/replaced chess transport ignores old peers, data and room timeout',()=>{
  const firstEvents=[],secondEvents=[];ChessMP.createRoom((...e)=>firstEvents.push(e),'AAAAAA');const oldPeer=peers.at(-1),oldConn=new Emitter();oldPeer.emit('connection',oldConn);oldConn.open=true;oldConn.emit('open');
  ChessMP.close();ChessMP.createRoom((...e)=>secondEvents.push(e),'BBBBBB');
  const ghost=new Emitter();ghost.open=true;oldPeer.emit('connection',ghost);oldPeer.emit('open');oldPeer.emit('error',{type:'stale'});oldConn.emit('data',{type:'resign'});
  assert.equal(ghost.open,false,'late connections closed');assert.deepEqual(secondEvents,[],'old callbacks do not reach replacement');
  ChessMP.close();ChessMP.joinRoom('CCCCCC',noop);const joinPeer=peers.at(-1);joinPeer.emit('open');assert.equal(transportTimers.length>0,true);
  ChessMP.close();ChessMP.createRoom((...e)=>secondEvents.push(e),'DDDDDD');while(transportTimers.length)transportTimers.shift()();joinPeer.emit('open');assert.deepEqual(secondEvents,[],'old join timeout ignored');assert.deepEqual(peers.at(-1).connections,[],'stale open cannot connect replacement peer');
 });
 test('host reconnect is ready only when its replacement connection opens',()=>{
  ChessMP.close();const events=[];ChessMP.createRoom((...e)=>events.push(e),'EEEEEE');const first=peers.at(-1),connection=new Emitter();first.emit('connection',connection);connection.open=true;connection.emit('open');connection.close();
  assert.equal(ChessMP.reconnecting,true);const replacement=peers.at(-1),newConnection=new Emitter();replacement.emit('connection',newConnection);assert.equal(ChessMP.reconnecting,true,'incoming channel not open yet');assert.equal(events.filter(e=>e[0]==='reconnected').length,0);
  newConnection.open=true;newConnection.emit('open');assert.equal(ChessMP.reconnecting,false);assert.equal(events.filter(e=>e[0]==='reconnected').length,1);assert.equal(events.filter(e=>e[0]==='connected').length,1,'reconnect does not start another game');
 });
}finally{ChessMP.close();globalThis.window=originalWindow;globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;}
if(failures)process.exitCode=1;
