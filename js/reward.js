// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — MERKEZİ ÖDÜL EKRANI
//  Tüm oyunlar buraya skor/kaju/xp kazanımlarını bildirir.
//  Bağımlılık & sadakat: animasyonlu XP çubuğu, seviye atlama,
//  streak ateşi, kaju yağmuru, günlük görev ilerleme.
// ════════════════════════════════════════════════════════════════
import * as Store from './store.js';
import { Auth } from './auth.js';

// Every visual task belongs to one result overlay. Closing it also resolves
// pending sleeps so an XP animation cannot resume on a detached result card.
function rewardAnimations(active){
  const timers=new Set(),frames=new Set(),sleeps=new Map(),effects=new Set();
  const later=(fn,delay)=>{
    if(!active())return null;
    const id=setTimeout(()=>{timers.delete(id);if(active())void Promise.resolve(fn()).catch(()=>{});},delay);
    timers.add(id);return id;
  };
  const frame=fn=>{
    if(!active())return null;
    const id=requestAnimationFrame(()=>{frames.delete(id);if(active())fn();});frames.add(id);return id;
  };
  const sleep=delay=>{
    if(!active())return Promise.resolve(false);
    return new Promise(resolve=>{const id=setTimeout(()=>{timers.delete(id);sleeps.delete(id);resolve(active());},delay);timers.add(id);sleeps.set(id,resolve);});
  };
  const effect=node=>{effects.add(node);later(()=>{node.remove();effects.delete(node);},2500);};
  const stop=()=>{
    timers.forEach(id=>clearTimeout(id));timers.clear();
    frames.forEach(id=>cancelAnimationFrame(id));frames.clear();
    sleeps.forEach(resolve=>resolve(false));sleeps.clear();
    effects.forEach(node=>node.remove());effects.clear();
  };
  return {active,later,frame,sleep,effect,stop};
}

function burst(colors,count,animation){
  if(!animation.active())return;
  const container=document.createElement('div');
  container.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
  for(let i=0;i<count;i++){
    const particle=document.createElement('div'),size=4+Math.random()*8,color=colors[Math.floor(Math.random()*colors.length)];
    particle.style.cssText=`position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color};`
      +`left:${20+Math.random()*60}%;top:-10px;animation:rw-fall ${1+Math.random()}s ease-in ${Math.random()*0.5}s both`;
    container.appendChild(particle);
  }
  document.body.appendChild(container);animation.effect(container);
}

function animCount(element,from,to,duration,suffix,animation){
  const start=Date.now(),range=to-from;
  const step=()=>{
    if(!animation.active()||!element.isConnected)return;
    const time=Math.min(1,(Date.now()-start)/duration),ease=1-(1-time)*(1-time);
    element.textContent=Math.floor(from+range*ease).toLocaleString('tr-TR')+suffix;
    if(time<1)animation.frame(step);
  };
  animation.frame(step);
}

async function animXPBar(container,fromXP,fromLevel,gained,animation){
  const bar=container.querySelector('.rw-xp-fill'),label=container.querySelector('.rw-xp-lbl'),levelLabel=container.querySelector('.rw-xp-lv');
  if(!bar||!animation.active())return;
  let level=fromLevel,xp=fromXP,remaining=gained;
  const needed=()=>300+level*200;
  bar.style.transition='none';bar.style.width=Math.min(100,xp/needed()*100)+'%';
  if(!await animation.sleep(200))return;
  bar.style.transition='width 1.2s cubic-bezier(.4,0,.2,1)';
  while(remaining>0&&animation.active()){
    const space=needed()-xp;
    if(remaining>=space){
      xp+=space;remaining-=space;bar.style.width='100%';
      if(label)label.textContent=xp.toLocaleString('tr-TR')+' / '+needed().toLocaleString('tr-TR')+' XP';
      if(!await animation.sleep(1300))return;
      level++;
      if(levelLabel){levelLabel.textContent='LV.'+level;levelLabel.classList.add('rw-lvup-flash');animation.later(()=>levelLabel.classList.remove('rw-lvup-flash'),1000);}
      bar.style.transition='none';xp=0;bar.style.width='0%';
      if(!await animation.sleep(100))return;
      bar.style.transition='width 1.2s cubic-bezier(.4,0,.2,1)';
    }else{
      xp+=remaining;remaining=0;bar.style.width=Math.min(100,xp/needed()*100)+'%';
      if(label)label.textContent=xp.toLocaleString('tr-TR')+' / '+needed().toLocaleString('tr-TR')+' XP';
      if(!await animation.sleep(1200))return;
    }
  }
  return level;
}

// ══════════════════════════════════════════════════════════════════
// ANA FONKSİYON — Tüm oyunlar bunu çağırır
// opts: { won, game, score, lines, kaju, xp, isRecord, title, subtitle, extra }
// ══════════════════════════════════════════════════════════════════
export async function showReward(opts={}){
  const ownerUid=typeof Auth!=='undefined'?Auth.getState().uid:Store.getState().uid;
  const current=()=> (!opts.isCurrent || opts.isCurrent()) && (typeof Auth==='undefined'||Auth.getState().uid===ownerUid);
  if(!current()) return 'close';
  const { won=false, game='', score=0,
          isRecord=false, title='', subtitle='', extra='' } = opts;
  const amount=value=>Number.isSafeInteger(value)&&value>0?value:0;
  let kaju=amount(opts.kaju),xp=amount(opts.xp),payoutIssue=opts.payoutIssue===true;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Store'dan mevcut XP/level al (animasyon için önce)
  const p = Store.getState();
  const fromLv = p.level || 1;
  const fromXP = p.xp || 0;
  const fromKaju = p.kaju || 0;

  // Firebase'e yaz (eğer oyun yazmadıysa)
  if(kaju > 0 && opts.writeReward !== false){
    try{kaju=amount(await Store.addKaju(kaju,game));}catch(_){kaju=0;payoutIssue=true;}
  }
  if(!current())return 'close';
  if(xp > 0 && opts.writeReward !== false){
    try{const receipt=await Store.awardXP(xp,ownerUid);xp=receipt?.ok?amount(receipt.amount):0;if(!receipt?.ok)payoutIssue=true;}
    catch(_){xp=0;payoutIssue=true;}
  }
  if(!current())return 'close';

  const afterP = Store.getState();
  const isLevelUp = afterP.level > fromLv;

  // 📋 Görev ilerletme: oyun oynandı (+ galibiyet varsa)
  try{
    const eco = await import('./economy.js');
    if(!current()) return 'close';
    if(!opts.questEventsHandled&&!opts.playEventHandled)eco.progressQuest('play');
    if(won&&!opts.questEventsHandled&&!opts.winEventHandled)eco.progressQuest('win');
    // Store.addKaju already records the confirmed earn event. A result screen
    // must never award that progress a second time.
  }catch(e){}
  if(!current()) return 'close';

  // Başlık ve renk
  const displayTitle = title || (won ? '🏆 KAZANDIN!' : '💀 OYUN BİTTİ');
  const accentColor = won ? '#FFD740' : '#00E5FF';
  const bgGradient = won
    ? 'radial-gradient(ellipse at 50% 0%,rgba(255,215,64,.15),transparent 60%),linear-gradient(165deg,#1a1408,#0a0905)'
    : 'radial-gradient(ellipse at 50% 0%,rgba(0,229,255,.12),transparent 60%),linear-gradient(165deg,#081218,#040a0d)';

  // Streak hesapla
  let streak = 0;
  try{ const streakKey='hero_win_streak:'+ownerUid;streak = parseInt(localStorage.getItem(streakKey)||'0')||0;
    if(won) streak++; else streak=0;
    localStorage.setItem(streakKey,String(streak));
  }catch(e){}

  // Overlay oluştur
  let settled=false;
  const ov = document.createElement('div');
  const active=()=>!settled&&ov.isConnected&&current();
  const animation=rewardAnimations(active);
  ov.id = 'heroRewardOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(16px);padding:16px;animation:rwFadeIn .4s ease';

  ov.innerHTML = `
  <div class="rw-card" style="background:${bgGradient};border-color:${accentColor}33">
    <!-- Başlık -->
    <div class="rw-title" style="color:${accentColor}">${esc(displayTitle)}</div>
    ${subtitle ? `<div class="rw-subtitle">${esc(subtitle)}</div>` : ''}
    ${isRecord ? '<div class="rw-record">🏅 YENİ REKOR!</div>' : ''}

    <!-- Skor -->
    ${score > 0 ? `<div class="rw-score-row"><span class="rw-score-lbl">SKOR</span><span class="rw-score-val" id="rwScore">0</span></div>` : ''}

    <!-- Streak -->
    ${streak >= 2 ? `<div class="rw-streak">🔥 ${streak} GALİBİYET SERISI!</div>` : ''}

    <!-- Kazanımlar -->
    <div class="rw-rewards">
      ${kaju > 0 ? `<div class="rw-reward-item" id="rwKajuRow" style="opacity:0">
        <div class="rw-reward-ico">🥜</div>
        <div class="rw-reward-info">
          <div class="rw-reward-name">KAJU KAZANILDI</div>
          <div class="rw-reward-val" id="rwKajuVal">+0</div>
        </div>
      </div>` : ''}
      ${xp > 0 ? `<div class="rw-reward-item" id="rwXpRow" style="opacity:0">
        <div class="rw-reward-ico">⚡</div>
        <div class="rw-reward-info">
          <div class="rw-reward-name">DENEYİM PUANI</div>
          <div class="rw-reward-val" id="rwXpVal">+0</div>
        </div>
      </div>` : ''}
    </div>

    <!-- Level up banner -->
    ${isLevelUp ? `<div class="rw-levelup">
      <span class="rw-lvup-star">✦</span>
      SEVİYE ATLADIN!
      <span class="rw-lvup-badge">LV.${afterP.level}</span>
      <span class="rw-lvup-star">✦</span>
    </div>` : ''}

    <!-- XP İlerleme Çubuğu -->
    ${xp > 0 ? `<div class="rw-xp-section">
      <div class="rw-xp-header">
        <span class="rw-xp-lv" id="rwXpLv">LV.${fromLv}</span>
        <span class="rw-xp-title">Sonraki Seviye</span>
        <span class="rw-xp-lv">LV.${fromLv+1}</span>
      </div>
      <div class="rw-xp-track"><div class="rw-xp-fill" id="rwXpFill"></div></div>
      <div class="rw-xp-lbl" id="rwXpLbl">${fromXP.toLocaleString('tr-TR')} / ${(300+fromLv*200).toLocaleString('tr-TR')} XP</div>
    </div>` : ''}

    ${extra ? `<div class="rw-extra">${extra}</div>` : ''}
    ${payoutIssue?'<div class="rw-extra" role="status">Bazı kazanımlar kaydedilemedi. Yalnızca onaylanan tutarlar gösteriliyor.</div>':''}
    ${Array.isArray(opts.insights)&&opts.insights.length?'<ul class="rw-insights">'+opts.insights.slice(0,5).map(s=>'<li>'+esc(s)+'</li>').join('')+'</ul>':''}
    ${opts.review?'<button class="rw-btn rw-btn-review" id="rwReview">◉ Maçı incele</button>':''}

    <!-- Butonlar -->
    <div class="rw-actions">
      <button class="rw-btn rw-btn-close" id="rwClose">✕ Kapat</button>
      <button class="rw-btn rw-btn-play" id="rwPlay">▶ Tekrar Oyna</button>
    </div>
  </div>`;

  document.body.appendChild(ov);
  ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Maç sonucu');

  // Animasyonları sırayla başlat
  animation.later(async()=>{
    if(!active())return;
    // Skor sayaç
    const scoreEl = ov.querySelector('#rwScore');
    if(scoreEl) animCount(scoreEl,0,score,1000,'',animation);

    // Konfeti kazanınca
    if(won) burst(['#FFD740','#FF9800','#69F0AE','#00E5FF','#FF4081'],60,animation);
    else if(isRecord) burst(['#00E5FF','#c084fc'],30,animation);

    // Kaju animasyonu
    animation.later(()=>{
      const kr = ov.querySelector('#rwKajuRow');
      const kv = ov.querySelector('#rwKajuVal');
      if(kr){ kr.style.opacity='1'; kr.style.transition='opacity .4s'; }
      if(kv) animCount(kv,0,kaju,800,'',animation);
    }, 600);

    // XP animasyonu
    animation.later(()=>{
      const xr = ov.querySelector('#rwXpRow');
      const xv = ov.querySelector('#rwXpVal');
      if(xr){ xr.style.opacity='1'; xr.style.transition='opacity .4s'; }
      if(xv) animCount(xv,0,xp,800,'',animation);
    }, 900);

    // XP çubuğu animasyonu
    animation.later(async()=>{
      const xpSection = ov.querySelector('.rw-xp-section');
      if(xpSection && xp > 0) await animXPBar(xpSection,fromXP,fromLv,xp,animation);
    }, 1200);

    // Level up banner parlama
    if(isLevelUp) burst(['#FFD740','#FFF9C4','#FFE57F'],45,animation);

  }, 100);

  // Kapat/Tekrar
  return new Promise(resolve=>{
    let off=()=>{};
    const finish=action=>{if(settled)return;settled=true;off();document.removeEventListener('keydown',keyboard);animation.stop();ov.remove();resolve(action);};
    const keyboard=e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))finish('close');};
    document.addEventListener('keydown',keyboard);
    ov.querySelector('#rwClose').addEventListener('click',()=>finish('close'));
    ov.querySelector('#rwPlay').addEventListener('click',()=>finish(current()?'replay':'close'));
    ov.addEventListener('click',e=>{ if(e.target===ov)finish('close'); });
    const reviewButton=ov.querySelector('#rwReview');
    reviewButton?.addEventListener('click',async()=>{
      if(reviewButton.disabled||!active())return;reviewButton.disabled=true;
      try{const module=await import('./game-review.js');if(active())await module.openGameReview(opts.review);}
      catch(_){if(active())reviewButton.textContent='İnceleme açılamadı · Yeniden dene';}
      finally{if(active())reviewButton.disabled=false;}
    });
    if(typeof Auth!=='undefined'){off=Auth.subscribe(()=>{if(!current())finish('close');});if(settled)off();}
    ov.querySelector('#rwClose').focus();
  });
}

// CSS enjekte et (bir kez)
if(!document.getElementById('heroRewardCSS')){
  const st = document.createElement('style');
  st.id = 'heroRewardCSS';
  st.textContent = `
@keyframes rwFadeIn{ from{opacity:0;transform:scale(.95)} to{opacity:1;transform:scale(1)} }
@keyframes rwLvUpFlash{ 0%{transform:scale(1);color:#fff} 50%{transform:scale(1.35);color:#FFD740;text-shadow:0 0 20px #FFD740} 100%{transform:scale(1)} }
@keyframes rw-fall{ 0%{transform:translateY(0) rotate(0)} 100%{transform:translateY(110vh) rotate(360deg)} }
@keyframes rwStreakPulse{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
.rw-card{ width:100%; max-width:420px; max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box; border:1.5px solid; border-radius:22px; padding:22px 18px 18px; text-align:center; position:relative; animation:rwFadeIn .4s ease; }
.rw-title{ font-family:'Orbitron',sans-serif; font-size:24px; font-weight:900; letter-spacing:1px; margin-bottom:4px; text-shadow:0 0 20px currentColor; }
.rw-subtitle{ font-size:11px; color:#9fb0d8; margin-bottom:10px; }
.rw-record{ background:linear-gradient(135deg,rgba(255,215,64,.15),rgba(255,150,0,.1)); border:1px solid rgba(255,215,64,.4); color:#FFD740; font-size:11px; font-weight:800; padding:5px 14px; border-radius:10px; display:inline-block; margin-bottom:10px; letter-spacing:1px; }
.rw-score-row{ display:flex; align-items:center; justify-content:space-between; margin:12px 0; padding:12px 16px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); border-radius:13px; }
.rw-score-lbl{ font-size:10px; color:#7d8ab8; font-weight:700; letter-spacing:2px; }
.rw-score-val{ font-family:'Orbitron',sans-serif; font-size:22px; font-weight:800; color:#fff; }
.rw-streak{ color:#FF9800; font-size:12px; font-weight:800; margin:6px 0 10px; animation:rwStreakPulse 1.5s ease-in-out infinite; letter-spacing:1px; }
.rw-rewards{ display:flex; flex-direction:column; gap:8px; margin:10px 0; }
.rw-reward-item{ display:flex; align-items:center; gap:12px; padding:11px 14px; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.08); border-radius:13px; text-align:left; transition:opacity .4s; }
.rw-reward-ico{ font-size:22px; }
.rw-reward-name{ font-size:9.5px; color:#7d8ab8; font-weight:700; letter-spacing:1px; }
.rw-reward-val{ font-family:'Orbitron',sans-serif; font-size:16px; font-weight:800; color:#69F0AE; margin-top:2px; }
.rw-levelup{ margin:12px 0; padding:13px; background:linear-gradient(135deg,rgba(255,215,64,.12),rgba(255,150,0,.08)); border:1.5px solid rgba(255,215,64,.35); border-radius:14px; font-family:'Orbitron',sans-serif; font-size:13px; font-weight:800; color:#FFD740; letter-spacing:1.5px; display:flex; align-items:center; justify-content:center; gap:8px; }
.rw-lvup-badge{ background:linear-gradient(135deg,#FFD740,#FF9800); color:#0a0a0a; font-size:12px; font-weight:900; padding:4px 12px; border-radius:20px; }
.rw-lvup-star{ font-size:16px; }
.rw-lvup-flash{ animation:rwLvUpFlash .8s ease; }
.rw-xp-section{ margin:12px 0 0; }
.rw-xp-header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:5px; }
.rw-xp-lv{ font-family:'Orbitron',sans-serif; font-size:11px; font-weight:800; color:#c084fc; }
.rw-xp-title{ font-size:9px; color:#7d8ab8; letter-spacing:2px; }
.rw-xp-track{ height:10px; background:rgba(255,255,255,.06); border-radius:10px; overflow:hidden; border:1px solid rgba(255,255,255,.08); margin-bottom:5px; }
.rw-xp-fill{ height:100%; background:linear-gradient(90deg,#c084fc,#00E5FF); border-radius:10px; width:0%; box-shadow:0 0 8px #c084fc88; }
.rw-xp-lbl{ font-size:9px; color:#7d8ab8; text-align:center; }
.rw-extra{ font-size:10px; color:#9fb0d8; margin:8px 0; line-height:1.5; padding:8px 12px; background:rgba(255,255,255,.03); border-radius:10px; }
.rw-actions{ display:flex; gap:10px; margin-top:16px; }
.rw-btn{ flex:1; padding:12px; border-radius:14px; font-family:'Orbitron',sans-serif; font-size:11px; font-weight:700; cursor:pointer; border:none; letter-spacing:1px; transition:transform .15s; }
.rw-btn:active{ transform:scale(.97); }
.rw-btn-close{ background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.12); color:#9fb0d8; }
.rw-btn-play{ background:linear-gradient(135deg,rgba(0,229,255,.2),rgba(0,229,255,.08)); border:1.5px solid rgba(0,229,255,.4); color:#00E5FF; }
.rw-insights{font:12px/1.6 system-ui;color:#becbe3;text-align:left;padding:12px 12px 12px 28px;margin:12px 0;background:#ffffff06;border:1px solid #b6ceff20;border-radius:12px}.rw-insights li+li{margin-top:6px}.rw-btn-review{width:100%;background:#8ce7cb15;border:1px solid #8ce7cb50;color:#acedd8}.rw-btn:focus-visible{outline:2px solid #b9f5e8;outline-offset:3px}@media(prefers-reduced-motion:reduce){.rw-card,.rw-card *{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(st);
}
