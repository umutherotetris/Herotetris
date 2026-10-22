// Actual ES modules with in-memory Auth, DOM, storage and serialized Firebase
// transactions. No external service, social message or account mutation.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import * as Model from '../js/private-tournament-model.js';
let serial=0,groups=0,failed=0;
globalThis.__centerFixtures=Object.create(null);
const clone=x=>x==null?null:structuredClone(x),snap=x=>({val:()=>clone(x),exists:()=>x!=null});
const settle=async()=>{for(let n=0;n<8;n++)await new Promise(resolve=>setImmediate(resolve));};
const dataURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
async function module(file,f){
  const id='f'+serial++;globalThis.__centerFixtures[id]=f;
  const from=`globalThis.__centerFixtures[${JSON.stringify(id)}]`;
  let code=fs.readFileSync(new URL('../js/'+file,import.meta.url),'utf8')
    .replace(/^import \{([^}]+)\} from ['"]\.\/auth\.js['"];?$/gm,(_line,names)=>`const {${names}}=${from};`)
    .replace(/^import Store from ['"]\.\/store\.js['"];?$/gm,`const Store=${from}.Store;`)
    .replace(/^import \{([^}]+)\} from ['"]\.\/portal-panels\.js['"];?$/gm,(_line,names)=>`const {${names}}=${from}.panels;`)
    .replace(/^import \{([^}]+)\} from ['"]\.\/private-tournament-model\.js['"];?$/gm,(_line,names)=>`const {${names}}=${from}.Model;`)
    .replace(/import\('\.\/([^']+)'\)/g,(_line,path)=>`Promise.resolve(${from}.modules[${JSON.stringify(path)}]||{})`)
    .replaceAll('import.meta.url',JSON.stringify(new URL('../js/'+file,import.meta.url).href));
  return import(dataURL(code+`\n// actual module fixture ${id}`));
}
class Node{
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.doc=doc;this.children=[];this.parentNode=null;this.attributes={};this.listeners=new Map();this.className='';this._text='';this.disabled=false;this.hidden=false;this.style={setProperty(){}};
    this.classList={add:(...cs)=>{this.className=[...new Set([...this.className.split(/\s+/),...cs])].filter(Boolean).join(' ');},remove:c=>{this.className=this.className.split(/\s+/).filter(x=>x!==c).join(' ');},contains:c=>this.className.split(/\s+/).includes(c),toggle:(c,on)=>{if(on===undefined)on=!this.classList.contains(c);if(on)this.classList.add(c);else this.classList.remove(c);return on;}};}
  get isConnected(){return this===this.doc.body||this===this.doc.head||!!this.parentNode?.isConnected;}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('');}
  set textContent(value){this.replaceChildren();this._text=String(value??'');}
  get firstChild(){return this.children[0]||null;}
  get childNodes(){return this.children;}
  append(...nodes){for(const node of nodes){node.remove?.();node.parentNode=this;this.children.push(node);}}
  appendChild(node){this.append(node);return node;}
  prepend(...nodes){for(const node of [...nodes].reverse()){node.remove?.();node.parentNode=this;this.children.unshift(node);}}
  replaceChildren(...nodes){for(const c of this.children)c.parentNode=null;this.children=[];this._text='';this.append(...nodes);}
  remove(){if(this.parentNode){const p=this.parentNode;p.children=p.children.filter(n=>n!==this);this.parentNode=null;}}
  setAttribute(key,value){this.attributes[key]=String(value);if(key==='id')this.id=String(value);}
  removeAttribute(key){delete this.attributes[key];}
  getAttribute(key){return this.attributes[key]??null;}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  dispatchEvent(e){this.fire(e.type,e);return true;}
  async fire(type,patch={}){const e={target:this,preventDefault(){},...patch,type};await Promise.all([...this.listeners.get(type)||[]].map(fn=>fn(e)));}
  focus(){this.doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent({type:'close'});}
  matches(selector){if(selector.startsWith('#'))return this.id===selector.slice(1);if(selector.startsWith('.'))return this.classList.contains(selector.slice(1));return this.tagName.toLowerCase()===selector.toLowerCase();}
  querySelectorAll(selector){const selectors=selector.split(',').map(x=>x.trim()),all=[];for(const c of this.children){if(selectors.some(s=>c.matches(s)))all.push(c);all.push(...c.querySelectorAll(selector));}return all;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  getBoundingClientRect(){return{left:0,top:0,right:500,bottom:600};}
}
function fixture(){
  const storage=new Map(),subscribers=new Set(),live=new Set(),writes=[],dbData={privateTournaments:{},users:{alice:{kaju:100}}},hooks={beforeTx:null,afterTx:null,get:null};
  let state={uid:'alice',status:'google',displayName:'Alice'},queue=Promise.resolve();
  const doc={activeElement:null,hidden:false,events:new Map(),createElement:tag=>new Node(tag,doc),getElementById:id=>[doc.body,doc.head].flatMap(n=>[n,...n.querySelectorAll('#'+id)]).find(n=>n.id===id)||null,
    addEventListener(type,fn){if(!this.events.has(type))this.events.set(type,new Set());this.events.get(type).add(fn);},removeEventListener(type,fn){this.events.get(type)?.delete(fn);}};
  doc.body=new Node('body',doc);doc.head=new Node('head',doc);
  const read=path=>path.split('/').reduce((at,k)=>at?.[k],dbData)??null;
  const write=(path,value)=>{const keys=path.split('/');let at=dbData;for(const k of keys.slice(0,-1))at=at[k]??={};at[keys.at(-1)]=clone(value);writes.push({path,value:clone(value)});};
  const f={Model,db:{},doc,storage,subscribers,live,writes,dbData,hooks,modules:{},panels:{},read,write,
    Auth:{getState:()=>state,subscribe:fn=>{subscribers.add(fn);fn(state);return()=>subscribers.delete(fn);}},
    Store:{getKajuLog:()=>[],subscribe:fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);},retryPendingTransfers:async()=>[],claimPendingTransfers:async()=>[]},
    fdb:{ref:(_db,path)=>path,get:async path=>hooks.get?hooks.get(path):snap(read(path)),
      onValue:(path,fn)=>{const l={path,fn};live.add(l);return()=>live.delete(l);},
      runTransaction:(path,update,options)=>{const run=queue.then(async()=>{if(hooks.beforeTx)await hooks.beforeTx(path,options);const value=update(clone(read(path)));if(value===undefined)return{committed:false,snapshot:snap(read(path))};write(path,value);const result={committed:true,snapshot:snap(value)};if(hooks.afterTx)await hooks.afterTx(path,result);return result;});queue=run.catch(()=>{});return run;}}
  };
  f.auth=patch=>{state={...state,...patch};for(const fn of [...subscribers])fn(state);};
  f.emit=(path,value)=>{for(const l of live)if(l.path===path)l.fn(snap(value));};
  globalThis.document=doc;globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:webcrypto});
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async()=>{}}}});
  return f;
}
async function centerFixture(){const f=fixture();f.panels=await module('portal-panels.js',f);return f;}
async function test(name,run){try{await run();groups++;console.log('PASS',name);}catch(error){failed++;console.error('FAIL',name,error.stack?.replace(/data:text\/javascript;base64,[A-Za-z0-9+/=]+/g,'<actual-module>'));}}
const click=async node=>{assert.ok(node,'control exists');if(!node.disabled)await node.fire('click');await settle();};
const byText=(root,text)=>root.querySelectorAll('button').find(n=>n.textContent===text);

await test('round robin schedules every pair once and never double-books a participant in one round',()=>{
  for(let size=2;size<=8;size++){
    const members=Object.fromEntries(Array.from({length:size},(_,n)=>['u'+n,{name:'P'+n}])),matches=Object.values(Model.tournamentMatches(members));
    assert.equal(matches.length,size*(size-1)/2);const pairs=new Set(),rounds=new Map();
    for(const m of matches){const pair=[m.a,m.b].sort().join(':');assert.ok(!pairs.has(pair));pairs.add(pair);const used=rounds.get(m.round)||new Set();assert.ok(!used.has(m.a)&&!used.has(m.b));used.add(m.a);used.add(m.b);rounds.set(m.round,used);}
  }
});
await test('only both real participants agreeing finalizes points; conflicts remain editable',()=>{
  const t={status:'playing',members:{alice:{name:'A'},bob:{name:'B'}},matches:{m0:{a:'alice',b:'bob',status:'pending',proposals:{}}}};
  assert.throws(()=>Model.proposeTournamentResult(t,'m0','mallory','a'));
  const a=Model.proposeTournamentResult(t,'m0','alice','a'),conflict=Model.proposeTournamentResult(a,'m0','bob','b');
  assert.equal(conflict.status,'playing');assert.equal(Model.tournamentStandings(conflict)[0].points,0);assert.equal(t.matches.m0.proposals.alice,undefined);
  const agreed=Model.proposeTournamentResult(conflict,'m0','bob','a');assert.equal(agreed.status,'complete');assert.equal(Model.tournamentStandings(agreed).find(r=>r.uid==='alice').points,3);
  assert.deepEqual(Model.proposeTournamentResult(agreed,'m0','alice','a'),agreed,'an acknowledged final match remains idempotent after tournament completion');
  const draw=Model.proposeTournamentResult(Model.proposeTournamentResult(t,'m0','alice','draw'),'m0','bob','draw');
  assert.deepEqual(Model.tournamentStandings(draw).map(r=>r.points),[1,1]);
});
await test('standings reject self matches and repeated pairs instead of crediting fabricated extra games',()=>{
  const members={alice:{name:'A'},bob:{name:'B'}},good={a:'alice',b:'bob',status:'complete',result:'a',proposals:{alice:'a',bob:'a'}};
  const rows=Model.tournamentStandings({members,matches:{self:{...good,b:'alice'},m0:good,duplicate:{...good}}});
  assert.equal(rows.find(r=>r.uid==='alice').played,1);assert.equal(rows.find(r=>r.uid==='alice').points,3);
});
await test('concurrent joins serialize against the same code without losing members and stay idempotent',async()=>{
  const f=fixture(),m=await module('private-tournaments.js',f),code='ABCDEFGH';
  f.write('privateTournaments/'+code,{v:1,ownerUid:'alice',name:'Cup',game:'chess',status:'waiting',members:{alice:{name:'A'}}});
  await Promise.all([m.joinPrivateTournament(code),m.joinPrivateTournament(code)]);
  assert.equal(Object.keys(f.read('privateTournaments/'+code).members).length,1);
  f.auth({uid:'bob',displayName:'Bob'});await Promise.all([m.joinPrivateTournament(code),m.joinPrivateTournament(code)]);
  assert.deepEqual(Object.keys(f.read('privateTournaments/'+code).members).sort(),['alice','bob']);
  assert.equal(f.writes.filter(w=>Object.hasOwn(w.value.members||{},'bob')).length,1);
});
await test('independent clients racing the eighth seat preserve one winner and never admit a ninth member',async()=>{
  const a=fixture(),aModule=await module('private-tournaments.js',a),code='ABCDEFGH';
  const b=fixture();b.fdb=a.fdb;b.db=a.db;b.auth({uid:'bob',displayName:'Bob'});const bModule=await module('private-tournaments.js',b);
  const members=Object.fromEntries(['host','c','d','e','f','g','h'].map(uid=>[uid,{name:uid}]));
  a.write('privateTournaments/'+code,{v:1,ownerUid:'host',game:'chess',status:'waiting',members});
  const results=await Promise.allSettled([aModule.joinPrivateTournament(code),bModule.joinPrivateTournament(code)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
  const saved=a.read('privateTournaments/'+code);assert.equal(Object.keys(saved.members).length,8);assert.notEqual(!!saved.members.alice,!!saved.members.bob);
});
await test('tournament membership, participant limit and owner-only schedule changes hold inside transactions',async()=>{
  const f=fixture(),m=await module('private-tournaments.js',f),code='ABCDEFGH';
  const members=Object.fromEntries(['alice','bob','c','d','e','f','g','h'].map(uid=>[uid,{name:uid}]));
  f.write('privateTournaments/'+code,{v:1,ownerUid:'alice',game:'tetris',status:'waiting',members});f.auth({uid:'extra'});
  await assert.rejects(m.joinPrivateTournament(code),/dolu/);f.auth({uid:'bob'});await assert.rejects(m.updatePrivateTournament(code,'start'),/kurucusuna/);
  f.auth({uid:'alice'});await m.updatePrivateTournament(code,'start');assert.equal(Object.keys(f.read('privateTournaments/'+code).matches).length,28);
  f.auth({uid:'extra'});await assert.rejects(m.joinPrivateTournament(code),/kapanmış/);
});
await test('a transaction delayed across account replacement cannot write the old tournament identity',async()=>{
  const f=fixture(),m=await module('private-tournaments.js',f),code='ABCDEFGH';
  f.write('privateTournaments/'+code,{v:1,ownerUid:'alice',game:'chess',status:'waiting',members:{alice:{name:'A'}}});
  f.auth({uid:'bob'});let release;f.hooks.beforeTx=()=>new Promise(r=>release=r);const pending=m.joinPrivateTournament(code);await settle();f.auth({uid:'charlie'});release();
  await assert.rejects(pending,/Hesap/);assert.equal(f.read('privateTournaments/'+code).members.bob,undefined);
});
await test('a committed create with lost acknowledgement is recovered using its existing code',async()=>{
  const f=fixture(),m=await module('private-tournaments.js',f);let once=true;f.hooks.afterTx=()=>{if(once){once=false;throw Error('ack lost');}};
  const code=await m.createPrivateTournament({name:'Cup',game:'chess'});assert.ok(Model.validTournamentCode(code));
  assert.equal(Object.keys(f.dbData.privateTournaments).length,1);assert.ok(f.storage.get('hero_private_tournaments:alice').includes(code));
});

await test('daily puzzle is deterministic, clone-safe, legal and has exactly one winning empty cell',async()=>{
  const f=fixture(),m=await module('daily-puzzle.js',f);
  for(let n=0;n<366;n++){
    const day=new Date(Date.UTC(2028,0,n+1)).toISOString().slice(0,10),p=m.dailyPuzzle(day),again=m.dailyPuzzle(day);
    assert.deepEqual(p,again);assert.equal(m.puzzleWinner(p.board),null);assert.equal(p.board.filter(c=>c==='X').length,p.board.filter(c=>c==='O').length);
    const wins=[];p.board.forEach((v,i)=>{if(!v){const next=[...p.board];next[i]='X';if(m.puzzleWinner(next)==='X')wins.push(i);}});assert.deepEqual(wins,[p.answer]);
    p.board[0]='bad';assert.notEqual(m.dailyPuzzle(day).board[0],'bad');
  }
  for(const day of ['2026-02-30','x','2026-13-01','2026-10-2'])assert.throws(()=>m.dailyPuzzle(day),/Geçersiz/);
});
await test('puzzle completion rejects forged identity/date/answer, is idempotent and stays account scoped',async()=>{
  const f=fixture(),m=await module('daily-puzzle.js',f),p=m.dailyPuzzle();
  assert.equal(m.completeDailyPuzzle({...p,id:'forged'},p.answer).ok,false);assert.equal(m.completeDailyPuzzle(p,-1).ok,false);
  assert.equal(m.completeDailyPuzzle(p,p.answer).correct,true);const first=f.storage.get('hero_daily_puzzles:alice');
  assert.equal(m.completeDailyPuzzle(p,p.answer).already,true);assert.equal(f.storage.get('hero_daily_puzzles:alice'),first);
  const old=m.dailyPuzzle('2020-01-01');assert.equal(m.completeDailyPuzzle(old,old.answer).ok,false);
  f.auth({uid:'bob'});assert.deepEqual(m.getPuzzleProgress('alice'),{});assert.equal(m.completeDailyPuzzle(p,p.answer,'alice').ok,false);
});
await test('puzzle history remains bounded at 60 valid days and reports storage failure without inventing a saved completion',async()=>{
  const f=fixture(),m=await module('daily-puzzle.js',f),past={};for(let n=0;n<90;n++)past[new Date(Date.UTC(2020,0,n+1)).toISOString().slice(0,10)]={at:n};
  f.storage.set('hero_daily_puzzles:alice',JSON.stringify(past));const p=m.dailyPuzzle();assert.equal(m.completeDailyPuzzle(p,p.answer).ok,true);assert.equal(Object.keys(m.getPuzzleProgress()).length,60);
  f.storage.delete('hero_daily_puzzles:alice');const real=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};
  try{const result=m.completeDailyPuzzle(p,p.answer);assert.equal(result.ok,false);assert.equal(result.correct,true);assert.match(result.error,/kaydedilemedi/);}finally{localStorage.setItem=real;}
});

await test('review archives clone frames, limit history and frames, and reject cross-account access',async()=>{
  const f=fixture(),m=await module('game-review.js',f),frames=Array.from({length:150},(_,n)=>({n,board:[[n]]}));
  const first=m.recordGameReview({game:'tetris',frames,insights:['real metric']});assert.equal(first.frames.length,120);assert.equal(first.frames[0].n,30);frames[149].board[0][0]=999;
  assert.equal(m.getGameReviews()[0].frames.at(-1).board[0][0],149);
  for(let n=0;n<16;n++)m.recordGameReview({game:'chess',frames:[{n}]});assert.equal(m.getGameReviews().length,12);
  assert.equal(m.recordGameReview({uid:'bob',game:'tetris',frames:[]}),null);f.auth({uid:'bob'});assert.deepEqual(m.getGameReviews('alice'),[]);
  assert.equal(await m.openGameReview(first,{renderFrame(){throw Error('must not render old account');}}),null);
});
await test('large or unsavable review reports the limit truthfully and never crashes the archive',async()=>{
  const f=fixture(),m=await module('game-review.js',f),tooLarge=m.recordGameReview({game:'tetris',frames:[{text:'x'.repeat(1500000)}]});
  assert.equal(tooLarge.saved,false);assert.equal(tooLarge.frames.length,0);assert.match(tooLarge.error,/sınır/);
  const cyclic={};cyclic.self=cyclic;assert.equal(m.recordGameReview({game:'chess',frames:[cyclic]}),null);
  const real=localStorage.setItem;localStorage.setItem=()=>{throw Error('quota');};
  try{const result=m.recordGameReview({game:'chess',frames:[{board:[]} ]});assert.equal(result.saved,false);assert.equal(result.frames.length,1);assert.match(result.error,/depolaması/);}finally{localStorage.setItem=real;}
});
await test('review playback remains read-only and stops timers/listeners when its account changes',async()=>{
  const f=await centerFixture(),m=await module('game-review.js',f),review=m.recordGameReview({game:'tetris',frames:[{label:'a',board:[[1]]},{label:'b',board:[[2]]}]}),calls=[],timers=new Map();
  const realSet=globalThis.setInterval,realClear=globalThis.clearInterval;let sequence=0;
  globalThis.setInterval=(fn,delay)=>{const id=++sequence;timers.set(id,{fn,delay});return id;};globalThis.clearInterval=id=>timers.delete(id);
  try{
    const before=JSON.stringify(review),panel=await m.openGameReview(review,{renderFrame:(frame,host)=>{calls.push(frame.label);host.textContent=frame.label;}});
    await click(byText(panel.body,'▶ Oynat'));assert.equal(timers.size,1);assert.equal(f.doc.events.get('visibilitychange').size,1);
    const tick=[...timers.values()][0].fn;tick();assert.equal(calls.at(-1),'b');assert.equal(JSON.stringify(review),before);
    f.auth({uid:'bob'});assert.equal(timers.size,0);assert.equal(f.doc.events.get('visibilitychange').size,0);assert.equal(f.subscribers.size,0);
    const count=calls.length;tick();assert.equal(calls.length,count,'a queued old interval cannot render a replaced account');
  }finally{globalThis.setInterval=realSet;globalThis.clearInterval=realClear;}
});

await test('panel replacement/closure releases resources once and executes late cleanup immediately',async()=>{
  const f=await centerFixture();let normal=0,late=0;
  const p=f.panels.openPanel({id:'test',title:'Title'});p.cleanup(()=>normal++);assert.equal(f.subscribers.size,1);
  const replacement=f.panels.openPanel({id:'test',title:'New'});assert.equal(p.current(),false);assert.equal(normal,1);assert.equal(f.subscribers.size,1);
  p.cleanup(()=>late++);assert.equal(late,1);p.close();assert.equal(normal,1);
  f.auth({uid:'bob'});assert.equal(replacement.current(),false);assert.equal(f.subscribers.size,0);
});
await test('an already-replaced account cannot leak an immediate panel auth subscription',async()=>{
  const f=await centerFixture();const p=f.panels.openPanel({id:'stale',title:'Old account',uid:'bob'});
  assert.equal(p.current(),false);assert.equal(p.dialog.isConnected,false);assert.equal(f.subscribers.size,0);
});
await test('delivery labels distinguish queue publication, completion, refund and cancellation without saying received',async()=>{
  const f=fixture(),m=await module('wallet-center.js',f),rows=m.walletDeliveries({kajuOutbox:{t:{amount:4,state:'published',ts:10}},heroEggGifts:{e:{status:'complete',amount:50,sentAt:20}},heroClanDonations:{d:{state:'refunded',amount:7,ts:30}},heroKozmoCare:{c:{status:'cancelled',kind:'fusion',createdAt:40}}});
  assert.deepEqual(rows.map(r=>r.kind),['care','clan','egg','transfer']);assert.equal(rows.find(r=>r.id==='e').state,'published');assert.equal(rows.find(r=>r.id==='t').state,'published');assert.equal(rows.find(r=>r.id==='d').state,'refunded');assert.equal(rows.find(r=>r.id==='c').state,'cancelled');
  const many=Object.fromEntries(Array.from({length:250},(_,i)=>[i,{amount:1,ts:i}]));assert.equal(m.walletDeliveries({kajuOutbox:many}).length,200);
});
await test('wallet server admin additions render as incoming and deductions render as outgoing',async()=>{
  const f=await centerFixture(),m=await module('wallet-center.js',f);f.dbData.users.alice.kaju_history={plus:{amount:50,type:'admin-add',ts:2},minus:{amount:20,type:'admin-sub',ts:1}};
  const panel=m.openWalletCenter();await settle();await click(byText(panel.body,'Hesap kayıtları'));
  const entries=panel.body.querySelectorAll('.pc-entry');assert.equal(entries.length,2);assert.match(entries[0].textContent,/\+50/);assert.match(entries[1].textContent,/−20/);
  panel.close();assert.equal(f.live.size,0);assert.equal(f.subscribers.size,0);
});
await test('wallet cannot regress a newer confirmed live balance when an earlier read completes late',async()=>{
  const f=await centerFixture(),m=await module('wallet-center.js',f);let release;
  f.hooks.get=()=>new Promise(r=>release=r);const panel=m.openWalletCenter();await settle();
  f.emit('users/alice',{kaju:200});assert.match(panel.body.querySelector('.pc-metric').textContent,/200/);release(snap({kaju:100}));await settle();
  assert.match(panel.body.querySelector('.pc-metric').textContent,/200/);panel.close();
});
await test('invalid server balances are reported as unverified rather than a confirmed zero',async()=>{
  const f=await centerFixture(),m=await module('wallet-center.js',f),panel=m.openWalletCenter();await settle();
  for(const kaju of [-1,1.5,'100','bad',1000000000]){f.emit('users/alice',{kaju});assert.match(panel.body.querySelector('.pc-metric').textContent,/Doğrulanamadı/);assert.doesNotMatch(panel.body.textContent,/ONAYLANAN BAKİYE/);}
  f.emit('users/alice',{kaju:0});assert.equal(panel.body.querySelector('.pc-metric').textContent,'0 Kaju');panel.close();
});
await test('wallet recovery is single-flight and stops remaining journals after account replacement',async()=>{
  const f=await centerFixture(),m=await module('wallet-center.js',f),calls=[];let release;
  f.dbData.users.alice.kajuOutbox={old:{state:'pending',amount:4,ts:1}};
  f.Store.retryPendingTransfers=()=>{calls.push('outbox');return new Promise(r=>release=r);};f.Store.claimPendingTransfers=async()=>calls.push('claim');
  const panel=m.openWalletCenter();await settle();const retry=byText(panel.body,'Bekleyenleri tamamla');
  const pending=retry.fire('click');await settle();await retry.fire('click');assert.deepEqual(calls,['outbox']);
  f.auth({uid:'bob'});release([]);await pending;await settle();assert.deepEqual(calls,['outbox']);assert.equal(f.live.size,0);assert.equal(f.subscribers.size,0);
});

console.log(`${groups} groups passed; ${failed} failed.`);if(failed)process.exitCode=1;
