// Real-controller fault, replay and hit-geometry checks for v156 board work.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as chess from '../js/games/chess-engine.js';
import * as tavla from '../js/games/tavla-engine.js';
import {chooseMove} from '../js/games/chess-ai.js';
const sources=Object.fromEntries(['chess','tavla'].map(game=>[game,fs.readFileSync(new URL('../js/games/'+game+'.js',import.meta.url),'utf8')]));
function fn(game,name){
 const source=sources[game],match=new RegExp(`^(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(match,name);
 const rest=source.slice(match.index),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));return end?rest.slice(0,end.index+1):rest;
}
const noop=()=>{};
const clone=value=>JSON.parse(JSON.stringify(value));
function context(game,names,extra={}){
 const c=vm.createContext({...game==='chess'?chess:tavla,console,JSON,Date,Math,globalThis:{crypto:{randomUUID:()=>String(Math.random()).slice(2)}},
 Auth:{getState:()=>({uid:'a'})},draw:noop,updateTurn:noop,updateStatus:noop,updateControls:noop,updateCaptured:noop,updateClockDisplay:noop,
 clearAIGame:noop,clearBreakTimers:noop,clearMoveGrace:noop,clearAutoRollTimer:noop,saveAIGame:noop,maybeAITurn:noop,afterTurn:noop,
 setTimeout:noop,clearTimeout:noop,cancelAnimationFrame:noop,Sound:new Proxy({},{get:()=>noop}),TavlaMP:{connected:true,send:()=>true},
 G:{state:game==='chess'?chess.newGame():tavla.newGame(),mode:'ai',playerColor:'w',moveHistory:[],flip:false,root:{querySelector:()=>null}},
 SELECTED_THEME:'kizil',THEMES:{kizil:{frame:'#d4af37',bg:'#2a0a10',felt:'#7a1420',bar:'#5c0c14',pointA:'#a81c2c',pointB:'#f0e0c0'}},
 ...extra});
 vm.runInContext(names.map(name=>fn(game,name)).join('\n').replaceAll("import('../reward.js')",'Promise.resolve(rewardFixture)')+'\nthis.api={'+names.join(',')+'};',c);return c;
}
let passed=0,failed=0;
async function test(name,run){try{await run();passed++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
const hintMove={from:{r:6,c:4},to:{r:4,c:4}};
function hintHarness(consume){const calls=[],statuses=[];const c=context('chess',['requestChessHint'],{chooseMove:()=>hintMove,Store:{getItemCount:()=>2,useItem:async(...args)=>{calls.push(args);return consume(...args);}},updateStatus:text=>statuses.push(text)});return{c,button:{disabled:false},calls,statuses};}
await test('hint requires a confirmed inventory debit and retains a stable retry id',async()=>{
 let acknowledged=false;const h=hintHarness(()=>acknowledged);
 await h.c.api.requestChessHint(h.button);assert.equal(h.c.G.hintSquares,undefined);assert.equal(h.button.disabled,false);assert.equal(h.calls[0][1],'a');assert.ok(h.calls[0][2]);
 acknowledged=true;h.c.Store.getItemCount=()=>0;await h.c.api.requestChessHint(h.button);assert.equal(h.calls[0][2],h.calls[1][2]);assert.ok(h.c.G.hintSquares);assert.equal(h.c.G._hintOperationId,null);
});
await test('hint cannot reveal a result after board, game or account replacement',async()=>{
 for(const change of ['board','game','account']){let release,uid='a';const h=hintHarness(()=>new Promise(resolve=>release=resolve));h.c.Auth={getState:()=>({uid})};const old=h.c.G;
 const pending=h.c.api.requestChessHint(h.button);if(change==='board')h.c.G.state=chess.newGame();else if(change==='game')h.c.G={...old,state:chess.newGame()};else uid='b';release(true);await pending;
 assert.equal(h.c.G.hintSquares,undefined,change);assert.equal(h.button.disabled,false,change);assert.equal(old._hintPending,false,change);}
});
await test('rapid hint requests consume once and failure always releases the control',async()=>{
 let release;const h=hintHarness(()=>new Promise(resolve=>release=resolve));const first=h.c.api.requestChessHint(h.button);await h.c.api.requestChessHint(h.button);assert.equal(h.calls.length,1);release(false);await first;assert.equal(h.button.disabled,false);
 const rejected=hintHarness(()=>Promise.reject(new Error('offline')));await rejected.c.api.requestChessHint(rejected.button);assert.equal(rejected.button.disabled,false);assert.equal(rejected.c.G.hintSquares,undefined);
});
await test('a hint cannot debit a different account from the match owner',async()=>{
 const h=hintHarness(()=>true);h.c.G._reviewUid='other';await h.c.api.requestChessHint(h.button);assert.equal(h.calls.length,0);
});
await test('chess snapshots preserve initial board, actual FEN and immutable last move within the cap',()=>{
 const c=context('chess',['resetChessReview','captureChessFrame']);c.api.resetChessReview('Start');const first=c.G._reviewFrames[0].fen;
 c.G.state=chess.applyMove(c.G.state,chess.resolveLegalMove(c.G.state,hintMove));c.G.moveHistory.push({notation:'e4'});c.G.lastMove=clone(hintMove);c.api.captureChessFrame('e4');const frame=c.G._reviewFrames[1];
 c.G.lastMove.to.c=1;assert.equal(frame.lastMove.to.c,4);assert.equal(frame.fen,chess.toFEN(c.G.state));
 for(let i=0;i<140;i++)c.api.captureChessFrame('frame '+i);assert.equal(c.G._reviewFrames.length,100);assert.equal(c.G._reviewFrames[0].fen,first);assert.equal(c.G._reviewFrames.at(-1).label,'frame 139');
});
await test('chess archive is recorded once for its owner and alternatives come from its recorded legal position',()=>{
 const records=[];const c=context('chess',['resetChessReview','captureChessFrame','finishChessReview'],{chooseMove,recordGameReview:spec=>{records.push(clone(spec));return{...spec,id:'saved'};}});
 c.api.resetChessReview('Start');for(let i=0;i<3;i++){const m=chess.allLegalMoves(c.G.state)[i];c.G.state=chess.applyMove(c.G.state,m);c.G.moveHistory.push({notation:'move'});c.api.captureChessFrame('move');}
 const a=c.api.finishChessReview('Kazandın'),b=c.api.finishChessReview('again');assert.equal(a,b);assert.equal(records.length,1);assert.ok(records[0].insights.some(n=>n.includes('yasal hamle')));
 c.G._reviewSaved=null;c.Auth={getState:()=>({uid:'b'})};assert.equal(c.api.finishChessReview('other'),null);assert.equal(records.length,1);
});
await test('tavla snapshots deeply isolate points, bar, dice and used values with initial frame preserved',()=>{
 const c=context('tavla',['resetTavlaReview','captureTavlaFrame']);c.api.resetTavlaReview('Opening');const initial=clone(c.G._reviewFrames[0]);
 c.G.state.dice=[6,5];c.api.captureTavlaFrame(null,'Rolled');const roll=c.G._reviewFrames[1];c.G.state.used.push(0);c.G.state.bar.w=2;c.G.state.points[0]=9;
 assert.deepEqual(clone(roll.state.used),[]);assert.equal(roll.state.bar.w,0);assert.deepEqual(clone(initial.state),tavla.newGame());
 for(let i=0;i<120;i++)c.api.captureTavlaFrame(null,'frame '+i);assert.equal(c.G._reviewFrames.length,100);assert.equal(c.G._reviewFrames[0].label,'Opening');assert.equal(c.G._reviewFrames.at(-1).label,'frame 119');
});
await test('tavla undo truncates review by move sequence even after the capped buffer fills',()=>{
 const c=context('tavla',['resetTavlaReview','captureTavlaFrame','undoMove']);c.api.resetTavlaReview('Opening');c.G.undoStack=[];for(let i=0;i<110;i++)c.api.captureTavlaFrame(null,'frame '+i);
 const snap={state:clone(c.G.state),reviewStep:c.G._reviewStep};c.G.undoStack.push(snap);c.api.captureTavlaFrame({from:0,to:1,die:1});assert.equal(c.G._reviewFrames.at(-1).step,snap.reviewStep);
 c.api.undoMove();assert.ok(c.G._reviewFrames.every(f=>f.step<snap.reviewStep));assert.equal(c.G._reviewStep,snap.reviewStep);
});
await test('tavla analysis uses actual engine candidates without mutating the final board',()=>{
 const records=[];const c=context('tavla',['resetTavlaReview','captureTavlaFrame','finishTavlaReview'],{recordGameReview:spec=>{records.push(clone(spec));return spec;}});c.api.resetTavlaReview('Opening');c.G.state.dice=[6,5];c.api.captureTavlaFrame(null,'Rolled');const state=clone(c.G.state);
 c.api.finishTavlaReview('Done');assert.deepEqual(clone(c.G.state),state);assert.equal(records.length,1);assert.ok(records[0].insights.some(n=>n.includes('yasal aday')));c.api.finishTavlaReview('again');assert.equal(records.length,1);
});
await test('both review renderers produce accessible SVG using only the saved frame and escape labels',()=>{
 for(const game of ['chess','tavla']){
  const c=context(game,['renderReviewFrame']);if(game==='chess'){const start=sources.chess.indexOf('const CHESS_PIECE_PATHS ='),end=sources.chess.indexOf('\nfunction drawPieceAt',start);vm.runInContext(sources.chess.slice(start,end),c);}
  const host={},frame=game==='chess'?{fen:chess.toFEN(chess.newGame()),flip:false,label:'<script>"&'}:{state:tavla.newGame(),flip:false,label:'<script>"&',theme:'kizil'};const before=clone(c.G);c.G=new Proxy({},{get(){throw new Error('live G read during replay');},set(){throw new Error('live G changed during replay');}});
  c.api.renderReviewFrame(frame,host);assert.match(host.innerHTML,/<svg/);assert.match(host.innerHTML,/role="img"/);assert.doesNotMatch(host.innerHTML,/<script>/);assert.match(host.innerHTML,/&lt;script&gt;&quot;&amp;/);assert.match(host.innerHTML,/<path/);assert.ok(before.state);
  assert.throws(()=>c.api.renderReviewFrame(game==='chess'?{fen:'junk'}:{state:{}},{}),/Geçersiz/);
 }
});
await test('tavla connection failure preserves the board and never implies a winner',()=>{
 const statuses=[];const c=context('tavla',['onRemoteMessage','doMove'],{updateStatus:(...args)=>statuses.push(args)});c.G.online=true;c.G.rolled=true;c.G.state.dice=[6,5];const before=clone(c.G.state);c.api.onRemoteMessage('reconnect_failed');assert.notEqual(c.G.gameEnded,true);assert.equal(c.G._syncPending,true);assert.equal(c.G.oppLeft,true);assert.ok(statuses.every(([,kind])=>kind!=='win'));
 c.api.doMove(tavla.allLegalMoves(c.G.state)[0]);assert.deepEqual(clone(c.G.state),before);
});
await test('completed tavla uses 50×win type for a winner and 15 for a loss; UI displays confirmed amounts',async()=>{
 for(const playerColor of ['w','b']){
  const writes=[],rewards=[],c=context('tavla',['onWin'],{Store:{recordMatchResult:async()=>true,trackQuestEvent:(...a)=>writes.push(['quest',...a]),addKaju:async n=>{writes.push(['kaju',n]);return 3;},awardXP:async(n,uid)=>{writes.push(['xp',n,uid]);return{ok:true,amount:7};}},rewardFixture:{showReward:async r=>rewards.push(r)}});
  c.G.playerColor=playerColor;c.G._turnToken={};c.G._reviewUid='a';c.G.state.points=c.G.state.points.map(n=>n>0?0:n);c.G.state.off.w=15;const wt=tavla.winType(c.G.state,'w');await c.api.onWin('white_wins');await c.api.onWin('white_wins');
  assert.equal(writes.find(r=>r[0]==='kaju')[1],playerColor==='w'?50*wt:15);assert.equal(rewards.length,1);assert.equal(rewards[0].kaju,3);assert.equal(rewards[0].xp,7);assert.equal(rewards[0].questEventsHandled,true);assert.equal(writes.filter(r=>r[0]==='quest'&&r[1]==='game_played').length,1);assert.equal(writes.filter(r=>r[0]==='quest'&&r[1]==='game_won').length,playerColor==='w'?1:0);
 }
});
await test('completed chess displays actual zero/capped Kaju and confirmed XP, with draw quest tracking',async()=>{
 const rewards=[],quests=[],c=context('chess',['beginChessOutcome','onGameEndDraw'],{stopClockTick:noop,Resume:{clearSnapshot:noop},Store:{recordMatchResult:async()=>true,trackQuestEvent:(...args)=>quests.push(args),addKaju:async()=>0,awardXP:async()=>({ok:true,amount:9})},rewardFixture:{showReward:async r=>rewards.push(r)}});
 await c.api.onGameEndDraw();assert.equal(rewards.length,1);assert.equal(rewards[0].kaju,0);assert.equal(rewards[0].xp,9);assert.equal(rewards[0].questEventsHandled,true);assert.equal(quests[0][0],'game_played');assert.equal(quests.length,1);
});
await test('old match owner cannot receive writes after account replacement at outcome entry',async()=>{
 const writes=[],c=context('chess',['beginChessOutcome','onGameEnd'],{Auth:{getState:()=>({uid:'b'})},Store:{recordMatchResult:async()=>writes.push('record')}});c.G._reviewUid='a';await c.api.onGameEnd(true);assert.deepEqual(writes,[]);
});
await test('chess hit centers map to every logical square at mobile, desktop and landscape dimensions, both flips',()=>{
 for(const [width,height] of [[308,430],[348,490],[636,600],[330,240]])for(const flip of [false,true]){
  const c=context('chess',['fitCanvas','boardMargin','cellXY','xyToCell'],{window:{innerWidth:width,devicePixelRatio:2}});c.G.boardWrap={clientWidth:width,clientHeight:height};c.G.canvas={style:{}};c.G.ctx={setTransform:noop};c.G.flip=flip;c.api.fitCanvas();assert.ok(c.G.boardPx<=width&&c.G.boardPx<=height);assert.ok(c.G.cell>0);
  for(let r=0;r<8;r++)for(let col=0;col<8;col++){const pt=c.api.cellXY(r,col),sq=c.api.xyToCell(pt.x+c.G.cell/2,pt.y+c.G.cell/2);assert.deepEqual(clone(sq),{r,c:col});}assert.equal(c.api.xyToCell(0,0),null);
 }
});
await test('tavla hit centers preserve 24 points, bar and collection gutter on narrow and landscape boards, both flips',()=>{
 for(const [width,height] of [[308,440],[348,500],[696,730],[300,230]])for(const flip of [false,true]){
  const c=context('tavla',['fitCanvas','computeLayout','pointGeometry','hitTest'],{window:{innerWidth:width,innerHeight:height,devicePixelRatio:2}});c.G.boardWrap={clientWidth:width,clientHeight:height};c.G.canvas={style:{}};c.G.ctx={setTransform:noop};c.G.flip=flip;c.api.fitCanvas();assert.ok(c.G.W<=width&&c.G.H<=height);const g=c.G.geo;
  for(let i=0;i<24;i++){const p=c.api.pointGeometry(i),y=p.top?g.innerY+g.innerH*.1:g.innerY+g.innerH*.9;assert.equal(c.api.hitTest(p.baseX,y),i);assert.ok(p.baseX-g.checkerR>=g.innerX-1&&p.baseX+g.checkerR<=g.bearX+1);}assert.equal(c.api.hitTest(g.barX+g.barW/2,height/2),'bar');assert.equal(c.api.hitTest(g.bearX+g.bearW/2,height/2),'off');
 }
});
await test('portal minimization changes only presentation and restores measured canvas without ending either match',()=>{
 for(const game of ['chess','tavla']){let fitted=0,drawn=0;const c=context(game,['setPortalMinimized'],{fitCanvas:()=>fitted++,draw:()=>drawn++});c.G.root={style:{}};c.G.clock={w:60,b:60};const state=c.G.state,clock=c.G.clock;c.api.setPortalMinimized(true);assert.equal(c.G.root.inert,true);assert.equal(c.G.root.hidden,true);assert.equal(c.G.state,state);assert.equal(c.G.clock,clock);assert.notEqual(c.G.gameEnded,true);c.api.setPortalMinimized(false);assert.equal(c.G.root.inert,false);assert.equal(c.G.root.hidden,false);assert.equal(fitted,1);assert.equal(drawn,1);}
});
await test('a delayed tavla draw cannot open its old review over a restarted match',async()=>{
 let release;const rewards=[],c=context('tavla',['finishTavlaDraw'],{finishTavlaReview:()=>({id:'old'}),Store:{trackQuestEvent:noop,recordMatchResult:()=>new Promise(r=>release=r)},rewardFixture:{showReward:async r=>rewards.push(r)}});c.G._turnToken={};c.G.gameEnded=true;c.G._reviewUid='a';const pending=c.api.finishTavlaDraw();c.G._turnToken={};release();await pending;assert.equal(rewards.length,0);
});
console.log(`${passed} passed, ${failed} failed`);if(failed)process.exitCode=1;
