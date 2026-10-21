import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { LETTERS_EN, LETTERS_TR } from '../js/games/kelime-engine.js';
const source=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
function fn(name){
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));assert.ok(start>=0,name);
  const tail=source.slice(start),match=/\n(?:async )?function \w+\(/.exec(tail);
  return tail.slice(0,match?match.index:undefined);
}
function defer(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
{
  let created;const content={appendChild:ov=>created=ov};
  const ctx=vm.createContext({G:{root:{querySelector:()=>content}},LETTERS:LETTERS_EN,LETTER_LIST:Object.keys(LETTERS_TR),document:{createElement:()=>({querySelectorAll:()=>[],querySelector:()=>({addEventListener(){}})})}});
  vm.runInContext(fn('pickJokerLetter')+'\n;pickJokerLetter(()=>{});',ctx);
  for(const letter of ['Q','W','X'])assert.ok(created.innerHTML.includes(`data-l="${letter}"`),'English joker offers '+letter);
  assert.ok(!created.innerHTML.includes('data-l="Ç"'));
  ctx.LETTERS=LETTERS_TR;vm.runInContext('pickJokerLetter(()=>{})',ctx);assert.ok(created.innerHTML.includes('data-l="Ç"'));assert.ok(!created.innerHTML.includes('data-l="Q"'));
}
for(const name of ['startAI','resumeKelime']){
  const gate=defer();let mutations=0;
  const ctx=vm.createContext({G:{root:{querySelector:()=>({})}},KL_LANG:'tr',KA:{aiReady:()=>gate.promise},Resume:{clearSnapshot:()=>mutations++},newGame:()=>{mutations++;throw Error('stale initialization');},flashStartError:()=>mutations++});
  vm.runInContext(fn(name)+`;this.pending=${name}(${name==='startAI'?"'orta'":'{}'});`,ctx);
  ctx.G=null;gate.resolve();await ctx.pending;assert.equal(mutations,0,name+' does not initialize a closed session');
}
{
  const timers=[];let renders=0;const status={style:{}};
  const ctx=vm.createContext({G:{root:{querySelector:()=>status}},setTimeout:cb=>timers.push(cb),renderScores:()=>renders++});
  vm.runInContext(fn('afterGame')+'\n'+fn('flashStatus')+`;flashStatus('Ready');`,ctx);
  ctx.G=null;timers.shift()();assert.equal(renders,0,'late status reset cannot render a closed game');
}
{
  const ctx=vm.createContext({});vm.runInContext(fn('onlineOutcome')+'\n;this.outcome=onlineOutcome;',ctx);
  const game={winnerByTimeout:'A'};
  assert.equal(ctx.outcome(game,'A').result,'win');assert.equal(ctx.outcome(game,'B').result,'loss');
  assert.match(ctx.outcome(game,'B').message,/süren/);
  assert.equal(ctx.outcome({resignedBy:'A'},'A').result,'loss');assert.equal(ctx.outcome({resignedBy:'A'},'B').result,'win');
  assert.equal(ctx.outcome({draw:true},'A').result,'draw');
}
{
  const gate=defer();let credits=0,xp=0;
  const ctx=vm.createContext({G:{root:{querySelector:()=>({})},state:{scores:{A:1,B:0}},names:{A:'A',B:'B'}},Store:{addKaju:async()=>{credits++;await gate.promise;},addXP:async()=>xp++}});
  vm.runInContext(fn('endGame')+'\n;this.one=endGame();this.two=endGame();',ctx);
  assert.equal(credits,1,'local game end can only award once while payout is pending');
  ctx.G=null;gate.resolve();await Promise.all([ctx.one,ctx.two]);assert.equal(xp,0,'old payout cannot continue into a replacement game');
}
{
  let ended=0,next=0;
  const ctx=vm.createContext({G:{state:{board:[],bag:[],scores:{A:0,B:0},racks:{A:[],B:[{}]}},pending:[{}],rackView:[]},RACK_SIZE:7,validatePlacement:()=>({ok:true,score:1,words:[]}),applySurprises:()=>({doubleMul:1,extraPoints:0,extraTiles:0,hits:[]}),currentTurn:()=> 'A',commitMove(){},trackBest(){},trackRecords(){},setLastMove(){},celebrate(){},drawFromBag:()=>[],renderAll(){},endGame:()=>ended++,nextTurn:()=>next++});
  vm.runInContext(fn('submitMove')+'\n;submitMove();',ctx);assert.equal(ended,1,'empty bag and empty rack ends local game');assert.equal(next,0);
}
console.log('PASS Kelime UI regressions: active joker alphabet, canceled AI setup, delayed status, timeout/resign outcomes, single game-end reward and local bag exhaustion.');
