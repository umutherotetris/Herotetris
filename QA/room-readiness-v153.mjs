// Host/guest readiness deadlines and signaling-only errors, using real transports.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
function fixture(game){
 const name=game==='chess'?'ChessMP':'TavlaMP';
 const source=fs.readFileSync(new URL(`../js/games/${game}-mp.js`,import.meta.url),'utf8');
 const peers=[],jobs=new Map();let id=0;
 class Events{handlers={};on(t,cb){(this.handlers[t]??=[]).push(cb);}emit(t,...args){for(const cb of this.handlers[t]||[])cb(...args);}}
 class Conn extends Events{open=false;sent=[];close(){this.closed=true;this.open=false;this.emit('close');}send(data){this.sent.push(data);}establish(){this.open=true;this.emit('open');}}
 class Peer extends Events{connections=[];constructor(){super();peers.push(this);}connect(){const c=new Conn();this.connections.push(c);return c;}destroy(){this.destroyed=true;}}
 const c=vm.createContext({window:{Peer},console,setTimeout:(cb,ms)=>{jobs.set(++id,{cb,ms});return id;},clearTimeout:id=>jobs.delete(id)});
 vm.runInContext(source.replace(`export const ${name}`,`const ${name}`).replace(`export default ${name};`,`this.mp=${name};`),c);
 return {mp:c.mp,peers,jobs,Conn,expire(){const entry=[...jobs].find(([,job])=>job.ms===12000);assert.ok(entry,'initial readiness deadline');jobs.delete(entry[0]);entry[1].cb();}};
}
for(const game of ['chess','tavla']){
 for(const failure of ['deadline','signaling-error']){
  const f=fixture(game),events=[];f.mp.createRoom((type,data)=>events.push({type,data}),'ABC234');const p=f.peers[0];
  if(failure==='deadline')f.expire();else p.emit('error',{type:'unavailable-id'});
  assert.equal(events.length,1);assert.equal(events[0].type,'error');assert.equal(p.destroyed,true);assert.equal(f.jobs.size,0);
  const late=new f.Conn();p.emit('open');p.emit('connection',late);late.establish();
  assert.equal(late.closed,true);assert.equal(events.length,1);assert.equal(f.mp.connected,false);
  f.mp.close();
 }
 {
  const f=fixture(game),events=[];f.mp.createRoom(type=>events.push(type),'ABC234');const p=f.peers[0];p.emit('open');
  assert.deepEqual(events,['code','waiting']);assert.equal(f.jobs.size,0,'ready host may wait indefinitely for a friend');
  const c=new f.Conn();p.emit('connection',c);c.establish();assert.equal(events.at(-1),'connected');
  f.mp.close();
 }
 for(const host of [true,false]){
  const f=fixture(game),events=[];
  if(host)f.mp.createRoom(type=>events.push(type),'ABC234');else f.mp.joinRoom('ABC234',type=>events.push(type));
  const p=f.peers[0];p.emit('open');let c;
  if(host){c=new f.Conn();p.emit('connection',c);}else c=p.connections[0];
  c.establish();const count=events.length;p.emit('error',{type:'network'});
  assert.equal(f.mp.connected,true);assert.equal(p.destroyed,undefined);assert.equal(events.length,count);
  assert.equal(f.mp.send({type:'hello'}),true);assert.equal(c.sent.length,1);assert.equal(f.jobs.size,0);
  f.mp.close();
 }
 {
  const f=fixture(game),events=[];f.mp.joinRoom('',type=>events.push(type)); // invalid code is bounded without allocating a Peer
  assert.equal(f.peers.length,0);assert.equal(f.jobs.size,0);
 }
 console.log(`PASS ${game}: host readiness is bounded, late callbacks cannot launch, ready hosts keep waiting and healthy P2P survives signaling-only errors.`);
}
