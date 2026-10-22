// Actual social ES module with isolated transport bindings. No live messages.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/social.js',import.meta.url),'utf8');
let fixtureId=0;
async function fixture(){
 let uid='alice',status='google',available=true,search=async()=>[],get=async()=>({exists:()=>true,val:()=>({nick:'Bob'})}),launch;
 const writes=[],opens=[],messages=[],storage=new Map();
 const f={Auth:{getState:()=>({uid,status,displayName:uid,profile:{avatar:'🙂'}}),searchNicks:(...args)=>search(...args)},db:{},fdb:{ref:(_,path='')=>path,get:(...args)=>get(...args),push:async(path,value)=>{writes.push({kind:'push',path,value});return {key:'invite1'};},set:async(path,value)=>writes.push({kind:'set',path,value}),update:async(path,value)=>writes.push({kind:'update',path,value})},makeFabDraggable:()=>()=>false,canLaunchPortalGame:()=>available,launchPortalGame:(...args)=>launch(...args),openPanel:()=>{throw new Error('Unexpected UI prompt');},element:()=>{},button:()=>{},ensureCenterStyles:()=>{}};
 launch=async(game,options)=>{if(!options.isCurrent())return false;const module={openChess:()=>{opens.push(game);return true;},openTavla:()=>{opens.push(game);return true;},openTetris:()=>{opens.push(game);return true;},inviteKelimeFriend:async(...args)=>{opens.push({game,args});return true;}};return await options.open(module)!==false;};
 const id='__socialFixture'+(++fixtureId);globalThis[id]=f;
 const testSource=source.replace(/^import .*;\n/gm,'')+`\n//# sourceURL=social-v156-fixture-${fixtureId}.js`;
 const bindings=`const {Auth,db,fdb,makeFabDraggable,canLaunchPortalGame,launchPortalGame,openPanel,element,button,ensureCenterStyles}=globalThis.${id};\n`;
 globalThis.document={getElementById:()=>null};globalThis.window={Hero:{toast:(...args)=>messages.push(args)}};globalThis.localStorage={setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const module=await import('data:text/javascript;base64,'+Buffer.from(bindings+testSource).toString('base64'));
 return {module,writes,opens,messages,storage,f,setUid:value=>uid=value,setStatus:value=>status=value,setAvailable:value=>available=value,setGet:value=>get=value,setSearch:value=>search=value,setLaunch:value=>launch=value};
}
let groups=0;
{
 const f=await fixture();for(const [target,game]of [['alice','chess'],['bad/path','chess'],['bob','__proto__'],['bob','unknown']])assert.equal(await f.module.invitePlayerToGame(target,'Bob',game),false);
 f.setStatus('anonymous');assert.equal(await f.module.invitePlayerToGame('bob','Bob','chess'),false);assert.equal(f.writes.length,0);assert.equal(f.opens.length,0);groups++;
}
{
 const f=await fixture();assert.equal(await f.module.invitePlayerToGame('bob','Bob','chess'),true);assert.deepEqual(f.opens,['chess']);assert.equal(f.writes.length,1);
 const n=f.writes[0];assert.equal(n.path,'userNotifs/bob');assert.equal(n.value.fromUid,'alice');assert.equal(n.value.game,'chess');assert.match(n.value.inviteCode,/^[A-Z2-9]{6}$/);assert.ok(n.value.expiresAt-n.value.ts>=300000&&n.value.expiresAt-n.value.ts<=301000);
 assert.equal(JSON.parse(f.storage.get('hero_invite_ctx')).role,'host');groups++;
}
{
 const f=await fixture();let release;f.setGet(()=>new Promise(r=>release=r));const first=f.module.invitePlayerToGame('bob','Bob','tavla');
 assert.equal(await f.module.invitePlayerToGame('bob','Bob','tavla'),false);release({exists:()=>true,val:()=>({})});assert.equal(await first,true);assert.equal(f.writes.length,1);assert.equal(f.opens.length,1);groups++;
}
{
 const f=await fixture();let release;f.setGet(()=>new Promise(r=>release=r));const pending=f.module.invitePlayerToGame('bob','Bob','chess');f.setUid('charlie');release({exists:()=>true,val:()=>({})});
 assert.equal(await pending,false);assert.equal(f.writes.length,0);assert.equal(f.opens.length,0);groups++;
}
{
 const f=await fixture();let release;f.f.fdb.push=(path,value)=>{f.writes.push({path,value});return new Promise(r=>release=r);};const pending=f.module.invitePlayerToGame('bob','Bob','tetris');await new Promise(r=>setImmediate(r));f.setUid('charlie');release({key:'oldInvite'});
 assert.equal(await pending,false);assert.equal(f.opens.length,0);assert.equal(f.storage.size,0);assert.equal(f.writes.length,1,'no follow-up mutation is issued from the replacement account');groups++;
}
{
 const f=await fixture();f.setLaunch(async(game,options)=>{await options.open({openChess:()=>{throw new Error('broken game');}});return false;});assert.equal(await f.module.invitePlayerToGame('bob','Bob','chess'),false);
 assert.equal(f.writes[1].path,'userNotifs/bob/invite1');assert.equal(f.writes[1].value,null);assert.equal(f.storage.size,0,'failed game clears its own invitation context');groups++;
}
{
 const f=await fixture();f.setAvailable(false);assert.equal(await f.module.invitePlayerToGame('bob','Bob','chess'),false);assert.equal(f.writes.length,0);groups++;
}
{
 const f=await fixture();assert.equal(await f.module.invitePlayerToGame('bob','Bob','kelime',{lang:'en'}),true);assert.equal(f.writes.length,0,'Kelime uses its own real invitation transport');assert.deepEqual(f.opens[0],{game:'kelime',args:['bob','Bob','en']});groups++;
}
{
 const f=await fixture();f.setSearch(async()=>[{uid:'alice',nick:'Me'},{uid:'bob',nick:'Bob'},{uid:'bob',nick:'Duplicate'},{uid:'bad/key',nick:'Invalid'},...Array.from({length:12},(_,i)=>({uid:'u'+i,nick:'Friend'+i}))]);
 assert.deepEqual(await f.module.searchFriendCandidates('a'),[]);const rows=await f.module.searchFriendCandidates('fr');assert.equal(rows.length,8);assert.equal(rows[0].uid,'bob');assert.equal(new Set(rows.map(r=>r.uid)).size,8);groups++;
}
{
 const f=await fixture();let release;f.setSearch(()=>new Promise(r=>release=r));const pending=f.module.searchFriendCandidates('bo','alice');f.setUid('charlie');release([{uid:'bob',nick:'Bob'}]);assert.deepEqual(await pending,[]);groups++;
}
{
 const f=await fixture();let release,current=true;f.setGet(()=>new Promise(r=>release=r));const pending=f.module.invitePlayerToGame('bob','Bob','chess',{isCurrent:()=>current});current=false;release({exists:()=>true,val:()=>({})});assert.equal(await pending,false);assert.equal(f.writes.length,0);groups++;
}
console.log(`PASS social v156: ${groups} actual-module invitation and bounded nickname-search groups`);
