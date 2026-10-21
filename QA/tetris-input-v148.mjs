// Exercise the real gesture handler with deterministic viewport coordinates.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const start=source.indexOf('function bindTouchGestures(');
const end=source.indexOf('\nfunction ',start+1);
assert.ok(start>=0&&end>start,'real touch gesture function exists');
const gestureSource=source.slice(start,end);
function setup(){
 const handlers=new Map(),moves=[],drops=[],rotations=[],hard=[];
 const wrap={isConnected:true,addEventListener:(name,handler)=>handlers.set(name,handler),getBoundingClientRect:()=>({left:0,width:300})};
 const state={root:{querySelector:()=>wrap},round:{},cellSize:24};
 const c=vm.createContext({G:state,COLS:10,ROWS:20,Math,Date,move:dir=>moves.push(dir),softDrop:()=>drops.push(1),hardDrop:()=>hard.push(1),rotate:dir=>rotations.push(dir)});
 vm.runInContext(gestureSource+'\nbindTouchGestures();',c);
 const event=(x,y)=>({pointerType:'mouse',clientX:x,clientY:y,preventDefault(){}});
 const fire=(type,x=100,y=100)=>{const handler=handlers.get(type);assert.equal(typeof handler,'function',`${type} handler exists`);handler(event(x,y));};
 return {handlers,moves,drops,rotations,hard,state,c,fire};
}
{
 const h=setup();h.fire('pointerdown');
 for(const x of [125,150,175])h.fire('pointermove',x);
 const right=h.moves.filter(n=>n>0).length;assert.ok(right>=3,'forward drag moves multiple columns');
 for(const x of [150,125,100])h.fire('pointermove',x);
 const returnLeft=h.moves.filter(n=>n<0).length;
 assert.ok(returnLeft>=right-1,'returning to gesture origin must reverse the earlier moves without a dead zone');
 for(const x of [75,50,25])h.fire('pointermove',x);
 const allLeft=h.moves.filter(n=>n<0).length;
 assert.ok(allLeft>=right+2,'continuing left after reversal moves beyond the starting column');
 console.log('PASS horizontal drag reverses immediately and continues beyond its origin.');
}
{
 const h=setup();h.fire('pointerdown');
 for(let y=105;y<=160;y+=5)h.fire('pointermove',100,y);
 assert.ok(h.drops.length>=2,'slow downward motion accumulates into soft drops');
 assert.equal(h.moves.length,0,'vertical drag does not move horizontally');
 console.log('PASS slow vertical motion accumulates into multiple soft drops.');
}
{
 const h=setup();h.fire('pointerdown');h.fire('pointermove',100,45);h.fire('pointercancel',100,45);h.fire('pointerup',100,45);
 assert.equal(h.hard.length,0,'canceled upward swipe cannot hard-drop on pointerup');
 assert.equal(h.rotations.length,0);
 console.log('PASS pointer cancellation releases a pending gesture.');
}
{
 const h=setup();h.fire('pointerdown');h.state.round={};
 h.fire('pointermove',175,100);h.fire('pointermove',175,30);h.fire('pointerup',175,30);
 assert.deepEqual(h.moves,[],'a gesture started in an old round cannot move a new round');
 assert.deepEqual(h.drops,[]);assert.deepEqual(h.hard,[]);assert.deepEqual(h.rotations,[]);
 console.log('PASS gestures stay bound to the round in which they started.');
}
