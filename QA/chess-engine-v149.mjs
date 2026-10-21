// Pure-engine checks. Reference material answers and perft values were checked
// independently with python-chess 1.11.2; that library is not a runtime dependency.
import assert from 'node:assert/strict';
import {fromFEN,newGame,allLegalMoves,applyMove,inCheck,hasMatingPotential,toFEN,gameStatus} from '../js/games/chess-engine.js';
import {chooseMove} from '../js/games/chess-ai.js';

const material=[
 ['7k/8/8/8/8/8/8/KN5q w - - 0 1',false],
 ['7k/8/8/8/8/8/8/KB5r w - - 0 1',false],
 ['7k/8/8/8/8/8/8/KB5q w - - 0 1',false],
 ['7k/8/8/8/8/8/8/KB1B3q w - - 0 1',false],
 ['7k/8/8/8/8/8/8/KN5r w - - 0 1',true],
 ['7k/8/8/8/8/8/8/KBB4q w - - 0 1',true],
 ['7k/8/8/8/8/8/8/KNN4q w - - 0 1',true],
 ['7k/8/8/8/8/8/8/KB5n w - - 0 1',true],
];
for(const [fen,expected] of material){
 const s=fromFEN(fen);assert.ok(s);
 assert.equal(hasMatingPotential(s.board,'w'),expected,fen);
 const mirror=s.board.slice().reverse().map(row=>row.slice().reverse().map(p=>p?{t:p.t,c:p.c==='w'?'b':'w'}:null));
 assert.equal(hasMatingPotential(mirror,'b'),expected,`mirrored ${fen}`);
}
console.log('PASS flag-fall material: lone minor versus opponent major pieces, same/opposite-color bishops, assisted knight mates, both colors.');

function perft(s,depth){if(!depth)return 1;let n=0;for(const m of allLegalMoves(s))n+=perft(applyMove(s,m),depth-1);return n;}
const positions=[
 ['r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',97862],
 ['8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',2812],
 ['r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',9467],
 ['rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',62379],
];
for(const [fen,nodes] of positions){const s=fromFEN(fen);assert.ok(s);assert.equal(perft(s,3),nodes,fen);}
console.log('PASS independent special-position depth-three move counts: castling, pins, en passant and promotions.');

let seed=149;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
let state=newGame();
for(let ply=0;ply<1000;ply++){
 const moves=allLegalMoves(state);
 if(!moves.length||['insufficient','fiftymove'].includes(gameStatus(state))){state=newGame();continue;}
 const saved=JSON.stringify(state),m=moves[Math.floor(random()*moves.length)],color=state.turn;
 const next=applyMove(state,m);
 assert.equal(JSON.stringify(state),saved,'search/apply cannot mutate their parent position');
 assert.equal(inCheck(next,color),false,'every generated move leaves its own king safe');
 assert.equal(next.board.flat().filter(p=>p?.t==='k').length,2,'neither king can be captured');
 assert.equal(toFEN(fromFEN(toFEN(next))),toFEN(next),'legal positions round-trip through FEN');
 if(ply%100===0){const ai=chooseMove(state,'easy');assert.ok(ai);assert.ok(moves.some(x=>JSON.stringify(x)===JSON.stringify(ai)),'AI must return a legal move');}
 state=next;
}
console.log('PASS 1,000-ply deterministic game invariants and legal AI results.');
