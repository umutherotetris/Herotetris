import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GEMS } from '../js/games/tetris-gems.js';
const raw=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;\r?$/gm,'').replace(/^export function /gm,'function ');
const noop=()=>{}, board=()=>Array.from({length:20},()=>Array(10).fill(0));
function harness(extra={}){
 const state={board:board(),cur:{type:'T',matrix:[[1]],color:'#p',x:5,y:15},score:0,lines:0,level:1,mode:'solo',pendingGarbage:0,queue:[],canHold:false,round:{},...extra},ended=[],sent=[];
 const c=vm.createContext({console,Math,Number,window:{},localStorage:{getItem:()=>null},DEFAULT_THEME:'neon',DEFAULT_HERO:'vor',HERO_KEYS:[],HEROES:{},GEMS,POWER_CHARGE_LINES:8,Sound:new Proxy({},{get:()=>noop}),MP:{connected:true,send:m=>sent.push(m)},requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,clearTimeout:noop,performance:{now:()=>0}});
 vm.runInContext(source+`\nthis.qa={set:s=>G=s,lock,garbage:applyGarbage,aiGarbage:aiApplyGarbage,loop,receive:handleVersusMessage,clearLines,valid:d=>typeof isValidTetrisSnapshot==='function'&&isValidTetrisSnapshot(d)};`,c);
 for(const n of ['clearLines','maybeDropGem','flash','screenShake','updateHeroBar','showTspin','updateHUD','updateModeUI','drawAIBoard','drawBoard','drawSide','updateParticles','applyShake','showCombo','spawnLineParticles','flashRows','showB2B','showPerfectClear','showLevelUp','updatePowerBtn','updateVersusUI'])c[n]=noop;
 c.gameOver=()=>{state.over=true;ended.push(false);};c.endGame=win=>{state.over=true;ended.push(win);};
 c.qa.set(state);return {state,ended,sent,c,...c.qa};
}
let failures=0;
function test(label,fn){try{fn();console.log('PASS',label);}catch(e){failures++;console.error('FAIL',label,e.message);}}
test('garbage overflow ends player and AI rather than deleting occupied top cells',()=>{
 const h=harness();h.state.board[0][0]='#top';h.garbage(1);assert.deepEqual(h.ended,[false]);
 for(const rows of [1,24]){const a=harness({aiBoard:board(),oppAlive:true});a.state.aiBoard[0][0]='#top';a.aiGarbage(rows);assert.deepEqual(a.ended,[true]);assert.equal(a.state.oppAlive,false);}
 const ok=harness();ok.state.board[19][0]='#bottom';ok.garbage(2);assert.deepEqual(ok.ended,[]);assert.equal(ok.state.board.length,20);assert.equal(ok.state.board[17][0],'#bottom');
});
test('garbage top-out stops lock before another piece is spawned',()=>{
 const h=harness({versus:true,pendingGarbage:1});h.state.board[0][0]='#top';let spawned=0;
 h.c.nextFromQueue=()=>{spawned++;return {matrix:[[1]],x:4,y:0};};h.lock();assert.equal(spawned,0);assert.deepEqual(h.ended,[false]);
});
test('a completely above-board grounded piece cannot disappear',()=>{
 const h=harness();h.state.cur.y=-1;h.state.board[0][5]='#support';let spawned=0;
 h.c.nextFromQueue=()=>{spawned++;return {matrix:[[1]],x:4,y:0};};h.lock();assert.deepEqual(h.ended,[false]);assert.equal(spawned,0);
});
test('Nexus and practice clear the advertised top rows without shifting the lower stack',()=>{
 for(const kind of ['nexusShield','practiceMode']){
  const h=harness({[kind]:true});h.state.board[0][4]='#spawn';h.state.board[19][1]='#bottom';h.state.board[12][2]='#middle';
  h.c.nextFromQueue=()=>({matrix:[[1]],x:4,y:0});h.lock();
  assert.equal(h.state.board[19][1],'#bottom',kind);assert.equal(h.state.board[12][2],'#middle',kind);assert.equal(h.state.board[0][4],0,kind);assert.deepEqual(h.ended,[]);
 }
});
test('above-board overflow respects existing practice and one-use Nexus protection',()=>{
 for(const kind of ['nexusShield','practiceMode']){
  const h=harness({[kind]:true});h.state.cur.y=-1;h.state.board[0][5]='#support';h.lock();
  assert.deepEqual(h.ended,[]);assert.equal(h.state.cur.y,0);if(kind==='nexusShield')assert.equal(h.state.shieldUsed,true);
 }
});
test('AI finishing a match stops the current animation frame immediately',()=>{
 const h=harness({ai:true,last:10,elapsed:0,dropAcc:0,dropInterval:10,lockTimer:0,lockResets:0});let scheduled=0;
 h.c.aiTick=()=>{h.state.over=true;};h.c.requestAnimationFrame=()=>scheduled++;h.loop(30);assert.equal(scheduled,0);assert.equal(h.state.cur.y,15);
});
test('lock reset cap is not erased by an airborne frame',()=>{
 const h=harness({last:10,elapsed:0,dropAcc:0,dropInterval:1000,lockTimer:10,lockResets:15});h.loop(20);assert.equal(h.state.lockResets,15);
});
test('resume rejects malformed boards, pieces and nonfinite or invalid counters',()=>{
 const h=harness(),d={mode:'solo',board:board(),bag:['I','T'],queue:[{type:'O',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0}],cur:{type:'T',matrix:[[0,1,0],[1,1,1],[0,0,0]],x:3,y:0},score:10,lines:0,level:1,elapsed:100,holdType:null};
 assert.equal(h.valid(d),true,'valid historical snapshot remains usable');
 assert.equal(h.valid({...d,elapsed:100.125}),true,'real RAF elapsed time may be fractional');
 for(const patch of [{board:[[0]]},{cur:{...d.cur,matrix:[]}},{cur:{...d.cur,type:'unknown'}},{cur:{...d.cur,type:'__proto__'}},{cur:{...d.cur,x:100}},{bag:['bad']},{queue:[]},{score:Infinity},{score:-1},{elapsed:NaN},{mode:'versus'},{holdType:'bad'}])assert.equal(h.valid({...d,...patch}),false,JSON.stringify(patch));
});
test('advertised attack and resistance passives affect actual garbage totals',()=>{
 const h=harness({versus:true,garbReduce:.7,pendingGarbage:0});for(let i=0;i<10;i++)h.receive({type:'garbage',rows:1});assert.equal(h.state.pendingGarbage,7);
 const d=harness({versus:true,dmgReduce:.8,pendingGarbage:0});for(let i=0;i<10;i++)d.receive({type:'garbage',rows:1});assert.equal(d.state.pendingGarbage,8);
 const g=harness({versus:true,garbMult:2,combo:0,clearFlash:[],b2b:false,powerReady:true,tetrisCount:0,baseInterval:800,speedMult:1});for(let y=16;y<20;y++)g.state.board[y].fill('#full');g.clearLines();assert.equal(g.sent.find(m=>m.type==='garbage')?.rows,8);
});
if(failures)process.exitCode=1;
