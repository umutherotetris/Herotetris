// Account-scoped persistence and real lifecycle teardown, with no browser/Firebase.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as tavlaEngine from '../js/games/tavla-engine.js';
const read=name=>fs.readFileSync(new URL('../js/games/'+name+'.js',import.meta.url),'utf8');
const source=Object.fromEntries(['resume','chess','tavla','kelime','tetris'].map(game=>[game,read(game)]));
function fn(game,name){const match=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source[game]);assert.ok(match,name);const rest=source[game].slice(match.index),end=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));return(end?rest.slice(0,end.index+1):rest).replace(/^export /,'');}
const noop=()=>{};
const plain=value=>JSON.parse(JSON.stringify(value));
function storage(){const values=new Map();return{values,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function common(){let uid='a',time=100000000;const saved=storage(),c=vm.createContext({window:{Hero:{Auth:{getState:()=>({uid})}}},localStorage:saved,Date:{now:()=>time},console});vm.runInContext(source.resume.replace(/export (?=(?:const|function))/g,''),c);return{c,saved,setUid:value=>uid=value,setTime:value=>time=value,now:()=>time};}
let passed=0,failed=0;
async function test(name,run){try{await run();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
await test('shared resume isolates two accounts, guest and each game without migrating unowned keys',()=>{
 const f=common();f.saved.setItem('hero_resume_chess',JSON.stringify({v:1,t:f.now(),data:{secret:'legacy'}}));assert.equal(f.c.loadSnapshot('chess'),null);
 f.c.saveSnapshot('chess',{owner:'a'});f.c.saveSnapshot('kelime',{word:'A'});f.setUid('b');assert.equal(f.c.loadSnapshot('chess'),null);f.c.saveSnapshot('chess',{owner:'b'});f.setUid(null);assert.equal(f.c.loadSnapshot('chess'),null);f.c.saveSnapshot('chess',{owner:'guest'});
 f.setUid('a');assert.deepEqual(plain(f.c.loadSnapshot('chess').data),{owner:'a'});assert.deepEqual(plain(f.c.loadSnapshot('kelime').data),{word:'A'});f.setUid('b');assert.deepEqual(plain(f.c.loadSnapshot('chess').data),{owner:'b'});f.setUid(null);assert.deepEqual(plain(f.c.loadSnapshot('chess').data),{owner:'guest'});assert.ok(f.saved.getItem('hero_resume_chess'));
});
await test('shared resume rejects owner tampering, future/negative/nonfinite time and expired records',()=>{
 const f=common(),key='hero_resume_chess:a';for(const fields of [{owner:'b'},{t:f.now()+1},{t:-1},{t:null},{t:'100000000'},{t:f.now()-13*3600000},{v:1}]){f.saved.setItem(key,JSON.stringify({v:2,owner:'a',t:f.now(),data:{ok:true},...fields}));assert.equal(f.c.loadSnapshot('chess'),null,JSON.stringify(fields));assert.equal(f.saved.getItem(key),null);}
 f.c.saveSnapshot('chess',{ok:true});assert.equal(f.c.loadSnapshot('chess',0).age,0);f.setTime(f.now()+1);assert.equal(f.c.loadSnapshot('chess',0),null);
});
await test('clearing one shared resume cannot erase another account and encoded UIDs cannot collide',()=>{
 const f=common();for(const uid of ['a','b','a:b','a%3Ab']){f.setUid(uid);f.c.saveSnapshot('chess',{uid});}f.setUid('a');f.c.clearSnapshot('chess');assert.equal(f.c.loadSnapshot('chess'),null);for(const uid of ['b','a:b','a%3Ab']){f.setUid(uid);assert.equal(f.c.loadSnapshot('chess').data.uid,uid);}
});
await test('shared resume tolerates unavailable storage and missing portal auth safely',()=>{
 const c=vm.createContext({localStorage:{setItem(){throw Error('blocked');},getItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}},Date:{now:()=>100}});vm.runInContext(source.resume.replace(/export (?=(?:const|function))/g,''),c);assert.doesNotThrow(()=>c.saveSnapshot('chess',{}));assert.equal(c.loadSnapshot('chess'),null);assert.doesNotThrow(()=>c.clearSnapshot('chess'));
});
function tavla(){let uid='a';const saved=storage(),c=vm.createContext({...tavlaEngine,G:{mode:'ai',state:tavlaEngine.newGame(),_reviewUid:'a',gameEnded:false},Auth:{getState:()=>({uid})},localStorage:saved,TAVLA_SAVE_KEY:'hero_tavla_ai_save',SELECTED_THEME:'kizil',Date:{now:()=>100000000}});vm.runInContext(['saveAIGame','clearAIGame','loadAIGame'].map(name=>fn('tavla',name)).join('\n'),c);return{c,saved,setUid:value=>uid=value};}
await test('tavla saves only its match owner and isolates owner/guest records',()=>{
 const f=tavla();f.saved.setItem('hero_tavla_ai_save',JSON.stringify({state:tavlaEngine.newGame(),ts:100000000}));assert.equal(f.c.loadAIGame(),null);f.c.saveAIGame();assert.equal(f.c.loadAIGame().owner,'a');f.setUid('b');f.c.saveAIGame();assert.equal(f.saved.getItem('hero_tavla_ai_save:b'),null);assert.equal(f.c.loadAIGame(),null);
 f.c.G._reviewUid='b';f.c.saveAIGame();assert.equal(f.c.loadAIGame().owner,'b');f.c.clearAIGame();f.setUid('a');assert.equal(f.c.loadAIGame().owner,'a');f.setUid(null);assert.equal(f.c.loadAIGame(),null);f.c.G._reviewUid=null;f.c.saveAIGame();assert.equal(f.c.loadAIGame().owner,'guest');
});
await test('tavla rejects copied-owner, unowned and invalid-time snapshots before restoration',()=>{
 const f=tavla(),key='hero_tavla_ai_save:a';for(const fields of [{owner:'b'},{owner:undefined},{v:1},{ts:100000001},{ts:-1},{ts:null},{ts:'100000000'},{ts:1}]){f.saved.setItem(key,JSON.stringify({v:2,owner:'a',state:tavlaEngine.newGame(),ts:100000000,...fields}));assert.equal(f.c.loadAIGame(),null,JSON.stringify(fields));assert.equal(f.saved.getItem(key),null);}
});
await test('chess, kelime and tetris save guards block a previous account from writing under the new one',()=>{
 for(const [game,name,ownerField] of [['chess','saveChessResume','_reviewUid'],['kelime','saveKelimeResume','_reviewOwner'],['tetris','saveTetrisResume','ownerUid']]){
  let uid='b';const writes=[],G={mode:game==='tetris'?'solo':'ai',state:{board:[],racks:{A:[],B:[]},scores:{A:0,B:0}},board:[],ai:{difficulty:'easy'},[ownerField]:'a'};
  const c=vm.createContext({G,Auth:{getState:()=>({uid})},kelimeOwner:()=>uid,Resume:{saveSnapshot:(...args)=>writes.push(args)},RESUMABLE_MODES:['solo'],SELECTED_HERO:'hero',SELECTED_THEME:'theme',ADVENTURE_WORLD:null,KL_LANG:'tr'});vm.runInContext(fn(game,name),c);c[name]();assert.equal(writes.length,0,game+' changed account');uid='a';c[name]();assert.equal(writes.length,1,game+' original account');
 }
});
await test('all four exact-root teardown wrappers run lifecycle cleanup without saving any resume',()=>{
 for(const [game,closer,saver] of [['chess','closeAll','saveChessResume'],['tavla','closeAll','saveAIGame'],['kelime','closeKelime','saveKelimeResume'],['tetris','close','saveTetrisResume']]){
  let saves=0,removed=0,transport=0,timers=0;const root={remove:()=>removed++},G={root,mode:'ai',raf:1,scoreRaf:2,versus:true,vis:noop,resizeHandler:noop,keyHandler:noop};
  const c=vm.createContext({G,[saver]:()=>saves++,cancelTileInteractions:noop,clearAutoRollTimer:noop,clearBreakTimers:noop,stopOnlineHeartbeat:noop,stopInviteListen:noop,stopTurnTimer:noop,stopClockTick:()=>timers++,cancelAnimationFrame:()=>timers++,clearTimeout:noop,clearInterval:noop,document:{removeEventListener:noop},window:{removeEventListener:noop},ChessMP:{close:()=>transport++},TavlaMP:{close:()=>transport++},KO:{leaveRoom:()=>transport++},MP:{close:()=>transport++},Sound:{stopMusic:noop}});
  vm.runInContext(fn(game,'closePortalGame')+'\n'+fn(game,closer),c);assert.equal(c.closePortalGame({}),false,game+' rejects stale root');assert.equal(removed,0);assert.equal(c.G,G);assert.equal(c.closePortalGame(root),true);assert.equal(c.G,null);assert.equal(removed,1);assert.equal(saves,0,game+' discarded save');assert.equal(transport,1,game+' closed transport');
  // MouseEvent is passed by existing direct click listeners; it must remain a normal saving close.
  c.G={...G};c[closer]({type:'click'});assert.equal(saves,1,game+' ordinary click still saves');
 }
});
console.log(`${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
