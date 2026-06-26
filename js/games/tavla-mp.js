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

// ── Otomatik yeniden bağlanma ──
function startReconnect(){
  if(reconnecting || manualClose) return;
  if(!myCode && !joinCode) return;       // bağlanılacak oda yok
  reconnecting = true; reconTries = 0;
  fire('reconnecting', { tries: 0, max: RECON_MAX });
  attemptReconnect();
}

function attemptReconnect(){
  if(manualClose){ reconnecting = false; return; }
  reconTries++;
  if(reconTries > RECON_MAX){
    reconnecting = false;
    fire('reconnect_failed');
    return;
  }
  fire('reconnecting', { tries: reconTries, max: RECON_MAX });
  try{
    // Eski peer/conn'u temizle
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null;

    if(isHost){
      // Host: aynı oda koduyla peer'i yeniden kur, misafiri bekle
      peer = new window.Peer(PREFIX + myCode, { debug: 1 });
      peer.on('open', () => { fire('waiting'); });
      peer.on('connection', (c) => {
        if(conn && conn.open){ try{ c.close(); }catch(e){} return; }
        bindConn(c);
        reconnecting = false; reconTries = 0;
        fire('reconnected');
      });
      peer.on('error', () => { scheduleNextRecon(); });
    } else {
      // Misafir: host koduna tekrar bağlan
      peer = new window.Peer({ debug: 1 });
      peer.on('open', () => {
        const c = peer.connect(PREFIX + joinCode, { reliable: true });
        bindConn(c);
        c.on('open', () => { reconnecting = false; reconTries = 0; fire('reconnected'); });
        setTimeout(() => { if(!(conn && conn.open) && reconnecting) scheduleNextRecon(); }, 8000);
      });
      peer.on('error', () => { scheduleNextRecon(); });
    }
  }catch(e){ scheduleNextRecon(); }
}

function scheduleNextRecon(){
  if(manualClose || !reconnecting) return;
  if(reconTimer) clearTimeout(reconTimer);
  reconTimer = setTimeout(attemptReconnect, RECON_DELAY);
}

function stopReconnect(){
  reconnecting = false; reconTries = 0;
  if(reconTimer){ clearTimeout(reconTimer); reconTimer = null; }
}

function bindConn(c){
  conn = c;
  conn.on('open', () => { fire('connected'); });
  conn.on('data', (raw) => {
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  conn.on('close', () => {
    fire('disconnected');
    if(!manualClose) startReconnect();   // kullanıcı kapatmadıysa tekrar bağlanmayı dene
  });
  conn.on('error', (err) => {
    fire('error', (err && err.type) || 'bağlantı hatası');
    if(!manualClose) startReconnect();
  });
}

export const TavlaMP = {
  get connected(){ return !!(conn && conn.open); },
  get reconnecting(){ return reconnecting; },
  get code(){ return myCode; },
  get host(){ return isHost; },

  createRoom(cb, fixedCode){
    onEvent = cb; isHost = true; manualClose = false; stopReconnect();
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    myCode = fixedCode || genCode();
    try{ peer = new window.Peer(PREFIX + myCode, { debug: 1 }); }
    catch(e){ fire('error', 'oda kurulamadı'); return null; }
    peer.on('open', () => { fire('code', myCode); fire('waiting'); });
    peer.on('connection', (c) => {
      if(conn && conn.open){ try{ c.close(); }catch(e){} return; }
      bindConn(c);
    });
    peer.on('error', (err) => {
      const t = (err && err.type) || '';
      if(t === 'unavailable-id'){ fire('error', 'kod meşgul, tekrar dene'); }
      else fire('error', t || 'bağlantı hatası');
    });
    return myCode;
  },

  joinRoom(code, cb){
    onEvent = cb; isHost = false; manualClose = false; stopReconnect();
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = (code || '').toUpperCase().trim();
    if(code.length !== 6){ fire('error', 'kod 6 haneli olmalı'); return; }
    joinCode = code;   // reconnect için sakla
    try{ peer = new window.Peer({ debug: 1 }); }
    catch(e){ fire('error', 'bağlanılamadı'); return; }
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      bindConn(c);
      setTimeout(() => { if(!(conn && conn.open)) fire('error', 'oda bulunamadı'); }, 12000);
    });
    peer.on('error', (err) => {
      const t = (err && err.type) || '';
      if(t === 'peer-unavailable'){ fire('error', 'oda bulunamadı'); }
      else fire('error', t || 'bağlantı hatası');
    });
  },

  __setHandler(cb){ onEvent = cb; },

  send(obj){
    if(conn && conn.open){ try{ conn.send(JSON.stringify(obj)); }catch(e){} }
  },

  close(){
    manualClose = true; stopReconnect();
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null; onEvent = null; isHost = false; myCode = null; joinCode = null;
  }
};

export default TavlaMP;
