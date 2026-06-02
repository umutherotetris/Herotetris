// ════════════════════════════════════════════════════════════════
//  HeroTetris — İSTATİSTİK & BAŞARIM SİSTEMİ
//
//  localStorage'da oyuncu istatistiklerini tutar, oyun sonunda
//  güncellenir. Başarımlar (rozetler) kilidini açar.
// ════════════════════════════════════════════════════════════════

const STATS_KEY = 'hero_tetris_stats';
const ACH_KEY   = 'hero_tetris_achievements';

// Varsayılan istatistik şeması
function defaultStats(){
  return {
    gamesPlayed: 0,
    totalScore: 0,
    totalLines: 0,
    totalTetris: 0,      // 4'lü temizleme sayısı
    bestScore: 0,
    bestCombo: 0,
    maxLevel: 1,
    powersUsed: 0,
    gemsUsed: 0,
    aiWins: 0,
    vsWins: 0,
    bossesBeaten: 0,
    favoriteHero: null,  // en çok oynanan kahraman
    heroPlays: {}        // { heroKey: oynanmaSayısı }
  };
}

// Başarım tanımları — koşullar stats üzerinden kontrol edilir
export const ACHIEVEMENTS = [
  { id:'first_game',   icon:'🎮', name:'İLK ADIM',        desc:'İlk oyununu oyna',           check:s=>s.gamesPlayed>=1 },
  { id:'first_tetris', icon:'🔥', name:'İLK TETRİS',      desc:'4 satırı birden temizle',    check:s=>s.totalTetris>=1 },
  { id:'combo5',       icon:'⚡', name:'KOMBO USTASI',    desc:'5x combo yap',               check:s=>s.bestCombo>=5 },
  { id:'combo10',      icon:'🌟', name:'KOMBO KRALI',     desc:'10x combo yap',              check:s=>s.bestCombo>=10 },
  { id:'score10k',     icon:'💯', name:'ON BİNLİK',       desc:'Tek oyunda 10.000 puan',     check:s=>s.bestScore>=10000 },
  { id:'score50k',     icon:'💎', name:'ELLİ BİNLİK',     desc:'Tek oyunda 50.000 puan',     check:s=>s.bestScore>=50000 },
  { id:'lines100',     icon:'📊', name:'YÜZ SATIR',       desc:'Toplam 100 satır temizle',   check:s=>s.totalLines>=100 },
  { id:'lines1000',    icon:'🏗️', name:'BİN SATIR',       desc:'Toplam 1000 satır temizle',  check:s=>s.totalLines>=1000 },
  { id:'level10',      icon:'🚀', name:'SEVİYE 10',       desc:'Seviye 10\'a ulaş',          check:s=>s.maxLevel>=10 },
  { id:'games10',      icon:'🎯', name:'DÜZENLİ OYUNCU',  desc:'10 oyun oyna',               check:s=>s.gamesPlayed>=10 },
  { id:'games50',      icon:'🏅', name:'BAĞIMLI',         desc:'50 oyun oyna',               check:s=>s.gamesPlayed>=50 },
  { id:'power20',      icon:'💥', name:'GÜÇ KULLANICISI', desc:'20 kahraman gücü kullan',    check:s=>s.powersUsed>=20 },
  { id:'gem20',        icon:'💠', name:'GEM AVCISI',      desc:'20 gem kullan',              check:s=>s.gemsUsed>=20 },
  { id:'ai_win',       icon:'🤖', name:'YZ KATİLİ',       desc:'AI rakibi yen',              check:s=>s.aiWins>=1 },
  { id:'vs_win',       icon:'🌐', name:'ŞAMPİYON',        desc:'Çok oyuncuda kazan',         check:s=>s.vsWins>=1 },
  { id:'boss',         icon:'👹', name:'BOSS AVCISI',     desc:'Bir boss yen',               check:s=>s.bossesBeaten>=1 },
  { id:'tetris10',     icon:'🎆', name:'TETRİS MAKİNESİ', desc:'10 tetris yap',              check:s=>s.totalTetris>=10 }
];

function read(key, def){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : def; }catch(e){ return def; }
}
function write(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
}

export const Stats = {
  get(){ return Object.assign(defaultStats(), read(STATS_KEY, {})); },

  // Açılmış başarım id listesi
  getUnlocked(){ return read(ACH_KEY, []); },

  // Oyun sonunda istatistikleri güncelle, yeni açılan başarımları döndür
  // data: { score, lines, tetrisCount, combo, level, hero, powersUsed, gemsUsed, mode, won }
  recordGame(data){
    const s = this.get();
    s.gamesPlayed++;
    s.totalScore += data.score || 0;
    s.totalLines += data.lines || 0;
    s.totalTetris += data.tetrisCount || 0;
    s.bestScore = Math.max(s.bestScore, data.score || 0);
    s.bestCombo = Math.max(s.bestCombo, data.combo || 0);
    s.maxLevel = Math.max(s.maxLevel, data.level || 1);
    s.powersUsed += data.powersUsed || 0;
    s.gemsUsed += data.gemsUsed || 0;
    if(data.won && data.mode === 'ai') s.aiWins++;
    if(data.won && data.mode === 'versus') s.vsWins++;
    if(data.won && data.mode === 'adventure') s.bossesBeaten++;
    // Kahraman oynama sayısı
    if(data.hero){
      s.heroPlays[data.hero] = (s.heroPlays[data.hero] || 0) + 1;
      let best = null, bestN = 0;
      for(const k in s.heroPlays){ if(s.heroPlays[k] > bestN){ bestN = s.heroPlays[k]; best = k; } }
      s.favoriteHero = best;
    }
    write(STATS_KEY, s);
    // Başarım kontrolü
    return this.checkAchievements(s);
  },

  // Stats'a göre yeni açılan başarımları bul + kaydet, yeni açılanları döndür
  checkAchievements(s){
    s = s || this.get();
    const unlocked = this.getUnlocked();
    const newly = [];
    ACHIEVEMENTS.forEach(a => {
      if(!unlocked.includes(a.id) && a.check(s)){
        unlocked.push(a.id);
        newly.push(a);
      }
    });
    if(newly.length) write(ACH_KEY, unlocked);
    return newly;
  },

  reset(){ write(STATS_KEY, defaultStats()); write(ACH_KEY, []); }
};

export default Stats;
