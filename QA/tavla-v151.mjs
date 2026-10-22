// Real Tavla input/render/animation regressions. No account or network writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import * as engine from '../js/games/tavla-engine.js';
const source=fs.readFileSync(process.env.TAVLA_V151_SOURCE || new URL('../js/games/tavla.js',import.meta.url),'utf8');
function fn(name){
 const m=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m').exec(source);assert.ok(m,name);
 const tail=source.slice(m.index),end=/\n(?:export )?(?:async )?function \w+\(/.exec(tail.slice(1));
 return end?tail.slice(0,end.index+1):tail;
}
const noop=()=>{},names=['canInteract','isMyPoint','getCombinedMoves','onPointerDown','onPointerMove','onPointerUp','doMove','sameTurn','animateMove','checkerPixel','drawCheckers','drawBarCheckers'];
function fixture(){
 const state=engine.newGame();state.dice=[6,3];
 const s={state,mode:'local',online:false,rolled:true,gameEnded:false,aiThinking:false,_turnToken:{},undoStack:[],selected:null,legalForSel:[],flip:false,geo:{checkerR:10,safe:5,pointH:150,innerY:10,innerH:400,barX:300,barW:30,bearX:400,bearW:30}};
 const calls=[],frames=[];
 const ctx={save:noop,restore:noop,fillText:noop};
 const c=vm.createContext({G:s,...engine,console,Math,Sound:new Proxy({},{get:()=>noop}),
  TavlaMP:{send:noop},getPos:e=>({x:e.clientX*10,y:e.clientY}),hitTest:x=>x/10,
  pointGeometry:i=>({baseX:100+i*10,y0:10,dir:1}),drawChecker:(_ctx,x,y,r,color)=>calls.push({x,y,r,color}),
  performance:{now:()=>0},requestAnimationFrame:cb=>{frames.push(cb);return frames.length;},easeOutCubic:x=>1-Math.pow(1-x,3),
  updateStatus:noop,updateControls:noop,draw:noop,saveAIGame:noop,afterTurn:noop,
  clearMoveGrace:noop,onWin:noop,startBearAnim:noop,canPassNow:()=>false});
 vm.runInContext(names.map(fn).join('\n'),c);
 return {s,c,calls,frames,ctx,render:()=>{calls.length=0;c.drawCheckers(ctx,{});c.drawBarCheckers(ctx,{});}};
}
const event=(type,pointerId,x)=>({type,pointerId,clientX:x,clientY:100,preventDefault:noop});
let failures=0;function test(name,run){try{run();console.log('PASS',name);}catch(e){failures++;console.error('FAIL',name,e.message);}}
test('another finger cannot replace a held selection and release its target',()=>{
 const f=fixture();f.c.onPointerDown(event('pointerdown',1,12));
 const before=JSON.stringify(f.s.state);
 f.c.onPointerDown(event('pointerdown',2,9));f.c.onPointerUp(event('pointerup',1,12));
 assert.equal(JSON.stringify(f.s.state),before,'the other finger cannot turn a source tap into a destination tap');
});
test('only the dragging pointer can move, release or cancel its checker',()=>{
 const f=fixture();f.c.onPointerDown(event('pointerdown',1,12));f.c.onPointerMove(event('pointermove',1,9));
 const before=JSON.stringify(f.s.state),pos=JSON.stringify(f.s.dragPos);
 f.c.onPointerMove(event('pointermove',2,3));assert.equal(JSON.stringify(f.s.dragPos),pos);
 f.c.onPointerUp(event('pointercancel',2,3));assert.equal(f.s.dragging,true,'unrelated cancellation must not abort the active drag');
 f.c.onPointerUp(event('pointerup',2,3));assert.equal(JSON.stringify(f.s.state),before);
 f.c.onPointerUp(event('pointerup',1,9));assert.equal(f.s.state.points[9],1);assert.ok(engine.isValidState(f.s.state));
});
test('releasing a source tap redraws its stationary checker without a leftover drag copy',()=>{
 const f=fixture(),draws=[];f.c.draw=()=>draws.push(f.s.dragging);
 f.c.onPointerDown(event('pointerdown',1,12));f.c.onPointerUp(event('pointerup',1,12));
 assert.equal(draws.at(-1),false,'pointer release must clear the drag image from the canvas immediately');
 assert.equal(f.s.state.points[12],5);
});
test('a point checker has one rendered copy while it is animated or dragged',()=>{
 for(const animate of [true,false]){
  const f=fixture();const mv=engine.legalMovesFrom(f.s.state,23).find(m=>m.die===3);assert.ok(mv);
  if(animate)f.c.animateMove(mv,noop);else {f.s.dragging=true;f.s.dragFrom=23;f.s.dragPos={x:1,y:1};}
  f.render();
  assert.equal(f.calls.filter(v=>v.x===330&&v.color==='w').length,1,'one of two source checkers must leave the stationary stack');
  assert.equal(f.calls.filter(v=>v.color==='w').length+1,15,'the moving checker replaces its stationary copy');
 }
});
test('arriving checker targets its actual next stack slot instead of overlapping the previous checker',()=>{
 const f=fixture();f.s.state.points=Array(24).fill(0);f.s.state.points[12]=1;f.s.state.points[9]=1;f.s.state.points[0]=13;f.s.state.points[23]=-15;
 const mv=engine.legalMovesFrom(f.s.state,12).find(m=>m.to===9);assert.ok(mv);
 const end=f.c.checkerPixel(9,'w','to');assert.equal(end.y,45.5,'one existing checker means the new checker occupies the second slot');
 f.c.animateMove(mv,noop);f.frames.shift()(140);assert.equal(f.s.movingChecker.y,25+20.5*.875);
});
test('bar entry starts from the actual bar slot and removes its stationary duplicate',()=>{
 for(const flip of [false,true]){
  const f=fixture();f.s.flip=flip;f.s.state.points[23]=0;f.s.state.bar.w=2;
  const mv=engine.allLegalMoves(f.s.state).find(m=>m.from==='bar');assert.ok(mv);
  const start=f.c.checkerPixel('bar','w','from');assert.equal(start.y,flip?45.5:374.5);
  f.c.animateMove(mv,noop);f.render();
  assert.equal(f.calls.filter(v=>v.x===315&&v.color==='w').length,1,'one of the two bar checkers must be in flight');
 }
});
test('an interrupted move clears flying checker copies without committing the old move',()=>{
 const f=fixture(),mv=engine.legalMovesFrom(f.s.state,23).find(m=>m.die===3);let commits=0;
 const before=JSON.stringify(f.s.state);f.c.animateMove(mv,()=>commits++);
 f.s.gameEnded=true;f.frames.shift()(140);
 assert.equal(f.s.movingChecker,null);assert.equal(f.s.hitChecker,null);assert.equal(f.s.hideAt,null);
 assert.equal(commits,0);assert.equal(JSON.stringify(f.s.state),before);
});
try{
 const f=fixture(),elements=new Map();
 const element=()=>({disabled:false,textContent:'',style:{},handlers:{},addEventListener(type,handler){this.handlers[type]=handler;}});
 const ov={isConnected:true,querySelector(selector){if(!elements.has(selector))elements.set(selector,element());return elements.get(selector);},querySelectorAll:()=>[],remove(){this.isConnected=false;}};
 let appended=0;const root={appendChild:()=>appended++,querySelector:()=>appended?ov:null};f.s.root=root;f.c.document={createElement:()=>ov};
 let calls=0,release;f.c.shareRoomCode=()=>{calls++;return new Promise(resolve=>release=resolve);};
 vm.runInContext(fn('showOnlineLobby'),f.c);await f.c.showOnlineLobby(root);await f.c.showOnlineLobby(root);assert.equal(appended,1,'repeated online setup cannot stack lobbies');
 const btn=ov.querySelector('[data-act="share"]');ov.querySelector('[data-el="code"]').textContent='ABC234';
 const handler=btn.handlers.click;assert.equal(typeof handler,'function','lobby exposes native share beside copy');
 const pending=handler({currentTarget:btn});assert.equal(btn.disabled,true);await handler({currentTarget:btn});assert.equal(calls,1,'rapid share taps start only one system sheet');
 release('copied');await pending;assert.equal(btn.textContent,'✅ KOD KOPYALANDI');assert.equal(btn.disabled,false);
 f.c.shareRoomCode=async()=> 'cancelled';await handler({currentTarget:btn});assert.equal(btn.textContent,'📤 PAYLAŞ','cancel does not claim the invite was sent');
 f.c.shareRoomCode=async()=> 'unsupported';await handler({currentTarget:btn});assert.equal(btn.textContent,'KODU ELLE PAYLAŞ');
 console.log('PASS native room share prevents overlapping sheets and reports copy/cancel/support truthfully');
}catch(e){failures++;console.error('FAIL native room share integration',e.message);}
if(failures)process.exitCode=1;
