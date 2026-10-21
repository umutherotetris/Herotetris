// ════════════════════════════════════════════════════════════════
//  TAVLA — ÇEVRİMİÇİ (PeerJS, oda kodu ile P2P)
//
//  Host oda kurar (6 haneli kod), misafir kodu girer.
//  Host BEYAZ, misafir SİYAH. Açılış zarı + her hamle iletilir.
//
//  TavlaMP.createRoom(cb) → kod döndürür
//  TavlaMP.joinRoom(code, cb) → koda bağlanır
//  TavlaMP.send(obj) → rakibe mesaj | TavlaMP.close() → kapat
//
//  cb(type, data): 'code'|'waiting'|'connected'|'message'|'disconnected'|'error'
// ════════════════════════════════════════════════════════════════

const PREFIX = 'herotavla-mp-';   // tavlaya özel önek (satranç/tetris ile çakışmaz)

let peer = null;
let conn = null;
let onEvent = null;
let isHost = false;
let myCode = null;
// ── Yeniden bağlanma (reconnect) durumu ──
let joinCode = null;        // misafirin bağlandığı oda kodu
let reconnecting = false;   // şu an tekrar bağlanma denemesi sürüyor mu
let reconTries = 0;         // kaç deneme yapıldı
let reconTimer = null;      // bir sonraki deneme zamanlayıcısı
let roomGeneration = 0;    // stale Peer callbacks cannot own a replacement room
let connectTimer = null;   // join/handshake deadline, canceled on success or close
let manualClose = false;    // kullanıcı bilerek kapattı mı (reconnect deneme)
const RECON_MAX = 6;        // maksimum deneme (≈60 sn)
const RECON_DELAY = 10000;  // denemeler arası bekleme (ms)

function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // O,0,I,1 yok
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function fire(type, data){ if(onEvent) try{ onEvent(type, data); }catch(e){ console.warn('[tavla-mp]', e); } }

// Every callback belongs to its room and Peer, not mutable global `peer`.
function currentPeer(p, generation){
  return !manualClose && generation === roomGeneration && peer === p;
}
function currentConn(c, p, generation){
  return currentPeer(p, generation) && conn === c;
}
function clearConnectTimer(){
  if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
}
function disposeTransport(){
  const oldConn = conn, oldPeer = peer;
  conn = null; peer = null; // invalidate listeners before close/destroy emits
  clearConnectTimer();
  try{ if(oldConn) oldConn.close(); }catch(e){}
  try{ if(oldPeer) oldPeer.destroy(); }catch(e){}
}
function closeRoom(){
  manualClose = true;
  roomGeneration++;
  stopReconnect();
  disposeTransport();
  onEvent = null; isHost = false; myCode = null; joinCode = null;
}
function beginRoom(cb, host){
  closeRoom();
  onEvent = cb; isHost = host; manualClose = false;
}

// ── Otomatik yeniden bağlanma ──
function startReconnect(){
  if(reconnecting || manualClose) return;
  if(!myCode && !joinCode) return;
  reconnecting = true; reconTries = 0;
  const generation = roomGeneration;
  fire('reconnecting', { tries: 0, max: RECON_MAX });
  if(generation === roomGeneration && reconnecting) attemptReconnect();
}

function attemptReconnect(){
  if(manualClose || !reconnecting) return;
  reconTimer = null;
  reconTries++;
  if(reconTries > RECON_MAX){
    stopReconnect();
    disposeTransport();
    fire('reconnect_failed');
    return;
  }
  const generation = roomGeneration;
  fire('reconnecting', { tries: reconTries, max: RECON_MAX });
  if(generation !== roomGeneration || manualClose || !reconnecting) return;
  disposeTransport();
  try{
    const p = isHost
      ? new window.Peer(PREFIX + myCode, { debug: 1 })
      : new window.Peer({ debug: 1 });
    peer = p;
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      if(isHost){ fire('waiting'); }
      else { bindConn(p.connect(PREFIX + joinCode, { reliable: true }), p, generation); }
      // A signaling Peer can open while its data connection never does.
      if(currentPeer(p, generation) && reconnecting){
        connectTimer = setTimeout(() => {
          if(!currentPeer(p, generation)) return;
          connectTimer = null;
          if(reconnecting && !(conn && conn.open)) scheduleNextRecon();
        }, 8000);
      }
    });
    if(isHost){
      p.on('connection', c => {
        if(!currentPeer(p, generation) || conn){ try{ c.close(); }catch(e){} return; }
        bindConn(c, p, generation);
      });
    }
    p.on('error', () => { if(currentPeer(p, generation)) scheduleNextRecon(); });
  }catch(e){ scheduleNextRecon(); }
}

function scheduleNextRecon(){
  if(manualClose || !reconnecting) return;
  clearConnectTimer();
  if(reconTimer !== null) clearTimeout(reconTimer);
  const generation = roomGeneration;
  reconTimer = setTimeout(() => {
    if(generation !== roomGeneration || !reconnecting) return;
    reconTimer = null;
    attemptReconnect();
  }, RECON_DELAY);
}

function stopReconnect(){
  reconnecting = false; reconTries = 0;
  if(reconTimer !== null){ clearTimeout(reconTimer); reconTimer = null; }
}

function bindConn(c, p, generation){
  if(!currentPeer(p, generation)){ try{ c.close(); }catch(e){} return; }
  conn = c;
  c.on('open', () => {
    if(!currentConn(c, p, generation)) return;
    const recovered = reconnecting;
    stopReconnect(); clearConnectTimer();
    fire('connected');
    // The game may replace its event handler in `connected`; announce recovery
    // only after the actual data channel opens, for both host and guest.
    if(recovered && currentConn(c, p, generation)) fire('reconnected');
  });
  c.on('data', raw => {
    if(!currentConn(c, p, generation)) return;
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  c.on('close', () => {
    if(!currentConn(c, p, generation)) return;
    fire('disconnected');
    if(currentConn(c, p, generation)) startReconnect();
  });
  c.on('error', err => {
    if(!currentConn(c, p, generation)) return;
    fire('error', (err && err.type) || 'bağlantı hatası');
    if(currentConn(c, p, generation)) startReconnect();
  });
}

export const TavlaMP = {
  get connected(){ return !!(conn && conn.open); },
  get reconnecting(){ return reconnecting; },
  get code(){ return myCode; },
  get host(){ return isHost; },

  createRoom(cb, fixedCode){
    beginRoom(cb, true);
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    myCode = fixedCode || genCode();
    const generation = roomGeneration;
    let p;
    try{ p = new window.Peer(PREFIX + myCode, { debug: 1 }); peer = p; }
    catch(e){ fire('error', 'oda kurulamadı'); return null; }
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      fire('code', myCode);
      if(currentPeer(p, generation)) fire('waiting');
    });
    p.on('connection', c => {
      if(!currentPeer(p, generation) || conn){ try{ c.close(); }catch(e){} return; }
      bindConn(c, p, generation);
    });
    p.on('error', err => {
      if(!currentPeer(p, generation)) return;
      const t = (err && err.type) || '';
      fire('error', t === 'unavailable-id' ? 'kod meşgul, tekrar dene' : t || 'bağlantı hatası');
    });
    return myCode;
  },

  joinRoom(code, cb){
    beginRoom(cb, false);
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = (code || '').toUpperCase().trim();
    if(code.length !== 6){ fire('error', 'kod 6 haneli olmalı'); return; }
    joinCode = code;
    const generation = roomGeneration;
    let p;
    try{ p = new window.Peer({ debug: 1 }); peer = p; }
    catch(e){ fire('error', 'bağlanılamadı'); return; }
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      bindConn(p.connect(PREFIX + code, { reliable: true }), p, generation);
      connectTimer = setTimeout(() => {
        if(!currentPeer(p, generation)) return;
        connectTimer = null;
        if(!(conn && conn.open)) fire('error', 'oda bulunamadı');
      }, 12000);
    });
    p.on('error', err => {
      if(!currentPeer(p, generation)) return;
      clearConnectTimer();
      const t = (err && err.type) || '';
      fire('error', t === 'peer-unavailable' ? 'oda bulunamadı' : t || 'bağlantı hatası');
    });
  },

  __setHandler(cb){ onEvent = cb; },

  send(obj){
    if(conn && conn.open){ try{ conn.send(JSON.stringify(obj)); }catch(e){} }
  },

  close(){ closeRoom(); }
};

export default TavlaMP;
