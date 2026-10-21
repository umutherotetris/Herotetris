import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import * as engine from '../js/games/kelime-engine.js';
import * as ai from '../js/games/kelime-ai.js';
const source=process.env.KELIME_V148_SOURCE_REF ? execFileSync('git',['show',`${process.env.KELIME_V148_SOURCE_REF}:js/games/kelime.js`],{encoding:'utf8'}) : fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
function fn(name){const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,name);const s=source.slice(start),next=/\n(?:async )?function \w+\(/.exec(s);return next?s.slice(0,next.index):s;}
const noop=()=>{};
{
 const callbacks=[],ctx=vm.createContext({G:{_setupToken:{}},setTimeout:cb=>callbacks.push(cb)});
 vm.runInContext(fn('afterGame')+'\nthis.schedule=afterGame;',ctx);
 let ran=0;ctx.schedule(()=>ran++,10);ctx.G._setupToken={};callbacks.shift()();assert.equal(ran,0,'old round callback must not execute in a new round on the same overlay');
 ctx.schedule(()=>ran++,10);callbacks.shift()();assert.equal(ran,1);
 console.log('PASS same-overlay round callback isolation.');
}
function session(extra={}){return {_setupToken:{},root:{querySelector:()=>({})},state:{scores:{A:100,B:10}},names:{A:'Me',B:'AI'},ai:{difficulty:'zor'},seri:{turnTime:30},...extra};}
function context(extra={}){return vm.createContext({G:session(),stopTurnTimer:noop,Resume:{clearSnapshot:noop},Store:{addKaju:async()=>{},addXP:async()=>{}},window:{},sndWin:noop,sndLose:noop,confetti:noop,saveRecordsIfBetter:noop,console,...extra});}
for(const name of ['startLocal','startAI']){
 const c=context({G:session({online:true,role:'B',_resigned:true}),newGame:()=>({racks:{A:[],B:[]}}),buildSurprises:()=>({}),buildGameDOM:noop,renderAll:noop,afterGame:noop,KA:{aiReady:async()=>{}},KL_LANG:'tr'});
 vm.runInContext(fn(name)+`\nthis.done=${name}(${name==='startAI'?"'orta'":''});`,c);await c.done;
 assert.equal(c.G.online,false);assert.equal(c.G.role,'A');assert.equal(c.G._resigned,false);
 console.log('PASS '+name+' resets previous online role and resignation.');
}
for(const name of ['endGameAI','endGame']){
 const calls=[];const c=context({rewardFixture:{showReward:async()=> 'replay'},startAI:(...args)=>calls.push(['ai',...args]),startLocal:()=>calls.push(['local']),showStart:()=>calls.push(['menu'])});
 vm.runInContext(fn(name).replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+`\nthis.done=${name}();`,c);await c.done;
 assert.equal(calls.length,1,`${name} handles reward replay`);assert.equal(calls[0][0],name==='endGameAI'?'ai':'local');
 if(name==='endGameAI')assert.deepEqual(calls[0],['ai','zor',30],'timed AI replay preserves difficulty and duration');
 console.log('PASS '+name+' premium reward replay.');
}
{
 let result,won=0;const fake={querySelector:()=>({addEventListener:noop})};const c=context({G:session({_resigned:true,root:{querySelector:()=>({appendChild:noop})}}),window:{Hero:{Store:{recordMatchResult:async(_g,r)=>result=r,trackQuestEvent:event=>{if(event==='game_won')won++;}}}},starsFor:()=>1,starStr:()=>'',document:{createElement:()=>fake}});
 vm.runInContext(fn('endGameAI')+'\nthis.done=endGameAI();',c);await c.done;
 assert.equal(result,'loss','resignation is loss even if player led on score');assert.equal(won,0,'resignation never progresses win quest');
 console.log('PASS resignation statistics and quest outcome.');
}
{
 let release,replay=0;const c=context({rewardFixture:{showReward:()=>new Promise(r=>release=r)},startAI:()=>replay++,showStart:()=>replay++});
 vm.runInContext(fn('endGameAI').replace("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.done=endGameAI();',c);
 for(let i=0;i<20&&!release;i++)await Promise.resolve();assert.ok(release);
 c.G._setupToken={};release('replay');await c.done;assert.equal(replay,0,'stale reward cannot restart a newer round in the same overlay');
 console.log('PASS stale reward cannot replay a replacement round.');
}
{
 engine.setLanguage('tr');await ai.aiReady();
 const board=Array.from({length:15},()=>Array(15).fill(null));
 const rack=[{letter:'',points:0,joker:true},{letter:'Z',points:engine.letterPoints('Z'),joker:false}];
 const move=ai.findBestMove(board,rack,'zor');assert.ok(move,'AI must find valid Z+joker word rather than pass');
 assert.ok(move.pending.some(p=>p.joker),'AI consumes actual joker');assert.equal(engine.validatePlacement(board,move.pending).ok,true);
 for(const p of move.pending)if(p.joker){assert.equal(p.points,0);assert.ok(p.assigned);}
 console.log('PASS AI uses rack jokers with legal zero-point assignment.');
}
{
 for(const lang of ['tr','en']){
  engine.setLanguage(lang);if(lang==='en')await engine.loadEnglishDict();await ai.aiReady();
  const board=Array.from({length:15},()=>Array(15).fill(null));
  const rack=[{letter:'',points:0,joker:true},{letter:'',points:0,joker:true}];
  const move=ai.findBestMove(board,rack,'zor');assert.ok(move,lang+' two-joker opening');assert.equal(move.pending.length,2);assert.equal(move.pending.filter(p=>p.joker).length,2);assert.equal(engine.validatePlacement(board,move.pending).ok,true);assert.equal(move.score,0);
 }
 engine.setLanguage('tr');
 console.log('PASS Turkish and English two-joker openings stay legal and score zero.');
}
