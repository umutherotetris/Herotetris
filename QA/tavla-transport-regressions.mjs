// Real transport callbacks with deterministic PeerJS and timer fixtures.
// No signaling server, remote room, or production account is contacted.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.TAVLA_TRANSPORT_SOURCE || new URL('../js/games/tavla-mp.js',import.meta.url),'utf8');
function fixture(){
  const peers=[], timers=new Map(); let nextTimer=1;
  class Events{
    handlers=new Map();
    on(type,fn){this.handlers.set(type,[...(this.handlers.get(type)||[]),fn]);return this;}
    emit(type,data){for(const fn of this.handlers.get(type)||[])fn(data);}
  }
  class Connection extends Events{
    open=false;closed=false;sent=[];
    establish(){this.open=true;this.emit('open');}
    close(){this.closed=true;this.open=false;this.emit('close');}
    send(data){this.sent.push(data);}
  }
  class Peer extends Events{
    destroyed=false;connections=[];
    constructor(...args){super();this.args=args;peers.push(this);}
    connect(target){const c=new Connection();c.target=target;this.connections.push(c);return c;}
    destroy(){this.destroyed=true;this.emit('close');}
  }
  const context=vm.createContext({window:{Peer},console,
    setTimeout:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,ms});return id;},
    clearTimeout:id=>timers.delete(id)
  });
  vm.runInContext(source.replace('export const TavlaMP','const TavlaMP').replace('export default TavlaMP;','this.mp=TavlaMP;'),context);
  return {mp:context.mp,peers,timers,Connection,fireTimer(ms){const item=[...timers].find(([,t])=>t.ms===ms);assert.ok(item,`timer ${ms} exists`);timers.delete(item[0]);item[1].fn();}};
}
{
  const f=fixture(),oldEvents=[],newEvents=[];
  f.mp.joinRoom('ABC234',(type,data)=>oldEvents.push([type,data]));
  const oldPeer=f.peers[0];oldPeer.emit('open');const oldConn=oldPeer.connections[0];
  const staleDeadline=[...f.timers.values()][0].fn;
  f.mp.joinRoom('DEF567',(type,data)=>newEvents.push([type,data]));
  const newPeer=f.peers[1];
  assert.equal(oldPeer.destroyed,true,'joining another room destroys previous Peer');
  assert.equal(oldConn.closed,true,'joining another room closes previous data connection');
  oldPeer.emit('open');oldPeer.emit('error',{type:'peer-unavailable'});
  oldConn.emit('data',JSON.stringify({type:'move',from:23,to:20,die:3}));oldConn.emit('close');staleDeadline();
  assert.deepEqual(newEvents,[],'old callbacks and join deadline cannot reach new room handler');
  assert.equal(newPeer.connections.length,0,'old open callback cannot connect the replacement Peer');
  newPeer.emit('open');const c=newPeer.connections[0];c.establish();
  assert.deepEqual(newEvents.map(e=>e[0]),['connected']);
  assert.equal(f.timers.size,0,'successful connection cancels join deadline');
  f.mp.close();const n=newEvents.length;
  c.emit('data','{}');c.emit('error',{type:'network'});newPeer.emit('error',{type:'network'});
  assert.equal(newEvents.length,n,'close invalidates all transport listeners');assert.equal(f.timers.size,0);
}
{
  const f=fixture(),events=[];
  f.mp.createRoom((type,data)=>events.push([type,data]),'ABC234');
  const p=f.peers[0];p.emit('open');const c=new f.Connection();p.emit('connection',c);c.establish();
  c.close();assert.equal(f.mp.reconnecting,true);assert.equal(f.peers.length,2);
  const recon=f.peers[1];recon.emit('open');
  const next=new f.Connection();recon.emit('connection',next);
  assert.equal(events.filter(e=>e[0]==='reconnected').length,0,'host does not report recovery before channel opens');
  const extra=new f.Connection();recon.emit('connection',extra);assert.equal(extra.closed,true,'second pending guest is rejected');
  next.establish();
  assert.equal(events.filter(e=>e[0]==='reconnected').length,1,'actual channel open reports host recovery exactly once');
  assert.equal(f.mp.reconnecting,false);assert.equal(f.mp.connected,true);assert.equal(f.timers.size,0,'recovery cancels retry timers');
  p.emit('error',{type:'network'});c.emit('close');assert.equal(f.peers.length,2,'stale disconnect cannot restart reconnect');
}
{
  const f=fixture(),events=[];
  f.mp.joinRoom('ABC234',(type,data)=>events.push([type,data]));const p=f.peers[0];p.emit('open');p.connections[0].establish();p.connections[0].close();
  const recon=f.peers[1];recon.emit('open');const c=recon.connections[0];
  f.fireTimer(8000);const staleRetry=[...f.timers.values()][0].fn;
  c.establish();assert.equal(f.timers.size,0,'late successful handshake cancels scheduled retry');
  staleRetry();assert.equal(f.peers.length,2,'queued retry cannot replace a recovered connection');
  assert.equal(events.filter(e=>e[0]==='reconnected').length,1,'guest recovery fires once after open');
}
{
  const f=fixture();f.mp.joinRoom('ABC234',()=>{});const old=f.peers[0];f.mp.close();old.emit('open');
  assert.equal(old.connections.length,0,'closing before signaling open prevents delayed connect');assert.equal(f.timers.size,0);
  const events=[];f.mp.createRoom(type=>{events.push(type);if(type==='disconnected')f.mp.close();},'ABC234');const p=f.peers.at(-1);p.emit('open');const c=new f.Connection();p.emit('connection',c);c.establish();c.close();
  assert.equal(f.peers.length,2,'closing in disconnect callback does not create another Peer');assert.equal(f.mp.reconnecting,false);
}
console.log('PASS Tavla transport: room replacement/close isolation, join timeout cancellation, pending guest isolation, host/guest recovery timing and stale retry rejection.');
