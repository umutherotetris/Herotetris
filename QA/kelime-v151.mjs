// Real controller input/modal lifecycle; DOM, audio and account boundaries are inert.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/kelime-engine.js';
const raw=process.env.KELIME_V151_SOURCE_REF?execFileSync('git',['show',process.env.KELIME_V151_SOURCE_REF+':js/games/kelime.js'],{encoding:'utf8'}):fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const source=raw.replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export (?=(?:async )?function )/gm,'');
const noop=()=>{},tile=letter=>({letter,points:engine.letterPoints(letter),joker:false});
function el(){
 const classes=new Set(),children=new Map(),events={};
 return {innerHTML:'',style:{},dataset:{},events,removed:false,isConnected:true,
 classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:noop},
 remove(){this.removed=true;},appendChild:noop,contains:()=>true,
 addEventListener:(name,fn)=>events[name]=fn,removeEventListener:noop,
 querySelector(s){if(!children.has(s))children.set(s,el());return children.get(s);},
 querySelectorAll(s){return s==='.kl-jk'?[...this.innerHTML.matchAll(/data-l="([^"]+)"/g)].map(m=>{const b=this.querySelector(m[1]);b.dataset.l=m[1];return b;}):[];}};
}
function harness(){
 const root=el(),created=[],timers=[],listeners=new Map();
 const G={root,_setupToken:{},online:false,ai:null,_over:false,who:'A',role:'A',names:{A:'A',B:'B'},
 state:{board:Array.from({length:15},()=>Array(15).fill(null)),bag:Array.from({length:20},()=>tile('E')),racks:{A:[tile('A'),tile('Z')],B:[tile('B')]},scores:{A:0,B:0},passStreak:0},
 rackView:[tile('A'),tile('Z')],pending:[],selected:null,surprises:{},bestWord:{score:0},lastMoveCells:new Set()};
 const c=vm.createContext({...engine,console,window:{addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)},
 document:{createElement:()=>{const x=el();created.push(x);return x;},addEventListener:noop,removeEventListener:noop,body:{appendChild:noop}},navigator:{},
 localStorage:{getItem:()=>null,setItem:noop},Resume:{clearSnapshot:noop,loadSnapshot:()=>null,saveSnapshot:noop},
 setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:noop,setInterval:fn=>{timers.push(fn);return timers.length;},clearInterval:noop});
 vm.runInContext(source+`\nthis.qa={set:s=>G=s,get:()=>G,onRackPointerDown,onRackPointerMove,onRackPointerUp,onPendingPointerDown,onPendingPointerMove,onPendingPointerUp,onCellTap,placeTile,pickJokerLetter,startLocal,performExchange,buildGameDOM,openKelime,startTurnTimer};`,c);
 for(const name of ['renderAll','renderScores','renderRack','flashStatus','sndPick','sndPlace','haptic','sndErr','bindZoomDock','bindBoardDoubleTap','applyZoom','_injectKelimeHUD','updateExchangeBtn','nextTurn'])c[name]=noop;
 c.cellUnder=()=>({dataset:{r:'4',c:'4'}});c.rawCellUnder=()=>({r:4,c:4});c.highlightDrop=noop;c.clearDropHighlight=noop;c.rackTileEl=()=>el();
 c.qa.set(G);return {G,c,created,timers,listeners,...c.qa};
}
const event=(type='pointerup',id=1,x=20)=>({type,pointerId:id,button:0,clientX:x,clientY:20,preventDefault:noop,stopPropagation:noop});
let failed=0;function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.message);}}
test('cancelled rack drag neither selects nor places a tile',()=>{
 const h=harness();h.onRackPointerDown(event('pointerdown',1,0),0,h.G.rackView[0]);h.onRackPointerMove(event('pointermove'));h.onRackPointerUp(event('pointercancel'));
 assert.equal(h.G.pending.length,0);assert.equal(h.G.rackView.length,2);assert.equal(h.G.selected,null);
});
test('cancelled pending drag leaves its original square intact',()=>{
 const h=harness();h.G.pending=[{r:3,c:3,...tile('A')}];h.onPendingPointerDown(event('pointerdown',1,0),3,3);h.onPendingPointerMove(event('pointermove'));h.onPendingPointerUp(event('pointercancel'));
 assert.equal(h.G.pending[0]?.r,3);assert.equal(h.G.pending[0]?.c,3);assert.equal(h.G.rackView.length,2);
});
test('a second pointer cannot finish a held rack gesture',()=>{
 const h=harness();h.onRackPointerDown(event('pointerdown',1,0),0,h.G.rackView[0]);h.onRackPointerMove(event('pointermove'));h.onRackPointerUp(event('pointerup',2));
 assert.equal(h.G.pending.length,0);h.onRackPointerUp(event('pointerup',1));assert.equal(h.G.pending.length,1);
});
test('a shuffled or replaced rack cannot place a different tile under an old drag',()=>{
 const h=harness();h.onRackPointerDown(event('pointerdown',1,0),0,h.G.rackView[0]);h.onRackPointerMove(event('pointermove'));h.G.rackView.reverse();h.onRackPointerUp(event());
 assert.equal(h.G.pending.length,0);assert.equal(h.G.rackView.length,2);
});
test('held rack and pending gestures cannot mutate a replacement round',()=>{
 for(const pending of [false,true]){
  const h=harness();if(pending){h.G.pending=[{r:3,c:3,...tile('A')}];h.onPendingPointerDown(event('pointerdown',1,0),3,3);h.onPendingPointerMove(event('pointermove'));}
  else{h.onRackPointerDown(event('pointerdown',1,0),0,h.G.rackView[0]);h.onRackPointerMove(event('pointermove'));}
  h.G._setupToken={};h.G.pending=[{r:3,c:3,...tile('Z')}];const before=JSON.stringify({p:h.G.pending,r:h.G.rackView});
  (pending?h.onPendingPointerUp:h.onRackPointerUp)(event());assert.equal(JSON.stringify({p:h.G.pending,r:h.G.rackView}),before);
 }
});
test('one joker produces one chooser and one physical placement',()=>{
 const h=harness();h.G.rackView=[{letter:'',points:0,joker:true},tile('Z')];h.G.selected=0;h.onCellTap(7,7);h.onCellTap(7,8);
 const pickers=h.created.filter(x=>x.innerHTML.includes('kl-jokergrid'));assert.equal(pickers.length,1,'rapid taps cannot stack joker choosers');
 const button=pickers[0].querySelector('A');button.events.click();button.events.click();
 assert.equal(h.G.pending.length,1);assert.equal(h.G.rackView.length,1);assert.equal(h.G.rackView[0].letter,'Z');
});
test('a stale joker choice cannot affect a new round or occupied square',()=>{
 for(const kind of ['round','board','over']){
  const h=harness();h.G.rackView=[{letter:'',points:0,joker:true},tile('Z')];h.G.selected=0;h.onCellTap(7,7);const picker=h.created.find(x=>x.innerHTML.includes('kl-jokergrid'));
  if(kind==='round')h.G._setupToken={};if(kind==='board')h.G.state.board[7][7]=tile('A');if(kind==='over')h.G._over=true;
  picker.querySelector('A').events.click();assert.equal(h.G.pending.length,0,kind);assert.equal(h.G.rackView.length,2,kind);
 }
});
test('replay resets an exchange lock whose old-round timer was invalidated',()=>{
 const h=harness();h.performExchange([0]);assert.equal(h.G._exchanging,true);h.startLocal();
 assert.equal(h.G._exchanging,false);assert.equal(h.G.exchangeMode,false);assert.equal(h.G.exchangeSel,null);
 const before=h.G.state.bag.length;h.performExchange([0]);assert.equal(h.G.state.bag.length,before,'a fresh exchange still conserves bag size');assert.equal(h.G._exchanging,true);
});
test('the timed counter cannot start for an AI turn',()=>{
 const h=harness();h.G.seri={turnTime:30};h.G.who='B';h.G.aiThinking=true;h.startTurnTimer();assert.equal(h.G.timer,undefined);
});
test('opening Kelime twice preserves the active board and root',()=>{
 const h=harness(),original=h.G;h.openKelime();h.openKelime();assert.equal(h.get(),original);assert.equal(h.created.length,0);
});
if(failed)process.exitCode=1;
