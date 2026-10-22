// Actual economy callbacks with a small DOM and deferred Store boundary; no network/accounts.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/economy.js',import.meta.url),'utf8');
const stripped=source.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const noop=()=>{};
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.events={};this.style={};this.dataset={};this.disabled=false;this.parent=null;this.textContent='';}
 set innerHTML(html){this.html=html;this.children=[];for(const m of html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/gi)){
  const el=new Element(m[1]);for(const a of m[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)){
   const key=a[1],value=a[2]??'';if(key==='id')el.id=value;else if(key==='class')el.className=value;else if(key==='disabled')el.disabled=true;else if(key.startsWith('data-'))el.dataset[key.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=value;
  }
  this.appendChild(el);
 }}
 get innerHTML(){return this.html||'';}
 appendChild(el){el.parent=this;this.children.push(el);return el;}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(el=>el!==this);this.parent=null;}}
 get isConnected(){return !!this.root || !!this.parent?.isConnected;}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
 querySelectorAll(selector){const found=[];const matches=el=>selector.startsWith('#')?el.id===selector.slice(1):selector.startsWith('.')?(el.className||'').split(' ').includes(selector.slice(1)):selector.startsWith('[data-')?Object.hasOwn(el.dataset,selector.slice(6,-1).split('=')[0].replace(/-([a-z])/g,(_,c)=>c.toUpperCase())):false;const walk=el=>{for(const c of el.children){if(matches(c))found.push(c);walk(c);}};walk(this);return found;}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 async click(){for(const fn of this.events.click||[])await fn({target:this});}
}
function fixture(){
 const body=new Element(),head=new Element();body.root=head.root=true;
 const storage=new Map(),toasts=[],writes=[],timers=new Map();let timerId=0,now=Date.parse('2026-10-22T10:00:00Z'),uid='alice',roll=0,claim=async(day,seg,owner)=>({claimed:true,alreadyClaimed:false,receipt:{type:seg.type,amount:seg.type==='egg'?50:seg.amount,vipMult:1,eggId:'daily_spin_'+day}}),quest=async()=>({claimed:true,amount:50}),egg=async()=>true;
 const doc={body,head,createElement:tag=>new Element(tag),getElementById:id=>[...head.querySelectorAll('#'+id),...body.querySelectorAll('#'+id)][0]||null,querySelectorAll:s=>[...head.querySelectorAll(s),...body.querySelectorAll(s)]};
 class TestDate extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
 const Store={getKajuLog:()=>[],getKajuSummary:()=>({}),isVip:()=>false,addKaju:async()=>0,addXP:async()=>false,claimWheelReward:async(...args)=>{writes.push(args);return claim(...args);},claimKajuOnce:async(...args)=>{writes.push(args);return quest(...args);}};
 const context=vm.createContext({console,Auth:{getState:()=>({uid,status:'google'})},Store,document:doc,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},window:{Hero:{toast:(message,error)=>toasts.push({message,error})}},Date:TestDate,Math:Object.assign(Object.create(Math),{random:()=>roll}),setTimeout:(fn,delay)=>{const id=++timerId;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),_getKajuLog:()=>[],_getKajuSummary:()=>({}),_addKaju:noop,_addXP:noop,__deliverEgg:(...args)=>egg(...args)});
 vm.runInContext(stripped+'\ngrantWheelEgg=async(owner,id)=>{if(!await __deliverEgg(owner,id))throw Error("Yumurta teslim edilemedi");};\nthis.api={openDailyWheel,openQuests,progressQuest,pendingQuestCount,canSpin};',context);
 return {api:context.api,doc,storage,toasts,writes,timers,setClaim:fn=>claim=fn,setQuest:fn=>quest=fn,setEgg:fn=>egg=fn,setUid:value=>uid=value,setRoll:value=>roll=value,setDate:value=>now=Date.parse(value),fire:delay=>{const entry=[...timers].find(([,t])=>t.delay===delay);assert.ok(entry,'timer '+delay);timers.delete(entry[0]);return entry[1].fn();}};
}
const spinKey=(uid='alice',day='2026-10-22')=>'hero_spin_'+uid+'_'+day;
const questKey=(uid='alice',day='2026-10-22')=>'hero_quests_'+uid+'_'+day;
async function start(f){f.api.openDailyWheel();await f.doc.getElementById('wheelSpinBtn').click();return f.fire(4100);}
let groups=0;
// Every displayed segment uses the same receipt path, including false non-levelup and egg failures in the old path.
for(const [roll,type,amount]of [[.01,'kaju',50],[.24,'xp',40],[.46,'kaju',120],[.62,'kaju',30],[.79,'xp',100],[.88,'kaju',300],[.94,'egg',50],[.995,'jackpot',750]]){
 const f=fixture();f.setRoll(roll);await start(f);assert.equal(f.writes.length,1);assert.equal(f.storage.get(spinKey()),'1');assert.ok(f.toasts.some(t=>t.message.includes(String(amount))));assert.equal(JSON.parse(f.storage.get(questKey())).spin1.progress,1);groups++;
}
{
 const f=fixture();let release;f.setClaim(()=>new Promise(resolve=>release=resolve));f.api.openDailyWheel();await f.doc.getElementById('wheelSpinBtn').click();const pending=f.fire(4100);
 assert.equal(f.storage.get(spinKey()),undefined);assert.equal(f.toasts.filter(t=>t.message.includes('kazandın')).length,0);
 f.api.openDailyWheel();assert.equal(f.doc.getElementById('wheelSpinBtn').disabled,true);assert.ok(f.doc.getElementById('wheelOv').innerHTML.includes('Ödülün tamamlanıyor'));
 f.fire(10000);assert.equal(f.storage.get(spinKey()),undefined);assert.equal(f.doc.getElementById('wheelSpinBtn').textContent,'⏳ Bağlantı bekleniyor…');
 release({claimed:true,receipt:{type:'kaju',amount:50,vipMult:1}});await pending;
 assert.equal(f.doc.getElementById('wheelSpinBtn').textContent,'✅ Ödül kaydedildi');assert.equal(f.storage.get(spinKey()),'1');groups++;
}
{
 const f=fixture();f.setRoll(.24);f.setClaim(async()=>({claimed:false,alreadyClaimed:false}));await start(f);
 assert.equal(f.storage.get(spinKey()),undefined);assert.equal(f.doc.getElementById('wheelSpinBtn').disabled,false);assert.ok(!f.toasts.some(t=>t.message.includes('kazandın')),'nonlevelup-style false result is not a reward acknowledgment');groups++;
}
{
 const f=fixture();f.setRoll(.94);let attempts=0,deliveries=[];f.setEgg(async(uid,id)=>{deliveries.push([uid,id]);return ++attempts>1;});
 f.setClaim(async()=>({claimed:attempts===0,alreadyClaimed:attempts>0,receipt:{type:'egg',amount:50,vipMult:1,eggId:'daily_spin_2026-10-22'}}));
 await start(f);assert.equal(f.storage.get(spinKey()),undefined);assert.ok(!f.toasts.some(t=>t.message.includes('kazandın')));
 await f.doc.getElementById('wheelSpinBtn').click();await f.fire(4100);assert.equal(f.storage.get(spinKey()),'1');assert.deepEqual(deliveries,[['alice','daily_spin_2026-10-22'],['alice','daily_spin_2026-10-22']]);groups++;
}
{
 const f=fixture();f.setClaim(async()=>({claimed:false,alreadyClaimed:true,receipt:{type:'xp',amount:100,vipMult:1}}));await start(f);
 assert.equal(f.storage.get(spinKey()),'1');assert.ok(f.toasts.some(t=>t.message.includes('100 XP')));assert.equal(f.doc.getElementById('wheelRotor').style.transform,'rotate(1957.5deg)','wheel recovers the actual recorded segment');groups++;
}
{
 const f=fixture();f.setClaim(async()=>{throw Object.assign(Error('denied'),{code:'PERMISSION_DENIED'});});await start(f);
 assert.equal(f.storage.get(spinKey()),undefined);assert.ok(f.toasts.some(t=>t.error&&t.message.includes('Sunucu ödülün kaydına izin vermedi')));assert.equal(f.doc.getElementById('wheelSpinBtn').disabled,false);groups++;
}
{
 const f=fixture();f.api.openDailyWheel();await f.doc.getElementById('wheelSpinBtn').click();f.setUid('bob');await f.fire(4100);assert.equal(f.writes.length,0);assert.equal(f.storage.get(spinKey()),undefined);assert.equal(f.toasts.length,0);groups++;
}
{
 const f=fixture();let release;f.setClaim(()=>new Promise(resolve=>release=resolve));f.api.openDailyWheel();await f.doc.getElementById('wheelSpinBtn').click();const pending=f.fire(4100);f.setUid('bob');release({claimed:true,receipt:{type:'kaju',amount:50,vipMult:1}});await pending;
 assert.equal(f.storage.get(spinKey()),'1');assert.equal(f.storage.get(spinKey('bob')),undefined);assert.equal(f.storage.get(questKey('bob')),undefined);assert.equal(f.toasts.length,0);groups++;
}
{
 const f=fixture();f.api.openDailyWheel();await f.doc.getElementById('wheelSpinBtn').click();f.setDate('2026-10-23T00:00:01Z');await f.fire(4100);
 assert.equal(f.writes[0][0],'2026-10-22');assert.equal(f.storage.get(spinKey()),'1');assert.equal(f.storage.get(spinKey('alice','2026-10-23')),undefined);assert.equal(f.storage.get(questKey('alice','2026-10-23')),undefined);groups++;
}
{
 const f=fixture();f.storage.set(spinKey(),'1');f.api.openDailyWheel();assert.equal(f.doc.getElementById('wheelSpinBtn').disabled,true);assert.equal(f.writes.length,0,'ambiguous v153 local marker is not silently cleared');groups++;
}
{
 const f=fixture();f.api.progressQuest('spin');f.api.openQuests();let release;f.setQuest(()=>new Promise(resolve=>release=resolve));const first=f.doc.getElementById('questList').querySelector('[data-claim]');const pending=first.click();
 assert.equal(JSON.parse(f.storage.get(questKey())).spin1.claimed,false);f.api.progressQuest('play',3);f.api.openQuests();assert.ok(f.doc.getElementById('questList').querySelectorAll('[data-claim]').some(b=>b.dataset.claim==='spin1'&&b.disabled));
 release({claimed:true,amount:50});await pending;
 const saved=JSON.parse(f.storage.get(questKey()));assert.equal(saved.spin1.claimed,true);assert.equal(saved.play3.progress,3,'other quest progress during credit is preserved');groups++;
}
{
 const f=fixture();f.api.progressQuest('spin');f.api.openQuests();f.setQuest(async()=>({claimed:false,alreadyClaimed:true,amount:50}));await f.doc.getElementById('questList').querySelector('[data-claim]').click();
 assert.equal(JSON.parse(f.storage.get(questKey())).spin1.claimed,true);assert.equal(f.api.pendingQuestCount(),0);groups++;
}
{
 const f=fixture();f.api.progressQuest('spin');f.api.openQuests();f.setQuest(async()=>{throw Object.assign(Error('offline'),{code:'NETWORK_ERROR'});});await f.doc.getElementById('questList').querySelector('[data-claim]').click();
 assert.equal(JSON.parse(f.storage.get(questKey())).spin1.claimed,false);assert.equal(f.doc.getElementById('questList').querySelector('[data-claim]').disabled,false);assert.ok(f.toasts.some(t=>t.message.includes('Bağlantı kurulamadı')));groups++;
}
{
 const f=fixture();f.api.progressQuest('spin');f.api.openQuests();f.setDate('2026-10-23T00:00:01Z');await f.doc.getElementById('questList').querySelector('[data-claim]').click();assert.equal(f.writes.length,0,'yesterday rendered quest cannot claim a new day receipt');groups++;
}
console.log(`PASS economy daily reward callbacks: ${groups} branch, acknowledgment, duplicate, retry, account, day and progress groups`);
