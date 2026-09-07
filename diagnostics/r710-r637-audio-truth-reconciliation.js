
(()=>{
'use strict';
if(window.SukunAudioTruth?.version==='r710')return;
const VERSION='r710';
const listeners=new Set();let state=null,timer=0,lastSig='',seq=0,reconciling=false;
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const safe=(fn,f=null)=>{try{return fn()}catch(e){return f}};
const norm=v=>{v=clean(v).toLowerCase();if(['playing','running','preparing','recovering'].includes(v))return'playing';if(['paused','pause'].includes(v))return'paused';if(['stopping'].includes(v))return'stopping';return'idle'};
function physical(){
  const hub=safe(()=>window.SukunAudioHub?.snapshot?.(),{})||{};
  const j28=safe(()=>window.SukunBerhetiyyeSeyir?.state?.(),null),j99=safe(()=>window.SukunEsma99Seyir?.state?.(),null);
  const journey28=!!(j28?.run&&!j28?.paused),journey99=!!(j99?.run&&!j99?.paused);
  const terkip=!!safe(()=>window.SukunTerkipVoice?.snapshot?.()?.active,false);
  const lock=!!safe(()=>window.SukunLockAudio?.calisiyor?.()||window.SukunLockAudio?.playing?.(),false);
  const speech=!!safe(()=>speechSynthesis?.speaking||speechSynthesis?.pending,false);
  const autoVoice=!!safe(()=>typeof Z!=='undefined'&&Z.auto&&(!window.zikirSesliAktifMi||zikirSesliAktifMi())&&!window.SukunZikirTransportGate?.snapshot?.()?.held,false);
  const background=!!safe(()=>{const a=typeof miniPlayingInfo==='function'?miniPlayingInfo()?.tam||[]:[];return a.some(x=>x&&x.tur!=='okuyucu')},false);
  return Object.freeze({journey28,journey99,terkip,lock,speech,autoVoice,background,media:+hub.media||0,tts:+hub.tts||0});
}
function derive(reason='snapshot'){
  const R=window.SukunAudioSessionRegistry;
  const regState=norm(safe(()=>R?.aggregateState?.(),'idle'));
  const ctl=safe(()=>R?.controllerSnapshot?.(),null),agg=safe(()=>R?.aggregateSnapshot?.(),null)||{};
  const life=safe(()=>window.AudioLife?.snapshot?.(),null)||{},hub=safe(()=>window.SukunAudioHub?.snapshot?.(),null)||{};
  const arb=safe(()=>window.SukunForegroundArbiter?.snapshot?.(),null);
  const phy=physical();
  const sessions=safe(()=>R?.list?.().map(id=>R?.snapshot?.(id)?.machine).filter(Boolean),[])||[];
  const nonMixPlaying=sessions.some(x=>x.id!=='mix'&&norm(x.state)==='playing');
  const nonMixPaused=sessions.some(x=>x.id!=='mix'&&norm(x.state)==='paused');
  // r710: a logical registry 'playing' is not proof of audible activity.
  // r693 and this owner must agree on the same physical evidence; otherwise
  // they can endlessly alternate AudioLife playing/idle on the main thread.
  const userPaused=!!(life.userPaused||agg.paused);
  const terminalPhysical=safe(()=>window.SukunR693Integrity?.physical?.(),null);
  const tangible=terminalPhysical?!!terminalPhysical.tangible:
    (phy.journey28||phy.journey99||phy.terkip||phy.lock||phy.speech||phy.autoVoice||phy.background||phy.media>0||phy.tts>0);
  const pendingPhysical=!tangible&&!userPaused&&
    ['preparing','recovering','interrupted'].includes(clean(life.state))&&
    Date.now()-(life.lastChange||0)<2500;

  let canonical='idle';
  if(userPaused){canonical=(nonMixPaused||nonMixPlaying||norm(ctl?.state)==='paused'||norm(ctl?.state)==='playing'||phy.journey28||phy.journey99)?'paused':'idle'}
  else if(tangible)canonical='playing';
  else if(!pendingPhysical&&(nonMixPaused||norm(ctl?.state)==='paused'))canonical='paused';
  else if(regState==='stopping')canonical='stopping';
  const observed=[...(arb?.observed?.spokenOwners||[])];
  const owner=arb?.owner||((observed[0])?{type:observed[0],id:observed[0],identity:observed[0],title:observed[0]}:null);
  const issues=[];
  const hubN=norm(hub.state),lifeN=norm(life.state);
  if(canonical==='paused'&&hubN==='playing')issues.push('hub-playing-while-paused');
  if(canonical==='paused'&&lifeN==='playing')issues.push('life-playing-while-paused');
  if(canonical==='idle'&&hubN==='playing')issues.push('hub-playing-without-tangible');
  if(canonical==='idle'&&lifeN==='playing')issues.push('life-playing-without-tangible');
  if(regState==='playing'&&!tangible&&!userPaused)issues.push('registry-playing-without-tangible');
  if(arb?.owner&&observed.length&&!observed.includes(arb.owner.type)&&!arb.owner.persistent)issues.push('arbiter-owner-not-observed');
  return Object.freeze({version:VERSION,seq:seq+1,at:Date.now(),reason,pendingPhysical,state:canonical,playing:canonical==='playing',paused:canonical==='paused',userPaused,tangible,source:owner?.type||(nonMixPlaying?clean(ctl?.id):phy.lock?'lock-audio':phy.speech?'tts':phy.background?'mix':'idle'),owner,registry:Object.freeze({state:regState,provider:clean(ctl?.id||''),controllerState:norm(ctl?.state),aggregate:agg}),life:Object.freeze({...life,state:clean(life.state||'idle')}),hub:Object.freeze({...hub,state:clean(hub.state||'idle')}),arbiter:arb,physical:phy,issues:Object.freeze(issues)});
}
function signature(s){return[s.state,s.userPaused,s.tangible,s.source,s.owner?.type,s.registry.state,s.registry.provider,s.registry.controllerState,s.life.state,s.hub.state,...s.issues].join('|')}
function reconcile(reason='event'){
  if(reconciling)return state||derive(reason);reconciling=true;
  try{
    const s=derive(reason),H=window.SukunAudioHub,L=window.AudioLife;
    if(s.pendingPhysical){
      // No physical playback yet: retain the legitimate pending state.
      // Only the original owner can complete or cancel this preparation.
    }else if(s.state==='paused'){
      /* r641 — observed/provider pause kullanıcı niyeti değildir. r640 raporu
         kullanıcı pause yapmadığı halde Berhetiyye kaynak yarışında paused
         görülünce bu blok H/L.userPaused=true yazarak geçici kesintiyi kalıcı
         kullanıcı pause'una çeviriyordu. Yalnız derive() zaten gerçek
         user/aggregate pause latch'i gördüyse kullanıcı niyetini taşırız. */
      const explicitPause=!!s.userPaused;
      if(H){
        if(explicitPause)H.userPaused=true;else if(H.userPaused)H.userPaused=false;
        if(norm(H.state)==='playing'){H.state='paused';H.reason='truth:'+reason;H.lastPulse=Date.now();try{H.render?.()}catch(e){}}
      }
      if(L&&explicitPause&&!L.userPaused)L.userPaused=true;
      if(L&&norm(L.state)!=='paused')try{L.set?.('paused','truth:'+reason)}catch(e){}
    }else if(s.state==='playing'){
      if(H&&H.userPaused&&!L?.userPaused)H.userPaused=false;
      if(L&&L.userPaused===false&&norm(L.state)!=='playing'&&!['interrupted','recovering'].includes(clean(L.state)))try{L.set?.('playing','truth:'+reason)}catch(e){}
      if(H&&!H.userPaused&&norm(H.state)!=='playing'&&!['interrupted','recovering','preparing'].includes(clean(H.state))){H.state='playing';H.reason='truth:'+reason;H.lastPulse=Date.now();try{H.render?.()}catch(e){}}
    }else if(s.state==='idle'){
      /* r658 — canonical idle fiziksel gerçektir. Kullanıcı pause latch'i yoksa
         eski paused/stopping/stopped/ended gölgeleri de terminal idle'a iner.
         interrupted/recovering korunur; böylece gerçek lifecycle recovery
         kesintisinin üstüne yazılmaz. */
      const hs=clean(H?.state).toLowerCase(),ls=clean(L?.state).toLowerCase();
      const hTerminal=['playing','paused','stopping','stopped','ended'].includes(hs);
      const lTerminal=['playing','paused','stopping','stopped','ended'].includes(ls);
      if(H&&!H.userPaused&&hTerminal){H.state='idle';H.reason='truth:'+reason;H.lastPulse=Date.now();try{H.render?.()}catch(e){}}
      if(L&&!L.userPaused&&lTerminal)try{L.set?.('idle','truth:'+reason)}catch(e){}
    }
    const next=derive(reason),sig=signature(next);if(!state||sig!==lastSig){seq++;state=Object.freeze({...next,seq});lastSig=sig;listeners.forEach(fn=>{try{fn(state)}catch(e){}});try{window.dispatchEvent(new CustomEvent('sukun:audiotruthchange',{detail:state}))}catch(e){}}
    return state||next;
  }finally{reconciling=false}
}
function schedule(reason='event'){if(timer)return;timer=setTimeout(()=>{timer=0;reconcile(reason)},92)}
function snapshot(){return state||reconcile('snapshot')}
function subscribe(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);try{fn(snapshot())}catch(e){};return()=>listeners.delete(fn)}
window.SukunAudioTruth=Object.freeze({version:VERSION,snapshot,refresh:reconcile,subscribe});
['sukun:audiosessionchange','sukun:audioaggregatechange','sukun:playbackchange','sukun:audiostate','sukun:sessionstate','sukun:foregroundqueuechange','sukun:foregroundvoicechange','sukun:terkipvoicechange','sukun:journey-advance','sukun:sectionidentitycommit','sukun:journey-complete','sukun:zikirtransportgate'].forEach(ev=>window.addEventListener(ev,()=>schedule(ev),{passive:true}));
document.addEventListener('visibilitychange',()=>schedule('visibility'),{passive:true});window.addEventListener('pageshow',()=>schedule('pageshow'),{passive:true});
setTimeout(()=>reconcile('boot'),350);
})();
