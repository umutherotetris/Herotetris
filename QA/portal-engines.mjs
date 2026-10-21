import assert from 'node:assert/strict';
import * as chess from '../js/games/chess-engine.js';
import * as tavla from '../js/games/tavla-engine.js';
import * as word from '../js/games/kelime-engine.js';

function perft(s,depth){if(!depth)return 1;return chess.allLegalMoves(s).reduce((n,m)=>n+perft(chess.applyMove(s,m),depth-1),0);}
const start=chess.newGame(), snapshot=JSON.stringify(start);
assert.equal(perft(start,1),20);assert.equal(perft(start,2),400);assert.equal(perft(start,3),8902);
assert.equal(JSON.stringify(start),snapshot,'move generation must not mutate a position');
const castle=chess.fromFEN('k7/8/8/8/8/8/4p3/4K2R w K - 0 1');
assert.ok(!chess.legalMoves(castle,7,4).some(m=>m.castle),'cannot castle through the empty square attacked by a pawn');
const noAttack=chess.fromFEN('k7/8/8/8/8/8/5p2/4K2R w K - 0 1');
assert.equal(chess.inCheck(noAttack,'w'),true,'pawn diagonals attack king');
const promotion=chess.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1');
assert.deepEqual(chess.legalMoves(promotion,1,0).map(m=>m.promotion),['q','r','b','n']);
assert.equal(chess.resolveLegalMove(start,{from:{r:6,c:4},to:{r:3,c:4}}),null,'reject invented remote move');
assert.equal(chess.resolveLegalMove(start,{from:{r:6,c:4},to:{r:4,c:4},castle:'k'}).castle,undefined,'derive flags locally');
const ep=chess.fromFEN('4k3/8/8/8/4P3/8/8/4K3 b - e3 0 1');
assert.equal(chess.positionKey(ep),chess.positionKey({...ep,enPassant:null}),'uncapturable en passant does not break repetition');
let mate=chess.newGame();
for(const [r,c,tr,tc] of [[6,5,5,5],[1,4,3,4],[6,6,4,6],[0,3,4,7]])mate=chess.applyMove(mate,chess.resolveLegalMove(mate,{from:{r,c},to:{r:tr,c:tc}}));
assert.equal(chess.gameStatus(mate),'checkmate');
const pinnedEp=chess.fromFEN('k3r3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
assert.ok(!chess.legalMoves(pinnedEp,3,4).some(m=>m.enPassant),'en passant cannot expose own king');
console.log('PASS chess: 8902 depth-three positions, castling/pawn attack, promotion choices, mate, repetition, en passant, remote validation.');

const empty=()=>({...tavla.newGame(),points:Array(24).fill(0),off:{w:13,b:0},dice:[6],used:[]});
let s=empty();s.points[1]=1;s.points[4]=1;
assert.equal(tavla.legalMovesFrom(s,1).length,0,'cannot bear off a nearer checker with oversized die');
assert.equal(tavla.legalMovesFrom(s,4)[0].to,'off');
s=empty();s.turn='b';s.off={w:0,b:13};s.points[22]=-1;s.points[19]=-1;
assert.equal(tavla.legalMovesFrom(s,22).length,0,'mirrored oversized bearing off');
s=empty();s.points[0]=1;s.off.w=14;s.dice=[1,6];
assert.deepEqual(tavla.allLegalMoves(s).map(m=>m.die),[6],'higher die mandatory when only one can be used');
s=empty();s.off.w=14;s.points[1]=1;s.dice=[1,2];
assert.deepEqual(tavla.allLegalMoves(s).map(m=>m.die),[1],'play both dice instead of bearing off immediately');
s=empty();s.points[6]=1;s.points[4]=-1;s.dice=[2];
const hit=tavla.resolveLegalMove(s,{from:6,to:4,die:2});assert.equal(hit.type,'hit');
const hitState=tavla.applyMove(s,{from:6,to:4,die:2});assert.equal(hitState.bar.b,1);assert.equal(hitState.points[4],1,'wire move without type still preserves hit');
let seed=23;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/2**32;};
s=tavla.newGame();
for(let turn=0;turn<160 && tavla.gameStatus(s)==='playing';turn++){
  const a=1+Math.floor(rand()*6),b=1+Math.floor(rand()*6);s={...s,dice:a===b?[a,a,a,a]:[a,b],used:[]};
  while(true){const moves=tavla.allLegalMoves(s);if(!moves.length)break;const old=JSON.stringify(s);const next=tavla.applyMove(s,moves[Math.floor(rand()*moves.length)]);assert.equal(JSON.stringify(s),old);s=next;
    for(const color of ['w','b'])assert.equal(s.points.reduce((n,p)=>n+(color==='w'?Math.max(0,p):Math.max(0,-p)),0)+s.bar[color]+s.off[color],15,'all checkers conserved');
  }
  assert.ok(tavla.turnComplete(s));s.turn=s.turn==='w'?'b':'w';
}
console.log('PASS tavla: both-dice/higher-die rules, mirrored bearing off, hit/bar conservation and 160-turn deterministic simulation.');

word.setLanguage('en');let board=word.newGame().board;
const pending=[{r:7,c:7,letter:'A',points:1,joker:false},{r:7,c:8,letter:'T',points:1,joker:false}];
assert.equal(word.validatePlacement(board,pending).ok,false,'dictionary loading cannot bypass validation');
await word.loadEnglishDict();assert.equal(word.validatePlacement(board,pending).score,4,'center doubles first word');
assert.equal(word.validatePlacement(board,[{...pending[0],r:99}]).ok,false,'out-of-bounds returns error');
assert.equal(word.previewPlacement(board,[{...pending[0],r:-1}]).valid,false,'malformed preview stays safe');
assert.equal(word.validatePlacement(board,[pending[0],pending[0]]).ok,false,'duplicate tiles rejected');
assert.equal(word.validatePlacement(board,[{...pending[0],points:999},pending[1]]).ok,false,'tile score cannot be invented');
assert.equal(word.validatePlacement(board,[{...pending[0],joker:true,assigned:'A',points:0},pending[1]]).score,2,'joker has zero points');
assert.deepEqual(word.buildBagSeeded(123),word.buildBagSeeded(123),'online bags are deterministic');
assert.equal(word.buildBagSeeded(123).length,100);word.setLanguage('tr');
assert.equal(word.validatePlacement(word.newGame().board,[{r:7,c:7,letter:'E',points:1},{r:7,c:8,letter:'V',points:7}]).ok,true,'Turkish dictionary active');
console.log('PASS Kelimecik: TR/EN dictionaries, loading failure, bounds, duplicate/invalid tiles, joker and center scores, seeded bag.');
