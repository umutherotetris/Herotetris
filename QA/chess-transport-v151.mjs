import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/chess-mp.js',import.meta.url),'utf8');
function fixture(){
 const peers=[],timers=new Map();let id=0;
 class Events{handlers={};on(type,cb){(this.handlers[type]??=[]).push(cb);}emit(type,...args){for(const cb of this.handlers[type]||[])cb(...args);}}
 class Conn extends Events{open=false;closed=false;fail=false;sent=[];establish(){this.open=true;this.emit('open');}close(){this.closed=true;this.open=false;this.emit('close');}send(data){if(this.fail)throw Error('channel failed');this.sent.push(data);}}
 class Peer extends Events{connections=[];constructor(...args){super();this.args=args;peers.push(this);}connect(target){const c=new Conn();c.target=target;this.connections.push(c);return c;}destroy(){this.destroyed=true;}}
 const c=vm.createContext({window:{Peer},console,setTimeout:(cb,ms)=>{timers.set(++id,{cb,ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source.replace('export const ChessMP','const ChessMP').replace('export default ChessMP;','this.mp=ChessMP;'),c);
 return {mp:c.mp,peers,timers,Conn,run(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`deadline ${ms}`);timers.delete(entry[0]);entry[1].cb();}};
}
let failed=0;
function test(name,run){try{run();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,e.stack);}}
test('initial signaling stall reports a bounded join timeout before Peer.open',()=>{
 const f=fixture(),events=[];f.mp.joinRoom('ABC234',type=>events.push(type));f.run(12000);assert.deepEqual(events,['error']);
});
test('host and guest reconnect retry even if signaling never opens',()=>{
 for(const host of [true,false]){
  const f=fixture(),events=[];let conn;
  if(host){f.mp.createRoom(type=>events.push(type),'ABC234');conn=new f.Conn();f.peers[0].emit('connection',conn);}
  else{f.mp.joinRoom('ABC234',type=>events.push(type));f.peers[0].emit('open');conn=f.peers[0].connections[0];}
  conn.establish();conn.close();assert.equal(f.peers.length,2);f.run(8000);f.run(10000);assert.equal(f.peers.length,3);
  for(let i=0;i<5;i++){f.run(8000);f.run(10000);}
  assert.equal(f.mp.reconnecting,false);assert.equal(f.mp.connected,false);assert.equal(events.filter(t=>t==='reconnect_failed').length,1);assert.equal(f.peers.at(-1).destroyed,true);
 }
});
test('pending first guest is retained and second pending guest is closed',()=>{
 const f=fixture(),events=[];f.mp.createRoom(type=>events.push(type),'ABC234');
 const a=new f.Conn(),b=new f.Conn();f.peers[0].emit('connection',a);f.peers[0].emit('connection',b);assert.equal(b.closed,true);a.establish();assert.equal(events.filter(t=>t==='connected').length,1);
});
test('successful join cancels deadline; stale retry cannot replace recovered channel',()=>{
 const f=fixture();f.mp.joinRoom('ABC234',()=>{});f.peers[0].emit('open');const first=f.peers[0].connections[0];first.establish();assert.equal(f.timers.size,0);
 first.close();const peer=f.peers[1];peer.emit('open');f.run(8000);const stale=[...f.timers.values()].find(t=>t.ms===10000).cb;peer.connections[0].establish();assert.equal(f.timers.size,0);stale();assert.equal(f.peers.length,2);assert.equal(f.mp.connected,true);
});
test('failed send returns false and starts reconnect without leaking old data',()=>{
 const f=fixture(),events=[];f.mp.joinRoom('ABC234',t=>events.push(t));f.peers[0].emit('open');const c=f.peers[0].connections[0];c.establish();c.fail=true;
 assert.equal(f.mp.send({type:'move'}),false);assert.equal(f.mp.reconnecting,true);assert.equal(f.mp.connected,false);assert.ok(events.includes('disconnected'));
 const before=events.length;c.emit('data',{type:'resign'});assert.equal(events.length,before);
});
test('closing from reconnect notification cannot create a replacement Peer',()=>{
 const f=fixture();f.mp.createRoom(type=>{if(type==='reconnecting')f.mp.close();},'ABC234');const c=new f.Conn();f.peers[0].emit('connection',c);c.establish();c.close();assert.equal(f.peers.length,1);assert.equal(f.mp.reconnecting,false);assert.equal(f.timers.size,0);
});
test('replacing a room in a disconnect callback keeps its new Peer and callbacks',()=>{
 const f=fixture(),replacement=[];
 f.mp.createRoom(type=>{if(type==='disconnected')f.mp.createRoom(t=>replacement.push(t),'DEF567');},'ABC234');
 const c=new f.Conn();f.peers[0].emit('connection',c);c.establish();c.close();
 assert.equal(f.peers.length,2);assert.equal(f.mp.reconnecting,false);assert.deepEqual(replacement,[]);
 f.peers[1].emit('open');assert.deepEqual(replacement,['code','waiting']);
});
if(failed)process.exitCode=1;
