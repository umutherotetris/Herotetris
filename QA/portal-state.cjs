// Runs real auth/store/daily/push modules with an in-memory Firebase SDK.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8765';
const database=`
const clone=v=>v===undefined?null:JSON.parse(JSON.stringify(v));
const f=window.__fixture={data:{users:{alice:{kaju:100,level:3,xp:{xp:20,totalXP:900},inventory:{egg:2},cosmetics:{},bestScores:{tetris:900}}}},fail:false,failDelete:false,listeners:[],writes:[],pending:{},deferPaths:[]};
function read(path){return path.split('/').reduce((v,k)=>v?.[k],f.data)??null;}
function write(path,value){const keys=path.split('/');let obj=f.data;for(const k of keys.slice(0,-1))obj=obj[k]||(obj[k]={});if(value===null)delete obj[keys.at(-1)];else obj[keys.at(-1)]=clone(value);}
const snap=(value,key)=>({exists:()=>value!==null,val:()=>clone(value),key,forEach:fn=>Object.entries(value||{}).forEach(([k,v])=>fn(snap(v,k)))});
export const getDatabase=()=>({}),ref=(_,path)=>({path});
export async function get(r){if(f.deferPaths.includes(r.path))return new Promise(resolve=>f.pending[r.path]=value=>resolve(snap(value)));return snap(read(r.path));}
export async function set(r,v){if(f.fail||(f.failDelete&&v===null))throw Error('Fixture write rejected');f.writes.push(r.path);write(r.path,v);}
export async function update(r,v){if(f.fail)throw Error('Fixture write rejected');for(const[k,x]of Object.entries(v))await set({path:r.path+'/'+k},x);}
let queue=Promise.resolve();
export function runTransaction(r,fn){const task=queue.then(async()=>{await Promise.resolve();if(f.fail)throw Error('Fixture transaction rejected');const value=fn(clone(read(r.path)));if(value===undefined)return {committed:false,snapshot:snap(read(r.path))};write(r.path,value);f.writes.push(r.path);return {committed:true,snapshot:snap(value)};});queue=task.catch(()=>{});return task;}
export const query=r=>r,limitToLast=()=>null,limitToFirst=()=>null,orderByChild=()=>null,orderByKey=()=>null,startAt=()=>null,endAt=()=>null,equalTo=()=>null,child=(r,p)=>({path:r.path+'/'+p}),serverTimestamp=()=>Date.now();
export function onChildAdded(r,fn){const listener={path:r.path,fn,active:true};f.listeners.push(listener);return()=>listener.active=false;}
export const onValue=()=>()=>{},off=()=>{},onDisconnect=()=>({update:()=>Promise.resolve()}),remove=r=>set(r,null),push=(r,v)=>set({path:r.path+'/fixture'},v);
`;
const auth=`
import * as fdb from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js';
export {fdb};export const db={};
let state={uid:'alice',status:'google',profile:window.__fixture.data.users.alice,isAdmin:false,displayName:'Alice'};const subs=new Set();
export const Auth={getState:()=>state,subscribe:fn=>{subs.add(fn);fn(state);return()=>subs.delete(fn);}};
window.__authSet=next=>{state={...state,...next};for(const fn of subs)fn(state);};export default Auth;
`;
const authSDK=`
export const getAuth=()=>window.__firebaseAuth||(window.__firebaseAuth={currentUser:{uid:'boot',isAnonymous:true}});
export const onAuthStateChanged=(_,fn)=>{window.__authChange=fn;};
export const setPersistence=async()=>{},browserLocalPersistence={},browserSessionPersistence={},getRedirectResult=async()=>null,signInAnonymously=async()=>{},signInWithPopup=async()=>{},signInWithRedirect=async()=>{},linkWithPopup=async()=>{},signInWithCredential=async()=>{},signOut=async()=>{};
export class GoogleAuthProvider{setCustomParameters(){}}
`;
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.PORTAL_CHROMIUM,args:['--no-sandbox']});
try{
async function makePage(realAuth=false,realEconomy=false){
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',async route=>{
const u=new URL(route.request().url());
if(u.pathname.endsWith('/firebase-database.js'))return route.fulfill({contentType:'text/javascript',body:database});
if(u.pathname.endsWith('/firebase-app.js'))return route.fulfill({contentType:'text/javascript',body:'export const getApp=()=>({}),getApps=()=>[{}],initializeApp=()=>({});'});
if(u.pathname.endsWith('/firebase-auth.js'))return route.fulfill({contentType:'text/javascript',body:authSDK});
if(u.origin!==base)return route.abort();
if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><body><button id="start">Start</button></body>'});
if(u.pathname==='/js/auth.js'&&!realAuth)return route.fulfill({contentType:'text/javascript',body:auth});
if(u.pathname==='/js/economy.js'&&!realEconomy)return route.fulfill({contentType:'text/javascript',body:'export const progressQuest=()=>{};'});
const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404});return route.fulfill({path:file});
});
await page.goto(base);await page.evaluate(()=>{window.__toasts=[];window.Hero={toast:(m)=>window.__toasts.push(m)};window.AudioContext=undefined;window.webkitAudioContext=undefined;});return {page,errors};
}
const {page,errors}=await makePage();
await page.evaluate(async()=>{window.S=(await import('/js/store.js')).default;});
assert.equal(await page.evaluate(()=>S.getState().ready),true,'cached authenticated identity hydrates on first subscription');
assert.equal(await page.evaluate(()=>S.getState().kaju),100);
await page.evaluate(()=>__authSet({uid:null,status:'offline',profile:null}));
assert.deepEqual(await page.evaluate(()=>({kaju:S.getState().kaju,best:S.getState().best,inventory:S.getInventory(),stats:S.getStats().totalW})),{kaju:0,best:{},inventory:{},stats:0},'logout clears prior player data');
await page.evaluate(()=>__authSet({uid:'alice',status:'google',profile:__fixture.data.users.alice}));
const invalid=await page.evaluate(async()=>({xp:await S.addXP(Infinity),kaju:await S.addKaju(Infinity),score:await S.addScore('tetris',Infinity),spend:await S.spendKaju(NaN)}));
assert.deepEqual(invalid,{xp:false,kaju:0,score:false,spend:false},'invalid amounts cannot hang XP or poison the wallet');
await page.evaluate(()=>{localStorage.setItem('hero_kaju_log','{}');});
assert.deepEqual(await page.evaluate(()=>S.getKajuSummary()),{earned:0,spent:0,count:0},'malformed history is safe');
await page.evaluate(()=>{localStorage.removeItem('hero_kaju_log');__fixture.fail=true;});
assert.equal(await page.evaluate(()=>S.spendKaju(20)),false);
assert.equal(await page.evaluate(async()=>{try{await S.addKaju(20);return false;}catch{return true;}}),true,'failed earn propagates instead of pretending to credit');
assert.equal(await page.evaluate(async()=>{try{await S.addKaju(-20);return false;}catch{return true;}}),true,'legacy purchases stop on failed payment');
assert.equal(await page.evaluate(()=>S.getState().kaju),100);
await page.evaluate(()=>__fixture.fail=false);
assert.deepEqual(await page.evaluate(()=>Promise.all([S.spendKaju(70),S.spendKaju(70)])),[true,false],'overlapping purchases cannot overspend');
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.kaju),30);
await page.evaluate(()=>Promise.all([S.addKaju(10),S.addKaju(20)]));
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.kaju),60,'overlapping credits are additive');
const once=await page.evaluate(()=>Promise.all([S.claimKajuOnce('fixture',5000,'tournament','test'),S.claimKajuOnce('fixture',5000,'tournament','test')]));
assert.deepEqual(once.map(r=>r.claimed),[true,false],'fixed prize credited exactly once and not clipped to gameplay cap');
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.kaju),5060);
await page.evaluate(async()=>{window.D=await import('/js/daily.js');__fixture.fail=true;await D.checkDailyLogin();});
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.dailyLogin),undefined,'failed daily reward does not consume claim');
await page.evaluate(async()=>{__fixture.fail=false;await Promise.all([D.checkDailyLogin(),D.checkDailyLogin()]);});
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.kaju),5110,'simultaneous daily checks credit once');
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.dailyLogin.streak),1);
await page.evaluate(async()=>{__fixture.data.kajuTransfers={alice:{retry:{amount:25,fromNick:'Bob'}}};__fixture.failDelete=true;await S.claimPendingTransfers();await S.claimPendingTransfers();});
assert.equal(await page.evaluate(()=>__fixture.data.users.alice.kaju),5135,'failed transfer cleanup never duplicates credit');
await page.evaluate(async()=>{__fixture.failDelete=false;await S.claimPendingTransfers();});
assert.equal(await page.evaluate(()=>__fixture.data.kajuTransfers.alice.retry),undefined,'subsequent attempt cleans an already credited transfer');
await page.evaluate(async()=>{
window.__notifications=[];class N{static permission='granted';constructor(title,opts){__notifications.push({title,...opts});}close(){}}window.Notification=N;
Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});
window.P=await import('/js/push.js');window.__heroWorkerReady=Promise.resolve(null);await P.initPush();await P.initPush();P.startNotifListener();
});
assert.equal(await page.evaluate(()=>__fixture.listeners.filter(x=>x.active).length),1,'repeated initialization keeps one notification listener');
await page.evaluate(()=>{const l=__fixture.listeners.find(x=>x.active),ts=Date.now()+100;for(const key of ['one','two'])l.fn({key,val:()=>({ts,text:key,type:'dm'})});});
assert.equal(await page.evaluate(()=>__notifications.length),2,'same-timestamp notifications are not dropped');
await page.evaluate(()=>{window.__oldListener=__fixture.listeners.find(x=>x.active);__authSet({uid:null,status:'offline',profile:null});__oldListener.fn({key:'stale',val:()=>({ts:Date.now()+1000,text:'old account'})});});
assert.equal(await page.evaluate(()=>__fixture.listeners.filter(x=>x.active).length),0,'logout unsubscribes notifications');
assert.equal(await page.evaluate(()=>__notifications.length),2,'queued notification from old account is ignored');
await page.evaluate(()=>P.openNotifSettings());
assert.equal(await page.getByRole('switch',{name:'Tüm Bildirimler'}).getAttribute('aria-checked'),'true');
await page.getByRole('switch',{name:'Tüm Bildirimler'}).click();
assert.equal(await page.getByRole('switch',{name:'Tüm Bildirimler'}).getAttribute('aria-checked'),'false');
assert.deepEqual(errors,[]);await page.close();
const {page:ecoPage,errors:ecoErrors}=await makePage(false,true);
await ecoPage.emulateMedia({reducedMotion:'reduce'});
await ecoPage.addStyleTag({path:path.join(root,'css/portal.css')});
await ecoPage.evaluate(()=>document.body.className='portal');
await ecoPage.evaluate(async()=>{window.S=(await import('/js/store.js')).default;window.E=await import('/js/economy.js');E.progressQuest('play',3);E.openQuests();__fixture.fail=true;});
await ecoPage.locator('[data-claim="play3"]').click();
await ecoPage.waitForFunction(()=>__toasts.some(t=>t.includes('Ödül alınamadı')));
assert.equal(await ecoPage.locator('[data-claim="play3"]').isDisabled(),false,'failed quest credit remains retryable');
await ecoPage.evaluate(()=>__fixture.fail=false);
await ecoPage.locator('[data-claim="play3"]').click();
await ecoPage.waitForFunction(()=>document.querySelectorAll('.quest-claimed').length===1);
assert.equal(await ecoPage.evaluate(()=>__fixture.data.users.alice.kaju),200);
await ecoPage.evaluate(()=>__authSet({uid:'bob',status:'google',profile:{}}));
assert.equal(await ecoPage.evaluate(()=>E.pendingQuestCount()),0,'quests belong to each account');
assert.deepEqual(ecoErrors,[]);await ecoPage.close();
const {page:authPage,errors:authErrors}=await makePage(true);
await authPage.evaluate(async()=>{window.A=(await import('/js/auth.js')).default;__fixture.deferPaths=['admins/old'];__authChange({uid:'old',isAnonymous:true});__authChange({uid:'new',isAnonymous:true});});
await authPage.waitForFunction(()=>A.getState().uid==='new'&&A.getState().displayName==='Misafir Oyuncu');
await authPage.evaluate(()=>__fixture.pending['admins/old']({admin:true}));
await authPage.waitForTimeout(50);
assert.equal(await authPage.evaluate(()=>A.getState().uid),'new');
assert.equal(await authPage.evaluate(()=>A.getState().isAdmin),false,'stale admin lookup cannot contaminate next identity');
await authPage.evaluate(()=>{__fixture.deferPaths=['users/new'];__authChange({uid:'new',isAnonymous:true});});
await authPage.waitForFunction(()=>!!__fixture.pending['users/new']);
await authPage.evaluate(()=>{__authChange(null);__fixture.pending['users/new']({nick:'Old profile',kaju:500});});
await authPage.waitForTimeout(50);
assert.equal(await authPage.evaluate(()=>A.getState().profile),null,'late profile cannot restore a signed-out account');
assert.deepEqual(authErrors,[]);
console.log('PASS: real Store initialization/logout, finite inputs, corrupt history, atomic wallet, rejected payments, fixed once-only prizes, retryable daily rewards, transfer cleanup idempotence; real Push identity cleanup, same-time deliveries and accessible switches; real Auth stale identity lookups. Firebase SDK is an in-memory fixture, no production writes.');
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
