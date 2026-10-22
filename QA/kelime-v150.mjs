import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/kelime-engine.js';

const source=process.env.KELIME_V150_SOURCE_REF
  ? execFileSync('git',['show',`${process.env.KELIME_V150_SOURCE_REF}:js/games/kelime.js`],{encoding:'utf8'})
  : fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
function fn(name){
  const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));
  assert.ok(start>=0,name);
  const tail=source.slice(start),next=/\n(?:async )?function \w+\(/.exec(tail);
  if(name==='klSetLang')return tail.slice(0,tail.indexOf('\n}')+2);
  return next?tail.slice(0,next.index):tail;
}
const noop=()=>{},failures=[];
async function check(name,test){try{await test();console.log('PASS '+name);}catch(e){failures.push(name);console.error('FAIL '+name+': '+e.message);}}
const tile=letter=>({letter,points:engine.letterPoints(letter),joker:false});
function game(){return {
  _setupToken:{},root:{querySelector:()=>({})},
  state:{board:Array.from({length:15},()=>Array(15).fill(null)),bag:Array.from({length:20},()=>tile('E')),racks:{A:[tile('B'),tile('C')],B:['A','L','K','M','N','O','P'].map(tile)},scores:{A:0,B:0},moveCount:0,passStreak:0},
  who:'B',ai:{difficulty:'orta'},seri:null,pending:[],rackView:[tile('B'),tile('C')],surprises:{},bestWord:{score:0},names:{A:'Me',B:'AI'},lastMoveCells:new Set()
};}
function ctx(G,extra={}){
  return vm.createContext({G,KA:{findBestMove:()=>null},SIZE:engine.SIZE,RACK_SIZE:engine.RACK_SIZE,SURPRISE_INFO:engine.SURPRISE_INFO,
    commitMove:engine.commitMove,drawFromBag:engine.drawFromBag,validatePlacement:engine.validatePlacement,currentTurn:()=>G.who,
    renderAll:noop,renderScores:noop,celebrate:noop,flashStatus:noop,saveKelimeResume:noop,afterGame:noop,aiTurn:noop,
    stopTurnTimer:noop,startTurnTimer:noop,trackBest:noop,trackRecords:noop,setLastMove:noop,
    sndPlace:noop,sndPick:noop,sndErr:noop,haptic:noop,window:{},Resume:{clearSnapshot:noop},...extra});
}
function load(c,names){vm.runInContext(names.map(fn).join('\n'),c);}
function move(){const pending=[{r:7,c:7,...tile('A')},{r:7,c:8,...tile('L')}];return {...engine.validatePlacement(Array.from({length:15},()=>Array(15).fill(null)),pending),pending};}
engine.setLanguage('tr');

for(const kind of ['pass','play','conflict'])await check('AI '+kind+' preserves the unsubmitted human rack',()=>{
  const G=game(),mv=move(),c=ctx(G,{KA:{findBestMove:()=>kind==='pass'?null:mv},checkGameOver:()=>false});
  load(c,['placeTile','recallConflictingPending','applySurprises','aiTurn']);
  G.selected=0;c.placeTile(kind==='conflict'?7:2,kind==='conflict'?7:2,G.rackView[0]);
  c.aiTurn();
  assert.equal(G.rackView.length+G.pending.length,G.state.racks.A.length,'preview and committed rack must contain the same physical human tiles');
  assert.equal(G.pending.length,kind==='conflict'?0:1,'only an occupied preview square is recalled');
  assert.equal(G.rackView.filter(t=>t.letter==='B').length,kind==='conflict'?1:0,'preview tile is never recreated on the rack');
});

await check('human submission keeps a preview from ending the game early',()=>{
  const G=game(),mv=move();G.who='A';G.aiThinking=false;G.pending=mv.pending;G.rackView=[tile('B')];G.state.racks.A=[tile('A'),tile('L'),tile('B')];G.state.bag=[];
  let ended=0;const c=ctx(G,{endGameAI:()=>ended++});load(c,['applySurprises','submitMove','placeTile','checkGameOver']);
  c.submitMove();assert.equal(G.who,'B');G.selected=0;c.placeTile(2,2,G.rackView[0]);
  assert.equal(c.checkGameOver(),false,'an unsubmitted preview does not empty the committed rack');
  assert.equal(ended,0);assert.equal(G.state.racks.A.length,1);
});

for(const extraTiles of [0,1,2])await check('AI draws '+extraTiles+' surprise tiles without creating or losing tiles',()=>{
  const G=game(),mv=move();for(let i=0;i<extraTiles;i++)G.surprises['7,'+(7+i)]={type:'extra'};
  const before=G.state.bag.length+G.state.racks.A.length+G.state.racks.B.length;
  const c=ctx(G,{KA:{findBestMove:()=>mv},checkGameOver:()=>false});load(c,['recallConflictingPending','applySurprises','aiTurn']);c.aiTurn();
  assert.equal(G.state.racks.B.length,7+extraTiles,'AI receives the same extra-tile reward as a human');
  const onBoard=G.state.board.flat().filter(Boolean).length;
  assert.equal(onBoard+G.state.bag.length+G.state.racks.A.length+G.state.racks.B.length,before,'tile count remains constant');
  assert.equal(G.state.scores.B,mv.score,'extra tile does not change word score');
});

await check('saved English game restores language before loading AI dictionary',async()=>{
  engine.setLanguage('en');await engine.loadEnglishDict();
  const G=game();G.who='A';for(const [i,letter]of [...'CAT'].entries())G.state.board[7][6+i]=tile(letter);let saved;
  const c=ctx(G,{KL_LANG:'en',Resume:{saveSnapshot:(_key,snap)=>saved=structuredClone(snap)},localStorage:{setItem:noop},setLanguage:engine.setLanguage,
    buildGameDOM:noop,KA:{aiReady:async()=>assert.equal(c.KL_LANG,'en','dictionary must initialize in saved language')}});
  load(c,['klSetLang','saveKelimeResume','resumeKelime']);c.saveKelimeResume();
  assert.equal(saved.lang,'en','snapshot includes the tile/dictionary language');
  c.klSetLang('tr');await c.resumeKelime(saved);
  assert.equal(engine.getLanguage(),'en');assert.equal(c.KL_LANG,'en');
  assert.equal(engine.validatePlacement(c.G.state.board,[{r:7,c:9,...tile('S')}]).ok,true,'saved English board accepts the legal CATS extension');
  assert.equal(c.G.state.racks.B.length,G.state.racks.B.length);
  engine.setLanguage('tr');
});

if(failures.length)throw new Error(`${failures.length} v150 Kelime regressions failed: ${failures.join('; ')}`);
console.log('Kelime v150 regressions passed.');
