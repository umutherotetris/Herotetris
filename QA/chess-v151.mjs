// Actual chess controller regressions for pending UI actions and move animation.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/chess-engine.js';
const source=process.env.CHESS_V151_SOURCE_REF
 ?execFileSync('git',['show',`${process.env.CHESS_V151_SOURCE_REF}:js/games/chess.js`],{encoding:'utf8'})
 :fs.readFileSync(new URL('../js/games/chess.js',import.meta.url),'utf8');
function fn(name){
 const m=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const rest=source.slice(m.index),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return (end?rest.slice(0,end.index+1):rest).replace(/^export /,'');
}
const noop=()=>{};
function harness(state=engine.newGame()){
 const overlays=[],elements=new Map(),sent=[],raf=[],timers=[];
 function element(){
  const parts=new Map(),buttons=['q','r','b','n'].map(p=>({dataset:{p},addEventListener(_t,cb){this.click=cb;}}));
  return {style:{},className:'',removed:false,remove(){this.removed=true;},getContext:()=>({}),
   addEventListener(type,cb){this[type]=cb;},
   querySelector(s){if(!parts.has(s))parts.set(s,element());return parts.get(s);},
   querySelectorAll(s){return s==='.cp-btn'?buttons:[];}};
 }
 const root={appendChild:ov=>overlays.push(ov),
  querySelector(s){if(s==='.chess-confirm')return overlays.find(o=>o.className==='chess-confirm'&&!o.removed)||null;
   if(!elements.has(s))elements.set(s,element());return elements.get(s);},
  querySelectorAll(s){return overlays.filter(o=>!o.removed&&s.split(',').some(part=>part.trim()==='.'+o.className));}};
 const G={root,state,mode:'online',playerColor:'w',aiColor:'b',aiDifficulty:'easy',captured:{w:[],b:[]},undoStack:[],
  moveHistory:[],posHistory:[engine.positionKey(state)],lastMove:null,autoFlip:false,gameEnded:false,clock:null};
 const c=vm.createContext({...engine,G,console,document:{createElement:element,body:{appendChild:o=>overlays.push(o)},addEventListener:noop},window:{addEventListener:noop},localStorage:{getItem:()=>null},injectCSS:noop,
  TIME_OPTIONS:[],GLYPH:{q:'Q',r:'R',b:'B',n:'N'},Auth:{getState:()=>({uid:'qa'})},performance:{now:()=>0},
  requestAnimationFrame:cb=>raf.push(cb),setTimeout:cb=>{timers.push(cb);return cb;},
  clearTimeout:cb=>{const i=timers.indexOf(cb);if(i>=0)timers[i]=noop;},
  ChessMP:{connected:true,send:m=>sent.push(m)},Resume:{clearSnapshot:noop,loadSnapshot:()=>null},Sound:new Proxy({},{get:()=>noop}),
  createVsHUD:async()=>({destroy:noop}),draw:noop,updateTurn:noop,updateStatus:noop,updateCaptured:noop,
  updateClockDisplay:noop,updatePanels:noop,addHistoryRow:noop,clearHistoryUI:noop,rebuildHistoryUI:noop,
  moveToNotation:()=>'',saveChessResume:noop,maybeAIMove:noop,stopClockTick:noop,startClockTick:noop,fitCanvas:noop,
  closeAll:noop,onBoardClick:noop,onBoardPointerDown:noop,onBoardPointerMove:noop,onBoardPointerUp:noop,onBoardPointerCancel:noop,
  onGameEnd:noop,onGameEndDraw:noop,handleDrawOffer:noop,addChatMessage:noop,setupClock:noop});
 const names=['doMove','sendMoveOnline','showPromotion','finishMove','applyAndContinue','onRemoteMessage','showConfirm','beginChessOutcome','startGame','showOnlineLobby','openChess','showFENLoader'];
 vm.runInContext(names.map(fn).join('\n').replace("import('../game-home.js')","Promise.resolve({mountGameHome:()=>({})})")+
  '\nthis.qa={doMove,finishMove,onRemoteMessage,showConfirm,beginChessOutcome,startGame,showOnlineLobby,openChess,showFENLoader};',c);
 return {c,G,root,elements,overlays,sent,raf,timers,...c.qa};
}
const e4={from:{r:6,c:4},to:{r:4,c:4}},d4={from:{r:6,c:3},to:{r:4,c:3}};
let failures=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,'\n'+e.message);}}

test('promotion is one pending move and a choice can send only once',()=>{
 const h=harness(engine.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1'));
 const move=engine.resolveLegalMove(h.G.state,{from:{r:1,c:0},to:{r:0,c:0}});
 h.doMove(move);h.doMove(move);
 assert.equal(h.overlays.filter(o=>!o.removed).length,1,'rapid requests create only one promotion panel');
 const buttons=h.overlays[0].querySelectorAll('.cp-btn');buttons[3].click();buttons[0].click();
 assert.equal(h.sent.length,1,'double queued choice cannot send two promotion variants');
 assert.equal(h.sent[0].move.promotion,'n');assert.equal(h.raf.length,1);
 h.raf.shift()(250);assert.equal(h.G.state.board[0][0].t,'n');assert.equal(h.G.moveHistory.length,1);
});

test('ordinary and remote moves cannot overwrite an in-flight animation',()=>{
 for(const remote of [false,true]){
  const h=harness();if(remote)h.G.playerColor='b';
  if(remote){h.onRemoteMessage({type:'move',move:e4});h.onRemoteMessage({type:'move',move:d4});}
  else{h.doMove(e4);h.doMove(d4);}
  assert.equal(h.raf.length,1,'one animation owns the current position');
  assert.equal(h.G.anim.to.c,4,'the visible destination matches the committed move');
  h.raf.shift()(250);assert.equal(h.G.state.board[4][4]?.t,'p');assert.equal(h.G.state.board[6][3]?.t,'p');
  assert.equal(h.G.moveHistory.length,1);assert.equal(h.sent.length,remote?0:1);
 }
});

test('finished, out-of-turn and stale local moves are inert',()=>{
 for(const condition of ['ended','otherTurn','stale']){
  const h=harness();if(condition==='ended')h.G.gameEnded=true;
  if(condition==='otherTurn')h.G.playerColor='b';
  if(condition==='stale')h.G.state=engine.applyMove(h.G.state,engine.resolveLegalMove(h.G.state,e4));
  const before=engine.toFEN(h.G.state);h.doMove(e4);
  assert.equal(h.sent.length,0,condition);assert.equal(h.raf.length,0,condition);assert.equal(engine.toFEN(h.G.state),before);
 }
});

test('generic confirmation is unique and cannot act on a replacement position',()=>{
 const h=harness();let actions=0;
 h.showConfirm('resign',()=>actions++);h.showConfirm('resign',()=>actions++);
 assert.equal(h.overlays.filter(o=>!o.removed).length,1,'rapid clicks do not stack confirmations');
 const button=h.overlays[0].querySelector('.ccf-yes');h.G.state=engine.newGame();button.click();
 assert.equal(actions,0,'stale resignation must not end a restarted game');
 h.showConfirm('draw',()=>actions++);const fresh=h.overlays.at(-1).querySelector('.ccf-yes');fresh.click();fresh.click();
 assert.equal(actions,1,'a queued second activation is inert');
});

test('ending a game removes promotion and makes its queued choice inert',()=>{
 const h=harness(engine.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1'));
 h.doMove(engine.resolveLegalMove(h.G.state,{from:{r:1,c:0},to:{r:0,c:0}}));
 const button=h.overlays[0].querySelectorAll('.cp-btn')[0];h.beginChessOutcome();
 assert.equal(h.overlays.filter(o=>!o.removed).length,0,'time expiry clears the blocking promotion panel');
 button.click();assert.equal(h.sent.length,0);assert.equal(h.raf.length,0);
});

test('restart clears held pieces and all pending move/confirmation panels',()=>{
 const h=harness();h.startGame(h.root,'local',{});
 h.G.state=engine.fromFEN('7k/P7/8/8/8/8/8/7K w - - 0 1');
 h.doMove(engine.resolveLegalMove(h.G.state,{from:{r:1,c:0},to:{r:0,c:0}}));
 h.showConfirm('resign',noop);h.G._drag={from:{r:1,c:0},moved:true};h.G._dragJustEnded=true;
 h.root.querySelector('[data-el="game"]').querySelector('[data-act="restart"]').click();
 assert.equal(h.overlays.filter(o=>!o.removed).length,0);
 assert.equal(h.G._drag,null);assert.equal(h.G._dragJustEnded,false);assert.equal(h.G.promotionPending,null);
 assert.equal(engine.toFEN(h.G.state),engine.toFEN(engine.newGame()));
});

test('direct duplicate open preserves the existing chess surface',()=>{
 const h=harness();h.G.root.isConnected=true;
 h.openChess();assert.ok(h.c.G===h.G,'direct re-open preserves the current game object');assert.equal(h.overlays.length,0);
});

test('FEN loader cannot stack, overlap another action or act after restart',()=>{
 const h=harness();h.startGame(h.root,'local',{});h.showFENLoader();h.showFENLoader();h.showConfirm('resign',noop);
 assert.equal(h.overlays.filter(o=>!o.removed).length,1,'one position dialog owns input');
 const ov=h.overlays[0];ov.querySelector('[data-el="fenInput"]').value='7k/8/6K1/8/8/8/8/R7 w - - 0 1';
 h.doMove(e4);assert.equal(h.sent.length,0);assert.equal(h.raf.length,0);
 h.root.querySelector('[data-el="game"]').querySelector('[data-act="restart"]').click();
 ov.querySelector('.ccf-yes').click();assert.equal(engine.toFEN(h.G.state),engine.toFEN(engine.newGame()));
});

try{
 const h=harness(),calls=[];let release;
 h.c.shareRoomCode=(...args)=>{calls.push(args);return new Promise(r=>release=r);};
 h.showOnlineLobby(h.root);const ov=h.overlays[0],btn=ov.querySelector('[data-act="share"]');
 ov.querySelector('[data-el="code"]').textContent='ABC123';
 const first=btn.click({currentTarget:btn});await btn.click({currentTarget:btn});
 assert.equal(calls.length,1,'native share cannot be opened twice while pending');assert.equal(btn.disabled,true);
 assert.deepEqual(Array.from(calls[0]),['chess','ABC123']);release('copied');await first;
 assert.equal(btn.textContent,'✅ KOD KOPYALANDI');assert.equal(btn.disabled,false);
 const reset=h.timers.at(-1),second=btn.click({currentTarget:btn});
 assert.equal(h.timers.includes(reset),false,'a previous feedback timer cannot reset a new pending share');
 release('shared');await second;assert.equal(btn.textContent,'✅ PAYLAŞILDI');
 console.log('PASS room share uses the shared native helper once and reports clipboard fallback truthfully');
}catch(e){failures++;console.error('FAIL room share integration\n'+e.stack);}

if(failures)process.exitCode=1;
