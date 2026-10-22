import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as Engine from '../js/games/kelime-engine.js';
import * as AI from '../js/games/kelime-ai.js';

const source=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const online=fs.readFileSync(new URL('../js/games/kelime-online.js',import.meta.url),'utf8');
const data=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const stub=data(`export default {addKaju:(...a)=>globalThis.__klTest.addKaju(...a),awardXP:(...a)=>globalThis.__klTest.awardXP(...a)};`);
const resume=data(`export const clearSnapshot=()=>{},loadSnapshot=()=>null,saveSnapshot=()=>{},fmtAge=()=>'';`);
const session=data(`export const mountSessionStatus=()=>({update(){},destroy(){}});`);
const reward=data(`export const showReward=opts=>{globalThis.__klTest.rewards.push(opts);return new Promise(()=>{});};`);
const review=data(`export const recordGameReview=opts=>{const saved={...opts,id:'test-review'};globalThis.__klTest.reviews.push(saved);return saved;};export const openGameReview=()=>{};`);
const engine=new URL('../js/games/kelime-engine.js',import.meta.url).href;
let code=source.replace("from './kelime-engine.js'",`from '${engine}'`)
  .replace("from './resume.js'",`from '${resume}'`)
  .replace("from '../store.js'",`from '${stub}'`)
  .replace("from '../game-session-ui.js'",`from '${session}'`)
  .replaceAll("import('../reward.js')",`import('${reward}')`)
  .replaceAll("import('../game-review.js')",`import('${review}')`);
code+=`\nexport const __test={setGame:g=>G=g,getGame:()=>G,setAI:ai=>KA=ai,endGameAI,endGame,resignGame,initKelimeReview,rememberKelimeTurn,recordKelimeFrame,archiveKelimeReview};`;
const oldGlobals=new Map(['window','document','localStorage','Store','__klTest'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
let uid='owner';
const node=()=>({style:{},classList:{remove(){},add(){},toggle(){}},appendChild(){},remove(){},addEventListener(){},querySelector:()=>null});
globalThis.window={Hero:{Auth:{getState:()=>({uid})}},removeEventListener(){}};
globalThis.document={addEventListener(){},createElement:node};
globalThis.localStorage={getItem:()=>null,setItem(){}};
delete globalThis.Store;
function reset(){globalThis.__klTest={rewards:[],reviews:[],kajuCalls:[],xpCalls:[],addKaju:async n=>{__klTest.kajuCalls.push(n);return 19;},awardXP:async(n,expected)=>{__klTest.xpCalls.push([n,expected]);return {ok:true,amount:65};}};uid='owner';}
const content=node();
function game(overrides={}){return {root:{querySelector:()=>content},sound:false,_setupToken:{},_reviewOwner:'owner',role:'A',who:'A',state:{board:Array.from({length:15},()=>Array(15).fill(null)),scores:{A:42,B:3},racks:{A:[],B:[]}},names:{A:'Owner',B:'Computer'},ai:{difficulty:'orta'},...overrides};}
async function until(predicate){for(let i=0;i<100 && !predicate();i++)await new Promise(resolve=>setImmediate(resolve));assert.ok(predicate(),'asynchronous operation reached expected state');}
try{
  reset();const module=await import(data(code)),test=module.__test;
  // Full ES module: deliberately no global Store. A VM-only fixture used to
  // mask the missing import, while production silently skipped every reward.
  test.setGame(game());test.endGameAI();await until(()=>__klTest.rewards.length===1);
  assert.deepEqual(__klTest.kajuCalls,[70]);assert.deepEqual(__klTest.xpCalls,[[50,'owner']]);
  assert.equal(__klTest.rewards[0].kaju,19,'display actual cap-adjusted credit');
  assert.equal(__klTest.rewards[0].xp,65,'display confirmed boosted XP');
  assert.equal(__klTest.rewards[0].writeReward,false,'central screen cannot credit twice');
  assert.equal(__klTest.rewards[0].questEventsHandled,true,'AI completion already tracked play and win');

  reset();__klTest.addKaju=async()=>{throw Error('offline');};__klTest.awardXP=async()=>({ok:false,amount:0});
  test.setGame(game());test.endGameAI();await until(()=>__klTest.rewards.length===1);
  assert.equal(__klTest.rewards[0].kaju,0);assert.equal(__klTest.rewards[0].xp,0);assert.match(__klTest.rewards[0].extra,/kaydedilemedi/);

  reset();test.setGame(game({ai:null,_resigned:true,_resignedBy:'B',who:'B'}));test.endGame();await until(()=>__klTest.rewards.length===1);
  assert.equal(__klTest.kajuCalls.length,0,'local resignation gives no Kaju');assert.equal(__klTest.xpCalls.length,0,'local resignation gives no XP');

  reset();test.setGame(game());uid='replacement';await test.endGameAI();assert.equal(__klTest.kajuCalls.length,0,'game belongs to the account that started it');
  reset();let resolveCredit;__klTest.addKaju=n=>{__klTest.kajuCalls.push(n);return new Promise(resolve=>resolveCredit=resolve);};
  test.setGame(game());const finishing=test.endGameAI();await until(()=>resolveCredit);test.setGame(null);resolveCredit(70);await finishing;
  assert.equal(__klTest.xpCalls.length,0,'late credit cannot continue into another game');assert.equal(__klTest.rewards.length,0);

  reset();const g=game({ai:null,state:{board:Array.from({length:15},()=>Array(15).fill(null)),scores:{A:0,B:0},racks:{A:[],B:[]}}});test.setGame(g);test.initKelimeReview();
  const original=g._reviewFrames[0];g.state.board[7][7]={letter:'A',points:1,joker:false};g.state.scores.A=4;test.recordKelimeFrame('AT',{word:'AT',score:4,cells:[{r:7,c:7}]});
  assert.equal(original.board[7][7],null,'replay board is a value snapshot');assert.equal(original.scores.A,0,'replay score is a value snapshot');
  for(let i=0;i<75;i++){g.state.scores.A++;test.recordKelimeFrame('Turn '+i);}
  assert.equal(g._reviewFrames.length,60);assert.equal(g._reviewFrames[0],original,'long replay preserves opening');
  test.initKelimeReview();assert.equal(g._reviewFrames.length,1,'a new round resets the signature');
  const host={innerHTML:'',firstElementChild:{}};module.renderReviewFrame({...g._reviewFrames[0],label:'<unsafe>',board:[[...Array(15)].map(()=>null)]},host);
  assert.equal((host.innerHTML.match(/<rect /g)||[]).length,226,'replay renders all 225 cells plus its frame');assert.ok(host.innerHTML.includes('&lt;unsafe&gt;'));assert.ok(!host.innerHTML.includes('<unsafe>'));
  for(const [w,h] of [[320,350],[360,400],[800,250]]){const size=module.kelimeBoardFit(w,h);assert.ok(size+20<=w && size+13<=h,'fit remains inside available geometry');}
  assert.equal(module.kelimeBoardFit(NaN,400),0);
  let focus=0,removed=0;const minimal={root:{style:{},setAttribute(){},querySelectorAll:()=>[],focus:()=>focus++},_home:{remove:()=>removed++}};
  test.setGame(minimal);assert.equal(module.setPortalMinimized(true),true);assert.equal(minimal.root.hidden,true);assert.equal(minimal.root.inert,true);assert.equal(minimal.root.style.display,'none');assert.equal(removed,1);
  module.setPortalMinimized(false);assert.equal(minimal.root.inert,false);assert.equal(minimal.root.style.display,'');assert.equal(focus,1,'restored round receives focus');

  reset();const learning=game({state:{board:Array.from({length:15},()=>Array(15).fill(null)),scores:{A:0,B:0},racks:{A:['A','T'].map(letter=>({letter,points:Engine.letterPoints(letter),joker:false})),B:[]}},surprises:{}});test.setGame(learning);test.initKelimeReview();
  for(let i=0;i<3;i++)test.rememberKelimeTurn(0,[]);
  assert.equal(learning._learningSamples.length,2,'learning retains two positions');
  let searches=0;
  await AI.aiReady();test.setAI({...AI,findBestMove:(board,rack,difficulty,context)=>{searches++;assert.equal(difficulty,'orta');const move=AI.findBestMove(board,rack,difficulty,context);assert.ok(move && Engine.validatePlacement(board,move.pending).ok,'learning suggestion is legal on the recorded board and rack');return move;}});
  await test.archiveKelimeReview('draw');assert.equal(searches,2);assert.equal(__klTest.reviews.length,1);
  assert.ok(__klTest.reviews[0].insights.some(text=>text.includes('geçerli seçenek')));assert.ok(!__klTest.reviews[0].insights.some(text=>/en iyi hamle|kesin en iyi/.test(text)));
  await test.archiveKelimeReview('draw');assert.equal(__klTest.reviews.length,1,'completed game archive writes once');
}finally{for(const [key,descriptor]of oldGlobals){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}

function fn(name){const start=source.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));assert.ok(start>=0,name);const tail=source.slice(start),next=/\n(?:export )?(?:async )?function \w+\(/.exec(tail);return tail.slice(0,next?next.index:undefined).replace(/^export /,'');}
{
  let local=0,ai=0;const G={who:'B',ai:null};const ctx=vm.createContext({G,confirm:()=>true,endGame:()=>local++,endGameAI:()=>ai++});
  vm.runInContext(fn('resignGame')+'\n;resignGame();',ctx);assert.equal(local,1);assert.equal(ai,0);assert.equal(G._resignedBy,'B');
}
{
  const G={oppUid:'old-opponent',oppLevel:20,oppXP:999};const noop=()=>{};
  const ctx=vm.createContext({G,window:{},newGame:Engine.newGame,buildSurprises:()=>({}),stopTurnTimer:noop,buildGameDOM:noop,renderAll:noop,afterGame:noop});
  vm.runInContext(fn('startLocal')+'\n;startLocal();',ctx);assert.equal(G.oppUid,null);assert.equal(G.oppLevel,1,'local opponent cannot inherit an online player profile');
}
{
  let personalRecords=0;const noop=()=>{};
  const G={who:'B',state:{board:[],bag:[],racks:{A:[{}],B:[]}},pending:[{}],rackView:[]};
  const ctx=vm.createContext({G,RACK_SIZE:7,validatePlacement:()=>({ok:true,score:4,words:[{text:'AT',score:4}]}),applySurprises:()=>({doubleMul:1,extraPoints:0,extraTiles:0,hits:[]}),currentTurn:()=>G.who,commitMove:noop,trackBest:noop,trackRecords:()=>personalRecords++,setLastMove:noop,celebrate:noop,drawFromBag:()=>[],renderAll:noop,endGame:noop,nextTurn:noop});
  vm.runInContext(fn('submitMove')+'\n;submitMove();',ctx);assert.equal(personalRecords,0,'second local player cannot claim the account owner’s word record');
}
{
  let resolve;const profile={kelimeRecords:{bestWord:'AT',bestScore:4}};let owner='a';
  const ctx=vm.createContext({G:{_setupToken:{},_reviewOwner:'a',myRecord:{best:{text:'KELİME',score:30},longest:{text:'KELİME',len:6}}},window:{Hero:{Auth:{getState:()=>({uid:owner,profile})}}},KO:{saveKelimeRecords:()=>new Promise(r=>resolve=r)}});
  vm.runInContext(fn('saveRecordsIfBetter')+'\n;this.pending=saveRecordsIfBetter();',ctx);owner='b';resolve({ok:true,records:{bestWord:'KELİME',bestScore:30}});await ctx.pending;assert.equal(profile.kelimeRecords.bestScore,4,'late record acknowledgement cannot mutate another account');
  owner='a';ctx.KO.saveKelimeRecords=async()=>({ok:false});vm.runInContext('this.pending=saveRecordsIfBetter()',ctx);await ctx.pending;assert.equal(profile.kelimeRecords.bestScore,4,'failed record is not shown as saved');
}
{
  const auth=data(`export const Auth={getState:()=>({uid:globalThis.__klRecord.uid})};export const db={};export const fdb={ref:(_,path)=>path,runTransaction:(...args)=>globalThis.__klRecord.run(...args)};`);
  const recordsModule=await import(data(online.replace("from '../auth.js'",`from '${auth}'`)));
  let stored={bestWord:'KELİMECİK',bestScore:80,longestWord:'KAHRAMAN',longestLen:8};let attempts=0;
  globalThis.__klRecord={uid:'a',run:async(path,update,options)=>{attempts++;assert.equal(path,'users/a/kelimeRecords');assert.equal(options.applyLocally,false);const next=update(stored);if(next)stored=next;return {committed:!!next,snapshot:{val:()=>stored}};}};
  let result=await recordsModule.saveKelimeRecords({bestWord:'AT',bestScore:4,longestWord:'KELİMECİK',longestLen:9},'a');
  assert.equal(result.ok,true);assert.equal(stored.bestScore,80,'slower device cannot downgrade best score');assert.equal(stored.longestLen,9,'record categories improve independently');
  result=await recordsModule.saveKelimeRecords({bestWord:'A<script>',bestScore:100},'a');assert.equal(result.ok,false);assert.equal(attempts,1,'malformed record never reaches database');
  __klRecord.uid='b';result=await recordsModule.saveKelimeRecords({bestWord:'AT',bestScore:100},'a');assert.equal(result.ok,false);assert.equal(attempts,1,'expected UID prevents cross-account write');
  __klRecord.uid='a';__klRecord.run=async()=>{throw Error('permission denied');};result=await recordsModule.saveKelimeRecords({bestWord:'AT',bestScore:100},'a');assert.equal(result.ok,false,'write error is acknowledged as failure');
  delete globalThis.__klRecord;
}
console.log('PASS Kelime v156: real module rewards, exact credit/XP, failed payment honesty, account/round isolation, local resignation, value snapshots, bounded legal learning, escaped SVG, fit geometry and monotonic confirmed word records.');
