// Race strategy quality against actual legal full turns; no extra search in AI.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const source=fs.readFileSync(process.env.TAVLA_AI_V151_SOURCE || new URL('../js/games/tavla-ai.js',import.meta.url),'utf8')
 .replace("'./tavla-engine.js'",JSON.stringify(new URL('../js/games/tavla-engine.js',import.meta.url).href));
const {chooseSequence}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const play=(s,seq)=>seq.reduce((s,m)=>{assert.ok(engine.resolveLegalMove(s,m),'every selected step is legal');return engine.applyMove(s,m);},s);
function race(color){
 const s=engine.newGame();s.points=[1,1,0,1,2,1,...Array(17).fill(0),-15];s.off.w=9;s.dice=[4,3];
 if(color==='b'){s.points=s.points.slice().reverse().map(n=>-n);s.off={w:0,b:9};s.turn='b';}
 return s;
}
// Objective independent of the AI heuristic: optimal number borne off next turn,
// weighted over all36 equally probable dice outcomes using actual legal moves.
function bestOff(s,color){
 const legal=engine.allLegalMoves(s);if(!legal.length)return s.off[color];
 return Math.max(...legal.map(m=>bestOff(engine.applyMove(s,m),color)));
}
function expectedNextOff(s,color){
 let total=0;
 for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){
  const next=engine.cloneState(s);next.dice=a===b?[a,a,a,a]:[a,b];next.used=[];
  total+=bestOff(next,color)*(a===b?1:2);
 }
 return total/36;
}
let failures=0;function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
for(const color of ['w','b'])test('race '+color+' bears off an extra checker without losing pip distance',()=>{
 const initial=race(color),seq=chooseSequence(initial,'hard'),end=play(initial,seq);
 assert.equal(end.off[color],10,'prefer a real extra bear-off over safe points after contact ends');
 assert.equal(engine.pipCount(end,color),16,'the stronger race move retains the same pip progress');
 assert.ok(engine.turnComplete(end));assert.ok(engine.isValidState(end));
 assert.ok(expectedNextOff(end,color)>=11.8,'next-turn optimal expected off count is at least11.8 (v150 chose10.5833)');
});
test('terminal winning turns keep absolute priority for both colors',()=>{
 for(const color of ['w','b']){
  const s=race(color);s.points=Array(24).fill(0);
  if(color==='w'){s.points[0]=1;s.points[2]=1;s.points[23]=-15;s.off={w:13,b:0};}
  else{s.points[23]=-1;s.points[21]=-1;s.points[0]=15;s.off={w:0,b:13};}
  s.dice=[3,1];const result=play(s,chooseSequence(s,'hard'));
  assert.equal(result.off[color],15);assert.equal(engine.gameStatus(result),color==='w'?'white_wins':'black_wins');
 }
});
test('phase-aware AI still selects complete legal turns and conserves all checkers',()=>{
 let s=engine.newGame(),seed=151;const next=()=>{seed=(seed*1664525+1013904223)>>>0;return 1+seed%6;};
 const started=performance.now();
 for(let turn=0;turn<30;turn++){
  const a=next(),b=next();s.dice=a===b?[a,a,a,a]:[a,b];s.used=[];
  s=play(s,chooseSequence(s,'hard'));assert.ok(engine.turnComplete(s));assert.ok(engine.isValidState(s));
  if(engine.gameStatus(s)!=='playing')s=engine.newGame();else s.turn=s.turn==='w'?'b':'w';
 }
 console.log('INFO thirty complete hard-AI turns',Math.round(performance.now()-started)+'ms');
});
if(failures)process.exitCode=1;
