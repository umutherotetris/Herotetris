// ══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — SEZONLUK LİDERLİK
//  Ayın başında sıfırlanır, sezon şampiyonuna özel rozet.
//  Puan kaynakları: oyun kazanımları, Kaju birimi (1000 Kaju = 1 puan)
// ══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';
import Store from './store.js';

const esc = (s) => String(s==null?'':s).replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt = (n) => Number(n||0).toLocaleString('tr-TR');

let _seasonNum = null;

// ── Sezon numarasını hesapla (yıl*12+ay) ─────────────────────
export function currentSeasonNum(){
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth() + 1;
}
export function seasonLabel(num){
  const year = Math.floor((num-1)/12), month = ((num-1)%12)+1;
  const months = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
  return 'Sezon ' + months[month-1] + ' ' + year;
}
function daysLeft(){
  const now = new Date(), end = new Date(now.getFullYear(), now.getMonth()+1, 0);
  return Math.ceil((end-now)/86400000);
}

// ── Puan güncelle (oyun/mağaza modüllerinden çağrılır) ────────
export async function addSeasonPoints(points){
  const st = Auth.getState(); if(!st.uid || st.status !== 'google') return;
  const sn = 's' + currentSeasonNum();
  try{
    await fdb.runTransaction(fdb.ref(db, 'seasons/' + sn + '/' + st.uid), (cur) => {
      const v = cur || {};
      return { name: st.displayName||'Oyuncu', avatar: (st.profile&&st.profile.avatar)||'👤', level: (st.profile&&st.profile.level)||1, points: ((v.points||0) + points), updatedAt: Date.now() };
    });
  }catch(e){}
}

// ── Profil rozeti: sezon şampiyonu? ───────────────────────────
export async function getSeasonBadge(uid){
  const prev = 's' + (currentSeasonNum()-1);
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'seasons/' + prev), fdb.orderByChild('points'), fdb.limitToLast(1)));
    if(!snap.exists()) return null;
    let winner = null; snap.forEach(ch => { winner = { uid: ch.key, ...ch.val() }; });
    return (winner && winner.uid === uid) ? '👑 Sezon Şampiyonu' : null;
  }catch(e){ return null; }
}

// ── Ekran ─────────────────────────────────────────────────────
export async function openSeason(){
  if(document.getElementById('seasonPanel')) return;
  const sn = currentSeasonNum();
  _seasonNum = sn;
  const ov = document.createElement('div');
  ov.id = 'seasonPanel'; ov.className = 'clan-ov';
  ov.innerHTML = `
    <div class="clan-panel">
      <div class="clan-head">
        <div class="clan-title">👑 ${esc(seasonLabel(sn))}</div>
        <button class="clan-x" id="seasonClose">✕</button>
      </div>
      <div class="clan-body" id="seasonBody">
        <div class="clan-card" id="seasonMyCard">⏳</div>
        <div class="clan-card">
          <div class="clan-lbl">🏆 SEZON LİDERLİĞİ</div>
          <div id="seasonList"><div class="clan-load">Yükleniyor…</div></div>
        </div>
        <div class="clan-card">
          <div class="clan-lbl">📜 GEÇMİŞ SEZONLAR</div>
          <div id="seasonArchive"><div class="clan-load">Yükleniyor…</div></div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('#seasonClose').addEventListener('click', () => ov.remove());
  ov.addEventListener('click', (e) => { if(e.target===ov) ov.remove(); });
  loadSeasonData();
}

async function loadSeasonData(){
  const st = Auth.getState();
  const sKey = 's' + _seasonNum;
  // Kendi puanım
  const myCard = document.getElementById('seasonMyCard'); if(!myCard) return;
  let myPts = 0;
  try{
    const s = await fdb.get(fdb.ref(db, 'seasons/' + sKey + '/' + st.uid));
    if(s.exists()) myPts = (s.val()||{}).points || 0;
  }catch(e){}
  myCard.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:11px;color:#9fb0d8;font-weight:800;letter-spacing:1px">BENİM SEZON PUANIM</div>
        <div style="font-size:26px;font-weight:900;color:#ffd86b">${fmt(myPts)} <span style="font-size:12px">puan</span></div>
      </div>
      <div style="text-align:right">
        <div style="font-size:11px;color:#69F0AE;font-weight:800">${daysLeft()} gün kaldı</div>
        <div style="font-size:10px;color:#6d7aa8">Sezon sonu: ${new Date(new Date().getFullYear(), new Date().getMonth()+1, 0).toLocaleDateString('tr-TR')}</div>
      </div>
    </div>
    <div class="clan-season-bar"><div style="width:${Math.min(100,Math.round((new Date().getDate()/new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate())*100))}%;height:100%;background:linear-gradient(90deg,#ffd86b,#ff9800);border-radius:4px"></div></div>
    <div style="font-size:9.5px;color:#6d7aa8;margin-top:5px">Her 1000 Kaju = 1 Sezon Puanı · Oyun kazanmak: +10 puan</div>`;
  // Liderlik
  const list = document.getElementById('seasonList'); if(!list) return;
  try{
    const snap = await fdb.get(fdb.query(fdb.ref(db, 'seasons/' + sKey), fdb.orderByChild('points'), fdb.limitToLast(20)));
    if(!snap.exists()){ list.innerHTML='<i style="color:#5d6890">Henüz puan yok — oyna kazan!</i>'; }
    else{
      const rows = []; snap.forEach(ch => { rows.push({ uid: ch.key, ...ch.val() }); });
      rows.sort((a,b)=>(b.points||0)-(a.points||0));
      list.innerHTML = rows.map((r,i)=>{
        const me = r.uid === st.uid;
        const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':(i+1)+'.';
        return `<div class="prf-rec${me?' me':''}" data-suid="${esc(r.uid)}" style="cursor:pointer">
          <span>${medal} ${esc(r.avatar||'👤')} ${esc(r.name||'Oyuncu')} <small style="opacity:.6">LV${r.level||1}</small></span>
          <b>⚡ ${fmt(r.points)}</b>
        </div>`;
      }).join('');
      list.querySelectorAll('[data-suid]').forEach(el=>el.addEventListener('click',async()=>{
        try{ const m=await import('./social.js'); m.openPlayerCard(el.dataset.suid); }catch(err){}
      }));
    }
  }catch(e){ list.innerHTML='<i>Okunamadı</i>'; }
  // Geçmiş sezonlar (son 3)
  const arch = document.getElementById('seasonArchive'); if(!arch) return;
  const archRows = [];
  for(let i=1; i<=3; i++){
    const prev = _seasonNum - i;
    if(prev < 1) break;
    try{
      const snap = await fdb.get(fdb.query(fdb.ref(db, 'seasons/s' + prev), fdb.orderByChild('points'), fdb.limitToLast(1)));
      if(snap.exists()){
        let winner = null; snap.forEach(ch => { winner = { uid: ch.key, ...ch.val() }; });
        if(winner) archRows.push({ season: prev, label: seasonLabel(prev), winner });
      }
    }catch(e){}
  }
  arch.innerHTML = archRows.length
    ? archRows.map(a=>`<div class="clan-res"><div>🏆 ${esc(a.label)}</div><div style="font-size:11px;color:#ffd86b">👑 ${esc(a.winner.avatar||'👤')} ${esc(a.winner.name)} · ${fmt(a.winner.points)} puan</div></div>`).join('')
    : '<i style="color:#5d6890">Henüz geçmiş sezon yok</i>';
}

export default openSeason;
