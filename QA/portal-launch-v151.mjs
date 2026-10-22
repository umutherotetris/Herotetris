// Actual launch and invitation functions, with deferred imports and no account writes.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root = new URL('../', import.meta.url);
const source = fs.readFileSync(new URL('js/game-launcher.js', root), 'utf8');
const social = fs.readFileSync(new URL('js/social.js', root), 'utf8');
function fixture(){
  const events = [], messages = [], imports = [], storage = new Map();
  let active = null, uid = 'player-a';
  const context = vm.createContext({
    window:{Hero:{toast:(...args) => messages.push(args)}},
    document:{querySelector:() => active, dispatchEvent:event => events.push(event)},
    CustomEvent:class { constructor(type, options){ this.type = type; this.detail = options.detail; } },
    console:{error:()=>{}},
    __load:path => new Promise((resolve,reject) => imports.push({path,resolve,reject})),
    Auth:{getState:() => ({uid})},H:null,
    localStorage:{setItem:(key,value) => storage.set(key,value),removeItem:key => storage.delete(key)},
  });
  vm.runInContext(source.replaceAll('export ', '').replace('import(entry.path)', '__load(entry.path)') + '\nthis.launch=launchPortalGame;', context);
  const start = social.indexOf('function _launchGameAsInviteHost(');
  const end = social.indexOf('// ── Profil: arkadaş listesi', start);
  vm.runInContext(social.slice(start,end) + '\nthis.host=_launchGameAsInviteHost;this.guest=_acceptGameInvite;', context);
  return {context, events, messages, imports, storage, setActive:value => active=value, setUid:value => uid=value};
}
let groups = 0;
{
  const f = fixture(); let opens=0;
  const first = f.context.launch('chess'), duplicate = f.context.launch('chess');
  assert.equal(first, duplicate, 'rapid same-game taps share the pending request');
  const latest=f.context.launch('tavla');
  assert.equal(f.imports.length,2);
  f.imports[1].resolve({openTavla:()=>{opens++;f.setActive({game:'tavla'});}});
  assert.equal(await latest,true);
  f.imports[0].resolve({openChess:()=>{opens++;}});
  assert.equal(await first,false);assert.equal(opens,1);assert.equal(f.events.length,1,'only latest card selection opens');
  assert.equal(await f.context.launch('tetris'),false,'active game blocks collection launch');
  f.setActive(null);
  const next=f.context.launch('tavla');f.imports[2].resolve({openTavla:()=>{opens++;}});
  assert.equal(await next,true);assert.equal(opens,2);groups++;
}
{
  const f=fixture();let opens=0;
  const first=f.context.launch('chess'),second=f.context.launch('tavla'),last=f.context.launch('chess');
  f.imports[0].resolve({openChess:()=>{opens++;}});
  f.imports[1].resolve({openTavla:()=>{opens++;}});
  f.imports[2].resolve({openChess:()=>{opens++;}});
  assert.equal(await first,false);assert.equal(await second,false);assert.equal(await last,true);
  assert.equal(opens,1,'A→B→A opens the last selection exactly once');groups++;
}
{
  const f=fixture();
  const broken=f.context.launch('chess');f.imports[0].reject(new Error('offline'));
  assert.equal(await broken,false);assert.equal(f.events.length,0);
  const retry=f.context.launch('chess');f.imports[1].resolve({openChess:()=>{}});
  assert.equal(await retry,true,'failed import releases the launch slot');
  const blocked=f.context.launch('tavla');f.setActive({game:'direct'});
  let opened=false;f.imports[2].resolve({openTavla:()=>{opened=true;}});
  assert.equal(await blocked,false);assert.equal(opened,false,'game opened during import is preserved');groups++;
}
{
  const f=fixture();let opens=0;
  const invite=f.context.guest('chess','ABC123','Friend');
  assert.equal(f.imports[0].path,'./games/chess.js');
  assert.ok(fs.existsSync(new URL('js/'+f.imports[0].path,root)),'invite resolves to an actual game module');
  assert.equal(f.storage.size,0,'context is not written while the module is still loading');
  f.setUid('player-b');f.imports[0].resolve({openChess:()=>{opens++;}});
  assert.equal(await invite,false);assert.equal(opens,0);assert.equal(f.storage.size,0,'account change cancels pending invitation');
  f.setActive({game:'tavla'});
  assert.equal(await f.context.guest('chess','ABC123','Friend'),false);
  assert.equal(f.storage.size,0,'busy game does not leave an invitation for a later launch');groups++;
}
{
  const f=fixture();let releaseWrite, opens=0;
  const host=f.context.host('tavla','ABC123','Friend',()=>new Promise(resolve=>{releaseWrite=resolve;}));
  f.imports[0].resolve({openTavla:()=>{opens++;}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await f.context.launch('chess'),false,'host reserves launch before its invitation write');
  releaseWrite();assert.equal(await host,true);assert.equal(opens,1);
  assert.equal(JSON.parse(f.storage.get('hero_invite_ctx')).role,'host');
  assert.equal(f.events[0].detail.modulePath,'./games/tavla.js');groups++;
}
{
  const f=fixture();let current=true, releaseWrite, oldOpens=0;
  const host=f.context.host('tavla','ABC123','Friend',()=>new Promise(resolve=>{releaseWrite=resolve;}),()=>current);
  f.imports[0].resolve({openTavla:()=>{oldOpens++;}});
  await new Promise(resolve=>setImmediate(resolve));
  current=false;
  const next=f.context.launch('chess');f.imports[1].resolve({openChess:()=>{}});
  assert.equal(await next,true,'closing the picker releases even a stalled invitation launch');
  releaseWrite();assert.equal(await host,false);assert.equal(oldOpens,0);
  assert.equal(f.storage.size,0,'late old invitation cannot leave context or reopen its game');groups++;
}
{
  const f=fixture();
  const invite=f.context.guest('tetris','ABC123','Friend');
  f.imports[0].resolve({openTetris:()=>{throw new Error('open failed');}});
  assert.equal(await invite,false);assert.equal(f.storage.size,0,'failed opener clears context');
  assert.equal(await f.context.launch('__proto__'),false,'unknown keys cannot load prototype properties');
  assert.equal(f.events.length,0);groups++;
}
{
  const f=fixture();let subscription, renders=0;
  Object.assign(f.context,{
    H:{},db:{},
    fdb:{ref:(_db,path)=>path,query:ref=>ref,limitToLast:()=>20,onValue:(ref,callback)=>{subscription={ref,callback};return ()=>{};}},
    renderNotifPane:()=>{renders++;},
    esc:value=>String(value ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;'),
    tAgo:()=>'',
  });
  const begin=social.indexOf('function listenKelimeInvites('), end=social.indexOf('\nfunction listenBroadcasts(',begin);
  const cardStart=social.indexOf('function renderNotifCard('),cardEnd=social.indexOf('\nfunction renderNotifPane(',cardStart);
  vm.runInContext(social.slice(begin,end)+social.slice(cardStart,cardEnd)+'\nthis.listenInvites=listenKelimeInvites;this.card=renderNotifCard;',f.context);
  f.context.listenInvites('player-a');
  assert.equal(subscription.ref,'gameInvites/player-a','hub reads the same native invite collection as Kelime');
  const now=Date.now();
  const rows={
    valid:{game:'kelime',gameId:'room-1',fromUid:'friend',fromName:'<Friend>',ts:now,lang:'en'},
    expired:{game:'kelime',gameId:'room-2',fromUid:'friend',ts:now-300001},
    other:{game:'chess',gameId:'room-3',fromUid:'friend',ts:now},
  };
  const snapshot={exists:()=>true,forEach:fn=>Object.entries(rows).forEach(([key,value])=>fn({key,val:()=>value}))};
  subscription.callback(snapshot);
  assert.equal(f.context.H.kelimeInviteRows.length,1,'malformed, expired and other-game records are excluded');
  const card=f.context.card(f.context.H.kelimeInviteRows[0]);
  assert.match(card,/data-klaccept="valid"/);assert.match(card,/data-klreject="valid"/);
  assert.doesNotMatch(card,/data-giaccept|data-ndel|<Friend>/,'native invite has its own accept/remove routes and escaped name');
  assert.match(card,/English/);
  f.setUid('player-b');subscription.callback(snapshot);assert.equal(renders,1,'old account listener cannot replace new account invitations');groups++;
}
console.log(`PASS portal v151: ${groups} launch/invitation concurrency groups (deferred imports and in-memory account boundary).`);
