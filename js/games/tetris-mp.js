// ════════════════════════════════════════════════════════════════
//  HeroTetris — MULTIPLAYER (PeerJS, oda kodu ile P2P)
//
//  Bir oyuncu oda oluşturur (6 haneli kod), diğeri kodu girer.
//  Bağlanınca mesajlaşma: çöp blok gönderme + skor/satır senkronu.
//
//  Kullanım:
//    MP.host(onEvent) → kod döndürür (oda kurar, rakip bekler)
//    MP.join(code, onEvent) → koda bağlanır
//    MP.send(obj) → rakibe mesaj
//    MP.close() → bağlantıyı kapat
//
//  onEvent(type, data) olayları:
//    'code'        → oda kodu hazır (host)
//    'waiting'     → rakip bekleniyor
//    'connected'   → rakip bağlandı
//    'message'     → rakipten mesaj geldi (data = obj)
//    'disconnected'→ rakip ayrıldı
//    'error'       → hata (data = mesaj)
// ════════════════════════════════════════════════════════════════

const PREFIX = 'herotetris-mp-';   // peer id öneki (çakışmayı önler)

let peer = null;
let conn = null;
let onEvent = null;
let isHost = false;
let myCode = null;

// 6 haneli rastgele oda kodu (okunaklı: harf+rakam, karışanlar yok)
function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // O,0,I,1 yok
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function fire(type, data){ if(onEvent) try{ onEvent(type, data); }catch(e){ console.warn('[mp]', e); } }

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

export const MP = {
  get connected(){ return !!(conn && conn.open); },
  get code(){ return myCode; },
  get host(){ return isHost; },

  // Oda oluştur (host)
  createRoom(cb){
    onEvent = cb; isHost = true;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    myCode = genCode();
    try{
      peer = new window.Peer(PREFIX + myCode, { debug: 1 });
    }catch(e){ fire('error', 'oda kurulamadı'); return null; }
    peer.on('open', () => { fire('code', myCode); fire('waiting'); });
    peer.on('connection', (c) => {
      if(conn && conn.open){ try{ c.close(); }catch(e){} return; }   // zaten dolu
      bindConn(c);
    });
    peer.on('error', (err) => {
      const t = (err && err.type) || '';
      if(t === 'unavailable-id'){ fire('error', 'kod meşgul, tekrar dene'); }
      else fire('error', t || 'bağlantı hatası');
    });
    return myCode;
  },

  // Odaya katıl (kod ile)
  joinRoom(code, cb){
    onEvent = cb; isHost = false;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = (code || '').toUpperCase().trim();
    if(code.length !== 6){ fire('error', 'kod 6 haneli olmalı'); return; }
    try{
      peer = new window.Peer({ debug: 1 });
    }catch(e){ fire('error', 'bağlanılamadı'); return; }
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      bindConn(c);
      // bağlantı 12 sn içinde açılmazsa hata
      setTimeout(() => { if(!(conn && conn.open)) fire('error', 'oda bulunamadı'); }, 12000);
    });
    peer.on('error', (err) => {
      const t = (err && err.type) || '';
      if(t === 'peer-unavailable'){ fire('error', 'oda bulunamadı'); }
      else fire('error', t || 'bağlantı hatası');
    });
  },

  // Oyun sırasında olay handler'ını değiştir (lobi → oyun geçişi)
  __setHandler(cb){ onEvent = cb; },

  // Rakibe mesaj gönder
  send(obj){
    if(conn && conn.open){
      try{ conn.send(JSON.stringify(obj)); }catch(e){}
    }
  },

  // Bağlantıyı tamamen kapat
  close(){
    try{ if(conn) conn.close(); }catch(e){}
    try{ if(peer) peer.destroy(); }catch(e){}
    conn = null; peer = null; onEvent = null; isHost = false; myCode = null;
  }
};

export default MP;
