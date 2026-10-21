// Independent rule examples and real-dictionary AI regressions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/kelime-engine.js';
import * as ai from '../js/games/kelime-ai.js';
const empty=()=>Array.from({length:15},()=>Array(15).fill(null));
const tile=(letter)=>({letter,points:engine.letterPoints(letter),joker:false});
const place=(r,c,letter)=>({r,c,...tile(letter)});
let failures=0;
async function test(label,run){try{await run();console.log('PASS',label);}catch(e){failures++;console.error('FAIL',label,e.message);}}
engine.setLanguage('en');await engine.loadEnglishDict();await ai.aiReady();
await test('independent crossword, spent-premium and blank scores',()=>{
 const b=empty();b[6][7]=tile('A');b[7][6]=tile('A');
 assert.equal(engine.validatePlacement(b,[place(7,7,'T')]).score,8,'AT4 + AT4 crossing at center');
 assert.equal(engine.validatePlacement(b,[{r:7,c:7,letter:'',assigned:'T',points:0,joker:true}]).score,4,'blank remains zero in both crossing words');
 const spent=empty();spent[7][6]=tile('A');spent[7][7]=tile('T');
 assert.equal(engine.validatePlacement(spent,[place(7,8,'E')]).score,3,'spent center is not reused');
});
await test('independent multiple-word-multiplier and custom bingo scores',()=>{
 const example=[...'EXAMPLE'].map((ch,i)=>place(7,5+i,ch));
 const res=engine.validatePlacement(empty(),example);assert.equal(res.ok,true);assert.equal(res.score,68,'EXAMPLE38 + product bingo30');assert.equal(res.bingo,true);
 const triangle=[...'TRIANGLE'].map((ch,i)=>place(7,i,ch));assert.equal(engine.validatePlacement(empty(),triangle).score,60,'triple word × center double, including double-letter square');
});
await test('existing board cannot poison scores or throw on missing rows',()=>{
 for(const corrupt of [{...tile('A'),points:Infinity},{...tile('A'),points:'5'},{...tile('A'),points:-1},{...tile('A'),letter:'?'},{...tile('A'),joker:'yes'}]){
  const b=empty();b[7][6]=corrupt;assert.equal(engine.validatePlacement(b,[place(7,7,'T')]).ok,false);
 }
 for(const malformed of [Array(15),Array.from({length:15},()=>Array(15))]){
  assert.doesNotThrow(()=>engine.validatePlacement(malformed,[place(7,7,'A'),place(7,8,'T')]));
  assert.equal(engine.validatePlacement(malformed,[place(7,7,'A'),place(7,8,'T')]).ok,false);
 }
 const b=empty();b[7][6]={letter:'A',points:0,joker:true};assert.equal(engine.validatePlacement(b,[place(7,7,'T')]).score,2,'committed blank letter remains usable without optional assigned duplicate');
 assert.equal(engine.validatePlacement(empty(),[{r:7,c:7,letter:'A',points:0,joker:true},place(7,8,'T')]).ok,false,'new blank requires explicit assignment before commit');
 const state=engine.newGame(),pending=[{r:7,c:7,letter:'',assigned:'A',points:0,joker:true},place(7,8,'T')],result=engine.validatePlacement(state.board,pending);
 assert.equal(result.ok,true);engine.commitMove(state,pending,result.score,'A');assert.equal(engine.isValidBoard(state.board),true);assert.equal(state.board[7][7].letter,'A');
});
await test('seeded bag exactly preserves every letter and blank',()=>{
 for(const lang of ['tr','en']){
  engine.setLanguage(lang);const b=engine.buildBagSeeded(1234),copy=structuredClone(b);
  assert.deepEqual(engine.buildBagSeeded(1234),b);assert.notDeepEqual(engine.buildBagSeeded(5678),b);
  const count={};for(const t of b){count[t.joker?'?':t.letter]=(count[t.joker?'?':t.letter]||0)+1;assert.equal(t.points,t.joker?0:engine.letterPoints(t.letter));}
  assert.equal(count['?'],2);for(const [l,spec]of Object.entries(engine.LETTERS))assert.equal(count[l],spec.n);
  const taken=engine.drawFromBag(b,7);assert.equal(taken.length,7);assert.equal(b.length+7,copy.length);assert.deepEqual([...b,...taken.slice().reverse()],copy);
 }
});
await test('hard AI extends words using multiple existing letters',()=>{
 engine.setLanguage('en');
 for(const [prefix,last,word,expected]of [['AD','Z','ADZ',26],['ACINI','C','ACINIC',10]]){
  const b=empty();[...prefix].forEach((ch,i)=>b[7][5+i]=tile(ch));const rack=[tile(last)],before=JSON.stringify({b,rack});
  const legal=engine.validatePlacement(b,[place(7,5+prefix.length,last)]);assert.equal(legal.ok,true);assert.equal(legal.score,expected);
  const move=ai.findBestMove(b,rack,'zor');assert.ok(move,`legal ${word} must not be passed`);assert.ok(move.words.some(w=>w.text===word));assert.equal(engine.validatePlacement(b,move.pending).ok,true);assert.equal(JSON.stringify({b,rack}),before,'search never mutates board or rack');
 }
});
await test('AI can form a parallel word joined only by crosswords',()=>{
 const source=process.env.KELIME_AI_ORACLE_REF?execFileSync('git',['show',`${process.env.KELIME_AI_ORACLE_REF}:js/games/kelime-ai.js`],{encoding:'utf8'}):fs.readFileSync(new URL('../js/games/kelime-ai.js',import.meta.url),'utf8');
 const stripped=source.replace(/^import .*;\r?\n/gm,'').replace(/^export (?:async )?function /gm,m=>m.replace('export ',''));
 const lower=Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(ch=>[ch,ch.toLowerCase()]));
 const c=vm.createContext({DICT:['at','be','ba','et'],TR_LOWER:lower,SIZE:15,RACK_SIZE:7,CENTER:{r:7,c:7},getLanguage:()=> 'tr',letterPoints:engine.letterPoints,validatePlacement:engine.validatePlacement,isEmptyBoard:engine.isEmptyBoard,isValidBoard:engine.isValidBoard,Map,Set,Math});
 vm.runInContext(stripped+'\nthis.find=findBestMove;',c);
 const b=empty();b[7][6]=tile('A');b[7][7]=tile('T');const move=c.find(b,[tile('B'),tile('E')],'zor');
 assert.ok(move);assert.ok(move.words.some(w=>w.text==='BE'),'parallel BE joins BA and ET without using an old cell in its main word');assert.equal(move.pending.length,2);assert.equal(move.score,16);
});
await test('calling EN search before readiness cannot cache an empty dictionary forever',async()=>{
 engine.setLanguage('en');const cold=await import('../js/games/kelime-ai.js?cold-v149');
 const b=empty(),rack=[tile('A'),tile('T')];assert.equal(cold.findBestMove(b,rack,'zor'),null);
 assert.ok(await cold.aiReady());assert.ok(cold.findBestMove(b,rack,'zor'));
});
await test('search rejects corrupt boards and rack data without mutation or throws',()=>{
 for(const b of [Array(15),[[null]],empty().map((r,i)=>i===7?r.map(()=>({letter:'A',points:Infinity})):r)])assert.doesNotThrow(()=>assert.equal(ai.findBestMove(b,[tile('A')],'zor'),null));
 for(const rack of [[null],Array(7),[{letter:'?',points:0,joker:false}],[{letter:'A',points:999,joker:false}]])assert.doesNotThrow(()=>assert.equal(ai.findBestMove(empty(),rack,'zor'),null));
});
await test('full rack and joker search stays legal and bounded on a populated board',()=>{
 const b=empty();[...'READ'].forEach((ch,i)=>b[7][5+i]=tile(ch));const rack=[...'AEIRST'].map(tile).concat({letter:'',points:0,joker:true});
 const start=performance.now(),move=ai.findBestMove(b,rack,'zor');assert.ok(move);assert.ok(performance.now()-start<4000,'bounded midgame search must not freeze for seconds');assert.equal(engine.validatePlacement(b,move.pending).ok,true);
 const counts={};for(const t of rack)counts[t.joker?'?':t.letter]=(counts[t.joker?'?':t.letter]||0)+1;
 for(const p of move.pending){const key=p.joker?'?':p.letter;assert.ok(counts[key]>0);counts[key]--;if(p.joker)assert.equal(p.points,0);}
});
engine.setLanguage('tr');
if(failures)process.exitCode=1;
