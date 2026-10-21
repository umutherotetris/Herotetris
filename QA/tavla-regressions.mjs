// Deterministic regressions against the real UI controller functions. DOM,
// transport, animation timing and persistence are fixtures; rule logic is real.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const src=fs.readFileSync(new URL('../js/games/tavla.js',import.meta.url),'utf8');
const noop=()=>{};
function fn(name){
 const a=src.indexOf(`function ${name}(`);assert(a>=0,name);
 const next=/\n(?:export )?(?:async )?function /g;next.lastIndex=a+1;const match=next.exec(src);const b=match?.index??-1;
 return src.slice(a,b<0?src.length:b).replace(/import\([^)]*\)/g,'Promise.resolve({mountGameHome:()=>({})})');
}
function fixture(names,extra={}){
 const timers=[],frames=[],sent=[];
 const el={style:{},addEventListener:noop,getContext:()=>({})};
 el.querySelector=()=>el;
 const root={...el,remove:noop};
 const s={root,state:engine.newGame(),mode:'local',rolled:false,gameEnded:false,_turnToken:{}};
 const ctx=vm.createContext({G:s,...engine,console,THEMES:{},SELECTED_THEME:'kizil',AUTO_ROLL:false,
  window:{addEventListener:noop,Hero:null},localStorage:{getItem:()=>null,setItem:noop},
  Sound:new Proxy({},{get:()=>noop}),TavlaMP:{connected:true,send:m=>sent.push(m),__setHandler:noop},
  setTimeout:cb=>{timers.push(cb);return timers.length;},clearTimeout:noop,cancelAnimationFrame:noop,
  requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},performance:{now:()=>0},
  createVsHUD:()=>Promise.resolve({}),fitCanvas:noop,updateTurn:noop,updateStatus:noop,updateControls:noop,draw:noop,
  maybeAITurn:noop,startAutoRollTimer:noop,clearAutoRollTimer:noop,clearAIGame:noop,loadAIGame:()=>null,
  closeAll:noop,saveAIGame:noop,setupChat:noop,onPointerDown:noop,onPointerMove:noop,onPointerUp:noop,
  clearMoveGrace:noop,sendHello:noop,onWin:noop,...extra});
 vm.runInContext(names.map(fn).join('\n'),ctx);
 return {ctx,timers,frames,s,root,sent};
}
function plain(x){return JSON.parse(JSON.stringify(x));}

// Starting and resuming exercise the complete real startGame function.
{
 const f=fixture(['sameTurn','afterTurn','startGame'],{openingRoll:()=>({first:'w',dice:[6,3]})});
 f.ctx.startGame(f.root,'local');
 assert.equal(f.s.rolled,true);assert.deepEqual(plain(f.s.state.dice),[6,3]);
 assert.equal(f.s.state.turn,'w','opening winner uses the shown opening dice');
}
{
 const savedState=engine.newGame();savedState.dice=[6,3];savedState.used=[1];
 savedState.points[5]--;savedState.points[2]++;
 const saved={state:savedState,rolled:true,playerColor:'w',aiColor:'b',openingDice:[6,3]};
 const f=fixture(['sameTurn','afterTurn','startGame'],{loadAIGame:()=>saved});
 f.ctx.startGame(f.root,'ai');
 assert.equal(f.s.rolled,true,'resume cannot reroll partly used dice');
 assert.deepEqual(plain(f.s.state.dice),[6,3]);assert.deepEqual(plain(f.s.state.used),[1]);
}
{
 let rolls=0,chosen=null;
 const f=fixture(['sameTurn','afterTurn','maybeAITurn'],{rollDice:()=>{rolls++;return [4,2];},
  animateDiceRoll:cb=>cb(),chooseSequence:s=>{chosen=engine.cloneState(s);return [];}});
 f.s.mode='ai';f.s.aiColor='w';f.s.rolled=true;f.s.state.dice=[6,3];f.s.state.used=[1];
 f.ctx.maybeAITurn();f.timers.shift()();
 assert.equal(rolls,0,'AI reuses opening or resumed dice');
 assert.deepEqual(chosen.used,[1]);assert.deepEqual(chosen.dice,[6,3]);
}
console.log('PASS Tavla opening dice and saved human/AI turn preservation.');

{
 let ran=0;
 const f=fixture(['sameTurn','afterTurn']);
 f.ctx.afterTurn(()=>ran++,10);f.ctx.G=null;f.timers.shift()();assert.equal(ran,0);
 f.ctx.G=f.s;f.ctx.afterTurn(()=>ran++,10);f.ctx.G={...f.s};f.timers.shift()();assert.equal(ran,0);
 f.ctx.G=f.s;f.ctx.afterTurn(()=>ran++,10);f.s._turnToken={};f.timers.shift()();assert.equal(ran,0);
 f.ctx.afterTurn(()=>ran++,10);f.timers.shift()();assert.equal(ran,1);
}
{
 const f=fixture(['sameTurn','afterTurn','maybeAITurn','restart'],{openingRoll:()=>({first:'w',dice:[6,3]})});
 f.s.mode='ai';f.s.aiColor='b';f.s.playerColor='w';f.s.state.turn='b';
 f.ctx.maybeAITurn();
 const oldAI=f.timers.shift();f.ctx.restart();const before=JSON.stringify(f.s.state);
 oldAI();assert.equal(JSON.stringify(f.s.state),before,'AI from previous match cannot roll in restarted match');
 assert.equal(f.s.aiThinking,false);
}
{
 const f=fixture(['sameTurn','afterTurn','animateDiceRoll']);
 f.s.state.dice=[6,3];let done=0;f.ctx.animateDiceRoll(()=>done++);
 f.s._turnToken={};f.s.diceAnim=['new'];f.frames.shift()(1000);
 assert.equal(done,0);assert.deepEqual(f.s.diceAnim,['new'],'old dice frame cannot clear a new turn animation');
}
{
 const f=fixture(['sameTurn','afterTurn','endTurn','undoMove']);
 f.s.rolled=true;f.s.state.dice=[2,1];f.s.state.used=[0,1];
 const before=engine.cloneState(f.s.state);before.used=[0];
 f.s.undoStack=[{state:before}];f.ctx.afterTurn(()=>f.ctx.endTurn(),600);
 f.ctx.undoMove();f.timers.shift()();
 assert.equal(f.s.state.turn,'w');assert.deepEqual(f.s.state.used,[0],'undo invalidates pending automatic end-turn');
}
console.log('PASS Tavla closed/replaced/restarted match and undo callback isolation.');

{
 const f=fixture(['endTurn']);f.s.rolled=true;f.s.state.dice=[6,3];
 const before=JSON.stringify(f.s.state);f.ctx.endTurn();assert.equal(JSON.stringify(f.s.state),before,'cannot pass with legal moves');
 f.s.state.used=[0,1];f.ctx.endTurn();assert.equal(f.s.state.turn,'b');
 f.ctx.endTurn();assert.equal(f.s.state.turn,'b','duplicate end-turn does not flip twice');
 f.ctx.G=null;assert.doesNotThrow(()=>f.ctx.endTurn());
}
{
 const f=fixture(['onRemoteMessage']);f.s.online=true;f.s.playerColor='b';f.s.rolled=true;f.s.state.dice=[6,3];
 const before=JSON.stringify(f.s.state);
 f.ctx.onRemoteMessage('message',{type:'endturn'});assert.equal(JSON.stringify(f.s.state),before,'remote cannot skip unused legal dice');
 f.s.state.used=[0,1];f.ctx.onRemoteMessage('message',{type:'endturn'});assert.equal(f.s.state.turn,'b');
 f.ctx.onRemoteMessage('message',{type:'endturn'});assert.equal(f.s.state.turn,'b','remote duplicate cannot steal local turn');
}
{
 const f=fixture(['onRemoteMessage','canInteractRoll']);f.s.online=true;f.s.playerColor='b';f.s.isHost=false;f.s._awaitingStart=true;
 assert.equal(f.ctx.canInteractRoll(),false,'guest cannot roll before opening handshake');
 f.ctx.onRemoteMessage('message',{type:'start',openingDice:[6,3],first:'b'});assert.equal(f.s.rolled,false);
 f.ctx.onRemoteMessage('message',{type:'start',openingDice:[6,6],first:'w'});assert.equal(f.s.rolled,false);
 f.ctx.onRemoteMessage('message',{type:'start',openingDice:[6,3],first:'w'});
 assert.equal(f.s.rolled,true);assert.deepEqual(plain(f.s.state.dice),[6,3]);assert.equal(f.s._awaitingStart,false);
 f.ctx.onRemoteMessage('message',{type:'start',openingDice:[1,6],first:'b'});assert.equal(f.s.state.turn,'w','late opening message cannot reset turn');
}
{
 const f=fixture(['updateControls']);f.s.rolled=true;f.s.state.dice=[6,3];f.s.state.used=[0,1];
 f.ctx.updateControls();assert.equal(f.s.canPass,true,'completed resumed turn exposes valid pass control');
}
console.log('PASS Tavla local/remote end-turn validation and opening handshake.');

{
 const original=engine.newGame();assert.equal(engine.isValidState(original),true);
 const invalid=[
  s=>s.points.pop(),s=>s.points[0]=NaN,s=>s.points[0]=1.5,
  s=>s.bar.w=-1,s=>s.off.b=16,s=>s.points[23]++,s=>s.turn='guest',
  s=>s.dice=[3,3],s=>s.dice=[2,2,3,2],s=>s.dice=[7,1],
  s=>{s.dice=[6,3];s.used=[0,0];},s=>{s.dice=[6,3];s.used=[2];}
 ];
 for(const change of invalid){const s=engine.cloneState(original);change(s);assert.equal(engine.isValidState(s),false);}
 const doubles=engine.cloneState(original);doubles.dice=[4,4,4,4];doubles.used=[0,2];
 assert.equal(engine.isValidState(doubles),true);
}
{
 const f=fixture(['applyFullSync']);f.s.online=true;f.s.isHost=false;
 const snapshot=engine.newGame();snapshot.dice=[6,3];snapshot.used=[1];
 const old=f.s.state;
 f.ctx.applyFullSync({gameState:{...snapshot,points:[]},rolled:true});assert.equal(f.s.state,old,'malformed fullsync ignored');
 f.ctx.applyFullSync({gameState:snapshot,rolled:false});assert.equal(f.s.state,old,'inconsistent roll snapshot ignored');
 f.s.isHost=true;f.ctx.applyFullSync({gameState:snapshot,rolled:true});assert.equal(f.s.state,old,'host rejects guest fullsync');
 f.s.isHost=false;f.ctx.applyFullSync({gameState:snapshot,rolled:true,gameEnded:true});
 assert.equal(f.s.state,snapshot);assert.equal(f.s.gameEnded,true,'reconnect cannot revive ended match');
 assert.equal(f.s.rolled,true);assert.deepEqual(f.s.state.used,[1]);
}
{
 let cleared=0;
 const f=fixture(['loadAIGame'],{TAVLA_SAVE_KEY:'save',clearAIGame:()=>cleared++,
  localStorage:{getItem:()=>JSON.stringify({state:{points:[]},ts:Date.now()})}});
 assert.equal(f.ctx.loadAIGame(),null);assert.equal(cleared,1,'corrupt saved game is not sent to canvas/AI');
}
console.log('PASS Tavla saved/fullsync state validation, checker conservation and ended-state recovery.');
