// Real Tetris transport module; deterministic PeerJS/timers, no network/account writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source = fs.readFileSync(new URL('../js/games/tetris-mp.js', import.meta.url), 'utf8');
function fixture(){
  let now=0,next=1; const jobs=new Map(),peers=[];
  class Emitter {
    handlers=new Map();
    on(type,fn){ const a=this.handlers.get(type)||[];a.push(fn);this.handlers.set(type,a);return this; }
    emit(type,data){ for(const fn of this.handlers.get(type)||[]) fn(data); }
  }
  class Connection extends Emitter {
    open=false; closed=false; sent=[];
    emit(type,data){ if(type==='open')this.open=true;if(type==='close'){this.open=false;this.closed=true;}super.emit(type,data); }
    close(){ this.emit('close'); }
    send(data){ this.sent.push(data); }
  }
  class Peer extends Emitter {
    calls=[]; destroyed=false;
    constructor(...args){ super();this.args=args;peers.push(this); }
    connect(remote,options){ const c=new Connection();this.calls.push({remote,options,c});return c; }
    destroy(){this.destroyed=true;}
  }
  const context=vm.createContext({window:{Peer},console,Math,JSON,setTimeout:(fn,ms)=>{const id=next++;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>jobs.delete(id)});
  vm.runInContext(source.replace('export const MP =','const MP =').replace('export default MP;','this.MP=MP;'),context);
  const advance=ms=>{const end=now+ms;let safety=0;while(true){let first;for(const [id,j]of jobs)if(j.at<=end&&(!first||j.at<first[1].at))first=[id,j];if(!first)break;assert.ok(++safety<1000);jobs.delete(first[0]);now=first[1].at;first[1].fn();}now=end;};
  return {MP:context.MP,peers,Connection,advance,jobs};
}

// A room replaced before its join timeout must not receive errors, late data or opens from A.
{
 const f=fixture(),oldEvents=[],events=[];
 f.MP.joinRoom('ABC234',(type,data)=>oldEvents.push({type,data}));
 const oldPeer=f.peers[0];oldPeer.emit('open');const oldConn=oldPeer.calls[0].c;
 f.MP.createRoom((type,data)=>events.push({type,data}),'DEF567');const active=f.peers.at(-1);
 oldPeer.emit('open');oldPeer.emit('error',{type:'peer-unavailable'});oldConn.emit('data',{type:'stale'});oldConn.emit('close');
 f.advance(12000);
 assert.deepEqual(events,[],'late callbacks from old room cannot notify or reconnect the new room');
 assert.equal(active.calls.length,0,'late old peer open cannot connect through replacement peer');
 assert.equal(oldPeer.destroyed,true,'replacement disposes previous peer');
 assert.equal(oldConn.closed,true,'replacement disposes previous connection');
 f.MP.close();assert.equal(f.jobs.size,0,'close cancels pending transport timers');
 console.log('PASS replaced-room callback, resource and timeout isolation.');
}

// Reconnect is complete only after the data channel opens; scheduled retries cannot destroy it.
{
 const f=fixture(),events=[];f.MP.createRoom((type,data)=>events.push({type,data}),'ABC234');
 const old=f.peers[0],initial=new f.Connection();old.emit('connection',initial);initial.emit('open');initial.emit('close');
 const recovery=f.peers.at(-1);recovery.emit('open');recovery.emit('error',{type:'network'});
 const c=new f.Connection();recovery.emit('connection',c);
 assert.equal(events.filter(x=>x.type==='reconnected').length,0,'receiving unopened channel is not successful reconnect');
 c.emit('open');assert.equal(f.MP.connected,true);assert.equal(f.MP.reconnecting,false);
 assert.equal(events.filter(x=>x.type==='reconnected').length,1);
 const count=f.peers.length;f.advance(30000);
 assert.equal(f.peers.length,count,'scheduled retry cannot replace a recovered connection');
 assert.equal(recovery.destroyed,false);assert.equal(f.MP.connected,true);f.MP.close();
 console.log('PASS host reconnect waits for open and cancels retry timers.');
}

// Only one pending channel may reserve a room, not just one already-open channel.
{
 const f=fixture(),events=[];f.MP.createRoom(type=>events.push(type),'ABC234');const p=f.peers[0];
 const first=new f.Connection(),second=new f.Connection();p.emit('connection',first);p.emit('connection',second);
 assert.equal(second.closed,true,'second pending guest is refused');first.emit('open');second.emit('open');second.emit('data',{type:'stray'});
 assert.equal(events.filter(x=>x==='connected').length,1);assert.equal(events.includes('message'),false);
 f.MP.send({type:'hello'});assert.equal(first.sent.length,1);assert.equal(second.sent.length,0);f.MP.close();
 console.log('PASS one-channel room reservation and rejected-channel isolation.');
}

// A guest recovery can succeed after one error schedules a retry; old timeout must be cancelled.
{
 const f=fixture(),events=[];f.MP.joinRoom('ABC234',type=>events.push(type));let p=f.peers[0];p.emit('open');let c=p.calls[0].c;c.emit('open');
 c.emit('close');p=f.peers.at(-1);p.emit('open');c=p.calls[0].c;p.emit('error',{type:'network'});c.emit('open');
 assert.equal(events.filter(x=>x==='reconnected').length,1);const count=f.peers.length;f.advance(30000);
 assert.equal(f.peers.length,count);assert.equal(f.MP.connected,true);f.MP.close();assert.equal(f.jobs.size,0);
 console.log('PASS guest reconnect completion and timer cleanup.');
}

// Close suppresses queued events, including close emitted synchronously while disposing resources.
{
 const f=fixture(),events=[];f.MP.joinRoom('ABC234',type=>events.push(type));const p=f.peers[0];p.emit('open');const c=p.calls[0].c;c.emit('open');events.length=0;
 f.MP.close();c.emit('data',{type:'stray'});p.emit('error',{type:'network'});c.emit('open');f.advance(60000);
 assert.deepEqual(events,[]);assert.equal(f.MP.connected,false);assert.equal(f.MP.reconnecting,false);assert.equal(f.jobs.size,0);
 console.log('PASS manual close suppresses all old transport events.');
}

// Recovery also terminates when PeerJS never opens or emits an error.
{
 const f=fixture(),events=[];f.MP.createRoom(type=>events.push(type),'ABC234');const c=new f.Connection();f.peers[0].emit('connection',c);c.emit('open');c.emit('close');
 f.advance(120000);
 assert.equal(f.peers.length,7,'initial room plus at most six recovery attempts');
 assert.equal(events.filter(x=>x==='reconnect_failed').length,1);
 assert.equal(f.MP.reconnecting,false);assert.equal(f.MP.connected,false);assert.equal(f.jobs.size,0);
 f.MP.close();console.log('PASS silent signaling failure has bounded recovery and no timer leak.');
}

// The lobby handler may be replaced by the game handler without invalidating its live channel.
{
 const f=fixture(),lobby=[],game=[];f.MP.joinRoom('ABC234',type=>lobby.push(type));const p=f.peers[0];p.emit('open');const c=p.calls[0].c;c.emit('open');
 f.MP.__setHandler((type,data)=>game.push({type,data}));c.emit('data','{"type":"hello"}');
 assert.deepEqual(lobby,['connected']);assert.equal(game.length,1);assert.equal(game[0].type,'message');assert.equal(game[0].data.type,'hello');
 f.advance(12000);assert.equal(game.length,1);f.MP.close();console.log('PASS lobby-to-game handler transition retains active channel.');
}
