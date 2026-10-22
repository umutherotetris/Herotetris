// Actual social functions with deferred Firebase/account boundaries; no network writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/social.js',import.meta.url),'utf8');
function fn(name){
 const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);
 const before=source.slice(0,start).endsWith('async ')?start-6:start;
 const next=/\n(?:async )?function \w+\(/.exec(source.slice(start+1));
 return source.slice(before,next?start+1+next.index:source.length);
}
function fixture(){
 let uid='account-a',getHook=()=>Promise.resolve({exists:()=>false});
 const writes=[],alerts=[],listeners=[];
 const input={value:'Friend'},list={innerHTML:'',querySelectorAll:()=>[]};
 const context=vm.createContext({
  console,Auth:{getState:()=>({uid,status:'google',displayName:uid,profile:{avatar:'🙂'}}),resolveNick:async()=>({uid:'friend',nick:'Friend'})},
  fdb:{ref:(_db,path)=>path,query:x=>x,limitToLast:()=>20,get:ref=>getHook(ref),onValue:(ref,callback)=>{listeners.push({ref,callback});return()=>{};},set:async(path,value)=>writes.push({path,value}),push:async(path,value)=>{writes.push({path,value});return {key:'notif-1'};}},db:{},
  H:{notifRows:[],seen:{}},byId:id=>id==='ghpFrNick'?input:list,
  renderNotifPane:()=>{},renderFriends:()=>{},alert:x=>alerts.push(x),
  esc:x=>String(x??''),avatarOf:()=>'',tAgo:()=>'',
 });
 return {context,input,list,writes,alerts,listeners,setUid:value=>uid=value,setGet:hook=>getHook=hook};
}
let groups=0;
{
 const f=fixture();vm.runInContext(fn('listenNotifs'),f.context);
 f.context.listenNotifs('account-a');f.setUid('account-b');
 f.context.H.notifRows=[{key:'new-account'}];
 f.listeners[0].callback({exists:()=>true,forEach:callback=>callback({key:'old-account',val:()=>({text:'Private old notification'})})});
 assert.equal(f.context.H.notifRows[0].key,'new-account','unsubscribed old-account callback cannot replace new notifications');groups++;
}
{
 const f=fixture();let release;
 f.setGet(()=>new Promise(resolve=>release=resolve));
 vm.runInContext('let _friendsRenderToken=0;'+fn('renderFriends'),f.context);
 const pending=f.context.renderFriends();f.setUid('account-b');f.list.innerHTML='New account list';
 release({exists:()=>true,val:()=>({friend:{name:'Old friend'}})});await pending;
 assert.equal(f.list.innerHTML,'New account list','old-account friends lookup cannot overwrite the new account pane');groups++;
}
{
 const f=fixture();const calls=[];
 f.setGet(()=>new Promise(resolve=>calls.push(resolve)));
 vm.runInContext('let _friendsRenderToken=0;'+fn('renderFriends'),f.context);
 const first=f.context.renderFriends(),last=f.context.renderFriends();
 calls[1]({exists:()=>false});await last;const expected=f.list.innerHTML;
 calls[0]({exists:()=>true,val:()=>({friend:{name:'Removed friend'}})});
 // A cancelled request must not start its old per-user lookups.
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,2,'older friends query stops before issuing stale profile/presence reads');
 await first;assert.equal(f.list.innerHTML,expected);groups++;
}
{
 const f=fixture();
 const helper=source.includes('function sendFriendRequest(')?fn('sendFriendRequest'):'';
 vm.runInContext(helper+fn('addFriendByNick'),f.context);
 await f.context.addFriendByNick();
 assert.equal(f.writes.length,2,'nickname-based add writes a real friend request and notification');
 assert.equal(f.writes[0].path,'friendRequests/friend/account-a');
 assert.equal(f.writes[0].value.fromUid,'account-a');assert.equal(f.writes[0].value.fromAvatar,'🙂');
 assert.equal(f.writes[1].path,'userNotifs/friend');assert.equal(f.writes[1].value.reqFrom,'account-a');
 assert.equal(f.writes[1].value.type,'friendreq');assert.equal(f.input.value,'');
 assert.ok(f.alerts.some(message=>message.includes('gönderildi')));groups++;
}
{
 const f=fixture();let release;
 f.context.Auth.resolveNick=()=>new Promise(resolve=>release=resolve);
 const helper=source.includes('function sendFriendRequest(')?fn('sendFriendRequest'):'';
 vm.runInContext(helper+fn('addFriendByNick'),f.context);
 const pending=f.context.addFriendByNick();f.setUid('account-b');f.input.value='New draft';
 release({uid:'friend',nick:'Friend'});await pending;
 assert.equal(f.writes.length,0,'a nickname lookup cannot send the request as a different signed-in account');
 assert.equal(f.input.value,'New draft');assert.equal(f.alerts.length,0);groups++;
}
{
 const f=fixture();let release;
 f.context.fdb.set=(path,value)=>{f.writes.push({path,value});return new Promise(resolve=>release=resolve);};
 vm.runInContext(fn('sendFriendRequest'),f.context);
 const pending=f.context.sendFriendRequest('friend','account-a');f.setUid('account-b');release();
 assert.equal(await pending,false);assert.equal(f.writes.length,1,'account switch after request write prevents a later notification under the new session');groups++;
}
{
 const f=fixture();let release;
 f.context.Auth.resolveNick=()=>new Promise(resolve=>release=resolve);
 vm.runInContext(fn('sendFriendRequest')+fn('addFriendByNick'),f.context);
 const pending=f.context.addFriendByNick();f.input.value='Next friend';
 release({uid:'friend',nick:'Friend'});await pending;
 assert.equal(f.writes.length,2);assert.equal(f.input.value,'Next friend','a successful old lookup preserves text typed while it was loading');groups++;
}
console.log(`PASS social v153: ${groups} notification, friends-render and nickname request account-boundary groups.`);
