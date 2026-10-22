// A slow-device search cutoff must not discard an available mate in one.
import assert from 'node:assert/strict';
import {chooseMove,difficultyInfo} from '../js/games/chess-ai.js';
import {fromFEN,toFEN,applyMove,gameStatus,resolveLegalMove,newGame} from '../js/games/chess-engine.js';
const settings=difficultyInfo('hard'),saved={...settings};
try{
 settings.maxNodes=1;settings.timeMs=0;
 for(const fen of ['7k/r4Q2/6K1/8/8/8/8/8 w - - 0 1','8/8/8/8/8/6k1/R4q2/7K b - - 0 1']){
  const state=fromFEN(fen),before=toFEN(state),move=chooseMove(state,'hard');
  assert.ok(resolveLegalMove(state,move));assert.equal(gameStatus(applyMove(state,move)),'checkmate');assert.equal(toFEN(state),before);
 }
 const state=newGame(),move=chooseMove(state,'hard');assert.ok(resolveLegalMove(state,move));
 console.log('PASS immediate mate for both colors survives an exhausted search budget; non-mating fallback stays legal and state is unchanged');
}finally{Object.assign(settings,saved);}
