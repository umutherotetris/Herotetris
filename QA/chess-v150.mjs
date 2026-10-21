// Fresh v150 regressions: imported/resumed positions retain counters and history.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/chess-engine.js';
const source=fs.readFileSync(new URL('../js/games/chess.js',import.meta.url),'utf8');
function fn(name){
 const m=new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return end?rest.slice(0,end.index+1):rest;
}
const noop=()=>{};
function startHarness(snapshot){
 const elements=new Map(),rows=[],copied=[];
 const root={querySelector:s=>{
  if(!elements.has(s))elements.set(s,{style:{},getContext:()=>({}),querySelector:root.querySelector,
   addEventListener:(type,cb)=>{elements.get(s)[type]=cb;}});
  return elements.get(s);
 }};
 const c=vm.createContext({...engine,G:{root},window:{addEventListener:noop},document:{},console,
  createVsHUD:async()=>({destroy:noop}),Resume:{clearSnapshot:noop},Sound:{},
  navigator:{clipboard:{writeText:t=>{copied.push(t);return Promise.resolve();}}},setTimeout:noop,
  fitCanvas:noop,updateTurn:noop,updateCaptured:noop,updateStatus:noop,updateClockDisplay:noop,draw:noop,maybeAIMove:noop,
  setupClock:seconds=>{c.G.clock={w:seconds,b:seconds};},
  closeAll:noop,onBoardClick:noop,onBoardPointerDown:noop,onBoardPointerMove:noop,onBoardPointerUp:noop,onBoardPointerCancel:noop,
  clearHistoryUI:()=>{rows.length=0;},addHistoryRow:(notation,color)=>rows.push({notation,color})});
 vm.runInContext(fn('rebuildHistoryUI')+'\n'+fn('startGame').replace("import('../game-home.js')","Promise.resolve({mountGameHome:()=>({})})")+'\n'+fn('resumeChess')+'\nthis.resume=resumeChess;',c);
 c.resume(root,snapshot);
 return {c,rows,copied,elements};
}
let failures=0;
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
const imported='r3k2r/ppp2ppp/2n5/3pp3/8/2N5/PPP2PPP/R3K2R b KQkq - 17 47';
await test('FEN import/export retains the fullmove counter and explicit override',()=>{
 const state=engine.fromFEN(imported);assert.ok(state);assert.equal(engine.toFEN(state),imported);
 assert.equal(engine.toFEN(state,8).split(' ').at(-1),'8');
});
await test('black increments fullmove once and castling rights survive serialization',()=>{
 let state=engine.fromFEN(imported);
 state=engine.applyMove(state,engine.resolveLegalMove(state,{from:{r:0,c:4},to:{r:0,c:6}}));
 assert.equal(engine.toFEN(state).split(' ').at(-1),'48');
 assert.equal(engine.toFEN(state).split(' ')[2],'KQ');
 const restored=engine.fromFEN(engine.toFEN(state));
 assert.equal(restored.fullmove,48);assert.equal(restored.halfmove,18);
 state=engine.applyMove(restored,engine.resolveLegalMove(restored,{from:{r:7,c:4},to:{r:7,c:2}}));
 assert.equal(engine.toFEN(state).split(' ').at(-1),'48');
 assert.equal(engine.toFEN(state).split(' ')[2],'-');
});
await test('resume rebuilds visible history while retaining repetition and position data',()=>{
 const state=engine.fromFEN(imported),history=[{notation:'Nc3',color:'w'}],positions=['prior',engine.positionKey(state)];
 const h=startHarness({state,moveHistory:history,posHistory:positions,captured:{w:['p'],b:[]},lastMove:{from:{r:7,c:1},to:{r:5,c:2}},timeControl:600,clock:{w:421,b:407}});
 assert.deepEqual(h.rows,history);assert.deepEqual(Array.from(h.c.G.posHistory),positions);
 assert.equal(h.c.G.captured.w[0],'p');assert.equal(engine.toFEN(h.c.G.state),imported);
 assert.equal(h.c.G.clock.w,421);assert.equal(h.c.G.clock.b,407);assert.equal(h.c.G.timeControl,600);
});
await test('copy FEN uses the restored position counter rather than local history length',()=>{
 const h=startHarness({state:engine.fromFEN(imported),moveHistory:[{notation:'Nc3',color:'w'}]});
 h.elements.get('[data-act="copyFEN"]').click({currentTarget:{textContent:'FEN'}});
 assert.equal(h.copied[0],imported);
});
await test('legacy resume snapshots infer their original fullmove from saved history',()=>{
 const state=engine.newGame();delete state.fullmove;
 const history=Array.from({length:6},(_,i)=>({notation:i%2?'Nc6':'Nc3',color:i%2?'b':'w'}));
 const h=startHarness({state,moveHistory:history});assert.equal(engine.toFEN(h.c.G.state).split(' ').at(-1),'4');
});
await test('online reconnect preserves imported fullmove and halfmove counters',()=>{
 const sent=[],c=vm.createContext({...engine,G:{mode:'online',playerColor:'w',state:engine.fromFEN(imported),moveHistory:[]},
  ChessMP:{connected:true,send:m=>sent.push(m)},console,rebuildHistoryUI:noop,updateTurn:noop,updateCaptured:noop,updateClockDisplay:noop,draw:noop,updateStatus:noop});
 vm.runInContext(fn('sendFullSync')+'\n'+fn('applyFullSync')+'\nthis.send=sendFullSync;this.receive=applyFullSync;',c);
 c.send();c.G={mode:'online',playerColor:'b',state:engine.newGame()};c.receive(sent[0].state);
 assert.equal(engine.toFEN(c.G.state),imported);
});
await test('undo after imported black move restores fullmove and all FEN fields',()=>{
 const before=engine.fromFEN(imported),after=engine.applyMove(before,engine.resolveLegalMove(before,{from:{r:0,c:4},to:{r:0,c:6}}));
 const c=vm.createContext({G:{state:after,mode:'local',captured:{w:[],b:[]},moveHistory:[{}],posHistory:['before','after'],
  undoStack:[{state:before,captured:{w:[],b:[]},lastMove:null,historyLen:0,posLen:1}]},
  rebuildHistoryUI:noop,updateTurn:noop,updateStatus:noop,updateCaptured:noop,updateClockDisplay:noop,draw:noop});
 vm.runInContext(fn('undoMove')+'\nthis.undo=undoMove;',c);c.undo();assert.equal(engine.toFEN(c.G.state),imported);
});
if(failures)process.exitCode=1;
