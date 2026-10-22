// Actual Kaju modal/card/admin callbacks with deferred account and Store boundaries.
// No browser, network, message, or production balance is changed.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const read=name=>fs.readFileSync(new URL('../js/'+name,import.meta.url),'utf8');
const ui=read('ui.js'),social=read('social.js'),admin=read('admin.js');
const modalCode=ui.slice(ui.indexOf('export function openKajuModal('),ui.indexOf('// Gelen Kaju bildirimi')).replace(/^export /gm,'').replace("await import('./firebase-config.js')",'await __config()').replace(/await import\(`https:\/\/www\.gstatic\.com\/firebasejs\/\$\{cfg\.FIREBASE_SDK\}\/firebase-database\.js`\)/,'await __database()');
const cardCode=social.slice(social.indexOf('function bindPlayerKajuSend('),social.indexOf('export async function openPlayerCard(')).replace("await import('./store.js')",'await __loadStore()');
const adminCode=admin.slice(admin.indexOf('async function doKaju('),admin.indexOf('// ── Nick zorla değiştir'));
class Node{
 constructor(){this.value='';this.disabled=false;this.isConnected=true;this.style={};this.dataset={};this.children=new Map();this.handlers=new Map();this.innerHTML='';this.textContent='';}
 querySelector(s){if(!this.children.has(s))this.children.set(s,new Node());return this.children.get(s);}
 querySelectorAll(s){return s==='[data-amt]'?(this.quick||[]):s==='.adm-sug-it'?(this.replaced||[]):[];}
 addEventListener(t,fn){if(!this.handlers.has(t))this.handlers.set(t,[]);this.handlers.get(t).push(fn);}
 async fire(t='click'){for(const fn of this.handlers.get(t)||[])await fn({target:this});}
 remove(){this.isConnected=false;}focus(){}scrollIntoView(){}
 replaceChildren(...nodes){this.replaced=nodes;}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(isAdmin=false){
 let uid='sender',role=isAdmin,resolve=async nick=>({uid:'recipient',nick}),load=async()=>store,database=async()=>fdb;
 const roots=new Map(),timers=[],messages=[],calls=[],logs=[];
 const store={
  transferRemaining:()=>({min:10,perTx:5000,hour:10000,day:50000,month:500000}),
  transferKaju:async(...args)=>{calls.push(['transfer',...args]);return {ok:true,amount:args[2],admin:role};},
  adminAdjustKaju:async(...args)=>{calls.push(['adjust',...args]);return {ok:true,appliedDelta:args[1],newBalance:100};},
  retryPendingTransfers:async txId=>{calls.push(['retry',txId]);return {ok:true,published:1,queued:0,confirmedIds:[txId]};}
 };
 const fdb={get:async()=>({exists:()=>false,val:()=>null}),ref:(_,path)=>path,getDatabase:()=>({}),query:x=>x,limitToLast:()=>15};
 const document={getElementById:id=>{const root=roots.get(id);return root?.isConnected?root:null;},createElement:()=>new Node(),body:{appendChild:node=>{roots.set(node.id,node);node.isConnected=true;}}};
 const context=vm.createContext({
  console,document,Auth:{getState:()=>({uid,status:uid?'google':'offline',isAdmin:role}),resolveNick:(...a)=>resolve(...a),searchNicks:async()=>[]},Store:store,
  fmt:n=>String(n),_toast:(...a)=>messages.push(a),setTimeout:(fn,ms)=>{const t={fn,ms};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cancelled=true;},
  __config:async()=>({FIREBASE_SDK:'fixture'}),__database:()=>database(),__loadStore:()=>load(),
  window:{Hero:{toast:(...a)=>messages.push(a)}},db:{},fdb,
  $:(root,s)=>root.querySelector(s),msg:(...a)=>messages.push(a),logAdmin:(...a)=>logs.push(a),esc:x=>String(x),Date,Math,Number,Object,Promise,
 });
 return {context,document,roots,timers,messages,calls,logs,store,fdb,setUid:value=>uid=value,setAdmin:value=>role=value,setResolve:fn=>resolve=fn,setLoad:fn=>load=fn,setDatabase:fn=>database=fn};
}
function modal(isAdmin=false){const f=fixture(isAdmin);vm.runInContext(modalCode,f.context);f.context.openKajuModal();f.ov=f.roots.get('kajuModal');f.nick=f.ov.querySelector('#kjNick');f.amount=f.ov.querySelector('#kjAmt');f.send=f.ov.querySelector('[data-act="send"]');f.message=f.ov.querySelector('#kjMsg');f.nick.value='Recipient';f.amount.value='100';return f;}
function card(isAdmin=false){const f=fixture(isAdmin);vm.runInContext(cardCode,f.context);f.ov=new Node();f.ov.id='pcPop';f.roots.set('pcPop',f.ov);f.box=new Node();f.box.style.display='block';f.toggle=new Node();f.amount=f.box.querySelector('[data-el="kajuAmtInput"]');f.amount.value='100';f.send=f.box.querySelector('[data-pc="kajusendgo"]');f.context.bindPlayerKajuSend(f.ov,f.toggle,f.box,'recipient','Recipient',{uid:'sender',isAdmin});return f;}
function panel(){const f=fixture(true);vm.runInContext(adminCode,f.context);f.root=new Node();f.target={uid:'old',profile:{kaju:50}};f.panel={root:f.root,target:f.target};f.context.P=f.panel;f.amount=f.root.querySelector('[data-el="kAmt"]');f.amount.value='-100';f.button=f.root.querySelector('[data-a="kaju"]');f.balance=f.root.querySelector('[data-el="kaju"]');return f;}
let groups=0;
{
 const f=modal();for(const value of ['1.5','NaN','Infinity','9007199254740992','0','-10']){f.amount.value=value;await f.send.fire();}
 assert.equal(f.calls.length,0,'invalid/non-admin negative values never reach Store');groups++;
}
{
 const f=modal();let release,lookups=0;f.setResolve(()=>{lookups++;return new Promise(r=>release=r);});
 const a=f.send.fire(),b=f.send.fire();await b;assert.equal(lookups,1,'queued duplicate clicks share the active send lock');
 f.setUid('other');release({uid:'recipient',nick:'Recipient'});await a;assert.equal(f.calls.length,0,'old-account lookup cannot submit as new account');groups++;
}
for(const invalidate of [f=>{f.nick.value='Different';f.nick.fire('input');},f=>{f.amount.value='200';},f=>f.ov.remove(),f=>{const replacement=new Node();replacement.id='kajuModal';f.roots.set('kajuModal',replacement);},f=>f.setAdmin(true)]){
 const f=modal();let release;f.setResolve(()=>new Promise(r=>release=r));const pending=f.send.fire();invalidate(f);release({uid:'recipient',nick:'Recipient'});await pending;assert.equal(f.calls.length,0,'replaced recipient, amount, modal, or role invalidates prepared transfer');groups++;
}
{
 const f=modal(true);let n=0;f.store.transferKaju=async(...args)=>{f.calls.push(args);return ++n===1?{ok:false,uncertain:true,error:'Onay belirsiz'}:{ok:true,amount:40,admin:true};};
 await f.send.fire();await f.send.fire();assert.equal(f.calls.length,2);assert.equal(f.calls[0][3].txId,f.calls[1][3].txId,'same-form uncertain retry retains operation ID');
 assert.match(f.message.textContent,/40 Kaju/);assert.doesNotMatch(f.message.textContent,/100 Kaju/);await f.send.fire();assert.equal(f.calls.length,2,'completed send remains locked until modal closes');groups++;
}
{
 const f=modal();f.store.transferKaju=async(...args)=>{f.calls.push(args);return {ok:true,amount:100,pending:true,txId:'saved-tx'};};
 await f.send.fire();assert.equal(f.nick.disabled,true);assert.equal(f.amount.disabled,true);assert.equal(f.send.textContent,'Teslimi yeniden dene');assert.match(f.message.textContent,/iletilmesi bekleniyor/);
 await f.send.fire();assert.equal(f.calls.length,2);assert.equal(f.calls[1][0],'retry','retry republishes original instead of debiting a new transfer');assert.equal(f.send.disabled,true);groups++;
}
{
 const f=modal(true);let release;f.setResolve(()=>new Promise(r=>release=r));f.amount.value='-100';const p=f.send.fire();f.setAdmin(false);release({uid:'recipient',nick:'Recipient'});await p;assert.equal(f.calls.length,0,'revoked admin role cancels a prepared deduction');groups++;
}
{
 const f=modal(true);let release;f.setResolve(()=>new Promise(r=>release=r));f.nick.value='Old';await f.nick.fire('input');const task=f.timers.find(t=>t.ms===400);const p=task.fn();f.nick.value='New';await f.nick.fire('input');release({uid:'old',nick:'Old'});await p;assert.doesNotMatch(f.message.textContent,/Old/,'late admin lookup cannot paint a changed recipient');groups++;
}
{
 const f=modal(true);let release;f.fdb.get=()=>new Promise(r=>release=r);await f.nick.fire('input');const preview=f.timers.find(t=>t.ms===400).fn();await flush();assert.ok(release);
 await f.send.fire();const success=f.message.textContent;release({val:()=>1});await preview;assert.equal(f.message.textContent,success,'balance preview started before a send cannot overwrite its confirmed result');groups++;
}
{
 const f=panel();let release;f.store.adminAdjustKaju=(...args)=>{f.calls.push(args);return new Promise(r=>release=r);};const a=f.context.doKaju(),b=f.context.doKaju();await b;assert.equal(f.calls.length,1);
 const next={uid:'new',profile:{kaju:999}};f.panel.target=next;release({ok:true,appliedDelta:-50,newBalance:0});await a;
 assert.equal(f.target.profile.kaju,0);assert.equal(next.profile.kaju,999,'late old result must not overwrite newly selected target');assert.equal(f.logs[0][1],'old');assert.equal(f.logs[0][2],'-50 → 0','audit uses actual clamp delta');assert.equal(f.balance.textContent,'');groups++;
}
{
 const f=panel();let release;f.store.adminAdjustKaju=()=>new Promise(r=>release=r);const p=f.context.doKaju();f.setUid('other');release({ok:true,appliedDelta:-50,newBalance:0});await p;assert.equal(f.logs.length,0);assert.equal(f.target.profile.kaju,50,'old admin callback cannot repaint or log under a different account');groups++;
}
{
 const f=panel();for(const value of ['NaN','Infinity','1.5','9007199254740992','0']){f.amount.value=value;await f.context.doKaju();}assert.equal(f.calls.length,0);groups++;
}
{
 const f=panel();let n=0;f.store.adminAdjustKaju=async(...args)=>{f.calls.push(args);return ++n===1?{ok:false,uncertain:true,error:'Onay belirsiz'}:{ok:true,appliedDelta:-50,newBalance:0};};
 await f.context.doKaju();await f.context.doKaju();assert.equal(f.calls[0][3],f.calls[1][3]);assert.equal(f.amount.value,'');await f.context.doKaju();assert.equal(f.calls.length,2,'cleared successful form prevents rapid reapplication');groups++;
}
{
 const f=panel();const box=f.root.querySelector('[data-el="khist"]');box.style.display='none';let release;f.fdb.get=()=>new Promise(r=>release=r);const p=f.context.toggleKHist();f.panel.target={uid:'new',profile:{}};box.innerHTML='New target';release({exists:()=>false});await p;assert.equal(box.innerHTML,'New target');groups++;
}
{
 const f=card();let release,loads=0;f.setLoad(()=>{loads++;return new Promise(r=>release=r);});const a=f.send.fire(),b=f.send.fire();await b;assert.equal(loads,1);f.setUid('other');release(f.store);await a;assert.equal(f.calls.length,0);groups++;
}
{
 const f=card(true);f.store.transferKaju=async(...args)=>{f.calls.push(args);return {ok:true,amount:30,admin:true};};await f.send.fire();assert.match(f.messages.at(-1)[0],/30 Kaju bakiyeye eklendi/);await f.send.fire();assert.equal(f.calls.length,1);groups++;
}
{
 const f=card();f.store.transferKaju=async(...args)=>{f.calls.push(args);return {ok:true,amount:100,pending:true,txId:'card-tx'};};await f.send.fire();assert.match(f.messages.at(-1)[0],/iletilmesi bekleniyor/);assert.equal(f.amount.disabled,true);await f.send.fire();assert.equal(f.calls.at(-1)[0],'retry');assert.equal(f.calls.length,2);groups++;
}
{
 const f=card();let n=0;f.store.transferKaju=async(...args)=>{f.calls.push(args);return ++n<3?{ok:false,error:'Onay belirsiz'}:{ok:true,amount:200};};await f.send.fire();await f.send.fire();assert.equal(f.calls[0][3].txId,f.calls[1][3].txId);f.amount.value='200';await f.send.fire();assert.notEqual(f.calls[1][3].txId,f.calls[2][3].txId,'edited amount creates a distinct requested operation');groups++;
}
{
 const f=card();for(const value of ['1.5','NaN','Infinity','9007199254740992','0','-10']){f.amount.value=value;await f.send.fire();}assert.equal(f.calls.length,0);groups++;
}
for(const make of [modal,card])for(const failed of [undefined,{ok:false,error:'Read denied'},{ok:true,queued:0,confirmedIds:['another-transfer']}]){
 const f=make();f.store.transferKaju=async()=>({ok:true,amount:100,pending:true,txId:'requested-transfer'});await f.send.fire();
 f.store.retryPendingTransfers=async()=>failed;await f.send.fire();
 const text=f.message?.textContent??f.messages.at(-1)?.[0];assert.match(text,/henüz doğrulanamadı/,'missing, rejected, or unrelated recovery result cannot report this gift published');
 assert.equal(f.send.disabled,false);assert.equal(f.send.textContent,'Teslimi yeniden dene');groups++;
}
{
 const f=fixture(),toasts=[];f.context.kajuToast=text=>toasts.push(text);
 vm.runInContext(ui.slice(ui.indexOf('function onKajuClaimed('),ui.indexOf("window.addEventListener('hero:kaju-claimed'")),f.context);
 for(const detail of [{uid:'other',total:50},{ownerUid:'other',total:50},{uid:'sender',total:NaN},{uid:'sender',total:Infinity},{uid:'sender',total:1.5}])f.context.onKajuClaimed({detail});
 assert.equal(toasts.length,0,'stale-account or invalid incoming events cannot announce a credit');
 f.context.onKajuClaimed({detail:{uid:'sender',total:50,claimed:[{from:'Bob'}]}});assert.equal(toasts.length,1);assert.match(toasts[0],/50 Kaju geldi.*Bob/);groups++;
}
console.log(`PASS Kaju UI v155: ${groups} duplicate, target/account/role isolation, actual amount, queued recovery and stable retry groups`);
