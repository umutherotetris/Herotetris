// Actual shared reward module with a small DOM and a deterministic clock.
// No browser, network or production account is used.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(new URL('../js/reward.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')
  .replace("import('./economy.js')",'__loadEconomy()')
  .replace("import('./game-review.js')",'__loadReview()')+'\nthis.showReward=showReward;';
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};

class Node{
  constructor(tag='div',document){this.tagName=tag.toLowerCase();this.ownerDocument=document;this.children=[];this.parentNode=null;this.attributes={};this.style={};this.handlers=new Map();this._text='';this._html='';this.disabled=false;this._classes=new Set();this.classList={add:(...v)=>v.forEach(x=>this._classes.add(x)),remove:(...v)=>v.forEach(x=>this._classes.delete(x)),contains:v=>this._classes.has(v)};}
  get id(){return this.attributes.id || '';}set id(value){this.attributes.id=String(value);}
  get isConnected(){return this===this.ownerDocument?.body || this===this.ownerDocument?.head || !!this.parentNode?.isConnected;}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='class')this._classes=new Set(String(value).split(/\s+/));}
  getAttribute(key){return this.attributes[key]??null;}
  appendChild(node){node.remove();node.parentNode=this;this.children.push(node);return node;}
  append(...nodes){for(const node of nodes)this.appendChild(node);}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(value){for(const child of this.children)child.parentNode=null;this.children=[];this._text=String(value);}
  get innerHTML(){return this._html;}
  set innerHTML(value){
    this.textContent='';this._html=String(value);const stack=[this];
    for(const token of this._html.match(/<[^>]+>|[^<]+/g)||[]){
      if(token.startsWith('<!--'))continue;
      if(token.startsWith('</')){if(stack.length>1)stack.pop();continue;}
      if(token.startsWith('<')){
        const match=/^<([\w-]+)/.exec(token);if(!match)continue;
        const node=new Node(match[1],this.ownerDocument);
        for(const attribute of token.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))node.setAttribute(attribute[1],attribute[2]??attribute[3]);
        stack.at(-1).appendChild(node);
        if(!/\/>$/.test(token)&&!['input','br','hr','img','meta','link'].includes(node.tagName))stack.push(node);
      }else stack.at(-1)._text+=token;
    }
  }
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this._classes.has(selector.slice(1));if(selector==='dialog[open]')return this.tagName==='dialog'&&Object.hasOwn(this.attributes,'open');return this.tagName===selector;}
  querySelector(selector){for(const child of this.children){if(child.matches(selector))return child;const found=child.querySelector(selector);if(found)return found;}return null;}
  addEventListener(type,handler){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(handler);}
  removeEventListener(type,handler){this.handlers.get(type)?.delete(handler);}
  async fire(type='click',event={}){for(const handler of [...(this.handlers.get(type)||[])])await handler({target:this,preventDefault(){},...event});}
  focus(){this.ownerDocument.activeElement=this;}
}
function fixture(){
  let uid='alice',now=0,timerId=0;
  const tasks=new Map(),authSubscribers=new Set(),storage=new Map(),calls=[],quests=[],reviews=[];
  const document={handlers:new Map(),activeElement:null,hidden:false,
    createElement:tag=>new Node(tag,document),
    getElementById:id=>document.querySelector('#'+id),
    querySelector:selector=>document.body.querySelector(selector)||document.head.querySelector(selector),
    addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,new Set());this.handlers.get(type).add(fn);},
    removeEventListener(type,fn){this.handlers.get(type)?.delete(fn);},
    async fire(type,event){for(const fn of [...(this.handlers.get(type)||[])])await fn(event);}
  };
  document.body=new Node('body',document);document.head=new Node('head',document);
  const state={uid,level:1,xp:10,totalXP:10,kaju:100};
  const hooks={kaju:null,xp:null,economy:null,review:null};
  const economy={progressQuest:(...args)=>quests.push(args)};
  const Store={getState:()=>({...state,uid}),
    async addKaju(n,game){calls.push(['kaju',n,game]);const paid=hooks.kaju?await hooks.kaju(n,game):n;if(Number.isSafeInteger(paid)&&paid>0){state.kaju+=paid;economy.progressQuest('earn',paid);}return paid;},
    async awardXP(n,owner){calls.push(['xp',n,owner]);const result=hooks.xp?await hooks.xp(n,owner):{ok:true,amount:n,leveled:false,level:state.level};if(result?.ok){state.xp+=result.amount;state.totalXP+=result.amount;state.level=result.level??state.level;}return result;}
  };
  const Auth={getState:()=>({uid,status:uid?'google':'offline'}),subscribe:fn=>{authSubscribers.add(fn);fn(Auth.getState());return()=>authSubscribers.delete(fn);}};
  const schedule=(fn,delay=0,kind='timeout')=>{const id=++timerId;tasks.set(id,{fn,time:now+Math.max(0,Number(delay)||0),kind});return id;};
  class ClockDate extends Date{static now(){return now;}}
  const context=vm.createContext({console,document,Store,Auth,Date:ClockDate,Math,Number,Object,Array,Promise,Set,Map,JSON,
    localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},
    setTimeout:(fn,delay)=>schedule(fn,delay),clearTimeout:id=>tasks.delete(id),
    requestAnimationFrame:fn=>schedule(()=>fn(now),16,'raf'),cancelAnimationFrame:id=>tasks.delete(id),
    __loadEconomy:()=>hooks.economy?hooks.economy():Promise.resolve(economy),
    __loadReview:()=>hooks.review?hooks.review():Promise.resolve({openGameReview:async review=>{reviews.push({review,uid});return {};}})
  });
  vm.runInContext(source,context);
  return{context,document,state,hooks,calls,quests,reviews,tasks,storage,authSubscribers,
    show:opts=>context.showReward(opts),overlay:()=>document.getElementById('heroRewardOv'),
    setUid(value){uid=value;for(const fn of [...authSubscribers])fn(Auth.getState());},
    async advance(milliseconds){const until=now+milliseconds;let iterations=0;for(;;){const next=[...tasks].filter(([,task])=>task.time<=until).sort((a,b)=>a[1].time-b[1].time||a[0]-b[0])[0];if(!next)break;if(iterations++>20000)throw new Error('Clock did not settle');const[id,task]=next;tasks.delete(id);now=task.time;const result=task.fn();if(result?.catch)result.catch(error=>{throw error;});await flush();}now=until;await flush();}
  };
}
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS',name);}
async function ready(f,opts={}){const promise=f.show(opts);await flush();assert.ok(f.overlay(),'reward overlay should be open');return{promise,overlay:f.overlay()};}
async function close(f,shown){await shown.overlay.querySelector('#rwClose').fire();assert.equal(await shown.promise,'close');}

await test('reward counters show confirmed capped Kaju and actual boosted XP rather than requested amounts',async()=>{
 const f=fixture();f.hooks.kaju=async()=>17;f.hooks.xp=async()=>({ok:true,amount:60,leveled:false,level:1});
 const shown=await ready(f,{game:'tetris',kaju:100,xp:40});await f.advance(2500);
 assert.equal(shown.overlay.querySelector('#rwKajuVal').textContent,'17');assert.equal(shown.overlay.querySelector('#rwXpVal').textContent,'60');assert.deepEqual(f.calls,[['kaju',100,'tetris'],['xp',40,'alice']]);await close(f,shown);
});
await test('failed XP receipt creates no XP gain row or fake level-up and reports only confirmed Kaju',async()=>{
 const f=fixture();f.hooks.xp=async()=>({ok:false,amount:40,leveled:true,level:2});const shown=await ready(f,{game:'chess',kaju:20,xp:40});
 assert.equal(shown.overlay.querySelector('#rwXpRow'),null);assert.equal(shown.overlay.querySelector('.rw-levelup'),null);assert.match(shown.overlay.textContent,/Bazı kazanımlar kaydedilemedi/);assert.ok(shown.overlay.querySelector('#rwKajuRow'));await close(f,shown);
});
await test('failed Kaju write cannot advertise a gain while an independently confirmed XP award remains visible',async()=>{
 const f=fixture();f.hooks.kaju=async()=>{throw new Error('PERMISSION_DENIED');};const shown=await ready(f,{game:'chess',kaju:20,xp:40});
 assert.equal(shown.overlay.querySelector('#rwKajuRow'),null);assert.ok(shown.overlay.querySelector('#rwXpRow'));assert.match(shown.overlay.textContent,/Yalnızca onaylanan tutarlar/);await close(f,shown);
});
await test('account change during Kaju acknowledgement prevents XP, quest progress and reward UI',async()=>{
 const f=fixture();let release;f.hooks.kaju=()=>new Promise(resolve=>release=resolve);const pending=f.show({game:'tetris',kaju:20,xp:40,won:true});await flush();f.setUid('bob');release(0);
 assert.equal(await pending,'close');assert.equal(f.calls.filter(c=>c[0]==='xp').length,0);assert.equal(f.quests.length,0);assert.equal(f.overlay(),null);
});
await test('account change during XP acknowledgement prevents quest progress and reward UI',async()=>{
 const f=fixture();let release;f.hooks.xp=()=>new Promise(resolve=>release=resolve);const pending=f.show({game:'chess',xp:40,won:true});await flush();f.setUid('bob');release({ok:false,amount:0});
 assert.equal(await pending,'close');assert.equal(f.quests.length,0);assert.equal(f.overlay(),null);
});
await test('account change during lazy quest import cannot advance the next account or open old UI',async()=>{
 const f=fixture();let release;f.hooks.economy=()=>new Promise(resolve=>release=resolve);const pending=f.show({game:'chess',won:true});await flush();f.setUid('bob');release({progressQuest:(...args)=>f.quests.push(args)});
 assert.equal(await pending,'close');assert.equal(f.quests.length,0);assert.equal(f.overlay(),null);
});
await test('stale game context exits before any payout, quest event or overlay',async()=>{
 const f=fixture();assert.equal(await f.show({kaju:20,xp:40,won:true,isCurrent:()=>false}),'close');assert.equal(f.calls.length,0);assert.equal(f.quests.length,0);assert.equal(f.overlay(),null);
});
await test('writeReward false displays explicitly confirmed amounts without requesting another payout',async()=>{
 const f=fixture();const shown=await ready(f,{game:'tavla',kaju:7,xp:12,writeReward:false,payoutIssue:true,questEventsHandled:true});await f.advance(2500);
 assert.equal(f.calls.length,0);assert.equal(f.quests.length,0);assert.equal(shown.overlay.querySelector('#rwKajuVal').textContent,'7');assert.equal(shown.overlay.querySelector('#rwXpVal').textContent,'12');assert.match(shown.overlay.textContent,/Bazı kazanımlar/);await close(f,shown);
});
await test('unsafe, fractional or nonnumeric reward amounts cannot produce gain rows or Store writes',async()=>{
 for(const value of [NaN,Infinity,-10,1.5,'20',{},Number.MAX_SAFE_INTEGER+1]){
  const f=fixture(),shown=await ready(f,{kaju:value,xp:value,questEventsHandled:true});assert.equal(f.calls.length,0);assert.equal(shown.overlay.querySelector('#rwKajuRow'),null);assert.equal(shown.overlay.querySelector('#rwXpRow'),null);await close(f,shown);
 }
});
await test('confirmed Kaju earn progress is counted once by Store and never repeated by the reward screen',async()=>{
 const f=fixture(),shown=await ready(f,{game:'chess',kaju:25,won:true});assert.deepEqual(f.quests,[['earn',25],['play'],['win']]);await close(f,shown);
});
await test('quest and play ownership flags give exactly one remaining play or win event',async()=>{
 for(const[flags,events]of [[{questEventsHandled:true},[]],[{playEventHandled:true},[['win']]],[{winEventHandled:true},[['play']]],[{playEventHandled:true,winEventHandled:true},[]],[{},[['play'],['win']]]]){
  const f=fixture(),shown=await ready(f,{won:true,...flags});assert.deepEqual(f.quests,events);await close(f,shown);
 }
});
await test('close settles once and removes the reward overlay, keyboard handler and Auth subscription',async()=>{
 const f=fixture(),shown=await ready(f,{questEventsHandled:true});assert.equal(f.authSubscribers.size,1);await close(f,shown);assert.equal(f.overlay(),null);assert.equal(f.authSubscribers.size,0);assert.equal(f.document.handlers.get('keydown')?.size||0,0);await shown.overlay.querySelector('#rwPlay').fire();assert.equal(await shown.promise,'close');
});
await test('replay returns replay only for the current game context and close for a stale context',async()=>{
 for(const current of [true,false]){
  const f=fixture();let valid=true;const shown=await ready(f,{questEventsHandled:true,isCurrent:()=>valid});valid=current;await shown.overlay.querySelector('#rwPlay').fire();assert.equal(await shown.promise,current?'replay':'close');assert.equal(f.overlay(),null);
 }
});
await test('Escape and backdrop close the reward while an open dialog receives Escape first',async()=>{
 const f=fixture(),shown=await ready(f,{questEventsHandled:true});const dialog=f.document.createElement('dialog');dialog.setAttribute('open','');f.document.body.appendChild(dialog);await f.document.fire('keydown',{key:'Escape'});assert.ok(f.overlay());dialog.remove();await f.document.fire('keydown',{key:'Escape'});assert.equal(await shown.promise,'close');
 const next=await ready(f,{questEventsHandled:true});await next.overlay.fire('click');assert.equal(await next.promise,'close');
});
await test('review action opens the exact supplied review under the captured account and permits retry after load failure',async()=>{
 const f=fixture(),review={id:'review1',uid:'alice',game:'chess'},shown=await ready(f,{review,questEventsHandled:true});const button=shown.overlay.querySelector('#rwReview');
 f.hooks.review=async()=>{throw new Error('offline');};await button.fire();assert.equal(button.disabled,false);assert.match(button.textContent,/Yeniden dene/);
 f.hooks.review=null;await button.fire();assert.equal(f.reviews.length,1);assert.equal(f.reviews[0].review,review);assert.equal(f.reviews[0].uid,'alice');await close(f,shown);
});
await test('account switch during review import closes reward and cannot open the old account review',async()=>{
 const f=fixture(),shown=await ready(f,{review:{id:'review1',uid:'alice'},questEventsHandled:true});let release;f.hooks.review=()=>new Promise(resolve=>release=resolve);const click=shown.overlay.querySelector('#rwReview').fire();await flush();f.setUid('bob');release({openGameReview:review=>f.reviews.push(review)});await click;assert.equal(await shown.promise,'close');assert.equal(f.reviews.length,0);assert.equal(f.overlay(),null);
});
await test('closing or replaying during a review import cannot open a late review overlay',async()=>{
 for(const action of ['close','replay']){
  const f=fixture(),shown=await ready(f,{review:{id:'review1',uid:'alice'},questEventsHandled:true});let release;f.hooks.review=()=>new Promise(resolve=>release=resolve);const click=shown.overlay.querySelector('#rwReview').fire();await flush();await shown.overlay.querySelector(action==='close'?'#rwClose':'#rwPlay').fire();assert.equal(await shown.promise,action);release({openGameReview:review=>f.reviews.push(review)});await click;assert.equal(f.reviews.length,0);
 }
});
await test('close, replay and account invalidation cancel every pending reward animation and timer',async()=>{
 for(const action of ['close','replay','account'])for(const at of [50,750,1550,2850]){
  const f=fixture();f.state.xp=490;f.state.totalXP=490;f.hooks.xp=async()=>({ok:true,amount:40,leveled:true,level:2});
  const shown=await ready(f,{won:true,score:500,kaju:20,xp:40,questEventsHandled:true});await f.advance(at);assert.ok(f.tasks.size>0);
  if(action==='account')f.setUid('bob');else await shown.overlay.querySelector(action==='close'?'#rwClose':'#rwPlay').fire();assert.equal(await shown.promise,action==='replay'?'replay':'close');
  assert.equal(f.tasks.size,0,'settled reward must cancel animation frames and timeouts');await f.advance(5000);assert.equal(f.document.body.children.length,0);
 }
});
console.log(`PASS shared reward v156: ${groups} confirmed payout, identity, quest ownership, review and lifecycle groups`);
