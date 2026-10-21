// Real controllers and online modules with a shared, in-memory Firebase adapter.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import * as engine from '../js/games/kelime-engine.js';
const ref=process.env.KELIME_EXCHANGE_SOURCE_REF;
const read=path=>ref?execFileSync('git',['show',`${ref}:${path}`],{encoding:'utf8'}):fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('js/games/kelime.js'),onlineSource=read('js/games/kelime-online.js');
function fn(name){const start=source.search(new RegExp(`^(?:async )?function ${name}\\(`,'m'));assert.ok(start>=0,name);const s=source.slice(start),next=/\n(?:async )?function \w+\(/.exec(s);return next?s.slice(0,next.index):s;}
const clone=x=>structuredClone(x),noop=()=>{};
let importNo=0;
function backend(initial){
  const data={kelimeGames:{shared:clone(initial)}},listeners=new Map();
  const get=path=>path.split('/').filter(Boolean).reduce((o,k)=>o?.[k],data)??null;
  function set(path,value){const keys=path.split('/').filter(Boolean);let at=data;for(const k of keys.slice(0,-1))at=at[k]??={};at[keys.at(-1)]=clone(value);}
  const snap=value=>({exists:()=>value!==null,val:()=>clone(value)});
  const fdb={ref:(_db,path)=>path,get:async path=>snap(get(path)),
    update:async(path,patch)=>{for(const[k,v]of Object.entries(patch))set(path+'/'+k,v);for(const[p,cbs]of listeners)if(path===p||path.startsWith(p+'/'))for(const cb of cbs)cb(snap(get(p)));},
    onValue:(path,cb)=>{if(!listeners.has(path))listeners.set(path,new Set());listeners.get(path).add(cb);queueMicrotask(()=>{if(listeners.get(path)?.has(cb))cb(snap(get(path)));});return()=>listeners.get(path)?.delete(cb);},
    onDisconnect:()=>({set:async()=>{},cancel:async()=>{}})
  };
  return {fdb,get,room:()=>clone(get('kelimeGames/shared'))};
}
async function moduleFor(bus,uid){
  globalThis.__exchangeDeps={Auth:{getState:()=>({uid})},db:{},fdb:bus.fdb};
  const rewritten=onlineSource.replace("import { Auth, db, fdb } from '../auth.js';",'const {Auth,db,fdb}=globalThis.__exchangeDeps;');
  const mod=await import('data:text/javascript;base64,'+Buffer.from(rewritten+'\n// '+importNo++).toString('base64'));
  delete globalThis.__exchangeDeps;return mod;
}
async function controller(mod){
  let restored;await mod.resumeGame('shared',{onResumed:value=>restored=value});assert.ok(restored);
  const scheduled=[],c=vm.createContext({...engine,G:{root:{querySelector:()=>({})}},KO:mod,KL_LANG:'tr',
    klSetLang:engine.setLanguage,stopTurnTimer:noop,buildGameDOM:noop,renderAll:noop,renderScores:noop,
    setLastMove:noop,handleDrawOffer:noop,trackBest:noop,flashStatus:noop,scorePopup:noop,sndBingo:noop,confetti:noop,sndWord:noop,sndPick:noop,
    haptic:noop,updateExchangeBtn:noop,window:{},afterGame:cb=>scheduled.push(cb)});
  const names=['startOnline','applyRemote','recallConflictingPending','performExchange'];if(source.includes('function syncOnlineBag('))names.unshift('syncOnlineBag');
  vm.runInContext(names.map(fn).join('\n'),c);
  c.startOnline(restored.role,restored.gameId,restored.oppName,restored.seed,restored);await Promise.resolve();
  c.flush=()=>{for(const cb of scheduled.splice(0))cb();};return c;
}
function inventory(tiles){const counts={};for(const t of tiles){const key=t.joker?'joker':`${t.letter}:${t.points}`;counts[key]=(counts[key]||0)+1;}return counts;}
for(const lang of ['tr','en']){
  engine.setLanguage(lang);const seed=7301,initial=engine.buildBagSeeded(seed),board=Array.from({length:15},()=>Array(15).fill(null));
  // Omit bagReturns to exercise compatibility with rooms created before v150.
  const room={seed,lang,boardStr:JSON.stringify(board),players:{A:'alice',B:'bob'},names:{A:'Alice',B:'Bob'},scores:{A:0,B:0},status:'active',mode:'async',turnHours:72,turn:'A',bagPointer:14,passStreak:0,racks:{A:initial.slice(0,7),B:initial.slice(7,14)}};
  const bus=backend(room),mods={A:await moduleFor(bus,'alice'),B:await moduleFor(bus,'bob')};
  const clients={A:await controller(mods.A),B:await controller(mods.B)};
  function conserved(label){
    const A=clients.A.G,B=clients.B.G;
    assert.equal(JSON.stringify(A.bag),JSON.stringify(B.bag),label+': shared deterministic bag agrees');
    assert.equal(A.state.bagPointer,B.state.bagPointer,label+': cursor agrees');
    const available=A.bag.slice(A.state.bagPointer),inPlay=[...A.rackView,...B.rackView,...A.state.board.flat().filter(Boolean)];
    assert.deepEqual(inventory([...available,...inPlay]),inventory(initial),label+': every letter and joker is conserved');
    assert.equal(available.length,initial.length-14,label+': exchange does not deplete the bag');
  }
  conserved(lang+' legacy hydration');
  for(let turn=0;turn<20;turn++){
    const role=turn%2?'B':'A',c=clients[role];assert.equal(c.G.state.turn,role);
    c.performExchange([0,1,2,3,4]);await Promise.resolve();c.flush();conserved(lang+' exchange '+turn);
    assert.equal(bus.room().racks[role].length,7,'async room keeps the exchanged rack for reconnect');
    if(turn===3||turn===18){
      const reconnect=turn===3?'A':'B',before=JSON.stringify(clients[reconnect].G.rackView);
      await mods[reconnect].leaveRoom();clients[reconnect]=await controller(mods[reconnect]);
      assert.equal(JSON.stringify(clients[reconnect].G.rackView),before,'reconnect restores the current rack');
      conserved(lang+' reconnect '+reconnect);
    }
  }
  assert.ok(bus.room().bagPointer>initial.length,'test consumes returned tiles after passing the original seed bag');
  console.log('PASS '+lang+' A/B exchanges, exact inventory, returned-tile draws, legacy room and both reconnects.');
}
engine.setLanguage('tr');
