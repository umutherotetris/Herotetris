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
    power: { name: 'IŞIN PATLAMASI', icon: '💠', fx: 'laser', desc: 'En dolu 2 satırı yok eder',
      run: (api) => { const n = api.clearFullest(2); api.addScore(n*60 + 250); return 'IŞIN PATLAMASI!'; } }
  },
  arak: {
    name: 'ARAKNA', icon: '🕷️', color: '#F44336', preview: 3,
    unlock: { kaju: 0, level: 0 },
    passive: 'Her döndürme +5 puan, yumuşak düşüş bonuslu',
    strengths: ['🔄 Döndürme puanı', '💨 Yavaş indirme bonusu'],
    weaknesses: ['💣 Bomba gem 1.5x'],
    apply: (g) => { g.rotBonus = 5; g.softBonus = true; },
    power: { name: 'AĞ ÇEKİMİ', icon: '🕸️', fx: 'web', desc: 'Alttaki 3 sırayı sök + 4sn yavaşlat',
      run: (api) => { const m = api.clearBottom(3); api.slowTime(4000); api.addScore(m*80 + 150); return 'AĞ ÇEKİMİ!'; } }
  },
  ksen: {
    name: 'KSENON', icon: '🐺', color: '#AB47BC', preview: 2,
    unlock: { kaju: 2000, level: 3 },
    passive: 'Gem şansı 2x, gem gücü +%30',
    strengths: ['💎 2x sık gem', '☢️ Radyasyon bağışıklığı'],
    weaknesses: ['🚀 Sert bırakış yavaş'],
    apply: (g) => { g.gemMult = 2; g.gemPowerBoost = 1.3; },
    power: { name: 'PARÇACIK FIRTINASI', icon: '☢️', fx: 'nuke', desc: 'Blokların yarısını buharlaştırır',
      run: (api) => { const r = api.scatter(0.5); api.gravity(); api.addScore(r*15 + 200); return 'PARÇACIK FIRTINASI!'; } }
  },
  gol: {
    name: 'GÖLGE', icon: '🦇', color: '#607D8B', preview: 3,
    unlock: { kaju: 5000, level: 5 },
    passive: 'Saldırı hasarı %20 az, 2x çöp gönderir',
    strengths: ['🦇 Silme → 2x çöp blok', '🛡️ %20 hasar azaltma'],
    weaknesses: ['🌟 Gem şansı %50 az'],
    apply: (g) => { g.dmgReduce = 0.8; g.garbMult = 2; g.gemMult = 0.5; },
    power: { name: 'GÖLGE BIÇAĞI', icon: '🗡️', fx: 'batarang', desc: 'Blokları gölgeye çeker (%45)',
      run: (api) => { const removed = api.scatter(0.45); api.addScore(removed*18 + 150); return 'GÖLGE BIÇAĞI! ' + removed; } }
  },
  hiz: {
    name: 'HIZIR', icon: '⚡', color: '#FFC107', preview: 3,
    unlock: { kaju: 10000, level: 6 },
    passive: 'Yumuşak düşüş 2x hızlı, hız bonusu +%25 puan',
    strengths: ['⚡ Süper hızlı indirme', '🏃 Hız puanlaması'],
    weaknesses: ['🧊 Dondurma 2x uzun'],
    apply: (g) => { g.softSpeedMult = 2; g.speedBonus = 1.25; },
    power: { name: 'ŞİMŞEK ÇAKMASI', icon: '⚡', fx: 'timeslow', desc: 'En yüksek 2 sütunu vurur + 5sn yavaşlat',
      run: (api) => { let h = api.clearTallest(); h += api.clearTallest(); api.slowTime(5000); api.addScore(h*40 + 180); return 'ŞİMŞEK ÇAKMASI!'; } }
  },
  ELARA: {
    name: 'ELARA', icon: '👑', color: '#E91E63', preview: 3,
    unlock: { kaju: 15000, level: 7 },
    passive: 'Kalkan koruma, çöp bloklara %30 direnç',
    strengths: ['🛡️ %30 çöp azaltma', '👑 Taç fırlatma gücü'],
    weaknesses: ['💨 Hız bonusu yok'],
    apply: (g) => { g.garbReduce = 0.7; },
    power: { name: 'KRALİÇE TACI', icon: '👑', fx: 'tiara', desc: 'En dolu satırı sil + büyük puan',
      run: (api) => { const n = api.clearFullest(1); api.addScore(n*80 + 400); return 'KRALİÇE TACI!'; } }
  },
  golem: {
    name: 'GOLEM', icon: '💪', color: '#4CAF50', preview: 2,
    unlock: { kaju: 25000, level: 8 },
    passive: '%20 yavaş ama her 20 satırda sarsıntı',
    strengths: ['💪 Yerçekimi gücü', '🌋 Sarsıntı bonusu'],
    weaknesses: ['🐢 %20 yavaş hareket'],
    apply: (g) => { g.speedMult = 1.2; g.golemQuake = true; },
    power: { name: 'YER SARSINTISI', icon: '🌋', fx: 'quake', desc: 'Alttaki 4 sırayı paramparça eder',
      run: (api) => { const m = api.clearBottom(4); api.addScore(m*90 + 200); return 'YER SARSINTISI!'; } }
  },
  pal: {
    name: 'PALYAÇO', icon: '🃏', color: '#9C27B0', preview: 2,
    unlock: { kaju: 50000, level: 9 },
    passive: 'Kaos: çift gem şansı, sürpriz puanlar',
    strengths: ['🃏 Sürpriz efektler', '💎 Çift gem şansı'],
    weaknesses: ['🎲 Öngörülemez'],
    apply: (g) => { g.gemMult = 1.5; g.clownChaos = true; },
    power: { name: 'KAOS KARTI', icon: '🃏', fx: 'chaos', desc: 'Sürpriz: ya temizlik ya +800 puan',
      run: (api) => {
        if(Math.random() < 0.5){
          const n = api.scatter(0.6); api.gravity();
          api.addScore(n*15 + 200);
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
    power: { name: 'KOZMİK ÇEKİM', icon: '🌌', fx: 'vortex', desc: 'Kara delik: blokları sıkıştırır + temizler',
      run: (api) => { api.gravity(); const n = api.clearFullest(2); api.addScore(n*70 + 300); return 'KOZMİK ÇEKİM!'; } }
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
  g.golemQuake = false;
  g.clownChaos = false;
  g.nexusShield = false;
  g.previewCount = 1;
}
