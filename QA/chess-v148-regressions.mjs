// Follow-on chess outcome regressions: actual controller functions, deterministic services.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/chess-engine.js';
const source=fs.readFileSync(new URL('../js/games/chess.js',import.meta.url),'utf8');
function fn(name){
 const m=new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return end?rest.slice(0,end.index+1):rest;
}
const noop=()=>{};
function harness(extra={}){
 const writes=[],timers=[],statuses=[];
 const c=vm.createContext({G:{state:engine.newGame(),root:{appendChild:noop},mode:'online',playerColor:'w',clock:{w:60,b:60}},...engine,
 Store:{recordMatchResult:async(...a)=>writes.push(['record',...a]),addKaju:async(...a)=>writes.push(['kaju',...a]),addXP:async(...a)=>writes.push(['xp',...a])},
 Auth:{getState:()=>({uid:'player-a'})},Resume:{clearSnapshot:()=>writes.push(['clear'])},stopClockTick:()=>writes.push(['stop']),
 rewardFixture:{showReward:async o=>writes.push(['reward',o])},Sound:new Proxy({},{get:()=>noop}),ChessMP:{send:noop},setTimeout:f=>timers.push(f),
 updateStatus:(...a)=>statuses.push(a),updateClockDisplay:noop,handleDrawOffer:noop,addChatMessage:noop,setupClock:noop,console,...extra});
 const names=['onGameEnd','onGameEndDraw','onTimeout','onRemoteMessage',...(source.includes('function beginChessOutcome(')?['beginChessOutcome']:[])];
 vm.runInContext(names.map(fn).join('\n').replaceAll("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.api={onGameEnd,onGameEndDraw,onTimeout,onRemoteMessage};',c);
 return {c,writes,timers,statuses,api:c.api};
}
let failures=0;
async function test(name,run){try{await run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.stack);}}
await test('duplicate remote outcome settles once and stops the clock',async()=>{
 const h=harness();h.api.onRemoteMessage({type:'resign'});h.api.onRemoteMessage({type:'resign'});h.api.onRemoteMessage({type:'drawAccept'});
 for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(h.writes.filter(x=>x[0]==='record').length,1);assert.equal(h.writes.filter(x=>x[0]==='kaju').length,1);assert.equal(h.writes.filter(x=>x[0]==='stop').length,1);
});
await test('closed/restarted game cannot continue delayed outcome writes or UI',async()=>{
 for(const change of ['close','restart']){
  let release;const writes=[],h=harness({Store:{recordMatchResult:()=>new Promise(r=>release=r),addKaju:async()=>writes.push('kaju'),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
  const done=h.api.onGameEnd(true);if(change==='close')h.c.G=null;else h.c.G.state=engine.newGame();release();await done;assert.deepEqual(writes,[],change);
 }
});
await test('account change cancels old result continuation',async()=>{
 let release,uid='player-a';const writes=[],h=harness({Auth:{getState:()=>({uid})},Store:{recordMatchResult:()=>new Promise(r=>release=r),addKaju:async()=>writes.push('kaju'),addXP:async()=>writes.push('xp')},rewardFixture:{showReward:async()=>writes.push('reward')}});
 const done=h.api.onGameEndDraw();uid='player-b';release();await done;assert.deepEqual(writes,[]);
});
await test('timeout records correct winner and clears resumable game',async()=>{
 for(const color of ['w','b']){
  const h=harness();h.api.onTimeout(color);for(let i=0;i<20;i++)await Promise.resolve();
  const row=h.writes.find(x=>x[0]==='record');assert.ok(row,'timeout must record result');assert.equal(row[2],color==='w'?'loss':'win');assert.equal(h.c.G.gameEnded,true);assert.ok(h.writes.some(x=>x[0]==='clear'));
 }
});
await test('draw acceptance from AI and online uses the same settlement path',async()=>{
 for(const mode of ['ai','online']){
  const nodes={};const overlay={remove:noop,querySelector:s=>nodes[s]??={addEventListener:(_t,cb)=>{nodes[s].click=cb;}}};
  const h=harness({document:{createElement:()=>overlay},materialAdvantage:()=>({w:0,b:0})});h.c.G.mode=mode;h.c.G.aiColor='b';h.c.G.root={appendChild:noop};
  vm.runInContext(fn('offerDraw')+'\n'+fn('handleDrawOffer')+'\nthis.offer=offerDraw;this.accept=handleDrawOffer;',h.c);
  if(mode==='ai')h.c.offer();else{h.c.accept();nodes['.ccf-yes'].click();}
  for(let i=0;i<20;i++)await Promise.resolve();assert.equal(h.writes.filter(x=>x[0]==='record').length,1,mode);assert.equal(h.writes.find(x=>x[0]==='record')[2],'draw');
 }
});
await test('closing an expired draw dialog permits the next offer without clearing its replacement',async()=>{
 const overlays=[],sent=[];
 const h=harness({document:{createElement:()=>{
  const nodes={};const ov={nodes,remove:noop,querySelector:s=>nodes[s]??={addEventListener:(_t,cb)=>{nodes[s].click=cb;}}};overlays.push(ov);return ov;
 }},ChessMP:{send:m=>sent.push(m)}});
 vm.runInContext(fn('handleDrawOffer')+'\nthis.offer=handleDrawOffer;',h.c);
 h.c.offer();assert.equal(overlays.length,1);
 h.c.G.state=engine.applyMove(h.c.G.state,engine.resolveLegalMove(h.c.G.state,{from:{r:6,c:4},to:{r:4,c:4}}));
 overlays[0].nodes['.ccf-no'].click();assert.equal(h.c.G.drawOfferOpen,false);assert.deepEqual(sent,[],'expired response is not sent');
 h.c.offer();assert.equal(overlays.length,2,'new offer is accepted after closing stale dialog');
 overlays[0].nodes['.ccf-no'].click();assert.equal(h.c.G.drawOfferOpen,overlays[1],'old response cannot clear replacement dialog');
 overlays[1].nodes['.ccf-yes'].click();for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(h.writes.filter(x=>x[0]==='record').length,1);assert.equal(sent[0].type,'drawAccept');
});
await test('time expiry against a bare king is a draw, not a win',async()=>{
 const h=harness();h.c.G.state=engine.fromFEN('7k/8/8/8/8/8/8/K6q b - - 0 1');
 h.api.onTimeout('b');for(let i=0;i<20;i++)await Promise.resolve();
 assert.equal(h.writes.find(x=>x[0]==='record')[2],'draw');
 assert.equal(engine.hasMatingPotential(engine.fromFEN('7k/8/8/8/8/8/8/KNN5 b - - 0 1').board,'w'),true,'two knights have a possible assisted mate');
});
await test('promoted same-color bishop material is a dead position',async()=>{
 const state=engine.fromFEN('7k/8/8/8/8/4B3/8/2B4K w - - 0 1');
 assert.equal(engine.gameStatus(state),'insufficient');
 assert.equal(engine.hasMatingPotential(state.board,'w'),false);
});
await test('FEN rejects malformed fields and impossible en passant',async()=>{
 const base='4k3/8/8/8/3pP3/8/8/4K3';
 for(const fen of [`${base} z - - 0 1`,`${base} w junk - 0 1`,`${base} w - - -1 1`,`${base} w - - 0 0`,`${base} w - d5 0 1`,'4k3/80/8/8/8/8/8/4K3 w - - 0 1'])assert.equal(engine.fromFEN(fen),null,fen);
 const valid=engine.fromFEN('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
 assert.ok(valid);assert.equal(engine.allLegalMoves(valid).filter(m=>m.enPassant).length,1);
});
if(failures)process.exitCode=1;
