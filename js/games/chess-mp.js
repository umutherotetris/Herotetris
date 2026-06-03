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

function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // O,0,I,1 yok
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function fire(type, data){ if(onEvent) try{ onEvent(type, data); }catch(e){ console.warn('[chess-mp]', e); } }

function bindConn(c){
  conn = c;
  conn.on('open', () => { fire('connected'); });
  conn.on('data', (raw) => {
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  conn.on('close', () => { fire('disconnected'); });
  conn.on('error', (err) => { fire('error', (err && err.type) || 'bağlantı hatası'); });
}

export const ChessMP = {
  get connected(){ return !!(conn && conn.open); },
  get code(){ return myCode; },
  get host(){ return isHost; },

  createRoom(cb){
    onEvent = cb; isHost = true;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    myCode = genCode();
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
    onEvent = cb; isHost = false;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = (code || '').toUpperCase().trim();
    if(code.length !== 6){ fire('error', 'kod 6 haneli olmalı'); return; }
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
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null; onEvent = null; isHost = false; myCode = null;
  }
};

export default ChessMP;
