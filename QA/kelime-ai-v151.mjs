// Real TR/EN dictionaries; actual-score ranking without consuming surprise state.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as engine from '../js/games/kelime-engine.js';
import * as ai from '../js/games/kelime-ai.js';
const empty=()=>Array.from({length:15},()=>Array(15).fill(null));
const tile=letter=>({letter,points:engine.letterPoints(letter),joker:false});
let failures=0;
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}

for(const lang of ['tr','en']){
 engine.setLanguage(lang);if(lang==='en')await engine.loadEnglishDict();await ai.aiReady();
 await test(lang+' hard AI chooses +25 surprise and returns the unchanged base word score',()=>{
  const board=empty(),rack=['A','T'].map(tile),surprises={'7,8':{type:'bonus25'}};
  const before=JSON.stringify({board,rack,surprises});
  const ordinary=ai.findBestMove(board,rack,'zor');
  assert.equal(ordinary.score,4);assert.ok(!ordinary.pending.some(p=>p.r===7&&p.c===8),'ordinary tie chooses the other opening');
  const move=ai.findBestMove(board,rack,'zor',{surprises});
  assert.equal(engine.validatePlacement(board,move.pending).ok,true);
  assert.ok(move.pending.some(p=>p.r===7&&p.c===8));
  assert.equal(move.score,4,'controller still applies surprise exactly once');
  assert.equal(move.effectiveScore,29,'real gain is base4 + surprise25');
  assert.equal(JSON.stringify({board,rack,surprises}),before,'ranking never consumes tiles, commits board or opens boxes');
 });
 await test(lang+' hard AI chooses the actual double-score square',()=>{
  const board=empty(),rack=['A','T'].map(tile),surprises={'8,7':{type:'double'}};
  const move=ai.findBestMove(board,rack,'zor',{surprises});
  assert.equal(engine.validatePlacement(board,move.pending).ok,true);
  assert.ok(move.pending.some(p=>p.r===8&&p.c===7));
  assert.equal(move.score,4);assert.equal(move.effectiveScore,8);
 });
 await test(lang+' equal-score play retains a joker for the next turn',()=>{
  const board=empty(),rack=[tile('A'),tile('T'),{letter:'',points:0,joker:true}];
  const withBlank=[{r:7,c:7,...tile('A')},{r:7,c:8,...tile('T')},
   {r:7,c:9,letter:'',assigned:lang==='tr'?'A':'E',points:0,joker:true}];
  const alternative=engine.validatePlacement(board,withBlank);
  assert.equal(alternative.ok,true);assert.equal(alternative.score,4,'ATA/ATE spends a blank for the same four points');
  const move=ai.findBestMove(board,rack,'zor');
  assert.equal(engine.validatePlacement(board,move.pending).ok,true);
  assert.equal(move.score,4);assert.equal(move.effectiveScore,4);
  assert.equal(move.pending.length,2);assert.ok(move.pending.every(p=>!p.joker),'AT can earn the same score without spending the blank');
 });
}
await test('equal actual scores prefer a balanced remaining rack over an all-vowel play',()=>{
 engine.setLanguage('en');
 // Both AA and AT are real dictionary words worth4 at center; restrict this
 // search dictionary to isolate their strategic tie rather than test longer words.
 const source=fs.readFileSync(new URL('../js/games/kelime-ai.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const c=vm.createContext({...engine,DICT:[],TR_LOWER:{A:'a',T:'t'},console});
 vm.runInContext(source+`\nDICT_EN=['aa','at'];EN_UPPER={a:'A',t:'T'};this.find=findBestMove;`,c);
 const board=empty(),rack=[...'AAELNT'].map(tile),move=c.find(board,rack,'zor');
 assert.equal(move.score,4);assert.equal(engine.validatePlacement(board,move.pending).ok,true);
 assert.equal(move.words[0].text,'AT','AT leaves A,E,L,N (two vowels/two consonants); AA leaves E,L,N,T');
});
engine.setLanguage('tr');
if(failures)process.exitCode=1;
