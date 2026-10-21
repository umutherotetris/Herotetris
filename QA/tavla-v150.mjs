// Pointer cancellation and in-flight target regressions against the real controller.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const source=fs.readFileSync(process.env.TAVLA_V150_SOURCE || new URL('../js/games/tavla.js',import.meta.url),'utf8');
const noop=()=>{};
function fn(name){
 const m=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),next=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
 return next?rest.slice(0,next.index+1):rest;
}
function fixture(names){
 const state=engine.newGame();state.dice=[6,3];
 const s={state,mode:'local',online:false,rolled:true,gameEnded:false,_turnToken:{},undoStack:[],selected:null,legalForSel:[]};
 const sent=[];const c=vm.createContext({G:s,...engine,console,Sound:new Proxy({},{get:()=>noop}),
  TavlaMP:{send:m=>sent.push(m)},getPos:e=>({x:e.clientX,y:e.clientY}),hitTest:x=>x,
  updateStatus:noop,updateControls:noop,draw:noop,saveAIGame:noop,afterTurn:noop,
  clearMoveGrace:noop,onWin:noop,startBearAnim:noop,clearAIGame:noop,clearAutoRollTimer:noop,
  maybeAITurn:noop,startAutoRollTimer:noop,updateTurn:noop,openingRoll:()=>({first:'w',dice:[6,3]})});
 vm.runInContext(names.map(fn).join('\n'),c);return {s,c,sent};
}
const event=(type,x)=>({type,clientX:x,clientY:0,preventDefault:noop});
const cases=[];const test=(name,run)=>cases.push([name,run]);
test('cancelled destination tap and drag do not commit a checker',()=>{
 for(const drag of [false,true]){
  const f=fixture(['canInteract','onPointerUp','doMove']);
  const move=engine.legalMovesFrom(f.s.state,12).find(m=>m.die===3);assert.ok(move);
  f.s.legalForSel=[move];f.s.selected=12;f.s.dragging=drag;f.s.dragMoved=drag;f.s.dragPos={x:move.to,y:0};f.s.tapTarget=drag?null:move;
  const before=JSON.stringify(f.s.state);
  f.c.onPointerUp(event('pointercancel',move.to));
  assert.equal(JSON.stringify(f.s.state),before,'OS touch cancellation must not play a move');
  assert.equal(f.s.tapTarget,null);assert.equal(f.s.dragging,false);
 }
});
test('undo discards a held destination from the undone board',()=>{
 const f=fixture(['canInteract','onPointerUp','doMove','undoMove']);
 const first=engine.legalMovesFrom(f.s.state,12).find(m=>m.die===3);assert.ok(first);f.c.doMove(first);
 const stale=engine.legalMovesFrom(f.s.state,9).find(m=>m.die===6);assert.ok(stale);
 f.s.tapTarget=stale;f.s.selected=9;f.s.legalForSel=[stale];
 f.c.undoMove();const before=JSON.stringify(f.s.state);
 f.c.onPointerUp(event('pointerup',3));
 assert.equal(JSON.stringify(f.s.state),before,'releasing a second finger after undo cannot move a nonexistent checker');
 assert.ok(engine.isValidState(f.s.state));
});
test('stale combined target is rejected atomically before network or undo writes',()=>{
 const f=fixture(['doMove']);
 const first=engine.legalMovesFrom(f.s.state,12).find(m=>m.die===3);assert.ok(first);
 const stale={...first,_combo:[first,{from:8,to:2,die:6,dieIdx:0}]};
 f.s.online=true;f.s.playerColor='w';const before=JSON.stringify(f.s.state);f.c.doMove(stale);
 assert.equal(JSON.stringify(f.s.state),before,'a rejected second step must not apply its first step');assert.equal(f.sent.length,0);
 f.s.online=false;f.c.doMove(stale);assert.equal(f.s.undoStack.length,0);
});
test('new game discards a held destination even if that move is legal again',()=>{
 const f=fixture(['canInteract','onPointerUp','doMove','restart']);
 f.s.tapTarget=engine.legalMovesFrom(f.s.state,12).find(m=>m.die===3);assert.ok(f.s.tapTarget);
 f.c.restart();const before=JSON.stringify(f.s.state);f.c.onPointerUp(event('pointerup',9));
 assert.equal(JSON.stringify(f.s.state),before,'old gesture cannot become the first move of a new match');
});
test('valid two-die combined target still consumes both dice in one undo entry',()=>{
 const f=fixture(['getCombinedMoves','doMove']);
 const combo=f.c.getCombinedMoves(f.s.state,12).find(m=>m._combo);assert.ok(combo);f.c.doMove(combo);
 assert.equal(f.s.state.used.length,2);assert.equal(f.s.undoStack.length,1);assert.ok(engine.isValidState(f.s.state));
});
let failed=0;for(const [name,run]of cases){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
if(failed)process.exitCode=1;
