import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read=name=>fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
const social={};
vm.runInNewContext(read('social.js').replace(/^import .+;\n/gm,'').replace(/^export default .+;$/m,'').replace(/^export /gm,'').replaceAll('import.meta.url',JSON.stringify(new URL('../js/social.js',import.meta.url).href))+'\nthis.geometry=hubPanelPosition;this.submit=hubSubmitKey;',social);
const view={left:0,top:0,width:320,height:360};
const anchor=(left,top)=>({left,top,width:34,bottom:top+34});
const placement=(...args)=>({...social.geometry(...args)});

assert.deepEqual(placement(view,290,170,anchor(7,12)),{left:8,top:54});
assert.deepEqual(placement(view,290,170,anchor(286,310)),{left:22,top:132});
assert.deepEqual(placement(view,290,236,anchor(157,152)),{left:22,top:116});
console.log('PASS social panel chooses the side with room or keeps the measured panel fully in bounds');

const keyboard={left:26,top:136,width:268,height:205};
const moved=placement(keyboard,252,189,anchor(260,261),{left:510,top:-300});
assert.deepEqual(moved,{left:34,top:144});
assert.deepEqual(placement(view,220,200,anchor(9,150),{left:52,top:88}),{left:52,top:88});
console.log('PASS rotated/panned keyboard view clamps every edge and preserves safe manual placement');

assert.equal(social.submit({key:'Enter',isComposing:false,keyCode:13}),true);
assert.equal(social.submit({key:'Enter',isComposing:true,keyCode:13}),false);
assert.equal(social.submit({key:'Enter',isComposing:false,keyCode:229}),false);
assert.equal(social.submit({key:'a',isComposing:false,keyCode:65}),false);
console.log('PASS mobile IME cannot submit unfinished chat text');

const ids=new Map(), frames=[], focusTransitions=[], storage=new Map(), listeners={};
const document={
  activeElement:null,
  getElementById: id=>ids.get(id),
  querySelectorAll:selector=>lists[selector]||[],
  querySelector:()=>null,
  createElement:()=>node(),
  addEventListener:(kind,action)=>listeners[kind]=action,
};
function node(dataset={}){
  const handlers={};
  return {
    dataset,hidden:false,style:{},children:[],attrs:{},value:'',
    addEventListener:(kind,action)=>handlers[kind]=action,
    emit:(kind,event)=>handlers[kind]?.(event),
    click(){this.emit('click',{});},
    focus(options){focusTransitions.push(['focus',this.id,options?.preventScroll]);document.activeElement=this;},
    scrollIntoView(){focusTransitions.push(['reveal',this.id]);},
    setAttribute(key,value){this.attrs[key]=value;},
    showModal(){this.open=true;},close(){this.open=false;},
    append(...children){this.children.push(...children);},
    replaceChildren(...children){this.children=children;},
  };
}
const keys=['tetris','chess','tavla','kelime'];
const lists={
  '[data-game-card]':keys.map(gameCard=>node({gameCard})),
  '[data-favorite]':keys.map(favorite=>node({favorite})),
  '[data-filter]':['all','solo','together','favorites'].map(filter=>node({filter})),
};
for(const id of ['gameTetris','gameChess','gameTavla','gameKelime','recentGame','recentName','gameCount','collectionEmpty','resetFilter','gameGuide','gameSearch','guidePlay','searchTrigger','gameSearchInput','searchResults'])ids.set(id,Object.assign(node(),{id}));
const context=vm.createContext({
  document,window:{addEventListener(){}},
  localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
  go:()=>frames.push(()=>focusTransitions.push(['restore'])),
  requestAnimationFrame:fn=>frames.push(fn),
});
vm.runInContext(read('lobby.js').replace(/^import .+;\n/gm,'').replace('export default function','function')+'\ninitLobby();',context);
lists['[data-filter]'][2].click();
assert.equal(ids.get('gameCount').textContent,'4 oyun');
assert.equal(lists['[data-game-card]'][0].hidden,false);
ids.get('searchTrigger').click();
assert.equal(ids.get('gameSearch').open,true);
ids.get('gameSearchInput').value='çok oyunculu';
ids.get('gameSearchInput').emit('input');
let rows=ids.get('searchResults').children;
assert.ok(rows.some(row=>row.children[0].textContent==='HeroTetris'));
ids.get('gameSearchInput').value='çevrimiçi';
ids.get('gameSearchInput').emit('input');
rows=ids.get('searchResults').children;
assert.equal(rows.length,4);
console.log('PASS all four multiplayer games appear in Together and respond to online search');

rows.find(row=>row.children[0].textContent==='Kelimecik').click();
assert.equal(ids.get('gameSearch').open,false);
assert.equal(document.activeElement,ids.get('gameKelime'));
assert.deepEqual(focusTransitions.at(-1),['focus','gameKelime',true]);
while(frames.length)frames.shift()();
assert.deepEqual(focusTransitions.slice(-2),[['restore'],['reveal','gameKelime']]);
console.log('PASS selected search result remains focused and is revealed after scroll restoration');

for(const [game,dimensions] of [['chess',['boardPx','boardPx']],['tavla',['W','H']]]){
  const source=read('games/'+game+'.js');
  const start=source.indexOf('function fitCanvas(){');
  const end=source.indexOf('\n}',start)+2;
  const frame={width:378,height:333,top:74.375};
  const root={bottom:360};
  const gameState={
    root:{getBoundingClientRect:()=>root},
    boardWrap:{clientWidth:378,clientHeight:333,style:{},getBoundingClientRect:()=>frame},
    canvas:{style:{}},ctx:{setTransform(){}},
  };
  const gameContext=vm.createContext({G:gameState,window:{devicePixelRatio:2},boardMargin:size=>Math.round(size*.04),draw(){},computeLayout(){}});
  vm.runInContext(source.slice(start,end)+'\nthis.refit=fitCanvas;',gameContext);
  gameContext.refit();
  assert.ok(gameState[dimensions[0]]>0&&gameState[dimensions[1]]>0);
  assert.ok(frame.top+gameState[dimensions[1]]<=root.bottom,'large wrapper must not clip the lower board');
  assert.equal(gameState.boardWrap.style.alignItems,'flex-start');
  assert.equal(gameState.canvas.height,gameState[dimensions[1]]*2);

  // An async HUD/clock can alter the visible area without a window resize.
  // Include body zoom: DOM rect sizes are visual, canvas size is layout CSS px.
  frame.top=92;frame.height=416.25;root.bottom=360;
  gameContext.refit();
  assert.ok(frame.top+1.25*gameState[dimensions[1]]<=root.bottom);
  const previousHeight=gameState.canvas.height;
  gameState.boardWrap.clientHeight=0;
  gameContext.refit();
  assert.equal(gameState.canvas.height,previousHeight,'a hidden board keeps its fit instead of using viewport width');
  console.log('PASS '+game+' board stays in view after HUD insertion/zoom and does not resize while hidden');
}
