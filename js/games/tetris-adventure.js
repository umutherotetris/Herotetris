// ════════════════════════════════════════════════════════════════
//  HeroTetris — MACERA MODU (8 dünya, bölüm sistemi)
//
//  Her dünya: hedef satır/blok, boss adı, yıldız puanı, kilit.
//  Bölüm tamamlanınca sonraki açılır. İlerleme localStorage'da.
//  Eski sürümdeki dünyalar birebir korundu.
// ════════════════════════════════════════════════════════════════
export const WORLDS = [
  { id:1, name:'UZAY OVASI',      icon:'🌌', color:'#7E57C2', target:10,  boss:'KARA DELİK',    desc:'Yıldızlar arasında hayatta kal' },
  { id:2, name:'DERİN OKYANUS',   icon:'🌊', color:'#29B6F6', target:25,  boss:'KRAKEN',        desc:'Dalgaları geç, derine dal' },
  { id:3, name:'VOLKAN KAPISI',   icon:'🌋', color:'#FF5722', target:40,  boss:'LAV DEVİ',      desc:'Lavın yükselmesini durdur' },
  { id:4, name:'GİZEMLİ ORMAN',   icon:'🌴', color:'#66BB6A', target:55,  boss:'ÖRÜMCEK KRAL',  desc:'Ormanda kaybolma' },
  { id:5, name:'KOZMOS KALESİ',   icon:'⚡', color:'#FFD740', target:80,  boss:'GALAKSİ TİRAN', desc:'Nihai savaş başlıyor' },
  { id:6, name:'BUZUL TAPINAĞI',  icon:'🧊', color:'#4FC3F7', target:100, boss:'BUZ KRALI',     desc:'Dondurucu soğukta hayatta kal' },
  { id:7, name:'ÇÖL FIRTINASI',   icon:'🏜️', color:'#FFA726', target:120, boss:'KUM YILANI',    desc:'Kum fırtınasından sağ çık' },
  { id:8, name:'GÖLGE BOYUTU',    icon:'🌑', color:'#AB47BC', target:150, boss:'GÖLGE LORD',    desc:'Son sınav, karanlıkla yüzleş' }
];

const PROGRESS_KEY = 'hero_tetris_adventure';

// İlerlemeyi oku: { completed:[1,2], stars:{1:3,2:2} }
export function getProgress(){
  try{
    const d = localStorage.getItem(PROGRESS_KEY);
    if(d){ const p = JSON.parse(d); return { completed: p.completed||[], stars: p.stars||{} }; }
  }catch(e){}
  return { completed: [], stars: {} };
}
function saveProgress(p){
  try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }catch(e){}
}

// Dünya kilidi açık mı? (1. her zaman açık, sonrakiler önceki tamamlanınca)
export function isWorldUnlocked(worldId){
  if(worldId <= 1) return true;
  const p = getProgress();
  return p.completed.indexOf(worldId - 1) >= 0;
}

// Dünya tamamla + yıldız kaydet (1-3 yıldız)
export function completeWorld(worldId, stars){
  const p = getProgress();
  if(p.completed.indexOf(worldId) < 0) p.completed.push(worldId);
  if(!p.stars[worldId] || stars > p.stars[worldId]) p.stars[worldId] = stars;
  saveProgress(p);
}

// Performansa göre yıldız (hedefe göre fazladan satır)
export function calcStars(worldId, linesCleared){
  const w = WORLDS.find(x => x.id === worldId);
  if(!w) return 1;
  if(linesCleared >= w.target * 1.5) return 3;
  if(linesCleared >= w.target * 1.2) return 2;
  return 1;
}

export function getWorld(id){ return WORLDS.find(w => w.id === id); }
