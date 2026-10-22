// Search capability tests against the actual AI with independent legal/material outcomes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/chess-engine.js';
const source=(process.env.CHESS_AI_V151_SOURCE_REF
 ?execFileSync('git',['show',`${process.env.CHESS_AI_V151_SOURCE_REF}:js/games/chess-ai.js`],{encoding:'utf8'})
 :fs.readFileSync(new URL('../js/games/chess-ai.js',import.meta.url),'utf8'))
 .replace(/^import .*;\r?\n/gm,'').replace(/^export function /gm,'function ');
const c=vm.createContext({...engine,console,Math,performance});
vm.runInContext(source+`\nthis.qa={chooseMove,difficultyInfo,evaluate,
 q:typeof quiescence==='function'?(state,remaining)=>quiescence(state,-Infinity,Infinity,state.turn==='w',remaining,{nodes:0,maxNodes:100000,now:()=>0,deadline:Infinity}):null};`,c);
let failed=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,'\n'+e.message);}}
test('capture extension follows a forced recapture instead of keeping a phantom pawn',()=>{
 assert.equal(typeof c.qa.q,'function','bounded tactical extension must be available');
 const state=engine.fromFEN('3r3k/8/8/3q4/2P5/8/8/K7 w - - 0 1');
 const capture=engine.resolveLegalMove(state,{from:{r:4,c:2},to:{r:3,c:3}}),after=engine.applyMove(state,capture);
 const recapture=engine.resolveLegalMove(after,{from:{r:0,c:3},to:{r:3,c:3}}),settled=engine.applyMove(after,recapture);
 assert.equal(c.qa.q(after,4),c.qa.evaluate(settled.board),'black resolves the actual rook recapture');
 assert.ok(c.qa.q(after,4)<c.qa.evaluate(after.board),'the captured pawn is no longer counted as surviving');
});
test('check evasions, en passant and promotions are included at the search horizon',()=>{
 assert.equal(typeof c.qa.q,'function');
 const check=engine.fromFEN('7k/8/8/8/8/8/4r3/4K3 w - - 0 1');
 assert.equal(engine.inCheck(check,'w'),true);assert.equal(c.qa.q(check,0),0,'a checked king must make its legal rook capture even at the extension limit');
 const ep=engine.fromFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 assert.ok(c.qa.q(ep,2)>c.qa.evaluate(ep.board),'en passant is a tactical capture despite its empty destination');
 const promotion=engine.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1');
 assert.ok(c.qa.q(promotion,2)>700,'quiet promotions are searched');
});
test('search budgets preserve legal output, state and difficulty settings',()=>{
 const hard=c.qa.difficultyInfo('hard'),saved={...hard};
 try{
  hard.maxNodes=1;hard.timeMs=1;
  const state=engine.newGame(),before=JSON.stringify(state),move=c.qa.chooseMove(state,'hard');
  assert.ok(engine.resolveLegalMove(state,move));assert.equal(JSON.stringify(state),before);
 }finally{Object.assign(hard,saved);}
 assert.equal(c.qa.difficultyInfo('easy').depth,1);assert.equal(c.qa.difficultyInfo('medium').depth,2);assert.equal(hard.depth,3);
 assert.equal(hard.randomness,0);
});
test('representative positions retain tactical mate, legality and a bounded response',()=>{
 const fens=[engine.toFEN(engine.newGame()),'7k/r4Q2/6K1/8/8/8/8/8 w - - 0 1',
  'r3k2r/ppp2ppp/2n5/3pp3/8/2N5/PPP2PPP/R3K2R b KQkq - 17 47',
  '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1'];
 for(const fen of fens){
  const state=engine.fromFEN(fen),before=JSON.stringify(state),start=performance.now(),move=c.qa.chooseMove(state,'hard'),ms=performance.now()-start;
  assert.ok(engine.resolveLegalMove(state,move),fen);assert.equal(JSON.stringify(state),before);assert.ok(ms<1500,`response ${ms}ms`);
  if(fen.startsWith('7k/r4Q2'))assert.equal(engine.gameStatus(engine.applyMove(state,move)),'checkmate');
  console.log('  measured hard search',Math.round(ms)+'ms',fen.split(' ')[0]);
 }
 for(const fen of ['7k/8/6K1/8/8/8/8/8 w - - 0 1','7k/8/6K1/8/8/8/8/R7 w - - 100 1'])assert.equal(c.qa.chooseMove(engine.fromFEN(fen),'hard'),null);
});
if(failed)process.exitCode=1;
