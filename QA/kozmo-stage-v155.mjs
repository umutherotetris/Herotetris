// Real habitat controller with a minimal DOM/audio boundary, no browser/network.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/kozmo-stage.js',import.meta.url),'utf8')
  .replaceAll('import.meta.url',JSON.stringify('https://hero.test/js/kozmo-stage.js'))
  .replace(/^export default .*;$/gm,'').replace(/^export /gm,'')+'\nthis.mount=mountKozmoStage;';
class Node{
  constructor(tag='div'){this.tagName=tag.toLowerCase();this.childNodes=[];this.parentNode=null;this.className='';this.dataset={};this.attrs=new Map();this.handlers=new Map();this._text='';this.hidden=false;this.disabled=false;this.style={values:new Map(),setProperty(key,value){this.values.set(key,value);}};this.classList={add:(...xs)=>xs.forEach(x=>this._class(x,true)),remove:(...xs)=>xs.forEach(x=>this._class(x,false)),toggle:(x,force)=>this._class(x,force===undefined?!this.className.split(' ').includes(x):force),contains:x=>this.className.split(' ').includes(x)};}
  _class(value,add){const values=new Set(this.className.split(' ').filter(Boolean));add?values.add(value):values.delete(value);this.className=[...values].join(' ');return add;}
  get attributes(){return [...this.attrs].map(([name,value])=>({name,value}));}
  setAttribute(k,v){this.attrs.set(k,String(v));}getAttribute(k){return this.attrs.get(k)??null;}removeAttribute(k){this.attrs.delete(k);}
  append(...nodes){for(const node of nodes)this.appendChild(node);}appendChild(node){if(node.tagName==='#fragment'){for(const child of [...node.childNodes])this.appendChild(child);return node;}node.remove();this.childNodes.push(node);node.parentNode=this;return node;}
  replaceChildren(...nodes){for(const c of this.childNodes)c.parentNode=null;this.childNodes=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){this.parentNode.childNodes=this.parentNode.childNodes.filter(c=>c!==this);this.parentNode=null;}}
  get isConnected(){return this._connected===true||!!this.parentNode?.isConnected;}
  set textContent(value){for(const child of this.childNodes)child.parentNode=null;this.childNodes=[];this._text=String(value);}
  get textContent(){return this._text+this.childNodes.map(c=>c.textContent).join('');}
  addEventListener(t,fn){if(!this.handlers.has(t))this.handlers.set(t,new Set());this.handlers.get(t).add(fn);}removeEventListener(t,fn){this.handlers.get(t)?.delete(fn);}
  async fire(type='click',extra={}){for(const fn of this.handlers.get(type)||[])await fn({isTrusted:true,target:this,...extra});}
  getBoundingClientRect(){return {left:0,top:0,width:210,height:210};}
  querySelectorAll(selector){const matches=n=>selector==='*'||selector.split(',').some(x=>x.trim().startsWith('.')?n.classList.contains(x.trim().slice(1)):x.trim()==='link[data-kozmo-stage-style]'?n.tagName==='link'&&n.dataset.kozmoStageStyle!==undefined:n.tagName===x.trim().toLowerCase());const all=[];for(const child of this.childNodes){if(matches(child))all.push(child);all.push(...child.querySelectorAll(selector));}return all;}
  querySelector(s){return this.querySelectorAll(s)[0]||null;}
}
function parseFragment(html){
 const root=new Node('#fragment'),stack=[root];
 for(const match of html.matchAll(/<\/?([\w:-]+)([^>]*)>/g)){
  if(match[0][1]==='/'){if(stack.length>1)stack.pop();continue;}
  const node=new Node(match[1]);
  for(const attribute of match[2].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))node.setAttribute(attribute[1],attribute[2]??attribute[3]);
  stack.at(-1).append(node);if(!match[0].endsWith('/>')&&!['img','link','input','br','hr'].includes(node.tagName))stack.push(node);
 }
 return root;
}
function fixture({sound='0',reducedMotion=false}={}){
 const document=new Node('#document');document._connected=true;document.hidden=false;document.head=new Node('head');document.body=new Node('body');document.append(document.head,document.body);
 document.createElement=tag=>{const node=new Node(tag);if(tag==='template'){node.content=new Node('#fragment');Object.defineProperty(node,'innerHTML',{set:html=>node.content=parseFragment(html)});}return node;};
 const host=new Node();document.body.append(host);const storage=new Map([['hero_kozmo_sound',sound]]),timers=new Map(),audios=[],observers=[],mediaHandlers=new Set();let timerId=0;
 const media={matches:reducedMotion,addEventListener:(_,fn)=>mediaHandlers.add(fn),removeEventListener:(_,fn)=>mediaHandlers.delete(fn)};
 class Audio{
  constructor(){this.currentTime=0;this.state='running';this.oscs=[];this.resumes=0;this.suspends=0;this.closes=0;audios.push(this);}
  createOscillator(){const osc={frequency:{values:[],setValueAtTime(v){this.values.push(v);},exponentialRampToValueAtTime(v){this.values.push(v);}},connect(){},disconnect(){},start(){osc.started=true;},stop(){osc.stops=(osc.stops||0)+1;}};this.oscs.push(osc);return osc;}
  createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}
  resume(){this.resumes++;this.state='running';return Promise.resolve();}suspend(){this.suspends++;this.state='suspended';return Promise.resolve();}close(){this.closes++;this.state='closed';return Promise.resolve();}
 }
 class Observer{constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
 const context=vm.createContext({document,window:{AudioContext:Audio},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},matchMedia:()=>media,MutationObserver:Observer,URL,console,Math,Number,Object,Array,Set,Map,Promise,String,TypeError,
  setTimeout:(fn,ms)=>{const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source,context);
 const base={creature:{name:'Mira',level:3},type:{n:'Mira',r:'rare',c:'#a7c4ff',element:'Yıldız',power:'Yıldız Tozu Saçar',sound:'soft'},renderVisual:()=>'<svg><defs><linearGradient id="glow"/></defs><circle fill="url(#glow)"/></svg>'};
 return {document,host,storage,timers,audios,observers,media,mediaHandlers,base,mount:options=>context.mount(host,{...base,...options}),context};
}
let groups=0;
{
 const f=fixture(),stage=f.mount({creature:{name:'<img src=x onerror=alert(1)>',level:3}}),root=stage.element;
 assert.equal(root.querySelector('.kozmo-stage-name').textContent,'<img src=x onerror=alert(1)>');assert.equal(root.querySelectorAll('img').length,0);
 assert.equal(root.querySelector('.kozmo-stage-level').textContent,'Seviye 3');assert.equal(root.querySelector('.kozmo-stage-sound').getAttribute('aria-pressed'),'false');assert.equal(f.audios.length,0);
 f.mount();assert.equal(f.document.head.childNodes.length,1,'stylesheet is shared across mounts');groups++;
}
{
 const f=fixture({sound:'1'}),stage=f.mount();stage.react('pet');
 assert.equal(stage.element.dataset.reaction,'pet');assert.equal(stage.element.querySelector('.kozmo-stage-burst').childNodes.length,7);assert.equal(f.audios.length,0,'programmatic reactions never unlock audio');
 const timer=[...f.timers.values()][0];timer.fn();assert.equal(stage.element.dataset.reaction,undefined);assert.equal(stage.element.querySelector('.kozmo-stage-burst').childNodes.length,0);groups++;
}
{
 const f=fixture(),stage=f.mount(),toggle=stage.element.querySelector('.kozmo-stage-sound');
 await toggle.fire('click',{isTrusted:false});assert.equal(f.audios.length,0,'synthetic click is silent');assert.equal(f.storage.get('hero_kozmo_sound'),'1');
 await stage.element.querySelector('.kozmo-stage-action').fire();assert.equal(f.audios.length,1);assert.equal(f.audios[0].oscs.length,3);
 await toggle.fire();assert.equal(f.storage.get('hero_kozmo_sound'),'0');assert.ok(f.audios[0].oscs.every(o=>o.stops===2),'muting stops scheduled voices');groups++;
}
{
 const f=fixture({sound:'1'}),stage=f.mount();await stage.element.querySelector('.kozmo-stage-action').fire();const soft=f.audios[0].oscs[0].frequency.values[0];
 stage.update({type:{sound:'roar'}});await stage.element.querySelector('.kozmo-stage-action').fire();const roar=f.audios[0].oscs[3].frequency.values[0];assert.ok(roar<soft/2,'creature voices use different pitch families');groups++;
}
{
 const f=fixture({sound:'1'}),stage=f.mount();await stage.element.querySelector('.kozmo-stage-action').fire();f.document.hidden=true;await f.document.fire('visibilitychange');
 assert.equal(stage.element.classList.contains('is-paused'),true);assert.equal(f.audios[0].suspends,1);f.document.hidden=false;await f.document.fire('visibilitychange');
 assert.equal(stage.element.classList.contains('is-paused'),false);assert.equal(f.audios[0].resumes,0,'returning to a tab does not unlock sound');groups++;
}
{
 const f=fixture({reducedMotion:true}),stage=f.mount();stage.react('play');assert.equal(stage.element.classList.contains('is-reduced'),true);assert.equal(stage.element.querySelector('.kozmo-stage-burst').childNodes.length,0);
 f.media.matches=false;for(const fn of f.mediaHandlers)fn();assert.equal(stage.element.classList.contains('is-reduced'),false);groups++;
}
{
 const f=fixture();let resolve;const stage=f.mount({onActivate:()=>new Promise(r=>resolve=r)}),control=stage.element.querySelector('.kozmo-stage-activate');
 const pending=control.fire();stage.update({creature:{name:'Yeni Kozmo'},active:false});resolve(true);await pending;
 assert.equal(stage.element.querySelector('.kozmo-stage-name').textContent,'Yeni Kozmo');assert.equal(control.getAttribute('aria-pressed'),'false','late old creature activation cannot mark new selection active');groups++;
}
{
 const f=fixture(),stage=f.mount({onActivate:()=>false}),control=stage.element.querySelector('.kozmo-stage-activate');await control.fire();assert.equal(control.getAttribute('aria-pressed'),'false');
 stage.update({onActivate:()=>true});await control.fire();assert.equal(control.getAttribute('aria-pressed'),'true');assert.equal(stage.element.dataset.reaction,'activate');groups++;
}
{
 const f=fixture({sound:'1'}),stage=f.mount();await stage.element.querySelector('.kozmo-stage-action').fire();assert.ok(f.timers.size);stage.destroy();stage.destroy();
 assert.equal(f.timers.size,0);assert.equal(f.audios[0].closes,1);assert.ok(f.observers[0].disconnected);assert.equal(f.mediaHandlers.size,0);assert.equal(f.document.handlers.get('visibilitychange').size,0);assert.equal(stage.element.isConnected,false);groups++;
}
{
 const f=fixture(),stage=f.mount();f.host.remove();f.observers[0].fn();assert.equal(f.observers[0].disconnected,true,'closing parent automatically tears down habitat');groups++;
}
{
 const f=fixture(),stage=f.mount({renderVisual:()=>'<svg onclick="bad()"><script>bad()</script><foreignObject/><image href="https://evil.test/x"/><circle fill="url(#local)" style="background:url(https://evil.test/x)"/><use href="#local"/></svg>'}),visual=stage.element.querySelector('.kozmo-stage-actor-body');
 assert.equal(visual.querySelectorAll('script,foreignObject').length,0);assert.equal(visual.querySelector('svg').getAttribute('onclick'),null);assert.equal(visual.querySelector('image').getAttribute('href'),null);assert.equal(visual.querySelector('circle').getAttribute('style'),null);assert.equal(visual.querySelector('use').getAttribute('href'),'#local');groups++;
}
{
 const f=fixture(),stage=f.mount({onFeed:()=>false}),feed=stage.element.querySelector('.kozmo-stage-feed');assert.equal(feed.hidden,false);await feed.fire();assert.equal(stage.element.dataset.reaction,undefined,'failed feed cannot show success reaction');
 stage.update({onFeed:()=>true});await feed.fire();assert.equal(stage.element.dataset.reaction,'feed');groups++;
}
console.log(`PASS Kozmo premium habitat: ${groups} gesture, lifecycle, identity, reduced-motion, sanitizer and callback groups`);
