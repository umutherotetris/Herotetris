// Real care module, serialized RTDB, injected failures. No browser/network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file=fs.readFileSync(new URL('../js/kozmo-care.js',import.meta.url),'utf8');
const source=file.replace(/^import .*;\s*$/mg,'').replace(/export /g,'')+'\nglobalThis.api={feedKozmo,fuseKozmos,retryKozmoCare};';
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
const snap=value=>{const fixed=clone(value??null);return {val:()=>clone(fixed),exists:()=>fixed!==null};};
const deny=()=>Object.assign(new Error('PERMISSION_DENIED'),{code:'PERMISSION_DENIED'});
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {resolve,promise};};
const localDay=clock=>new Date(clock.now+clock.offset*3600000).toISOString().slice(0,10);
function backend(){
  const clock={now:Date.parse('2026-10-22T22:30:00Z'),offset:3};
  const data={users:{alice:{kaju:500,inventory:{item_food10:3,item_food50:2,item_fusion:2}},bob:{inventory:{item_food10:5,item_fusion:5}}},
    kozmos:{alice:{eggs:{egg_one:{id:'egg_one',ownerId:'alice',feedCount:0},egg_two:{id:'egg_two',ownerId:'alice',feedCount:0}},
      creatures:{first:{typeKey:'nebula_kedi',name:'First',level:2},second:{typeKey:'mandalina_tav',name:'Second',level:4},other:{typeKey:'bulut_ruhu',name:'Other'}},
      hatchClaims:{prior:{creatureId:'prior'}},giftAcceptanceClaims:{prior:{eggId:'prior'}}}}};
  const hooks={},writes=[],transactions=[];let tail=Promise.resolve();
  const read=path=>path.split('/').reduce((node,key)=>node?.[key],data)??null;
  const put=(path,value)=>{const keys=path.split('/'),last=keys.pop();let node=data;for(const key of keys)node=node[key]??={};if(value===null)delete node[last];else node[last]=clone(value);writes.push({path,value:clone(value)});};
  const fdb={ref:(_db,path)=>path,get:async path=>{await hooks.beforeGet?.(path);const result=snap(read(path));await hooks.afterGet?.(path,result);return result;},
    runTransaction:async(path,update,options)=>{
      assert.equal(options?.applyLocally,false,'Resource/effect transactions must wait for server confirmation');transactions.push(path);await hooks.beforeTx?.(path);
      const job=tail.then(()=>{if(hooks.coldFirst)update(null);const next=update(clone(read(path)));if(next===undefined)return {committed:false,snapshot:snap(read(path))};put(path,next);return {committed:true,snapshot:snap(next)};});
      tail=job.catch(()=>{});const result=await job;await hooks.afterTx?.(path,result);return result;
    }};
  return {clock,data,hooks,writes,transactions,fdb,read,put};
}
function app(b){
  let uid='alice';const state=()=>({uid,status:uid?'google':'guest'});
  const clock=b.clock;
  class ClockDate extends Date{
    constructor(...args){super(...(args.length?args:[clock.now]));}
    static now(){return clock.now;}
    getFullYear(){return new Date(this.getTime()+clock.offset*3600000).getUTCFullYear();}
    getMonth(){return new Date(this.getTime()+clock.offset*3600000).getUTCMonth();}
    getDate(){return new Date(this.getTime()+clock.offset*3600000).getUTCDate();}
  }
  const context=vm.createContext({Auth:{getState:state},db:{},fdb:b.fdb,Date:ClockDate,console});
  vm.runInContext(source,context,{filename:'kozmo-care-functions.js'});
  return {...context.api,setAccount:next=>{uid=next;}};
}
const intents=(b,kind)=>Object.values(b.read('users/alice/heroKozmoCare')||{}).filter(intent=>!kind||intent.kind===kind);
const claims=b=>Object.values(b.read('kozmos/alice/careClaims')||{});
const feedCount=(b,id='egg_one')=>b.read('kozmos/alice/eggs/'+id+'/feedCount');
const exhaustFree=(b,id='egg_one',used=3)=>b.put('users/alice/heroKozmoFeeds/'+id,{day:localDay(b.clock),used});
const result=(name='Chosen')=>({typeKey:'fusion_nebula',name,rarity:'legendary',color:'#818cf8',power:'Saved power',bonus:{all:0.07}});
const fusion=(extra={})=>({firstId:'first',secondId:'second',firstType:'nebula_kedi',secondType:'mandalina_tav',result:result(),useStone:true,...extra});
let groups=0;

// The limit is per egg and local calendar day, not one cross-account/browser
// counter. The fourth feed reserves food after exactly three free effects.
{
  const b=backend(),a=app(b);assert.notEqual(localDay(b.clock),new Date(b.clock.now).toISOString().slice(0,10));
  for(let i=0;i<3;i++)assert.equal((await a.feedKozmo('egg_one')).ok,true);
  assert.equal(feedCount(b),3);assert.equal(b.read('users/alice/inventory/item_food10'),3);
  assert.equal(b.read('users/alice/heroKozmoFeeds/egg_one/day'),localDay(b.clock));assert.equal(b.read('users/alice/heroKozmoFeeds/egg_one/used'),3);
  assert.equal((await a.feedKozmo('egg_two')).ok,true);assert.equal(feedCount(b,'egg_two'),1);assert.equal(b.read('users/alice/inventory/item_food10'),3);
  assert.equal((await a.feedKozmo('egg_one')).ok,true);assert.equal(feedCount(b),4);assert.equal(b.read('users/alice/inventory/item_food10'),2);
  assert.equal(intents(b,'feed').filter(i=>i.resource.kind==='free').length,4);groups++;
}

// Active VIP gives five free feeds; expired VIP gives three. A local midnight
// resets only the next day's counter while retaining previous intent receipts.
{
  const b=backend(),a=app(b);b.put('users/alice/cosmetics/vip',JSON.stringify({until:b.clock.now+86400000}));
  for(let i=0;i<5;i++)assert.equal((await a.feedKozmo('egg_one')).ok,true);
  assert.equal(b.read('users/alice/inventory/item_food10'),3);assert.equal((await a.feedKozmo('egg_one')).ok,true);assert.equal(b.read('users/alice/inventory/item_food10'),2);
  b.clock.now+=86400000;assert.equal((await a.feedKozmo('egg_one')).ok,true);assert.equal(b.read('users/alice/heroKozmoFeeds/egg_one/used'),1);
  for(let i=0;i<2;i++)await a.feedKozmo('egg_one');assert.equal(b.read('users/alice/inventory/item_food10'),2);
  await a.feedKozmo('egg_one');assert.equal(b.read('users/alice/inventory/item_food10'),1);groups++;
}

// Invalid/missing/explicitly differently owned eggs and a food shortage cannot
// reserve rights or items. Legacy absent ownerId remains compatible elsewhere.
{
  const b=backend(),a=app(b);b.put('kozmos/alice/eggs/not_owned',{ownerId:'bob',feedCount:0});exhaustFree(b);b.put('users/alice/inventory/item_food10',0);b.put('users/alice/inventory/item_food50',0);
  const before=b.writes.length;
  for(const id of ['../bad','missing','not_owned','egg_one'])assert.equal((await a.feedKozmo(id)).ok,false,id);
  assert.equal((await a.feedKozmo('egg_one','alice',6)).ok,false);assert.equal(b.writes.length,before);assert.equal(intents(b).length,0);assert.equal(feedCount(b),0);groups++;
}

// Legacy local free-count migration is bounded and applies only when no
// authoritative current-day counter exists; food50 is used when food10 is empty.
{
  const b=backend(),a=app(b);b.put('users/alice/inventory/item_food10',0);
  assert.equal((await a.feedKozmo('egg_one','alice',3)).ok,true);assert.equal(b.read('users/alice/inventory/item_food50'),1);assert.equal(feedCount(b),1);
  b.put('users/alice/heroKozmoFeeds/egg_two',{day:localDay(b.clock),used:0});
  assert.equal((await a.feedKozmo('egg_two','alice',3)).ok,true);assert.equal(b.read('users/alice/inventory/item_food50'),1);assert.equal(feedCount(b,'egg_two'),1);groups++;
}

// Busy promises and persisted pending discovery coalesce simultaneous feed
// clicks/tabs into one reserved item and one effect.
{
  const b=backend(),a=app(b),other=app(b);exhaustFree(b);
  const results=await Promise.all([a.feedKozmo('egg_one'),a.feedKozmo('egg_one'),other.feedKozmo('egg_one')]);
  assert.ok(results.every(r=>r.ok));assert.equal(feedCount(b),1);assert.equal(b.read('users/alice/inventory/item_food10'),2);assert.equal(intents(b).length,1);assert.equal(claims(b).length,1);groups++;
}

// A paid reservation followed by denied target effect retains the same intent.
// Reload/retry and even a food-empty reattempt complete it with no extra use.
{
  const b=backend(),a=app(b);exhaustFree(b);b.hooks.beforeTx=path=>{if(path==='kozmos/alice')throw deny();};
  const first=await a.feedKozmo('egg_one');assert.equal(first.ok,false);assert.equal(first.pending,true);assert.equal(b.read('users/alice/inventory/item_food10'),2);assert.equal(feedCount(b),0);
  b.put('users/alice/inventory/item_food10',0);b.put('users/alice/inventory/item_food50',0);delete b.hooks.beforeTx;
  const reloaded=app(b);assert.equal((await reloaded.feedKozmo('egg_one')).ok,true);assert.equal(feedCount(b),1);assert.equal(intents(b).length,1);assert.equal(b.read('users/alice/inventory/item_food10'),0);groups++;
}

// Acknowledgements may fail after reserve, target effect, or profile finish.
// Persistent intent/claim state prevents an additional food debit or effect.
{
  for(const point of ['reserve','effect','finish']){
    const b=backend(),a=app(b);exhaustFree(b);let userWrites=0,failed=false;
    b.hooks.afterTx=(path,tx)=>{
      if(!tx.committed)return;if(path==='users/alice')userWrites++;
      if(!failed&&((point==='reserve'&&path==='users/alice'&&userWrites===1)||(point==='effect'&&path==='kozmos/alice')||(point==='finish'&&path==='users/alice'&&userWrites===2))){failed=true;throw new Error('lost '+point+' ack');}
    };
    await a.feedKozmo('egg_one');delete b.hooks.afterTx;await app(b).retryKozmoCare();
    assert.equal(feedCount(b),1,point);assert.equal(b.read('users/alice/inventory/item_food10'),2,point);assert.equal(intents(b).length,1);assert.equal(intents(b)[0].status,'complete');assert.equal(claims(b).length,1);
  }
  groups++;
}

// A removed target creates a terminal cancellation claim, then refunds exactly
// one reserved item. Reappearing targets cannot revive that cancelled intent.
{
  const b=backend(),a=app(b);exhaustFree(b);let removed=false;
  b.hooks.afterTx=(path,tx)=>{if(path==='users/alice'&&tx.committed&&!removed){removed=true;b.put('kozmos/alice/eggs/egg_one',null);}};
  const cancelled=await a.feedKozmo('egg_one');assert.equal(cancelled.cancelled,true);assert.equal(b.read('users/alice/inventory/item_food10'),3);assert.equal(intents(b)[0].status,'cancelled');assert.equal(claims(b)[0].status,'cancelled');
  delete b.hooks.afterTx;b.put('kozmos/alice/eggs/egg_one',{ownerId:'alice',feedCount:0});assert.equal((await a.retryKozmoCare()).length,0);assert.equal(feedCount(b),0);assert.equal(b.read('users/alice/inventory/item_food10'),3);groups++;
}

// Denied refunds keep the original resource reserved until retry. A refund
// that committed before an acknowledgement failure never credits twice.
{
  for(const mode of ['denied','lost-ack']){
    const b=backend(),a=app(b);exhaustFree(b);let profileWrites=0;
    b.hooks.afterTx=(path,tx)=>{if(path==='users/alice'&&tx.committed){profileWrites++;if(profileWrites===1)b.put('kozmos/alice/eggs/egg_one',null);else if(mode==='lost-ack'&&profileWrites===2)throw new Error('lost refund ack');}};
    if(mode==='denied')b.hooks.beforeTx=path=>{if(path==='users/alice'&&profileWrites>=1)throw deny();};
    const first=await a.feedKozmo('egg_one');assert.equal(first.ok,false);assert.equal(mode==='denied'?first.pending:first.cancelled,true);
    assert.equal(b.read('users/alice/inventory/item_food10'),mode==='denied'?2:3);
    delete b.hooks.beforeTx;delete b.hooks.afterTx;await app(b).retryKozmoCare();await a.retryKozmoCare();
    assert.equal(b.read('users/alice/inventory/item_food10'),3,mode);assert.equal(intents(b)[0].status,'cancelled');assert.equal(claims(b).length,1);
  }
  groups++;
}

// A cancelled free reservation restores that egg/day's free allowance.
{
  const b=backend(),a=app(b);let removed=false;
  b.hooks.afterTx=(path,tx)=>{if(path==='users/alice'&&tx.committed&&!removed){removed=true;b.put('kozmos/alice/eggs/egg_one',null);}};
  assert.equal((await a.feedKozmo('egg_one')).cancelled,true);assert.equal(b.read('users/alice/heroKozmoFeeds/egg_one/used'),0);assert.equal(b.read('users/alice/inventory/item_food10'),3);groups++;
}

// Fusion removes both authoritative parents and creates one saved output plus
// receipt in one root write. Other creatures and hatch/gift receipts survive.
{
  const b=backend(),a=app(b),before=b.writes.length;const fused=await a.fuseKozmos(fusion());assert.equal(fused.ok,true);
  const id=fused.intent.resultId;assert.ok(id.startsWith('fusion_care_'));assert.equal(b.read('kozmos/alice/creatures/first'),null);assert.equal(b.read('kozmos/alice/creatures/second'),null);
  assert.equal(b.read('kozmos/alice/creatures/'+id+'/name'),'Chosen');assert.equal(b.read('kozmos/alice/creatures/'+id+'/level'),4);assert.equal(b.read('kozmos/alice/creatures/'+id+'/bonus/all'),0.07);
  assert.ok(b.read('kozmos/alice/creatures/other'));assert.ok(b.read('kozmos/alice/hatchClaims/prior'));assert.ok(b.read('kozmos/alice/giftAcceptanceClaims/prior'));
  assert.equal(b.read('users/alice/inventory/item_fusion'),1);assert.equal(b.writes.slice(before).filter(w=>w.path==='kozmos/alice').length,1);assert.equal(claims(b).length,1);groups++;
}

// Fusion pending recovery uses the originally saved result even when the UI
// rerolls/proposes another result, and never reserves another stone.
{
  const b=backend(),a=app(b);b.hooks.beforeTx=path=>{if(path==='kozmos/alice')throw deny();};
  assert.equal((await a.fuseKozmos(fusion())).pending,true);assert.equal(b.read('users/alice/inventory/item_fusion'),1);assert.equal(b.read('kozmos/alice/creatures/first/typeKey'),'nebula_kedi');
  delete b.hooks.beforeTx;const recovered=await app(b).fuseKozmos(fusion({result:result('Rerolled')}));assert.equal(recovered.ok,true);assert.equal(recovered.intent.result.name,'Chosen');
  assert.equal(b.read('kozmos/alice/creatures/'+recovered.intent.resultId+'/name'),'Chosen');assert.equal(b.read('users/alice/inventory/item_fusion'),1);assert.equal(intents(b).length,1);groups++;
}

// Missing or changed parents at effect time cancel atomically and refund the
// stone. Initial invalid pairs/unique parents/stone shortage reserve nothing.
{
  const b=backend(),a=app(b);let removed=false;
  b.hooks.afterTx=(path,tx)=>{if(path==='users/alice'&&tx.committed&&!removed){removed=true;b.put('kozmos/alice/creatures/second',null);}};
  assert.equal((await a.fuseKozmos(fusion())).cancelled,true);assert.ok(b.read('kozmos/alice/creatures/first'));assert.equal(b.read('users/alice/inventory/item_fusion'),2);assert.equal(claims(b)[0].status,'cancelled');
  delete b.hooks.afterTx;const before=b.writes.length;
  for(const spec of [fusion(),fusion({secondId:'first'}),fusion({result:{...result(),rarity:'epic'}})])assert.equal((await a.fuseKozmos(spec)).ok,false);
  assert.equal(b.writes.length,before);
  const clean=backend(),fresh=app(clean);clean.put('users/alice/inventory/item_fusion',0);let unchanged=clean.writes.length;
  assert.equal((await fresh.fuseKozmos(fusion())).ok,false);assert.equal(clean.writes.length,unchanged);
  clean.put('users/alice/inventory/item_fusion',2);clean.put('kozmos/alice/creatures/first/unique',true);unchanged=clean.writes.length;
  assert.equal((await fresh.fuseKozmos(fusion())).ok,false);assert.equal(clean.writes.length,unchanged);
  clean.put('kozmos/alice/creatures/first/unique',false);clean.put('kozmos/alice/creatures/first/ownerId','bob');unchanged=clean.writes.length;
  assert.equal((await fresh.fuseKozmos(fusion())).ok,false);assert.equal(clean.writes.length,unchanged);groups++;
}

// Cross-tab fusion and target acknowledgement loss yield one output. The care
// receipt also survives later output deletion/fusion without recreating it.
{
  const b=backend(),a=app(b),other=app(b);let failed=false;
  b.hooks.afterTx=(path,tx)=>{if(path==='kozmos/alice'&&tx.committed&&!failed){failed=true;throw new Error('lost fusion effect ack');}};
  await Promise.all([a.fuseKozmos(fusion()),other.fuseKozmos(fusion({firstId:'second',secondId:'first',firstType:'mandalina_tav',secondType:'nebula_kedi'}))]);
  delete b.hooks.afterTx;await app(b).retryKozmoCare();const intent=intents(b)[0];assert.equal(intents(b).length,1);assert.equal(b.read('users/alice/inventory/item_fusion'),1);assert.equal(claims(b).length,1);
  b.put('kozmos/alice/creatures/'+intent.resultId,null);await a.retryKozmoCare();assert.equal(b.read('kozmos/alice/creatures/'+intent.resultId),null);groups++;
}

// Account changes are guarded before reservation, before effect, and before
// finish. Resuming the original account completes only its saved intent.
{
  for(const point of ['before-reserve','after-reserve','after-effect']){
    const b=backend(),a=app(b);exhaustFree(b);let changed=false;
    if(point==='before-reserve')b.hooks.beforeTx=path=>{if(path==='users/alice')a.setAccount('bob');};
    else b.hooks.afterTx=(path,tx)=>{if(tx.committed&&!changed&&path===(point==='after-reserve'?'users/alice':'kozmos/alice')){changed=true;a.setAccount('bob');}};
    assert.equal((await a.feedKozmo('egg_one')).ok,false);assert.equal(b.read('users/bob/heroKozmoCare'),null);assert.equal(b.read('kozmos/bob'),null);assert.equal(b.read('users/bob/inventory/item_food10'),5);
    delete b.hooks.beforeTx;delete b.hooks.afterTx;a.setAccount('alice');await a.retryKozmoCare();
    assert.equal(feedCount(b),point==='before-reserve'?0:1);assert.equal(b.read('users/alice/inventory/item_food10'),point==='before-reserve'?3:2);
  }
  groups++;
}

// A cold-null callback and absent optional legacy owner metadata preserve
// authoritative content while applying only one final effect.
{
  const b=backend(),a=app(b);b.hooks.coldFirst=true;b.put('kozmos/alice/eggs/egg_one',{feedCount:0});
  assert.equal((await a.feedKozmo('egg_one')).ok,true);assert.equal(feedCount(b),1);assert.ok(b.read('kozmos/alice/hatchClaims/prior'));assert.ok(b.read('kozmos/alice/creatures/other'));groups++;
}

// A committed finish whose acknowledgement and confirmation read both fail
// remains bound to that operation in the same module. The next user retry is
// an acknowledgement repair, not another free right or paid food use.
{
  for(const resource of ['free','food']){
    const b=backend(),a=app(b);if(resource==='food')exhaustFree(b);let profileWrites=0,blockConfirmation=false;
    b.hooks.afterTx=(path,tx)=>{if(path==='users/alice'&&tx.committed&&++profileWrites===2){blockConfirmation=true;throw new Error('lost final ack');}};
    b.hooks.beforeGet=path=>{if(blockConfirmation&&path.startsWith('users/alice/heroKozmoCare/'))throw new Error('confirmation offline');};
    const first=await a.feedKozmo('egg_one');assert.equal(first.ok,false);assert.equal(first.pending,true);assert.equal(first.operationId,intents(b)[0].id);assert.equal(intents(b)[0].status,'complete');
    blockConfirmation=false;delete b.hooks.afterTx;delete b.hooks.beforeGet;
    const retried=await a.feedKozmo('egg_one');assert.equal(retried.ok,true);assert.equal(retried.intent.id,first.operationId);assert.equal(feedCount(b),1);assert.equal(intents(b).length,1);
    assert.equal(b.read('users/alice/inventory/item_food10'),resource==='food'?2:3);assert.equal(b.read('users/alice/heroKozmoFeeds/egg_one/used'),resource==='food'?3:1);
  }
  groups++;
}

// A regular fusion needs no stone and preserves its complete inventory.
{
  const b=backend(),a=app(b);b.put('users/alice/inventory/item_fusion',0);
  const fused=await a.fuseKozmos(fusion({useStone:false,result:{...result('Natural'),rarity:'rare'}}));
  assert.equal(fused.ok,true);assert.equal(fused.intent.resource,null);assert.equal(b.read('users/alice/inventory/item_fusion'),0);assert.equal(b.read('kozmos/alice/creatures/'+fused.intent.resultId+'/rarity'),'rare');groups++;
}

// Run the actual merge selector/confirmation handler and real merge table.
// Cancelling the confirmation must occur before any care reservation or stone
// mutation, including when the selector's stone checkbox was already checked.
{
  const kozmos=fs.readFileSync(new URL('../js/kozmos.js',import.meta.url),'utf8');
  const between=(start,end)=>{const first=kozmos.indexOf(start),last=kozmos.indexOf(end,first);assert.ok(first>=0&&last>first,start);return kozmos.slice(first,last);};
  const uiSource=between('const TYPES={','export function randomType(')+between('function _careUiOwner(','async function _feedEggWithCare(')+between('function openMergeSelector(','async function showFusionAnimation(')+'\nglobalThis.uiApi={openMergeSelector,doMerge,getMergeResult};';
  class Node{
    constructor(){this.children=[];this.listeners={};this.references={};this.style={};this.isConnected=true;this.checked=false;this.text='';}
    set innerHTML(value){this.html=value;this.children=[];}
    get innerHTML(){return this.html;}
    appendChild(child){this.children.push(child);return child;}
    addEventListener(type,fn){this.listeners[type]=fn;}
    querySelector(selector){if(!this.references[selector])this.references[selector]=new Node();const node=this.references[selector];if(selector==='#useStoneChk')node.checked=true;return node;}
    remove(){this.isConnected=false;}
  }
  const b=backend(),a=app(b),body=new Node(),created=[];let reservations=0,itemUses=0,confirmations=0;
  const context=vm.createContext({Auth:{getState:()=>({uid:'alice',status:'google'})},document:{body,createElement:()=>{const node=new Node();created.push(node);return node;}},
    Store:{getItemCount:()=>2,useItem:()=>{itemUses++;throw Error('No stone consumption before confirmation');}},esc:value=>String(value),creatureSVG:()=>'<svg/>',_toast:()=>{},
    confirm:()=>{confirmations++;return false;},fuseKozmos:async(...args)=>{reservations++;return a.fuseKozmos(...args);},renderKozmos:async()=>{},showFusionAnimation:async()=>{},console});
  vm.runInContext(uiSource,context,{filename:'kozmos-care-ui-functions.js'});
  const first=b.read('kozmos/alice/creatures/first'),second=b.read('kozmos/alice/creatures/second');
  context.uiApi.openMergeSelector('first',first,{first,second},{uid:'alice'},{isConnected:true});
  const list=created.find(node=>node.references['#mergeTargetList'])?.references['#mergeTargetList'];assert.equal(list.children.length,1);
  await list.children[0].listeners.click();assert.equal(confirmations,1);assert.equal(reservations,0);assert.equal(itemUses,0);assert.equal(b.writes.length,0);assert.ok(b.read('kozmos/alice/creatures/first'));groups++;

  // The direct table returns Nova Kitsune normally, but a stone must override
  // that low-rarity fixed pair with a legendary result before a reservation.
  const natural=context.uiApi.getMergeResult('nebula_kedi','mandalina_tav',false);assert.equal(natural.key,'nova_kitsune');assert.equal(natural.r,'rare');
  for(let i=0;i<20;i++)assert.equal(context.uiApi.getMergeResult('nebula_kedi','mandalina_tav',true).r,'legendary');groups++;
}

console.log(`PASS ${groups} Kozmo care regression groups`);
