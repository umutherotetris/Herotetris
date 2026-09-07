
(()=>{
'use strict';
if(window.__SUKUN_R693_TERMINAL_TRUTH__)return;window.__SUKUN_R693_TERMINAL_TRUTH__=1;
const VERSION='r693';let reconciles=0,prunedMedia=0,prunedSes=0,ghostFixes=0,lastReason='ready',lastAt=Date.now(),pending=false;
const silent=el=>!!(el&&el.dataset?.sukSilentCarrier==='1');
function physical(){
  let ses=0;try{for(const a of [...SES.ler])if(a&&!a.paused&&!a.ended&&!silent(a))ses++}catch(e){}
  let tts=false;try{tts=!!(speechSynthesis.speaking||speechSynthesis.pending)}catch(e){}
  let freq=false,amb=false,vh=false,auto=false;try{freq=!!FR.playing}catch(e){};try{amb=!!Object.keys(AMB||{}).length}catch(e){};try{vh=!!VH.playing}catch(e){};try{auto=!!Z.auto}catch(e){}
  let journey=false;try{const b=window.SukunBerhetiyyeSeyir?.state?.(),e=window.SukunEsma99Seyir?.state?.();journey=!!((b?.run&&!b?.paused)||(e?.run&&!e?.paused)||b?.systemHold||e?.systemHold)}catch(e){}
  let lock=false;try{lock=!!(window.SukunLockAudio?.calisiyor?.()&&!silent(_r476LockAudio))}catch(e){}
  /* r693: eski okuyucuların hepsi SES/VH altında değil. AudioLife.busy()
     onların gerçek fiziksel bayraklarını da bilir; terminal truth onları
     yanlışlıkla idle'a düşürmesin. Hub.busy() burada kullanılmaz (self-latch). */
  let lifeBusy=false;try{lifeBusy=!!window.AudioLife?.busy?.()}catch(e){}
  return{ses,tts,freq,amb,vh,auto,journey,lock,lifeBusy,tangible:!!(lifeBusy||ses||tts||freq||amb||vh||auto||journey||lock)};
}
function reconcile(reason='event'){
  pending=false;lastReason=reason;lastAt=Date.now();reconciles++;
  try{
    const H=window.SukunAudioHub;
    if(H?.mediaActive){for(const el of [...H.mediaActive]){if(!el||silent(el)||el.paused||el.ended){H.mediaActive.delete(el);prunedMedia++}}}
  }catch(e){}
  try{
    for(const el of [...SES.ler]){if(!el||el.ended){SES.ler.delete(el);prunedSes++}}
  }catch(e){}
  const p=physical();
  /* auto=true fiziksel ritim/scheduler niyetidir; sessiz carrier tek başına
     tangible değildir. Tam terminal durumda stale Hub/Life 'playing' temizlenir. */
  if(!p.tangible){
    try{const H=window.SukunAudioHub;if(H&&!H.userPaused&&['playing','preparing','recovering','interrupted'].includes(H.state)){H.provider='';H.title='SÜKÛN';H.startedAt=0;H.set('idle','r693-terminal-truth');ghostFixes++}}catch(e){}
    try{const L=window.AudioLife;if(L&&!L.userPaused&&['playing','preparing','recovering','interrupted'].includes(L.state)){L.wasBusy=false;L.set('idle','r693-terminal-truth');ghostFixes++}}catch(e){}
  }
  try{window.SukunAudioSessionRegistry?.sync?.()}catch(e){}
  try{window.SukunAudioTruth?.refresh?.('r693-terminal-truth')}catch(e){}
  return p;
}
function schedule(reason){lastReason=reason;if(pending)return;pending=true;queueMicrotask(()=>reconcile(reason))}
['sukun:audiostate','sukun:audiosessionchange','sukun:playbackchange','sukun:foregroundvoicechange','sukun:zikirtransportgate','sukun:journeyaudiostate','sukun:zikirtransaction','sukun:mediaactivitychange'].forEach(ev=>window.addEventListener(ev,()=>schedule(ev),{passive:true}));
/* r695 — terminal truth unlock olaylarını da tek fiziksel dönüşte birleştir. */
let returnTimer=0,returnReason='';
function scheduleReturn(reason){returnReason=reason;clearTimeout(returnTimer);returnTimer=setTimeout(()=>{returnTimer=0;reconcile(returnReason||reason)},90)}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(returnTimer);returnTimer=0}else scheduleReturn('visible')},{passive:true});
window.addEventListener('pageshow',()=>{if(!document.hidden)scheduleReturn('pageshow')},{passive:true});
window.SukunR693Integrity=Object.freeze({version:VERSION,reconcile,snapshot:()=>Object.freeze({version:VERSION,reconciles,prunedMedia,prunedSes,ghostFixes,lastReason,lastAt,pending,returnPending:!!returnTimer,physical:physical(),hub:window.SukunAudioHub?.snapshot?.()||null,life:window.AudioLife?.snapshot?.()||null,lockTarget:window.SukunLockTargetAuthorityR693?.snapshot?.()||null,panRaf:!!KAYIT_RAF})});
setTimeout(()=>reconcile('boot'),0);
})();
