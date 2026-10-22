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
      listen(peer, 'error', () => { scheduleNextRecon(); });
    } else {
      // Misafir: host koduna tekrar bağlan
      peer = new window.Peer({ debug: 1 });
      listen(peer, 'open', () => {
        const c = peer.connect(PREFIX + joinCode, { reliable: true });
        bindConn(c);
      });
      listen(peer, 'error', () => { scheduleNextRecon(); });
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
    const restored = reconnecting;
    stopReconnect();
    fire(restored ? 'reconnected' : 'connected');
  });
  listen(conn, 'data', (raw) => {
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  listen(conn, 'close', () => {
    fire('disconnected');
    if(conn === c && !manualClose) startReconnect();   // callback may have replaced the room
  });
  listen(conn, 'error', (err) => {
    fire('error', (err && err.type) || 'bağlantı hatası');
    if(conn === c && !manualClose) startReconnect();
  });
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
    code = (code || '').toUpperCase().trim();
    if(code.length !== 6){ fire('error', 'kod 6 haneli olmalı'); return; }
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
        fire('error', 'oda bulunamadı');
      }
    }, 12000);
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
    if(conn && conn.open){
      const owner = conn;
      try{ conn.send(JSON.stringify(obj)); return true; }
      catch(e){
        fire('disconnected');
        if(conn === owner && !manualClose) startReconnect();
      }
    }
    return false;
  },

  close(){
    sessionId++; onEvent = null;
    manualClose = true; stopReconnect();
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null; onEvent = null; isHost = false; myCode = null; joinCode = null;
  }
};

export default ChessMP;
