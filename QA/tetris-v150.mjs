// Real Tetris controller regressions; DOM rendering and account boundaries are inert.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GEMS } from '../js/games/tetris-gems.js';
import { HEROES } from '../js/games/tetris-heroes.js';

const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;\r?$/gm,'').replace(/^export function /gm,'function ');
const noop=()=>{};
function element(){
  const classes=new Set(),children=new Map();
  return {
    innerHTML:'',style:{setProperty:noop},
    classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>{if(on===undefined)on=!classes.has(c);if(on)classes.add(c);else classes.delete(c);},contains:c=>classes.has(c)},
    addEventListener:noop,appendChild:noop,
    querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);}
  };
}
function harness(patch={}){
  const root=element(),sheet=root.querySelector('.gem-sheet'),pause=root.querySelector('.tetris-pause');
  const state={root,el:{gemSheet:sheet},board:Array.from({length:20},()=>Array(10).fill(0)),
    cur:{type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0},
    gems:[GEMS.find(g=>g.id==='double')],score:0,level:1,lines:0,combo:0,
    over:false,paused:false,countdown:0,countdownAcc:0,last:100,elapsed:0,
    dropAcc:0,dropInterval:100,lockTimer:0,lockResets:0,round:{},...patch};
  let now=100;
  const context=vm.createContext({console,window:{},document:{createElement:element},
    localStorage:{getItem:()=>null},DEFAULT_THEME:'neon',DEFAULT_HERO:'vor',HERO_KEYS:[],HEROES,GEMS,
    GEM_MAX:5,GEM_BASE_CHANCE:.12,FUSION_COUNT:3,POWER_CHARGE_LINES:8,
    Sound:new Proxy({},{get:()=>noop}),MP:{connected:false},performance:{now:()=>now},
    requestAnimationFrame:noop,cancelAnimationFrame:noop,setTimeout:noop,clearTimeout:noop});
  vm.runInContext(source+'\nthis.qa={set:s=>G=s,openGemSheet,closeGemSheet,togglePause,pickGem,loop};',context);
  for(const name of ['updateModeUI','drawBoard','drawSide','drawAIBoard','updateParticles','applyShake','updateHUD','updateVersusUI','updateGemBtn','updatePowerBtn','powerFX','screenShake','spawnPowerParticles','flash','showCountdownText'])context[name]=noop;
  context.qa.set(state);
  return {state,context,sheet,pause,setNow:value=>now=value,...context.qa};
}
let failed=0;
function test(label,run){try{run();console.log('PASS',label);}catch(error){failed++;console.error('FAIL',label,'\n'+error.message);}}

test('closing a gem sheet preserves a pre-existing manual pause',()=>{
  const h=harness();h.togglePause(true);h.openGemSheet();
  if(h.sheet.classList.contains('show'))h.closeGemSheet();
  assert.equal(h.state.paused,true,'opening/closing inventory must not resume a manually paused round');
  assert.equal(h.pause.classList.contains('show'),true);
  h.loop(1000);h.loop(1100);
  assert.equal(h.state.cur.y,0,'the piece must remain stationary behind the pause overlay');
  assert.equal(h.state.elapsed,0);
});

test('closing a gem sheet opened during play resumes without a time jump',()=>{
  const h=harness();h.openGemSheet();
  assert.equal(h.state.paused,true);assert.equal(h.sheet.classList.contains('show'),true);
  h.loop(10000);h.closeGemSheet();
  assert.equal(h.sheet.classList.contains('show'),false);assert.equal(h.state.paused,false);
  h.loop(20000);assert.equal(h.state.elapsed,0,'time spent choosing a gem is not active play time');
  h.loop(20100);assert.equal(h.state.cur.y,1);assert.equal(h.state.elapsed,100);
});

test('the pause hotkey cannot run the game under an open gem sheet',()=>{
  const h=harness();h.openGemSheet();h.togglePause(!h.state.paused);
  assert.ok(!h.sheet.classList.contains('show')||h.state.paused,'a visible inventory must hold the game paused');
  if(h.sheet.classList.contains('show')){
    h.loop(1000);h.loop(1100);assert.equal(h.state.cur.y,0);assert.equal(h.state.elapsed,0);
  }else assert.equal(h.pause.classList.contains('show'),h.state.paused,'pause overlay and simulation state must agree');
});

test('an online result arriving with inventory open makes later gem clicks inert',()=>{
  const h=harness({versus:true});h.openGemSheet();h.state.over=true;
  const before={score:h.state.score,board:JSON.stringify(h.state.board),gems:h.state.gems.map(g=>g.id),used:h.state.gemsUsedCount};
  h.pickGem(0);
  assert.equal(h.state.score,before.score,'a finished score is immutable');
  assert.equal(JSON.stringify(h.state.board),before.board);
  assert.deepEqual(h.state.gems.map(g=>g.id),before.gems,'a finished round cannot consume inventory');
  assert.equal(h.state.gemsUsedCount,before.used);
});

test('countdown consumes every elapsed step and retains its fractional remainder',()=>{
  const h=harness({countdown:3});h.loop(1800);
  assert.equal(h.state.countdown,1,'1700ms spans two 800ms steps');
  assert.equal(h.state.countdownAcc,100,'the extra 100ms counts toward the next step');
  h.loop(2500);assert.equal(h.state.countdown,0,'the preserved 100ms plus 700ms finishes the countdown');
  assert.equal(h.state.elapsed,0);assert.equal(h.state.cur.y,0);
  const delayed=harness({countdown:3});delayed.loop(2500);
  assert.equal(delayed.state.countdown,0,'one delayed frame can finish all three steps');
});

test('the actual time gem retains slowed gravity progress before its expiry',()=>{
  const h=harness({gems:[GEMS.find(g=>g.id==='time')]});h.openGemSheet();h.pickGem(0);
  assert.equal(h.state.slowRemainingMs,10000);
  h.loop(100);h.loop(400);
  assert.equal(h.state.cur.y,0,'300ms is shorter than a slowed 400ms gravity interval');
  assert.equal(h.state.dropAcc,300,'a zero-time normal-rate pass must not consume slowed progress');
  assert.equal(h.state.slowRemainingMs,9700);
  h.loop(500);assert.equal(h.state.cur.y,1);assert.equal(h.state.dropAcc,0);
  assert.equal(h.state.slowRemainingMs,9600);
});

test('manual and inventory pauses preserve the actual time gem duration',()=>{
  const h=harness({gems:[GEMS.find(g=>g.id==='time'),GEMS.find(g=>g.id==='double')]});
  h.openGemSheet();h.pickGem(0);h.loop(100);h.loop(400);
  h.togglePause(true);h.loop(100000);h.togglePause(false);h.loop(200000);
  assert.equal(h.state.slowRemainingMs,9700,'manual pause consumes no gameplay duration');
  h.openGemSheet();h.loop(300000);h.closeGemSheet();h.loop(400000);
  assert.equal(h.state.slowRemainingMs,9700,'inventory selection consumes no gameplay duration');
  h.loop(400100);assert.equal(h.state.slowRemainingMs,9600);assert.equal(h.state.cur.y,1);
});

test('AI and player terminal events keep chronological order across delayed frames',()=>{
  function setup(playerLockTimer=490,aiDropAcc=0){
    const piece=y=>({type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y});
    const h=harness({cur:piece(18),bag:[],queue:[piece(0)],previewCount:1,gems:[],lockTimer:playerLockTimer,
      ai:true,versus:true,oppAlive:true,aiBoard:Array.from({length:20},()=>Array(10).fill(0)),
      aiCur:piece(18),aiBag:['O'],aiPlan:{x:3,rot:0},aiMoveAcc:0,aiDropAcc,
      aiDropInterval:100,aiProfile:{moveMs:100,mult:1},oppLines:0,oppScore:0,
      pendingGarbage:0,aiPendingGarbage:0});
    h.state.board[0][4]='#player-spawn-block';h.state.aiBoard[0][4]='#ai-spawn-block';
    h.context.maybeDropGem=noop;
    h.context.endGame=won=>{h.state.over=true;h.state.result=won;};
    return h;
  }
  for(const [timer,aiAcc,expected] of [[490,0,false],[499,91,false],[491,90,false],[491,99,true]]){
    for(const partition of [1,5,10,100]){
      const h=setup(timer,aiAcc);
      for(let ts=100+partition;ts<=200&&!h.state.over;ts+=partition)h.loop(ts);
      assert.equal(h.state.result,expected,`player lock in${500-timer}ms, AI lock in${100-aiAcc}ms, frame partition${partition}ms`);
      assert.equal(h.state.elapsed,Math.min(500-timer,100-aiAcc),'the clock stops at the first terminal event within the frame');
    }
  }
});

test('actual Sprint completion records exact lock time and keeps its time bonus across delayed frames',()=>{
  for(const partition of [1,10,100,1000]){
    const h=harness({mode:'sprint',lines:38,level:4,baseInterval:800,speedMult:1,powerReady:true,
      cur:{type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:18},
      gems:[],lockTimer:490});
    for(const y of [18,19])for(let x=0;x<10;x++)if(x!==4&&x!==5)h.state.board[y][x]='#settled';
    for(const name of ['spawnLineParticles','flashRows','showPerfectClear','showLevelUp'])h.context[name]=noop;
    h.context.Auth={getState:()=>({uid:'tetris-sprint-qa'})};
    h.context.Resume={clearSnapshot:noop};h.context.Stats={recordGame:()=>[]};
    // Keep the real endGame bonus calculation; stop at its first external account write.
    h.context.Store={addScore:()=>new Promise(()=>{})};
    for(let ts=100+partition;ts<=1100&&!h.state.over;ts+=partition)h.loop(ts);
    assert.equal(h.state.over,true);assert.equal(h.state.won,true);assert.equal(h.state.lines,40);
    assert.equal(h.state.elapsed,10,`Sprint locks after10ms even with${partition}ms rendering frames`);
    assert.equal(h.state.score,18200,'two lines at level4 + perfect clear + full5000 early finish bonus');
  }
});

test('Survival changes speed exactly at30s and60s without applying future speed to earlier time',()=>{
  for(const [elapsed,survStep,baseInterval] of [[29900,0,800],[59900,1,710]]){
    const h=harness({mode:'survival',elapsed,survStep,baseInterval,dropInterval:baseInterval,
      dropAcc:baseInterval-100,speedMult:1,gems:[]});
    h.loop(199);
    assert.equal(h.state.elapsed,elapsed+99);assert.equal(h.state.cur.y,0);
    assert.equal(h.state.survStep,survStep);assert.equal(h.state.dropInterval,baseInterval);
    h.loop(200);
    assert.equal(h.state.elapsed,elapsed+100);assert.equal(h.state.cur.y,1,'the final old-rate millisecond completes the gravity interval');
    assert.equal(h.state.dropAcc,0);assert.equal(h.state.survStep,survStep+1);
    assert.equal(h.state.baseInterval,baseInterval-90);assert.equal(h.state.dropInterval,baseInterval-90);
  }
});

test('real Survival locks and gravity match one long frame against37ms frames across both speed boundaries',()=>{
  function setup(){
    const piece=()=>({type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0});
    const h=harness({mode:'survival',elapsed:29900,survStep:0,baseInterval:800,dropInterval:800,
      dropAcc:700,speedMult:1,cur:piece(),bag:Array(100).fill('O'),queue:[piece(),piece()],
      previewCount:1,gems:[],powerReady:true});
    h.context.maybeDropGem=noop;return h;
  }
  const delayed=setup(),split=setup();delayed.loop(30500);
  for(let ts=100;ts<30500;){ts=Math.min(30500,ts+37);split.loop(ts);}
  assert.equal(delayed.state.over,false);assert.equal(split.state.over,false);
  assert.equal(delayed.state.elapsed,60300);assert.equal(delayed.state.survStep,2);
  assert.equal(delayed.state.baseInterval,620);assert.equal(delayed.state.dropInterval,620);
  for(const key of ['elapsed','survStep','baseInterval','dropInterval','dropAcc','lockTimer','lockResets','lines','score'])
    assert.equal(delayed.state[key],split.state[key],key+' is independent of frame partition');
  for(const key of ['board','cur','queue','bag'])
    assert.equal(JSON.stringify(delayed.state[key]),JSON.stringify(split.state[key]),key+' is independent of frame partition');
});

if(failed)process.exitCode=1;
