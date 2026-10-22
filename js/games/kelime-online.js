// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Çevrimiçi (Firebase)
//  Rastgele eşleşme kuyruğu + oda durumu senkronizasyonu.
//  Gizlilik: harf rafları DB'de TUTULMAZ. İki istemci paylaşılan
//  tohumdan (seed) AYNI torbayı üretir; her oyuncu yalnız kendi
//  taşlarını paylaşılan bagPointer'a göre çeker.
//  bagReturns, değiştirilen taşların ortak torbaya dönüş sırasıdır.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from '../auth.js';

const QPATH = 'kelimeQueue/waiting';   // tek slotlu bekleme kuyruğu
const GPATH = 'kelimeGames';           // oyun odaları
const FRESH_MS = 45000;                // bu süreden eski kuyruk kaydı bayat

let S = null;  // aktif çevrimiçi oturum durumu
let requestEpoch = 0;  // canceled async work must not recreate a session

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
const MYGAMES = 'kelimeMyGames';   // kullanıcı başına aktif async oyun indeksi

export async function findMatch(cb, opts){
  const epoch = ++requestEpoch;
  opts = opts || {};
  const async = opts.mode === 'async';
  const turnHours = opts.turnHours || 72;
  const lang = (opts.lang === 'en') ? 'en' : 'tr';   // dil ayrımı: aynı dil eşleşir
  const langSfx = '_' + lang;
  const QP = (async ? ('kelimeQueue/async' + turnHours) : QPATH) + langSfx;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  const myUid = st.uid, myName = st.displayName || 'Oyuncu';
  cb.onSearching && cb.onSearching();

  // Host olursam kullanacağım oda kimliği
  const myGameId = fdb.push(fdb.ref(db, GPATH)).key;
  const seed = rid();
  const session = S = { gameId:myGameId, role:'A', roomRef:fdb.ref(db, `${GPATH}/${myGameId}`), myUid, waiting:true, async, turnHours:async?turnHours:0, queuePath:QP };
  const active = () => epoch === requestEpoch && S === session;
  const now0 = Date.now();
  const baseRoom = {
    seed, boardStr: emptyBoardStr(),
    scores: { A:0, B:0 }, turn:'A', bagPointer:14,
    players:{ A:myUid }, names:{ A:myName },
    presence:{ A:true }, status:'waiting',
    passStreak:0, createdAt: now0, lang
  };
  if(async){ baseRoom.mode='async'; baseRoom.turnHours=turnHours; baseRoom.deadline = now0 + turnHours*3600000; baseRoom.lastMoveAt = now0; }

  // Host adayı odayı ÖNCE kur
  try{
    await fdb.set(session.roomRef, baseRoom);
    if(!active()){ await fdb.remove(session.roomRef).catch(()=>{}); return; }
  }catch(e){
    if(!active()) return;
    const denied = String(e && e.message||e).includes('PERMISSION_DENIED');
    cb.onError && cb.onError(denied ? 'Sunucu izni reddedildi. Çevrimiçi için Firebase kuralları güncellenmeli (yönetici).' : 'Sunucuya bağlanılamadı.');
    return;
  }

  // Kuyruk işlemi
  let claimed = null;
  let res;
  try{
    res = await fdb.runTransaction(fdb.ref(db, QP), (cur) => {
      const now = Date.now();
      const fresh = async ? (turnHours*3600000) : FRESH_MS;
      if(cur && cur.uid && cur.uid !== myUid && (now - (cur.ts||0)) < fresh){
        claimed = cur;
        return null;
      }
      claimed = null;
      return { uid:myUid, name:myName, ts:now, gameId:myGameId };
    });
  }catch(e){
    fdb.remove(fdb.ref(db, `${GPATH}/${myGameId}`)).catch(()=>{});
    if(!active()) return;
    cb.onError && cb.onError('Eşleşme kuyruğuna erişilemedi (Firebase kuralları).');
    return;
  }

  if(!active()){
    if(claimed) await fdb.runTransaction(fdb.ref(db,QP),cur=>cur || claimed).catch(()=>{});
    else await clearQueueIfMine(myUid,QP);
    await fdb.remove(session.roomRef).catch(()=>{});
    return;
  }

  if(claimed){
    // ── MİSAFİR (B) ──
    fdb.remove(fdb.ref(db, `${GPATH}/${myGameId}`)).catch(()=>{});
    const gameId = claimed.gameId;
    const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
    const snap = await waitForSeed(roomRef);
    if(!active()){ await fdb.runTransaction(fdb.ref(db,QP),cur=>cur || claimed).catch(()=>{}); return; }
    if(!snap){ cb.onError && cb.onError('Oda bulunamadı, tekrar dene'); return; }
    const room = snap;
    const upd = { 'players/B':myUid, 'names/B':myName, 'presence/B':true, status:'active' };
    await fdb.update(roomRef, upd);
    if(!active()){ await fdb.update(roomRef, {'presence/B':false}).catch(()=>{}); return; }
    const isAsync = room.mode === 'async';
    if(!isAsync){ try{ fdb.onDisconnect(fdb.ref(db, `${GPATH}/${gameId}/presence/B`)).set(false); }catch(e){} }
    // Async VE canlı maçları indeksle (kaldığın yerden devam için)
    await indexBothGames(gameId, myUid, room.players.A, myName, room.names && room.names.A, room.mode || 'live', room.turnHours);
    if(!active()) return;
    Object.assign(session,{gameId, role:'B', roomRef, oppUid:room.players.A, async:isAsync, turnHours:room.turnHours || 0, waiting:false});
    cb.onMatched && cb.onMatched({ role:'B', gameId, oppName: room.names && room.names.A || 'Rakip', oppUid: room.players.A, seed: room.seed, async:isAsync, turnHours:room.turnHours });
  } else {
    // ── HOST (A) ──
    const gameId = myGameId;
    const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
    try{
      if(!async){ fdb.onDisconnect(fdb.ref(db, `${GPATH}/${gameId}/presence/A`)).set(false); }
      fdb.onDisconnect(fdb.ref(db, QP)).remove();
    }catch(e){}
    const off = fdb.onValue(roomRef, (s) => {
      const room = s.val(); if(!room) return;
      if(room.players && room.players.B && active() && session.waiting){
        session.waiting = false; session.oppUid = room.players.B;
        try{ off(); }catch(e){}
        clearQueueIfMine(myUid, QP);
        try{ fdb.onDisconnect(fdb.ref(db,QP)).cancel().catch(()=>{}); }catch(e){}
        indexBothGames(gameId, myUid, room.players.B, myName, room.names && room.names.B, async?'async':'live', turnHours);
        cb.onMatched && cb.onMatched({ role:'A', gameId, oppName: room.names && room.names.B || 'Rakip', oppUid: room.players.B, seed: room.seed, async, turnHours });
      }
    });
    session._offWait = off;
  }
}

// İki oyuncunun da "oyunlarım" indeksine yaz
async function indexBothGames(gameId, uidA, uidB, nameA, nameB, mode, turnHours){
  const ts = Date.now();
  try{ await fdb.update(fdb.ref(db, `${MYGAMES}/${uidA}/${gameId}`), { opp:nameB||'Rakip', oppUid:uidB, mode, turnHours, ts }); }catch(e){}
  try{ await fdb.update(fdb.ref(db, `${MYGAMES}/${uidB}/${gameId}`), { opp:nameA||'Rakip', oppUid:uidA, mode, turnHours, ts }); }catch(e){}
}

// Aktif async oyunlarımı listele
export async function listMyGames(){
  const st = Auth.getState(); if(!st || !st.uid) return [];
  let idx;
  try{ const s = await fdb.get(fdb.ref(db, `${MYGAMES}/${st.uid}`)); idx = s.exists()? s.val() : {}; }
  catch(e){ return []; }
  const out = [];
  for(const gameId in idx){
    try{
      const rs = await fdb.get(fdb.ref(db, `${GPATH}/${gameId}`));
      if(!rs.exists()){ fdb.remove(fdb.ref(db, `${MYGAMES}/${st.uid}/${gameId}`)).catch(()=>{}); continue; }
      const room = rs.val();
      const myRole = room.players && (room.players.A === st.uid ? 'A' : room.players.B === st.uid ? 'B' : null);
      if(!myRole) continue;
      const over = room.status === 'over';
      // Bitmiş maçları indeksten temizle (listede gösterme)
      if(over){ fdb.remove(fdb.ref(db, `${MYGAMES}/${st.uid}/${gameId}`)).catch(()=>{}); continue; }
      // Henüz rakip bağlanmamış (B yok) → atla
      if(!room.players || !room.players.B){ continue; }
      const mode = idx[gameId].mode || room.mode || 'live';
      out.push({
        gameId, opp: idx[gameId].opp, myRole,
        myTurn: room.turn === myRole,
        deadline: room.deadline || 0, turnHours: room.turnHours || idx[gameId].turnHours,
        scores: room.scores || {A:0,B:0}, over, status: room.status,
        mode, lang: room.lang || 'tr',
        ts: idx[gameId].ts || 0
      });
    }catch(e){}
  }
  out.sort((a,b)=> (b.myTurn-a.myTurn) || ((b.deadline||0)-(a.deadline||0)) );
  return out;
}

// Bir async oyunu sürdür
export async function resumeGame(gameId, cb){
  const epoch = ++requestEpoch;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
  let room; try{ const s = await fdb.get(roomRef); if(!s.exists()){ cb.onError && cb.onError('Oyun bulunamadı'); return; } room = s.val(); }
  catch(e){ cb.onError && cb.onError('Oyun yüklenemedi'); return; }
  if(epoch !== requestEpoch) return;
  const role = room.players && (room.players.A === st.uid ? 'A' : room.players.B === st.uid ? 'B' : null);
  if(!role){ cb.onError && cb.onError('Bu oyunun oyuncusu değilsin'); return; }
  if(room.status === 'over'){ cb.onError && cb.onError('Bu oyun sona ermiş'); return; }
  const oppUid = role==='A' ? (room.players.B) : (room.players.A);
  const isAsync = room.mode === 'async';
  S = { gameId, role, roomRef, myUid: st.uid, oppUid, async:isAsync, turnHours:room.turnHours || 0 };
  // Canlı maç: presence'ı geri kur (geri döndüm) + disconnect izle
  if(!isAsync){
    try{ await fdb.update(roomRef, { ['presence/'+role]: true }); }catch(e){}
    try{ fdb.onDisconnect(fdb.ref(db, `${GPATH}/${gameId}/presence/${role}`)).set(false); }catch(e){}
  }
  cb.onResumed && cb.onResumed({
    role, gameId,
    oppName: (room.names && room.names[role==='A'?'B':'A']) || 'Rakip',
    oppUid, seed: room.seed, room, async:isAsync,
    turnHours: room.turnHours || 0, lang: room.lang || 'tr'
  });
}

// Rakibin süresi dolduysa galibiyet talep et
export async function claimTimeout(gameId, cb){
  const st = Auth.getState(); if(!st || !st.uid){ cb && cb.onError && cb.onError('Giriş gerekli'); return; }
  const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
  try{
    let error = 'Oyun bulunamadı';
    const result = await fdb.runTransaction(roomRef, room => {
      if(!room || !room.players) return;
      const myRole = room.players.A === st.uid ? 'A' : room.players.B === st.uid ? 'B' : null;
      if(!myRole){ error='Bu oyunun oyuncusu değilsin'; return; }
      if(room.status !== 'active' || room.mode !== 'async'){ error='Bu oyun için süre galibiyeti alınamaz'; return; }
      if(room.turn === myRole){ error='Sıra sende, süre dolmadı'; return; }
      if(!room.deadline || Date.now() < room.deadline){ error='Rakibin süresi henüz dolmadı'; return; }
      return { ...room, status:'over', overMsg:'Hamle süresi doldu', winnerByTimeout:myRole };
    });
    if(!result.committed){ cb && cb.onError && cb.onError(error); return; }
    cb && cb.onDone && cb.onDone();
  }catch(e){ cb && cb.onError && cb.onError('İşlem başarısız'); }
}

function waitForSeed(roomRef){
  return new Promise((resolve) => {
    let done = false, off = null, timer = null;
    const finish = value => {
      if(done) return;
      done = true;
      if(timer !== null) clearTimeout(timer);
      try{ if(off) off(); }catch(e){}
      resolve(value);
    };
    off = fdb.onValue(roomRef, s => { const room=s.val(); if(room && room.seed != null) finish(room); });
    if(done){ try{ off(); }catch(e){} }
    else timer = setTimeout(()=>finish(null),8000);
  });
}

async function clearQueueIfMine(myUid, qp){
  try{
    await fdb.runTransaction(fdb.ref(db, qp || QPATH), (cur) => {
      if(cur && cur.uid === myUid) return null;
      return cur;
    });
  }catch(e){}
}

// Arama iptali (host beklerken)
export async function cancelSearch(){
  requestEpoch++;
  const session = S;
  if(!session) return;
  S = null;
  try{ if(session._offWait) session._offWait(); }catch(e){}
  try{ await clearQueueIfMine(session.myUid, session.queuePath); }catch(e){}
  if(session.queuePath){ try{ await fdb.onDisconnect(fdb.ref(db,session.queuePath)).cancel(); }catch(e){} }
  if(session.role === 'A' && session.waiting){ try{ await fdb.remove(session.roomRef); }catch(e){} }
}

// Oda durumunu dinle
export function subscribeRoom(onState){
  if(!S) return () => {};
  const session = S;
  try{ if(session._offRoom) session._offRoom(); }catch(e){}
  const off = fdb.onValue(session.roomRef, (s) => { const v = s.val(); if(S===session && v) onState(v); });
  session._offRoom = off;
  return off;
}

// Hamleyi odaya yaz. Async ise deadline + oyunlarım indeksini güncelle.
export async function pushMove(patch){
  const session = S;
  if(!session) return;
  patch = { ...patch };
  if(session.async){
    const ts = Date.now();
    if(session.turnHours && patch.turn) patch.deadline = ts + session.turnHours*3600000;
    patch.lastMoveAt = ts;
    // Update indexes only after the room accepted the move.
    await fdb.update(session.roomRef, patch);
    const jobs = [session.myUid,session.oppUid].filter(Boolean).map(uid =>
      fdb.update(fdb.ref(db, `${MYGAMES}/${uid}/${session.gameId}`), { ts }).catch(()=>{}));
    await Promise.all(jobs);
    return;
  }
  await fdb.update(session.roomRef, patch);
}

// Oyundan ayrıl (async'te presence düşürme — oyun sürer)
export async function leaveRoom(){
  requestEpoch++;
  const session = S;
  if(!session) return;
  S = null;
  try{ if(session._offRoom) session._offRoom(); }catch(e){}
  try{ if(session._offWait) session._offWait(); }catch(e){}
  if(session.waiting){
    if(session.queuePath){
      try{ await clearQueueIfMine(session.myUid,session.queuePath); }catch(e){}
      try{ await fdb.onDisconnect(fdb.ref(db,session.queuePath)).cancel(); }catch(e){}
    }
    if(session.invId && session.targetUid){ try{ await fdb.remove(fdb.ref(db,`${INVPATH}/${session.targetUid}/${session.invId}`)); }catch(e){} }
    if(session.notifRef){try{await fdb.remove(session.notifRef);}catch(e){}}
    if(session.role==='A'){ try{ await fdb.remove(session.roomRef); }catch(e){} }
    return;
  }
  if(!session.async){ try{ await fdb.update(session.roomRef, { ['presence/'+session.role]: false }); }catch(e){} }
}

// Maç bitti — her iki oyuncunun MYGAMES indeksinden sil (devam listesinde görünmesin)
export async function markGameOver(){
  const session = S;
  if(!session) return;
  try{ if(session.myUid) await fdb.remove(fdb.ref(db, `${MYGAMES}/${session.myUid}/${session.gameId}`)); }catch(e){}
  try{ if(session.oppUid) await fdb.remove(fdb.ref(db, `${MYGAMES}/${session.oppUid}/${session.gameId}`)); }catch(e){}
  // All awaits stay bound to the room that actually ended.
  try{ await fdb.update(session.roomRef, { status:'over' }); }catch(e){}
}

// Uygulama/sekme öne gelince varlığı (presence) yeniden yaz + onDisconnect'i tazele.
// Kısa süreli arka plana geçişlerde anlık oyunun bitmesini önler.
export async function rejoinPresence(){
  if(!S || S.async || !S.roomRef) return;
  try{
    await fdb.update(S.roomRef, { ['presence/'+S.role]: true, ['lastSeen/'+S.role]: Date.now() });
    try{ fdb.onDisconnect(fdb.ref(db, `${GPATH}/${S.gameId}/presence/${S.role}`)).set(false); }catch(e){}
  }catch(e){}
}

// Kalp atışı: anlık oyunda "buradayım" zaman damgası. Rakip yalnız uzun sessizlikte ayrılmış sayılır.
export async function heartbeat(){
  if(!S || S.async || !S.roomRef) return;
  try{ await fdb.update(S.roomRef, { ['lastSeen/'+S.role]: Date.now() }); }catch(e){}
}

export function getSession(){ return S; }

// Async oyunda rafımı odaya kaydet (sürdürme için)
export async function saveRack(rack){
  if(!S || !S.async) return;
  try{ await fdb.update(S.roomRef, { ['racks/'+S.role]: rack }); }catch(e){}
}

// Kişisel kelime rekorlarını profile yaz (yalnız giriş yapan kullanıcı)
export async function saveKelimeRecords(upd){
  const st = Auth.getState(); if(!st || !st.uid || !upd) return;
  try{ await fdb.update(fdb.ref(db, `users/${st.uid}/kelimeRecords`), upd); }catch(e){}
}

// ════════════ NİCK / ARKADAŞ DAVETİ ════════════
const INVPATH = 'gameInvites';
function permMsg(e){ return String(e&&e.message||e).includes('PERMISSION_DENIED') ? 'Sunucu izni reddedildi (yönetici Firebase kurallarını güncellemeli).' : 'Sunucuya bağlanılamadı.'; }

// Nick → kullanıcı çöz (displayName, sonra name alanına bak)
export async function resolveNick(nick){
  const qv = String(nick||'').trim();
  if(!qv) return null;
  for(const field of ['displayName','name']){
    try{
      const snap = await fdb.get(fdb.query(fdb.ref(db,'users'), fdb.orderByChild(field), fdb.equalTo(qv), fdb.limitToFirst(1)));
      if(snap.exists()){
        let found=null; snap.forEach(ch=>{ const v=ch.val(); found={ uid:ch.key, name:(v.name||v.displayName||qv) }; });
        if(found) return found;
      }
    }catch(e){ /* index/izin yoksa diğer alanı dene */ }
  }
  return null;
}

// Arkadaş listesi (varsa)
export async function listFriends(){
  const st = Auth.getState(); if(!st||!st.uid) return [];
  try{
    const snap = await fdb.get(fdb.ref(db, `friends/${st.uid}`));
    if(!snap.exists()) return [];
    const v = snap.val();
    const fuids = Object.keys(v).filter(fuid => v[fuid] !== false);
    // Her arkadaşın GÜNCEL profilini users/{uid}'den çek (nick + avatar + level)
    const out = await Promise.all(fuids.map(async fuid => {
      const f = v[fuid];
      let name = (f && f.name) || (typeof f === 'string' ? f : null);
      let avatar = '🧑', level = 1;
      try{
        const uSnap = await fdb.get(fdb.ref(db, 'users/' + fuid));
        if(uSnap.exists()){
          const u = uSnap.val() || {};
          name = u.nick || u.name || u.displayName || name || 'Oyuncu';
          avatar = u.avatar || avatar;
          level = u.level || 1;
        }
      }catch(e){}
      return { uid: fuid, name: name || 'Oyuncu', avatar, level };
    }));
    return out;
  }catch(e){ return []; }
}

// Davet gönder (hedef uid'e). cb: { onSent(), onAccepted({role,gameId,oppName,seed}), onError(msg) }
export async function sendInvite(targetUid, targetName, cb, opts={}){
  const epoch=++requestEpoch;
  const st = await ensureAuth();
  if(epoch!==requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  if(targetUid === st.uid){ cb.onError && cb.onError('Kendine davet gönderemezsin'); return; }
  const myUid = st.uid, myName = st.displayName || 'Oyuncu';
  const gameId = fdb.push(fdb.ref(db, GPATH)).key;
  const seed = rid();
  const lang=opts.lang==='en'?'en':'tr';
  const roomRef=fdb.ref(db,`${GPATH}/${gameId}`);
  const session=S={gameId,role:'A',roomRef,myUid,waiting:true,targetUid};
  const active=()=>epoch===requestEpoch && S===session;
  try{
    await fdb.set(roomRef, {
      seed, boardStr: emptyBoardStr(), scores:{A:0,B:0}, turn:'A', bagPointer:14,
      players:{A:myUid}, names:{A:myName}, presence:{A:true}, status:'invited',
      passStreak:0, createdAt:Date.now(), invited:targetUid, lang
    });
    if(!active()){await fdb.remove(roomRef).catch(()=>{});return;}
  }catch(e){ if(active()){S=null;cb.onError && cb.onError(permMsg(e));} return; }
  const invId = fdb.push(fdb.ref(db, `${INVPATH}/${targetUid}`)).key;
  session.invId=invId;
  try{
    await fdb.set(fdb.ref(db, `${INVPATH}/${targetUid}/${invId}`), {
      fromUid:myUid, fromName:myName, game:'kelime', gameId, seed, lang, ts:Date.now()
    });
    if(!active()){await fdb.remove(fdb.ref(db,`${INVPATH}/${targetUid}/${invId}`)).catch(()=>{});await fdb.remove(roomRef).catch(()=>{});return;}
  }catch(e){ fdb.remove(roomRef).catch(()=>{}); if(active()){S=null;cb.onError && cb.onError(permMsg(e));} return; }
  // Bildirim gerçek davet kaydına bağlanır; kabul yolu aynı oda ve dili kullanır.
  try{
    session.notifRef=fdb.push(fdb.ref(db,`userNotifs/${targetUid}`));
    await fdb.set(session.notifRef,{
      type:'challenge',icon:'⚔️',text:myName+' seni '+(lang==='en'?'Wordie':'Kelimecik')+' oynamaya davet ediyor!',
      fromUid:myUid,fromName:myName,game:'kelime',gameId,gameInviteId:invId,lang,ts:Date.now(),expiresAt:Date.now()+300000
    });
    if(!active()){await fdb.remove(session.notifRef).catch(()=>{});return;}
  }catch(e){} // Oyun içindeki gelen davet listesi bildirim izni olmadan da çalışır.
  if(!active()) return;
  try{ fdb.onDisconnect(fdb.ref(db,`${GPATH}/${gameId}/presence/A`)).set(false); }catch(e){}
  cb.onSent && cb.onSent({gameId,inviteId:invId,lang});
  const off = fdb.onValue(roomRef, (s)=>{
    const room = s.val(); if(!room) return;
    if(room.players && room.players.B && active() && session.waiting){
      session.waiting=false;session.oppUid=room.players.B;try{off();}catch(e){}
      fdb.remove(fdb.ref(db, `${INVPATH}/${targetUid}/${invId}`)).catch(()=>{});
      cb.onAccepted && cb.onAccepted({ role:'A', gameId, oppName: room.names && room.names.B || targetName || 'Rakip', oppUid:room.players.B, seed: room.seed, lang:room.lang||lang });
    }
  });
  session._offWait = off;
}

// Gelen davetleri dinle. cb(list) → [{id, fromUid, fromName, gameId, seed, ts}]
export function listenInvites(cb){
  const st = Auth.getState();
  if(!st || !st.uid){ cb([]); return ()=>{}; }
  const r = fdb.ref(db, `${INVPATH}/${st.uid}`);
  const off = fdb.onValue(r, (s)=>{
    const v = s.val()||{}; const list=[];
    for(const id in v){ const inv=v[id]; if(inv && inv.game==='kelime' && inv.gameId) list.push({ id, ...inv }); }
    list.sort((a,b)=>(b.ts||0)-(a.ts||0));
    cb(list);
  });
  return off;
}

// Daveti kabul et. cb: { onMatched({role,gameId,oppName,seed}), onError(msg) }
export async function acceptInvite(invite, cb){
  const epoch=++requestEpoch;
  const st = await ensureAuth();
  if(epoch!==requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  const myUid=st.uid, myName=st.displayName||'Oyuncu';
  const roomRef = fdb.ref(db, `${GPATH}/${invite.gameId}`);
  const snap = await waitForSeed(roomRef);
  if(epoch!==requestEpoch) return;
  if(!snap){ cb.onError && cb.onError('Oda bulunamadı (davet süresi dolmuş olabilir)'); fdb.remove(fdb.ref(db,`${INVPATH}/${myUid}/${invite.id}`)).catch(()=>{}); return; }
  const accepted=await fdb.runTransaction(roomRef,room=>{
    if(epoch!==requestEpoch || !room || room.status!=='invited' || room.invited!==myUid || (room.players?.B && room.players.B!==myUid)) return;
    return {...room,players:{...room.players,B:myUid},names:{...room.names,B:myName},presence:{...room.presence,B:true},status:'active'};
  });
  if(epoch!==requestEpoch) return;
  if(!accepted.committed){cb.onError && cb.onError('Davet artık geçerli değil veya başka bir oyuncuya ait.');return;}
  const room=accepted.snapshot.val();
  try{ fdb.onDisconnect(fdb.ref(db,`${GPATH}/${invite.gameId}/presence/B`)).set(false); }catch(e){}
  fdb.remove(fdb.ref(db,`${INVPATH}/${myUid}/${invite.id}`)).catch(()=>{});
  S = { gameId:invite.gameId, role:'B', roomRef, myUid,oppUid:room.players.A };
  cb.onMatched && cb.onMatched({ role:'B', gameId:invite.gameId, oppName: room.names && room.names.A || invite.fromName || 'Rakip', oppUid:room.players.A, seed: room.seed, lang:room.lang||'tr' });
}

export async function declineInvite(invite){
  const st = Auth.getState(); if(!st||!st.uid) return;
  try{ await fdb.remove(fdb.ref(db,`${INVPATH}/${st.uid}/${invite.id}`)); }catch(e){}
}

// Gönderilen daveti iptal et (host bekliyorken)
export async function cancelInvite(){
  requestEpoch++;
  const session=S;if(!session)return;S=null;
  try{ if(session._offWait) session._offWait(); }catch(e){}
  if(session.invId && session.targetUid){ try{ await fdb.remove(fdb.ref(db,`${INVPATH}/${session.targetUid}/${session.invId}`)); }catch(e){} }
  if(session.notifRef){try{await fdb.remove(session.notifRef);}catch(e){}}
  if(session.role==='A' && session.waiting){ try{ await fdb.remove(session.roomRef); }catch(e){} }
}
