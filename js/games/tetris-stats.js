// ════════════════════════════════════════════════════════════════
//  HeroTetris — İSTATİSTİK & BAŞARIM SİSTEMİ
//
//  localStorage'da oyuncu istatistiklerini tutar, oyun sonunda
//  güncellenir. Başarımlar (rozetler) kilidini açar.
// ════════════════════════════════════════════════════════════════
import { HERO_KEYS } from './tetris-heroes.js';

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
function record(value){ return value && typeof value==='object' && !Array.isArray(value) ? value : {}; }
function count(value, fallback=0){ return Number.isSafeInteger(value) && value>=fallback ? value : fallback; }
function add(s,key,value){ s[key]=Math.min(Number.MAX_SAFE_INTEGER,s[key]+count(value)); }
function normalizeStats(value){
  const raw=record(value),s=defaultStats();
  for(const key of Object.keys(s)){
    if(typeof s[key]==='number') s[key]=count(raw[key],s[key]);
  }
  const plays=record(raw.heroPlays);
  for(const key of HERO_KEYS){
    if(Object.hasOwn(plays,key) && Number.isSafeInteger(plays[key]) && plays[key]>=0) s.heroPlays[key]=plays[key];
  }
  if(HERO_KEYS.includes(raw.favoriteHero)) s.favoriteHero=raw.favoriteHero;
  return s;
}

export const Stats = {
  get(){ return normalizeStats(read(STATS_KEY, {})); },

  // Açılmış başarım id listesi
  getUnlocked(){
    const raw=read(ACH_KEY, []);
    return Array.isArray(raw) ? [...new Set(raw.filter(id=>ACHIEVEMENTS.some(a=>a.id===id)))] : [];
  },

  // Oyun sonunda istatistikleri güncelle, yeni açılan başarımları döndür
  // data: { score, lines, tetrisCount, combo, level, hero, powersUsed, gemsUsed, mode, won }
  recordGame(data){
    data=record(data);
    const s = this.get();
    add(s,'gamesPlayed',1);
    add(s,'totalScore',data.score);
    add(s,'totalLines',data.lines);
    add(s,'totalTetris',data.tetrisCount);
    s.bestScore = Math.max(s.bestScore, count(data.score));
    s.bestCombo = Math.max(s.bestCombo, count(data.combo));
    s.maxLevel = Math.max(s.maxLevel, count(data.level,1));
    add(s,'powersUsed',data.powersUsed);
    add(s,'gemsUsed',data.gemsUsed);
    if(data.won===true && data.mode === 'ai') add(s,'aiWins',1);
    if(data.won===true && data.mode === 'versus') add(s,'vsWins',1);
    if(data.won===true && data.mode === 'adventure') add(s,'bossesBeaten',1);
    // Kahraman oynama sayısı
    if(HERO_KEYS.includes(data.hero)){
      s.heroPlays[data.hero] = Math.min(Number.MAX_SAFE_INTEGER,(s.heroPlays[data.hero] || 0) + 1);
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
    s = normalizeStats(s || this.get());
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
