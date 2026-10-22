// Actual shared ES modules; deterministic DOM/observer/auth fixtures only.
// Transport, game simulation and production accounts are never loaded.
import fs from 'node:fs';
import assert from 'node:assert/strict';
globalThis.__gameSessionFixtures=Object.create(null);
let serial=0,groups=0,failed=0;
const settle=async()=>{for(let i=0;i<10;i++)await new Promise(r=>setImmediate(r));};
const dataURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function load(file,f){
  const id='session'+serial++;globalThis.__gameSessionFixtures[id]=f;
  const from=`globalThis.__gameSessionFixtures[${JSON.stringify(id)}]`;
  const source=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8')
    .replace(/^import \{([^}]+)\} from ['"]\.\/auth\.js['"];?$/gm,(_all,names)=>`const {${names}}=${from};`)
    .replace(/^import \{([^}]+)\} from ['"]\.\/portal-panels\.js['"];?$/gm,(_all,names)=>`const {${names}}=${from}.panels;`)
    .replace(/import\('\.\/games\/'\s*\+\s*key\s*\+\s*'\.js'\)/g,`${from}.loadGame(key)`)
    .replaceAll('import.meta.url',JSON.stringify(new URL('../js/'+file,import.meta.url).href));
  return import(dataURL(source+`\n// actual ES module ${id}`));
}
class Element{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.parentNode=null;this.listeners=new Map();this.dataset={};this.attributes={};this.className='';this._text='';this.hidden=false;this.inert=false;this.disabled=false;this.style={overflow:'',setProperty(){}};}
  [Symbol.for('nodejs.util.inspect.custom')](){return '<'+this.tagName.toLowerCase()+(this.className?'.'+this.className:'')+'>';}
  get isConnected(){return this===this.doc.body||this===this.doc.head||!!this.parentNode?.isConnected;}
  get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value??'');this.doc.mutate(this);}
  get childNodes(){return this.children;}
  append(...children){for(const child of children){child.remove?.();child.parentNode=this;this.children.push(child);}this.doc.mutate(this);}
  appendChild(child){this.append(child);return child;}
  remove(){if(!this.parentNode)return;const parent=this.parentNode;parent.children=parent.children.filter(n=>n!==this);this.parentNode=null;this.doc.mutate(parent);}
  replaceChildren(...children){for(const child of this.children)child.parentNode=null;this.children=[];this._text='';this.append(...children);}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);}
  getAttribute(key){return this.attributes[key]??null;}
  removeAttribute(key){delete this.attributes[key];}
  addEventListener(type,handler){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(handler);}
  removeEventListener(type,handler){this.listeners.get(type)?.delete(handler);}
  async fire(type='click',patch={}){const e={type,target:this,preventDefault(){},...patch};await Promise.all([...this.listeners.get(type)||[]].map(fn=>fn(e)));}
  click(){return this.fire('click');}
  dispatchEvent(e){void this.fire(e.type,e);return true;}
  focus(){this.doc.activeElement=this;}
  matches(selector){
    if(selector.startsWith('.'))return this.className.split(/\s+/).includes(selector.slice(1));
    if(selector.startsWith('#'))return this.id===selector.slice(1);
    const attr=/^(\w+)?\[([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]$/.exec(selector);
    if(attr){if(attr[1]&&this.tagName.toLowerCase()!==attr[1].toLowerCase())return false;let value=this.attributes[attr[2]];if(attr[2].startsWith('data-'))value=this.dataset[attr[2].slice(5).replace(/-([a-z])/g,(_all,c)=>c.toUpperCase())];return attr[3]===undefined?value!==undefined:value===attr[3];}
    return this.tagName.toLowerCase()===selector.toLowerCase();
  }
  querySelectorAll(selector){const choices=selector.split(',').map(s=>s.trim()),nodes=[];for(const child of this.children){if(choices.some(s=>child.matches(s)))nodes.push(child);nodes.push(...child.querySelectorAll(selector));}return nodes;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function fixture(){
  let state={uid:'alice',status:'google'};const observers=new Set(),subscribers=new Set(),calls=[],loads=[],closes=[];
  const doc={activeElement:null,events:new Map(),
    createElement:tag=>new Element(tag,doc),querySelector:selector=>doc.body.querySelector(selector)||doc.head.querySelector(selector),
    getElementById:id=>doc.querySelector('#'+id),
    addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);},
    removeEventListener(type,fn){this.events.get(type)?.delete(fn);},
    mutate(node){if(!node.isConnected)return;for(const observer of observers){if(observer.pending)continue;observer.pending=true;queueMicrotask(()=>{observer.pending=false;if(observers.has(observer))observer.callback([],observer);});}}};
  doc.body=new Element('body',doc);doc.head=new Element('head',doc);
  class Observer{constructor(callback){this.callback=callback;this.pending=false;}observe(){observers.add(this);}disconnect(){observers.delete(this);}takeRecords(){return[];}}
  const f={doc,observers,subscribers,calls,loads,closes,panels:{},
    Auth:{getState:()=>state,subscribe:fn=>{subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);}},
    gameModule:key=>({setPortalMinimized:hidden=>{calls.push({key,hidden});return true;},closePortalGame:root=>{closes.push({key,root});root.remove();return true;}}),
    loadGame:async key=>{loads.push(key);return f.gameModule(key);},
    auth:patch=>{state={...state,...patch};for(const fn of [...subscribers])fn(state);},
    game:(key='tetris')=>{const selectors={tetris:['tetris-overlay','tetris-topbar'],chess:['chess-root','cg-top'],tavla:['tavla-root','tg-top'],kelime:['kl-root','kl-top']},root=new Element('div',doc),header=new Element('div',doc);root.className=selectors[key][0];header.className=selectors[key][1];root.append(header);doc.body.append(root);return {root,header};},
    dispose:()=>{for(const observer of [...observers])observer.disconnect();subscribers.clear();}};
  globalThis.document=doc;globalThis.MutationObserver=Observer;
  return f;
}
async function returnFixture(){const f=fixture();f.panels=await load('portal-panels.js',f);f.module=await load('game-return.js',f);return f;}
async function test(name,run){try{await run();groups++;console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<actual-module>'));}}
const buttons=ui=>ui.element.querySelectorAll('button');

await test('session phases expose real accessible labels and load one stylesheet',async()=>{
  const f=fixture(),m=await load('game-session-ui.js',f),host=f.doc.createElement('div');f.doc.body.append(host);
  assert.throws(()=>m.mountSessionStatus(null),/kapsayıcısı/);
  const ui=m.mountSessionStatus(host,{game:'tetris'}),other=m.mountSessionStatus(host,{game:'chess'});
  const title=ui.element.querySelector('strong');assert.equal(title.getAttribute('aria-live'),'polite');assert.equal(title.getAttribute('role'),'status');
  for(const [phase,[label]]of Object.entries(m.SESSION_PHASES)){ui.update({phase});assert.equal(ui.element.dataset.phase,phase);assert.equal(title.textContent,label);}
  ui.update({phase:'unexpected'});assert.equal(ui.element.dataset.phase,'connecting');
  assert.equal(f.doc.head.querySelectorAll('link[data-session-ui]').length,1);ui.destroy();other.destroy();assert.equal(f.observers.size,0);f.dispose();
});
await test('changing connection phase clears previous failure detail unless a new detail is supplied',async()=>{
  const f=fixture(),m=await load('game-session-ui.js',f),ui=m.mountSessionStatus(f.doc.body,{game:'chess',initial:{phase:'failed',detail:'Old network failure'}}),detail=ui.element.querySelector('.hero-session-detail');
  ui.update({phase:'playing'});assert.equal(detail.hidden,true);assert.equal(detail.textContent,'');
  ui.update({phase:'reconnecting',detail:'Attempt 2/6'});assert.equal(detail.textContent,'Attempt 2/6');ui.update({phase:'ready'});assert.equal(detail.textContent,m.SESSION_PHASES.ready[1]);ui.destroy();f.dispose();
});
await test('retry and leave actions respect phase/availability and remain single-flight together',async()=>{
  const f=fixture(),m=await load('game-session-ui.js',f);let release,retries=0,leaves=0;
  const ui=m.mountSessionStatus(f.doc.body,{game:'tavla',initial:{phase:'failed'},onRetry:()=>{retries++;return new Promise(r=>release=r);},onLeave:()=>leaves++}),[retry,leave]=buttons(ui);
  const pending=retry.fire();assert.equal(retry.disabled,true);await retry.fire();await leave.fire();assert.equal(retries,1);assert.equal(leaves,0);
  release();await pending;assert.equal(retry.disabled,false);await leave.fire();assert.equal(leaves,1);
  ui.update({phase:'playing'});assert.equal(retry.hidden,true);assert.equal(leave.hidden,true);await retry.fire();await leave.fire();assert.equal(retries,1);assert.equal(leaves,1);
  ui.update({phase:'reconnecting',canRetry:false});assert.equal(retry.hidden,true);ui.update({phase:'failed'});assert.equal(retry.hidden,false,'a new failure phase clears the old automatic-reconnect retry restriction');ui.destroy();f.dispose();
});
await test('rejected retry displays a recoverable error and a destroyed pending action cannot update its old surface',async()=>{
  const f=fixture(),m=await load('game-session-ui.js',f);let reject;
  const ui=m.mountSessionStatus(f.doc.body,{initial:{phase:'failed'},onRetry:()=>Promise.reject(Error('offline'))}),[retry]=buttons(ui);
  await retry.fire();assert.equal(ui.element.dataset.phase,'failed');assert.match(ui.element.textContent,/tamamlanamadı/);assert.equal(retry.disabled,false);ui.destroy();
  const late=m.mountSessionStatus(f.doc.body,{initial:{phase:'failed'},onRetry:()=>new Promise((_r,r)=>reject=r)}),[lateRetry]=buttons(late),pending=lateRetry.fire();
  const oldText=late.element.textContent;late.destroy();reject(Error('late'));await pending;assert.equal(late.element.isConnected,false);assert.equal(late.element.textContent,oldText);assert.equal(lateRetry.listeners.get('click').size,0);f.dispose();
});
await test('detaching a host releases the status observer/listeners and later updates are inert',async()=>{
  const f=fixture(),m=await load('game-session-ui.js',f),host=f.doc.createElement('div');f.doc.body.append(host);
  const ui=m.mountSessionStatus(host,{initial:{phase:'failed'},onRetry:()=>{throw Error('detached must not act');}}),[retry]=buttons(ui);assert.equal(f.observers.size,1);
  host.remove();await settle();assert.equal(f.observers.size,0);assert.equal(retry.listeners.get('click').size,0);const old=ui.element.textContent;ui.update({phase:'playing'});assert.equal(ui.element.textContent,old);await retry.fire();ui.destroy();f.dispose();
});

await test('game return initialization is idempotent and no-game portal has no active dock',async()=>{
  const f=await returnFixture();f.module.initGameReturn();f.module.initGameReturn();await settle();
  assert.equal(f.doc.body.querySelectorAll('.portal-resume').length,1);assert.equal(f.doc.body.querySelector('.portal-resume').hidden,true);assert.equal(f.loads.length,0);assert.equal(f.subscribers.size,1);f.dispose();
});
await test('minimize/restore preserves root visibility, inert state, scroll lock and original focus control',async()=>{
  const f=await returnFixture(),{root,header}=f.game();f.doc.body.style.overflow='hidden';f.module.initGameReturn();await settle();
  const control=header.querySelector('.portal-minimize'),dock=f.doc.body.querySelector('.portal-resume');assert.ok(control);await control.fire();await settle();
  assert.equal(root.hidden,true);assert.equal(root.inert,true);assert.equal(root.dataset.portalMinimized,'true');assert.equal(dock.hidden,false);assert.equal(f.doc.body.style.overflow,'');assert.equal(f.doc.activeElement,dock);
  await dock.fire();await settle();assert.equal(root.hidden,false);assert.equal(root.inert,false);assert.equal(root.dataset.portalMinimized,undefined);assert.equal(dock.hidden,true);assert.equal(f.doc.body.style.overflow,'hidden');assert.equal(f.doc.activeElement,control);
  assert.deepEqual(f.calls,[{key:'tetris',hidden:true},{key:'tetris',hidden:false}]);f.dispose();
});
await test('only one game can be minimized and repeated return clicks cannot double-resume',async()=>{
  const f=await returnFixture(),t=f.game(),chess=f.game('chess');f.module.initGameReturn();await settle();
  await t.header.querySelector('.portal-minimize').fire();await chess.header.querySelector('.portal-minimize').fire();
  const dock=f.doc.body.querySelector('.portal-resume');await dock.fire();await dock.fire();await settle();assert.deepEqual(f.calls,[{key:'tetris',hidden:true},{key:'tetris',hidden:false}]);assert.equal(chess.root.hidden,false);f.dispose();
});
await test('removing a minimized game removes its active dock and never resumes a detached root',async()=>{
  const f=await returnFixture(),{root,header}=f.game();f.module.initGameReturn();await settle();await header.querySelector('.portal-minimize').fire();root.remove();await settle();
  const dock=f.doc.body.querySelector('.portal-resume');assert.equal(dock.hidden,true);await dock.fire();assert.deepEqual(f.calls,[{key:'tetris',hidden:true}]);assert.equal(f.doc.body.style.overflow,'');f.dispose();
});
await test('a no-game minimization hook cannot hide the root or create a misleading active dock',async()=>{
  const f=await returnFixture(),{root,header}=f.game();f.loadGame=async()=>({setPortalMinimized:()=>false});f.module.initGameReturn();await settle();await header.querySelector('.portal-minimize').fire();await settle();
  assert.equal(root.hidden,false);assert.equal(root.inert,false);assert.equal(f.doc.body.querySelector('.portal-resume').hidden,true);f.dispose();
});
await test('account replacement never restores an old owner session or re-adopts its existing root',async()=>{
  const f=await returnFixture(),{root,header}=f.game();f.module.initGameReturn();await settle();await header.querySelector('.portal-minimize').fire();
  f.auth({uid:'bob'});await settle();assert.equal(f.doc.body.querySelector('.portal-resume').hidden,true);assert.equal(f.calls.filter(c=>c.hidden===false).length,0,'account replacement is not an authorized resume of the old game');
  assert.equal(root.isConnected,false);assert.equal(f.closes.length,1);assert.equal(f.closes[0].root,root,'the cleanup receives the captured old root');
  f.doc.body.append(f.doc.createElement('p'));await settle();assert.equal(header.querySelector('.portal-minimize'),null,'another DOM mutation cannot bind the same old game to Bob');
  const next=f.game();await settle();assert.ok(next.header.querySelector('.portal-minimize'),'a new root belongs to the replacement account');f.dispose();
});
await test('an import delayed across account replacement cannot capture the replacement uid as game owner',async()=>{
  const f=await returnFixture(),{header}=f.game();let release;f.loadGame=()=>new Promise(r=>release=r);f.module.initGameReturn();await settle();assert.equal(typeof release,'function');f.auth({uid:'bob'});
  release(f.gameModule('tetris'));await settle();assert.equal(header.querySelector('.portal-minimize'),null);
  f.doc.body.append(f.doc.createElement('p'));await settle();assert.equal(header.querySelector('.portal-minimize'),null);assert.equal(f.calls.length,0);assert.equal(f.closes.length,1);f.dispose();
});
await test('account replacement also closes a visible old root without applying a resume hook',async()=>{
  const f=await returnFixture(),{root}=f.game('chess');f.module.initGameReturn();await settle();f.auth({uid:'bob'});await settle();
  assert.equal(root.isConnected,false);assert.equal(f.closes.length,1);assert.equal(f.closes[0].root,root);assert.deepEqual(f.calls,[]);f.dispose();
});

console.log(`${groups} groups passed; ${failed} failed.`);if(failed)process.exitCode=1;
