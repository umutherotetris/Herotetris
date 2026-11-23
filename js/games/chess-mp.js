// ════════════════════════════════════════════════════════════════
//  OSMANLI SATRANÇ — ÇEVRİMİÇİ (PeerJS, oda kodu ile P2P)
//
//  Bir oyuncu oda kurar (6 haneli kod), diğeri kodu girer.
//  Host BEYAZ, misafir SİYAH oynar. Her hamle karşıya iletilir.
//
//  ChessMP.createRoom(cb) → kod döndürür (oda kurar)
//  ChessMP.joinRoom(code, cb) → koda bağlanır
//  ChessMP.send(obj) → rakibe mesaj
//  ChessMP.close() → kapat
//
//  cb(type, data):
//    'code' → oda kodu hazır | 'waiting' → rakip bekleniyor
//    'connected' → rakip bağlandı | 'message' → mesaj geldi
//    'disconnected' → rakip ayrıldı | 'error' → hata
// ════════════════════════════════════════════════════════════════

const PREFIX = 'herochess-mp-';   // satranca özel önek (Tetris ile çakışmaz)

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
let connectTimer = null;    // covers signaling open and data-channel handshake
let sessionId = 0;
let wasConnected = false;
let manualClose = false;    // kullanıcı bilerek kapattı mı (reconnect deneme)
const RECON_MAX = 6;        // maksimum deneme (≈60 sn)
const RECON_DELAY = 10000;  // denemeler arası bekleme (ms)

function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // O,0,I,1 yok
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function fire(type, data){ if(onEvent) try{ onEvent(type, data); }catch(e){ console.warn('[chess-mp]', e); } }

// Peer events and connection timeouts belong to the room that created them.
function listen(target, type, callback){
  const session = sessionId;
  target.on(type, (...args) => {
    if(session !== sessionId || (target !== peer && target !== conn)){
      if(type === 'connection') try{ args[0].close(); }catch(e){}
      return;
    }
    callback(...args);
  });
}
function later(callback, delay){
  const session = sessionId, owner = peer;
  return setTimeout(() => { if(session === sessionId && owner === peer && !manualClose) callback(); }, delay);
}

function disposeTransport(){
  // Invalidate callbacks before close/destroy can emit, including a late open
  // after the initial join deadline has already reported failure.
  const previousConn = conn, previousPeer = peer;
  conn = null; peer = null;
  if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
  try{ if(previousConn) previousConn.close(); }catch(e){}
  try{ if(previousPeer) previousPeer.destroy(); }catch(e){}
}


// ── Otomatik yeniden bağlanma ──
function startReconnect(){
  if(reconnecting || manualClose) return;
  if(!myCode && !joinCode) return;       // bağlanılacak oda yok
  reconnecting = true; reconTries = 0;
  const session = sessionId;
  fire('reconnecting', { tries: 0, max: RECON_MAX });
  if(session === sessionId && reconnecting) attemptReconnect();
}

function attemptReconnect(){
  if(manualClose || !reconnecting) return;
  reconTries++;
  if(reconTries > RECON_MAX){
    stopReconnect();
    const oldConn = conn, oldPeer = peer;
    conn = null; peer = null;
    try{ if(oldConn) oldConn.close(); }catch(e){}
    try{ if(oldPeer) oldPeer.destroy(); }catch(e){}
    fire('reconnect_failed');
    return;
  }
  const session = sessionId;
  fire('reconnecting', { tries: reconTries, max: RECON_MAX });
  if(session !== sessionId || manualClose || !reconnecting) return;
  try{
    // Eski peer/conn'u temizle
    const previousConn = conn, previousPeer = peer;
    conn = null; peer = null;
    try{ if(previousConn) previousConn.close(); }catch(e){}
    try{ if(previousPeer) previousPeer.destroy(); }catch(e){}

    if(isHost){
      // Host: aynı oda koduyla peer'i yeniden kur, misafiri bekle
      peer = new window.Peer(PREFIX + myCode, { debug: 1 });
      listen(peer, 'open', () => { fire('waiting'); });
      listen(peer, 'connection', (c) => {
        if(conn){ try{ c.close(); }catch(e){} return; }
        bindConn(c);
      });
      for(const event of ['error','disconnected','close']) listen(peer,event,scheduleNextRecon);
    } else {
      // Misafir: host koduna tekrar bağlan
      peer = new window.Peer({ debug: 1 });
      listen(peer, 'open', () => {
        const c = peer.connect(PREFIX + joinCode, { reliable: true });
        bindConn(c);
      });
      for(const event of ['error','disconnected','close']) listen(peer,event,scheduleNextRecon);
    }
    // Begin before Peer.open: a stalled signaling connection must also time out.
    connectTimer = later(() => {
      connectTimer = null;
      if(!(conn && conn.open) && reconnecting) scheduleNextRecon();
    }, 8000);
  }catch(e){ scheduleNextRecon(); }
}

function scheduleNextRecon(){
  if(manualClose || !reconnecting) return;
  if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
  if(reconTimer) clearTimeout(reconTimer);
  reconTimer = later(() => { if(reconnecting) attemptReconnect(); }, RECON_DELAY);
}

function stopReconnect(){
  reconnecting = false; reconTries = 0;
  if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
  if(reconTimer){ clearTimeout(reconTimer); reconTimer = null; }
}

function bindConn(c){
  conn = c;
  listen(conn, 'open', () => {
    if(!c.open) return;
    const restored = reconnecting;
    wasConnected = true;
    stopReconnect();
    fire(restored ? 'reconnected' : 'connected');
  });
  listen(conn, 'data', (raw) => {
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  listen(conn, 'close', () => connectionLost(c));
  listen(conn, 'error', () => connectionLost(c));
  if(!wasConnected && isHost && connectTimer === null){
    connectTimer = later(() => {
      connectTimer = null;
      if(conn === c && !c.open) connectionLost(c);
    }, 12000);
  }
}

function connectionLost(c){
  if(conn !== c || manualClose) return;
  if(!wasConnected){
    if(isHost){
      // A guest that never finished the handshake must not retire the room.
      conn = null;
      if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
      try{ c.close(); }catch(_){}
      fire('waiting');
    } else {
      disposeTransport();
      fire('error', 'Bağlantı tamamlanamadı. Oda koduyla yeniden dene.');
    }
    return;
  }
  if(reconnecting){
    conn = null;
    try{ c.close(); }catch(_){}
    scheduleNextRecon();
    return;
  }
  conn = null;
  const session = sessionId;
  try{ c.close(); }catch(_){}
  fire('disconnected');
  if(session === sessionId && !manualClose) startReconnect();
}

function signalingLost(){
  // Signaling and the active RTC channel are separate connections.
  if(conn?.open) return;
  disposeTransport();
  fire('error','Oda sunucusuyla bağlantı kesildi. Yeniden dene.');
}

export const ChessMP = {
  get connected(){ return !!(conn && conn.open); },
  get reconnecting(){ return reconnecting; },
  get code(){ return myCode; },
  get host(){ return isHost; },

  createRoom(cb, fixedCode){
    this.close();
    onEvent = cb; isHost = true; manualClose = false; stopReconnect();
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    if(fixedCode && !/^[A-Z2-9]{6}$/.test(fixedCode)){ fire('error','Oda kodu geçersiz'); return null; }
    myCode = fixedCode || genCode();
    try{ peer = new window.Peer(PREFIX + myCode, { debug: 1 }); }
    catch(e){ fire('error', 'oda kurulamadı'); return null; }
    connectTimer = later(() => {
      connectTimer = null;
      disposeTransport();
      fire('error', 'oda kurulamadı');
    }, 12000);
    listen(peer, 'open', () => {
      if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
      const owner = peer;
      fire('code', myCode);
      if(peer === owner && !manualClose) fire('waiting');
    });
    listen(peer, 'connection', (c) => {
      if(conn){ try{ c.close(); }catch(e){} return; }
      bindConn(c);
    });
    listen(peer,'disconnected',signalingLost);
    listen(peer,'close',signalingLost);
    listen(peer, 'error', (err) => {
      // Signaling errors do not sever an already-open P2P data channel.
      if(conn && conn.open) return;
      disposeTransport();
      const t = (err && err.type) || '';
      if(t === 'unavailable-id'){ fire('error', 'kod meşgul, tekrar dene'); }
      else fire('error', t || 'bağlantı hatası');
    });
    return myCode;
  },

  joinRoom(code, cb){
    this.close();
    onEvent = cb; isHost = false; manualClose = false; stopReconnect();
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = String(code || '').toUpperCase().trim();
    if(!/^[A-Z2-9]{6}$/.test(code)){ fire('error', 'Geçerli 6 karakterli oda kodu gir'); return; }
    joinCode = code;   // reconnect için sakla
    try{ peer = new window.Peer({ debug: 1 }); }
    catch(e){ fire('error', 'bağlanılamadı'); return; }
    listen(peer, 'open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      bindConn(c);
    });
    connectTimer = later(() => {
      connectTimer = null;
      if(!(conn && conn.open)){
        disposeTransport();
        fire('error', 'Bağlantı zaman aşımına uğradı. Oda açıkken veya başka bir ağla yeniden dene.');
      }
    }, 12000);
    listen(peer,'disconnected',signalingLost);
    listen(peer,'close',signalingLost);
    listen(peer, 'error', (err) => {
      if(conn && conn.open) return;
      disposeTransport();
      const t = (err && err.type) || '';
      if(t === 'peer-unavailable'){ fire('error', 'oda bulunamadı'); }
      else fire('error', t || 'bağlantı hatası');
    });
  },

  __setHandler(cb){ onEvent = cb; },

  send(obj){
    const c = conn;
    if(!c || !c.open) return false;
    try{
      if(c.dataChannel && c.dataChannel.readyState !== 'open') throw new Error('channel closed');
      c.send(JSON.stringify(obj));
      // PeerJS may report send failure synchronously through close, without throwing.
      return conn === c && c.open;
    }catch(_){
      connectionLost(c);
      return false;
    }
  },

  retryConnection(){
    if(!wasConnected || manualClose || reconnecting || conn?.open) return false;
    startReconnect();
    return reconnecting;
  },

  close(){
    sessionId++; onEvent = null;
    manualClose = true; wasConnected = false; stopReconnect();
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null; onEvent = null; isHost = false; myCode = null; joinCode = null;
  }
};

export default ChessMP;
