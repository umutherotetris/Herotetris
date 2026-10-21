// Real gameplay functions with deterministic UI/account boundaries.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
function fn(name){
  const re=new RegExp(`^(?:async )?function ${name}\\(`,'m'),m=re.exec(source);
  assert.ok(m,`missing ${name}`);
  const rest=source.slice(m.index),next=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
  return next?rest.slice(0,next.index+1):rest;
}
const noop=()=>{};
function game(){return {round:{},cur:{type:'T',matrix:[[1]],color:'T',x:3,y:15},board:Array.from({length:20},()=>Array(10).fill(0)),holdType:'O',canHold:true,countdown:0,lockTimer:480,lockResets:14,lastMoveRotate:true,score:400,lines:2,level:1,mode:'solo',elapsed:1000,el:{gameover:{classList:{add:noop},querySelector:()=>({textContent:'',style:{},closest:()=>({})})}}};}
function harness(extra={}){
 const c=vm.createContext({G:game(),PIECES:{O:{color:'O',cells:[[1,0],[2,0],[1,1],[2,1]]}},toMatrix:()=>[[0,1,1],[0,1,1],[0,0,0]],Sound:new Proxy({},{get:()=>noop}),drawSide:noop,gameOver:noop,fillQueue:noop,Resume:{clearSnapshot:noop},cancelAnimationFrame:noop,Auth:{getState:()=>({uid:'player-a'})},Store:{addScore:async()=>false,addKaju:async()=>{},addXP:async()=>{}},recordGameStats:noop,rewardFixture:{showReward:async()=> 'close'},setTimeout:noop,console,...extra});
 return c;
}
{
 let ended=0;const c=harness({collides:()=>true,gameOver:()=>ended++});
 vm.runInContext(fn('handleTopOut')+fn('hold')+'\nhold();',c);
 assert.equal(ended,1,'hold must end play if the swapped-in piece overlaps the board');
 assert.equal(c.G.lockTimer,0);assert.equal(c.G.lockResets,0);assert.equal(c.G.lastMoveRotate,false,'hold must not inherit a previous piece rotation');
 console.log('PASS blocked hold and fresh piece state.');
}
{
 const c=harness();c.G.queue=[{type:'I',y:0}];
 vm.runInContext(fn('nextFromQueue')+'\nnextFromQueue();',c);
 assert.equal(c.G.lockTimer,0);assert.equal(c.G.lockResets,0);assert.equal(c.G.lastMoveRotate,false);
 console.log('PASS queued piece does not inherit lock delay or T-spin rotation.');
}
{
 let release;const writes=[];const c=harness({Store:{addScore:()=>new Promise(r=>release=r),addKaju:async()=>writes.push('kaju'),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
 vm.runInContext(fn('endGame').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.finish=endGame;',c);
 const done=c.finish(false);c.G=null;release(false);await done;
 assert.deepEqual(writes,[],'closing while a score write is pending must cancel later UI/reward work');
 console.log('PASS closed game ignores delayed score completion.');
}
{
 let release;let uid='player-a';const writes=[];const c=harness({Auth:{getState:()=>({uid})},Store:{addScore:()=>new Promise(r=>release=r),addKaju:async()=>writes.push('kaju'),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
 vm.runInContext(fn('endGame').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.finish=endGame;',c);
 const done=c.finish(false);uid='player-b';release(false);await done;
 assert.deepEqual(writes,[],'old game must not submit additional rewards after account replacement');
 console.log('PASS account replacement cancels delayed reward continuation.');
}
{
 let release,restarted=0,recorded=0;const c=harness({recordGameStats:()=>recorded++,restart:()=>restarted++,rewardFixture:{showReward:()=>new Promise(r=>release=r)}});
 vm.runInContext(fn('endGame').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.finish=endGame;',c);
 const done=c.finish(false);for(let i=0;i<10&&!release;i++)await Promise.resolve();assert.ok(release);
 release('replay');await done;
 assert.equal(restarted,1,'premium reward replay starts a new round');assert.equal(recorded,1,'premium rewards still record statistics once');
 console.log('PASS premium replay and one statistics record.');
}
{
 let release,restarted=0;const c=harness({restart:()=>restarted++,rewardFixture:{showReward:()=>new Promise(r=>release=r)}});
 vm.runInContext(fn('endGame').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.finish=endGame;',c);
 const done=c.finish(false);for(let i=0;i<10&&!release;i++)await Promise.resolve();assert.ok(release);
 c.G.round={};release('replay');await done;assert.equal(restarted,0,'a reward belonging to a previous round cannot restart a replacement round');
 console.log('PASS stale replay cannot reset a replacement round.');
}
{
 const rewardSource=fs.readFileSync(new URL('../js/reward.js',import.meta.url),'utf8');
 const start=rewardSource.indexOf('export async function showReward('),end=rewardSource.indexOf('// CSS enjekte',start);
 let active=true,release;const progress=[];
 const c=vm.createContext({Store:{getState:()=>({level:1,xp:0,kaju:0})},economyFixture:new Promise(r=>release=r),console});
 vm.runInContext(rewardSource.slice(start,end).replace('export ','').replace("import('./economy.js')",'economyFixture')+'\nthis.show=showReward;',c);
 const done=c.show({writeReward:false,isCurrent:()=>active});active=false;
 release({progressQuest:(...args)=>progress.push(args)});
 assert.equal(await done,'close');assert.deepEqual(progress,[],'loading reward services must not progress quests or create UI for a canceled game');
 console.log('PASS shared reward cancels late service loading.');
}
