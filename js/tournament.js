// ═══════════════════════════════════════════════════════════════
//  TURNUVA SİSTEMİ — Hero Oyun Portalı
//  Haftalık bireysel turnuva: oyun oynadıkça puan topla,
//  hafta sonunda sıralamaya göre Kaju ödülü kazan.
//  Firebase: tournaments/{weekId}/scores/{uid} = {name, pts, ts}
//            tournaments/{weekId}/meta = {start, end, claimed:{uid:true}}
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import { Store } from './store.js';

function _toast(msg, isErr){
  try{ if(window.Hero && window.Hero.toast){ window.Hero.toast(msg, !!isErr); return; } }catch(e){}
  try{ const t=document.createElement('div'); t.textContent=msg; t.style.cssText='position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483640;background:'+(isErr?'rgba(200,50,50,.95)':'rgba(20,28,50,.95)')+';color:#fff;padding:12px 20px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 8px 30px rgba(0,0,0,.5);max-width:88vw;text-align:center'; document.body.appendChild(t); setTimeout(()=>{t.style.transition='opacity .3s';t.style.opacity='0';setTimeout(()=>t.remove(),300);},2600); }catch(e){}
}
const esc=(s)=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n)=>(Number.isFinite(Number(n))?Number(n):0).toLocaleString('tr-TR');

// ── Hafta kimliği (ISO hafta: yıl + hafta no) ──
function weekId(d){
  d = d ? new Date(d) : new Date();
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);       // perşembeye taşı (ISO)
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(),0,1));
  const wk = Math.ceil((((dt - yearStart)/86400000)+1)/7);
  return dt.getUTCFullYear()+'-W'+String(wk).padStart(2,'0');
}
// Bu haftanın bitişi (pazar 23:59) + başlangıcı (pazartesi 00:00)
function weekBounds(){
  const now = new Date();
  const day = now.getDay() || 7;                  // pazartesi=1..pazar=7
  const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate()-(day-1));
  const sunday = new Date(monday); sunday.setDate(monday.getDate()+6); sunday.setHours(23,59,59,999);
  return { start: monday.getTime(), end: sunday.getTime() };
}
function _prevWeekId(){
  const d = new Date(); d.setDate(d.getDate()-7); return weekId(d);
}

// Ödül basamakları (sıraya göre)
const PRIZES = [
  { rank:1, kaju:5000, icon:'🥇' },
  { rank:2, kaju:3000, icon:'🥈' },
  { rank:3, kaju:2000, icon:'🥉' },
  { rank:4, kaju:1000, icon:'🏅', upTo:5 },     // 4-5
  { rank:6, kaju:500,  icon:'🎖️', upTo:10 },    // 6-10
];
function prizeForRank(rank){
  if(rank===1) return 5000;
  if(rank===2) return 3000;
  if(rank===3) return 2000;
  if(rank<=5) return 1000;
  if(rank<=10) return 500;
  if(rank<=25) return 200;
  return 0;
}

// ── Turnuva puanı ekle (oyunlar/store çağırır) ──
// Her maç sonu: oyun bittiğinde puan. Galibiyet daha çok puan.
export async function addTournamentPoints(pts, reason){
  const st = Auth.getState();
  if(!st.uid || !pts) return;
  const wk = weekId();
  const name = st.displayName || (st.profile && st.profile.nick) || 'Oyuncu';
  try{
    await fdb.runTransaction(fdb.ref(db, 'tournaments/'+wk+'/scores/'+st.uid+'/pts'), c => (c||0) + pts);
    await fdb.update(fdb.ref(db, 'tournaments/'+wk+'/scores/'+st.uid), { name, ts: Date.now() });
  }catch(e){ console.warn('[tournament] addPoints', e); }
}

// ── Sıralamayı çek ──
async function fetchLeaderboard(wk){
  try{
    const snap = await fdb.get(fdb.ref(db, 'tournaments/'+wk+'/scores'));
    if(!snap.exists()) return [];
    const v = snap.val() || {};
    const arr = Object.keys(v).map(uid => ({ uid, name: v[uid].name||'Oyuncu', pts: v[uid].pts||0 }));
    arr.sort((a,b)=> b.pts - a.pts);
    return arr;
  }catch(e){ return []; }
}

// ── Geçen haftanın ödülünü talep et ──
async function claimPrize(){
  const st = Auth.getState();
  if(!st.uid) return;
  const pwk = _prevWeekId();
  // Zaten alındı mı?
  try{
    const cl = await fdb.get(fdb.ref(db, 'tournaments/'+pwk+'/meta/claimed/'+st.uid));
    if(cl.exists() && cl.val()) { _toast('Bu haftanın ödülünü zaten aldın'); return; }
  }catch(e){}
  const lb = await fetchLeaderboard(pwk);
  const rank = lb.findIndex(x=>x.uid===st.uid) + 1;
  if(rank === 0){ _toast('Geçen hafta turnuvaya katılmadın'); return; }
  const prize = prizeForRank(rank);
  if(prize <= 0){ _toast('Geçen hafta ödül sıralamasına giremedin (ilk 25)'); return; }
  try{
    await fdb.set(fdb.ref(db, 'tournaments/'+pwk+'/meta/claimed/'+st.uid), true);
    await Store.addKaju(prize, 'tournament', '🏆 Turnuva ödülü (#'+rank+')');
    _toast('🏆 '+rank+'. oldun! '+fmt(prize)+' Kaju kazandın!');
    // İlk 3 → Sosyal Duvar'a yaz
    try{
      if(rank <= 3){
        const medal = rank===1?'🥇':rank===2?'🥈':'🥉';
        await fdb.push(fdb.ref(db, 'achWall'), {
          uid: st.uid, userName: st.displayName||'Oyuncu',
          achId: 'trn_'+pwk+'_'+rank, achName: medal+' Haftalık turnuvada '+rank+'. oldu!',
          icon: medal, isAdmin:false, ts: Date.now()
        });
      }
    }catch(e){}
    if(window.Hero && window.Hero.openTournament) setTimeout(()=>openTournament(), 600);
  }catch(e){ _toast('Ödül alınamadı', true); }
}

// Geçen hafta ödül hak edildi mi (rozet için)
export async function hasPendingPrize(){
  const st = Auth.getState();
  if(!st.uid) return false;
  const pwk = _prevWeekId();
  try{
    const cl = await fdb.get(fdb.ref(db, 'tournaments/'+pwk+'/meta/claimed/'+st.uid));
    if(cl.exists() && cl.val()) return false;
    const lb = await fetchLeaderboard(pwk);
    const rank = lb.findIndex(x=>x.uid===st.uid) + 1;
    return rank > 0 && prizeForRank(rank) > 0;
  }catch(e){ return false; }
}

// ── UI ──
let _tCss=false;
function _ensureCss(){
  if(_tCss) return; _tCss=true;
  const s=document.createElement('style');
  s.textContent=`
  .trn-ov{position:fixed;inset:0;z-index:2147483600;background:rgba(6,8,18,.85);backdrop-filter:blur(7px);display:flex;align-items:flex-end;justify-content:center;animation:trnf .2s}
  @keyframes trnf{from{opacity:0}to{opacity:1}}
  .trn-panel{width:100%;max-width:470px;max-height:90vh;overflow-y:auto;background:linear-gradient(175deg,#1a1330,#0b0a16);border-radius:22px 22px 0 0;border:1px solid rgba(255,215,64,.22);border-bottom:none;padding:18px 16px 26px;animation:trns .26s cubic-bezier(.2,.8,.3,1)}
  @keyframes trns{from{transform:translateY(100%)}to{transform:translateY(0)}}
  .trn-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:3px}
  .trn-title{font-size:19px;font-weight:900;color:#ffe082;letter-spacing:.3px}
  .trn-x{width:34px;height:34px;border-radius:50%;border:none;background:rgba(255,255,255,.08);color:#cbd5e1;font-size:18px;cursor:pointer}
  .trn-timer{font-size:11px;color:#9fb0d8;margin-bottom:14px}
  .trn-timer b{color:#ffd54f}
  .trn-claim{width:100%;padding:13px;border-radius:14px;border:none;cursor:pointer;font-size:14px;font-weight:900;font-family:inherit;color:#1a1208;background:linear-gradient(135deg,#FFD740,#f0a500);box-shadow:0 4px 16px rgba(240,165,0,.35);margin-bottom:14px;letter-spacing:.3px;animation:trnpulse 1.8s ease-in-out infinite}
  @keyframes trnpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
  .trn-me{display:flex;align-items:center;gap:10px;padding:12px;border-radius:14px;background:linear-gradient(135deg,rgba(255,215,64,.13),rgba(255,215,64,.04));border:1px solid rgba(255,215,64,.3);margin-bottom:14px}
  .trn-me-rank{font-size:24px;font-weight:900;color:#ffe082;min-width:46px;text-align:center}
  .trn-me-info{flex:1}
  .trn-me-lbl{font-size:10px;color:#9fb0d8}
  .trn-me-pts{font-size:15px;font-weight:900;color:#fff}
  .trn-sect{font-size:12px;font-weight:800;color:#bba8df;margin:6px 2px 9px;letter-spacing:.4px}
  .trn-row{display:flex;align-items:center;gap:11px;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.035);margin-bottom:7px;border:1px solid transparent}
  .trn-row.mine{border-color:rgba(105,240,174,.4);background:rgba(105,240,174,.06)}
  .trn-rank{font-size:14px;font-weight:900;min-width:34px;text-align:center;color:#cbd5e1}
  .trn-rank.top{color:#ffd54f;font-size:17px}
  .trn-nm{flex:1;font-size:13px;font-weight:700;color:#e8eaf6;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .trn-pts{font-size:13px;font-weight:900;color:#a5b4fc}
  .trn-prize{font-size:10px;color:#ffd54f;font-weight:800;margin-left:6px}
  .trn-empty{text-align:center;color:#9fb0d8;font-size:12px;padding:24px}
  .trn-info{font-size:10.5px;color:#7d8ab8;line-height:1.6;background:rgba(255,255,255,.03);border-radius:11px;padding:11px 12px;margin-top:12px}
  `;
  document.head.appendChild(s);
}

function _fmtRemain(ms){
  if(ms<=0) return 'bitti';
  const d=Math.floor(ms/86400000), h=Math.floor(ms%86400000/3600000), m=Math.floor(ms%3600000/60000);
  if(d>0) return d+' gün '+h+' saat';
  if(h>0) return h+' saat '+m+' dk';
  return m+' dk';
}

export async function openTournament(){
  _ensureCss();
  const old=document.getElementById('trnOv'); if(old) old.remove();
  const ov=document.createElement('div'); ov.id='trnOv'; ov.className='trn-ov';
  ov.innerHTML='<div class="trn-panel"><div class="trn-head"><div class="trn-title">🏆 Haftalık Turnuva</div><button class="trn-x">✕</button></div><div class="trn-timer" id="trnTimer">⏳ Yükleniyor…</div><div id="trnBody"><div class="trn-empty">⏳ Sıralama yükleniyor…</div></div></div>';
  document.body.appendChild(ov);
  ov.addEventListener('click',e=>{ if(e.target===ov) ov.remove(); });
  ov.querySelector('.trn-x').addEventListener('click',()=>ov.remove());

  const bounds = weekBounds();
  const timerEl = ov.querySelector('#trnTimer');
  const tick=()=>{ if(!document.body.contains(ov)) return; timerEl.innerHTML='Bu hafta bitmesine: <b>'+_fmtRemain(bounds.end-Date.now())+'</b>'; };
  tick(); const ti=setInterval(tick, 30000);

  const body=ov.querySelector('#trnBody');
  const st=Auth.getState();
  const wk=weekId();
  const lb=await fetchLeaderboard(wk);
  const myRank=lb.findIndex(x=>x.uid===st.uid)+1;
  const myPts=(lb.find(x=>x.uid===st.uid)||{}).pts||0;

  // Geçen hafta ödül var mı
  const pending = await hasPendingPrize();

  let html='';
  if(pending){
    html += '<button class="trn-claim" id="trnClaim">🎁 Geçen haftanın ödülünü al!</button>';
  }
  // Benim durumum
  html += '<div class="trn-me"><div class="trn-me-rank">'+(myRank>0?'#'+myRank:'—')+'</div>'
    + '<div class="trn-me-info"><div class="trn-me-lbl">Senin sıralaman</div><div class="trn-me-pts">'+fmt(myPts)+' puan'+(myRank>0&&prizeForRank(myRank)>0?' · 🏆 '+fmt(prizeForRank(myRank))+' Kaju bölgesinde':'')+'</div></div></div>';

  html += '<div class="trn-sect">🏅 SIRALAMA — İlk 25 ödül kazanır</div>';
  if(!lb.length){
    html += '<div class="trn-empty">Bu hafta henüz kimse puan toplamadı.<br>Oyun oyna, ilk sen ol! 🎮</div>';
  } else {
    lb.slice(0,25).forEach((p,i)=>{
      const rank=i+1; const prize=prizeForRank(rank);
      const topCls=rank<=3?' top':'';
      const medal=rank===1?'🥇':rank===2?'🥈':rank===3?'🥉':'#'+rank;
      html += '<div class="trn-row'+(p.uid===st.uid?' mine':'')+'">'
        + '<div class="trn-rank'+topCls+'">'+medal+'</div>'
        + '<div class="trn-nm">'+esc(p.name)+'</div>'
        + '<div class="trn-pts">'+fmt(p.pts)+'</div>'
        + (prize>0?'<div class="trn-prize">🥜'+fmt(prize)+'</div>':'')
        + '</div>';
    });
  }
  html += '<div class="trn-info">📋 <b>Nasıl puan toplanır?</b><br>• Her maç: +10 puan<br>• Galibiyet: +25 puan (ekstra)<br>• Tetris/Kelimecik yüksek skor: bonus puan<br><br>🗓️ Turnuva her pazartesi sıfırlanır. Hafta sonunda ilk 25 oyuncu Kaju kazanır. Ödülünü ertesi hafta bu ekrandan al!</div>';

  body.innerHTML=html;
  const cb=body.querySelector('#trnClaim');
  if(cb) cb.addEventListener('click', ()=>{ cb.disabled=true; cb.textContent='…'; claimPrize(); });
}

// Global erişim
try{ window.Hero=window.Hero||{}; window.Hero.openTournament=openTournament; }catch(e){}

export default { openTournament, addTournamentPoints, hasPendingPrize };
