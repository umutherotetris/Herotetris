// Real controllers and Firebase module with deterministic account/clock/storage boundaries.
// No production rooms, invitations or match results are written.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const ui=fs.readFileSync(new URL('../js/games/kelime.js',import.meta.url),'utf8');
const online=fs.readFileSync(new URL('../js/games/kelime-online.js',import.meta.url),'utf8');
const noop=()=>{},clone=x=>x==null?x:structuredClone(x);
const defer=()=>{let resolve,reject;const promise=new Promise((r,j)=>{resolve=r;reject=j;});return {promise,resolve,reject};};
function fn(name){const at=ui.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(at>=0,name);const tail=ui.slice(at),next=/\n(?:async )?function \w+\(/.exec(tail);return next?tail.slice(0,next.index):tail;}
function backend(uid='bob'){
 const rows=new Map(),subs=new Map(),writes=[];let id=0,now=1000000;
 const snap=v=>({val:()=>clone(v),exists:()=>v!=null});
 const fdb={ref:(_db,p)=>p,push:()=>({key:'id'+ ++id}),get:async p=>snap(rows.get(p)),
  set:async(p,v)=>{writes.push(['set',p]);rows.set(p,clone(v));},remove:async p=>{writes.push(['remove',p]);rows.delete(p);},
  update:async(p,v)=>{writes.push(['update',p]);rows.set(p,{...rows.get(p),...clone(v)});},
  runTransaction:async(p,cb)=>{const next=cb(clone(rows.get(p)));if(next===undefined)return {committed:false,snapshot:snap(rows.get(p))};rows.set(p,clone(next));writes.push(['transaction',p]);return {committed:true,snapshot:snap(next)};},
  onValue:(p,cb)=>{subs.set(p,cb);queueMicrotask(()=>subs.get(p)===cb&&cb(snap(rows.get(p))));return()=>subs.delete(p);},
  onDisconnect:()=>({set:async()=>{},cancel:async()=>{}})};
 const context=vm.createContext({Auth:{getState:()=>({uid,displayName:uid})},db:{},fdb,Date:{now:()=>now},queueMicrotask,console,localStorage:{getItem:()=>null,setItem:noop}});
 vm.runInContext(online.replace(/^import[^\n]*\n/gm,'').replace(/^export /gm,''),context);
 return {context,rows,subs,writes,clock:n=>now=n};
}
for(const role of ['A','B']){
 const b=backend(role==='A'?'alice':'bob'),room={seed:5,status:'active',players:{A:'alice',B:'bob'},scores:{A:50,B:20},turn:'A',bagPointer:14};
 b.rows.set('kelimeGames/live',room);b.rows.set('kelimeMyGames/alice/live',{mode:'live'});b.rows.set('kelimeMyGames/bob/live',{mode:'live'});
 await b.context.resumeGame('live',{});b.writes.length=0;
 const nodes=new Map(),content={appendChild:noop};let beat,results=0,quests=0;
 const overlay={querySelector:s=>{if(!nodes.has(s))nodes.set(s,{addEventListener:noop});return nodes.get(s);}};
 const c=vm.createContext({G:{online:true,role,root:{querySelector:()=>content},_setupToken:{},_oppLastSeen:Date.now()-181000},KO:b.context,
  setInterval:cb=>{beat=cb;return 1;},clearInterval:noop,document:{createElement:()=>overlay},
  window:{Hero:{Store:{recordMatchResult:()=>results++,trackQuestEvent:()=>quests++}}},showMyGames:noop,showStart:noop,esc:String,
  onlineGameOver:()=>assert.fail('a heartbeat gap must not use the completed-match path')});
 vm.runInContext(['startOnlineHeartbeat','stopOnlineHeartbeat','onlineInterrupted'].map(fn).join('\n'),c);
 c.startOnlineHeartbeat();beat();await Promise.resolve();await Promise.resolve();
 assert.equal(c.G._over,true);assert.equal(results+quests,0,'interruption writes no result or quest');
 assert.equal(b.rows.get('kelimeGames/live').status,'active');
 assert.ok(b.rows.has('kelimeMyGames/alice/live')&&b.rows.has('kelimeMyGames/bob/live'),'both resume indexes survive');
 assert.ok(!b.writes.some(([type,p])=>type==='remove'||p.startsWith('kelimeMyGames/')),'interruption does not finalize or clear the room');
 assert.match(overlay.innerHTML,/Kazanan belirlenmedi/);
 console.log('PASS '+role+' heartbeat loss leaves the shared room resumable without a victory');
}
{
 const b=backend();let sent;
 await b.context.sendInvite('alice','Alice',{onSent:x=>sent=x});
 const room=b.rows.get('kelimeGames/'+sent.gameId),invite=b.rows.get('gameInvites/alice/'+sent.inviteId);
 assert.equal(room.expiresAt,room.createdAt+300000);assert.equal(invite.expiresAt,room.expiresAt);
 const notif=[...b.rows.entries()].find(([p])=>p.startsWith('userNotifs/alice/'))[1];
 assert.equal(notif.ts,invite.ts);assert.equal(notif.expiresAt,invite.expiresAt,'all invite surfaces share one deadline');
 console.log('PASS native room, invite and portal notification use one five-minute deadline');
}
for(const expired of ['explicit','legacy']){
 const b=backend(),room={seed:5,status:'invited',players:{A:'alice'},invited:'bob',createdAt:700000};
 if(expired==='explicit')room.expiresAt=1000000;
 b.rows.set('kelimeGames/expired',room);let joined=0,error='';
 await b.context.acceptInvite({id:'old',gameId:'expired'},{onMatched:()=>joined++,onError:x=>error=x});
 assert.equal(joined,0);assert.ok(error);assert.equal(b.rows.get('kelimeGames/expired').players.B,undefined);
 console.log('PASS '+expired+' expired invitation cannot atomically claim a room');
}
{
 const b=backend(),now=1000000;let visible;
 b.rows.set('gameInvites/bob',{fresh:{game:'kelime',gameId:'fresh',ts:now-299999},expired:{game:'kelime',gameId:'expired',ts:now-300000},future:{game:'kelime',gameId:'future',ts:now+1},invalid:{game:'kelime',gameId:'invalid'},early:{game:'kelime',gameId:'early',ts:now-5,expiresAt:now}});
 b.context.listenInvites(list=>visible=list);await Promise.resolve();
 assert.deepEqual(Array.from(visible,x=>x.gameId),['fresh']);
 console.log('PASS native invitation list excludes expired, future and malformed invitations');
}
{
 let resolve,writes=0;const pending=new Promise(r=>resolve=r),content={set innerHTML(_s){writes++;}};
 const c=vm.createContext({G:{root:{querySelector:()=>content}},KO:{listMyGames:()=>pending}});
 vm.runInContext(fn('showMyGames'),c);const loaded=c.showMyGames();assert.equal(writes,1);
 c.G=null;resolve([]);await loaded;assert.equal(writes,1,'late game list cannot write into a closed or replacement screen');
 console.log('PASS canceled resume list cannot replace a later screen');
}
{
 const back={},item={dataset:{i:'0',act:'play'},addEventListener:(_e,fn)=>item.click=fn};let resume,opened=0,left=0;
 const card={querySelector:()=>({addEventListener:(_e,fn)=>back.click=fn}),querySelectorAll:()=>[item]};
 const content={querySelector:()=>card};
 const c=vm.createContext({G:{root:{querySelector:()=>content}},KO:{listMyGames:async()=>[{gameId:'r',myRole:'A',scores:{A:0,B:0},mode:'live',opp:'Bob'}],resumeGame:(_id,cb)=>resume=cb,leaveRoom:()=>left++},esc:String,showOnlineOptions:noop,startOnline:()=>opened++});
 vm.runInContext(fn('showMyGames'),c);await c.showMyGames();item.click();back.click();resume.onResumed({});
 assert.equal(opened,0);assert.equal(left,1,'leaving the list cancels the in-flight transport resume');
 console.log('PASS resume completion after Back cannot reopen the abandoned room');
}
for(const final of ['pass','resign','draw','last-tile'])for(const accept of [false,true]){
 const gate=defer();let completed=0,interrupted=0;
 const state={board:Array.from({length:15},()=>Array(15).fill(null)),scores:{A:4,B:2},turn:'A'};
 const c=vm.createContext({G:{online:true,role:'A',_setupToken:{},state,pending:[],bagSeed:null},KO:{pushMove:()=>gate.promise},
  renderAll:noop,handleDrawOffer:noop,recallConflictingPending:noop,
  onlineGameOver:()=>completed++,onlineInterrupted:()=>interrupted++});
 vm.runInContext(['sendOnlinePatch','applyRemote','onlineOutcome','isMyTurn'].map(fn).join('\n'),c);
 const patch={status:'over',...(final==='resign'?{resignedBy:'A'}:final==='draw'?{draw:true}:{overMsg:'Game over'})};
 const sent=c.sendOnlinePatch(patch);assert.equal(c.isMyTurn(),false,'committing is locked until acknowledgment');
 c.applyRemote({...patch,scores:{A:4,B:2}});assert.equal(completed,0,'optimistic local snapshot cannot record a result');
 assert.equal(await c.sendOnlinePatch({turn:'B'}),false,'a duplicate commit cannot enter while its predecessor is pending');
 if(accept)gate.resolve();else gate.reject(new Error('Permission denied'));
 assert.equal(await sent,accept);assert.equal(completed,accept?1:0);assert.equal(interrupted,accept?0:1);
 console.log('PASS '+final+' '+(accept?'acknowledgment finalizes once':'rejection suspends without a false result'));
}
{
 const gate=defer();let interrupted=0,completed=0;
 const c=vm.createContext({G:{online:true,_setupToken:{}},KO:{pushMove:()=>gate.promise},onlineInterrupted:()=>interrupted++,onlineGameOver:()=>completed++,renderAll:noop});
 vm.runInContext(fn('sendOnlinePatch'),c);const sent=c.sendOnlinePatch({status:'over'});c.G._setupToken={};gate.reject(new Error('Old rejection'));assert.equal(await sent,false);
 assert.equal(interrupted+completed,0,'a late rejection cannot suspend a replacement round');
 console.log('PASS failed old-round write cannot interrupt a replacement game');
}
{
 const b=backend('alice'),room={seed:7,status:'active',players:{A:'alice',B:'bob'},turn:'A',bagPointer:14};
 b.rows.set('kelimeGames/live',room);await b.context.resumeGame('live',{});
 const original=[{letter:'A',points:1,joker:false}],changed=[{letter:'Z',points:10,joker:false}];
 await b.context.saveRack(original);b.context.fdb.update=async()=>{throw new Error('Rejected write');};
 await assert.rejects(b.context.pushMove({turn:'B','racks/A':changed}));
 await b.context.leaveRoom();b.context.fdb.update=async()=>{};let restored;
 await b.context.resumeGame('live',{onResumed:x=>restored=x});
 assert.deepEqual(Array.from(restored.room.racks.A,t=>({...t})),original,'recovery preserves the last acknowledged rack after a rejected move');
 assert.equal(b.rows.get('kelimeGames/live').turn,'A');
 console.log('PASS rejected live move preserves the last confirmed rack for same-device resume');
}
console.log('PASS Kelime v153 recovery and invitation regressions');
