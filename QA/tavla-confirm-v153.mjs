// Actual confirmation callback lifecycle; no browser or production service.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../js/games/tavla.js',import.meta.url),'utf8');
function fn(name){
 const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);
 const rest=source.slice(start),end=/\n(?:async )?function \w+\(/.exec(rest.slice(1));
 return end?rest.slice(0,end.index+1):rest;
}
function fixture(){
 const overlays=[];
 const root={appendChild:el=>{el.isConnected=true;}};
 const game={root,state:{},_turnToken:{},gameEnded:false};
 const document={createElement:()=>{
  const buttons=new Map();const el={isConnected:false,remove(){this.isConnected=false;},querySelector:selector=>{
   if(!buttons.has(selector))buttons.set(selector,{addEventListener:(_type,cb)=>buttons.get(selector).click=cb});
   return buttons.get(selector);
  }};overlays.push(el);return el;
 }};
 const c=vm.createContext({G:game,document});vm.runInContext(fn('showConfirm'),c);
 return {c,game,overlays};
}
{
 const f=fixture();let yes=0,no=0;
 f.c.showConfirm('Resign?',()=>yes++,null,()=>no++);
 const ov=f.overlays[0];ov.querySelector('.tvcf-yes').click();ov.querySelector('.tvcf-no').click();
 assert.equal(yes,1);assert.equal(no,0);assert.equal(f.game.confirmPending,null);
}
for(const invalidate of [f=>f.c.G=null,f=>f.c.G={root:f.game.root,state:{},_turnToken:{}},f=>f.game.state={},f=>f.game._turnToken={},f=>f.game.gameEnded=true]){
 const f=fixture();let changed=0;f.c.showConfirm('Draw?',()=>changed++,null,()=>changed++);const ov=f.overlays[0];
 invalidate(f);ov.querySelector('.tvcf-yes').click();assert.equal(changed,0,'stale match/position/turn/result must not receive a confirmation');
}
{
 const f=fixture();let old=0,current=0;
 f.c.showConfirm('Old draw',()=>old++);const prior=f.overlays[0];
 f.c.showConfirm('Current break',()=>current++);const next=f.overlays[1];
 assert.equal(prior.isConnected,false);assert.equal(next.isConnected,true);
 prior.querySelector('.tvcf-yes').click();assert.equal(old,0);assert.equal(f.game.confirmPending,next);
 next.querySelector('.tvcf-yes').click();assert.equal(current,1);
}
{
 const f=fixture();f.game.gameEnded=true;f.c.showConfirm('Finished',()=>assert.fail());assert.equal(f.overlays.length,0);
}
console.log('PASS Tavla confirmations: exactly-once answers, replacement/close/turn/position/result isolation and a single visible confirmation.');
