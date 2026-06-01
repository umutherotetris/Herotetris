// ════════════════════════════════════════════════════════════════
//  HeroTetris — PREMIUM TAŞ TEMALARI
//
//  Her tema, blokların canvas'a nasıl çizileceğini belirler.
//  drawCell(ctx, px, py, size, color, theme) → temaya göre stil.
//  Premium temalar kaju ile açılabilir (şimdilik hepsi açık; kilit
//  sistemi store ile sonra bağlanabilir).
// ════════════════════════════════════════════════════════════════
export const THEMES = {
  neon: {
    name: 'NEON', icon: '🟪', premium: false,
    desc: 'Klasik parlak neon'
  },
  crystal: {
    name: 'KRİSTAL', icon: '💎', premium: true, price: 500,
    desc: 'Şeffaf kristal parıltı'
  },
  gold: {
    name: 'ALTIN', icon: '🟨', premium: true, price: 1000,
    desc: 'Lüks altın blok'
  },
  retro: {
    name: 'RETRO', icon: '🎮', premium: true, price: 750,
    desc: 'Piksel arcade'
  },
  ghost: {
    name: 'HAYALET', icon: '👻', premium: true, price: 600,
    desc: 'Yarı saydam aura'
  },
  fire: {
    name: 'ATEŞ', icon: '🔥', premium: true, price: 1200,
    desc: 'Alevli kor blok'
  },
  glass: {
    name: 'CAM', icon: '🪟', premium: true, price: 800,
    desc: 'Buzlu cam efekti'
  },
  lava: {
    name: 'LAVA', icon: '🌋', premium: true, price: 1500,
    desc: 'Erimiş çekirdek'
  },
  ice: {
    name: 'BUZ', icon: '🧊', premium: true, price: 900,
    desc: 'Donmuş kristal'
  },
  matrix: {
    name: 'MATRIX', icon: '🟢', premium: true, price: 1100,
    desc: 'Dijital yağmur'
  },
  plasma: {
    name: 'PLAZMA', icon: '⚛️', premium: true, price: 1400,
    desc: 'Enerji küresi'
  },
  galaxy: {
    name: 'GALAKSİ', icon: '🌠', premium: true, price: 2000,
    desc: 'Yıldız tozu'
  }
};

export const THEME_KEYS = Object.keys(THEMES);
export const DEFAULT_THEME = 'neon';

// Renk yardımcıları
function shade(hex, amt){
  try{
    let c = hex.replace('#','');
    if(c.length===3) c = c.split('').map(x=>x+x).join('');
    let r = parseInt(c.slice(0,2),16), g = parseInt(c.slice(2,4),16), b = parseInt(c.slice(4,6),16);
    r = Math.max(0,Math.min(255, r + amt)); g = Math.max(0,Math.min(255, g + amt)); b = Math.max(0,Math.min(255, b + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }catch(e){ return hex; }
}

// Tek hücre çiz — temaya göre
export function drawThemedCell(ctx, x, y, size, color, themeKey, ghost){
  const px = x*size, py = y*size, g = 1, w = size - 2*g, h = size - 2*g;
  if(ghost){
    ctx.strokeStyle = color; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
    ctx.strokeRect(px+g+1, py+g+1, w-2, h-2); ctx.globalAlpha = 1; return;
  }
  const theme = themeKey || 'neon';

  if(theme === 'neon'){
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.fillRect(px+g, py+g, w, Math.max(2, size*0.18));
  }
  else if(theme === 'crystal'){
    // Şeffaf, köşegen parıltı
    ctx.fillStyle = color; ctx.globalAlpha = 0.55; ctx.fillRect(px+g, py+g, w, h); ctx.globalAlpha = 1;
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.strokeStyle = shade(color, 80); ctx.lineWidth = 1.5; ctx.strokeRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.moveTo(px+g, py+g); ctx.lineTo(px+g+w, py+g+h);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(px+g, py+g, w*0.4, h*0.4);
  }
  else if(theme === 'gold'){
    // Altın gradyan + kenar
    const grd = ctx.createLinearGradient(px, py, px, py+size);
    grd.addColorStop(0, shade(color, 60)); grd.addColorStop(0.5, color); grd.addColorStop(1, shade(color, -50));
    ctx.fillStyle = grd; ctx.fillRect(px+g, py+g, w, h);
    ctx.strokeStyle = shade(color, 90); ctx.lineWidth = 1.5; ctx.strokeRect(px+g, py+g, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(px+g+1, py+g+1, w-2, Math.max(2, size*0.16));
  }
  else if(theme === 'retro'){
    // Düz piksel + sert kenar (gölge yok)
    ctx.fillStyle = color; ctx.fillRect(px, py, size, size);
    ctx.fillStyle = shade(color, 50); ctx.fillRect(px, py, size, 2); ctx.fillRect(px, py, 2, size);
    ctx.fillStyle = shade(color, -60); ctx.fillRect(px, py+size-2, size, 2); ctx.fillRect(px+size-2, py, 2, size);
  }
  else if(theme === 'ghost'){
    // Yarı saydam aura, çift parlama
    ctx.fillStyle = color; ctx.globalAlpha = 0.4; ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillRect(px+g, py+g, w, h); ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.strokeStyle = color; ctx.globalAlpha = 0.8; ctx.lineWidth = 1; ctx.strokeRect(px+g+1, py+g+1, w-2, h-2); ctx.globalAlpha = 1;
  }
  else if(theme === 'fire'){
    // Alev gradyanı (alt sıcak, üst parlak)
    const grd = ctx.createLinearGradient(px, py+size, px, py);
    grd.addColorStop(0, '#FF3D00'); grd.addColorStop(0.5, color); grd.addColorStop(1, '#FFD740');
    ctx.fillStyle = grd; ctx.shadowColor = '#FF6D00'; ctx.shadowBlur = 10;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.fillRect(px+g, py+g, w, Math.max(2, size*0.14));
  }
  else if(theme === 'glass'){
    ctx.fillStyle = color; ctx.globalAlpha = 0.32; ctx.fillRect(px+g, py+g, w, h); ctx.globalAlpha = 1;
    ctx.strokeStyle = shade(color, 60); ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.strokeRect(px+g, py+g, w, h); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(px+g, py+g, w, h*0.3);
  }
  else if(theme === 'lava'){
    const cx = px+size/2, cy = py+size/2;
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, size*0.7);
    grd.addColorStop(0, '#FFEB3B'); grd.addColorStop(0.5, '#FF5722'); grd.addColorStop(1, shade(color,-40));
    ctx.fillStyle = grd; ctx.shadowColor = '#FF3D00'; ctx.shadowBlur = 12;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
  }
  else if(theme === 'ice'){
    const grd = ctx.createLinearGradient(px, py, px+size, py+size);
    grd.addColorStop(0, shade(color, 90)); grd.addColorStop(0.5, color); grd.addColorStop(1, shade(color, 30));
    ctx.fillStyle = grd; ctx.shadowColor = '#B3E5FC'; ctx.shadowBlur = 8;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(px+g+1, py+g+1, w*0.35, h*0.35);
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1; ctx.strokeRect(px+g, py+g, w, h);
  }
  else if(theme === 'matrix'){
    ctx.fillStyle = '#0a2a0a'; ctx.fillRect(px+g, py+g, w, h);
    ctx.fillStyle = color; ctx.shadowColor = '#00FF41'; ctx.shadowBlur = 8;
    for(let i=0;i<3;i++){ ctx.fillRect(px+g+i*(w/3)+1, py+g, 2, h); }
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#00FF41'; ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.strokeRect(px+g, py+g, w, h); ctx.globalAlpha = 1;
  }
  else if(theme === 'plasma'){
    const cx = px+size/2, cy = py+size/2;
    const grd = ctx.createRadialGradient(cx, cy, 1, cx, cy, size*0.6);
    grd.addColorStop(0, '#fff'); grd.addColorStop(0.4, color); grd.addColorStop(1, shade(color,-30));
    ctx.fillStyle = grd; ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
  }
  else if(theme === 'galaxy'){
    const grd = ctx.createLinearGradient(px, py, px+size, py+size);
    grd.addColorStop(0, shade(color, 20)); grd.addColorStop(1, '#1a0a2e');
    ctx.fillStyle = grd; ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillRect(px+g, py+g, w, h); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    const seed = (x*7+y*13)%5;
    for(let i=0;i<3;i++){ const sx=px+g+((seed+i*3)%5)*(w/5)+1, sy=py+g+((seed+i*2)%5)*(h/5)+1; ctx.fillRect(sx, sy, 1.5, 1.5); }
  }
  else {
    // varsayılan neon
    ctx.fillStyle = color; ctx.fillRect(px+g, py+g, w, h);
  }
}
