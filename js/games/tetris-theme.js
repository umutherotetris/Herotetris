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
  else {
    // varsayılan neon
    ctx.fillStyle = color; ctx.fillRect(px+g, py+g, w, h);
  }
}
