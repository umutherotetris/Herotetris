// Independent v150 timing review: actual gravity helpers with deterministic floor/spawn.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
function fn(name){
 const m=new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return end?rest.slice(0,end.index+1):rest;
}
function harness(slow=5000,extra={},levelUp=false){
 const G={cur:{y:0},dropInterval:800,dropAcc:0,lockTimer:0,lockResets:0,gravityDebt:0,slowRemainingMs:slow,elapsed:0,over:false,locks:0,...extra};
 const c=vm.createContext({G,LOCK_DELAY:500,LOCK_MAX_RESETS:15,
  collides:()=>G.cur.y>=20,lock:()=>{G.locks++;G.cur={y:0};if(levelUp&&G.locks%3===0)G.dropInterval=Math.max(80,G.dropInterval-80);}});
 vm.runInContext(fn('advanceGravity')+'\n'+fn('advanceTimedGravity')+'\nthis.advance=advanceTimedGravity;',c);
 return {G,advance:c.advance};
}
function drain(h){let loops=0;while(h.G.gravityDebt>0){assert.ok(++loops<10000,'gravity debt must be consumed');h.advance(0);}return loops;}
function compare(a,b){
 for(const key of ['locks','dropInterval','lockResets','slowRemainingMs','gravityDebt','elapsed'])assert.ok(Math.abs(a.G[key]-b.G[key])<1e-7,`${key}: ${a.G[key]} !== ${b.G[key]}`);
 assert.equal(a.G.cur.y,b.G.cur.y,'piece row');
 for(const key of ['dropAcc','lockTimer'])assert.ok(Math.abs(a.G[key]-b.G[key])<1e-7,`${key}: ${a.G[key]} !== ${b.G[key]}`);
}
let failures=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.stack);}}
test('active slow time never runs a zero-duration normal-speed pass',()=>{
 for(const dt of [1,799,800,1000,3199,3200,4999]){
  const h=harness();h.advance(dt);
  assert.equal(h.G.cur.y,Math.floor(dt/3200),`row after ${dt}ms`);
  assert.equal(h.G.dropAcc,dt%3200,`fall accumulator after ${dt}ms`);
  assert.equal(h.G.slowRemainingMs,5000-dt);
 }
});
test('one long frame matches split frames across slow-time expiry',()=>{
 for(const slow of [1,799,800,1250,3200,5000])for(const total of [slow,slow+1,slow+799,slow+1600,20000]){
  const a=harness(slow),b=harness(slow);a.advance(total);drain(a);
  let left=total;while(left>0){const dt=Math.min(37,left);b.advance(dt);left-=dt;}drain(b);compare(a,b);
 }
});
test('bounded slow-time gravity debt preserves expiry ordering until fully drained',()=>{
 for(const slow of [1000000,2000000])for(const levelUp of [false,true]){
  const total=2400000,a=harness(slow,{},levelUp),b=harness(slow,{},levelUp);
  a.advance(total);assert.ok(a.G.gravityDebt>0,'large frame is bounded and defers work');
  assert.ok(a.G.slowRemainingMs>0,'slow time expires only after its debt is simulated');
  assert.ok(drain(a)>0);
  for(let left=total;left>0;){const dt=Math.min(113,left);b.advance(dt);left-=dt;}
  drain(b);compare(a,b);
 }
});
test('pending ordinary gravity debt is consumed once before new slow frames',()=>{
 const a=harness(1000,{gravityDebt:7000,dropAcc:390}),b=harness(1000,{dropAcc:390});
 a.advance(500);b.advance(7500);drain(a);drain(b);compare(a,b);
});
test('snapshot timing fields continue identically after JSON serialization',()=>{
 const live=harness(2000000,{dropAcc:391,lockTimer:0,lastMoveRotate:true});live.advance(2400000);
 const state=JSON.parse(JSON.stringify(live.G)),resumed=harness(state.slowRemainingMs,state);
 assert.ok(state.gravityDebt>0);assert.ok(state.slowRemainingMs>0);
 for(const dt of [0,0,17,31,1200,0,999]){live.advance(dt);resumed.advance(dt);compare(live,resumed);}
 drain(live);drain(resumed);compare(live,resumed);
});
if(failures)process.exitCode=1;
