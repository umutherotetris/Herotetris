// Actual online controller functions; deterministic two-client transport, timers and account boundaries.
// No PeerJS server, live account, score or reward writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(process.env.PORTAL_TETRIS_SOURCE || new URL('../js/games/tetris.js',import.meta.url),'utf8');
function fn(name){
  const re=new RegExp(`^(?:export )?(?:async )?function ${name}\\(`,'m'),m=re.exec(source);
  assert.ok(m,`missing ${name}`);
  const rest=source.slice(m.index),next=/\n(?:export )?(?:async )?function \w+\(/.exec(rest.slice(1));
  return (next?rest.slice(0,next.index+1):rest).replace(/^export /,'').replace(/^export default .*;$/gm,'');
}
const noop=()=>{};
function element(){
  const children=new Map(),classes=new Set(),listeners=new Map();
  return {style:{},innerHTML:'',textContent:'',removed:false,children,listeners,
    classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)},
    querySelector(selector){if(!children.has(selector))children.set(selector,element());return children.get(selector);},
    addEventListener:(type,handler)=>listeners.set(type,handler),remove(){this.removed=true;}};
}
function fixture({nick='Oyuncu',host=false}={}){
  let now=1000000,next=1,handler,peerFixture=null,choiceCount=0,inviteCount=0,closes=0,frames=0;
  const jobs=new Map(),outgoing=[],writes=[],storage=new Map(),elements=[];
  const state={round:{},root:element(),el:{gemSheet:element(),gameover:element(),modeBar:element()},
    versus:true,over:false,score:0,lines:0,oppScore:0,oppLines:0,oppNick:'Rakip',oppAlive:true,raf:1};
  const MP={connected:true,host,send:msg=>outgoing.push(JSON.parse(JSON.stringify(msg))),
    __setHandler:cb=>{handler=cb;},close:()=>{closes++;MP.connected=false;},
    createRoom(cb){peerFixture=cb;},joinRoom(_code,cb){peerFixture=cb;}};
  const c=vm.createContext({G:null,window:{__HERO_NICK:nick},SELECTED_HERO:'vor',SELECTED_MODE:'versus',ADVENTURE_WORLD:null,
    console,MP,Sound:new Proxy({},{get:()=>noop}),Auth:{getState:()=>({uid:'test'})},Resume:{clearSnapshot:noop},
    Store:{addScore:async()=>writes.push('score'),addKaju:async()=>writes.push('reward')},
    recordGameStats:()=>writes.push('stats'),setupTetrisChat:noop,flash:noop,injectCSS:noop,
    localStorage:{getItem:k=>storage.get(k)||null,removeItem:k=>storage.delete(k)},Date:{now:()=>now},
    document:{createElement:()=>{const el=element();elements.push(el);return el;},body:{appendChild:noop},querySelector:()=>null},
    setTimeout(fn,ms){const id=next++;jobs.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>jobs.delete(id),
    cancelAnimationFrame:noop,requestAnimationFrame:()=>{frames++;},buildHeroSelect:()=>choiceCount++,
    launchGame:()=>{c.G=state;}});
  vm.runInContext(['afterRound','launchVersusGame','rebindMPHandler','sendVersusSync','applyVersusSync','handleVersusMessage','endGame','updateVersusUI','loop','_startInviteTetris','openTetris'].map(fn).join('\n')+
    '\nthis.qa={launchVersusGame,openTetris,_startInviteTetris,loop};',c);
  const advance=ms=>{const until=now+ms;let guard=0;while(true){let first;for(const [id,j]of jobs)if(j.at<=until&&(!first||j.at<first[1].at))first=[id,j];if(!first)break;assert.ok(++guard<1000);jobs.delete(first[0]);now=first[1].at;first[1].fn();}now=until;};
  return {c,state,MP,outgoing,writes,storage,elements,advance,launch:c.qa.launchVersusGame,
    event:(...args)=>handler?.(...args),get handler(){return handler;},get closes(){return closes;},get frames(){return frames;},
    get choiceCount(){return choiceCount;},get inviteCount(){return inviteCount;},get peerEvent(){return peerFixture;},
    captureInvites(){c._startInviteTetris=()=>inviteCount++;},setNow:n=>now=n};
}
function drain(a,b){
  let sent=0;while(a.outgoing.length||b.outgoing.length){
    for(const [from,to]of [[a,b],[b,a]])while(from.outgoing.length){assert.ok(++sent<30,'handshake must terminate');to.event('message',from.outgoing.shift());}
  }
}
let failed=0;
async function test(label,run){try{await run();console.log('PASS',label);}catch(error){failed++;console.error('FAIL',label,'\n',error.stack);}}

await test('staggered lobby-to-game handoff shares both opponent names without a message loop',()=>{
 const a=fixture({nick:'Host',host:true}),b=fixture({nick:'Guest'});a.launch();
 // Host hello arrives while the other client still has the lobby handler and is ignored.
 a.outgoing.length=0;b.launch();drain(a,b);
 assert.equal(a.state.oppNick,'Guest');assert.equal(b.state.oppNick,'Host');
});

await test('host and guest restore each other score and line state on reconnect',()=>{
 const a=fixture({nick:'Host',host:true}),b=fixture({nick:'Guest'});a.launch();b.launch();drain(a,b);
 a.state.score=8700;a.state.lines=17;b.state.score=4300;b.state.lines=9;
 a.state.oppScore=1;a.state.oppLines=0;b.state.oppScore=1;b.state.oppLines=0;
 a.event('reconnected');b.event('reconnected');a.advance(400);b.advance(400);drain(a,b);
 assert.equal(a.state.oppScore,4300);assert.equal(a.state.oppLines,9);assert.equal(b.state.oppScore,8700);assert.equal(b.state.oppLines,17);
});

await test('reconnect exhaustion stops the round without inventing a win or giving two clients rewards',async()=>{
 const a=fixture(),b=fixture();a.launch();b.launch();drain(a,b);
 for(const f of [a,b]){f.event('reconnect_failed');f.event('reconnect_failed');await Promise.resolve();
  assert.equal(f.state.over,true);assert.equal(f.state.el.gameover.classList.contains('show'),true);
  assert.match(f.state.el.gameover.querySelector('.go-title').textContent,/BAĞLANTI KESİLDİ/);
  assert.match(f.state.el.gameover.querySelector('.go-reward').textContent,/sonuç kaydedilmedi/);
  assert.deepEqual(f.writes,[],'network ambiguity is neither a ranked result nor a victory');
  assert.equal(f.closes,1,'terminal failure is idempotent');f.c.qa.loop(1100000);assert.equal(f.frames,0,'finished game schedules no further simulation');}
});

await test('a replaced round ignores old transport callbacks and scheduled reconnect sync',()=>{
 const f=fixture();f.launch();const old=f.handler;f.event('reconnected');f.outgoing.length=0;
 f.c.G={round:{},versus:true,over:false,oppScore:22,oppLines:2,oppNick:'Yeni',oppAlive:true};
 old('message',{type:'vsync',score:999,lines:99,nick:'Eski',alive:false});old('reconnect_failed');f.advance(400);
 assert.equal(f.c.G.oppScore,22);assert.equal(f.c.G.oppNick,'Yeni');assert.equal(f.c.G.over,false);assert.deepEqual(f.outgoing,[]);
 f.c.G=null;assert.doesNotThrow(()=>old('message',{type:'dead'}));
});

await test('valid Tetris invitations stay usable for the same five-minute window as social invitations',()=>{
 const f=fixture();f.captureInvites();f.storage.set('hero_invite_ctx',JSON.stringify({game:'tetris',role:'guest',code:'ABC234',ts:1000000-180000}));
 f.c.qa.openTetris();assert.equal(f.inviteCount,1);assert.equal(f.choiceCount,0);assert.equal(f.storage.has('hero_invite_ctx'),false);
 const expired=fixture();expired.captureInvites();expired.storage.set('hero_invite_ctx',JSON.stringify({game:'tetris',role:'guest',code:'ABC234',ts:1000000-300000}));
 expired.c.qa.openTetris();assert.equal(expired.inviteCount,0);assert.equal(expired.choiceCount,1);assert.equal(expired.storage.has('hero_invite_ctx'),false);
});

await test('invitation display treats peer nick and code as text and retains the invited opponent name',()=>{
 const f=fixture(),name='<img src=x onerror=alert(1)>',code='ABC234';
 f.c.qa._startInviteTetris({role:'host',code,oppNick:name});const wait=f.elements[0];
 assert.equal(wait.innerHTML.includes(name),false);assert.equal(wait.querySelector('#xinvMsg').textContent,name+' bekleniyor...');
 assert.equal(wait.querySelector('#xinvCode').textContent,'Davet kodu: '+code);
 f.peerEvent('connected');assert.equal(f.state.oppNick,name);
});

if(failed)process.exitCode=1;
