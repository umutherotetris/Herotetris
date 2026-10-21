// Additional v148 regressions: actual Tavla controller/AI functions, deterministic
// account, UI and clock fixtures. No production account or network is contacted.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const source=fs.readFileSync(process.env.TAVLA_V148_SOURCE || new URL('../js/games/tavla.js',import.meta.url),'utf8');
const aiSource=fs.readFileSync(process.env.TAVLA_V148_AI_SOURCE || new URL('../js/games/tavla-ai.js',import.meta.url),'utf8');
const noop=()=>{};
function fn(name,src=source){
 const m=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(src);assert.ok(m,name);
 const rest=src.slice(m.index);const end=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
 return (end?rest.slice(0,end.index+1):rest).replace(/export /g,'').replace("import('../reward.js')",'Promise.resolve(rewardFixture)');
}
function fixture(names,extra={}){
 const s={state:engine.newGame(),_turnToken:{},gameEnded:false,mode:'online',online:true,playerColor:'w',rolled:true,undoStack:[],root:{querySelector:()=>({textContent:'',style:{}})}};
 const timers=[],sent=[];const c=vm.createContext({G:s,...engine,Auth:{getState:()=>({uid:'old-player'})},Store:{addKaju:async()=>{},addXP:async()=>{},recordMatchResult:async()=>{}},rewardFixture:{showReward:async()=>{}},
  console,Sound:new Proxy({},{get:()=>noop}),TavlaMP:{connected:true,send:m=>sent.push(m)},
  clearAutoRollTimer:noop,clearBreakTimers:noop,clearMoveGrace:noop,clearAIGame:noop,
  updateStatus:noop,updateControls:noop,updateTurn:noop,draw:noop,maybeAITurn:noop,startAutoRollTimer:noop,
  hideBreakOverlay:noop,saveAIGame:noop,setTimeout:(cb,ms)=>{timers.push({cb,ms});return timers.length;},clearTimeout:noop,setInterval:(cb,ms)=>{timers.push({cb,ms});return timers.length;},clearInterval:noop,cancelAnimationFrame:noop,
  AUTO_ROLL:true,AUTO_ROLL_MS:5000,...extra});
 vm.runInContext(names.map(n=>fn(n)).join('\n'),c);return {c,s,timers,sent};
}
const cases=[];const test=(name,run)=>cases.push([name,run]);
test('terminal network result is applied once and malformed chat is ignored',()=>{
 let awards=0,chats=0;const f=fixture(['onRemoteMessage'],{awardSimple:()=>awards++,addChatMessage:()=>chats++});
 f.c.onRemoteMessage('message',{type:'resign'});f.c.onRemoteMessage('message',{type:'resign'});f.c.onRemoteMessage('message',{type:'forfeit'});
 assert.equal(awards,1,'late duplicate result cannot pay the same match again');
 assert.doesNotThrow(()=>f.c.onRemoteMessage('message',{type:'chat',text:42}));assert.equal(chats,0);
});
test('simple reward is idempotent and clears the active AI save',async()=>{
 let kaju=0,xp=0,clears=0;const f=fixture(['awardSimple'],{Store:{addKaju:async()=>kaju++,addXP:async()=>xp++},clearAIGame:()=>clears++});
 await Promise.all([f.c.awardSimple(true,'resign'),f.c.awardSimple(true,'resign')]);
 assert.equal(kaju,1);assert.equal(xp,1);assert.equal(clears,1,'resignation cannot leave a resumable unfinished AI save');
});
test('pending simple reward cannot continue after account replacement',async()=>{
 let uid='old-player',release;const writes=[];const f=fixture(['awardSimple'],{Auth:{getState:()=>({uid})},Store:{recordMatchResult:()=>new Promise(r=>release=r),addKaju:async()=>writes.push('kaju'),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
 const done=f.c.awardSimple(true,'resign');uid='new-player';release();await done;assert.deepEqual(writes,[]);
});
test('natural win cannot continue rewards into a restarted game',async()=>{
 let release;const writes=[];const f=fixture(['onWin'],{Store:{addKaju:()=>new Promise(r=>release=r),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
 f.s.mode='ai';f.s.state.off.w=15;const done=f.c.onWin('white_wins');
 f.s._turnToken={};f.s.gameEnded=false;release();await done;assert.deepEqual(writes,[]);
});
test('agreed break blocks movement, roll, pass and automatic timers',()=>{
 const f=fixture(['canInteract','canInteractRoll','canPassNow','endTurn','rollAndShow','startAutoRollTimer']);
 f.s.breakState='resting';f.s.state.dice=[6,3];f.s.canPass=true;
 assert.equal(f.c.canInteract(),false);assert.equal(f.c.canPassNow(),false);
 f.s.state.used=[0,1];f.c.endTurn();assert.equal(f.s.state.turn,'w','delayed end-turn waits until break is over');
 f.s.rolled=false;f.s.state.dice=[];f.s.state.used=[];
 assert.equal(f.c.canInteractRoll(),false);f.c.rollAndShow();assert.deepEqual(f.s.state.dice,[]);
 f.c.startAutoRollTimer();assert.equal(f.timers.length,0,'break cannot arm an automatic roll');
});
test('ending a break finishes the deferred completed turn',()=>{
 let passed=0;const f=fixture(['endBreak'],{endTurn:()=>passed++});
 f.s.breakState='resting';f.s.state.dice=[6,3];f.s.state.used=[0,1];f.c.endBreak();
 assert.equal(passed,1);assert.equal(f.s.breakState,null);
});
test('declining a break restores a deferred completed turn',()=>{
 let passed=0;const f=fixture(['onRemoteMessage'],{endTurn:()=>passed++});
 f.s.breakState='requesting';f.s.state.dice=[6,3];f.s.state.used=[0,1];
 f.c.onRemoteMessage('message',{type:'break_decline'});assert.equal(passed,1);
});
test('resuming after break advances a completed turn or restores unrolled controls',()=>{
 for(const completed of [true,false]){
  let passed=0,auto=0,grace=0;const f=fixture(['resumeAfterBreak'],{endTurn:()=>passed++,startAutoRollTimer:()=>auto++,startMoveGrace:()=>grace++});
  f.s.breakState='decision';f.s.rolled=completed;f.s.state.dice=completed?[6,3]:[];f.s.state.used=completed?[0,1]:[];
  f.c.resumeAfterBreak();assert.equal(f.s.breakState,null);
  assert.equal(passed,completed?1:0);assert.equal(auto,completed?0:1);
  assert.equal(grace,completed?0:1,'a completed turn must not receive an impossible new move deadline');
 }
});
test('natural victory records exactly one result with the correct opponent',async()=>{
 const recorded=[],paid=[];const f=fixture(['onWin'],{Store:{recordMatchResult:async(...args)=>recorded.push(args),addKaju:async n=>paid.push(n),addXP:async()=>{}}});
 f.s.oppUid='opponent-id';f.s.oppName='Opponent';f.s.state.off.w=15;
 await Promise.all([f.c.onWin('white_wins'),f.c.onWin('white_wins')]);
 assert.deepEqual(recorded,[['tavla','win','opponent-id','Opponent']]);assert.equal(paid.length,1);
});
test('combined human move is saved before its delayed end-turn',()=>{
 let saves=0;const f=fixture(['getCombinedMoves','doMove'],{saveAIGame:()=>saves++,afterTurn:noop});
 f.s.mode='ai';f.s.online=false;f.s.state.dice=[2,1];
 const combo=f.c.getCombinedMoves(f.s.state,5).find(m=>m._combo);assert.ok(combo);
 f.c.doMove(combo);assert.equal(saves,1,'combined move must be durable just like a single move');
});
test('bearing-off animation belongs to the mover color',()=>{
 let color;const f=fixture(['doMove'],{startBearAnim:c=>color=c,afterTurn:noop});
 f.s.online=false;f.s.state.points=Array(24).fill(0);f.s.state.points[0]=2;f.s.state.points[23]=-15;f.s.state.off.w=13;f.s.state.dice=[1,2];
 const move=engine.allLegalMoves(f.s.state).find(m=>m.to==='off');assert.ok(move);
 f.c.doMove(move);assert.equal(color,'w','white bearing off must animate the white tray');
});
test('draw clears saved AI match and break/grace timers',()=>{
 let cleared=0,timers=0;const f=fixture(['endInDraw'],{clearAIGame:()=>cleared++,clearBreakTimers:()=>timers++,clearMoveGrace:()=>timers++});
 f.s.mode='ai';f.c.endInDraw();assert.equal(cleared,1);assert.equal(timers,2);assert.equal(f.s.gameEnded,true);
});
test('invalid remote move cannot cancel the move-grace deadline',()=>{
 let cleared=0;const f=fixture(['onRemoteMessage'],{clearMoveGrace:()=>cleared++,animateMove:(_m,cb)=>cb()});
 f.s.moveGraceActive=true;f.s.state.turn='b';f.s.state.dice=[2,1];
 f.c.onRemoteMessage('message',{type:'move',from:23,to:20,die:3});assert.equal(cleared,0);
 const move=engine.allLegalMoves(f.s.state)[0];assert.ok(move);f.c.onRemoteMessage('message',move.type==='move'?{...move,type:'move'}:{from:move.from,to:move.to,die:move.die,type:'move'});
 assert.equal(cleared,1,'only a validated playable move satisfies the grace deadline');
});
test('local move-grace timeout settles the correct result once',()=>{
 for(const who of ['me','them']){
  const outcomes=[];const f=fixture(['forfeitByTimeout'],{awardSimple:won=>outcomes.push(won)});
  f.s.breakRequester=who;f.c.forfeitByTimeout();f.c.forfeitByTimeout();assert.deepEqual(outcomes,[who==='them']);
 }
});
test('AI blot risk uses the actual opponent movement direction',()=>{
 const c=vm.createContext({...engine});vm.runInContext(fn('evaluate',aiSource),c);
 for(const color of ['w','b']){
  const make=threat=>{const s=engine.newGame();s.points=Array(24).fill(0);s.bar={w:0,b:0};s.off={w:0,b:0};s.turn=color;
   const mine=color==='w'?10:13,enemy=color==='w'?(threat?8:12):(threat?15:11);
   s.points[mine]=color==='w'?1:-1;s.points[enemy]=color==='w'?-2:2;return s;};
  const danger=make(true),safe=make(false),opp=color==='w'?'b':'w';
  const normal=s=>c.evaluate(s,color)+engine.pipCount(s,color)-engine.pipCount(s,opp)*.55;
  assert.ok(normal(danger)<normal(safe),`${color} checker must be penalized for an opponent behind it, not one moving away`);
 }
});
let failures=0;for(const [name,run]of cases){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
if(failures)process.exitCode=1;
