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
  wasConnected = false;
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
    // Include signaling in the deadline: a Peer may never emit `open` after
    // a network outage, so starting this timer inside `open` can hang forever.
    connectTimer = setTimeout(() => {
      if(!currentPeer(p, generation)) return;
      connectTimer = null;
      if(reconnecting && !(conn && conn.open)) scheduleNextRecon();
    }, 8000);
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      if(isHost){ fire('waiting'); }
      else { bindConn(p.connect(PREFIX + joinCode, { reliable: true }), p, generation); }
    });
    if(isHost){
      p.on('connection', c => {
        if(!currentPeer(p, generation) || conn){ try{ c.close(); }catch(e){} return; }
        bindConn(c, p, generation);
      });
    }
    for(const type of ['error','disconnected','close']) p.on(type, () => { if(currentPeer(p,generation)) scheduleNextRecon(); });
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
    if(!currentConn(c, p, generation) || !c.open) return;
    const recovered = reconnecting;
    wasConnected = true;
    stopReconnect(); clearConnectTimer();
    fire(recovered ? 'reconnected' : 'connected');
  });
  c.on('data', raw => {
    if(!currentConn(c, p, generation)) return;
    let obj = raw;
    if(typeof raw === 'string'){ try{ obj = JSON.parse(raw); }catch(e){ obj = { type:'raw', raw }; } }
    fire('message', obj);
  });
  c.on('close', () => connectionLost(c,p,generation));
  c.on('error', () => connectionLost(c,p,generation));
  if(!wasConnected && isHost && connectTimer === null){
    connectTimer = setTimeout(() => {
      if(!currentConn(c,p,generation)) return;
      connectTimer = null;
      if(!c.open) connectionLost(c,p,generation);
    },12000);
  }
}

function connectionLost(c,p,generation){
  if(!currentConn(c,p,generation)) return;
  if(!wasConnected){
    if(isHost){
      conn = null; clearConnectTimer();
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
  try{ c.close(); }catch(_){}
  fire('disconnected');
  if(currentPeer(p,generation)) startReconnect();
}

function signalingLost(p,generation){
  if(!currentPeer(p,generation) || conn?.open) return;
  disposeTransport();
  fire('error','Oda sunucusuyla bağlantı kesildi. Yeniden dene.');
}

export const TavlaMP = {
  get connected(){ return !!(conn && conn.open); },
  get reconnecting(){ return reconnecting; },
  get code(){ return myCode; },
  get host(){ return isHost; },

  createRoom(cb, fixedCode){
    beginRoom(cb, true);
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return null; }
    if(fixedCode && !/^[A-Z2-9]{6}$/.test(fixedCode)){ fire('error','Oda kodu geçersiz'); return null; }
    myCode = fixedCode || genCode();
    const generation = roomGeneration;
    let p;
    try{ p = new window.Peer(PREFIX + myCode, { debug: 1 }); peer = p; }
    catch(e){ fire('error', 'oda kurulamadı'); return null; }
    connectTimer = setTimeout(() => {
      if(!currentPeer(p, generation)) return;
      connectTimer = null;
      disposeTransport();
      fire('error', 'oda kurulamadı');
    }, 12000);
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      clearConnectTimer();
      fire('code', myCode);
      if(currentPeer(p, generation)) fire('waiting');
    });
    p.on('connection', c => {
      if(!currentPeer(p, generation) || conn){ try{ c.close(); }catch(e){} return; }
      bindConn(c, p, generation);
    });
    p.on('disconnected',()=>signalingLost(p,generation));
    p.on('close',()=>signalingLost(p,generation));
    p.on('error', err => {
      if(!currentPeer(p, generation)) return;
      // The signaling service can fail while the P2P match remains healthy.
      if(conn && conn.open) return;
      disposeTransport();
      const t = (err && err.type) || '';
      fire('error', t === 'unavailable-id' ? 'kod meşgul, tekrar dene' : t || 'bağlantı hatası');
    });
    return myCode;
  },

  joinRoom(code, cb){
    beginRoom(cb, false);
    if(typeof window.Peer === 'undefined'){ fire('error', 'PeerJS yüklenemedi'); return; }
    code = String(code || '').toUpperCase().trim();
    if(!/^[A-Z2-9]{6}$/.test(code)){ fire('error', 'Geçerli 6 karakterli oda kodu gir'); return; }
    joinCode = code;
    const generation = roomGeneration;
    let p;
    try{ p = new window.Peer({ debug: 1 }); peer = p; }
    catch(e){ fire('error', 'bağlanılamadı'); return; }
    connectTimer = setTimeout(() => {
      if(!currentPeer(p, generation)) return;
      connectTimer = null;
      if(!(conn && conn.open)){
        disposeTransport();
        fire('error', 'Bağlantı zaman aşımına uğradı. Oda açıkken veya başka bir ağla yeniden dene.');
      }
    }, 12000);
    p.on('open', () => {
      if(!currentPeer(p, generation)) return;
      bindConn(p.connect(PREFIX + code, { reliable: true }), p, generation);
    });
    p.on('disconnected',()=>signalingLost(p,generation));
    p.on('close',()=>signalingLost(p,generation));
    p.on('error', err => {
      if(!currentPeer(p, generation)) return;
      if(conn && conn.open) return;
      disposeTransport();
      const t = (err && err.type) || '';
      fire('error', t === 'peer-unavailable' ? 'oda bulunamadı' : t || 'bağlantı hatası');
    });
  },

  __setHandler(cb){ onEvent = cb; },

  send(obj){
    const c=conn, p=peer, generation=roomGeneration;
    if(!c || !c.open) return false;
    try{
      if(c.dataChannel && c.dataChannel.readyState !== 'open') throw new Error('channel closed');
      c.send(JSON.stringify(obj));
      return currentConn(c,p,generation) && c.open;
    }catch(_){
      connectionLost(c,p,generation);
      return false;
    }
  },

  retryConnection(){
    if(!wasConnected || manualClose || reconnecting || conn?.open) return false;
    startReconnect();
    return reconnecting;
  },

  close(){ closeRoom(); }
};

export default TavlaMP;
