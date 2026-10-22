// Timed-out and failed signaling must not later open an unwanted chess room.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/chess-mp.js',import.meta.url),'utf8');
function fixture(){
 const peers=[],timers=new Map();let id=0;
 class Events{handlers={};on(t,cb){(this.handlers[t]??=[]).push(cb);}emit(t,...args){for(const cb of this.handlers[t]||[])cb(...args);}}
 class Conn extends Events{open=false;close(){this.closed=true;this.open=false;this.emit('close');}}
 class Peer extends Events{connections=[];constructor(){super();peers.push(this);}connect(){const c=new Conn();this.connections.push(c);return c;}destroy(){this.destroyed=true;}}
 const c=vm.createContext({window:{Peer},console,setTimeout:(cb,ms)=>{timers.set(++id,{cb,ms});return id;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(source.replace('export const ChessMP','const ChessMP').replace('export default ChessMP;','this.mp=ChessMP;'),c);
 return {mp:c.mp,peers,timers};
}
for(const failure of ['deadline','peer-unavailable']){
 const f=fixture(),events=[];f.mp.joinRoom('ABC234',type=>events.push(type));const p=f.peers[0];
 if(failure==='deadline'){
  const [id,timer]=[...f.timers][0];f.timers.delete(id);timer.cb();
 }else p.emit('error',{type:failure});
 assert.deepEqual(events,['error']);assert.equal(p.destroyed,true);assert.equal(f.timers.size,0);
 p.emit('open');p.emit('error',{type:'network'});
 assert.equal(p.connections.length,0);assert.deepEqual(events,['error']);assert.equal(f.mp.connected,false);
 f.mp.joinRoom('DEF567',type=>events.push(type));const fresh=f.peers[1];p.emit('open');fresh.emit('open');
 assert.equal(fresh.connections.length,1,'a fresh explicit retry remains usable');
 f.mp.close();assert.equal(f.timers.size,0);
}
console.log('PASS Chess failed joins dispose transport, ignore late signaling and preserve explicit retries.');
