// Independent Tetris invariants against the real module and real power definitions.
// Presentation, account writes and audio are deterministic boundaries only.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GEMS } from '../js/games/tetris-gems.js';
import { HEROES } from '../js/games/tetris-heroes.js';

const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;\r?$/gm,'').replace(/^export function /gm,'function ');
const noop=()=>{},empty=()=>Array.from({length:20},()=>Array(10).fill(0));
function harness(patch={}){
 const state={board:empty(),cur:{type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:17},gems:[],score:0,lines:0,level:1,combo:0,over:false,paused:false,countdown:0,round:{},clearFlash:[],powerReady:true,lockResets:0,lockTimer:0,last:100,elapsed:0,dropAcc:0,dropInterval:100,visualY:17,...patch};
 const math=Object.create(Math);math.random=()=>.999999;
 const c=vm.createContext({console,Math:math,Number,window:{},localStorage:{getItem:()=>null},DEFAULT_THEME:'neon',DEFAULT_HERO:'vor',HERO_KEYS:[],HEROES,GEMS,GEM_MAX:5,GEM_BASE_CHANCE:.12,FUSION_COUNT:3,POWER_CHARGE_LINES:8,Sound:new Proxy({},{get:()=>noop}),MP:{connected:false},requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,performance:{now:()=>0}});
 vm.runInContext(source+`\nthis.qa={set:s=>G=s,collides,pickGem,usePower,lock,loop,spawn,newBag,matrixCells,rotateCW,rotateCCW,toMatrix,aiTick};`,c);
 for(const n of ['updateModeUI','drawBoard','drawSide','updateParticles','applyShake','updateHUD','updateGemBtn','updatePowerBtn','closeGemSheet','powerFX','screenShake','spawnPowerParticles','flash','maybeDropGem','clearLines'])c[n]=noop;
 c.nextFromQueue=()=>({type:'T',color:'#next',matrix:[[0,1,0],[1,1,1],[0,0,0]],x:0,y:0});
 c.qa.set(state);return {state,c,...c.qa};
}
let failures=0;
function test(label,fn){try{fn();console.log('PASS',label);}catch(e){failures++;console.error('FAIL',label,'\n'+e.message);}}
const count=board=>board.reduce((n,row)=>n+row.filter(Boolean).length,0);
function checkTransform(label,setup,apply){
 const h=harness();setup(h.state);const before=count(h.state.board);
 assert.equal(h.collides(h.state.cur,0,0),false,'fixture starts with a valid nonoverlapping active piece');
 apply(h);
 assert.equal(h.state.over,false,label+' should have free space for the active piece');
 assert.equal(h.collides(h.state.cur,0,0),false,label+' must leave the active piece in free space');
 assert.equal(count(h.state.board),before,label+' must not delete settled cells to resolve a collision');
 h.lock();
 assert.equal(count(h.state.board),before+4,label+' future lock adds all four tetromino cells without overwriting settled ones');
}
test('actual gravity gem preserves settled cells and active-piece separation',()=>{
 checkTransform('gravity',s=>{for(const x of [4,5])for(const y of [8,10,12])s.board[y][x]='#old';},h=>{h.state.gems=[GEMS.find(g=>g.id==='gravity')];h.pickGem(0);});
});
test('actual tilt and magnet gems cannot merge the active piece with settled cells',()=>{
 checkTransform('tilt',s=>{s.cur.x=0;for(const r of [17,18])for(const col of [4,5])s.board[r][col]='#old';},h=>{h.state.gems=[GEMS.find(g=>g.id==='tilt')];h.pickGem(0);});
 checkTransform('magnet',s=>{for(const r of [17,18])for(const col of [0,1])s.board[r][col]='#old';},h=>{h.state.gems=[GEMS.find(g=>g.id==='magnet')];h.pickGem(0);});
});
test('actual Ksenon gravity power preserves the same piece invariant',()=>{
 checkTransform('Ksenon',s=>{s.hero=HEROES.ksen;for(const x of [4,5])for(const y of [8,10,12])s.board[y][x]='#old';},h=>h.usePower());
});
test('gravity catches up elapsed intervals and retains partial elapsed time',()=>{
 const long=harness();long.state.cur.y=0;long.state.visualY=0;long.loop(1100);
 assert.equal(long.state.cur.y,10,'1000 elapsed milliseconds at 100ms/cell drops ten cells');assert.equal(long.state.dropAcc,0);
 const split=harness();split.state.cur.y=0;split.state.visualY=0;
 for(let i=1;i<=10;i++)split.loop(100+i*60);
 assert.equal(split.state.cur.y,6,'ten 60ms frames accumulate six gravity steps');assert.equal(split.state.dropAcc,0);
 const remainder=harness();remainder.state.cur.y=0;remainder.loop(350);
 assert.equal(remainder.state.cur.y,2);assert.equal(remainder.state.dropAcc,50,'250ms leaves50ms toward the next gravity step');
});
test('AI gravity retains elapsed intervals and the same fractional remainder',()=>{
 const h=harness({ai:true,oppAlive:true,aiBoard:empty(),aiCur:{type:'O',color:'#ai',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0},aiPlan:{x:3,rot:0},aiMoveAcc:0,aiDropAcc:0,aiDropInterval:100,aiProfile:{moveMs:100,mult:1}});
 h.aiTick(250);assert.equal(h.state.aiCur.y,2,'250ms gives the AI two100msgravity steps');assert.equal(h.state.aiDropAcc,50);
 h.aiTick(50);assert.equal(h.state.aiCur.y,3,'the preserved50ms plus another50ms gives one more step');assert.equal(h.state.aiDropAcc,0);
});
test('ground lock waits its remaining delay and preserves time for the next piece',()=>{
 const h=harness();h.state.cur.y=18;let locks=0;
 h.c.lock=()=>{locks++;h.state.cur={...h.state.cur,y:0};};
 h.loop(599);assert.equal(locks,0);assert.equal(h.state.lockTimer,499);
 h.loop(600);assert.equal(locks,1);assert.equal(h.state.cur.y,0);assert.equal(h.state.lockTimer,0);
 h.loop(650);assert.equal(locks,1);assert.equal(h.state.cur.y,0);assert.equal(h.state.dropAcc,50);
});
test('a level-up rate change during catch-up matches splitting the frame at lock',()=>{
 function setup(){const h=harness();h.state.cur.y=18;h.c.lock=()=>{h.state.cur={...h.state.cur,y:0};h.state.dropInterval=50;};return h;}
 const long=setup();long.loop(850);
 const split=setup();split.loop(600);split.loop(850);
 assert.equal(split.state.cur.y,5);assert.equal(long.state.cur.y,split.state.cur.y,'newly spawned piece uses the new level interval in the same frame');
 assert.equal(long.state.dropAcc,split.state.dropAcc);
});
test('bounded catch-up debt drains to the same state as small elapsed frames',()=>{
 function setup(){const h=harness();let locks=0;h.state.cur.y=0;h.c.lock=()=>{locks++;h.state.cur={...h.state.cur,y:0};};return {...h,locks:()=>locks};}
 const delayed=setup(),small=setup();delayed.loop(100100);
 assert.ok(delayed.state.gravityDebt>0,'large delays are processed in bounded batches');
 let drains=0;while(delayed.state.gravityDebt>0&&drains++<100)delayed.loop(100100);
 assert.ok(drains<100,'catch-up debt eventually drains');
 for(let t=200;t<=100100;t+=100)small.loop(t);
 assert.equal(delayed.locks(),small.locks());assert.equal(delayed.state.cur.y,small.state.cur.y);
 assert.equal(delayed.state.dropAcc,small.state.dropAcc);assert.equal(delayed.state.lockTimer,small.state.lockTimer);
});
test('seven-bag distribution and four-turn rotation preserve tetromino shape',()=>{
 const h=harness({bag:[]}),types=['I','J','L','O','S','T','Z'];
 const draws=[];for(let i=0;i<700;i++)draws.push(h.spawn().type);
 for(let i=0;i<draws.length;i+=7)assert.deepEqual(draws.slice(i,i+7).sort(),types,'every bag contains each tetromino exactly once');
 const pieces={I:[[0,1],[1,1],[2,1],[3,1]],O:[[1,0],[2,0],[1,1],[2,1]],T:[[1,0],[0,1],[1,1],[2,1]],S:[[1,0],[2,0],[0,1],[1,1]],Z:[[0,0],[1,0],[1,1],[2,1]],J:[[0,0],[0,1],[1,1],[2,1]],L:[[2,0],[0,1],[1,1],[2,1]]};
 for(const [type,cells] of Object.entries(pieces)){
  const original=h.toMatrix(cells);let rotated=original;
  for(let n=0;n<4;n++){rotated=h.rotateCW(rotated);assert.equal(h.matrixCells(rotated).length,4,type+' retains four cells');}
  assert.equal(JSON.stringify(rotated),JSON.stringify(original),type+' returns to its initial matrix after four turns');
  assert.equal(JSON.stringify(h.rotateCCW(h.rotateCW(original))),JSON.stringify(original),type+' inverse rotations cancel');
 }
});
if(failures)process.exitCode=1;
