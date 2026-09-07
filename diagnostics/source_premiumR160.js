
(()=>{
'use strict';
/* ═══ 1) MERKEZÎ HATA + PERFORMANS ═══ */
const PR_DIAG_FLAG_KEY='sukun.diag';
const PRERR_KEY='sukun.diag.events';
const PR_BUILD=(()=>{try{return document.querySelector('meta[name="sukun-build"]')?.content||'unknown'}catch(e){return'unknown'}})();
const PR_SESSION='s'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
/* r691 — tanı açma bayrağı ile olay deposu artık aynı localStorage anahtarını
   paylaşmaz. Eski JSON dizi bir kez yeni anahtara taşınır; '1' tanı bayrağına dokunulmaz. */
try{
  const legacy=localStorage.getItem(PR_DIAG_FLAG_KEY),existing=localStorage.getItem(PRERR_KEY);
  if(!existing&&legacy&&/^\s*\[/.test(legacy)){JSON.parse(legacy);localStorage.setItem(PRERR_KEY,legacy);localStorage.removeItem(PR_DIAG_FLAG_KEY)}
}catch(e){}
const PRERR={
  key:PRERR_KEY,max:80,
  get(){try{const raw=JSON.parse(localStorage.getItem(this.key)||'[]');return (Array.isArray(raw)?raw:[]).slice(0,this.max).map(x=>x&&typeof x==='object'&&!Array.isArray(x)?{t:Number.isFinite(Number(x.t))?Number(x.t):Date.now(),kind:String(x.kind||'hata').slice(0,60),msg:String(x.msg||'').slice(0,500),extra:String(x.extra||'').slice(0,300),build:String(x.build||'legacy').slice(0,24),session:String(x.session||'legacy').slice(0,40)}:null).filter(Boolean)}catch(e){return[]}},
  current(){return this.get().filter(x=>x.build===PR_BUILD&&x.session===PR_SESSION)},
  push(kind,msg,extra){try{const a=this.get();a.unshift({t:Date.now(),kind:String(kind||'hata').slice(0,60),msg:String(msg||'').slice(0,500),extra:String(extra||'').slice(0,300),build:PR_BUILD,session:PR_SESSION});localStorage.setItem(this.key,JSON.stringify(a.slice(0,this.max)));}catch(e){}},
  clear(){try{localStorage.removeItem(this.key)}catch(e){}},
  errorCount(list){const a=list||this.current();return a.filter(x=>/^(error|promise|audio-resume)$/i.test(x.kind)||/(?:^|[-_])(error|fail|failed|hata)(?:$|[-_])/i.test(x.kind)).length}
};
window.addEventListener('error',e=>PRERR.push('error',e.message,(e.filename||'')+':'+(e.lineno||'')),true);
window.addEventListener('unhandledrejection',e=>PRERR.push('promise',e.reason&&e.reason.message||e.reason||'Unhandled promise',''));
window.addEventListener('sukun:diagnostic',e=>{const d=e.detail||{};PRERR.push(d.kind||'runtime',d.message||'Bilinmeyen hata',d.extra||'')});
let PR_LONG=0,PR_LASTLONG=0;
try{new PerformanceObserver(list=>{for(const x of list.getEntries()){if(window.SukunDiagnosticWork?.owns?.(x))continue;if(x.duration>=180){PR_LONG++;PR_LASTLONG=Math.round(x.duration);if(x.duration>450)PRERR.push('longtask',Math.round(x.duration)+'ms','main thread');}}}).observe({type:'longtask',buffered:true})}catch(e){}

/* ═══ 2) AUDIO/LIFECYCLE STATE MACHINE ═══ */
const AudioLife=window.AudioLife={
  state:'idle',reason:'init',wasBusy:false,userPaused:false,lastChange:Date.now(),providers:new Map(),
  _recoverPromise:null,_recoverSeq:0,_recoverReasons:new Set(),_visibleTO:0,
  lastRecovery:null,lastInterruption:null,lastUserAction:null,owner:null,history:[],
  register(name,fn){if(name&&typeof fn==='function')this.providers.set(name,fn);},
  _log(type,detail=''){
    const x={t:Date.now(),type:String(type||'event'),detail:String(detail||'')};
    this.history.push(x);if(this.history.length>80)this.history.splice(0,this.history.length-80);
    try{window.SukunSessionJournal?.event?.('audio-'+x.type,x.detail)}catch(e){}
    return x;
  },
  snapshot(){
    return{
      version:'r531',state:this.state,reason:this.reason,wasBusy:!!this.wasBusy,
      userPaused:!!this.userPaused,lastChange:this.lastChange,
      owner:this.ownerSnapshot(),lastRecovery:this.lastRecovery,lastInterruption:this.lastInterruption,
      lastUserAction:this.lastUserAction,recoveryPending:!!this._recoverPromise,
      history:this.history.slice(-30)
    };
  },
  ownerSnapshot(){
    try{
      const s=window.SukunAudioSessionRegistry?.controllerSnapshot?.();
      if(s?.id)return{id:s.id,title:s.title||'',state:s.state||'idle',active:s.active||null};
    }catch(e){}
    try{
      const f=window.currentFlowState?.snapshot?.();
      if(f?.playback?.id)return{id:f.playback.id,title:f.playback.moduleTitle||f.playback.sectionTitle||'',state:f.playback.state||'idle',active:f.context||null};
    }catch(e){}
    return this.owner||{id:null,title:'',state:this.state,active:null};
  },
  setOwner(owner,reason='owner'){
    if(owner&&typeof owner==='object')this.owner={...owner,at:Date.now(),reason};
    return this.owner;
  },
  set(n,r){
    if(this.state===n&&this.reason===r)return;
    this.state=n;this.reason=r||'';this.lastChange=Date.now();
    window.dispatchEvent(new CustomEvent('sukun:audiostate',{detail:{state:n,reason:r,owner:this.ownerSnapshot(),userPaused:this.userPaused}}));
    if(!document.hidden)try{dashUpdate()}catch(e){}
  },
  setUserPaused(v,reason='user'){
    const next=!!v;
    this.userPaused=next;
    this.lastUserAction={t:Date.now(),action:next?'pause':'play',reason:String(reason||'user')};
    this._log(next?'user-pause':'user-play',reason);
    if(next){
      /* Açık recovery sonucu kullanıcı pause'undan SONRA geri dönüp sesi açamasın. */
      this._recoverSeq++;
      this._recoverReasons.clear();
      this.wasBusy=false;
    }
    try{if(window.SukunAudioHub)window.SukunAudioHub.userPaused=next}catch(e){}
    return next;
  },
  reconcileUserPaused(v,reason='reconcile'){
    const next=!!v,changed=this.userPaused!==next;
    this.userPaused=next;
    if(changed)this._log('pause-reconcile',reason);
    try{if(window.SukunAudioHub)window.SukunAudioHub.userPaused=next}catch(e){}
    return next;
  },
  markUserPause(reason='user-pause'){this.setUserPaused(true,reason);this.set('paused',reason);return true;},
  markUserPlay(reason='user-play'){this.setUserPaused(false,reason);return true;},
  markUserStop(reason='user-stop'){this.setUserPaused(true,reason);this.set('stopping',reason);return true;},
  markInterruption(reason='system-interruption'){
    this.wasBusy=this.busy();
    this.lastInterruption={t:Date.now(),reason:String(reason),owner:this.ownerSnapshot(),wasBusy:this.wasBusy};
    this._log('interrupt',reason);
    this._recoverSeq++; /* o anda yürüyen eski recover sonucu artık geçersiz */
    if(this.wasBusy&&!this.userPaused)this.set('interrupted',reason);
    return this.wasBusy;
  },
  busy(){
    try{
      if((typeof FR!=='undefined'&&FR.playing)||(typeof Z!=='undefined'&&Z.auto)||(typeof AMB!=='undefined'&&Object.keys(AMB).length)||(typeof VH!=='undefined'&&VH.playing))return true;
      if(typeof SES!=='undefined'&&SES.ler&&[...SES.ler].some(a=>a&&!a.paused&&!a.ended&&a.dataset?.sukSilentCarrier!=='1'))return true;
      if('speechSynthesis' in window&&(speechSynthesis.speaking||speechSynthesis.pending))return true;
      if(window.__tvPlaying||window.__dhPlaying||window.__akPlaying||window.__fsPlaying||
         window.__seyPlaying||window.__hzvPlaying)return true;
      try{if(typeof DL!=='undefined'&&(DL.playing||DL.kayitCaliyor))return true}catch(e){}
      try{if(typeof DONGU!=='undefined'&&DONGU.aktif)return true}catch(e){}
      const bs=window.BERHET_SEYIR;if(bs&&((bs.run&&!bs.paused)||bs.systemHold))return true;
      const es=window.ESMA99_SEYIR;if(es&&((es.run&&!es.paused)||es.systemHold))return true;
      try{const J=window.__sukJourneyNative;if(J?.a&&!J.a.paused&&!J.a.ended)return true}catch(e){}
      for(const fn of this.providers.values()){try{if(fn())return true}catch(e){}}
      return false;
    }catch(e){return false}
  },
  async recover(src='resume'){
    const reason=String(src||'resume');
    this._recoverReasons.add(reason);
    if(this.userPaused){this._log('recover-skip','user-paused · '+reason);return false;}
    /* Android arka planda AudioContext.resume() için kullanıcı jesti isteyebilir.
       Kilitliyken zorlamak yerine görünür dönüşte tek recovery çalıştırılır. */
    if(document.hidden){this._log('recover-defer','hidden · '+reason);return false;}
    if(this._recoverPromise)return this._recoverPromise;
    let contextNeeds=false;
    try{contextNeeds=contextNeeds||!!(typeof ctx!=='undefined'&&ctx&&ctx.state==='suspended')}catch(e){}
    try{contextNeeds=contextNeeds||!!(window.NS?.ctx&&NS.ctx.state==='suspended'&&window.Neuro?.isPlaying?.())}catch(e){}
    if(!this.wasBusy&&this.state!=='interrupted'&&!contextNeeds){
      this._recoverReasons.clear();
      return this.busy();
    }

    const token=++this._recoverSeq;
    const ownerBefore=this.ownerSnapshot();
    this._recoverPromise=(async()=>{
      await new Promise(r=>setTimeout(r,55)); /* pageshow + focus + visibility olaylarını tek darbede birleştir */
      const reasons=[...this._recoverReasons];this._recoverReasons.clear();
      const why=reasons.join('+')||reason;
      if(token!==this._recoverSeq||this.userPaused||document.hidden){
        this._log('recover-cancel','stale/user/hidden · '+why);return false;
      }

      this.setOwner(ownerBefore,'recover-start');
      this.set('recovering',why);
      const started=Date.now();let mainOk=true,neuroOk=true,error='';
      try{
        if(typeof ctx!=='undefined'&&ctx&&ctx.state!=='running'){
          await ctx.resume();mainOk=ctx.state==='running';
          try{
            if(mainOk&&master){
              const el=document.getElementById('masterVol');
              const hedef=Math.max(.0001,+(el?.value||master.gain.value||.7));
              const t=ctx.currentTime;
              master.gain.cancelScheduledValues(t);master.gain.setValueAtTime(.0001,t);
              master.gain.exponentialRampToValueAtTime(hedef,t+.14);
            }
          }catch(_){ }
        }
      }catch(e){mainOk=false;error=String(e?.message||e);try{PRERR.push('audio-resume',error,why)}catch(_){} }

      try{
        const nc=window.NS?.ctx;
        if(nc&&nc.state==='suspended'&&window.Neuro?.isPlaying?.()){
          await nc.resume();neuroOk=nc.state==='running';
        }
      }catch(e){neuroOk=false;if(!error)error=String(e?.message||e)}

      if(token!==this._recoverSeq||this.userPaused||document.hidden){
        this._log('recover-cancel','post-resume stale/user/hidden · '+why);return false;
      }

      try{if(typeof kesintiDenetle==='function')kesintiDenetle()}catch(e){}
      try{window.SukunAudioSessionRegistry?.sync?.()}catch(e){}
      try{window.SesCapa?.ensure?.(ownerBefore?.title||'SÜKÛN')}catch(e){}

      const ok=mainOk&&neuroOk;
      const busyNow=this.busy();
      this.wasBusy=!ok&&busyNow;
      this.lastRecovery={t:Date.now(),started,reason:why,ok,error,ownerBefore,ownerAfter:this.ownerSnapshot(),busy:busyNow};
      this._log(ok?'recover-ok':'recover-fail',why+(error?' · '+error:''));
      this.set(busyNow?'playing':'idle',ok?'recovered':'recover-pending');
      try{window.dispatchEvent(new CustomEvent('sukun:audiorecovery',{detail:this.lastRecovery}))}catch(e){}
      return ok;
    })().finally(()=>{this._recoverPromise=null});
    return this._recoverPromise;
  },
  requestRecover(src){return this.recover(src)}
};;
AudioLife.register('tekke',()=>!!(window.Tekke&&((window.Tekke.isActive&&window.Tekke.isActive())||(window.Tekke.isRunning&&window.Tekke.isRunning()))));
AudioLife.register('neuro',()=>!!(window.Neuro&&window.Neuro.isPlaying&&window.Neuro.isPlaying()));
function lifeHidden(src){
  clearTimeout(AudioLife._visibleTO);
  AudioLife.markInterruption(src);
}
function lifeVisible(src){
  clearTimeout(AudioLife._visibleTO);
  AudioLife._visibleTO=setTimeout(()=>{
    if(document.hidden)return;
    if(AudioLife.wasBusy&&!AudioLife.userPaused)AudioLife.requestRecover(src);
    else AudioLife.set(AudioLife.busy()?'playing':'idle',src);
  },180);
}
document.addEventListener('visibilitychange',()=>document.hidden?lifeHidden('visibility-hidden'):lifeVisible('visibility-visible'));
window.addEventListener('pagehide',()=>lifeHidden('pagehide'));window.addEventListener('pageshow',()=>lifeVisible('pageshow'));window.addEventListener('blur',()=>{if(document.hidden)lifeHidden('blur')});window.addEventListener('focus',()=>lifeVisible('focus'));
document.addEventListener('freeze',()=>lifeHidden('freeze'));document.addEventListener('resume',()=>lifeVisible('resume'));
try{if(typeof autoStart==='function'){const f=autoStart;autoStart=function(...a){AudioLife.markUserPlay('zikir-start');AudioLife.set('preparing','zikir');const r=f.apply(this,a);setTimeout(()=>{if(window.SukunAudioSessionRegistry?.aggregateSnapshot?.()?.paused||(typeof MINI==='object'&&MINI?.paused))return;AudioLife.set(AudioLife.busy()?'playing':'idle','zikir')},20);return r}}}catch(e){}
try{if(typeof autoStop==='function'){const f=autoStop;autoStop=function(...a){const r=f.apply(this,a);setTimeout(()=>{
  const busy=AudioLife.busy();
  // miniPause deliberately stops the auto scheduler. Its delayed Stop echo
  // must preserve the user's aggregate pause instead of publishing idle.
  const held=!!(window.SukunAudioSessionRegistry?.aggregateSnapshot?.()?.paused||(typeof MINI==='object'&&MINI?.paused));
  if(held){
    try{AudioLife.reconcileUserPaused(true,'r704-aggregate-pause')}catch(e){AudioLife.userPaused=true}
    AudioLife.set('paused','r704-aggregate-pause');
    try{if(window.SukunAudioHub){SukunAudioHub.userPaused=true;SukunAudioHub.set('paused','r704-aggregate-pause')}}catch(e){}
    return;
  }
  /* r658 — Stop terminaldir, Pause değildir. Eski kod busy=false iken
     userPaused=true + paused yazarak AudioTruth idle olsa bile Life/Hub'ı
     sahte paused durumda bırakıyordu. Başka gerçek ses varsa playing,
     yoksa doğrudan idle; kullanıcı pause niyeti üretilmez. */
  try{AudioLife.reconcileUserPaused(false,busy?'r658-zikir-stop-busy':'r658-zikir-stop-idle')}catch(e){AudioLife.userPaused=false}
  AudioLife.set(busy?'playing':'idle',busy?'r658-zikir-stop-busy':'r658-zikir-stop-idle');
  try{if(window.SukunAudioHub){SukunAudioHub.userPaused=false;if(!busy)SukunAudioHub.set('idle','r658-zikir-stop-idle')}}catch(e){}
},20);return r}}}catch(e){}
try{if(typeof frStart==='function'){const f=frStart;frStart=function(...a){AudioLife.markUserPlay('frequency-start');AudioLife.set('preparing','frequency');const r=f.apply(this,a);setTimeout(()=>AudioLife.set('playing','frequency'),20);return r}}}catch(e){}
try{if(typeof frStop==='function'){const f=frStop;frStop=function(...a){const r=f.apply(this,a);setTimeout(()=>AudioLife.set(AudioLife.busy()?'playing':'idle','frequency-stop'),20);return r}}}catch(e){}
try{if(typeof chOn==='function'){const f=chOn;chOn=function(...a){AudioLife.markUserPlay('ambience-start');AudioLife.set('preparing','ambience');const r=f.apply(this,a);setTimeout(()=>AudioLife.set('playing','ambience'),20);return r}}}catch(e){}
try{if(window.Tekke&&typeof Tekke.open==='function'){const f=Tekke.open;Tekke.open=function(...a){AudioLife.markUserPlay('tekke-open');return f.apply(this,a)}}}catch(e){}
try{if(typeof hardStopAll==='function'){const f=hardStopAll;hardStopAll=function(...a){AudioLife.markUserStop('all-stop');const r=f.apply(this,a);setTimeout(()=>AudioLife.set('idle','stopped'),80);return r};const b=document.getElementById('stopAll');if(b)b.onclick=hardStopAll}}catch(e){}

/* ═══ 3) KİŞİSEL DASHBOARD ═══ */
function todayLog(){try{const a=typeof logTemizle==='function'?logTemizle(typeof S!=='undefined'?S.get('sukun.log',[]):[]):[];const d=new Date();d.setHours(0,0,0,0);return a.filter(x=>x.t>=d.getTime())}catch(e){return[]}}
function todayTekke(){try{const a=typeof tekkeDefterTemizle==='function'?tekkeDefterTemizle(typeof S!=='undefined'?S.get('tekke.defter',[]):[]):[];const d=new Date();d.setHours(0,0,0,0);return a.filter(x=>x.t>=d.getTime())}catch(e){return[]}}
function currentZikir(){try{if(!window.SukunSecretPolicy?.unlocked?.()&&Z.cat==='berhet')return'Zikir seçilmedi';const it=ZIKIR[Z.cat].items[Z.idx],ad=(it&&(it.t||it.tr||it.nm))||'';if(window.SukunSecretPolicy?.containsSecretText?.(ad))return'Zikir seçilmedi';return ad||'Zikir seçilmedi'}catch(e){return'Zikir seçilmedi'}}
function dashCreate(){if(document.getElementById('prDashboard'))return;const tabs=document.querySelector('.tabs');if(!tabs)return;const d=document.createElement('section');d.id='prDashboard';d.innerHTML=`<div class="prDashTop"><div><div class="prEyebrow">KİŞİSEL MERKEZ</div><div class="prDashTitle">Bugünkü Sükûn</div></div><div class="prDashStatus"><button class="prPerfBtn" id="prPerfBtn" data-noi18n aria-label="Görsel performans profili">◐ Dengeli</button><button class="prState" id="prState">hazır</button></div></div><div class="prMetrics"><div class="prMetric"><b id="prDz">0</b><small>BUGÜN ZİKİR</small></div><div class="prMetric"><b id="prDm">0 dk</b><small>SEANS</small></div><div class="prMetric"><b id="prDf">—</b><small>FREKANS</small></div></div><div class="prNow"><div class="prNowText"><small>ŞU AN / SON SEÇİM</small><b id="prDNow">—</b></div><button class="btn" id="prDGo">Devam et</button></div><div class="prDashActions"><button class="prSearchBtn" id="prSearchOpen">⌕ &nbsp; Esmâ, frekans, ambiyans, dua ara… <small class="prKeyHint">Ctrl K</small></button><button class="prDiagBtn" id="prDiagOpen" aria-label="Sistem durumu">◉</button></div>`;/* r533: Kişisel Merkez eskiden sekmelerin ÜSTÜNE giriyordu. Sekme
   çubuğu başlığın hemen altına alınınca bu, çubuğu yeniden aşağı
   itiyordu — gezinme yine ilk ekranın dışına düşüyordu. Artık
   çubuğun ALTINA giriyor; sıralama başlık, sekmeler, Kişisel Merkez. */
tabs.insertAdjacentElement('afterend',d);const tc=document.getElementById('todayCard');if(tc)tc.classList.add('prCompanion');d.querySelector('#prSearchOpen').onclick=searchOpen;d.querySelector('#prDiagOpen').onclick=diagOpen;d.querySelector('#prState').onclick=diagOpen;d.querySelector('#prDGo').onclick=()=>{const t=document.querySelector('.tab[data-t="zkr"]');if(t)t.click();setTimeout(()=>{const z=document.getElementById('zCounterCard')||document.getElementById('zStage');z&&z.scrollIntoView({behavior:'smooth',block:'start'})},80)};dashUpdate()}
function dashUpdate(){
  const d=document.getElementById('prDashboard');if(!d)return;
  let z=0,m=0;
  for(const x of todayLog())m+=+(x.dur||0)/60;
  for(const x of todayTekke()){m+=+(x.sn||0)/60;z+=+(x.zk||0)}
  try{const dm=typeof dayZkTemizle==='function'?dayZkTemizle(S.get('sukun.dayZk',{})):{};z+=+(dm[dayKey(new Date())]||0)}catch(e){PRERR.push('dashboard',e.message||e,'dayZk')}
  const a=id=>document.getElementById(id);
  /* r505: koşulsuz yazımlardı. */
  const yaz=(id,v)=>{const e=a(id); if(e&&e.textContent!==String(v))e.textContent=String(v);};
  yaz('prDz',Math.round(z||0));
  yaz('prDm',Math.round(m||0)+' dk');
  yaz('prDf',(typeof FR!=='undefined'&&FR.playing)?FR.c.toFixed(0)+' Hz':'—');
  if(a('prDNow'))a('prDNow').textContent=currentZikir();
  const st=a('prState');if(st){const map={idle:'hazır',preparing:'hazırlanıyor',playing:'çalıyor',paused:'duraklatıldı',interrupted:'kesildi',recovering:'toparlanıyor',stopping:'duruyor'};st.textContent=map[AudioLife.state]||AudioLife.state;st.classList.toggle('on',AudioLife.state==='playing')}
}

/* ═══ 4) GLOBAL ARAMA / COMMAND PALETTE ═══ */
let SEARCH_ITEMS=[],SEARCH_INDEX=-1,SEARCH_RETURN=null;
function searchBuild(){const seen=new Set();SEARCH_ITEMS=[];document.querySelectorAll('#tab-amb button,#tab-frq button,#tab-zkr button,#tab-rx button,#tab-amb summary,#tab-frq summary,#tab-zkr summary,#tab-rx summary,.cat,.pre,.sess').forEach(el=>{const text=(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();if(text.length<2||text.length>130)return;if(!window.SukunSecretPolicy?.unlocked?.()){if(el.closest('[data-c="berhet"],#berhetAtlas,#berhetSeyir,#r170AtlasTools,[data-provider="berhetiyye"]'))return;if(window.SukunSecretPolicy?.containsSecretText?.(text))return}const key=text.toLocaleLowerCase('tr');if(seen.has(key))return;seen.add(key);const sec=el.closest('section[id^="tab-"]');SEARCH_ITEMS.push({text,el,tab:sec?sec.id.replace('tab-',''):''})});}
function searchCreate(){
  if(document.getElementById('prSearchOverlay'))return;
  const o=document.createElement('div');o.id='prSearchOverlay';o.hidden=true;
  o.innerHTML=`<div class="prSearchBox" role="dialog" aria-modal="true" aria-label="Genel arama"><div class="prSearchHead"><input id="prSearchInput" autocomplete="off" aria-label="Esmâ, frekans, ambiyans veya dua ara" placeholder="Ara… örn. Yâ Latîf, 528 Hz, yağmur, tövbe"><button class="prSearchX" aria-label="Aramayı kapat">×</button></div><div class="prSearchResults" id="prSearchResults" aria-live="polite"></div></div>`;
  document.body.appendChild(o);o.querySelector('.prSearchX').onclick=searchClose;o.onclick=e=>{if(e.target===o)searchClose()};
  const input=o.querySelector('#prSearchInput');input.addEventListener('input',searchRender);input.addEventListener('keydown',searchKeys);
}
function searchOpen(){searchCreate();searchBuild();SEARCH_RETURN=document.activeElement;SEARCH_INDEX=-1;const o=document.getElementById('prSearchOverlay');o.hidden=false;document.body.classList.add('prModalOpen');const i=document.getElementById('prSearchInput');i.value='';searchRender();setTimeout(()=>i.focus(),20)}
function searchClose(returnFocus=true){const o=document.getElementById('prSearchOverlay');if(o)o.hidden=true;if(document.getElementById('prDiagOverlay')?.hidden!==false)document.body.classList.remove('prModalOpen');if(returnFocus&&SEARCH_RETURN&&SEARCH_RETURN.isConnected)SEARCH_RETURN.focus();SEARCH_RETURN=null;SEARCH_INDEX=-1}
function norm(s){return (s||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function searchRender(){const q=norm((document.getElementById('prSearchInput')||{}).value||'');const r=document.getElementById('prSearchResults');if(!r)return;const arr=(q?SEARCH_ITEMS.filter(x=>norm(x.text).includes(q)):SEARCH_ITEMS.slice(0,18)).slice(0,30);SEARCH_INDEX=-1;r.innerHTML='';for(const x of arr){const b=document.createElement('button');b.className='prResult';b.innerHTML='<i>✦</i><span><b></b><small></small></span>';b.querySelector('b').textContent=x.text;b.querySelector('small').textContent=x.tab?({'amb':'Ambiyans','frq':'Frekanslar','zkr':'Zikir','rx':'Düzen'}[x.tab]||x.tab):'Hızlı erişim';b.onclick=()=>{if(x.tab){const t=document.querySelector('.tab[data-t="'+x.tab+'"]');t&&t.click()}searchClose(false);setTimeout(()=>{try{window.zMegaReveal&&window.zMegaReveal(x.el);x.el.scrollIntoView({behavior:'smooth',block:'center'});x.el.classList.add('prFlash');x.el.focus?.({preventScroll:true});setTimeout(()=>x.el.classList.remove('prFlash'),1200)}catch(e){PRERR.push('search',e.message||e,x.text)}},80)};r.appendChild(b)}if(!arr.length)r.textContent='Eşleşme bulunamadı.'}
function searchKeys(e){const bs=[...document.querySelectorAll('#prSearchResults .prResult')];if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!bs.length)return;SEARCH_INDEX=(SEARCH_INDEX+(e.key==='ArrowDown'?1:-1)+bs.length)%bs.length;bs.forEach((b,i)=>b.classList.toggle('sel',i===SEARCH_INDEX));bs[SEARCH_INDEX].scrollIntoView({block:'nearest'})}else if(e.key==='Enter'&&SEARCH_INDEX>=0){e.preventDefault();bs[SEARCH_INDEX]?.click()}else if(e.key==='Tab'){const o=document.getElementById('prSearchOverlay');const focus=[...o.querySelectorAll('input,button:not([disabled])')];if(!focus.length)return;const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();searchOpen()}if(e.key==='Escape'){if(document.getElementById('prSearchOverlay')?.hidden===false)searchClose();else if(document.getElementById('prDiagOverlay')?.hidden===false)diagClose()}});

/* ═══ 5) SİSTEM DURUMU / DIAGNOSTICS ═══ */
let DIAG_RETURN=null;
function diagCreate(){
  if(document.getElementById('prDiagOverlay'))return;
  const o=document.createElement('div');o.id='prDiagOverlay';o.hidden=true;
  o.innerHTML=`<div class="prDiagSheet" role="dialog" aria-modal="true" aria-labelledby="prDiagTitle">
    <div class="prDiagHead"><h3 id="prDiagTitle">Sistem Durumu</h3><button class="btn" id="prDiagX" type="button">Kapat</button></div>
    <div class="prDiagGrid"><div class="prDiagCell"><small>SES DURUMU</small><b id="prDa">—</b></div><div class="prDiagCell"><small>AUDIO CONTEXT</small><b id="prDc">—</b></div><div class="prDiagCell"><small>KİLİT EKRANI</small><b id="prDms">—</b></div><div class="prDiagCell"><small>GÖRSEL PROFİL</small><b id="prDp">—</b></div><div class="prDiagCell"><small>UZUN İŞLER</small><b id="prDl">0</b></div><div class="prDiagCell"><small>TANI KAYDI</small><b id="prDe">0</b></div></div>
    <div class="prErrList" id="prErrList">Kayıt yok.</div>
    <div class="prDiagActions">
      <button class="btn prDiagWide" id="prDiagFull" type="button">Tam Tanı ve Testler</button>
      <button class="btn" id="prDiagJson" type="button">JSON Rapor</button>
      <button class="btn" id="prRecover" type="button">Ses motorunu toparla</button>
      <button class="btn" id="prErrClear" type="button">Tanı kaydını temizle</button>
    </div>
  </div>`;
  document.body.appendChild(o);
  o.addEventListener('click',e=>{if(e.target===o)diagClose()});
  o.querySelector('#prDiagX').addEventListener('click',diagClose);
  o.querySelector('#prDiagFull').addEventListener('click',()=>{
    diagClose();setTimeout(()=>window.SukunDiagnostics?.open?.(),0);
  });
  o.querySelector('#prDiagJson').addEventListener('click',()=>window.SukunDiagnostics?.exportReport?.());
  o.querySelector('#prRecover').addEventListener('click',()=>AudioLife.recover('manual'));
  o.querySelector('#prErrClear').addEventListener('click',()=>{PRERR.clear();diagRender()});
}
function diagRender(){diagCreate();const a=id=>document.getElementById(id);const events=PRERR.current(),errN=PRERR.errorCount(events);a('prDa').textContent=AudioLife.state+' · '+AudioLife.reason;a('prDc').textContent=(typeof ctx!=='undefined'&&ctx)?ctx.state:'kurulmadı';a('prDms').textContent=('mediaSession' in navigator)?((window.SesCapa&&SesCapa.isActive&&SesCapa.isActive())?(navigator.mediaSession.playbackState||'etkin'):'kapalı'):'destek yok';a('prDp').textContent=document.body.dataset.perf||'dengeli';a('prDl').textContent=PR_LONG+(PR_LASTLONG?' · son '+PR_LASTLONG+'ms':'');a('prDe').textContent=errN+' hata · '+events.length+' olay';a('prErrList').textContent=events.length?events.slice(0,20).map(x=>new Date(x.t).toLocaleTimeString()+' ['+x.kind+'] '+x.msg+(x.extra?' · '+x.extra:'')).join('\n'):'Bu oturumda tanı olayı yok.'}
function diagKeys(e){
  if(e.key!=='Tab')return;
  const o=document.getElementById('prDiagOverlay');if(!o||o.hidden)return;
  const f=[...o.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(x=>x.offsetParent!==null);
  if(!f.length)return;const first=f[0],last=f[f.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
}
function diagOpen(){
  DIAG_RETURN=document.activeElement;
  try{window.SukunFriendlyUI?.closeTools?.()}catch(e){}
  diagRender();const o=document.getElementById('prDiagOverlay');o.hidden=false;
  if(!o.dataset.trap){o.addEventListener('keydown',diagKeys);o.dataset.trap='1'}
  document.body.classList.add('prModalOpen');setTimeout(()=>document.getElementById('prDiagX')?.focus(),20);
}
function diagClose(){const o=document.getElementById('prDiagOverlay');if(o)o.hidden=true;if(document.getElementById('prSearchOverlay')?.hidden!==false)document.body.classList.remove('prModalOpen');if(DIAG_RETURN&&DIAG_RETURN.isConnected)DIAG_RETURN.focus();DIAG_RETURN=null}

function audioLifePoll(){
  const busy=AudioLife.busy();
  if(busy){
    if(!AudioLife.userPaused){
      try{window.SesCapa&&SesCapa.ensure('SÜKÛN — Frekans & Zikir')}catch(e){}
      if(!['playing','preparing','recovering'].includes(AudioLife.state))AudioLife.set('playing','provider-sync');else if(!document.hidden)dashUpdate();
    }else if(!document.hidden)dashUpdate();
  }else{
    if(!AudioLife.userPaused)try{window.SesCapa&&SesCapa.isActive&&SesCapa.isActive()&&SesCapa.stop()}catch(e){}
    if(AudioLife.state==='playing')AudioLife.set('idle','provider-sync');else if(!document.hidden)dashUpdate();
  }
}
let _audioLifeTO=0,_audioLifeRAF=0;
function audioLifeSchedule(reason='event'){
  cancelAnimationFrame(_audioLifeRAF);clearTimeout(_audioLifeTO);
  _audioLifeRAF=requestAnimationFrame(()=>{try{audioLifePoll()}catch(e){};
    /* yalnız gerçekten aktif ses varken seyrek emniyet yoklaması; idle durumda timer yok */
    if(AudioLife.busy()&&!AudioLife.userPaused)_audioLifeTO=setTimeout(()=>audioLifeSchedule('busy-heartbeat'),8000);
  });
}
function initPremium(){
  dashCreate();searchCreate();dashUpdate();AudioLife.set(AudioLife.busy()?'playing':'idle','ready');
  if(!window.__sukunAudioLifeEvents){window.__sukunAudioLifeEvents=1;
    ['sukun:playbackchange','sukun:source','sukun:audiostate','sukun:currentflowchange','sukun:nowplayingchange','pageshow'].forEach(ev=>window.addEventListener(ev,()=>audioLifeSchedule(ev),{passive:true}));
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)audioLifeSchedule('visible')},{passive:true});
  }
  audioLifeSchedule('init');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(initPremium,50));else setTimeout(initPremium,50);
})();
