// Independent distance-oriented rule oracle; no engine move helpers in the oracle.
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
import { chooseSequence } from '../js/games/tavla-ai.js';

function side(state){
  const white=state.turn==='w',mine=Array(26).fill(0),enemy=Array(26).fill(0);
  for(let distance=1;distance<=24;distance++){
    const count=state.points[white?distance-1:24-distance]*(white?1:-1);
    mine[distance]=Math.max(0,count);enemy[distance]=Math.max(0,-count);
  }
  mine[25]=state.bar[state.turn];
  return {mine,enemy,off:state.off[state.turn],dice:state.dice.filter((_,i)=>!state.used.includes(i))};
}
function singleMoves(position,die){
  const {mine,enemy}=position,moves=[];
  const highest=mine[25]>0?25:mine.reduce((top,count,d)=>count?d:top,0);
  const sources=mine[25]>0?[25]:Array.from({length:24},(_,i)=>i+1).filter(d=>mine[d]>0);
  for(const from of sources){
    const target=from-die;
    if(target>0){if(enemy[target]<2)moves.push({from,to:target,die});}
    else if(highest<=6 && (from===die || from===highest))moves.push({from,to:0,die});
  }
  return moves;
}
function advance(position,move,index){
  const mine=position.mine.slice(),enemy=position.enemy.slice(),dice=position.dice.slice();
  mine[move.from]--;let off=position.off;
  if(move.to===0)off++;
  else {if(enemy[move.to]===1)enemy[move.to]=0;mine[move.to]++;}
  dice.splice(index,1);return {mine,enemy,off,dice};
}
function oracle(state){
  const complete=[];
  function walk(position,moves){
    let found=false;
    if(position.off!==15){
      const seen=new Set();
      for(let i=0;i<position.dice.length;i++){
        const die=position.dice[i];if(seen.has(die))continue;seen.add(die);
        for(const move of singleMoves(position,die)){found=true;walk(advance(position,move,i),[...moves,move]);}
      }
    }
    if(!found)complete.push(moves);
  }
  const p=side(state);walk(p,[]);
  const max=Math.max(...complete.map(m=>m.length));
  let turns=complete.filter(m=>m.length===max);
  if(max===1&&p.dice.length===2){const high=Math.max(...turns.map(m=>m[0].die));turns=turns.filter(m=>m[0].die===high);}
  const white=state.turn==='w';
  const signature=m=>[(m.from===25?'bar':white?m.from-1:24-m.from),(m.to===0?'off':white?m.to-1:24-m.to),m.die].join(':');
  return {first:[...new Set(turns.filter(t=>t.length).map(t=>signature(t[0])))].sort(),max};
}
const signature=m=>[m.from,m.to,m.die].join(':');
const signatures=m=>[...new Set(m.map(signature))].sort();
function mirrored(state){return {points:state.points.slice().reverse().map(n=>-n),bar:{w:state.bar.b,b:state.bar.w},off:{w:state.off.b,b:state.off.w},turn:state.turn==='w'?'b':'w',dice:state.dice.slice(),used:state.used.slice()};}
function count(state,color){return state.off[color]+state.bar[color]+state.points.reduce((n,p)=>n+(color==='w'?Math.max(0,p):Math.max(0,-p)),0);}
let seed=1449123;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
function fixture(){
  const s=engine.newGame();s.points.fill(0);s.turn=random()<.5?'w':'b';
  for(const color of ['w','b']){
    s.off[color]=Math.floor(random()*15);s.bar[color]=Math.min(15-s.off[color],Math.floor(random()*3));
    for(let n=s.off[color]+s.bar[color];n<15;n++){
      const available=Array.from({length:24},(_,i)=>i).filter(i=>color==='w'?s.points[i]>=0:s.points[i]<=0);
      const idx=available[Math.floor(random()*available.length)];s.points[idx]+=color==='w'?1:-1;
    }
  }
  const a=1+Math.floor(random()*6),b=1+Math.floor(random()*6);s.dice=a===b?[a,a,a,a]:[a,b];
  if(random()<.2)s.used=Array.from({length:Math.floor(random()*s.dice.length)},(_,i)=>i);
  return s;
}
const positions=[];
for(let a=1;a<=6;a++)for(let b=a;b<=6;b++){const s=engine.newGame();s.dice=a===b?[a,a,a,a]:[a,b];positions.push(s);}
for(let i=0;i<300;i++)positions.push(fixture());
let transitions=0,aiTurns=0;
for(const [i,state] of positions.entries()){
  const before=JSON.stringify(state),expected=oracle(state),moves=engine.allLegalMoves(state);
  assert.deepEqual(signatures(moves),expected.first,`oracle mismatch fixture ${i}: ${before}`);
  assert.equal(JSON.stringify(state),before,'legal generation is pure');
  const mirror=mirrored(state),flipped=engine.allLegalMoves(mirror).map(m=>({...m,from:m.from==='bar'?'bar':23-m.from,to:m.to==='off'?'off':23-m.to}));
  assert.deepEqual(signatures(flipped),signatures(moves),`mirror symmetry fixture ${i}`);
  for(const move of moves){
    const next=engine.applyMove(state,move);assert.equal(count(next,'w'),15);assert.equal(count(next,'b'),15);
    assert.equal(next.used.length,state.used.length+1);assert.equal(new Set(next.used).size,next.used.length);
    assert.equal(engine.isValidState(next),true);transitions++;
  }
  if(i<75){
    for(const difficulty of ['easy','medium','hard']){
      const previousRandom=Math.random;let chosen;
      try{Math.random=random;chosen=chooseSequence(state,difficulty);}finally{Math.random=previousRandom;}
      let next=state;
      for(const move of chosen){assert.ok(engine.resolveLegalMove(next,move),`AI ${difficulty} must play legal moves`);next=engine.applyMove(next,move);}
      assert.equal(chosen.length,expected.max,'AI must consume the maximum playable dice');
      assert.equal(engine.allLegalMoves(next).length,0,'AI returns a complete turn');aiTurns++;
    }
  }
}
console.log(`PASS independent Tavla oracle: ${positions.length} positions, ${transitions} legal transitions, mirrored bar/bear-off/dice rules and ${aiTurns} full AI turns.`);
for(const winner of ['w','b']){
  const loser=winner==='w'?'b':'w',s=engine.newGame();s.points.fill(0);s.off[winner]=15;
  s.off[loser]=1;s.points[winner==='w'?18:5]=winner==='w'?-14:14;
  assert.equal(engine.gameStatus(s),winner==='w'?'white_wins':'black_wins');assert.equal(engine.winType(s,winner),1);
  s.off[loser]=0;s.points[winner==='w'?18:5]=winner==='w'?-15:15;assert.equal(engine.winType(s,winner),2);
  s.points[winner==='w'?18:5]+=winner==='w'?1:-1;s.bar[loser]=1;assert.equal(engine.winType(s,winner),3);
  s.bar[loser]=0;s.points[winner==='w'?0:23]=winner==='w'?-1:1;assert.equal(engine.winType(s,winner),3);
}
console.log('PASS mirrored single/gammon/backgammon terminal scoring.');
for(const winner of ['w','b']){
  const state=engine.newGame(),loser=winner==='w'?'b':'w';state.points.fill(0);state.off[winner]=15;
  state.points[winner==='w'?18:5]=winner==='w'?-15:15;state.turn=loser;
  for(const dice of [[6,3],[]]){
    state.dice=dice;assert.equal(engine.isValidState(state),true);
    assert.deepEqual(engine.allLegalMoves(state),[],'no legal play after either side has borne off all checkers');
    assert.equal(engine.turnComplete(state),true,'finished game has no unfinished turn');
    assert.deepEqual(chooseSequence(state,'hard'),[],'AI cannot move in a finished game');
  }
}
console.log('PASS finished games have no legal or AI continuation regardless of stale turn/dice.');
