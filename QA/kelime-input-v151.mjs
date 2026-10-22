// Exercise the real touch and joker handlers without a browser or production writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const handlers=source.slice(source.indexOf('let _drag = null;'),source.indexOf('function pickJokerLetter('));
assert.ok(handlers.includes('function onPendingPointerUp('));
const noop=()=>{};
function fixture(){
  const tileEl={classList:{add:noop,remove:noop},style:{}};
  const listeners=new Map(),scheduled=[];
  const root={appendChild:noop,contains:()=>true,querySelectorAll:()=>[],querySelector:sel=>sel==='[data-el="rack"]'?{querySelectorAll:()=>[tileEl,tileEl]}:tileEl};
  const make=()=>({_setupToken:{},root,rackView:[{letter:'A',points:1,joker:false},{letter:'B',points:3,joker:false}],pending:[],state:{board:Array.from({length:15},()=>Array(15).fill(null))},selected:null});
  const c=vm.createContext({G:make(),SIZE:15,window:{addEventListener:(type,cb)=>listeners.set(type,cb),removeEventListener:type=>listeners.delete(type)},document:{createElement:()=>({style:{},remove:noop}),elementFromPoint:()=>({closest:()=>({dataset:{r:'7',c:'7'},classList:{add:noop,remove:noop}})})},renderRack:noop,renderAll:noop,sndPick:noop,sndPlace:noop,haptic:noop,flashStatus:noop,showWordMeaning:noop,klT:()=>'',afterGame:cb=>scheduled.push(cb)});
  c.pickJokerLetter=cb=>{c.chooseJoker=cb;};
  vm.runInContext(handlers,c);
  const event=(type='pointerup',pointerId=1,x=0)=>({type,pointerId,button:0,clientX:x,clientY:0,preventDefault:noop,stopPropagation:noop});
  const down=()=>c.onRackPointerDown(event('pointerdown'),0,c.G.rackView[0]);
  const pending=()=>{const tile={r:6,c:6,letter:'A',points:1,joker:false};c.G.pending=[tile];return tile;};
  return {c,make,event,down,pending,listeners};
}
const cases=[];const test=(name,run)=>cases.push([name,run]);
test('valid rack tap and drag retain their existing behavior',()=>{
  const f=fixture();f.down();f.c.onRackPointerUp(f.event());assert.equal(f.c.G.selected,0);
  f.down();f.c.onRackPointerMove(f.event('pointermove',1,20));f.c.onRackPointerUp(f.event('pointerup',1,20));
  assert.equal(f.c.G.rackView.length,1);assert.equal(f.c.G.pending.length,1);assert.equal(f.c.G.pending[0].r,7);
});
test('cancelled rack tap and drag preserve every tile and selection',()=>{
  for(const moved of [false,true]){const f=fixture();f.down();if(moved)f.c.onRackPointerMove(f.event('pointermove',1,20));const before=JSON.stringify(f.c.G);f.c.onRackPointerUp(f.event('pointercancel',1,20));assert.equal(JSON.stringify(f.c.G),before);assert.equal(f.listeners.size,0);}
});
test('a second pointer cannot replace or release a rack gesture',()=>{
  const f=fixture();f.down();f.c.onRackPointerDown(f.event('pointerdown',2),1,f.c.G.rackView[1]);f.c.onRackPointerUp(f.event('pointerup',2));assert.equal(f.c.G.selected,null);assert.equal(f.listeners.size,3);f.c.onRackPointerUp(f.event());assert.equal(f.c.G.selected,0);
});
test('old rack gesture cannot select or place a replacement game tile',()=>{
  for(const replace of [false,true]){const f=fixture();f.down();f.c.onRackPointerMove(f.event('pointermove',1,20));if(replace)f.c.G=f.make();else f.c.G._setupToken={};const before=JSON.stringify(f.c.G);f.c.onRackPointerUp(f.event('pointerup',1,20));assert.equal(JSON.stringify(f.c.G),before);}
});
test('a changed rack entry invalidates the held tile instead of playing its replacement',()=>{
  const f=fixture();f.down();f.c.G.rackView[0]={letter:'Z',points:10,joker:false};const before=JSON.stringify(f.c.G);f.c.onRackPointerMove(f.event('pointermove',1,20));f.c.onRackPointerUp(f.event('pointerup',1,20));assert.equal(JSON.stringify(f.c.G),before);assert.equal(f.listeners.size,0);
});
test('cancelled pending tap and drag keep the preview in place',()=>{
  for(const moved of [false,true]){const f=fixture();f.pending();f.c.onPendingPointerDown(f.event('pointerdown'),6,6);if(moved)f.c.onPendingPointerMove(f.event('pointermove',1,20));const before=JSON.stringify(f.c.G);f.c.onPendingPointerUp(f.event('pointercancel',1,20));assert.equal(JSON.stringify(f.c.G),before);assert.equal(f.listeners.size,0);}
});
test('pending gesture binds its game, round, pointer and actual tile',()=>{
  for(const change of ['game','round','tile']){const f=fixture();f.pending();f.c.onPendingPointerDown(f.event('pointerdown'),6,6);if(change==='game'){f.c.G=f.make();f.pending();}else if(change==='round')f.c.G._setupToken={};else f.c.G.pending=[{...f.c.G.pending[0]}];const before=JSON.stringify(f.c.G);f.c.onPendingPointerMove(f.event('pointermove',2,20));f.c.onPendingPointerUp(f.event('pointerup',2,20));assert.equal(JSON.stringify(f.c.G),before);f.c.onPendingPointerUp(f.event('pointerup',1,20));assert.equal(JSON.stringify(f.c.G),before);}
});
test('valid pending tap recalls its tile and valid drag moves it once',()=>{
  const f=fixture();f.pending();f.c.onPendingPointerDown(f.event('pointerdown'),6,6);f.c.onPendingPointerMove(f.event('pointermove',1,20));f.c.onPendingPointerUp(f.event('pointerup',1,20));assert.equal(f.c.G.pending[0].r,7);assert.equal(f.c.G.pending[0].c,7);
  f.c.onPendingPointerDown(f.event('pointerdown'),7,7);f.c.onPendingPointerUp(f.event());assert.equal(f.c.G.pending.length,0);assert.equal(f.c.G.rackView.length,3);
});
test('joker resolution requires the original session, round, selection and rack tile',()=>{
  for(const change of ['game','round','selection','tile']){const f=fixture();f.c.G.rackView[0]={letter:'',points:0,joker:true};f.c.G.selected=0;f.c.onCellTap(7,7);assert.ok(f.c.chooseJoker);if(change==='game')f.c.G=f.make();else if(change==='round')f.c.G._setupToken={};else if(change==='selection')f.c.G.selected=1;else f.c.G.rackView[0]={letter:'',points:0,joker:true};const before=JSON.stringify(f.c.G);f.c.chooseJoker('A');assert.equal(JSON.stringify(f.c.G),before);}
});
test('joker cannot occupy a newly filled or newly previewed square',()=>{
  for(const occupied of ['board','pending']){const f=fixture();f.c.G.rackView[0]={letter:'',points:0,joker:true};f.c.G.selected=0;f.c.onCellTap(7,7);if(occupied==='board')f.c.G.state.board[7][7]={letter:'B',points:3,joker:false};else f.c.G.pending=[{r:7,c:7,letter:'B',points:3,joker:false}];const before=JSON.stringify(f.c.G);f.c.chooseJoker('A');assert.equal(JSON.stringify(f.c.G),before);}
});
test('valid joker placement consumes its exact tile once',()=>{
  const f=fixture();f.c.G.rackView[0]={letter:'',points:0,joker:true};f.c.G.selected=0;f.c.onCellTap(7,7);f.c.chooseJoker('A');f.c.chooseJoker('B');assert.equal(f.c.G.rackView.length,1);assert.equal(f.c.G.pending.length,1);assert.equal(f.c.G.pending[0].assigned,'A');
});
let failed=0;for(const[name,run]of cases){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
if(failed)process.exitCode=1;
