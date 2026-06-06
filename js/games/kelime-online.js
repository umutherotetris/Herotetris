// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Çevrimiçi (Firebase)
//  Rastgele eşleşme kuyruğu + oda durumu senkronizasyonu.
//  Gizlilik: harf rafları DB'de TUTULMAZ. İki istemci paylaşılan
//  tohumdan (seed) AYNI torbayı üretir; her oyuncu yalnız kendi
//  taşlarını paylaşılan bagPointer'a göre çeker.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from '../auth.js';

const QPATH = 'kelimeQueue/waiting';   // tek slotlu bekleme kuyruğu
const GPATH = 'kelimeGames';           // oyun odaları
const FRESH_MS = 45000;                // bu süreden eski kuyruk kaydı bayat

let S = null;  // aktif çevrimiçi oturum durumu

function rid(){ return Math.floor(Math.random() * 0x7fffffff); }

async function ensureAuth(){
  const st = Auth.getState();
  if(st && st.uid) return st;
  // hazır olmasını bekle
  if(Auth.ready){ try{ await Auth.ready; }catch(e){} }
  return Auth.getState();
}

function emptyBoardStr(){
  const b = Array.from({length:15}, () => Array(15).fill(null));
  return JSON.stringify(b);
}

// ── Rastgele rakip bul ──
// cb: { onSearching(), onMatched({role,gameId,oppName,seed}), onError(msg) }
export async function findMatch(cb){
  const st = await ensureAuth();
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  const myUid = st.uid, myName = st.displayName || 'Oyuncu';
  cb.onSearching && cb.onSearching();

  // Host olursam kullanacağım oda kimliği
  const myGameId = fdb.push(fdb.ref(db, GPATH)).key;
  const seed = rid();

  // Host adayı odayı ÖNCE kur (bir rakip kuyruğa bakınca hazır olsun)
  try{
    await fdb.set(fdb.ref(db, `${GPATH}/${myGameId}`), {
      seed, boardStr: emptyBoardStr(),
      scores: { A:0, B:0 }, turn:'A', bagPointer:14,
      players:{ A:myUid }, names:{ A:myName },
      presence:{ A:true }, status:'waiting',
      passStreak:0, createdAt: Date.now()
    });
  }catch(e){
    const denied = String(e && e.message||e).includes('PERMISSION_DENIED');
    cb.onError && cb.onError(denied ? 'Sunucu izni reddedildi. Çevrimiçi için Firebase kuralları güncellenmeli (yönetici).' : 'Sunucuya bağlanılamadı.');
    return;
  }

  // Kuyruk işlemi: bekleyen taze rakip varsa kap (ben misafir/B); yoksa beklerim (ben host/A)
  let claimed = null;
  let res;
  try{
    res = await fdb.runTransaction(fdb.ref(db, QPATH), (cur) => {
      const now = Date.now();
      if(cur && cur.uid && cur.uid !== myUid && (now - (cur.ts||0)) < FRESH_MS){
        claimed = cur;            // bu rakibi kapıyorum
        return null;              // slotu boşalt
      }
      claimed = null;
      return { uid:myUid, name:myName, ts:now, gameId:myGameId };  // ben bekliyorum
    });
  }catch(e){
    fdb.remove(fdb.ref(db, `${GPATH}/${myGameId}`)).catch(()=>{});
    cb.onError && cb.onError('Eşleşme kuyruğuna erişilemedi (Firebase kuralları).');
    return;
  }

  if(claimed){
    // ── MİSAFİR (B) ── kendi boş odamı sil, rakibin odasına katıl
    fdb.remove(fdb.ref(db, `${GPATH}/${myGameId}`)).catch(()=>{});
    const gameId = claimed.gameId;
    const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
    // odanın hazır (seed'li) olmasını bekle
    const snap = await waitForSeed(roomRef);
    if(!snap){ cb.onError && cb.onError('Oda bulunamadı, tekrar dene'); return; }
    const room = snap;
    await fdb.update(roomRef, { 'players/B':myUid, 'names/B':myName, 'presence/B':true, status:'active' });
    // bağlantı kopması izi
    try{ fdb.onDisconnect(fdb.ref(db, `${GPATH}/${gameId}/presence/B`)).set(false); }catch(e){}
    S = { gameId, role:'B', roomRef, myUid };
    cb.onMatched && cb.onMatched({ role:'B', gameId, oppName: room.names && room.names.A || 'Rakip', seed: room.seed });
  } else {
    // ── HOST (A) ── kuyrukta bekliyorum; rakip katılınca başlayacağım
    const gameId = myGameId;
    const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
    try{
      fdb.onDisconnect(fdb.ref(db, `${GPATH}/${gameId}/presence/A`)).set(false);
      fdb.onDisconnect(fdb.ref(db, QPATH)).remove();   // beklerken kopar/çıkarsam kuyruğu temizle
    }catch(e){}
    S = { gameId, role:'A', roomRef, myUid, waiting:true };
    // rakip B katılana kadar dinle
    const off = fdb.onValue(roomRef, (s) => {
      const room = s.val(); if(!room) return;
      if(room.players && room.players.B && S && S.waiting){
        S.waiting = false;
        try{ off(); }catch(e){}
        // kuyruktan kendimi kaldır (hâlâ benimse)
        clearQueueIfMine(myUid);
        cb.onMatched && cb.onMatched({ role:'A', gameId, oppName: room.names && room.names.B || 'Rakip', seed: room.seed });
      }
    });
    S._offWait = off;
  }
}

function waitForSeed(roomRef){
  return new Promise((resolve) => {
    let done = false;
    const off = fdb.onValue(roomRef, (s) => {
      const v = s.val();
      if(v && v.seed != null && !done){ done = true; try{ off(); }catch(e){} resolve(v); }
    });
    setTimeout(() => { if(!done){ done = true; try{ off(); }catch(e){} resolve(null); } }, 8000);
  });
}

async function clearQueueIfMine(myUid){
  try{
    await fdb.runTransaction(fdb.ref(db, QPATH), (cur) => {
      if(cur && cur.uid === myUid) return null;   // benim kaydım → sil
      return cur;                                  // başkasınınki → dokunma
    });
  }catch(e){}
}

// Arama iptali (host beklerken)
export async function cancelSearch(){
  if(!S) return;
  try{ if(S._offWait) S._offWait(); }catch(e){}
  try{ await clearQueueIfMine(S.myUid); }catch(e){}
  if(S.role === 'A' && S.waiting){ try{ await fdb.remove(S.roomRef); }catch(e){} }
  S = null;
}

// Oda durumunu dinle
export function subscribeRoom(onState){
  if(!S) return () => {};
  const off = fdb.onValue(S.roomRef, (s) => { const v = s.val(); if(v) onState(v); });
  S._offRoom = off;
  return off;
}

// Hamleyi odaya yaz (board + skor + sıra + pointer + lastMove)
export async function pushMove(patch){
  if(!S) return;
  await fdb.update(S.roomRef, patch);
}

// Oyundan ayrıl
export async function leaveRoom(){
  if(!S) return;
  try{ if(S._offRoom) S._offRoom(); }catch(e){}
  try{ await fdb.update(S.roomRef, { ['presence/'+S.role]: false }); }catch(e){}
  S = null;
}

export function getSession(){ return S; }
