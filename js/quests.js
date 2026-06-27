// ════════════════════════════════════════════════════════
//  quests.js — Günlük Görevler Sistemi
//  Hero Oyun Portalı
//  Her gün yenilenen görevler, ilerleme takibi, ödül talebi.
//  Firebase: quests/{uid}/{dateKey} = { taskId: {prog, claimed}, ... }
// ════════════════════════════════════════════════════════
import { firebaseConfig, FIREBASE_SDK } from './firebase-config.js';
import Auth from './auth.js';
import { Store } from './store.js';

// Firebase erişimi (store.js ile aynı yöntem)
const SDK_VER = (typeof FIREBASE_SDK === 'string' && FIREBASE_SDK) ? FIREBASE_SDK : '10.12.0';
const BASE = `https://www.gstatic.com/firebasejs/${SDK_VER}`;
const { getDatabase, ref, get, set, update, onValue } = await import(`${BASE}/firebase-database.js`);
const { getApp, getApps, initializeApp } = await import(`${BASE}/firebase-app.js`);
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

// ── Görev havuzu (her gün rastgele 3 tanesi seçilir) ──
// type: hangi olayda ilerler · goal: hedef · reward: Kaju
const QUEST_POOL = [
  { id:'play3',      type:'game_played',  goal:3,    reward:150,  icon:'🎮', text:'3 maç oyna' },
  { id:'play5',      type:'game_played',  goal:5,    reward:300,  icon:'🎮', text:'5 maç oyna' },
  { id:'win1',       type:'game_won',     goal:1,    reward:200,  icon:'🏆', text:'1 maç kazan' },
  { id:'win3',       type:'game_won',     goal:3,    reward:450,  icon:'🏆', text:'3 maç kazan' },
  { id:'score_t',    type:'score_tetris', goal:5000, reward:200,  icon:'🟦', text:"Tetris'te 5.000 puan yap" },
  { id:'play_chess', type:'play_chess',   goal:1,    reward:150,  icon:'♟️', text:'1 Satranç oyna' },
  { id:'play_tavla', type:'play_tavla',   goal:1,    reward:150,  icon:'🎲', text:'1 Tavla oyna' },
  { id:'play_kelime',type:'play_kelime',  goal:1,    reward:150,  icon:'🔤', text:'1 Kelimecik oyna' },
  { id:'earn500',    type:'kaju_earned',  goal:500,  reward:200,  icon:'🥜', text:'500 Kaju kazan' },
  { id:'feed_kozmo', type:'feed_kozmo',   goal:3,    reward:150,  icon:'🍎', text:'Kozmonu 3 kez besle' },
  { id:'spin_wheel', type:'spin_wheel',   goal:1,    reward:100,  icon:'🎡', text:'Günlük çarkı çevir' },
];

// Bugünün anahtarı (yerel tarih)
function todayKey(){ const d = new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }

// Deterministik günlük seçim (her kullanıcı aynı gün aynı görevleri alır — uid+tarih seed)
function pickDaily(uid){
  const seedStr = (uid||'x') + todayKey();
  let h = 0; for(let i=0;i<seedStr.length;i++){ h = (h*31 + seedStr.charCodeAt(i)) >>> 0; }
  const pool = QUEST_POOL.slice();
  const chosen = [];
  for(let i=0;i<3 && pool.length;i++){
    h = (h*1103515245 + 12345) >>> 0;
    const idx = h % pool.length;
    chosen.push(pool[idx]);
    pool.splice(idx,1);
  }
  return chosen;
}

let _state = null;     // { dateKey, tasks:{id:{prog,claimed}}, defs:[...] }
let _subs = new Set();
let _liveOff = null;

function _emit(){ _subs.forEach(fn=>{ try{ fn(_state); }catch(e){} }); }
export function subscribeQuests(fn){ _subs.add(fn); if(_state) try{ fn(_state); }catch(e){} return ()=>_subs.delete(fn); }

// Bugünün görevlerini yükle (yoksa oluştur)
export async function loadQuests(){
  const st = Auth.getState();
  if(!st.uid){ _state = null; return null; }
  const dk = todayKey();
  const defs = pickDaily(st.uid);
  let saved = {};
  try{
    const snap = await get(ref(db, 'quests/' + st.uid + '/' + dk));
    if(snap.exists()) saved = snap.val() || {};
  }catch(e){}
  const tasks = {};
  defs.forEach(d=>{
    tasks[d.id] = { prog: (saved[d.id] && saved[d.id].prog) || 0, claimed: !!(saved[d.id] && saved[d.id].claimed) };
  });
  _state = { dateKey: dk, defs, tasks };
  _emit();
  // Canlı dinleme (başka cihazdan ilerleme)
  try{ if(_liveOff) _liveOff(); _liveOff = onValue(ref(db,'quests/'+st.uid+'/'+dk), s=>{
    if(!s.exists() || !_state) return;
    const v = s.val()||{};
    let changed = false;
    _state.defs.forEach(d=>{
      const t = _state.tasks[d.id]; const sv = v[d.id];
      if(sv && (sv.prog !== t.prog || sv.claimed !== t.claimed)){ t.prog = sv.prog||0; t.claimed = !!sv.claimed; changed = true; }
    });
    if(changed) _emit();
  }); }catch(e){}
  return _state;
}

// Olay ilerlemesi — oyunlar bunu çağırır (örn. trackQuest('game_won', {game:'chess'}))
export async function trackQuest(eventType, data){
  data = data || {};
  if(!_state){ try{ await loadQuests(); }catch(e){} }
  if(!_state) return;
  const st = Auth.getState();
  if(!st.uid) return;
  const updates = {};
  for(const d of _state.defs){
    const t = _state.tasks[d.id];
    if(t.claimed || t.prog >= d.goal) continue;
    let inc = 0;
    // Eşleşme mantığı
    if(d.type === eventType){
      if(eventType === 'score_tetris'){ inc = (data.score||0); }       // skor: mutlak ilerleme
      else if(eventType === 'kaju_earned'){ inc = (data.amount||0); }
      else { inc = 1; }
    } else if(d.type === 'play_'+ (data.game||'') && eventType === 'game_played'){
      inc = 1;  // oyuna özel oynama görevleri
    }
    if(inc > 0){
      if(eventType === 'score_tetris'){ t.prog = Math.max(t.prog, data.score||0); }
      else { t.prog = Math.min(d.goal, t.prog + inc); }
      updates[d.id] = { prog: t.prog, claimed: t.claimed };
    }
  }
  if(Object.keys(updates).length){
    _emit();
    try{ await update(ref(db, 'quests/' + st.uid + '/' + _state.dateKey), updates); }catch(e){}
  }
}

// Ödül talep et
export async function claimQuest(taskId){
  if(!_state) return false;
  const st = Auth.getState();
  if(!st.uid) return false;
  const def = _state.defs.find(d=>d.id===taskId);
  const t = _state.tasks[taskId];
  if(!def || !t) return false;
  if(t.claimed || t.prog < def.goal) return false;
  t.claimed = true;
  _emit();
  try{
    await update(ref(db, 'quests/' + st.uid + '/' + _state.dateKey + '/' + taskId), { prog: t.prog, claimed: true });
    await Store.addKaju(def.reward, 'quest', '📋 Görev: ' + def.text);
  }catch(e){ t.claimed = false; _emit(); return false; }
  return def.reward;
}

// Tamamlanan ama talep edilmemiş görev sayısı (rozet için)
export function pendingClaims(){
  if(!_state) return 0;
  let n = 0;
  _state.defs.forEach(d=>{ const t=_state.tasks[d.id]; if(t && !t.claimed && t.prog>=d.goal) n++; });
  return n;
}

// Auth değişince otomatik yükle
Auth.subscribe(()=>{ loadQuests(); });

export default { loadQuests, trackQuest, claimQuest, subscribeQuests, pendingClaims };


// ════════════ GÖREV PANELİ (UI) ════════════
let _qCssDone = false;
function _ensureQuestCSS(){
  if(_qCssDone) return; _qCssDone = true;
  const s = document.createElement('style');
  s.textContent = `
  .quest-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(6,8,18,.82);backdrop-filter:blur(6px);display:flex;align-items:flex-end;justify-content:center;animation:qfade .2s}
  @keyframes qfade{from{opacity:0}to{opacity:1}}
  .quest-panel{width:100%;max-width:460px;max-height:88vh;overflow-y:auto;background:linear-gradient(170deg,#161228,#0c0a16);border-radius:22px 22px 0 0;border:1px solid rgba(192,132,252,.25);border-bottom:none;padding:18px 16px 26px;animation:qslide .26s cubic-bezier(.2,.8,.3,1)}
  @keyframes qslide{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .quest-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px}
  .quest-title{font-size:19px;font-weight:900;color:#e9d5ff;letter-spacing:.3px}
  .quest-x{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#cbd5e1;font-size:18px;cursor:pointer}
  .quest-sub{font-size:11px;color:#9fb0d8;margin-bottom:16px}
  .quest-card{display:flex;align-items:center;gap:12px;padding:13px;border-radius:15px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);margin-bottom:10px;transition:.2s}
  .quest-card.done{border-color:rgba(105,240,174,.4);background:rgba(105,240,174,.06)}
  .quest-ic{font-size:26px;flex-shrink:0;width:40px;text-align:center}
  .quest-info{flex:1;min-width:0}
  .quest-text{font-size:13px;font-weight:800;color:#e8eaf6;margin-bottom:5px}
  .quest-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden}
  .quest-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#a855f7,#7c3aed);transition:width .4s}
  .quest-card.done .quest-fill{background:linear-gradient(90deg,#69F0AE,#34d399)}
  .quest-prog{font-size:9.5px;color:#9fb0d8;margin-top:3px}
  .quest-reward{display:flex;flex-direction:column;align-items:center;gap:3px;flex-shrink:0}
  .quest-rval{font-size:12px;font-weight:900;color:#ffd54f;white-space:nowrap}
  .quest-claim{padding:7px 12px;border-radius:10px;border:none;font-size:11px;font-weight:900;cursor:pointer;font-family:inherit;background:linear-gradient(135deg,#FFD740,#f0a500);color:#1a1208}
  .quest-claim:disabled{opacity:.4;cursor:default}
  .quest-claim.claimed{background:rgba(105,240,174,.2);color:#69F0AE}
  .quest-foot{font-size:10px;color:#7d8ab8;text-align:center;margin-top:10px}
  `;
  document.head.appendChild(s);
}

export async function openQuestsPanel(){
  _ensureQuestCSS();
  const old = document.getElementById('questOv'); if(old) old.remove();
  const ov = document.createElement('div'); ov.id='questOv'; ov.className='quest-ov';
  ov.innerHTML = '<div class="quest-panel"><div class="quest-head"><div class="quest-title">📋 Günlük Görevler</div><button class="quest-x">✕</button></div><div class="quest-sub">Her gün yenilenir · tamamla, ödülünü al!</div><div id="questList">⏳ Yükleniyor…</div><div class="quest-foot">🌙 Gece yarısı yeni görevler gelir</div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('.quest-x').addEventListener('click', ()=>ov.remove());

  const list = ov.querySelector('#questList');
  await loadQuests();
  const render = (s)=>{
    if(!s){ list.innerHTML='<div style="text-align:center;color:#9fb0d8;font-size:12px;padding:20px">Giriş yapman gerekiyor</div>'; return; }
    list.innerHTML='';
    s.defs.forEach(d=>{
      const t = s.tasks[d.id];
      const done = t.prog >= d.goal;
      const pct = Math.min(100, Math.round(t.prog/d.goal*100));
      const card = document.createElement('div');
      card.className = 'quest-card' + (done?' done':'');
      const progTxt = (d.type==='score_tetris'||d.type==='kaju_earned')
        ? (Math.min(t.prog,d.goal)+' / '+d.goal)
        : (Math.min(t.prog,d.goal)+' / '+d.goal);
      card.innerHTML = '<div class="quest-ic">'+d.icon+'</div>'
        + '<div class="quest-info"><div class="quest-text">'+d.text+'</div>'
        + '<div class="quest-bar"><div class="quest-fill" style="width:'+pct+'%"></div></div>'
        + '<div class="quest-prog">'+progTxt+'</div></div>'
        + '<div class="quest-reward"><div class="quest-rval">🥜 '+d.reward+'</div>'
        + (t.claimed
            ? '<button class="quest-claim claimed" disabled>✓ Alındı</button>'
            : '<button class="quest-claim" '+(done?'':'disabled')+' data-claim="'+d.id+'">'+(done?'Ödül Al':'Devam')+'</button>')
        + '</div>';
      list.appendChild(card);
    });
    list.querySelectorAll('[data-claim]').forEach(btn=>btn.addEventListener('click', async ()=>{
      btn.disabled = true; btn.textContent='…';
      const r = await claimQuest(btn.dataset.claim);
      if(r){ try{ if(window.Hero&&window.Hero.toast) window.Hero.toast('🎁 '+r+' Kaju kazandın!'); }catch(e){} }
    }));
  };
  render(_state);
  subscribeQuests(render);
}

// Global erişim (ana sayfadaki "Görevler" butonu çağırır)
try{ window.Hero = window.Hero || {}; window.Hero.openQuests = openQuestsPanel; }catch(e){}
