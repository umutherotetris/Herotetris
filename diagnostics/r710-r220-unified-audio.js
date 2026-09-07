
(()=>{
'use strict';
if(window.__SUKUN_R220__)return;window.__SUKUN_R220__=1;
const BUILD=document.querySelector('meta[name="sukun-build"]')?.content||'unknown';
const now=()=>Date.now();
const emit=(name,detail)=>{try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch(e){}};
const diag=(kind,message,extra='')=>emit('sukun:diagnostic',{kind,message:String(message||''),extra:String(extra||'')});

/* ── 1) TEK OTURUM DURUM MAKİNESİ ─────────────────────────────── */
const Hub=window.SukunAudioHub={
  state:'idle',reason:'boot',provider:'',title:'SÜKÛN',startedAt:0,lastPulse:now(),recoveries:0,
  queue:[],index:-1,callbacks:null,userPaused:false,ttsActive:0,mediaActive:new Set(),
  allowed:new Set(['idle','preparing','playing','paused','interrupted','recovering','stopping','stopped','error']),
  set(state,reason='',meta){
    if(!this.allowed.has(state))state='error';
    if(this.state===state){
      this.reason=reason||this.reason;this.lastPulse=now();
      if(meta&&typeof meta==='object'){if(meta.provider!=null)this.provider=String(meta.provider);if(meta.title)this.title=String(meta.title)}
      return state;
    }
    this.state=state;this.reason=reason;this.lastPulse=now();
    if(meta&&typeof meta==='object'){if(meta.provider!=null)this.provider=String(meta.provider);if(meta.title)this.title=String(meta.title)}
    emit('sukun:sessionstate',this.snapshot());
    try{if(window.AudioLife&&AudioLife.state!==state)AudioLife.set(state,'hub:'+reason)}catch(e){}
    this.render();return state;
  },
  _pruneMedia(){
    try{for(const el of [...this.mediaActive]){
      const silent=el?.dataset?.sukSilentCarrier==='1';
      if(!el||silent||el.paused||el.ended)this.mediaActive.delete(el);
    }}catch(e){}
    return this.mediaActive.size;
  },
  snapshot(){const media=this._pruneMedia();return{build:BUILD,state:this.state,reason:this.reason,provider:this.provider,title:this.title,index:this.index,queue:this.queue.length,userPaused:this.userPaused,tts:this.ttsActive,media,recoveries:this.recoveries,lastPulse:this.lastPulse}},
  pulse(reason='activity'){this.lastPulse=now();if(this.state==='idle'||this.state==='stopped')this.set('playing',reason);},
  activate(provider,meta={},callbacks=null){
    this.provider=String(provider||'audio');this.title=String(meta.title||this.title||'SÜKÛN');this.callbacks=callbacks||this.callbacks;this.userPaused=false;if(!this.startedAt)this.startedAt=now();
    this.set('preparing','activate',{provider:this.provider,title:this.title});setTimeout(()=>{if(!this.userPaused&&this.busy())this.set('playing','ready')},0);return this;
  },
  busy(){
    if(this.userPaused)return false;
    if(this.ttsActive>0)return true;
    if(this._pruneMedia()>0)return true;
    try{if(window.AudioLife&&AudioLife.busy&&AudioLife.busy())return true}catch(e){}
    /* r693: Hub.state='playing' fiziksel kaynak değildir. Eski kod kendi
       state'ini busy kabul ettiği için son ses bittikten sonra playing → busy
       → playing döngüsünden hiç çıkamıyordu. Preparing/recovering için yalnız
       kısa köprü penceresi bırak; kalıcı truth fiziksel kaynaklardan gelir. */
    const age=Math.max(0,now()-this.lastPulse);
    if(this.state==='preparing'&&age<2200)return true;
    if(this.state==='recovering'&&age<3200)return true;
    if(this.state==='interrupted'){
      try{return !!window.AudioLife?.wasBusy}catch(e){return false}
    }
    return false;
  },
  async play(){this.userPaused=false;try{window.AudioLife?.markUserPlay?.('hub-play')}catch(e){};try{await this.callbacks?.onPlay?.()}catch(e){diag('hub-play',e.message||e)}this.set('playing','user-play');},
  async pause(){this.userPaused=true;try{window.AudioLife?.markUserPause?.('hub-pause')}catch(e){};try{await this.callbacks?.onPause?.()}catch(e){diag('hub-pause',e.message||e)}this.set('paused','user-pause');},
  async stop(){this.userPaused=true;try{window.AudioLife?.markUserStop?.('hub-stop')}catch(e){};this.set('stopping','user-stop');try{await this.callbacks?.onStop?.()}catch(e){diag('hub-stop',e.message||e)}this.startedAt=0;this.queue=[];this.index=-1;this.callbacks=null;this.set('stopped','user-stop');},
  async prev(){if(this.callbacks?.onPrev){try{return await this.callbacks.onPrev()}catch(e){diag('hub-prev',e.message||e)}}return this.goto(this.index-1)},
  async next(){if(this.callbacks?.onNext){try{return await this.callbacks.onNext()}catch(e){diag('hub-next',e.message||e)}}return this.goto(this.index+1)},
  setQueue(items,index=0){this.queue=Array.isArray(items)?items.slice():[];this.index=this.queue.length?Math.max(0,Math.min(index,this.queue.length-1)):-1;emit('sukun:queuechange',this.snapshot());return this.queue.length},
  enqueue(item){this.queue.push(item);if(this.index<0)this.index=0;emit('sukun:queuechange',this.snapshot());return this.queue.length},
  async goto(i){if(!this.queue.length)return false;i=Math.max(0,Math.min(i,this.queue.length-1));this.index=i;const it=this.queue[i];emit('sukun:queuechange',this.snapshot());if(it&&typeof it.run==='function'){this.userPaused=false;this.set('preparing','queue');try{await it.run(it,i);this.set('playing','queue')}catch(e){this.set('error','queue-error');diag('queue',e.message||e)}return true}return false},
  render(){
    const s=document.getElementById('r214HubState');if(s)s.textContent=this.state+' · '+(this.provider||'—');
    const w=document.getElementById('r214Watch');if(w)w.textContent=Watch.last||'hazır';
    Journal.save(this.snapshot());
  },
  interrupt(reason='external-interruption'){
    if(this.userPaused)return false;
    this.set('interrupted',reason);Journal.event('interrupt',reason);return true;
  }
};

/* Oturum günlüğü: autoplay kısıtlarını delmeye çalışmaz; yalnız yaşayan oturumu
   tanımlar ve beklenmeyen kesintiyi güvenli biçimde teşhis etmeye yarar. */
const Journal=window.SukunSessionJournal={
  key:'sukun.session.r228',events:[],
  load(){try{return JSON.parse(sessionStorage.getItem(this.key)||'null')}catch(e){return null}},
  save(snap){try{const prev=this.load()||{};sessionStorage.setItem(this.key,JSON.stringify({...prev,snapshot:snap,updatedAt:now(),events:this.events.slice(-24)}))}catch(e){}},
  event(type,detail=''){this.events.push({t:now(),type:String(type),detail:String(detail||'')});if(this.events.length>24)this.events.shift();try{this.save(Hub.snapshot())}catch(e){}},
  clear(){this.events=[];try{sessionStorage.removeItem(this.key)}catch(e){};renderJournal()}
};
function renderJournal(){const el=document.getElementById('r220Journal');if(!el)return;const j=Journal.load();if(!j){el.textContent='Oturum günlüğü boş.';return}const a=(j.events||[]).slice(-6).map(x=>new Date(x.t).toLocaleTimeString('tr-TR')+' · '+x.type+' · '+x.detail);el.textContent='Son durum: '+(j.snapshot?.state||'—')+' · '+(j.snapshot?.provider||'—')+'\nGüncelleme: '+new Date(j.updatedAt||now()).toLocaleTimeString('tr-TR')+(a.length?'\n'+a.join('\n'):'')}

/* MediaSession köprüsünün var olan işleyicilerini bozmadan Hub'a ayna tut. */
function hookSesCapa(){
  const sc=window.SesCapa;if(!sc||sc.__r214)return;sc.__r214=1;
  const st=sc.start?.bind(sc),sp=sc.stop?.bind(sc),pa=sc.syncPaused?.bind(sc),pl=sc.syncPlaying?.bind(sc),rt=sc.retitle?.bind(sc);
  if(st)sc.start=(o={})=>{const r=st(o);Hub.activate('MediaSession',{title:o.title||'SÜKÛN'}, {onPlay:o.onPlay,onPause:o.onPause,onStop:o.onStop,onPrev:o.onPrev,onNext:o.onNext});return r};
  if(sp)sc.stop=(...a)=>{const r=sp(...a);if(!Hub.userPaused){Hub.startedAt=0;Hub.set('idle','media-stop')}return r};
  if(pa)sc.syncPaused=(...a)=>{const r=pa(...a);const explicit=!!window.SukunJourneyAudioMachine?.pauseIntentActive?.();if(explicit){Hub.userPaused=true;try{window.AudioLife?.markUserPause?.('media-session-pause-reflect')}catch(e){}}else if(Hub.userPaused){Hub.userPaused=false}Hub.set('paused',explicit?'media-pause':'media-reflect-pause');return r};
  if(pl)sc.syncPlaying=(...a)=>{const r=pl(...a);Hub.userPaused=false;try{window.AudioLife?.markUserPlay?.('media-session-play')}catch(e){};Hub.set('playing','media-play');return r};
  if(rt)sc.retitle=(t,...a)=>{Hub.title=String(t||Hub.title);return rt(t,...a)};
}

/* ── 2) TTS + <audio> ORTAK GÖZLEM KATMANI ────────────────────── */
function hookSpeech(){
  const S=window.speechSynthesis;if(!S||S.__r214)return;S.__r214=1;
  const speak=S.speak.bind(S),cancel=S.cancel.bind(S);
  S.speak=function(u){
    let done=false;const finish=()=>{if(done)return;done=true;Hub.ttsActive=Math.max(0,Hub.ttsActive-1);Hub.lastPulse=now();setTimeout(()=>{if(!Hub.busy()&&!Hub.userPaused)Hub.set('idle','tts-end')},80)};
    try{u.addEventListener('start',()=>{Hub.ttsActive++;Hub.userPaused=false;Hub.activate('TTS',{title:Hub.title});Hub.set('playing','tts-start')},{once:true});u.addEventListener('end',finish,{once:true});u.addEventListener('error',finish,{once:true})}catch(e){}
    Hub.lastPulse=now();return speak(u);
  };
  S.cancel=function(){
    const r=cancel();Hub.ttsActive=0;Hub.lastPulse=now();
    /* r694: cancel() end/error üretmeyebilir. Eski Hub bu durumda bir sonraki
       8 sn heartbeat'e kadar hayalet TTS/playing gösterebiliyordu. */
    queueMicrotask(()=>{try{if(!Hub.userPaused&&!Hub.busy()&&['playing','preparing','recovering','interrupted'].includes(Hub.state))Hub.set('idle','tts-cancel')}catch(e){}});
    return r;
  };
}
function hookMedia(){
  const P=window.HTMLMediaElement&&HTMLMediaElement.prototype;if(!P||P.__r214)return;P.__r214=1;
  const play=P.play,pause=P.pause;
  const settle=reason=>queueMicrotask(()=>{try{
    if(!Hub.userPaused&&!Hub.busy()&&['playing','preparing','recovering','interrupted'].includes(Hub.state))Hub.set('idle',reason);
    window.dispatchEvent(new CustomEvent('sukun:mediaactivitychange',{detail:{reason,media:Hub._pruneMedia(),at:Date.now()}}));
  }catch(e){}});
  P.play=function(...a){const el=this,r=play.apply(el,a);Promise.resolve(r).then(()=>{
    const silent=el?.dataset?.sukSilentCarrier==='1';
    if(silent){Hub.mediaActive.delete(el);settle('silent-carrier');return}
    Hub.mediaActive.add(el);Hub.lastPulse=now();if(!Hub.userPaused&&['idle','stopped'].includes(Hub.state))Hub.set('playing','html-audio')
    try{window.dispatchEvent(new CustomEvent('sukun:mediaactivitychange',{detail:{reason:'play',media:Hub._pruneMedia(),at:Date.now()}}))}catch(e){}
  }).catch(()=>{settle('play-rejected')});if(!el.__r214end){el.__r214end=1;el.addEventListener('ended',()=>{Hub.mediaActive.delete(el);Hub.lastPulse=now();settle('html-audio-ended')});el.addEventListener('emptied',()=>{Hub.mediaActive.delete(el);settle('html-audio-emptied')})}return r};
  P.pause=function(...a){Hub.mediaActive.delete(this);Hub.lastPulse=now();const r=pause.apply(this,a);settle('html-audio-pause');return r};
}

/* ── 3) ANDROID / PWA KURTARMA + ADAPTİF WATCHDOG ─────────────── */
const Watch=window.SukunAudioWatch={timer:0,last:'hazır',fail:0,nextTry:0,recovering:false};
async function recover(reason){
  const Life=window.AudioLife;
  if(Hub.userPaused||Life?.userPaused)return false;
  if(!Hub.busy()&&!Life?.busy?.())return false;
  if(document.hidden){Watch.last='… kilit/arka plan · dönüşte toparlanacak';Hub.render();return false;}
  if(Watch.recovering)return Life?._recoverPromise||false;
  Watch.recovering=true;
  Hub.recoveries++;Journal.event('recover-request',reason);Hub.set('recovering',reason);
  try{
    const ok=!!(await (Life?.requestRecover?.('hub:'+reason)??false));
    if(Hub.userPaused||Life?.userPaused)return false;
    try{window.SukunAudioSessionRegistry?.sync?.()}catch(e){}
    try{window.SesCapa?.ensure?.(Hub.title||'SÜKÛN')}catch(e){}
    try{if(ok&&typeof wakeLockAyarla==='function'&&typeof SESWL_ISTEK!=='undefined'&&SESWL_ISTEK)wakeLockAyarla(true)}catch(e){}
    Watch.last=(ok?'✓ ':'△ ')+reason+' · '+new Date().toLocaleTimeString('tr-TR');
    Hub.set(Hub.busy()?'playing':'idle',ok?'recovered':'recover-pending');
    Journal.event(ok?'recover-ok':'recover-pending',reason);Hub.render();renderJournal();
    return ok;
  }finally{Watch.recovering=false;}
}
function watchdogTick(){
  if(document.hidden)return;
  const busy=Hub.busy()||(window.AudioLife&&AudioLife.busy&&AudioLife.busy());if(!busy||Hub.userPaused)return;
  let need=false,why=[];
  try{if(typeof ctx!=='undefined'&&ctx&&ctx.state==='suspended'){need=true;why.push('context-suspended')}}catch(e){}
  try{if('mediaSession'in navigator&&window.SesCapa?.isActive?.()&&navigator.mediaSession.playbackState==='none'){need=true;why.push('media-none')}}catch(e){}
  const stale=now()-Hub.lastPulse>12000;
  if(stale&&!document.hidden){why.push('stale');try{if(typeof kesintiDenetle==='function')kesintiDenetle()}catch(e){}}
  if(need)recover('watchdog:'+why.join('+'));else{Watch.last='✓ izleniyor · '+new Date().toLocaleTimeString('tr-TR');Hub.render()}
}
let _hubLifeTO=0;const _hubLifeReasons=new Set();
function life(reason){
  _hubLifeReasons.add(String(reason||'lifecycle'));
  clearTimeout(_hubLifeTO);
  _hubLifeTO=setTimeout(()=>{
    _hubLifeTO=0;const why=[..._hubLifeReasons].join('+');_hubLifeReasons.clear();
    const L=window.AudioLife;
    let suspended=false;try{suspended=!!(typeof ctx!=='undefined'&&ctx&&ctx.state==='suspended')}catch(e){}
    if(L?.userPaused||document.hidden)return;
    if(L?.wasBusy||L?.state==='interrupted'||suspended)recover(why);
  },120);
}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)life('visibility-return')},{passive:true});
window.addEventListener('pageshow',()=>life('pageshow'),{passive:true});window.addEventListener('focus',()=>life('focus'),{passive:true});document.addEventListener('resume',()=>life('resume'),{passive:true});
Watch.timer=setInterval(watchdogTick,1800);

/* ── 3B) HARİCİ KESİNTİ SINIFLANDIRMA ───────────────────────── */
let _lastCtxState='';
function bindContextState(){
  try{
    if(typeof ctx==='undefined'||!ctx||ctx.__r220state)return false;
    ctx.__r220state=1;_lastCtxState=ctx.state;
    ctx.addEventListener('statechange',()=>{
      const st=ctx.state,was=_lastCtxState;_lastCtxState=st;Journal.event('context',was+'→'+st);
      if(st==='suspended'&&!Hub.userPaused&&Hub.busy()){Hub.interrupt('context-suspended');Watch.last='△ harici ses kesintisi';Hub.render()}
      if(st==='running'&&Hub.state==='interrupted'&&!Hub.userPaused){Hub.set('playing','context-running');Journal.event('interrupt-end','context-running')}
    });return true;
  }catch(e){diag('context-hook',e.message||e);return false}
}
window.addEventListener('sukun:audiostate',bindContextState,{passive:true});
window.addEventListener('pageshow',bindContextState,{passive:true});
document.addEventListener('freeze',()=>{if(!Hub.userPaused&&Hub.busy())Hub.interrupt('page-freeze');Journal.event('lifecycle','freeze')},{passive:true});
window.addEventListener('pagehide',e=>{Journal.event('lifecycle','pagehide'+(e.persisted?':bfcache':''));if(!Hub.userPaused&&Hub.busy())Hub.interrupt('pagehide')},{passive:true});
window.addEventListener('pageshow',e=>{Journal.event('lifecycle','pageshow'+(e.persisted?':bfcache':''));renderJournal()},{passive:true});

/* ── 3C) ZARARSIZ CANLI STRES TESTİ ──────────────────────────────
   Telefon görüşmesini taklit edip ses açmaz. Durum makinesinin sözleşmelerini
   sınar; mevcut kullanıcı oynatımını snapshot ile geri yükler. */
const Stress=window.SukunAudioStress={running:false,last:null,
  async run(){
    if(this.running)return this.last;this.running=true;
    const before={state:Hub.state,reason:Hub.reason,provider:Hub.provider,title:Hub.title,userPaused:Hub.userPaused,queue:Hub.queue.slice(),index:Hub.index,callbacks:Hub.callbacks,startedAt:Hub.startedAt};
    const tests=[];const t=(name,ok,detail='')=>tests.push({name,ok:!!ok,detail:String(detail||'')});
    try{
      Hub.userPaused=true;const blocked=await recover('stress-user-pause');t('Kullanıcı Pause kurtarmayı engelliyor',blocked===false,'recover='+blocked);
      Hub.userPaused=false;Hub.set('idle','stress');let order=[];Hub.setQueue([{run:async()=>order.push('A')},{run:async()=>order.push('B')}],0);await Hub.goto(0);await Hub.next();t('Ortak kuyruk sırası',order.join(',')==='A,B',order.join(','));
      Hub.userPaused=false;Hub.set('playing','stress');const intr=Hub.interrupt('stress-external');t('Harici kesinti sınıflandırması',intr&&Hub.state==='interrupted',Hub.state);
      Hub.userPaused=true;const intr2=Hub.interrupt('stress-while-paused');t('Pause harici kesinti sayılmıyor',intr2===false,Hub.state);
      t('MediaSession köprüsü',!!window.SesCapa,window.SesCapa?'var':'yok');
      t('IndexedDB bütünlük motoru',!!window.SukunIntegrity,window.SukunIntegrity?'var':'yok');
      t('AudioContext yaşam dinleyicisi',bindContextState()||typeof ctx==='undefined'||!ctx||!!ctx.__r220state,(typeof ctx!=='undefined'&&ctx)?ctx.state:'henüz oluşturulmadı');
    }catch(e){t('Stres testi çalışma hatası',false,e.message||e);diag('stress',e.message||e)}
    finally{
      Hub.state=before.state;Hub.reason=before.reason;Hub.provider=before.provider;Hub.title=before.title;Hub.userPaused=before.userPaused;Hub.queue=before.queue;Hub.index=before.index;Hub.callbacks=before.callbacks;Hub.startedAt=before.startedAt;Hub.lastPulse=now();Hub.render();
      this.running=false;this.last={time:now(),passed:tests.filter(x=>x.ok).length,total:tests.length,tests};Journal.event('stress',this.last.passed+'/'+this.last.total);renderStress(this.last);renderJournal();
    }
    return this.last;
  }
};
function renderStress(r){const el=document.getElementById('r220Stress');if(!el)return;if(!r){el.textContent='Henüz çalıştırılmadı.';return}el.textContent='Sonuç: '+r.passed+'/'+r.total+' başarılı\n'+r.tests.map(x=>(x.ok?'✓ ':'✕ ')+x.name+(x.detail?' · '+x.detail:'')).join('\n')}

/* ── 4) INDEXEDDB BÜTÜNLÜK DENETİMİ ───────────────────────────── */
function scanStore(dbName,storeName,validate){return new Promise(resolve=>{if(!('indexedDB'in window))return resolve({db:dbName,store:storeName,total:0,bad:[],error:'IndexedDB yok'});const rq=indexedDB.open(dbName);rq.onerror=()=>resolve({db:dbName,store:storeName,total:0,bad:[],error:String(rq.error||'açılamadı')});rq.onsuccess=()=>{const db=rq.result;if(!db.objectStoreNames.contains(storeName)){db.close();return resolve({db:dbName,store:storeName,total:0,bad:[],error:'store yok'})}const out={db:dbName,store:storeName,total:0,bad:[],error:''};const tx=db.transaction(storeName,'readonly'),st=tx.objectStore(storeName),cur=st.openCursor();cur.onsuccess=e=>{const c=e.target.result;if(!c)return;out.total++;let valid=false;try{valid=!!validate(c.value,c.key)}catch(_){valid=false}if(!valid)out.bad.push(c.key);c.continue()};cur.onerror=()=>{out.error=String(cur.error||'cursor')};tx.oncomplete=()=>{db.close();resolve(out)};tx.onerror=()=>{out.error=String(tx.error||'transaction');db.close();resolve(out)}}})}
function delKeys(dbName,storeName,keys){return new Promise(resolve=>{if(!keys.length)return resolve(0);const rq=indexedDB.open(dbName);rq.onerror=()=>resolve(0);rq.onsuccess=()=>{const db=rq.result;let n=0;try{const tx=db.transaction(storeName,'readwrite'),st=tx.objectStore(storeName);keys.forEach(k=>{st.delete(k);n++});tx.oncomplete=()=>{db.close();resolve(n)};tx.onerror=()=>{db.close();resolve(0)}}catch(e){db.close();resolve(0)}}})}
const Integrity=window.SukunIntegrity={last:null,
  async scan(){
    const rec=await scanStore('sukunRec','clips',v=>v instanceof Blob&&/^audio\//i.test(v.type||'')&&v.size>0&&v.size<=64*1024*1024);
    const amb=await scanStore('sukunCustomAmb','sounds',v=>v&&typeof v==='object'&&v.blob instanceof Blob&&/^audio\//i.test(v.blob.type||'')&&v.blob.size>0&&v.blob.size<=64*1024*1024&&typeof v.name==='string');
    const out={time:now(),rec,amb,bad:rec.bad.length+amb.bad.length};this.last=out;try{localStorage.setItem('sukun.integrity.last',JSON.stringify({time:out.time,rec:{total:rec.total,bad:rec.bad.map(String),error:rec.error},amb:{total:amb.total,bad:amb.bad.map(String),error:amb.error},bad:out.bad}))}catch(e){};renderIntegrity(out);return out;
  },
  async repair(){const r=this.last||await this.scan();if(!r.bad)return 0;const ok=confirm(r.bad+' bozuk/boş ses kaydı bulundu. Yalnız doğrulanamayan kayıtlar silinsin mi?');if(!ok)return 0;const n=(await delKeys('sukunRec','clips',r.rec.bad))+(await delKeys('sukunCustomAmb','sounds',r.amb.bad));diag('integrity-repair',n+' kayıt temizlendi');await this.scan();try{if(typeof recInit==='function')recInit()}catch(e){}return n}
};
function renderIntegrity(r){const el=document.getElementById('r214Integrity');if(!el)return;el.textContent='Kayıt DB: '+r.rec.total+' · bozuk '+r.rec.bad.length+'\nAmbiyans DB: '+r.amb.total+' · bozuk '+r.amb.bad.length+(r.rec.error?'\nKayıt hata: '+r.rec.error:'')+(r.amb.error?'\nAmbiyans hata: '+r.amb.error:'')}

/* ── 5) TANILAMA PANELİNE MERKEZÎ SAĞLIK KARTI ────────────────── */
function healthUI(){
  const sheet=document.querySelector('#prDiagOverlay .prDiagSheet');if(!sheet||document.getElementById('r214Health'))return;
  const d=document.createElement('div');d.id='r214Health';d.innerHTML='<div id="r214HealthRow"><div><small>MERKEZÎ OTURUM</small><b id="r214HubState">hazır</b></div><div><small>WATCHDOG</small><b id="r214Watch">hazır</b></div><div><small>BUILD</small><b>'+BUILD+'</b></div></div><div style="display:flex;gap:7px;flex-wrap:wrap;margin-top:8px"><button class="btn" id="r220StressBtn">Canlı stres testi</button><button class="btn" id="r214Scan">Veri bütünlüğünü tara</button><button class="btn" id="r214Repair">Bozuk kayıtları onar</button><button class="btn" id="r220JournalClear">Oturum günlüğünü temizle</button></div><pre id="r220Stress">Henüz çalıştırılmadı.</pre><pre id="r214Integrity">Henüz taranmadı.</pre><pre id="r220Journal">Oturum günlüğü boş.</pre>';
  sheet.appendChild(d);d.querySelector('#r220StressBtn').onclick=()=>Stress.run();d.querySelector('#r214Scan').onclick=()=>Integrity.scan();d.querySelector('#r214Repair').onclick=()=>Integrity.repair();d.querySelector('#r220JournalClear').onclick=()=>Journal.clear();Hub.render();renderJournal();renderStress(Stress.last);
}

function init(){hookSesCapa();hookSpeech();hookMedia();bindContextState();healthUI();renderJournal();setTimeout(()=>Integrity.scan().catch(()=>{}),2500);Hub.set((window.AudioLife?.busy?.()?'playing':'idle'),'r228-ready');Journal.event('init',BUILD)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,80),{once:true});else setTimeout(init,80);
})();
