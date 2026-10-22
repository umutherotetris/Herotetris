// Actual AI search with a deterministic monotonic clock and a small legal dictionary.
// Exercises deadline exhaustion without depending on machine load or loosening timing checks.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/kelime-engine.js';
const source=fs.readFileSync(new URL('../js/games/kelime-ai.js',import.meta.url),'utf8')
 .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
engine.setLanguage('en');await engine.loadEnglishDict();
const words=['at','ate','eat','tea','rate','tare','tear','rat','art','ear','are','era'];
const lower=Object.fromEntries([...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'].map(letter=>[letter,letter.toLowerCase()]));
const empty=()=>Array.from({length:15},()=>Array(15).fill(null));
const tile=letter=>({letter,points:engine.letterPoints(letter),joker:false});
function fixture(step){
 let tick=-step,reads=0,validations=0;const accepted=[];
 const context=vm.createContext({...engine,DICT:[],TR_LOWER:lower,
  performance:{now:()=>{reads++;tick+=step;return tick;}},
  validatePlacement:(board,pending)=>{
   validations++;const result=engine.validatePlacement(board,pending);
   if(result.ok)accepted.push({score:result.score,pending:structuredClone(pending)});
   return result;
  }});
 vm.runInContext(source+`\nDICT_EN=${JSON.stringify(words)};EN_UPPER=${JSON.stringify(Object.fromEntries(Object.entries(lower).map(([a,b])=>[b,a])))};this.find=findBestMove;`,context);
 return {context,accepted,stats:()=>({tick,reads,validations})};
}
for(const [difficulty,budget]of [['kolay',100],['orta',250],['zor',700]]){
 const step=difficulty==='zor'?10:5;
 const f=fixture(step),board=empty(),rack=[...'AERT'].map(tile),before=JSON.stringify({board,rack});
 const move=f.context.find(board,rack,difficulty),stats=f.stats();
 assert.ok(move,'a legal best-so-far candidate survives the cutoff');
 assert.equal(engine.validatePlacement(board,move.pending).ok,true);
 assert.ok(stats.tick>=budget&&stats.tick<=budget+step,JSON.stringify(stats));
 assert.ok(stats.validations>0&&stats.validations<6000,'deadline ends before the evaluation cap');
 assert.equal(JSON.stringify({board,rack}),before,'deadline unwind preserves board and rack');
 if(difficulty==='zor')assert.equal(move.score,Math.max(...f.accepted.map(x=>x.score)),'hard AI retains the best validated candidate when interrupted');
 console.log('PASS '+difficulty+' cooperative deadline returns a legal candidate within its '+budget+' ms clock budget');
}
{
 const f=fixture(1000),board=empty(),rack=[...'AERT'].map(tile),before=JSON.stringify({board,rack});
 assert.equal(f.context.find(board,rack,'zor'),null,'an exhausted search without a validated candidate returns no fabricated move');
 assert.equal(JSON.stringify({board,rack}),before);assert.equal(f.stats().validations,0);
 console.log('PASS exhausted deadline before the first candidate preserves state and returns null');
}
engine.setLanguage('tr');
