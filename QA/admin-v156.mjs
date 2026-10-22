// Actual admin module, isolated DOM and in-memory RTDB fault boundaries.
// No live user, notification, administrative operation or network is touched.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/admin.js',import.meta.url),'utf8')
  .replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;?$/gm,'').replace(/^export /gm,'')
  .replace(/import\('\.\/auth\.js'\)/g,'__authModule()')
  .replace(/import\('\.\/social\.js'\)/g,'__socialModule()')
  .replace(/import\('\.\/store\.js'\)/g,'Promise.resolve({default:Store})')
  .replace(/import\('\.\/'\+mod\)/g,'__checkModule(mod)');
const clone=value=>value==null?null:structuredClone(value);
const snap=value=>({val:()=>clone(value),exists:()=>value!=null,forEach:fn=>Object.entries(value||{}).forEach(([key,v])=>fn({...snap(v),key}))});
class Node{
 constructor(){this.children=new Map();this.handlers=new Map();this.attributes={};this.dataset={};this.style={display:'none'};this.disabled=false;this.isConnected=true;this.value='';this.innerHTML='';this.textContent='';this.selectedOptions=[{textContent:'1 saat'}];}
 querySelector(selector){if(!this.children.has(selector)){const n=new Node();for(const [_,key,value]of selector.matchAll(/\[data-([\w-]+)="([^"]+)"\]/g))n.dataset[key.replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]=value;this.children.set(selector,n);}return this.children.get(selector);}
 querySelectorAll(selector){if(selector.includes('button,input,select'))return Array.from(this.children.values());return [];}
 setAttribute(key,value){this.attributes[key]=value;}getAttribute(key){return this.attributes[key]??null;}removeAttribute(key){delete this.attributes[key];}
 addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);}
 async fire(type='click',event={}){for(const fn of this.handlers.get(type)||[])await fn({target:this,key:'',preventDefault(){},...event});}
 appendChild(node){return node;}remove(){this.isConnected=false;}focus(){this.focused=true;}scrollIntoView(){}getClientRects(){return[{}];}
}
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
function fixture(){
 const data={admins:{admin:true},users:{old:{nick:'Old',name:'Old',kaju:100,level:3},next:{nick:'Next',kaju:999}},nicks:{old:{uid:'old',nick:'Old',ts:1},next:{uid:'next',nick:'Next',ts:1}},presence:{old:{online:true,lastSeen:Date.now()}}};
 let state={uid:'admin',status:'google',isAdmin:true,displayName:'Admin'},queue=Promise.resolve(),serial=0;
 const writes=[],reads=[],storage=new Map(),listeners=[],subscribers=[],notices=[],hooks={beforeGet:null,beforeTx:null,afterTx:null,beforeSet:null,afterSet:null};
 const read=path=>path.split('/').filter(Boolean).reduce((value,key)=>value?.[key],data)??null;
 const put=(path,value)=>{const parts=path.split('/').filter(Boolean);let at=data;for(const part of parts.slice(0,-1))at=at[part]??={};if(value===null)delete at[parts.at(-1)];else at[parts.at(-1)]=clone(value);writes.push({path,value:clone(value)});};
 const rawFdb={ref:(_,path='')=>path,query:ref=>ref,limitToLast:n=>n,orderByChild:k=>k,equalTo:x=>x,
  get:async path=>{reads.push(path);if(hooks.beforeGet)await hooks.beforeGet(path);return snap(read(path));},
  set:async(path,value)=>{if(hooks.beforeSet)await hooks.beforeSet(path,value);put(path,value);if(hooks.afterSet)await hooks.afterSet(path,value);},
  update:async(path,fields)=>{for(const[key,value]of Object.entries(fields))await rawFdb.set(path?path+'/'+key:key,value);},
  push:async(path,value)=>{const ref=path+'/push'+(++serial);if(value!==undefined)await rawFdb.set(ref,value);return{key:'push'+serial};},
  runTransaction:(path,change,options)=>{assert.equal(options?.applyLocally,false);const run=queue.then(async()=>{if(hooks.beforeTx)await hooks.beforeTx(path);const next=change(clone(read(path)));if(next===undefined)return{committed:false,snapshot:snap(read(path))};put(path,next);return{committed:true,snapshot:snap(next)};});queue=run.catch(()=>{});return run.then(async result=>{if(hooks.afterTx)await hooks.afterTx(path,result);return result;});},
  onValue:(path,fn,error)=>{const entry={path,fn,error,active:true};listeners.push(entry);return()=>entry.active=false;}};
 const root=new Node(),target={uid:'old',profile:clone(data.users.old)},panel={root,target,ownerUid:'admin',authorized:true,searchVersion:0,off:[]};
 const elements=new Map(),opener=new Node(),document={activeElement:opener,head:new Node(),body:{appendChild:node=>{elements.set(node.id,node);return node;}},createElement:()=>new Node(),getElementById:id=>{const node=elements.get(id);return node?.isConnected?node:null;}};
 const Auth={getState:()=>state,subscribe:fn=>{subscribers.push(fn);fn(state);return()=>subscribers.splice(subscribers.indexOf(fn),1);},resolveNick:async nick=>({uid:nick==='Next'?'next':'old'}),searchNicks:async()=>[],validateNick:nick=>/^[\w]{3,16}$/.test(nick)?{ok:true,clean:nick}:{ok:false,error:'Geçersiz nick'}};
 const Store={getState:()=>({uid:state.uid,kaju:0}),adminAdjustKaju:async()=>({ok:true,newBalance:150,appliedDelta:50})};
 const context=vm.createContext({console,rawFdb,Auth,Store,db:{},document,window:{Hero:{toast:(...args)=>notices.push(args)},addEventListener(){}},navigator:{},alert:(...a)=>notices.push(a),confirm:()=>true,
  localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))},Date,Math,Number,Object,Array,Map,Set,Promise,JSON,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  __authModule:async()=>({ipKey:ip=>String(ip).replace(/\./g,'_'),isGhost:()=>false,setGhost:async()=>{}}),__socialModule:async()=>({GLOW_STYLES:{classic:{cls:'glow',label:'Classic'}}}),__checkModule:async()=>({})});
 vm.runInContext(source+`\nthis.A={setPanel:p=>P=p,getPanel:()=>P,getUsers:()=>_allUsersCache,setUsers:rows=>{_allUsersCache=rows;rebuildDupMap();},doSearch,loadTarget,renderTarget,doBan,doMute,doVice,doKick,doOP,refreshOPBtn,checkTargetIPBan,doIPBan,sendUserNotif,sendBroadcast,doForceNick,cleanAnonUsers,cleanDupNicks,cleanRegistry,rebuildRegistry,doDeleteUser,doResetProgress,toggleKHist,toggleChatLock,toggleAllUsers,openAdminPanel,closePanel,toggleLog,toggleOnline,toggleChatMod,refreshNickBans,toggleIPBans,runSystemCheckup};`,context);
 context.A.setPanel(panel);
 return{A:context.A,context,data,root,panel,target,document,opener,elements,reads,writes,hooks,listeners,storage,notices,rawFdb,read,put,
  node:selector=>root.querySelector(selector),setAuth:patch=>{state={...state,...patch};for(const fn of [...subscribers])fn(state);},emitRole:value=>{put('admins/admin',value);for(const listener of listeners)if(listener.active&&listener.path==='admins/admin')listener.fn(snap(value));}};
}
let groups=0;
async function test(name,run){await run();groups++;console.log('PASS',name);}
await test('missing owner/admin authority blocks all mutation entry points',async()=>{
 const f=fixture();f.setAuth({uid:'different'});
 for(const name of ['doBan','doMute','doVice','doKick','doOP','doIPBan','sendUserNotif','sendBroadcast','doForceNick','cleanAnonUsers','cleanDupNicks','cleanRegistry','rebuildRegistry','doDeleteUser','doResetProgress','toggleChatLock'])await f.A[name](true);
 assert.equal(f.writes.length,0);f.setAuth({uid:'admin',isAdmin:false});await f.A.doBan(true);assert.equal(f.writes.length,0);
});
await test('latest search and latest profile request own the selected user',async()=>{
 const f=fixture();let resolveOld;f.context.Auth.resolveNick=nick=>nick==='Old'?new Promise(resolve=>resolveOld=resolve):Promise.resolve({uid:'next'});
 f.node('[data-el="q"]').value='Old';const old=f.A.doSearch();f.node('[data-el="q"]').value='Next';await f.A.doSearch();resolveOld({uid:'old'});await old;assert.equal(f.panel.target.uid,'next');
 const g=fixture();let release;g.hooks.beforeGet=path=>path==='users/old'?new Promise(resolve=>release=resolve):undefined;
 const first=g.A.loadTarget('old');await g.A.loadTarget('next');release();await first;assert.equal(g.panel.target.uid,'next');
});
await test('UID path injection and missing users never load or create administrative targets',async()=>{
 const f=fixture();for(const uid of ['',null,'users/next','bad.key','a\n'])await f.A.loadTarget(uid);assert.equal(f.reads.length,0);
 f.panel.target={uid:'missing',profile:{}};await f.A.doBan(true);assert.equal(f.read('users/missing'),null);
});
await test('target change during preflight cannot ban or repaint the newly selected player',async()=>{
 const f=fixture();let release;f.hooks.beforeGet=path=>path==='users/old'?new Promise(resolve=>release=resolve):undefined;
 const pending=f.A.doBan(true);await settle();f.panel.target={uid:'next',profile:clone(f.data.users.next)};release();await pending;
 assert.equal(f.data.users.old.banned,undefined);assert.equal(f.data.users.next.banned,undefined);assert.equal(f.panel.target.profile.kaju,999);
});
await test('revoked authoritative role before mutation prevents writes even when Auth cache still says admin',async()=>{
 const f=fixture();f.put('admins/admin',null);await f.A.doMute(true);assert.equal(f.data.users.old.muted,undefined);assert.equal(f.A.getPanel(),null);
});
await test('account or role loss at transaction retry aborts user changes',async()=>{
 for(const change of [f=>f.setAuth({uid:'other'}),f=>{f.panel.authorized=false;},f=>f.setAuth({isAdmin:false})]){
  const f=fixture();f.hooks.beforeTx=path=>{if(path==='users/old')change(f);};await f.A.doVice();assert.equal(f.data.users.old.isVice,undefined);
 }
});
await test('ban and mute apply compatible metadata, finite allowed durations and protected admin checks',async()=>{
 const f=fixture();f.node('[data-el="dur"]').value='3600000';f.node('[data-el="reason"]').value='Reason';await f.A.doBan(true);
 assert.equal(f.data.users.old.banned,true);assert.equal(f.data.users.old.banReason,'Reason');assert.equal(f.data.users.old.bannedBy,'admin');assert.equal(f.data.users.old.banType,'temp');assert.equal(f.data.users.old.banSource,'admin-panel');assert.equal(f.data.users.old.banIPKey,null);
 await f.A.doBan(false);assert.equal(f.data.users.old.banned,false);f.node('[data-el="dur"]').value='NaN';await f.A.doMute(true);assert.equal(f.data.users.old.muted,undefined);
 const g=fixture();g.data.admins.old=true;await g.A.doVice();assert.equal(g.data.users.old.isVice,undefined);
});
await test('global busy lock prevents duplicate clicks and conflicting target actions',async()=>{
 const f=fixture();let release;f.hooks.beforeTx=path=>path==='users/old'?new Promise(resolve=>release=resolve):undefined;
 const pending=f.A.doVice();await settle();await f.A.doVice();await f.A.doKick();assert.equal(f.panel.busy,true);release();await pending;
 assert.equal(f.writes.filter(w=>w.path==='users/old').length,1);assert.equal(f.read('kicks/old'),null);assert.equal(f.panel.busy,false);
});
await test('kick uses the consumed signal path and does not report offline users as kicked',async()=>{
 const f=fixture();await f.A.doKick();assert.equal(f.read('kicks/old').by,'admin');assert.equal(f.data.users.old.kickSignal,undefined);
 const g=fixture();g.data.presence.old.online=false;await g.A.doKick();assert.equal(g.read('kicks/old'),null);assert.match(g.node('[data-el="msg"]').textContent,/çevrimiçi değil/);
});
await test('notification retry after a lost reply reuses one row and preserves edited text',async()=>{
 const f=fixture();f.node('[data-el="ntfText"]').value='Hello';let once=true;
 f.hooks.afterSet=path=>{if(path.startsWith('userNotifs/old/')&&once){once=false;throw new Error('Ack lost');}};
 await f.A.sendUserNotif();assert.equal(Object.keys(f.data.userNotifs.old).length,1);assert.equal(f.node('[data-el="ntfText"]').value,'Hello');
 f.hooks.afterSet=null;await f.A.sendUserNotif();assert.equal(Object.keys(f.data.userNotifs.old).length,1);assert.equal(f.node('[data-el="ntfText"]').value,'');
});
await test('broadcast retry is idempotent and cannot continue as a new account',async()=>{
 const f=fixture();f.node('[data-el="bcText"]').value='Announcement';let once=true;f.hooks.afterSet=path=>{if(path.startsWith('broadcasts/')&&once){once=false;throw new Error('Ack lost');}};
 await f.A.sendBroadcast();f.hooks.afterSet=null;await f.A.sendBroadcast();assert.equal(Object.keys(f.data.broadcasts).length,1);
});
await test('operator and IP reads belong to the original target and cannot default to unsafe writes',async()=>{
 const f=fixture();await f.A.doOP();assert.equal(f.read('gcOperators/old'),null);
 let release;f.hooks.beforeGet=path=>path==='gcOperators/old'?new Promise(resolve=>release=resolve):undefined;
 const old=f.A.refreshOPBtn();await settle();f.panel.target={uid:'next',profile:clone(f.data.users.next)};f.node('[data-el="opBtn"]').textContent='Next';release();await old;assert.equal(f.node('[data-el="opBtn"]').textContent,'Next');
 const g=fixture();g.target.profile.lastIP='127.0.0.1';await g.A.doIPBan();assert.equal(g.read('ipBans'),null);
});
await test('chat lock read failure and concurrent state change never write an invented state',async()=>{
 const f=fixture();f.hooks.beforeGet=path=>{if(path==='chatModeration/locked')throw new Error('Denied');};await f.A.toggleChatLock();assert.equal(f.read('chatModeration'),null);
 const g=fixture();g.hooks.beforeTx=path=>{if(path==='chatModeration/locked')g.put(path,{locked:true,by:'another'});};await g.A.toggleChatLock();assert.equal(g.read('chatModeration/locked').by,'another');assert.match(g.node('[data-el="msg"]').textContent,/başka bir yönetici/);
});
await test('force nick atomically claims available names and never releases another owner registry entry',async()=>{
 const f=fixture();f.node('[data-el="nNick"]').value='Fresh';f.data.nicks.old.uid='next';await f.A.doForceNick();assert.equal(f.data.users.old.nick,'Fresh');assert.equal(f.data.nicks.fresh.uid,'old');assert.equal(f.data.nicks.old.uid,'next');assert.equal(f.data.adminForcedNick.old.by,'admin');
 const g=fixture();g.node('[data-el="nNick"]').value='Taken';g.hooks.beforeTx=path=>{if(path==='nicks/taken')g.put(path,{uid:'next',nick:'Taken'});};await g.A.doForceNick();assert.equal(g.data.users.old.nick,'Old');assert.equal(g.data.nicks.taken.uid,'next');
 const h=fixture();h.node('[data-el="nNick"]').value='Fresh';h.hooks.beforeTx=path=>{if(path==='users/old')h.data.users.old.nick='Fresh';};await h.A.doForceNick();assert.equal(h.data.nicks.fresh.uid,'old','a concurrently completed rename must retain its registry ownership');
});
await test('anonymous cleanup revalidates money, receipts and roles instead of deleting stale cached profiles',async()=>{
 const f=fixture();f.data.users.empty={kaju:0};f.data.users.receipt={kaju:0,heroRewardClaims:{daily:{amount:10}}};f.A.setUsers([{uid:'empty',kaju:0},{uid:'receipt',kaju:0}]);
 f.hooks.beforeTx=path=>{if(path==='users/empty')f.put(path,{kaju:50});};await f.A.cleanAnonUsers();assert.equal(f.data.users.empty.kaju,50);assert.equal(f.data.users.receipt.heroRewardClaims.daily.amount,10);
 const g=fixture();g.data.users.empty={kaju:0};g.data.admins.empty=true;g.A.setUsers([{uid:'empty',kaju:0}]);await g.A.cleanAnonUsers();assert.ok(g.data.users.empty);
 const h=fixture();h.data.users.empty={kaju:0};h.data.kozmos={empty:{creatures:{pet:{name:'Pet'}}}};h.A.setUsers([{uid:'empty',kaju:0}]);await h.A.cleanAnonUsers();assert.ok(h.data.users.empty,'related pets prevent anonymous cleanup');
});
await test('duplicate cleanup preserves registry owner and concurrently changed nickname',async()=>{
 const f=fixture();f.data.users.next.nick='Old';f.A.setUsers([{uid:'old',nick:'Old'},{uid:'next',nick:'Old',kaju:999}]);f.hooks.beforeTx=path=>{if(path==='users/next')f.data.users.next.nick='Changed';};await f.A.cleanDupNicks();assert.equal(f.data.users.old.nick,'Old');assert.equal(f.data.users.next.nick,'Changed');
 const g=fixture();g.data.users.next.nick='Old';g.A.setUsers([{uid:'old',nick:'Old'},{uid:'next',nick:'Old',kaju:999}]);await g.A.cleanDupNicks();assert.equal(g.data.users.old.nick,'Old');assert.equal(g.data.users.next.nick,null);
});
await test('registry maintenance cannot delete a newly reassigned owner',async()=>{
 const f=fixture();f.data.nicks.orphan={uid:'missing',nick:'Orphan',ts:1};f.hooks.beforeTx=path=>{if(path==='nicks/orphan')f.put(path,{uid:'next',nick:'Orphan',ts:2});};await f.A.cleanRegistry();assert.equal(f.data.nicks.orphan.uid,'next');
});
await test('list identity uses snapshot keys, escaping names instead of trusting forged profile uid',async()=>{
 const f=fixture();f.data.users.old.uid='next';f.data.users.old.nick='<img onerror=bad>';await f.A.toggleAllUsers();assert.equal(f.A.getUsers().find(row=>row.nick.startsWith('<')).uid,'old');assert.match(f.node('[data-el="allusers"]').innerHTML,/&lt;img/);assert.doesNotMatch(f.node('[data-el="allusers"]').innerHTML,/<img/);
});
await test('delete refuses pending economic journals and authoritative admin targets',async()=>{
 const f=fixture();f.data.users.old.kajuOutbox={tx:{state:'queued',amount:50}};await f.A.doDeleteUser();assert.equal(f.data.users.old.deleted,undefined);assert.match(f.node('[data-el="msg"]').textContent,/İşlem Merkezi/);
 const g=fixture();g.data.admins.old=true;await g.A.doDeleteUser();assert.equal(g.data.users.old.deleted,undefined);
 await g.A.doResetProgress();assert.equal(g.data.users.old.kaju,100,'reset also rechecks authoritative target admin role');
});
await test('portal deletion preserves financial claims in a banned tombstone and never deletes another owner nickname',async()=>{
 const f=fixture();Object.assign(f.data.users.old,{heroRewardClaims:{wheel:{amount:50}},heroXPClaims:{xp:{amount:10}},heroShopPurchases:{p:{status:'complete'}},kajuSent:{dAmt:20},heroWalletRevision:4});f.data.nicks.old.uid='next';await f.A.doDeleteUser();
 assert.equal(f.data.users.old.deleted,true);assert.equal(f.data.users.old.banned,true);assert.equal(f.data.users.old.kaju,0);assert.equal(f.data.users.old.heroWalletRevision,5);assert.equal(f.data.users.old.heroRewardClaims.wheel.amount,50);assert.equal(f.data.users.old.heroXPClaims.xp.amount,10);assert.equal(f.data.users.old.kajuSent.dAmt,20);assert.equal(f.data.nicks.old.uid,'next');
});
await test('partial deletion is truthful and its durable cleanup can be retried without a second balance reset',async()=>{
 const f=fixture();f.hooks.beforeSet=path=>{if(path==='presence/old')throw new Error('Denied');};await f.A.doDeleteUser();assert.equal(f.data.users.old.deleted,true);assert.match(f.node('[data-el="msg"]').textContent,/temizlenemedi/);assert.equal(f.panel.target.uid,'old');
 f.hooks.beforeSet=null;f.data.users.old.kaju=7;await f.A.doDeleteUser();assert.equal(f.data.users.old.kaju,7);assert.equal(f.data.users.old.heroDeletionCleanup.status,'complete');assert.equal(f.panel.target,null);
});
await test('progress reset preserves paid journals and advances wallet, XP and match revisions',async()=>{
 const f=fixture();Object.assign(f.data.users.old,{heroWalletRevision:5,heroXPRevision:6,heroMatchRevision:7,heroRewardClaims:{wheel:{amount:10}},heroXPClaims:{match:{amount:20}},heroMatchClaims:{match:{outcome:'win'}},stats:{totalW:10},h2h:{next:{w:2}},matchHistory:{game:{result:'win'}}});
 await f.A.doResetProgress();const p=f.data.users.old;assert.equal(p.heroWalletRevision,6);assert.equal(p.heroXPRevision,7);assert.equal(p.heroMatchRevision,8);assert.equal(p.stats.totalW,0);assert.equal(p.h2h,null);assert.equal(p.matchHistory,null);assert.equal(p.heroXPClaims.match.amount,20);assert.equal(p.heroMatchClaims.match.outcome,'win');
});
await test('partial reset cleanup reports failure and retries its receipt without erasing new earnings',async()=>{
 const f=fixture();f.hooks.beforeSet=path=>{if(path==='leaderboard/kaju/old')throw new Error('Denied');};await f.A.doResetProgress();assert.equal(f.data.users.old.kaju,0);assert.equal(f.panel._resetCleanupPendingUid,'old');assert.match(f.node('[data-el="msg"]').textContent,/yan kayıt temizlenemedi/);
 f.data.users.old.kaju=42;f.hooks.beforeSet=null;await f.A.doResetProgress();assert.equal(f.data.users.old.kaju,42);assert.equal(f.panel._resetCleanupPendingUid,null);assert.equal(f.panel._resetCompletedUid,'old');
});
await test('history distinguishes positive stored spend amounts from income',async()=>{
 const f=fixture();f.data.users.old.kaju_history={spend:{type:'spend',amount:50,ts:1},sub:{type:'admin-sub',amount:25,ts:2},earn:{type:'earn',amount:100,ts:3}};
 await f.A.toggleKHist();const html=f.node('[data-el="khist"]').innerHTML;assert.match(html,/class="bad">−50/);assert.match(html,/class="bad">−25/);assert.match(html,/class="ok">\+100/);
});
await test('live role revocation closes panel, removes listeners and restores opener focus',async()=>{
 const f=fixture();f.A.closePanel();f.A.openAdminPanel();await settle();const panel=f.A.getPanel();assert.ok(panel);assert.equal(panel.root.attributes.role,'dialog');
 f.emitRole(null);assert.equal(f.A.getPanel(),null);assert.equal(panel.root.isConnected,false);assert.ok(f.listeners.every(listener=>!listener.active));assert.equal(f.opener.focused,true);
});
console.log(`PASS Admin v156: ${groups} actor, selection, authority, transaction, maintenance, deletion and UI lifecycle groups`);
