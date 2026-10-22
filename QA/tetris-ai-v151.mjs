// Real hard-bot plans and actor replay. Board-quality metrics are independent.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
const raw=process.env.TETRIS_AI_V151_SOURCE_REF?execFileSync('git',['show',process.env.TETRIS_AI_V151_SOURCE_REF+':js/games/tetris.js'],{encoding:'utf8'}):fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;\r?$/gm,'').replace(/^export function /gm,'function ');
const noop=()=>{},c=vm.createContext({console,window:{},localStorage:{getItem:()=>null},DEFAULT_THEME:'neon',DEFAULT_HERO:'vor',HERO_KEYS:[],HEROES:{},requestAnimationFrame:noop,cancelAnimationFrame:noop,Sound:new Proxy({},{get:()=>noop})});
vm.runInContext(source+'\nthis.qa={set:s=>G=s,aiComputePlan,aiTick,aiSimulatePlan:typeof aiSimulatePlan===\'function\'?aiSimulatePlan:null,toMatrix,PIECES};',c);
for(const n of ['flash','updateVersusUI','screenShake'])c[n]=noop;
c.endGame=()=>{throw new Error('fixture bot must not top out');};
const q=c.qa,heights=[3,2,7,2,2,6,2,1,0,5];
const boardFrom=hs=>Array.from({length:20},(_,y)=>hs.map(h=>20-y<=h?'#b':0));
const holes=board=>{let n=0;for(let x=0;x<10;x++){let seen=false;for(let y=0;y<20;y++){if(board[y][x])seen=true;else if(seen)n++;}}return n;};
function setup(board=boardFrom(heights),type='L',next='L',depth=2){
 const s={ai:true,over:false,oppAlive:true,aiBoard:board.map(r=>r.slice()),aiCur:{type,color:'#a',matrix:q.toMatrix(q.PIECES[type].cells),x:3,y:0},aiBag:[next,'I','J','L','S','T','Z'],aiProfile:{moveMs:90,dropMs:280,mult:1,lookahead:depth},aiDropInterval:280,aiMoveAcc:0,aiDropAcc:0,aiPlan:null,aiPendingGarbage:0,oppLines:0,oppScore:0};
 q.set(s);return s;
}
function play(s,pieces){let n=0,p=s.aiCur;for(let t=0;t<1800&&n<pieces;t++){q.aiTick(10);if(p!==s.aiCur){n++;p=s.aiCur;}}assert.equal(n,pieces,'the real timed actor must complete its planned pieces');return {holes:holes(s.aiBoard),lines:s.oppLines};}
let failures=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n'+e.message);}}
test('two-piece hard planning prevents a hole that single-piece planning creates',()=>{
 const normal=setup(undefined,'L','L',0),one=play(normal,2);
 const hard=setup(undefined,'L','L',2),two=play(hard,2);
 assert.equal(one.holes,1);assert.equal(one.lines,1);
 assert.equal(two.holes,0,'known L after L avoids the single-piece trap');assert.equal(two.lines,1,'quality gain keeps the same completed line');
});
test('hard search leaves the real board, current piece, bag and phase unchanged',()=>{
 const s=setup(),before=JSON.stringify(s),first=q.aiComputePlan(s.aiCur),second=q.aiComputePlan(s.aiCur);
 assert.equal(JSON.stringify(s),before);assert.deepEqual(first,second,'search is deterministic');assert.ok(Number.isFinite(first.score));
});
test('chosen hard placements are replayable by the actual move/drop actor',()=>{
 for(const hs of [heights,[18,16,17,16,16,18,18,18,18,18],[3,0,2,8,4,6,0,1,7,5]]){
  const s=setup(boardFrom(hs)),plan=q.aiComputePlan(s.aiCur),prediction=q.aiSimulatePlan(s.aiBoard,s.aiCur,plan,s.aiMoveAcc,s.aiDropAcc);
  assert.ok(prediction,'the selected destination must be reachable before locking');
  s.aiPlan={...plan};play(s,1);
  assert.deepEqual(JSON.parse(JSON.stringify(s.aiBoard)),JSON.parse(JSON.stringify(prediction.board)),'visible rotation/translation/drop timing reaches the searched board');
  assert.equal(s.oppLines,prediction.lines);
 }
});
test('easy and normal retain the original one-piece heuristic',()=>{
 const a=setup(undefined,'L','L',0),first=q.aiComputePlan(a.aiCur);
 const b=setup(undefined,'L','L',1),second=q.aiComputePlan(b.aiCur);
 assert.deepEqual(first,second);
});
test('hard lookahead has a fixed placement budget and records its measured cost',()=>{
 const s=setup();let count=0;const simulate=c.aiSimulatePlan;
 c.aiSimulatePlan=(...args)=>{count++;return simulate(...args);};
 const started=performance.now();q.aiComputePlan(s.aiCur);const ms=performance.now()-started;
 c.aiSimulatePlan=simulate;
 assert.ok(count<=48+6*48,'at most48 first candidates and6×48 follow-ups');
 assert.ok(ms<2000,'bounded search must complete, including VM overhead');
 console.log('MEASURE hard planning:',count,'candidate paths,',ms.toFixed(1),'ms in Node VM');
});
if(failures)process.exitCode=1;
if(process.env.TETRIS_AI_BROWSER==='1'){
 const {chromium}=createRequire(import.meta.url)('playwright');
 const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM});
 try{
  const page=await browser.newPage();
  await page.evaluate(src=>{Object.assign(window,{DEFAULT_THEME:'neon',DEFAULT_HERO:'vor',HERO_KEYS:[],HEROES:{}});eval(src+'\nwindow.__aiQA={set:s=>G=s,plan:aiComputePlan,matrix:toMatrix,PIECES};');},source);
  const sample=()=>page.evaluate(()=>{
   const q=window.__aiQA,hs=[3,2,7,2,2,6,2,1,0,5],board=Array.from({length:20},(_,y)=>hs.map(h=>20-y<=h?'#b':0));
   q.set({aiBoard:board,aiBag:['L'],aiMoveAcc:0,aiDropAcc:0,aiDropInterval:280,aiProfile:{moveMs:90,dropMs:280,lookahead:2}});
   const piece={type:'L',color:'#a',matrix:q.matrix(q.PIECES.L.cells),x:3,y:0},samples=[];
   for(let i=0;i<12;i++){const t=performance.now();q.plan(piece);samples.push(performance.now()-t);}
   return {max:Math.max(...samples),mean:samples.reduce((a,b)=>a+b,0)/samples.length};
  });
  console.log('MEASURE Chromium planning native',await sample());
  const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  console.log('MEASURE Chromium planning4xCPU',await sample());
 }finally{await browser.close();}
}
