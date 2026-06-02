// ════════════════════════════════════════════════════════════════
//  HeroTetris — KARAKTER TANIMLARI (9 özgün kahraman)
//
//  Telifsiz özgün isimler (DC/Marvel referansı yok).
//  Her kahraman:
//    - passive: arka plan çarpanları (apply ile)
//    - power: aktif imza gücü (⚡ GÜÇ butonu)
//    - preview: kaç sonraki taş görünsün (2/3/4)
//    - unlock: { kaju, level } — ikisinden biri yeterli (0 = baştan açık)
// ════════════════════════════════════════════════════════════════
export const HEROES = {
  vor: {
    name: 'VORTEKS', icon: '🌀', color: '#2196F3', preview: 2,
    unlock: { kaju: 0, level: 0 },
    passive: 'Taşlar %15 yavaş düşer',
    strengths: ['⚡ Sert bırakışta +50 puan', '🛡️ Çöp bloğa direnç'],
    weaknesses: ['🌑 Kaos gem 2x etki'],
    apply: (g) => { g.speedMult = 0.85; g.hardDropBonus = 50; },
    power: { name: 'IŞIN PATLAMASI', icon: '💠', fx: 'laser', desc: 'En dolu 2 satırı siler',
      run: (api) => {
        let total = 0;
        for(let k=0;k<2;k++){
          let bestR = -1, bestFill = 0;
          for(let r=0;r<api.ROWS;r++){ const f = api.board[r].filter(c=>c).length; if(f>bestFill){ bestFill=f; bestR=r; } }
          if(bestR >= 0 && bestFill > 0){ api.board.splice(bestR,1); api.board.unshift(api.emptyRow()); total += bestFill; }
        }
        api.addScore(total*60 + 250);
        return 'IŞIN PATLAMASI!';
      } }
  },
  arak: {
    name: 'ARAKNA', icon: '🕷️', color: '#F44336', preview: 3,
    unlock: { kaju: 0, level: 0 },
    passive: 'Her döndürme +5 puan, yumuşak düşüş bonuslu',
    strengths: ['🔄 Döndürme puanı', '💨 Yavaş indirme bonusu'],
    weaknesses: ['💣 Bomba gem 1.5x'],
    apply: (g) => { g.rotBonus = 5; g.softBonus = true; },
    power: { name: 'AĞ ÇEKİMİ', icon: '🕸️', fx: 'web', desc: 'Alttaki 3 sırayı boşaltır + yavaşlatır',
      run: (api) => {
        let moved = 0;
        for(let i=0;i<3;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); moved++; } }
        api.slowTime(4000);
        api.addScore(moved*80 + 150);
        return 'AĞ ÇEKİMİ!';
      } }
  },
  ksen: {
    name: 'KSENON', icon: '🐺', color: '#AB47BC', preview: 2,
    unlock: { kaju: 2000, level: 3 },
    passive: 'Gem şansı 2x, gem gücü +%30',
    strengths: ['💎 2x sık gem', '☢️ Radyasyon bağışıklığı'],
    weaknesses: ['🚀 Sert bırakış yavaş'],
    apply: (g) => { g.gemMult = 2; g.gemPowerBoost = 1.3; },
    power: { name: 'ÇEKİRDEK PATLAMA', icon: '☢️', fx: 'nuke', desc: 'Alttaki 3 sırayı patlatır',
      run: (api) => {
        let cleared = 0;
        for(let i=0;i<3;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); cleared++; } }
        api.addScore(cleared*100 + 200);
        return 'ÇEKİRDEK PATLAMA!';
      } }
  },
  gol: {
    name: 'GÖLGE', icon: '🦇', color: '#607D8B', preview: 3,
    unlock: { kaju: 5000, level: 5 },
    passive: 'Saldırı hasarı %20 az, 2x çöp gönderir',
    strengths: ['🦇 Silme → 2x çöp blok', '🛡️ %20 hasar azaltma'],
    weaknesses: ['🌟 Gem şansı %50 az'],
    apply: (g) => { g.dmgReduce = 0.8; g.garbMult = 2; g.gemMult = 0.5; },
    power: { name: 'GÖLGE BIÇAĞI', icon: '🗡️', fx: 'batarang', desc: 'Dağınık blokları temizler',
      run: (api) => {
        let removed = 0;
        for(let r=0;r<api.ROWS;r++) for(let c=0;c<api.COLS;c++){
          if(api.board[r][c] && Math.random() < 0.45){ api.board[r][c] = 0; removed++; }
        }
        api.addScore(removed*15 + 100);
        return 'GÖLGE BIÇAĞI! ' + removed;
      } }
  },
  hiz: {
    name: 'HIZIR', icon: '⚡', color: '#FFC107', preview: 3,
    unlock: { kaju: 10000, level: 6 },
    passive: 'Yumuşak düşüş 2x hızlı, hız bonusu +%25 puan',
    strengths: ['⚡ Süper hızlı indirme', '🏃 Hız puanlaması'],
    weaknesses: ['🧊 Dondurma 2x uzun'],
    apply: (g) => { g.softSpeedMult = 2; g.speedBonus = 1.25; },
    power: { name: 'ZAMAN BÜKÜMÜ', icon: '🕐', fx: 'timeslow', desc: '8 sn taşlar çok yavaş',
      run: (api) => { api.slowTime(8000); api.addScore(120); return 'ZAMAN BÜKÜMÜ!'; } }
  },
  ELARA: {
    name: 'ELARA', icon: '👑', color: '#E91E63', preview: 3,
    unlock: { kaju: 15000, level: 7 },
    passive: 'Kalkan koruma, çöp bloklara %30 direnç',
    strengths: ['🛡️ %30 çöp azaltma', '👑 Taç fırlatma gücü'],
    weaknesses: ['💨 Hız bonusu yok'],
    apply: (g) => { g.garbReduce = 0.7; },
    power: { name: 'TAÇ FIRLAT', icon: '👑', fx: 'tiara', desc: 'En üst dolu satırı siler',
      run: (api) => {
        for(let r=0;r<api.ROWS;r++){ if(api.board[r].some(c=>c)){ api.board.splice(r,1); api.board.unshift(api.emptyRow()); break; } }
        api.addScore(250);
        return 'TAÇ FIRLATILDI!';
      } }
  },
  golem: {
    name: 'GOLEM', icon: '💪', color: '#4CAF50', preview: 2,
    unlock: { kaju: 25000, level: 8 },
    passive: '%20 yavaş ama her 20 satırda sarsıntı',
    strengths: ['💪 Yerçekimi gücü', '🌋 Sarsıntı bonusu'],
    weaknesses: ['🐢 %20 yavaş hareket'],
    apply: (g) => { g.speedMult = 1.2; g.hulkQuake = true; },
    power: { name: 'YIKIM SARSINTI', icon: '🌋', fx: 'quake', desc: 'Alttaki 4 sırayı yıkar',
      run: (api) => {
        let cleared = 0;
        for(let i=0;i<4;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); cleared++; } }
        api.addScore(cleared*120 + 250);
        return 'YIKIM SARSINTI!';
      } }
  },
  pal: {
    name: 'PALYAÇO', icon: '🃏', color: '#9C27B0', preview: 2,
    unlock: { kaju: 50000, level: 9 },
    passive: 'Kaos: çift gem şansı, sürpriz puanlar',
    strengths: ['🃏 Sürpriz efektler', '💎 Çift gem şansı'],
    weaknesses: ['🎲 Öngörülemez'],
    apply: (g) => { g.gemMult = 1.5; g.jokerChaos = true; },
    power: { name: 'KAOS KARTI', icon: '🃏', fx: 'chaos', desc: 'Sürpriz: temizlik ya da +800',
      run: (api) => {
        if(Math.random() < 0.5){
          let n = 0; for(let r=8;r<api.ROWS;r++){ if(api.board[r].some(c=>c)) n++; api.board[r] = api.emptyRow(); }
          api.addScore(n*80 + 200);
          return 'KAOS: TEMİZLİK!';
        }
        api.addScore(800);
        return 'KAOS: +800!';
      } }
  },
  neks: {
    name: 'NEKSUS', icon: '🌌', color: '#00E5FF', preview: 4,
    unlock: { kaju: 100000, level: 10 },
    passive: 'Kozmik: 4 sonraki taş görünür, ölümden 1 kez kurtulur',
    strengths: ['👁️ Öngörü: 4 taş', '🛡️ Enerji kalkanı: 1 kez'],
    weaknesses: ['🌑 Kaos gem 2x etki'],
    apply: (g) => { g.gemMult = 1.3; g.speedBonus = 1.1; g.nexusShield = true; },
    power: { name: 'KOZMİK ÇEKİM', icon: '🌌', fx: 'vortex', desc: 'Blokları aşağı sıkıştırır',
      run: (api) => {
        for(let c=0;c<api.COLS;c++){
          const col = [];
          for(let r=0;r<api.ROWS;r++){ if(api.board[r][c]) col.push(api.board[r][c]); }
          const start = api.ROWS - col.length;
          for(let r=0;r<api.ROWS;r++){ api.board[r][c] = (r >= start) ? col[r - start] : 0; }
        }
        api.addScore(300);
        return 'KOZMİK ÇEKİM!';
      } }
  }
};

export const HERO_KEYS = Object.keys(HEROES);
export const DEFAULT_HERO = 'vor';
export const POWER_CHARGE_LINES = 8;

// Kilit kontrolü: kaju VEYA level yeterli (biri sağlanırsa açık)
export function isHeroUnlocked(key, kaju, level){
  const h = HEROES[key]; if(!h) return false;
  const u = h.unlock || { kaju:0, level:0 };
  if((u.kaju||0) <= 0 && (u.level||0) <= 0) return true;   // baştan açık
  if((u.kaju||0) > 0 && (kaju||0) >= u.kaju) return true;   // kaju yeterli
  if((u.level||0) > 0 && (level||0) >= u.level) return true; // level yeterli
  return false;
}

// Kilit açılma metni (kilitliyken kartta gösterilir)
export function unlockText(key){
  const u = (HEROES[key] && HEROES[key].unlock) || {};
  const parts = [];
  if(u.kaju) parts.push(u.kaju.toLocaleString('tr-TR') + ' 🥜');
  if(u.level) parts.push('Lv' + u.level);
  return parts.join(' veya ');
}

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
