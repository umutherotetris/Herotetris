// ════════════════════════════════════════════════════════════════
//  HeroTetris — KARAKTER TANIMLARI (9 kahraman + aktif güçler)
//
//  Her kahramanın:
//    - passive: arka planda çalışan çarpanlar (apply ile yazılır)
//    - power: AKTİF imza gücü — "⚡ GÜÇ" butonuyla, görünür efektle
//        power.run(api) → board'a etki eder, mesaj döndürür
//        api: { board, COLS, ROWS, emptyRow(), addScore(n), slowTime(ms) }
// ════════════════════════════════════════════════════════════════
export const HEROES = {
  sup: {
    name: 'SUPERMAN', icon: '🦸', color: '#2196F3',
    passive: 'Taşlar %15 yavaş düşer',
    strengths: ['⚡ Hızlı bırak +50 puan', '🛡️ Çöp bloğuna direnç'],
    weaknesses: ['☢️ Kriptonit gem 2x hasar'],
    apply: (g) => { g.speedMult = 0.85; g.hardDropBonus = 50; },
    power: { name: 'LAZER GÖZLER', icon: '🔴', fx: 'laser', desc: 'En dolu satırı siler',
      run: (api) => {
        let bestR = -1, bestFill = 0;
        for(let r=0;r<api.ROWS;r++){ const f = api.board[r].filter(c=>c).length; if(f>bestFill){ bestFill=f; bestR=r; } }
        if(bestR >= 0){ api.board.splice(bestR,1); api.board.unshift(api.emptyRow()); }
        api.addScore(bestFill*60 + 150);
        return '🔴 LAZER GÖZLER!';
      } }
  },
  spi: {
    name: 'SPİDERMAN', icon: '🕷️', color: '#F44336',
    passive: 'Her döndürme +5 puan',
    strengths: ['🔄 Döndürme puanı', '💨 Yavaşça indir hızlanır'],
    weaknesses: ['🕵️ Bomba gem 1.5x hasar'],
    apply: (g) => { g.rotBonus = 5; g.softBonus = true; },
    power: { name: 'AĞ ÇEKİMİ', icon: '🕸️', fx: 'web', desc: 'Alttaki 2 sırayı boşaltır',
      run: (api) => {
        let moved = 0;
        for(let i=0;i<2;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); moved++; } }
        api.addScore(moved*80 + 100);
        return '🕸️ AĞ ÇEKİMİ!';
      } }
  },
  kry: {
    name: 'KRYPTO', icon: '🐕', color: '#AB47BC',
    passive: 'Gem şansı 2x, gem gücü +%30',
    strengths: ['💎 Gem 2x sık düşer', '☢️ Kriptonit bağışıklığı'],
    weaknesses: ['🚀 Hızlı bırak yavaşlar'],
    apply: (g) => { g.gemMult = 2; g.gemPowerBoost = 1.3; },
    power: { name: 'NÜKLEER', icon: '☢️', fx: 'nuke', desc: 'Alttaki 3 sırayı patlatır',
      run: (api) => {
        let cleared = 0;
        for(let i=0;i<3;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); cleared++; } }
        api.addScore(cleared*100 + 200);
        return '☢️ NÜKLEER PATLAMA!';
      } }
  },
  bat: {
    name: 'BATMAN', icon: '🦇', color: '#607D8B',
    passive: 'Saldırı hasarı %20 az, 2x çöp gönder',
    strengths: ['🦇 Blok silme → 2x çöp blok', '🛡️ %20 hasar azaltma'],
    weaknesses: ['🌟 Gem şansı %50 düşük'],
    apply: (g) => { g.dmgReduce = 0.8; g.garbMult = 2; g.gemMult = 0.5; },
    power: { name: 'BATARANG', icon: '🦇', fx: 'batarang', desc: 'Dağınık blokları temizler',
      run: (api) => {
        let removed = 0;
        for(let r=0;r<api.ROWS;r++) for(let c=0;c<api.COLS;c++){
          if(api.board[r][c] && Math.random() < 0.35){ api.board[r][c] = 0; removed++; }
        }
        api.addScore(removed*15 + 100);
        return '🦇 BATARANG! ' + removed + ' blok';
      } }
  },
  fla: {
    name: 'FLASH', icon: '⚡', color: '#FFC107',
    passive: 'Yavaşça indir 2x hızlı, hız bonusu +%25 puan',
    strengths: ['⚡ Yavaşça indir süper hızlı', '🏃 Hız bonusu puanlama'],
    weaknesses: ['🧊 Dondurma 2x uzun sürer'],
    apply: (g) => { g.softSpeedMult = 2; g.speedBonus = 1.25; },
    power: { name: 'ZAMAN YAVAŞLAT', icon: '🕐', fx: 'timeslow', desc: '8 sn taşlar çok yavaş',
      run: (api) => { api.slowTime(8000); api.addScore(120); return '🕐 ZAMAN YAVAŞLADI!'; } }
  },
  won: {
    name: 'WONDER WOMAN', icon: '👸', color: '#E91E63',
    passive: 'Kalkan koruma, çöp bloklara direnç %30',
    strengths: ['🛡️ Çöp blok %30 azaltma', '👑 Tiara fırlatma gücü'],
    weaknesses: ['💨 Hız bonusu yok'],
    apply: (g) => { g.garbReduce = 0.7; },
    power: { name: 'TİARA FIRLAT', icon: '👑', fx: 'tiara', desc: 'En üst dolu satırı siler',
      run: (api) => {
        for(let r=0;r<api.ROWS;r++){ if(api.board[r].some(c=>c)){ api.board.splice(r,1); api.board.unshift(api.emptyRow()); break; } }
        api.addScore(250);
        return '👑 TİARA FIRLATILDI!';
      } }
  },
  hlk: {
    name: 'HULK', icon: '💪', color: '#4CAF50',
    passive: 'Güç: %20 yavaş ama her 20 satırda sarsıntı',
    strengths: ['💪 Yerçekimi gücü', '🌋 Sarsıntı bonusu'],
    weaknesses: ['🐢 Hız %20 yavaş'],
    apply: (g) => { g.speedMult = 1.2; g.hulkQuake = true; },
    power: { name: 'SARSINTI', icon: '🌋', fx: 'quake', desc: 'Alttaki 4 sırayı yıkar',
      run: (api) => {
        let cleared = 0;
        for(let i=0;i<4;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); cleared++; } }
        api.addScore(cleared*120 + 250);
        return '🌋 HULK SARSINTI!';
      } }
  },
  jok: {
    name: 'JOKER', icon: '🃏', color: '#9C27B0',
    passive: 'Kaos: Çift gem şansı, sürpriz puanlar',
    strengths: ['🃏 Sürpriz efektler', '💎 Çift gem şansı'],
    weaknesses: ['🎲 Öngörülemez oyun'],
    apply: (g) => { g.gemMult = 1.5; g.jokerChaos = true; },
    power: { name: 'KAOS', icon: '🃏', fx: 'chaos', desc: 'Sürpriz: temizlik ya da +800',
      run: (api) => {
        if(Math.random() < 0.5){
          let n = 0; for(let r=10;r<api.ROWS;r++){ if(api.board[r].some(c=>c)) n++; api.board[r] = api.emptyRow(); }
          api.addScore(n*80 + 200);
          return '🃏 KAOS: TEMİZLİK!';
        }
        api.addScore(800);
        return '🃏 KAOS: +800!';
      } }
  },
  nex: {
    name: 'NEXUS', icon: '🌀', color: '#00E5FF',
    passive: 'Kozmik: 5 taş görünür, ölümden 1 kez kurtul',
    strengths: ['👁️ Öngörü: 5 taş', '🛡️ Enerji kalkanı'],
    weaknesses: ['🌑 Kaos gem etkisi 2x'],
    apply: (g) => { g.gemMult = 1.3; g.speedBonus = 1.1; g.nexusShield = true; g.previewCount = 5; },
    power: { name: 'KOZMİK ÇEKİM', icon: '🌀', fx: 'vortex', desc: 'Blokları aşağı sıkıştırır',
      run: (api) => {
        for(let c=0;c<api.COLS;c++){
          const col = [];
          for(let r=0;r<api.ROWS;r++){ if(api.board[r][c]) col.push(api.board[r][c]); }
          const start = api.ROWS - col.length;
          for(let r=0;r<api.ROWS;r++){ api.board[r][c] = (r >= start) ? col[r - start] : 0; }
        }
        api.addScore(300);
        return '🌀 KOZMİK ÇEKİM!';
      } }
  }
};

export const HERO_KEYS = Object.keys(HEROES);
export const DEFAULT_HERO = 'sup';

// Güç şarjı: kaç satır temizleyince güç dolar
export const POWER_CHARGE_LINES = 8;

// Oyun başında pasif çarpanları varsayılana çek
export function resetHeroMods(g){
  g.speedMult = 1;
  g.softSpeedMult = 1;
  g.speedBonus = 1;
  g.hardDropBonus = 0;
  g.rotBonus = 0;
  g.softBonus = false;
  g.gemMult = 1;
  g.gemPowerBoost = 1;
  g.dmgReduce = 1;
  g.garbMult = 1;
  g.garbReduce = 1;
  g.hulkQuake = false;
  g.jokerChaos = false;
  g.nexusShield = false;
  g.previewCount = 1;
}
