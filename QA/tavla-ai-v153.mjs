// Low difficulty randomness must not discard a legal immediate win.
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
import {chooseSequence} from '../js/games/tavla-ai.js';

const originalRandom = Math.random;
try{
  for(const color of ['w','b']) for(const difficulty of ['easy','medium','hard']){
    for(const random of [0,.01,.07,.29,.9]){
      const state = engine.newGame();
      state.points.fill(0);state.points[0]=1;state.points[2]=1;state.points[23]=-15;
      state.off.w=13;state.dice=[3,1];
      if(color==='b'){
        state.points=state.points.slice().reverse().map(n=>-n);
        state.off={w:0,b:13};state.turn='b';
      }
      const before = JSON.stringify(state);
      Math.random=()=>random;
      const sequence=chooseSequence(state,difficulty);
      let end=state;
      for(const move of sequence){
        assert.ok(engine.resolveLegalMove(end,move));end=engine.applyMove(end,move);
      }
      assert.equal(end.off[color],15,`${color}/${difficulty}/${random} takes the available win`);
      assert.equal(engine.gameStatus(end),color==='w'?'white_wins':'black_wins');
      assert.ok(engine.isValidState(end));assert.equal(JSON.stringify(state),before);
    }
  }
  console.log('PASS Tavla immediate wins survive easy/medium/hard randomness for both colors; legal turns conserve state/checkers.');
}finally{Math.random=originalRandom;}
