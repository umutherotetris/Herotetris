// ════════════════════════════════════════════════════════════════
//  KELİME DÜELLOSU — Çevrimiçi (Firebase)
//  Rastgele eşleşme kuyruğu + oda durumu senkronizasyonu.
//  Gizlilik: canlı maç rafları yalnız oyuncunun cihazında saklanır.
//  Süreli maçlar sürdürmek için rafı da kaydeder. İki istemci paylaşılan
//  tohumdan (seed) AYNI torbayı üretir; her oyuncu yalnız kendi
//  taşlarını paylaşılan bagPointer'a göre çeker.
//  bagReturns, değiştirilen taşların ortak torbaya dönüş sırasıdır.
// ════════════════════════════════════════════════════════════════
import { Auth, db, fdb } from '../auth.js';

const QPATH = 'kelimeQueue/waiting';   // tek slotlu bekleme kuyruğu
const GPATH = 'kelimeGames';           // oyun odaları
const FRESH_MS = 45000;                // bu süreden eski kuyruk kaydı bayat
const INVITE_TTL = 300000;             // canlı davetler portalda ve oyunda aynı beş dakika

let S = null;  // aktif çevrimiçi oturum durumu
let requestEpoch = 0;  // canceled async work must not recreate a session
const rackCache = new Map(); // Live racks stay on the player's own device.
const currentSession = session => !!session && S === session && Auth.getState()?.uid === session.myUid;
const ownsRequest = (epoch, uid) => epoch === requestEpoch && Auth.getState()?.uid === uid;
const roomVersion = room => JSON.stringify([room?.status,room?.turn,room?.lastActions?.A,room?.lastActions?.B,room?.lastMove?.who,room?.lastMove?.ts,room?.bagPointer,room?.passStreak,room?.drawOffer,room?.deadline]);
function stopListeners(session){
  for(const key of ['_offRoom','_offWait','_offConnection','_stopSeed']){
    try{ session[key]?.(); }catch(e){}
    session[key]=null;
  }
  if(session._leaseTimer!=null){ clearInterval(session._leaseTimer);session._leaseTimer=null; }
  if(session._inviteTimer!=null){ clearTimeout(session._inviteTimer);session._inviteTimer=null; }
  const disconnect=session._presenceDisconnect;
  session._presenceDisconnect=null;
  try{ Promise.resolve(disconnect?.cancel()).catch(()=>{}); }catch(e){}
}
function watchConnection(session){
  if(!currentSession(session) || session._offConnection) return;
  session._offConnection=fdb.onValue(fdb.ref(db,'.info/connected'),snapshot=>{
    const connected=snapshot.val();
    if(!currentSession(session) || typeof connected!=='boolean' || session.connected===connected) return;
    session.connected=connected;
    if(!connected)session._presenceDisconnect=null;
    session._connectionListener?.(connected);
    if(connected && session._presenceReady && !session.async) void rejoinPresence();
  });
}
export function subscribeConnection(listener){
  const session=S;
  if(!currentSession(session)) return () => {};
  session._connectionListener=listener;
  if(typeof session.connected==='boolean') listener(session.connected);
  return () => { if(session._connectionListener===listener)session._connectionListener=null; };
}
function observeWait(session, onRoom, onError){
  let off=null, stopped=false;
  const stop=()=>{stopped=true;off?.();};
  session._offWait=stop;
  off=fdb.onValue(session.roomRef,s=>{
    if(currentSession(session) && !stopped && s.val()) onRoom(s.val());
  },error=>{ if(currentSession(session) && !stopped)onError(error); });
  if(stopped)off();
}
function rackKey(session){ return `hero_kelime_rack:${session.myUid}:${session.gameId}`; }
function rackKeyForPending(session){ return rackKey(session)+':pending'; }
function rememberRack(session, rack, action=session.rackAction){
  if(!Array.isArray(rack)) return;
  const saved={seed:session.seed,action,rack:rack.map(t=>({letter:t.letter,points:t.points,joker:!!t.joker}))};
  rackCache.set(rackKey(session),saved);
  try{ localStorage.setItem(rackKey(session),JSON.stringify(saved)); }catch(e){}
}
function recoverRack(session){
  const required=session.rackAction;
  if(required){
    try{
      const pending=JSON.parse(localStorage.getItem(rackKeyForPending(session)));
      if(pending?.seed===session.seed && pending.action===required && Array.isArray(pending.rack)){
        rememberRack(session,pending.rack,required);
        localStorage.removeItem(rackKeyForPending(session));
      }
    }catch(e){}
  }
  let saved=rackCache.get(rackKey(session));
  if(!saved){ try{ saved=JSON.parse(localStorage.getItem(rackKey(session))); }catch(e){} }
  if(!saved || saved.seed!==session.seed || (saved.action??null)!==(required??null) || !Array.isArray(saved.rack) || saved.rack.length>100) return null;
  if(saved.rack.some(t=>!t || typeof t.letter!=='string' || !Number.isFinite(t.points) || typeof t.joker!=='boolean')) return null;
  return saved.rack.map(t=>({...t}));
}

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

export async function findMatch(cb, opts={}){
  if(S) void leaveRoom();
  const epoch = ++requestEpoch;
  const async = opts.mode === 'async';
  const turnHours = opts.turnHours === 12 ? 12 : 72;
  const lang = opts.lang === 'en' ? 'en' : 'tr';
  const QP = (async ? ('kelimeQueue/async' + turnHours) : QPATH) + '_' + lang;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st?.uid){ cb.onError?.('Önce giriş yapmalısın'); return; }
  if(!ownsRequest(epoch,st.uid)) return;
  const myUid = st.uid, myName = st.displayName || 'Oyuncu';
  cb.onSearching?.();

  const myGameId = fdb.push(fdb.ref(db, GPATH)).key;
  const seed = rid();
  const session = S = { gameId:myGameId, role:'A', roomRef:fdb.ref(db, `${GPATH}/${myGameId}`), myUid, seed, waiting:true, async, turnHours:async?turnHours:0, queuePath:QP };
  session._connectionListener=cb.onConnection;
  watchConnection(session);
  const active = () => ownsRequest(epoch,myUid) && S === session;
  const report = message => {
    if(!active()) return;
    void leaveRoom();
    cb.onError?.(message);
  };
  const now0 = Date.now();
  const baseRoom = {
    seed, boardStr: emptyBoardStr(), scores: { A:0, B:0 }, turn:'A', bagPointer:14,
    players:{ A:myUid }, names:{ A:myName }, presence:{ A:true }, status:'waiting',
    passStreak:0, createdAt:now0, lang
  };
  if(async){ baseRoom.mode='async'; baseRoom.turnHours=turnHours; }

  try{
    await fdb.set(session.roomRef, baseRoom);
    if(!active()){
      if(Auth.getState()?.uid===myUid) await removeWaitingRoom(session);
      return;
    }
  }catch(e){ report(permMsg(e));return; }

  const freshMs=async ? turnHours*3600000 : FRESH_MS;
  const queueRef=fdb.ref(db,QP);
  let claimed=null;
  try{
    const result=await fdb.runTransaction(queueRef,cur=>{
      if(!active()) return;
      const now=Date.now(),age=now-cur?.ts;
      if(cur?.uid && cur.uid!==myUid && cur.gameId && age>=0 && age<freshMs){
        claimed=cur;
        return null;
      }
      claimed=null;
      return {uid:myUid,name:myName,ts:now,gameId:myGameId};
    },{applyLocally:false});
    if(!result.committed || !active()){
      if(Auth.getState()?.uid===myUid){
        await clearQueueIfMine(myUid,QP,myGameId);
        await removeWaitingRoom(session);
      }
      return;
    }
  }catch(e){ report('Eşleşme kuyruğuna erişilemedi. Bağlantını kontrol edip yeniden dene.');return; }

  if(claimed){
    // A canceled guest returns only the same, still-open offer to an empty slot.
    void removeWaitingRoom(session);
    const gameId = claimed.gameId, roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
    const restoreOffer=async()=>{
      if(Auth.getState()?.uid!==myUid)return;
      try{
        const room=(await fdb.get(roomRef)).val();
        if(room?.status!=='waiting' || room.players?.A!==claimed.uid || room.players?.B)return;
        await fdb.runTransaction(queueRef,offer=>{
          const age=Date.now()-claimed.ts;
          if(Auth.getState()?.uid===myUid && !offer && age>=0 && age<freshMs)return claimed;
        },{applyLocally:false});
      }catch(e){}
    };
    const found = await waitForSeed(roomRef,session);
    if(!active()){void restoreOffer();return;}
    if(!found){void restoreOffer();report('Oda bulunamadı, tekrar dene');return;}
    let joined;
    try{
      joined=await fdb.runTransaction(roomRef,room=>{
        if(!active() || !room || room.players?.A!==claimed.uid || room.players.B || room.status!=='waiting') return;
        if((room.lang || 'tr')!==lang || (room.mode==='async')!==async) return;
        const now=Date.now();
        return {...room,players:{...room.players,B:myUid},names:{...room.names,B:myName},
          presence:{...room.presence,B:true},status:'active',...(async?{deadline:now+turnHours*3600000,lastMoveAt:now}:{})};
      },{applyLocally:false});
    }catch(e){ void restoreOffer();report('Odaya katılınamadı. Tekrar dene.');return; }
    if(!joined.committed){void restoreOffer();report('Rakip aramayı bitirdi, yeniden eşleşmeyi dene.');return;}
    const room=joined.snapshot.val(),isAsync=room.mode==='async';
    if(Auth.getState()?.uid!==myUid) return;
    // These writes preserve a confirmed match even if the waiting view closed.
    void indexBothGames(gameId,myUid,room.players.A,myName,room.names?.A,room.mode||'live',room.turnHours,myUid);
    if(!active()){
      if(!isAsync && !(S?.gameId===gameId && S?.myUid===myUid)) await fdb.update(roomRef,{'presence/B':false}).catch(()=>{});
      return;
    }
    Object.assign(session,{gameId,role:'B',roomRef,seed:room.seed,oppUid:room.players.A,async:isAsync,turnHours:room.turnHours||0,waiting:false,version:roomVersion(room),rackAction:room.rackActions?.B,_presenceReady:true});
    if(!isAsync)void rejoinPresence();
    cb.onMatched?.({role:'B',gameId,oppName:room.names?.A||'Rakip',oppUid:room.players.A,seed:room.seed,room,lang,async:isAsync,turnHours:room.turnHours});
    return;
  }

  session._presenceReady=true;
  if(!async && session.connected!==false)void rejoinPresence();
  if(!async){
    session._leaseTimer=setInterval(async()=>{
      if(!active() || !session.waiting || session.connected===false || session._renewing) return;
      session._renewing=true;
      try{
        const result=await fdb.runTransaction(queueRef,cur=>{
          if(!active() || !session.waiting || cur?.uid!==myUid || cur.gameId!==myGameId) return;
          return {...cur,ts:Date.now()};
        },{applyLocally:false});
        if(active() && session.waiting && !result.committed && result.snapshot?.val?.() && result.snapshot.val().gameId!==myGameId){
          // A next search can occupy the slot while this room is being joined.
          // Verify the room before treating a replaced lease as a failed search.
          const snap=await fdb.get(session.roomRef);
          if(active() && session.waiting && !snap.val()?.players?.B) report('Arama sırası değişti. Yeniden eşleşmeyi dene.');
        }
      }catch(e){ /* A fresh connection can renew this room again. */ }
      finally{session._renewing=false;}
    },12000);
    session._leaseTimer?.unref?.();
  }
  observeWait(session,room=>{
    if(!room.players?.B || room.status!=='active' || !session.waiting) return;
    session.waiting=false;session.oppUid=room.players.B;session.version=roomVersion(room);session.rackAction=room.rackActions?.A;
    session._offWait?.();
    if(session._leaseTimer!=null){clearInterval(session._leaseTimer);session._leaseTimer=null;}
    void clearQueueIfMine(myUid,QP,myGameId);
    void indexBothGames(myGameId,myUid,room.players.B,myName,room.names?.B,async?'async':'live',turnHours,myUid);
    cb.onMatched?.({role:'A',gameId:myGameId,oppName:room.names?.B||'Rakip',oppUid:room.players.B,seed:room.seed,room,lang,async,turnHours});
  },()=>report('Oda durumu okunamadı. Bağlantını kontrol edip yeniden dene.'));
}

// İki oyuncunun da "oyunlarım" indeksine yaz
async function indexBothGames(gameId, uidA, uidB, nameA, nameB, mode, turnHours, expectedUid){
  const ts = Date.now();
  turnHours=mode==='async' ? (turnHours===12?12:72) : 0;
  try{ await fdb.update(fdb.ref(db, `${MYGAMES}/${uidA}/${gameId}`), { opp:nameB||'Rakip', oppUid:uidB, mode, turnHours, ts }); }catch(e){}
  try{ await fdb.update(fdb.ref(db, `${MYGAMES}/${uidB}/${gameId}`), { opp:nameA||'Rakip', oppUid:uidA, mode, turnHours, ts }); }catch(e){}
}

// Aktif async oyunlarımı listele
export async function listMyGames(){
  const st = Auth.getState(); if(!st || !st.uid) return [];
  const current=()=>Auth.getState()?.uid===st.uid;
  let idx;
  try{ const s = await fdb.get(fdb.ref(db, `${MYGAMES}/${st.uid}`)); idx = s.exists()? s.val() : {}; }
  catch(e){ return []; }
  const out = [];
  for(const gameId in idx){
    if(!current()) return [];
    try{
      const rs = await fdb.get(fdb.ref(db, `${GPATH}/${gameId}`));
      if(!current()) return [];
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
  if(S) void leaveRoom();
  const epoch = ++requestEpoch;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  const active=()=>ownsRequest(epoch,st.uid);
  if(!active()) return;
  const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
  let room;
  try{ room=(await fdb.get(roomRef)).val(); }
  catch(e){ if(active()) cb.onError?.('Oyun yüklenemedi');return; }
  if(!active()) return;
  if(!room){ cb.onError?.('Oyun bulunamadı');return; }
  const role = room.players && (room.players.A === st.uid ? 'A' : room.players.B === st.uid ? 'B' : null);
  if(!role){ cb.onError && cb.onError('Bu oyunun oyuncusu değilsin'); return; }
  if(room.status !== 'active' || !room.players.B){ cb.onError?.('Bu oyun artık devam ettirilemiyor');return; }
  const oppUid = role==='A' ? (room.players.B) : (room.players.A);
  const isAsync = room.mode === 'async';
  const session = { gameId, role, roomRef, myUid:st.uid, seed:room.seed, oppUid, async:isAsync, turnHours:room.turnHours || 0, version:roomVersion(room),rackAction:room.rackActions?.[role] };
  if(!isAsync && !(room.racks && Array.isArray(room.racks[role]))){
    const rack=recoverRack(session);
    if(rack) room.racks={...room.racks,[role]:rack};
    else if(session.rackAction || (room.bagPointer!=null && room.bagPointer!==14) || (room.bagReturns && room.bagReturns.length) || (room.lastMove && !room.lastMove.pass)){
      cb.onError && cb.onError('Bu canlı oyunun harfleri bu cihazda kayıtlı değil. Maçı oynadığın cihazdan devam et.'); return;
    }
  }
  S = session;
  watchConnection(session);
  // Canlı maç: presence'ı geri kur (geri döndüm) + disconnect izle
  if(!isAsync){
    try{ await fdb.update(roomRef, { ['presence/'+role]: true }); }catch(e){}
    if(!active() || !currentSession(session)){
      if(Auth.getState()?.uid===st.uid && !(S?.gameId===gameId && S?.myUid===st.uid)) await fdb.update(roomRef,{['presence/'+role]:false}).catch(()=>{});
      return;
    }
    session._presenceReady=true;
    armPresenceDisconnect(session);
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
      if(Auth.getState()?.uid!==st.uid || !room || !room.players) return;
      const myRole = room.players.A === st.uid ? 'A' : room.players.B === st.uid ? 'B' : null;
      if(!myRole){ error='Bu oyunun oyuncusu değilsin'; return; }
      if(room.status !== 'active' || room.mode !== 'async'){ error='Bu oyun için süre galibiyeti alınamaz'; return; }
      if(room.turn === myRole){ error='Sıra sende, süre dolmadı'; return; }
      if(!room.deadline || Date.now() < room.deadline){ error='Rakibin süresi henüz dolmadı'; return; }
      return { ...room, status:'over', overMsg:'Hamle süresi doldu', winnerByTimeout:myRole };
    },{applyLocally:false});
    if(Auth.getState()?.uid!==st.uid) return;
    if(!result.committed){ cb && cb.onError && cb.onError(error); return; }
    cb && cb.onDone && cb.onDone();
  }catch(e){ if(Auth.getState()?.uid===st.uid)cb?.onError?.('İşlem başarısız'); }
}

function waitForSeed(roomRef,session){
  return new Promise((resolve) => {
    let done = false, off = null, timer = null;
    const finish = value => {
      if(done) return;
      done = true;
      if(timer !== null) clearTimeout(timer);
      try{ if(off) off(); }catch(e){}
      resolve(value);
    };
    if(session)session._stopSeed=()=>finish(null);
    off = fdb.onValue(roomRef, s => { const room=s.val(); if(room && room.seed != null) finish(room); },()=>finish(null));
    if(done){ try{ off(); }catch(e){} }
    else timer = setTimeout(()=>finish(null),8000);
  });
}

async function clearQueueIfMine(myUid, qp, gameId){
  if(!qp || Auth.getState()?.uid!==myUid)return;
  try{
    await fdb.runTransaction(fdb.ref(db, qp),cur=>{
      if(Auth.getState()?.uid===myUid && cur?.uid===myUid && cur.gameId===gameId) return null;
    },{applyLocally:false});
  }catch(e){}
}

// Arama iptali (host beklerken)
export async function cancelSearch(){
  return leaveRoom();
}

// Oda durumunu dinle
export function subscribeRoom(onState,onError){
  if(!currentSession(S)) return () => {};
  const session = S;
  try{ if(session._offRoom) session._offRoom(); }catch(e){}
  const off = fdb.onValue(session.roomRef,s=>{
    if(!currentSession(session))return;
    const room=s.val();
    if(!room || room.players?.[session.role]!==session.myUid){onError?.('Maç kaydı artık okunamıyor.');return;}
    session.version=roomVersion(room);
    if(room.status==='over')session._finishedConfirmed=true;
    onState(room,true);
  },()=>{if(currentSession(session))onError?.('Oda bağlantısının izni doğrulanamadı.');});
  session._offRoom = off;
  return off;
}

// Moves, resignations and draw replies share one conditional server commit.
// Presence snapshots do not invalidate a move, but a newer turn or outcome does.
const MOVE_FIELDS=new Set(['boardStr','scores','turn','bagPointer','bagReturns','passStreak','lastMove','status','overMsg','resignedBy','drawOffer','draw']);
let moveSerial=0;
export async function pushMove(patch){
  const session=S;
  if(!currentSession(session) || session.waiting || session.connected===false || session._committing) throw new Error('Çevrimiçi oturum artık geçerli değil');
  const rackKey='racks/'+session.role, rack=patch[rackKey];
  const fields=Object.fromEntries(Object.entries(patch).filter(([key,value])=>MOVE_FIELDS.has(key)&&value!==undefined));
  const expected=session.version, opponent=session.role==='A'?'B':'A';
  const operation=Date.now().toString(36)+'-'+rid().toString(36)+'-'+(++moveSerial).toString(36);
  if(!Object.keys(fields).length)throw new Error('Oyun işlemi geçersiz');
  session._committing=true;
  if(!session.async && Array.isArray(rack)){
    try{localStorage.setItem(rackKeyForPending(session),JSON.stringify({seed:session.seed,action:operation,rack}));}catch(e){}
  }
  let confirmed;
  try{
    const commit=()=>fdb.runTransaction(session.roomRef,room=>{
      if(!currentSession(session) || !room || room.status!=='active' || room.players?.[session.role]!==session.myUid || !room.players?.[opponent])return;
      if(expected!==roomVersion(room))return;
      if(fields.turn!==undefined && (room.turn!==session.role || fields.turn!==opponent))return;
      if(fields.resignedBy!==undefined && fields.resignedBy!==session.role)return;
      if(fields.draw && room.drawOffer!==opponent)return;
      if(fields.drawOffer===null && fields.status!=='over' && room.drawOffer!==opponent)return;
      if(fields.drawOffer && (fields.drawOffer!==session.role || room.drawOffer===opponent))return;
      if(fields.status!==undefined && fields.status!=='over')return;
      const next={...room,lastActions:{...room.lastActions,[session.role]:operation}};
      for(const [key,value] of Object.entries(fields)){if(value===null)delete next[key];else next[key]=value;}
      if(session.async){
        if(Array.isArray(rack))next.racks={...room.racks,[session.role]:rack};
        if(fields.turn){next.lastMoveAt=Date.now();next.deadline=next.lastMoveAt+session.turnHours*3600000;}
      }
      if(Array.isArray(rack))next.rackActions={...room.rackActions,[session.role]:operation};
      return next;
    },{applyLocally:false});
    try{
      let result=await commit();
      // A cold RTDB transaction can start with null before the room is cached.
      if(!result.committed && !result.snapshot?.val?.() && currentSession(session)){
        const fresh=(await fdb.get(session.roomRef)).val();
        if(fresh && expected===roomVersion(fresh) && currentSession(session))result=await commit();
      }
      if(result.committed)confirmed=result.snapshot.val();
    }catch(error){
      if(!currentSession(session) || session.connected===false)throw error;
      // A dropped acknowledgment is only accepted when the actual room names
      // this exact operation, not just when its visible score happens to match.
      const room=(await fdb.get(session.roomRef)).val();
      if(room?.lastActions?.[session.role]!==operation)throw error;
      confirmed=room;
    }
    if(!confirmed)throw new Error('Oda durumu değişti');
    if(Array.isArray(rack)){
      session.rackAction=operation;
      rememberRack(session,rack,operation);
      try{localStorage.removeItem(rackKeyForPending(session));}catch(e){}
    }
    // Do not regress a version already observed from the opponent.
    if(currentSession(session) && session.version===expected)session.version=roomVersion(confirmed);
    if(!currentSession(session))throw new Error('Çevrimiçi oturum artık geçerli değil');
  }finally{session._committing=false;}
}

// Oyundan ayrıl (async'te presence düşürme — oyun sürer)
export async function leaveRoom(){
  requestEpoch++;
  const session=S;
  if(!session)return;
  S=null;
  stopListeners(session);
  if(Auth.getState()?.uid!==session.myUid)return;
  if(session.waiting){
    const jobs=[];
    if(session.queuePath)jobs.push(clearQueueIfMine(session.myUid,session.queuePath,session.gameId));
    if(session.invId && session.targetUid)jobs.push(fdb.remove(fdb.ref(db,`${INVPATH}/${session.targetUid}/${session.invId}`)).catch(()=>{}));
    if(session.notifRef)jobs.push(fdb.remove(session.notifRef).catch(()=>{}));
    if(session.role==='A')jobs.push(removeWaitingRoom(session));
    await Promise.all(jobs);
    return;
  }
  if(!session.async && session.connected!==false){try{await fdb.update(session.roomRef,{['presence/'+session.role]:false});}catch(e){}}
}

// Clean indexes after a confirmed result; never write a result from cleanup.
export async function markGameOver(){
  const session=S;
  if(!currentSession(session))return;
  try{
    const room=(await fdb.get(session.roomRef)).val();
    if(Auth.getState()?.uid!==session.myUid || room?.status!=='over' || room.players?.[session.role]!==session.myUid)return;
    session._finishedConfirmed=true;
    await fdb.remove(fdb.ref(db,`${MYGAMES}/${session.myUid}/${session.gameId}`));
  }catch(e){}
  if(Auth.getState()?.uid!==session.myUid)return;
  // The other participant can clean their own index even if cross-user writes
  // are denied; listMyGames also excludes finished rooms.
  try{
    if(session.oppUid && session._finishedConfirmed)await fdb.remove(fdb.ref(db,`${MYGAMES}/${session.oppUid}/${session.gameId}`));
  }catch(e){}
}

function armPresenceDisconnect(session){
  if(!currentSession(session) || session.async || session.connected===false || session._presenceDisconnect)return;
  try{
    const handle=fdb.onDisconnect(fdb.ref(db,`${GPATH}/${session.gameId}/presence/${session.role}`));
    session._presenceDisconnect=handle;
    Promise.resolve(handle.set(false)).catch(()=>{if(session._presenceDisconnect===handle)session._presenceDisconnect=null;});
  }catch(e){}
}

// RTDB connection events also run without a visibility change (Wi-Fi/mobile handoff).
export async function rejoinPresence(){
  const session=S;
  if(!currentSession(session) || session.async || session.connected===false)return;
  armPresenceDisconnect(session);
  try{await fdb.update(session.roomRef,{['presence/'+session.role]:true,['lastSeen/'+session.role]:Date.now()});}catch(e){}
}

export async function heartbeat(){
  const session=S;
  if(!currentSession(session) || session.async || session.connected===false || session._beating)return;
  session._beating=true;
  try{await fdb.update(session.roomRef,{['lastSeen/'+session.role]:Date.now()});}catch(e){}
  finally{session._beating=false;}
}

export function getSession(){return S;}

// The initial rack is deterministic. Save it locally only; online turns persist
// the updated async rack in the same transaction as board/score/turn.
export async function saveRack(rack){
  if(currentSession(S))rememberRack(S,rack);
}

// Kişisel kelime rekorlarını profile yaz (yalnız giriş yapan kullanıcı)
export async function saveKelimeRecords(upd, expectedUid){
  const uid = expectedUid || Auth.getState()?.uid;
  if(!uid || Auth.getState()?.uid!==uid || !upd) return {ok:false,reason:'identity'};
  const word = value => typeof value==='string' && /^[A-ZÇĞİÖŞÜ]{2,15}$/i.test(value) ? value : null;
  const bestWord=word(upd.bestWord), longestWord=word(upd.longestWord);
  const best=bestWord && Number.isSafeInteger(upd.bestScore) && upd.bestScore>0 && upd.bestScore<=100000;
  const longest=longestWord && Number.isSafeInteger(upd.longestLen) && upd.longestLen===Array.from(longestWord).length;
  if(!best && !longest) return {ok:false,reason:'invalid'};
  try{
    // Compare on the server: another tab/device may already hold a better record.
    const result=await fdb.runTransaction(fdb.ref(db, `users/${uid}/kelimeRecords`), previous=>{
      if(Auth.getState()?.uid!==uid) return;
      const next={...(previous && typeof previous==='object' ? previous : {})};
      let changed=false;
      if(best && upd.bestScore>(Number(next.bestScore)||0)){next.bestWord=bestWord;next.bestScore=upd.bestScore;changed=true;}
      if(longest && upd.longestLen>(Number(next.longestLen)||0)){next.longestWord=longestWord;next.longestLen=upd.longestLen;changed=true;}
      return changed ? next : undefined;
    },{applyLocally:false});
    if(Auth.getState()?.uid!==uid) return {ok:false,reason:'identity'};
    return {ok:true,records:result.snapshot?.val?.() || {},changed:!!result.committed};
  }catch(e){ return {ok:false,reason:'unavailable'}; }
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
export async function sendInvite(targetUid, targetName, cb, opts){
  if(S) void leaveRoom();
  const epoch = ++requestEpoch;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  if(!ownsRequest(epoch,st.uid))return;
  if(targetUid === st.uid){ cb.onError && cb.onError('Kendine davet gönderemezsin'); return; }
  const myUid = st.uid, myName = st.displayName || 'Oyuncu';
  const lang = opts && opts.lang === 'en' ? 'en' : 'tr';
  const gameId = fdb.push(fdb.ref(db, GPATH)).key;
  const roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
  const invId = fdb.push(fdb.ref(db, `${INVPATH}/${targetUid}`)).key;
  const inviteRef = fdb.ref(db, `${INVPATH}/${targetUid}/${invId}`);
  const seed = rid();
  const createdAt=Date.now(),expiresAt=createdAt+INVITE_TTL;
  const session = S = { gameId, role:'A', roomRef, myUid, seed, waiting:true, invId, targetUid };
  const active = () => ownsRequest(epoch,myUid) && S === session;
  const clean = async () => {
    if(Auth.getState()?.uid!==myUid)return;
    if(session.notifRef) await fdb.remove(session.notifRef).catch(()=>{});
    await fdb.remove(inviteRef).catch(()=>{});
    await removeWaitingRoom(session);
  };
  try{
    await fdb.set(roomRef, {
      seed, boardStr: emptyBoardStr(), scores:{A:0,B:0}, turn:'A', bagPointer:14,
      players:{A:myUid}, names:{A:myName}, presence:{A:true}, status:'invited',
      passStreak:0, createdAt, expiresAt, invited:targetUid, lang
    });
    if(!active()){ await clean(); return; }
    await fdb.set(inviteRef, { fromUid:myUid, fromName:myName, game:'kelime', gameId, seed, ts:createdAt, expiresAt, lang });
    if(!active()){ await clean(); return; }
  }catch(e){
    await clean();
    if(active()){ S=null; cb.onError && cb.onError(permMsg(e)); }
    return;
  }
  // Portal notifications point at the real native invitation, never a fabricated room code.
  try{
    const notifId=fdb.push(fdb.ref(db,`userNotifs/${targetUid}`)).key;
    session.notifRef=fdb.ref(db,`userNotifs/${targetUid}/${notifId}`);
    await fdb.set(session.notifRef,{
      type:'challenge',icon:'⚔️',text:myName+' seni '+(lang==='en'?'Wordie':'Kelimecik')+' oynamaya davet ediyor!',
      fromUid:myUid,fromName:myName,game:'kelime',gameId,gameInviteId:invId,lang,ts:createdAt,expiresAt
    });
    if(!active()){ await clean(); return; }
  }catch(e){} // Native incoming invites work even if notifications are not permitted.
  if(!active()){ await clean(); return; }
  session._presenceReady=true;watchConnection(session);armPresenceDisconnect(session);
  cb.onSent && cb.onSent({gameId,inviteId:invId,lang});
  if(!active())return;
  const expired=()=>{
    if(!active() || !session.waiting)return;
    void leaveRoom();
    cb.onError?.('Davet süresi doldu. Yeniden davet gönderebilirsin.');
  };
  if(typeof setTimeout==='function'){
    session._inviteTimer=setTimeout(expired,Math.max(0,expiresAt-Date.now()));
    session._inviteTimer?.unref?.();
  }
  observeWait(session,room=>{
    if(room.players?.B===targetUid && room.status==='active' && active() && session.waiting){
      session.waiting=false; session.oppUid=room.players.B;
      session.version=roomVersion(room);session.rackAction=room.rackActions?.A;
      if(session._inviteTimer!=null){clearTimeout(session._inviteTimer);session._inviteTimer=null;}
      try{ session._offWait && session._offWait(); }catch(e){}
      fdb.remove(inviteRef).catch(()=>{});
      void indexBothGames(gameId,myUid,room.players.B,myName,room.names?.B,'live',0,myUid);
      cb.onAccepted?.({role:'A',gameId,oppName:room.names?.B||targetName||'Rakip',oppUid:room.players.B,seed:room.seed,lang:room.lang||'tr',room});
    }
  },()=>{if(active()){void leaveRoom();cb.onError?.('Davet durumu okunamadı. Yeniden dene.');}});
}

// Remove only an unclaimed room. An acceptance racing cancellation must stay resumable.
async function removeWaitingRoom(session){
  if(Auth.getState()?.uid!==session.myUid)return;
  try{
    const result = await fdb.runTransaction(session.roomRef, room => {
      if(Auth.getState()?.uid!==session.myUid)return;
      if(!room || (room.players && room.players.B)) return;
      if(room.players && room.players.A === session.myUid && (room.status==='waiting' || room.status==='invited')) return null;
    },{applyLocally:false});
    if(!result.committed && result.snapshot?.val?.()?.players?.B && Auth.getState()?.uid===session.myUid && S?.gameId!==session.gameId){
      await fdb.update(session.roomRef, { ['presence/'+session.role]:false });
    }
  }catch(e){}
}

// Gelen davetleri dinle. cb(list) → [{id, fromUid, fromName, gameId, seed, ts}]
export function listenInvites(cb){
  const st = Auth.getState();
  if(!st || !st.uid){ cb([]); return ()=>{}; }
  const r = fdb.ref(db, `${INVPATH}/${st.uid}`);
  const off = fdb.onValue(r, (s)=>{
    if(Auth.getState()?.uid!==st.uid)return;
    const v = s.val()||{}; const list=[];
    for(const id in v){
      const inv=v[id],now=Date.now();
      if(inv && inv.game==='kelime' && inv.gameId && Number.isFinite(inv.ts) && inv.ts<=now && now<inv.ts+INVITE_TTL && (!Number.isFinite(inv.expiresAt) || now<inv.expiresAt)) list.push({ id, ...inv });
    }
    list.sort((a,b)=>(b.ts||0)-(a.ts||0));
    cb(list);
  });
  return off;
}

// Daveti kabul et. cb: { onMatched({role,gameId,oppName,seed}), onError(msg) }
export async function acceptInvite(invite, cb){
  if(S) void leaveRoom();
  const epoch = ++requestEpoch;
  const st = await ensureAuth();
  if(epoch !== requestEpoch) return;
  if(!st || !st.uid){ cb.onError && cb.onError('Önce giriş yapmalısın'); return; }
  if(!invite || !invite.gameId){ cb.onError && cb.onError('Geçersiz davet'); return; }
  const myUid=st.uid, myName=st.displayName||'Oyuncu';
  const active=()=>ownsRequest(epoch,myUid);
  if(!active())return;
  const gameId=invite.gameId, roomRef = fdb.ref(db, `${GPATH}/${gameId}`);
  let result;
  try{
    if(!(await fdb.get(roomRef)).exists()){
      if(active())cb.onError?.('Davet artık geçerli değil.');
      return;
    }
    if(!active())return;
    result = await fdb.runTransaction(roomRef, room => {
      if(!active() || !room || !room.players || room.players.A===myUid) return;
      if(room.invited!==myUid || room.players.B || room.status!=='invited') return;
      const expiresAt=Number.isFinite(room.expiresAt)?room.expiresAt:Number.isFinite(room.createdAt)?room.createdAt+INVITE_TTL:null;
      if(expiresAt!==null && Date.now()>=expiresAt) return;
      return { ...room, players:{...room.players,B:myUid}, names:{...room.names,B:myName}, presence:{...room.presence,B:true}, status:'active' };
    },{applyLocally:false});
  }catch(e){ if(active()){ cb.onError && cb.onError(permMsg(e)); } return; }
  if(!result.committed){
    if(active()){ cb.onError && cb.onError('Davet artık geçerli değil veya başka bir oyuncu katılmış.'); }
    return;
  }
  const room=result.snapshot.val(), oppUid=room.players.A;
  if(Auth.getState()?.uid!==myUid)return;
  // Keep a just-accepted match in the resume index even if the UI closed during the write.
  await indexBothGames(gameId,oppUid,myUid,room.names?.A,myName,'live',0,myUid);
  if(Auth.getState()?.uid!==myUid)return;
  if(invite.id)await fdb.remove(fdb.ref(db,`${INVPATH}/${myUid}/${invite.id}`)).catch(()=>{});
  if(!active()){
    if(Auth.getState()?.uid===myUid && !(S?.gameId===gameId && S?.myUid===myUid)) await fdb.update(roomRef,{'presence/B':false}).catch(()=>{});
    return;
  }
  const session=S={gameId,role:'B',roomRef,myUid,oppUid,seed:room.seed,async:false,waiting:false,version:roomVersion(room),rackAction:room.rackActions?.B,_presenceReady:true};
  watchConnection(session);armPresenceDisconnect(session);
  cb.onMatched && cb.onMatched({ role:'B', gameId, oppName: room.names && room.names.A || invite.fromName || 'Rakip', oppUid, seed:room.seed, lang:room.lang || 'tr', room });
}

export async function declineInvite(invite){
  const st = Auth.getState(); if(!st||!st.uid) return;
  try{ await fdb.remove(fdb.ref(db,`${INVPATH}/${st.uid}/${invite.id}`)); }catch(e){}
}

// Gönderilen daveti iptal et (host bekliyorken)
export async function cancelInvite(){
  return leaveRoom();
}
