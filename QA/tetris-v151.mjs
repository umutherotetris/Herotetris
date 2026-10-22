// Real keyboard/controller/transport paths; presentation, account writes and clock are fixtures.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {HEROES} from '../js/games/tetris-heroes.js';
import {GEMS} from '../js/games/tetris-gems.js';
const raw=process.env.TETRIS_V151_SOURCE_REF?execFileSync('git',['show',process.env.TETRIS_V151_SOURCE_REF+':js/games/tetris.js'],{encoding:'utf8'}):fs.readFileSync(new URL('../js/games/tetris.js',import.meta.url),'utf8');
const source=raw.replace(/^import .*;\r?\n/gm,'').replace(/^export default .*;\r?$/gm,'').replace(/^export function /gm,'function ');
const transport=fs.readFileSync(new URL('../js/games/tetris-mp.js',import.meta.url),'utf8').replace('export const MP =','const MP =').replace('export default MP;','this.MP=MP;');
const noop=()=>{},empty=()=>Array.from({length:20},()=>Array(10).fill(0));
function element(){
 const children=new Map(),classes=new Set();
 return {style:{setProperty:noop},dataset:{},textContent:'',innerHTML:'',isConnected:true,
  classList:{contains:k=>classes.has(k),add:k=>classes.add(k),remove:k=>classes.delete(k),toggle:(k,on)=>{if(on)classes.add(k);else classes.delete(k);}},
  querySelector(s){if(!children.has(s))children.set(s,element());return children.get(s);},querySelectorAll:()=>[],addEventListener:noop};
}
function harness(){
 let now=0,seq=0;const jobs=new Map(),peers=[],keys=new Map(),wins=[];
 class Emitter{events=new Map();on(k,f){this.events.set(k,[...(this.events.get(k)||[]),f]);return this;}emit(k,v){for(const f of this.events.get(k)||[])f(v);}}
 class Conn extends Emitter{open=false;close(){this.open=false;this.emit('close');}send(){} }
 class Peer extends Emitter{constructor(){super();peers.push(this);}destroy(){}connect(){return new Conn();}}
 const math=Object.create(Math);math.random=()=>.999999;
 const c=vm.createContext({console,Math:math,Number,JSON,HEROES,GEMS,HERO_KEYS:[],DEFAULT_HERO:'vor',DEFAULT_THEME:'neon',POWER_CHARGE_LINES:8,GEM_MAX:5,GEM_BASE_CHANCE:.12,FUSION_COUNT:3,
  window:{Peer,addEventListener:(k,f)=>keys.set(k,f),removeEventListener:noop},document:{createElement:element},localStorage:{getItem:()=>null},Sound:new Proxy({},{get:()=>noop}),
  requestAnimationFrame:noop,cancelAnimationFrame:noop,setInterval:noop,clearInterval:noop,
  setTimeout:(fn,delay)=>{const id=++seq;jobs.set(id,{fn,at:now+delay});return id;},clearTimeout:id=>jobs.delete(id)});
 vm.runInContext(transport+'\n'+source+'\nthis.qa={set:s=>G=s,bindControls,launchVersusGame};',c);
 const root=element(),state={root,round:{},board:empty(),cur:{type:'O',color:'#active',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0},bag:['I','T','S','J','L','Z'],queue:Array.from({length:4},()=>({type:'O',color:'#next',matrix:[[0,1,1],[0,1,1],[0,0,0]],x:3,y:0})),previewCount:3,
  hero:HEROES.vor,charge:8,powerReady:true,score:0,lines:0,level:1,mode:'solo',paused:false,over:false,countdown:0,canHold:true,holdType:null,lockTimer:0,lockResets:0,dropAcc:0,gems:[],clearFlash:[],el:{gemSheet:element()}};
 for(const name of ['drawSide','updateHUD','updatePowerBtn','updateGemBtn','updateHeroBar','flash','screenShake','powerFX','spawnPowerParticles','bindTouchGestures','updateVersusUI','setupTetrisChat'])c[name]=noop;
 c.endGame=won=>{if(state.over)return;state.over=true;wins.push(won);};
 c.qa.set(state);c.qa.bindControls();
 const key=(key,patch={})=>state.keyHandler({key,target:{tagName:'DIV'},preventDefault:noop,...patch});
 const advance=ms=>{const until=now+ms;let guard=0;while(true){let first;for(const [id,j]of jobs)if(j.at<=until&&(!first||j.at<first[1].at))first=[id,j];if(!first)break;assert.ok(++guard<1000);jobs.delete(first[0]);now=first[1].at;first[1].fn();}now=until;};
 const startOnline=()=>{c.MP.createRoom(noop,'ABC234');peers[0].emit('open');const conn=new Conn();peers[0].emit('connection',conn);conn.open=true;conn.emit('open');c.qa.set(null);c.launchGame=()=>c.qa.set(state);c.qa.launchVersusGame();return conn;};
 return {c,state,key,advance,wins,startOnline};
}
let failed=0;
function test(name,fn){try{fn();console.log('PASS',name);}catch(e){failed++;console.error('FAIL',name,'\n'+e.message);}}
test('chat typing, editable fields and IME input cannot drop/hold/pause/use power',()=>{
 for(const target of [{tagName:'INPUT'},{tagName:'TEXTAREA'},{tagName:'SELECT'},{tagName:'BUTTON'},{tagName:'SPAN',isContentEditable:true},{tagName:'SPAN',closest:()=>({})}]){
  const h=harness(),before=JSON.stringify(h.state.board);
  for(const key of [' ','c','p','e','ArrowLeft','ArrowDown'])h.key(key,{target});
  assert.equal(JSON.stringify(h.state.board),before,'typing a space cannot lock a piece');
  assert.equal(h.state.cur.x,3);assert.equal(h.state.cur.y,0);assert.equal(h.state.holdType,null);assert.equal(h.state.paused,false);assert.equal(h.state.powerReady,true);
 }
 const h=harness();h.key(' ',{isComposing:true});assert.equal(h.state.board.flat().filter(Boolean).length,0);
});
test('held hard-drop and pause keys perform one action while movement repeats',()=>{
 const h=harness();h.key(' ');const count=h.state.board.flat().filter(Boolean).length;
 assert.equal(count,4,'first hard drop locks its real piece');
 for(let i=0;i<6;i++)h.key(' ',{repeat:true});assert.equal(h.state.board.flat().filter(Boolean).length,count,'OS repeat cannot drop the next six pieces');
 h.key('p');for(let i=0;i<5;i++)h.key('p',{repeat:true});assert.equal(h.state.paused,true,'held P must keep the round paused');
 h.key('p');h.key('ArrowLeft');h.key('ArrowLeft',{repeat:true});assert.equal(h.state.cur.x,1,'left/right/down retain repeat controls');
});
test('actual transport retry exhaustion settles a surviving versus round exactly once',()=>{
 const h=harness(),conn=h.startOnline();conn.close();h.advance(200000);
 assert.equal(h.state.oppAlive,false);assert.equal(h.state.over,true,'retry exhaustion finishes the match rather than showing a win while play continues');
 assert.deepEqual(h.wins,[true]);h.c.MP._gameHandler('reconnect_failed');assert.deepEqual(h.wins,[true]);
});
test('manual transport close cancels exhausted-retry results for a replacement game',()=>{
 const h=harness(),conn=h.startOnline();conn.close();h.c.MP.close();h.state.versus=false;h.advance(200000);
 assert.equal(h.state.over,false);assert.deepEqual(h.wins,[]);
});
if(failed)process.exitCode=1;
