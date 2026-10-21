// Real versus lobby + transport, with deterministic PeerJS, DOM and timers.
// No real network connections, accounts or reward writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const start=source.indexOf('function buildVersusLobby('),end=source.indexOf('\nfunction updateHUD(',start);
const transport=fs.readFileSync(new URL('../js/games/tetris-mp.js',import.meta.url),'utf8')
  .replace('export const MP =','const MP =').replace('export default MP;','this.MP=MP;');
assert.ok(start>=0&&end>start);
function fixture(){
  let now=0,next=0,launched=0,backs=0;const jobs=new Map(),peers=[];
  class Emitter{
    handlers=new Map();
    on(type,fn){const list=this.handlers.get(type)||[];list.push(fn);this.handlers.set(type,list);return this;}
    emit(type,data){for(const fn of this.handlers.get(type)||[])fn(data);}
  }
  class Connection extends Emitter{
    open=false;closed=false;sent=[];
    emit(type,data){if(type==='open')this.open=true;if(type==='close'){this.open=false;this.closed=true;}super.emit(type,data);}
    close(){this.emit('close');}
    send(data){this.sent.push(data);}
  }
  class Peer extends Emitter{
    calls=[];destroyed=false;
    constructor(){super();peers.push(this);}
    connect(){const c=new Connection();this.calls.push(c);return c;}
    destroy(){this.destroyed=true;}
  }
  function element(){
    return {value:'ABC234',textContent:'',className:'',innerHTML:'',removed:false,children:new Map(),listeners:new Map(),
      addEventListener(type,fn){this.listeners.set(type,fn);},
      querySelector(selector){if(!this.children.has(selector))this.children.set(selector,element());return this.children.get(selector);},
      remove(){this.removed=true;}};
  }
  const overlay=element();
  const context=vm.createContext({console,Math,JSON,window:{Peer},navigator:{},SELECTED_HERO:'vor',SELECTED_MODE:'versus',
    document:{createElement:()=>overlay,body:{appendChild(){}}},
    setTimeout(fn,delay){const id=++next;jobs.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>jobs.delete(id),
    launchVersusGame(){launched++;},buildHeroSelect(){backs++;}});
  vm.runInContext(transport+'\n'+source.slice(start,end)+'\nbuildVersusLobby();',context);
  const press=selector=>overlay.querySelector(`[data-act="${selector}"]`).listeners.get('click')();
  const connect=()=>{const p=peers.at(-1);p.emit('open');const c=new Connection();p.emit('connection',c);c.emit('open');return c;};
  const advance=ms=>{const until=now+ms;let guard=0;while(true){let first;for(const [id,j]of jobs)if(j.at<=until&&(!first||j.at<first[1].at))first=[id,j];if(!first)break;assert.ok(++guard<1000);jobs.delete(first[0]);now=first[1].at;first[1].fn();}now=until;};
  return {MP:context.MP,peers,overlay,press,connect,advance,get launched(){return launched;},get backs(){return backs;}};
}
let failures=0;
function test(name,run){try{run();console.log('PASS',name);}catch(error){failures++;console.error('FAIL',name,'\n',error.message);}}

test('reconnect during lobby countdown resumes launch exactly once',()=>{
 const f=fixture();f.press('create');const c=f.connect();f.advance(200);c.close();
 f.advance(800);assert.equal(f.launched,0,'disconnect cancels pending launch');
 const recovery=f.connect();assert.equal(f.MP.connected,true);f.advance(800);
 assert.equal(f.launched,1,'reconnected event starts the lobby countdown again');
 recovery.emit('open');f.advance(800);assert.equal(f.launched,1,'completed lobby never launches twice');f.MP.close();
});

test('creating a replacement room cancels the previous countdown',()=>{
 const f=fixture();f.press('create');f.connect();f.advance(200);f.press('create');
 assert.equal(f.MP.connected,false);f.advance(800);assert.equal(f.launched,0,'old countdown cannot launch an unopened replacement room');
 f.connect();f.advance(800);assert.equal(f.launched,1,'new room can launch after its own connection opens');f.MP.close();
});

test('joining a replacement room cancels the previous countdown',()=>{
 const f=fixture();f.press('create');f.connect();f.advance(200);f.press('join');
 assert.equal(f.MP.connected,false);f.advance(800);assert.equal(f.launched,0);
 const p=f.peers.at(-1);p.emit('open');p.calls[0].emit('open');f.advance(800);assert.equal(f.launched,1);f.MP.close();
});

test('channel error cancels launch even without a separate disconnected event',()=>{
 const f=fixture();f.press('create');const c=f.connect();f.advance(200);c.emit('error',{type:'network'});
 f.advance(800);assert.equal(f.launched,0,'transport disposes broken channel without forwarding its close');
 f.connect();f.advance(800);assert.equal(f.launched,1);f.MP.close();
});

test('back cancels launch and old room callbacks cannot reopen the game',()=>{
 const f=fixture();f.press('create');const c=f.connect();f.advance(200);f.press('back');
 c.emit('open');f.advance(20000);assert.equal(f.launched,0);assert.equal(f.backs,1);assert.equal(f.overlay.removed,true);f.MP.close();
});

if(failures)process.exitCode=1;
