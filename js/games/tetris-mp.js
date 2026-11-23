// ════════════════════════════════════════════════════════════════
//  HeroTetris — MULTIPLAYER (PeerJS, oda kodu ile P2P)
//
//  Bir oyuncu oda oluşturur (6 haneli kod), diğeri kodu girer.
//  Bağlanınca mesajlaşma: çöp blok gönderme + skor/satır senkronu.
//
//  Kullanım:
//    MP.createRoom(onEvent) → kod döndürür (oda kurar, rakip bekler)
//    MP.joinRoom(code, onEvent) → koda bağlanır
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
const GUEST_PREFIX = 'herotetris-guest-';

let peer = null;
let conn = null;
let onEvent = null;
let isHost = false;
let myCode = null;
// ── Yeniden bağlanma (reconnect) durumu ──
let joinCode = null;        // misafirin bağlandığı oda kodu
let guestId = null, returningGuest = null;
let reconnecting = false;   // şu an tekrar bağlanma denemesi sürüyor mu
let reconTries = 0;         // kaç deneme yapıldı
let reconTimer = null;      // bir sonraki deneme zamanlayıcısı
let manualClose = false;    // kullanıcı bilerek kapattı mı (reconnect deneme)
let generation = 0;         // kapanan/değişen odanın geç olaylarını yalıt
let connectTimer = null;    // yalnız aktif bağlantının açılma süresi
let reservationTimer = null;
let hasConnected = false;
const RECON_MAX = 6;        // maksimum yeniden bağlanma denemesi
const RECON_DELAY = 10000;  // denemeler arası bekleme (ms)

// 6 haneli rastgele oda kodu (okunaklı: harf+rakam, karışanlar yok)
function genCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // O,0,I,1 yok
  let s = '';
  for(let i=0;i<6;i++) s += chars[Math.floor(Math.random()*chars.length)];
  return s;
}

function fire(type, data){ if(onEvent) try{ onEvent(type, data); }catch(e){ console.warn('[mp]', e); } }

// PeerJS olayları kaynak peer ve oda kuşağıyla bağlıdır. Eski bir kanalın
// close/open/data olayı yeni odanın handler'ına ulaşamaz.
function currentPeer(p, session){
  return !manualClose && generation === session && peer === p;
}

function clearConnectTimer(){
  if(connectTimer !== null){ clearTimeout(connectTimer); connectTimer = null; }
}

function clearReservationTimer(){
  if(reservationTimer !== null){ clearTimeout(reservationTimer); reservationTimer = null; }
}

function disposeTransport(){
  clearReservationTimer();
  // Önce kimlikleri bırak; close()/destroy() eşzamanlı olay da üretebilir.
  const oldConn = conn, oldPeer = peer;
  conn = null; peer = null;
  try{ if(oldConn) oldConn.close(); }catch(e){}
  try{ if(oldPeer) oldPeer.destroy(); }catch(e){}
}

function failInitial(p, session, message){
  if(!currentPeer(p, session)) return;
  clearConnectTimer();
  disposeTransport();
  fire('error', message);
}

function waitForConnection(p, session, delay, retry){
  clearConnectTimer();
  connectTimer = setTimeout(() => {
    connectTimer = null;
    if(!currentPeer(p, session) || (conn && conn.open)) return;
    if(retry) scheduleNextRecon();
    else {
      // Süresi dolan giriş artık kullanılamaz; geç 'open' oyunu başlatmamalı.
      failInitial(p, session, 'oda bulunamadı');
    }
  }, delay);
}

// ── Otomatik yeniden bağlanma ──
function startReconnect(){
  if(reconnecting || manualClose || (!myCode && !joinCode)) return;
  reconnecting = true; reconTries = 0;
  fire('reconnecting', { tries: 0, max: RECON_MAX });
  if(reconnecting && !manualClose) attemptReconnect();
}

function attemptReconnect(){
  if(manualClose || !reconnecting) return;
  if(reconTimer !== null){ clearTimeout(reconTimer); reconTimer = null; }
  clearConnectTimer();
  disposeTransport();
  reconTries++;
  if(reconTries > RECON_MAX){
    reconnecting = false;
    fire('reconnect_failed');
    return;
  }
  fire('reconnecting', { tries: reconTries, max: RECON_MAX });
  if(!manualClose && reconnecting) openPeer(true);
}

function scheduleNextRecon(delay=RECON_DELAY){
  if(manualClose || !reconnecting) return;
  clearConnectTimer();
  if(reconTimer !== null) clearTimeout(reconTimer);
  const session = generation;
  reconTimer = setTimeout(() => {
    reconTimer = null;
    if(generation === session && reconnecting && !manualClose) attemptReconnect();
  }, delay);
}

function stopReconnect(){
  reconnecting = false; reconTries = 0;
  if(reconTimer !== null){ clearTimeout(reconTimer); reconTimer = null; }
  clearConnectTimer();
}

function bindConn(c, p, session){
  if(!currentPeer(p, session) || conn || (isHost && returningGuest && c.peer!==returningGuest)){
    try{ c.close(); }catch(e){} return;
  }
  conn = c; // Açılmayı bekleyen ilk kanal da odayı rezerve eder.
  let opened = false;
  const current = () => currentPeer(p, session) && conn === c;
  const openedChannel = () => {
    if(!current() || opened) return;
    opened = true;
    clearReservationTimer();
    const resumed = reconnecting && hasConnected;
    stopReconnect();
    hasConnected = true;
    // Guests from this release use one signaling ID for the whole round.
    // An unrelated player entering the same code cannot take their seat on reconnect.
    if(isHost && typeof c.peer==='string' && c.peer.startsWith(GUEST_PREFIX)) returningGuest=c.peer;
    fire(resumed ? 'reconnected' : 'connected');
  };
  c.on('open', openedChannel);
  c.on('data', (raw) => {
    if(!current() || !c.open) return;
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  const lostChannel = () => {
    if(!current()) return;
    clearReservationTimer();
    conn = null;
    try{ c.close(); }catch(e){}
    if(!opened){
      // Bir misafirin yarım kalan el sıkışması hostun oda kodunu bozmaz.
      if(isHost && !hasConnected){ fire('waiting'); return; }
      if(!reconnecting && !hasConnected){ failInitial(p, session, 'oda bağlantısı tamamlanamadı'); return; }
      if(reconnecting){ scheduleNextRecon(); return; }
    }
    fire('disconnected');
    if(currentPeer(p, session)){
      if(reconnecting) scheduleNextRecon();
      else startReconnect();
    }
  };
  c.on('close', lostChannel);
  c.on('error', lostChannel);
  if(c.open) openedChannel();
  else if(isHost) reservationTimer = setTimeout(lostChannel, 12000);
}

function openPeer(retry){
  const session = generation;
  let p;
  try{
    p = new window.Peer(isHost ? PREFIX + myCode : guestId, { debug: 1 });
  }catch(e){
    if(retry) scheduleNextRecon();
    else fire('error', isHost ? 'oda kurulamadı' : 'bağlanılamadı');
    return false;
  }
  peer = p;
  let signalingOpened = false;
  p.on('open', () => {
    if(!currentPeer(p, session)) return;
    const firstOpen = !signalingOpened;
    signalingOpened = true;
    if(isHost){
      if(!hasConnected){ stopReconnect(); fire('code', myCode); if(currentPeer(p, session)) fire('waiting'); }
      else if(reconnecting && !conn?.open) fire('waiting');
    } else {
      if(!firstOpen || conn) return;
      try{
        const c = p.connect(PREFIX + joinCode, { reliable: true });
        bindConn(c, p, session);
      }catch(e){
        if(retry) scheduleNextRecon();
        else failInitial(p, session, 'bağlanılamadı');
      }
    }
  });
  p.on('connection', (c) => {
    if(!isHost || !currentPeer(p, session)){ try{ c.close(); }catch(e){} return; }
    bindConn(c, p, session);
  });
  p.on('error', (err) => {
    if(!currentPeer(p, session)) return;
    // PeerServer sinyali ve veri kanalı ayrı: çalışan maçı kapatma.
    if(conn?.open) return;
    const t = (err && err.type) || '';
    if(reconnecting){
      // Misafirin ilk araması host aynı kodu yeniden açmadan önce ulaşabilir.
      scheduleNextRecon(!isHost && t==='peer-unavailable' && reconTries===1 ? 600 : RECON_DELAY);
      return;
    }
    failInitial(p, session, t === 'unavailable-id' ? 'kod meşgul, tekrar dene' :
      t === 'peer-unavailable' ? 'oda bulunamadı' : t || 'bağlantı hatası');
  });
  p.on('disconnected', () => {
    if(!currentPeer(p, session)) return;
    if(conn?.open){ try{ p.reconnect?.(); }catch(e){} return; }
    if(reconnecting) scheduleNextRecon();
    else if((signalingOpened && isHost) || hasConnected) startReconnect();
    else failInitial(p, session, 'sinyal bağlantısı kesildi');
  });
  p.on('close', () => {
    if(!currentPeer(p, session)) return;
    if(reconnecting) scheduleNextRecon();
    else if((signalingOpened && isHost) || hasConnected) startReconnect();
    else failInitial(p, session, 'sinyal bağlantısı kapandı');
  });
  // Süre sınırı, sinyal sunucusu hiç 'open' üretmese de işler.
  if(retry || !isHost) waitForConnection(p, session, retry ? 8000 : 12000, retry);
  else {
    // İlk host da sinyal sunucusunun sessiz kalmasına karşı süreyle sınırlıdır.
    // Kod hazır olunca bu sınır kalkar; rakip bekleme süresini sınırlamaz.
    clearConnectTimer();
    connectTimer = setTimeout(() => {
      connectTimer = null;
      if(!currentPeer(p, session) || hasConnected) return;
      failInitial(p, session, 'oda kurulamadı');
    }, 12000);
  }
  return true;
}

export const MP = {
  get connected(){ return !!(conn && conn.open); },
  get reconnecting(){ return reconnecting; },
  get code(){ return myCode; },
  get host(){ return isHost; },

  // Yeni oda, önceki peer/kanal ve bütün bekleme zamanlayıcılarını kapatır.
  createRoom(cb, fixedCode){
    MP.close();
    onEvent = cb; isHost = true; manualClose = false;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    if(fixedCode != null && (typeof fixedCode !== 'string' || !/^[A-Z2-9]{6}$/.test(fixedCode))){ fire('error', 'oda kodu geçersiz'); return null; }
    myCode = fixedCode || genCode();
    return openPeer(false) ? myCode : null;
  },

  // Odaya katıl (kod ile)
  joinRoom(code, cb){
    MP.close();
    onEvent = cb; isHost = false; manualClose = false;
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = typeof code === 'string' ? code.toUpperCase().trim() : '';
    if(!/^[A-Z2-9]{6}$/.test(code)){ fire('error', 'oda kodu 6 geçerli karakter içermeli'); return; }
    joinCode = code;
    guestId = GUEST_PREFIX + (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);
    openPeer(false);
  },

  // Oyun sırasında olay handler'ını değiştir (lobi → oyun geçişi)
  __setHandler(cb){ onEvent = cb; },

  // Rakibe mesaj gönder
  send(obj){
    if(!conn?.open) return false;
    try{ conn.send(JSON.stringify(obj)); return true; }catch(e){ return false; }
  },

  // Bağlantıyı tamamen kapat
  close(){
    manualClose = true; generation++;
    stopReconnect();
    disposeTransport();
    onEvent = null; isHost = false; myCode = null; joinCode = null; guestId = null; returningGuest = null; hasConnected = false;
  }
};

export default MP;
