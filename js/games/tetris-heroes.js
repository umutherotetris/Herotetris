// ════════════════════════════════════════════════════════════════
//  HeroTetris — KARAKTER TANIMLARI (9 kahraman)
//
//  Eski CHAR_DEFS'ten birebir taşındı. Her kahramanın:
//    - passive: açıklama metni
//    - strengths/weaknesses: kart için
//    - apply(g): oyun durumuna pasif çarpanları yazar
//    - power: aktif "Hero Kullan" yeteneği (Katman 3'te tam bağlanacak)
//
//  Katman 1: passive güçler aktif. Aktif power'lar tanımlı ama
//  gem/saldırı sistemi (Katman 3) gelince tam devreye girer.
// ════════════════════════════════════════════════════════════════
export const HEROES = {
  sup: {
    name: 'SUPERMAN', icon: '🦸', color: '#2196F3',
    passive: 'Taşlar %15 yavaş düşer',
    strengths: ['⚡ Hızlı bırak +50 puan', '🛡️ Çöp bloğuna direnç'],
    weaknesses: ['☢️ Kriptonit gem 2x hasar', '🕷️ Spider web 3x uzun'],
    apply: (g) => { g.speedMult = 0.85; g.hardDropBonus = 50; }
  },
  spi: {
    name: 'SPİDERMAN', icon: '🕷️', color: '#F44336',
    passive: 'Her döndürme +5 puan',
    strengths: ['🔄 Döndürme puanı', '💨 Yavaşça indir hızlanır'],
    weaknesses: ['🕵️ Bomba gem 1.5x hasar'],
    apply: (g) => { g.rotBonus = 5; g.softBonus = true; }
  },
  kry: {
    name: 'KRYPTO', icon: '🐕', color: '#AB47BC',
    passive: 'Gem şansı 2x, gem gücü +%30',
    strengths: ['💎 Gem 2x sık düşer', '☢️ Kriptonit bağışıklığı'],
    weaknesses: ['🚀 Hızlı bırak yavaşlar'],
    apply: (g) => { g.gemMult = 2; g.gemPowerBoost = 1.3; }
  },
  bat: {
    name: 'BATMAN', icon: '🦇', color: '#607D8B',
    passive: 'Saldırı hasarı %20 az, 2x çöp gönder',
    strengths: ['🦇 Blok silme → 2x çöp blok', '🛡️ %20 hasar azaltma'],
    weaknesses: ['🌟 Gem şansı %50 düşük'],
    apply: (g) => { g.dmgReduce = 0.8; g.garbMult = 2; g.gemMult = 0.5; }
  },
  fla: {
    name: 'FLASH', icon: '⚡', color: '#FFC107',
    passive: 'Yavaşça indir 2x hızlı, hız bonusu +%25 puan',
    strengths: ['⚡ Yavaşça indir süper hızlı', '🏃 Hız bonusu puanlama'],
    weaknesses: ['🧊 Dondurma 2x uzun sürer'],
    apply: (g) => { g.softSpeedMult = 2; g.speedBonus = 1.25; }
  },
  won: {
    name: 'WONDER WOMAN', icon: '👸', color: '#E91E63',
    passive: 'Kalkan koruma, çöp bloklara direnç %30',
    strengths: ['🛡️ Çöp blok %30 azaltma', '👑 Tiara fırlatma gücü'],
    weaknesses: ['💨 Hız bonusu yok'],
    apply: (g) => { g.garbReduce = 0.7; }
  },
  hlk: {
    name: 'HULK', icon: '💪', color: '#4CAF50',
    passive: 'Güç: Her 20 satırda otomatik alt sıra temizliği',
    strengths: ['💪 Yerçekimi gücü', '🌋 Sarsıntı: Her 20 satırda bonus'],
    weaknesses: ['🐢 Hız %20 yavaş'],
    apply: (g) => { g.speedMult = 1.2; g.hulkQuake = true; }  // speedMult>1 = yavaş
  },
  jok: {
    name: 'JOKER', icon: '🃏', color: '#9C27B0',
    passive: 'Kaos: Çift gem şansı, sürpriz puanlar',
    strengths: ['🃏 Her 10 blokta sürpriz', '💎 Çift gem şansı'],
    weaknesses: ['🎲 Öngörülemez oyun'],
    apply: (g) => { g.gemMult = 1.5; g.jokerChaos = true; }
  },
  nex: {
    name: 'NEXUS', icon: '🌀', color: '#00E5FF',
    passive: 'Kozmik: Sonraki 5 taş görünür, ölümden 1 kez kurtul',
    strengths: ['👁️ Öngörü: 5 taş görünür', '🛡️ Enerji kalkanı: 1 kez kurtul'],
    weaknesses: ['🌑 Kaos gem etkisi 2x'],
    apply: (g) => { g.gemMult = 1.3; g.speedBonus = 1.1; g.nexusShield = true; g.previewCount = 5; }
  }
};

export const HERO_KEYS = Object.keys(HEROES);
export const DEFAULT_HERO = 'sup';

// Oyun başında pasif çarpanları sıfırla (varsayılan değerler)
export function resetHeroMods(g){
  g.speedMult = 1;        // <1 hızlı, >1 yavaş (düşme aralığı çarpanı)
  g.softSpeedMult = 1;    // yumuşak düşüş çarpanı
  g.speedBonus = 1;       // puan çarpanı
  g.hardDropBonus = 0;    // sert düşüşte ek puan
  g.rotBonus = 0;         // döndürme başına puan
  g.softBonus = false;
  g.gemMult = 1;
  g.gemPowerBoost = 1;
  g.dmgReduce = 1;
  g.garbMult = 1;
  g.garbReduce = 1;
  g.hulkQuake = false;
  g.jokerChaos = false;
  g.nexusShield = false;
  g.previewCount = 1;     // kaç sonraki taş gösterilsin (Nexus = 5)
}
