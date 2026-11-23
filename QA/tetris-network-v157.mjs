// Actual Tetris controllers and transport on two independent runtimes. The
// in-memory PeerJS boundary models ordered delivery, signaling failure, and
// a link going away before a packet can be accepted by the remote channel.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const game=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const transport=fs.readFileSync(new URL('../js/games/tetris-mp.js',import.meta.url),'utf8')
  .replace('export const MP =','const MP =').replace('export default MP;','this.MP=MP;');
function source(name){
  const start=game.search(new RegExp('^(?:export )?(?:async )?function '+name+'\\(','m'));
  assert.notEqual(start,-1,name);
  const rest=game.slice(start);const next=rest.slice(1).search(/\n(?:export )?(?:async )?function \w+\(/);
  return (next<0?rest:rest.slice(0,next+1)).replace(/^export /,'');
}
function network(){
  let now=0,id=0;const jobs=new Map(),peers=new Map(),links=[];
  const policy={blockNew:false,drop:()=>false,unavailable:false};
  const schedule=(fn,delay)=>{const n=++id;jobs.set(n,{fn,at:now+delay});return n;};
  const advance=(delay)=>{
    const end=now+delay;let calls=0;
    while(true){
      const first=[...jobs].filter(([,j])=>j.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];
      if(!first)break;
      assert.ok(++calls<5000,'network callbacks must terminate');
      jobs.delete(first[0]);now=first[1].at;first[1].fn();
    }
    now=end;
  };
  class Emitter{
    handlers=new Map();
    on(type,fn){const a=this.handlers.get(type)||[];a.push(fn);this.handlers.set(type,a);return this;}
    emit(type,data){for(const fn of this.handlers.get(type)||[])fn(data);}
  }
  class Channel extends Emitter{
    open=false; closed=false;
    constructor(local,remote){super();this.local=local;this.peer=remote.id;}
    close(){
      if(this.closed)return;
      const pair=this.pair?[this,this.pair]:[this];
      for(const c of pair){c.open=false;c.closed=true;}
      for(const c of pair)c.emit('close');
    }
    send(encoded){
      if(!this.open)throw new Error('Channel closed');
      const message=JSON.parse(encoded),to=this.pair;
      if(policy.drop(message,this.local.id,to?.local.id))return;
      schedule(()=>{if(to?.open)to.emit('data',encoded);},5);
    }
  }
  class Peer extends Emitter{
    destroyed=false; channels=[];
    constructor(name){
      super();this.id=typeof name==='string'?name:'anonymous-'+(++id);
      schedule(()=>{
        if(this.destroyed)return;
        if(policy.unavailable){this.emit('error',{type:'network'});return;}
        if(peers.has(this.id)){this.emit('error',{type:'unavailable-id'});return;}
        peers.set(this.id,this);this.emit('open',this.id);
      },2);
    }
    reconnect(){if(!this.destroyed)schedule(()=>this.emit('open',this.id),7);}
    connect(name){
      const host=peers.get(name),out=new Channel(this,{id:name});this.channels.push(out);
      if(!host){schedule(()=>{if(!out.closed)this.emit('error',{type:'peer-unavailable'});},2);return out;}
      const incoming=new Channel(host,this);out.pair=incoming;incoming.pair=out;host.channels.push(incoming);links.push(out);
      schedule(()=>{
        if(out.closed)return;host.emit('connection',incoming);
        if(policy.blockNew)return;
        schedule(()=>{if(!out.closed){out.open=incoming.open=true;incoming.emit('open');out.emit('open');}},3);
      },2);
      return out;
    }
    destroy(){
      if(this.destroyed)return;this.destroyed=true;
      if(peers.get(this.id)===this)peers.delete(this.id);
      for(const channel of this.channels)channel.close();
      this.emit('close');
    }
  }
  return {policy,links,Peer,Channel,peers,advance,schedule,jobs,clear:n=>jobs.delete(n)};
}
function element(){
  const nodes=new Map(),classes=new Set();
  return {style:{},textContent:'',classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
    querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);}};
}
function client(n,nick){
  const state={round:{},root:element(),el:{gemSheet:element(),gameover:element(),modeBar:element()},last:0,
    cur:{x:3,y:0},countdown:0,paused:false,score:0,lines:0,over:false,raf:1};
  const events=[],writes=[],flash=[],no=()=>{};let steps=0,raf=0,paint=0;
  const c=vm.createContext({G:null,window:{Peer:n.Peer,__HERO_NICK:nick},SELECTED_MODE:'versus',SELECTED_HERO:'vor',ADVENTURE_WORLD:null,
    console,ROWS:20,Auth:{getState:()=>({uid:nick})},Resume:{clearSnapshot:no},setTimeout:n.schedule,clearTimeout:n.clear,
    Store:{addScore:async()=>writes.push('score'),addKaju:async()=>{writes.push('reward');return 100;}},
    requestAnimationFrame:()=>++raf,cancelAnimationFrame:no,setupTetrisChat:no,recordGameStats:()=>writes.push('stats'),
    Sound:new Proxy({},{get:()=>no}),flash:m=>flash.push(m),collides:()=>false,resetLockDelay:no,
    drawBoard:()=>{paint++;},drawSide:no,advanceTimedGravity:()=>{steps++;},updateModeUI:no,drawAIBoard:no,
    updateParticles:no,applyShake:no,addTetrisChatMessage:no,launchGame:()=>{c.G=state;},
    mountSessionStatus:(_,opts)=>{events.push(opts.initial.phase);return {update:next=>events.push(next.phase)};}});
  const functions=['afterRound','move','launchVersusGame','rebindMPHandler','queueGarbage','sendVersusSync','applyVersusSync','sendVersusState','handleVersusMessage',
    'endGame','updateVersusUI','loop','sendTetrisChat'].map(source);
  vm.runInContext(transport+'\n'+functions.join('\n'),c);
  return {MP:c.MP,c,state,writes,events,flash,get steps(){return steps;},get paint(){return paint;},
    handler:(event)=>{if(event==='connected')c.launchVersusGame();}};
}
function pair(n=network()){
  const a=client(n,'Host'),b=client(n,'Guest');
  a.MP.createRoom(a.handler,'ABC234');n.advance(10);b.MP.joinRoom('ABC234',b.handler);n.advance(50);
  assert.equal(a.MP.connected,true);assert.equal(b.MP.connected,true);
  assert.equal(a.state.networkHold,false);assert.equal(b.state.networkHold,false);
  return {n,a,b};
}
let passed=0;
async function test(label,f){await f();console.log('PASS',label);passed++;}
await test('an unopened channel cannot occupy a ready host forever; a second guest joins after release',()=>{
 const n=network(),host=client(n,'Host'),second=client(n,'Second');
 host.MP.createRoom(host.handler,'ABC234');n.advance(20);
 const server=n.peers.get('herotetris-mp-ABC234'),hanging=new n.Channel(server,{id:'asleep'});
 server.emit('connection',hanging);n.advance(12100);
 assert.equal(hanging.closed,true);
 assert.equal(n.peers.has('herotetris-mp-ABC234'),true,'room stays registered');
 second.MP.joinRoom('ABC234',second.handler);n.advance(50);
 assert.equal(host.state.oppNick,'Second');assert.equal(second.state.oppNick,'Host');
 host.MP.close();second.MP.close();
});
await test('a terminal signaling error closes the failed peer; late callbacks do not start a match',()=>{
 const n=network(),x=client(n,'Guest'),events=[];
 x.MP.joinRoom('ABC234',(event)=>events.push(event));n.advance(40);
 assert.deepEqual(events,['error']);assert.equal(n.peers.size,0);assert.equal(n.jobs.size,0);
});
await test('signaling-only loss leaves an established match and WebRTC channel alive',()=>{
 const {n,a,b}=pair(),host=n.peers.get('herotetris-mp-ABC234');
 host.emit('disconnected');host.emit('error',{type:'network'});n.advance(40);
 assert.equal(a.MP.connected,true);assert.equal(b.MP.connected,true);assert.equal(a.state.networkHold,false);
 assert.equal(a.events.includes('reconnecting'),false);
 a.state.score=2500;a.c.sendVersusState();n.advance(10);assert.equal(b.state.oppScore,2500);
 a.MP.close();b.MP.close();
});
await test('a delayed guest game screen does not consume the host’s opening time or allow an early move',()=>{
 const n=network(),a=client(n,'Host'),b=client(n,'Guest');
 a.MP.createRoom(a.handler,'ABC234');n.advance(10);
 b.MP.joinRoom('ABC234',event=>{if(event==='connected')n.schedule(()=>b.handler(event),1500);});
 n.advance(200);assert.equal(a.MP.connected,true);assert.equal(a.state.networkHold,true);
 a.c.move(1);a.c.loop(100);a.c.loop(700);assert.equal(a.steps,0);assert.equal(a.state.cur.x,3);
 n.advance(1500);assert.equal(a.state.networkHold,false);assert.equal(b.state.networkHold,false);
 a.MP.close();b.MP.close();
});
await test('disconnect freezes movement/gravity and restored channel waits for state before resuming',()=>{
 const {n,a,b}=pair();n.policy.drop=m=>m.type==='vsync';
 n.links.at(-1).close();n.advance(700);
 assert.equal(a.MP.connected,true);assert.equal(b.MP.connected,true);
 assert.equal(a.state.networkHold,true);assert.equal(b.state.networkHold,true);
 a.c.move(1);a.c.loop(100);a.c.loop(6000);assert.equal(a.steps,0);assert.equal(a.state.cur.x,3);
 assert.equal(a.events.at(-1),'reconnecting');
 n.policy.drop=()=>false;n.advance(620);assert.equal(a.state.networkHold,false);assert.equal(b.state.networkHold,false);
 assert.equal(a.events.at(-1),'playing');a.c.move(1);a.c.loop(6500);a.c.loop(6600);assert.equal(a.state.cur.x,4);assert.equal(a.steps,2);
 a.MP.close();b.MP.close();
});
await test('a re-opened link without a valid state snapshot ends without fabricated wins or writes',()=>{
 const {n,a,b}=pair();n.policy.drop=m=>m.type==='vsync';n.links.at(-1).close();n.advance(12800);
 assert.equal(a.state.over,true);assert.equal(b.state.over,true);assert.deepEqual(a.writes,[]);assert.deepEqual(b.writes,[]);
 assert.match(a.state.el.gameover.querySelector('.go-title').textContent,/BAĞLANTI KESİLDİ/);
});
await test('late/duplicate attack deliveries heal from the cumulative cursor without reapplying garbage',()=>{
 const {n,a,b}=pair();n.policy.drop=m=>m.type==='garbage';
 a.state.score=444;a.state.lines=4;a.state.vsAttackOut=4;
 a.MP.send({type:'garbage',rows:4,attackTotal:4});a.c.sendVersusState();n.advance(10);
 assert.equal(b.state.pendingGarbage,4);assert.equal(b.state.oppScore,444);
 n.policy.drop=()=>false;a.MP.send({type:'garbage',rows:4,attackTotal:4});a.c.sendVersusSync();n.advance(10);
 assert.equal(b.state.pendingGarbage,4);
 a.state.vsAttackOut=7;n.links.at(-1).close();n.advance(700);assert.equal(b.state.pendingGarbage,7);
 assert.equal(b.state.vsAttackIn,7);a.MP.close();b.MP.close();
});
await test('a reconnect keeps the original guest seat and does not start play with the next player',()=>{
 const {n,a,b}=pair(),original=n.links.at(-1).local.id;
 n.policy.blockNew=true;n.links.at(-1).close();n.advance(20);
 const outsider=client(n,'Third');outsider.MP.joinRoom('ABC234',outsider.handler);n.advance(20);
 assert.equal(n.links.at(-1).closed,true);assert.equal(a.state.networkHold,true);n.advance(650);
 const returning=n.links.findLast(l=>l.local.id===original&&!l.closed);
 assert.ok(returning,'original guest ID was reused');n.policy.blockNew=false;
 returning.open=returning.pair.open=true;returning.pair.emit('open');returning.emit('open');n.advance(450);
 assert.equal(a.state.networkHold,false);assert.equal(a.state.oppNick,'Guest');assert.equal(b.state.networkHold,false);
 a.MP.close();b.MP.close();outsider.MP.close();
});
await test('elimination lost immediately before disconnect is reported after reconnect exactly once',async()=>{
 const {n,a,b}=pair();
 n.policy.drop=m=>m.type==='dead';
 await b.c.endGame(false);assert.equal(b.state.onlineEliminated,true);n.advance(20);
 assert.equal(a.state.over,false,'a missing packet does not immediately award a win');
 n.links.at(-1).close();n.advance(750);await new Promise(setImmediate);
 assert.equal(a.state.over,true);assert.match(a.state.el.gameover.querySelector('.go-title').textContent,/KAZANDIN/);
 assert.deepEqual(a.writes,['stats','score','reward']);assert.deepEqual(b.writes,['stats','score']);
 n.advance(30000);assert.equal(a.MP.connected,false);assert.equal(b.MP.connected,false);
});
await test('a stalled score write does not delay visible game-over or hold the closed room',async()=>{
 const {n,a,b}=pair();
 a.c.Store.addScore=()=>{a.writes.push('score pending');return new Promise(()=>{});};
 await b.c.endGame(false);n.advance(30);
 assert.equal(a.state.el.gameover.classList.contains('show'),true);
 assert.deepEqual(a.writes,['stats','score pending']);
 n.advance(800);assert.equal(a.MP.connected,false);assert.equal(b.MP.connected,false);
});
console.log(passed+' paired network scenarios passed');
