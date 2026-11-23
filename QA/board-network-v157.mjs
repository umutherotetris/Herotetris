// Paired, independent controller/transport contexts: no production room or writes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as chess from '../js/games/chess-engine.js';
import * as tavla from '../js/games/tavla-engine.js';

const read=name=>fs.readFileSync(new URL('../js/games/'+name+'.js',import.meta.url),'utf8');
const noop=()=>{};
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS',name);}catch(error){failed++;console.error('FAIL',name,error.stack);}}

function wire(game){
  let counter=0,timerId=0,autoOpen=true;
  const peers=new Map(),pending=[],timers=new Map(),instances=[];
  class Emitter{
    events=new Map();
    on(name,fn){this.events.set(name,[...(this.events.get(name)||[]),fn]);}
    emit(name,...args){for(const fn of this.events.get(name)||[])fn(...args);}
  }
  class Conn extends Emitter{
    open=false;closed=false;
    constructor(owner){super();this.owner=owner;owner.connections.push(this);}
    send(data){
      if(this.failSilently){this.close();return;}
      if(!this.open)throw new Error('closed channel');
      const peer=this.other;
      pending.push(()=>{if(peer.open)peer.emit('data',data);});
    }
    close(){
      if(this.closed)return;
      const open=this.open;this.closed=true;this.open=false;
      if(open)this.emit('close');
      if(this.other && !this.other.closed)this.other.close();
    }
  }
  class Peer extends Emitter{
    connections=[];destroyed=false;
    constructor(id){
      super();this.id=typeof id==='string'?id:'guest-'+(++counter);instances.push(this);
      pending.push(()=>{
        if(this.destroyed)return;
        if(peers.has(this.id)){this.emit('error',{type:'unavailable-id'});return;}
        peers.set(this.id,this);this.emit('open');
      });
    }
    connect(id){
      const local=new Conn(this),host=peers.get(id);
      if(!host){pending.push(()=>this.emit('error',{type:'peer-unavailable'}));return local;}
      const remote=new Conn(host);local.other=remote;remote.other=local;
      pending.push(()=>{
        if(this.destroyed||host.destroyed)return;
        host.emit('connection',remote);
        if(!autoOpen||local.closed||remote.closed)return;
        local.open=remote.open=true;
        local.emit('open');remote.emit('open');
      });
      return local;
    }
    destroy(){
      if(this.destroyed)return;this.destroyed=true;
      if(peers.get(this.id)===this)peers.delete(this.id);
      for(const conn of this.connections)conn.close();
      this.emit('close');
    }
  }
  const load=()=>{
    const context=vm.createContext({window:{Peer},console,
      setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>timers.delete(id)});
    const name=game==='chess'?'ChessMP':'TavlaMP';
    vm.runInContext(read(game+'-mp').replace('export const '+name,'const '+name).replace('export default '+name+';','this.mp='+name+';'),context);
    return context.mp;
  };
  const host=load(),guest=load(),hostEvents=[],guestEvents=[];
  const flush=()=>{while(pending.length)pending.shift()();};
  const create=()=>{host.createRoom((...a)=>hostEvents.push(a),'ABC234');flush();};
  const join=()=>{guest.joinRoom('abc234',(...a)=>guestEvents.push(a));flush();};
  const run=ms=>{
    const timer=[...timers].find(([,entry])=>entry.ms===ms);
    assert.ok(timer,'timer '+ms);timers.delete(timer[0]);timer[1].fn();
  };
  return {host,guest,hostEvents,guestEvents,create,join,peers,instances,timers,flush,run,pauseHandshake:()=>autoOpen=false,resumeHandshake:()=>autoOpen=true};
}
for(const game of ['chess','tavla']){
 test(game+' paired guests send ordered game packets through actual transport modules',()=>{
  const w=wire(game);w.create();w.join();assert.equal(w.host.connected,true);assert.equal(w.guest.connected,true);
  const packets=game==='chess'?[{type:'move',move:{from:{r:6,c:4},to:{r:4,c:4}}}]:[{type:'dice',dice:[6,3]},{type:'move',from:23,to:20,die:3}];
  for(const p of packets)assert.equal(w.guest.send(p),true);
  w.flush();
  assert.deepEqual(w.hostEvents.filter(e=>e[0]==='message').map(e=>JSON.parse(JSON.stringify(e[1]))),packets);
  assert.equal(w.timers.size,0);
 });
 test(game+' unopened guest slot expires; correct room survives and accepts the next player',()=>{
  const w=wire(game);w.create();const original=w.instances[0];w.pauseHandshake();w.join();
  assert.equal(w.host.connected,false);assert.equal(w.timers.size,2);
  w.run(12000);assert.equal(w.host.reconnecting,false);assert.equal(original.destroyed,false);
  w.run(12000);assert.equal(w.guestEvents.at(-1)[0],'error');assert.match(w.guestEvents.at(-1)[1],/zaman aşımı/);
  assert.equal(w.hostEvents.at(-1)[0],'waiting');
  w.resumeHandshake();w.join();assert.equal(w.host.connected,true);assert.equal(w.guest.connected,true);
  assert.equal(w.hostEvents.filter(e=>e[0]==='connected').length,1);
 });
 test(game+' pre-match signaling drop errors without threatening a healthy peer game',()=>{
  const w=wire(game);w.create();w.instances[0].emit('disconnected');
  assert.equal(w.hostEvents.at(-1)[0],'error');assert.equal(w.instances[0].destroyed,true);assert.equal(w.host.reconnecting,false);
  w.create();w.join();const active=w.instances.at(-2),before=w.hostEvents.length;active.emit('disconnected');
  assert.equal(w.host.connected,true);assert.equal(w.hostEvents.length,before);
 });
 test(game+' paired link loss reconnects once without reopening a new game; old data stays ignored',()=>{
  const w=wire(game);w.create();w.join();const old=w.instances[0].connections[0];old.close();
  assert.equal(w.host.reconnecting,true);assert.equal(w.guest.reconnecting,true);w.flush();
  assert.equal(w.host.connected,true);assert.equal(w.guest.connected,true);
  for(const events of [w.hostEvents,w.guestEvents]){
    assert.equal(events.filter(e=>e[0]==='connected').length,1);
    assert.equal(events.filter(e=>e[0]==='reconnected').length,1);
  }
  const before=w.hostEvents.length;old.emit('data',JSON.stringify({type:'move'}));
  assert.equal(w.hostEvents.length,before);assert.equal(w.guest.send({type:'chat',text:'Merhaba'}),true);w.flush();
  assert.equal(w.hostEvents.at(-1)[1].text,'Merhaba');assert.equal(w.timers.size,0);
 });
 test(game+' synchronous PeerJS close during send returns false and keeps result retryable',()=>{
  const w=wire(game);w.create();w.join();w.instances[0].connections[0].failSilently=true;
  assert.equal(w.host.send({type:'resign'}),false);
  assert.equal(w.hostEvents.filter(e=>e[0]==='disconnected').length,1);
  assert.equal(w.guestEvents.filter(e=>e[0]==='message').length,0);
  w.flush();assert.equal(w.host.connected,true);assert.equal(w.guest.connected,true);
 });
}

function functions(source,names){
 return names.map(name=>{
   const start=new RegExp('^(?:export )?(?:async )?function '+name+'\\(','m').exec(source).index;
   const rest=source.slice(start),next=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
   return (next?rest.slice(0,next.index+1):rest).replace(/^export /,'');
 }).join('\n');
}
test('chess fast opponent reply commits after the outgoing animation instead of being lost',()=>{
 const frames=[],sent=[],state=chess.newGame();
 const G={state,mode:'online',playerColor:'w',moveHistory:[],posHistory:[chess.positionKey(state)],captured:{w:[],b:[]}};
 const c=vm.createContext({...chess,G,ChessMP:{connected:true,send:m=>sent.push(m)},performance:{now:()=>0},
   requestAnimationFrame:cb=>frames.push(cb),draw:noop,moveToNotation:()=>'',addHistoryRow:noop,updateTurn:noop,
   updateCaptured:noop,updateClockDisplay:noop,updateStatus:noop,Sound:new Proxy({},{get:()=>noop}),saveChessResume:noop,maybeAIMove:noop});
 vm.runInContext(functions(read('chess'),['doMove','sendMoveOnline','finishMove','applyAndContinue','onRemoteMessage']),c);
 c.doMove({from:{r:6,c:4},to:{r:4,c:4}});
 c.onRemoteMessage({type:'move',move:{from:{r:1,c:4},to:{r:3,c:4}}});
 assert.equal(sent.length,1);assert.equal(G.state, state);assert.equal(frames.length,1);
 frames.shift()(250);assert.equal(G.state.turn,'b');assert.equal(frames.length,1);
 frames.shift()(250);assert.equal(G.state.turn,'w');assert.equal(G.state.board[3][4]?.c,'b');assert.equal(G.moveHistory.length,2);
});
test('chess host clock pauses during outage, guest does not declare timeout, false sends do not settle',()=>{
 for(const playerColor of ['w','b']){
  const timeouts=[],sent=[];let tick;
  const G={mode:'online',playerColor,clock:{w:1,b:1},state:chess.newGame(),syncPending:true},mp={connected:true,send:m=>{sent.push(m);return false;}};
  const c=vm.createContext({...chess,G,ChessMP:mp,setInterval:fn=>{tick=fn;return 1;},stopClockTick:noop,
    updateClockDisplay:noop,onTimeout:(...args)=>timeouts.push(args)});
  vm.runInContext(functions(read('chess'),['startClockTick','onRemoteMessage']),c);
  c.startClockTick();tick();assert.equal(G.clock.w,1);G.syncPending=false;tick();
  assert.equal(G.clock.w,0);assert.equal(timeouts.length,0);
  if(playerColor==='w'){
    assert.equal(sent[0].type,'clockTimeout');mp.send=()=>true;tick();assert.equal(timeouts.length,1);
  }else{
    assert.equal(sent.length,0);c.onRemoteMessage({type:'clockTimeout',color:'w',draw:false});assert.equal(timeouts.length,1);
  }
 }
});
test('tavla break clock cannot award a result during loss or an unconfirmed own forfeit',()=>{
 const G={state:tavla.newGame(),online:true,breakRequester:'them',oppLeft:true};
 const settled=[],mp={connected:false,send:()=>false};
 const c=vm.createContext({G,TavlaMP:mp,clearMoveGrace:noop,clearAutoRollTimer:noop,updateStatus:noop,
  updateControls:noop,draw:noop,Sound:new Proxy({},{get:()=>noop}),awardSimple:won=>settled.push(won)});
 vm.runInContext(functions(read('tavla'),['forfeitByTimeout']),c);
 c.forfeitByTimeout();assert.equal(G.gameEnded,undefined);
 G.oppLeft=false;mp.connected=true;G.breakRequester='me';c.forfeitByTimeout();assert.equal(G.gameEnded,undefined);
 mp.send=()=>true;c.forfeitByTimeout();assert.equal(G.gameEnded,true);assert.deepEqual(settled,[false]);
});
test('opened data channel without a valid snapshot has a bounded, retryable wait',()=>{
 for(const game of ['chess','tavla']){
  const name=game==='chess'?'requestChessSync':'requestTavlaSync';
  const G={playerColor:'b',isHost:false,syncPending:true,_syncPending:true},timers=[],states=[],sent=[];
  const mp={connected:true,send:m=>{sent.push(m);return true;}};
  const c=vm.createContext({G,ChessMP:mp,TavlaMP:mp,setTimeout:fn=>timers.push(fn),
    chessSessionPhase:(...args)=>states.push(args),tavlaSessionPhase:(...args)=>states.push(args)});
  vm.runInContext(functions(read(game),[name]),c);assert.equal(c[name](),true);
  while(timers.length)timers.shift()();
  assert.equal(sent.length,3);assert.equal(states.at(-1)[0],'failed');assert.equal(states.at(-1)[2],true);
  assert.equal(c[name](),true);G.syncPending=G._syncPending=false;
  while(timers.length)timers.shift()();
  assert.equal(sent.length,4);assert.equal(states.at(-1)[0],'reconnecting');
 }
});
console.log(passed+' passed, '+failed+' failed');if(failed)process.exitCode=1;
