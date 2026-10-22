// Real controller and canvas renderer: no live account, database or transport.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { drawThemedCell } from '../js/games/tetris-themes.js';
const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
function fn(name){
  const match=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source);
  assert.ok(match,`missing ${name}`);
  const rest=source.slice(match.index),next=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
  return (next?rest.slice(0,next.index+1):rest).replace(/^export /,'');
}
const empty=()=>Array.from({length:20},()=>Array(10).fill(0)),noop=()=>{};
let failed=0;
async function test(label,run){try{await run();console.log('PASS',label);}catch(e){failed++;console.error('FAIL',label,e.stack);}}

await test('review counts only covered empty cells and real surface height',()=>{
  const c=vm.createContext({COLS:10,ROWS:20});vm.runInContext(fn('tetrisBoardMetrics')+'\nthis.metrics=tetrisBoardMetrics;',c);
  const board=empty();board[17][0]='#00E5FF';board[19][0]='#00E5FF';board[19][1]='#FFD740';
  const m=c.metrics(board);
  assert.equal(m.holes,1);assert.equal(m.height,3);assert.equal(m.filled,3);assert.equal(m.bumpiness,3);
  assert.equal(c.metrics(empty()).holes,0);assert.equal(c.metrics(empty()).height,0);
});

await test('review keeps at most 80 cloned locks, replaces final same-turn state and retains peak metrics',()=>{
  const c=vm.createContext({COLS:10,ROWS:20});vm.runInContext(fn('tetrisBoardMetrics')+fn('captureTetrisReview')+'\nthis.capture=captureTetrisReview;',c);
  const s={board:empty(),reviewFrames:[],reviewTurn:0,score:0,lines:0};
  s.board[1][0]='#00E5FF';c.capture(s);s.board=empty();
  for(let n=1;n<=105;n++){s.reviewTurn=n;s.score=n;c.capture(s);}
  assert.equal(s.reviewFrames.length,80);assert.equal(s.reviewFrames[0].turn,26);assert.equal(s.reviewStats.peakHeight,19);
  s.board[19][2]='#FFD740';s.score=999;c.capture(s);
  assert.equal(s.reviewFrames.length,80);assert.equal(s.reviewFrames.at(-1).score,999);
  s.board[19][2]=0;assert.equal(s.reviewFrames.at(-1).board[19][2],'#FFD740','saved frames do not follow later live-board mutation');
});

await test('pure review SVG displays stored blocks, rejects markup colors and never changes live data',()=>{
  const c=vm.createContext({COLS:10,ROWS:20});vm.runInContext(fn('renderReviewFrame')+'\nthis.render=renderReviewFrame;',c);
  const frame={board:empty()};frame.board[19][0]='#00E5FF';frame.board[18][1]='\"><script>bad()</script>';
  const before=JSON.stringify(frame),host={innerHTML:''};c.render(frame,host);
  assert.match(host.innerHTML,/viewBox="0 0 200 400"/);assert.match(host.innerHTML,/fill="#00E5FF"/);
  assert.doesNotMatch(host.innerHTML,/<script>/);assert.equal(JSON.stringify(frame),before);
});

await test('block and ghost materials preserve caller canvas state at small and large sizes',()=>{
  for(const size of [4,5,8,13,24,40])for(const ghost of [false,true]){
    const stack=[],rects=[];
    const ctx={globalAlpha:.6,shadowBlur:9,fillStyle:'original',strokeStyle:'original',lineWidth:3,
      save(){stack.push({globalAlpha:this.globalAlpha,shadowBlur:this.shadowBlur,fillStyle:this.fillStyle,strokeStyle:this.strokeStyle,lineWidth:this.lineWidth});},
      restore(){Object.assign(this,stack.pop());},createLinearGradient:()=>({addColorStop:noop}),
      fillRect:(...a)=>rects.push(a),strokeRect:(...a)=>rects.push(a),beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop};
    drawThemedCell(ctx,0,0,size,'#00E5FF','neon',ghost);
    assert.equal(ctx.globalAlpha,.6);assert.equal(ctx.shadowBlur,9);assert.equal(ctx.fillStyle,'original');assert.equal(stack.length,0);
    assert.ok(rects.length>0);assert.ok(rects.every(r=>r.every(Number.isFinite)&&r[2]>=0&&r[3]>=0),`invalid block rectangle at ${size}`);
  }
});

await test('a malformed saved color cannot break the premium gradient renderer',()=>{
  const colors=[],noop=()=>{};
  const ctx={globalAlpha:1,save:noop,restore:noop,fillRect:noop,strokeRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,
    createLinearGradient:()=>({addColorStop:(_n,color)=>{colors.push(color);assert.doesNotMatch(color,/NaN|invalid/);}})};
  assert.doesNotThrow(()=>drawThemedCell(ctx,0,0,24,'invalid saved color','neon',false));
  assert.ok(colors.includes('#8c9dbb'));
});

function fixture(patch={},storePatch={}){
  const nodes=new Map(),writes=[],rewards=[];
  const el=()=>({textContent:'',style:{},classList:{add:noop,remove:noop},closest:()=>({})});
  const ov={querySelector:s=>{if(!nodes.has(s))nodes.set(s,el());return nodes.get(s);},classList:{add:noop}};
  const state={round:{},ownerUid:'a',board:empty(),over:false,score:2000,lines:4,elapsed:1000,mode:'solo',el:{gameover:ov},...patch};
  const context=vm.createContext({G:state,Auth:{getState:()=>({uid:'a',isAdmin:true})},
    Store:{addScore:async()=>{writes.push('score');return false;},addKaju:async()=>{writes.push('kaju');return 0;},
      awardXP:async()=>{writes.push('xp');return{ok:true,amount:40};},...storePatch},
    Sound:new Proxy({},{get:()=>noop}),Resume:{clearSnapshot:noop},MP:{connected:false,close:noop},
    cancelAnimationFrame:noop,recordGameStats:()=>writes.push('stats'),setTimeout:noop,console,
    rewardFixture:{showReward:async opts=>{rewards.push(opts);return'close';}}});
  vm.runInContext(fn('endGame').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.finish=endGame;',context);
  return {context,state,nodes,writes,rewards,finish:context.finish};
}

await test('postgame uses actual daily-capped Kaju and confirmed boosted XP credit',async()=>{
  const f=fixture();await f.finish(false);assert.equal(f.rewards[0].kaju,0);assert.equal(f.rewards[0].xp,40);
  assert.deepEqual(f.writes,['stats','score','kaju','xp']);
  const failed=fixture({}, {awardXP:async()=>({ok:false,amount:99})});await failed.finish(false);
  assert.equal(failed.rewards[0].xp,0,'failed XP receipt never advertises a credit');
  assert.equal(failed.rewards[0].payoutIssue,true,'the reward screen receives the confirmed write failure');
});

await test('versus result advertises only confirmed paid Kaju and explains write failure',async()=>{
  const f=fixture({versus:true,oppAlive:false},{addKaju:async()=>7});await f.finish(true);
  assert.equal(f.nodes.get('.go-reward').textContent,'🥜 +7 zafer ödülü');
  const cap=fixture({versus:true,oppAlive:false});await cap.finish(true);assert.match(cap.nodes.get('.go-reward').textContent,/Kaju eklenmedi/);
  const fail=fixture({versus:true,oppAlive:false},{addKaju:async()=>{throw Error('offline');}});await fail.finish(true);
  assert.match(fail.nodes.get('.go-reward').textContent,/tamamlanamadı/);assert.doesNotMatch(fail.nodes.get('.go-reward').textContent,/\+100/);
});

await test('solo delegates one played event to Store for positive scores and Reward for zero scores',async()=>{
  for(const score of [0,400]){
    const f=fixture({score});await f.finish(false);assert.equal(f.rewards[0].playEventHandled,score>0);
  }
});

await test('versus emits one played/won event per finished round without double counting score submission',async()=>{
  for(const [score,won,ai]of [[0,true,false],[400,true,false],[0,false,false],[400,false,false],[400,true,true]]){
    const events=[],f=fixture({score,versus:true,oppAlive:!won,ai},{
      addScore:async(_game,value)=>{if(value>0)events.push('game_played');return false;},
      trackQuestEvent:type=>events.push(type)});
    await f.finish(won);await f.finish(won);
    assert.equal(events.filter(e=>e==='game_played').length,1,`${score}/${won}/${ai} records one completed play`);
    assert.equal(events.filter(e=>e==='game_won').length,won?1:0);
  }
  const failedEvents=[],failed=fixture({score:400,versus:true,oppAlive:false},{
    addScore:async()=>{failedEvents.push('game_played');return false;},trackQuestEvent:type=>failedEvents.push(type),addKaju:async()=>{throw Error('offline');}});
  await failed.finish(true);assert.equal(failedEvents.filter(e=>e==='game_played').length,1,'a failed victory payout cannot suppress the real finished-game event');
  const interruptedEvents=[],interrupted=fixture({versus:true},{trackQuestEvent:type=>interruptedEvents.push(type)});await interrupted.finish(false,{interrupted:true});assert.deepEqual(interruptedEvents,[]);
});

await test('training remains unranked and unrewarded after its toggle is switched off',async()=>{
  const f=fixture({practiceUsed:true,practiceMode:false});await f.finish(false);
  assert.deepEqual(f.writes,[]);assert.deepEqual(f.rewards,[]);assert.match(f.nodes.get('.go-title').textContent,/ANTRENMAN/);
  const c=vm.createContext({G:{isAdmin:true,practiceMode:false,el:{}},Auth:{getState:()=>({isAdmin:true})},Sound:{shield:noop},flash:noop});
  vm.runInContext(fn('togglePractice')+'\ntogglePractice();togglePractice();',c);
  assert.equal(c.G.practiceMode,false);assert.equal(c.G.practiceUsed,true);
});

await test('a completed round cannot credit an account that did not own its start',async()=>{
  const f=fixture({ownerUid:'previous-account'});await f.finish(false);
  assert.deepEqual(f.writes,[]);assert.deepEqual(f.rewards,[]);assert.match(f.nodes.get('.go-title').textContent,/OTURUM/);
});

await test('resume snapshots retain round ownership and the practice-used flag',()=>{
  let saved,launches=0,clears=0;
  const s={ownerUid:'a',mode:'solo',board:empty(),practiceUsed:true};
  const c=vm.createContext({G:s,Auth:{getState:()=>({uid:'a'})},RESUMABLE_MODES:['solo'],SELECTED_HERO:'vor',SELECTED_THEME:'neon',ADVENTURE_WORLD:null,
    Resume:{saveSnapshot:(_game,data)=>saved=data,loadSnapshot:()=>({data:saved}),clearSnapshot:()=>clears++},
    isValidTetrisSnapshot:()=>true,launchGame:()=>launches++});
  vm.runInContext(fn('saveTetrisResume')+'\n'+fn('resumeTetris')+'\nthis.save=saveTetrisResume;this.resume=resumeTetris;',c);
  c.save();assert.equal(saved.ownerUid,'a');assert.equal(saved.practiceUsed,true);
  c.Auth.getState=()=>({uid:'b'});c.save();assert.equal(saved.ownerUid,'a','account B cannot overwrite the old game as its own snapshot');
  c.resume();assert.equal(clears,1);assert.equal(launches,1,'another account gets a fresh game instead of adopting the saved score');
});

await test('practice adventure finish does not unlock a ranked world',async()=>{
  let unlocks=0,ends=0;
  const c=vm.createContext({G:{practiceUsed:true,advWorld:{id:1},lines:50},calcStars:()=>3,completeWorld:()=>unlocks++,endGame:async()=>ends++});
  vm.runInContext(fn('adventureWin')+'\nthis.win=adventureWin;',c);await c.win();
  assert.equal(unlocks,0);assert.equal(ends,1);assert.equal(c.G.advStars,3);
});

await test('portal minimize pauses only active offline play and preserves manual pause and online clocks',()=>{
  for(const [versus,paused,ai]of [[false,false,false],[false,true,false],[true,false,false],[true,false,true]]){
    const pauses=[],online=versus&&!ai,s={round:{},versus,paused,ai,last:123,controlStops:[()=>pauses.push('stop')]};
    const c=vm.createContext({G:s,togglePause:on=>{pauses.push(on);s.paused=on;},requestAnimationFrame:()=>{},fitCanvas:()=>{},drawBoard:()=>{}});
    vm.runInContext(fn('setPortalMinimized')+'\nthis.minimize=setPortalMinimized;',c);
    c.minimize(true);c.minimize(true);assert.equal(s.portalMinimized,true);
    assert.deepEqual(pauses,online||paused?['stop']:['stop',true]);
    c.minimize(false);assert.equal(s.paused,paused);assert.equal(s.last,123,'the minimize hook does not reset an online time accumulator');
    assert.deepEqual(pauses,online||paused?['stop']:['stop',true,false]);
  }
});

await test('minimized Tetris global keys cannot move or mutate its background round',()=>{
  const actions=[],s={round:{},root:{querySelectorAll:()=>[]},paused:false};
  const c=vm.createContext({G:s,window:{addEventListener:()=>{}},bindTouchGestures:()=>{},
    move:()=>actions.push('move'),rotate:()=>actions.push('rotate'),softDrop:()=>actions.push('soft'),hardDrop:()=>actions.push('hard'),hold:()=>actions.push('hold'),usePower:()=>actions.push('power'),togglePause:()=>actions.push('pause')});
  vm.runInContext(fn('bindControls')+'\nbindControls();',c);s.portalMinimized=true;
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','c','e','p'])s.keyHandler({key,target:{tagName:'DIV'},preventDefault(){}});
  assert.deepEqual(actions,[]);s.portalMinimized=false;s.keyHandler({key:'ArrowLeft',target:{tagName:'DIV'},preventDefault(){}});assert.deepEqual(actions,['move']);
});

await test('restoring a minimized replacement round never resumes that new round automatically',()=>{
  const calls=[],s={round:{},paused:false};const c=vm.createContext({G:s,togglePause:on=>{calls.push(on);s.paused=on;},requestAnimationFrame:()=>{}});
  vm.runInContext(fn('setPortalMinimized')+'\nthis.minimize=setPortalMinimized;',c);
  c.minimize(true);s.round={};c.minimize(false);assert.deepEqual(calls,[true]);
});

if(failed)process.exitCode=1;
