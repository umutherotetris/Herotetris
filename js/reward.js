// ════════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — MERKEZİ ÖDÜL EKRANI
//  Tüm oyunlar buraya skor/kaju/xp kazanımlarını bildirir.
//  Bağımlılık & sadakat: animasyonlu XP çubuğu, seviye atlama,
//  streak ateşi, kaju yağmuru, günlük görev ilerleme.
// ════════════════════════════════════════════════════════════════
import * as Store from './store.js';
import { Auth } from './auth.js';

// ── Konfeti (CSS parçacık) ──
function burst(colors, count){
  const c = document.createElement('div');
  c.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:99999;overflow:hidden';
  for(let i=0;i<count;i++){
    const p = document.createElement('div');
    const sz = 4 + Math.random()*8;
    const col = colors[Math.floor(Math.random()*colors.length)];
    p.style.cssText = `position:absolute;width:${sz}px;height:${sz}px;border-radius:50%;background:${col};`
      + `left:${20+Math.random()*60}%;top:-10px;animation:rw-fall ${1+Math.random()}s ease-in ${Math.random()*0.5}s both`;
    c.appendChild(p);
  }
  document.body.appendChild(c);
  setTimeout(()=>c.remove(), 2500);
}

// ── Rakam sayacı animasyonu ──
function animCount(el, from, to, dur=800, suffix=''){
  const start=Date.now(); const range=to-from;
  const step=()=>{
    const t=Math.min(1,(Date.now()-start)/dur);
    const ease=1-(1-t)*(1-t); // easeOutQuad
    el.textContent = Math.floor(from+range*ease).toLocaleString('tr-TR') + suffix;
    if(t<1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ── XP çubuğu animasyonu (seviye atlama ile) ──
async function animXPBar(container, fromXP, fromLv, xpGained){
  const bar = container.querySelector('.rw-xp-fill');
  const lbl = container.querySelector('.rw-xp-lbl');
  const lvLbl = container.querySelector('.rw-xp-lv');
  if(!bar) return;

  let lv = fromLv, xp = fromXP;
  const needed = () => 300 + lv * 200;

  // Önce mevcut durumu göster
  bar.style.transition = 'none';
  bar.style.width = Math.min(100, xp/needed()*100)+'%';
  await new Promise(r=>setTimeout(r,200));

  // XP kazanımını yavaşça doldur
  bar.style.transition = 'width 1.2s cubic-bezier(.4,0,.2,1)';

  let remaining = xpGained;
  while(remaining > 0){
    const space = needed() - xp;
    if(remaining >= space){
      // Seviye atlama
      xp += space; remaining -= space;
      bar.style.width = '100%';
      if(lbl) lbl.textContent = xp.toLocaleString('tr-TR') + ' / ' + needed().toLocaleString('tr-TR') + ' XP';
      await new Promise(r=>setTimeout(r,1300));
      // Level up efekti
      lv++;
      if(lvLbl){
        lvLbl.textContent = 'LV.' + lv;
        lvLbl.classList.add('rw-lvup-flash');
        setTimeout(()=>lvLbl.classList.remove('rw-lvup-flash'),1000);
      }
      bar.style.transition='none'; xp=0;
      bar.style.width='0%';
      await new Promise(r=>setTimeout(r,100));
      bar.style.transition='width 1.2s cubic-bezier(.4,0,.2,1)';
    } else {
      xp += remaining; remaining = 0;
      const pct = Math.min(100, xp/needed()*100);
      bar.style.width = pct + '%';
      if(lbl) lbl.textContent = xp.toLocaleString('tr-TR') + ' / ' + needed().toLocaleString('tr-TR') + ' XP';
      await new Promise(r=>setTimeout(r,1200));
    }
  }
  return lv;
}

// ══════════════════════════════════════════════════════════════════
// ANA FONKSİYON — Tüm oyunlar bunu çağırır
// opts: { won, game, score, lines, kaju, xp, isRecord, title, subtitle, extra }
// ══════════════════════════════════════════════════════════════════
export async function showReward(opts={}){
  const { won=false, game='', score=0, kaju=0, xp=0,
          isRecord=false, title='', subtitle='', extra='' } = opts;

  // Store'dan mevcut XP/level al (animasyon için önce)
  const p = Store.getState();
  const fromLv = p.level || 1;
  const fromXP = p.xp || 0;
  const fromKaju = p.kaju || 0;

  // Firebase'e yaz (eğer oyun yazmadıysa)
  if(kaju > 0 && opts.writeReward !== false) await Store.addKaju(kaju, game).catch(()=>{});
  if(xp  > 0 && opts.writeReward !== false) await Store.addXP(xp).catch(()=>{});

  const afterP = Store.getState();
  const isLevelUp = afterP.level > fromLv;

  // Başlık ve renk
  const displayTitle = title || (won ? '🏆 KAZANDIN!' : '💀 OYUN BİTTİ');
  const accentColor = won ? '#FFD740' : '#00E5FF';
  const bgGradient = won
    ? 'radial-gradient(ellipse at 50% 0%,rgba(255,215,64,.15),transparent 60%),linear-gradient(165deg,#1a1408,#0a0905)'
    : 'radial-gradient(ellipse at 50% 0%,rgba(0,229,255,.12),transparent 60%),linear-gradient(165deg,#081218,#040a0d)';

  // Streak hesapla
  let streak = 0;
  try{ streak = parseInt(localStorage.getItem('hero_win_streak')||'0');
    if(won) streak++; else streak=0;
    localStorage.setItem('hero_win_streak',String(streak));
  }catch(e){}

  // Overlay oluştur
  const ov = document.createElement('div');
  ov.id = 'heroRewardOv';
  ov.style.cssText = 'position:fixed;inset:0;z-index:99990;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);backdrop-filter:blur(16px);padding:16px;animation:rwFadeIn .4s ease';

  ov.innerHTML = `
  <div class="rw-card" style="background:${bgGradient};border-color:${accentColor}33">
    <!-- Başlık -->
    <div class="rw-title" style="color:${accentColor}">${displayTitle}</div>
    ${subtitle ? `<div class="rw-subtitle">${subtitle}</div>` : ''}
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

    <!-- Butonlar -->
    <div class="rw-actions">
      <button class="rw-btn rw-btn-close" id="rwClose">✕ Kapat</button>
      <button class="rw-btn rw-btn-play" id="rwPlay">▶ Tekrar Oyna</button>
    </div>
  </div>`;

  document.body.appendChild(ov);

  // Animasyonları sırayla başlat
  setTimeout(async()=>{
    // Skor sayaç
    const scoreEl = ov.querySelector('#rwScore');
    if(scoreEl) animCount(scoreEl, 0, score, 1000);

    // Konfeti kazanınca
    if(won) burst(['#FFD740','#FF9800','#69F0AE','#00E5FF','#FF4081'], 60);
    else if(isRecord) burst(['#00E5FF','#c084fc'], 30);

    // Kaju animasyonu
    setTimeout(()=>{
      const kr = ov.querySelector('#rwKajuRow');
      const kv = ov.querySelector('#rwKajuVal');
      if(kr){ kr.style.opacity='1'; kr.style.transition='opacity .4s'; }
      if(kv) animCount(kv, 0, kaju, 800, '');
    }, 600);

    // XP animasyonu
    setTimeout(()=>{
      const xr = ov.querySelector('#rwXpRow');
      const xv = ov.querySelector('#rwXpVal');
      if(xr){ xr.style.opacity='1'; xr.style.transition='opacity .4s'; }
      if(xv) animCount(xv, 0, xp, 800, '');
    }, 900);

    // XP çubuğu animasyonu
    setTimeout(async()=>{
      const xpSection = ov.querySelector('.rw-xp-section');
      if(xpSection && xp > 0) await animXPBar(xpSection, fromXP, fromLv, xp);
    }, 1200);

    // Level up banner parlama
    if(isLevelUp) burst(['#FFD740','#FFF9C4','#FFE57F'], 45);

  }, 100);

  // Kapat/Tekrar
  return new Promise(resolve=>{
    ov.querySelector('#rwClose').addEventListener('click',()=>{ ov.remove(); resolve('close'); });
    ov.querySelector('#rwPlay').addEventListener('click',()=>{ ov.remove(); resolve('replay'); });
    ov.addEventListener('click',e=>{ if(e.target===ov){ ov.remove(); resolve('close'); } });
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
.rw-card{ width:100%; max-width:340px; border:1.5px solid; border-radius:22px; padding:22px 18px 18px; text-align:center; position:relative; overflow:hidden; animation:rwFadeIn .4s ease; }
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
  `;
  document.head.appendChild(st);
}
