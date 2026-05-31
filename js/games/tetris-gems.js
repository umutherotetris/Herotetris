// ════════════════════════════════════════════════════════════════
//  HeroTetris — GEM (Süper Güç) SİSTEMİ
//
//  16 gem türü. Her parça yere konunca şansla bir gem envantere düşer.
//  "S.GÜÇ" butonu envanteri açar; gem seç → etkisi tetiklenir.
//  Aynı gemden 3 tane → ULTRA FUSION (büyük temizlik + puan).
//
//  Eski GEMS_DEF'ten birebir taşındı, etkiler api üzerinden çalışır:
//    api: { board, COLS, ROWS, emptyRow(), addScore(n), slowTime(ms),
//           clearCols(n), flash(msg) }
// ════════════════════════════════════════════════════════════════
export const GEMS = [
  { id:'bomb',    c:'#FF5252', ic:'💣',  nm:'BOMBA',     desc:'5x5 patlama',
    run:(api)=>{ const cx=Math.floor(api.COLS/2); for(let r=api.ROWS-5;r<api.ROWS;r++) for(let c=cx-2;c<=cx+2;c++){ if(r>=0&&c>=0&&c<api.COLS) api.board[r][c]=0; } api.addScore(300); return '💣 BOMBA!'; } },
  { id:'laser',   c:'#448AFF', ic:'⚡',  nm:'LAZER',     desc:'En yüksek sütunu siler',
    run:(api)=>{ let mc=0,mh=-1; for(let c=0;c<api.COLS;c++){ for(let r=0;r<api.ROWS;r++){ if(api.board[r][c]){ if(api.ROWS-r>mh){mh=api.ROWS-r;mc=c;} break; } } } for(let r=0;r<api.ROWS;r++) api.board[r][mc]=0; api.addScore(mh*40+100); return '⚡ LAZER!'; } },
  { id:'row',     c:'#69F0AE', ic:'🟩',  nm:'BLOK SİL',  desc:'En dolu 2 satır',
    run:(api)=>{ for(let k=0;k<2;k++){ let bR=-1,bF=0; for(let r=0;r<api.ROWS;r++){ const f=api.board[r].filter(c=>c).length; if(f>bF){bF=f;bR=r;} } if(bR>=0){ api.board.splice(bR,1); api.board.unshift(api.emptyRow()); } } api.addScore(250); return '🟩 BLOK SİL!'; } },
  { id:'double',  c:'#FFD740', ic:'✨',  nm:'x2 PUAN',   desc:'Anında bonus puan',
    run:(api)=>{ api.addScore(500); return '✨ x2 PUAN! +500'; } },
  { id:'web',     c:'#F44336', ic:'🕸️', nm:'ÖR. AĞI',   desc:'8 sn yavaş düşüş',
    run:(api)=>{ api.slowTime(8000); api.addScore(80); return '🕸️ ÖRÜMCEK AĞI!'; } },
  { id:'balls',   c:'#AB47BC', ic:'🎱',  nm:'TOPLAR',    desc:'Rastgele blok kırar',
    run:(api)=>{ let n=0; for(let i=0;i<20;i++){ const r=Math.floor(Math.random()*api.ROWS),c=Math.floor(Math.random()*api.COLS); if(api.board[r][c]){api.board[r][c]=0;n++;} } api.addScore(n*15+50); return '🎱 TOPLAR! '+n; } },
  { id:'tilt',    c:'#FF9800', ic:'↩️', nm:'TİLT',      desc:'Bloklar sola kayar',
    run:(api)=>{ for(let r=0;r<api.ROWS;r++){ const row=api.board[r].filter(c=>c); while(row.length<api.COLS) row.push(0); api.board[r]=row; } api.addScore(150); return '↩️ TİLT!'; } },
  { id:'supm',    c:'#2196F3', ic:'🦸',  nm:'SUPERMAN',  desc:'Alttaki 5 sırayı uçur',
    run:(api)=>{ let n=0; for(let i=0;i<5;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); n++; } } api.addScore(n*100+200); return '🦸 SUPERMAN!'; } },
  { id:'time',    c:'#00BCD4', ic:'⏰',  nm:'ZAMAN DUR', desc:'10 sn taşlar çok yavaş',
    run:(api)=>{ api.slowTime(10000); api.addScore(120); return '⏰ ZAMAN DURDU!'; } },
  { id:'kryp',    c:'#E040FB', ic:'☢',   nm:'KRİPTONİT', desc:'Büyük puan patlaması',
    run:(api)=>{ api.addScore(600); return '☢️ KRİPTONİT! +600'; } },
  { id:'phase',   c:'#FFC107', ic:'👻',  nm:'FAZLANMA',  desc:'Tahtayı seyrekleştir',
    run:(api)=>{ let n=0; for(let r=0;r<api.ROWS;r++) for(let c=0;c<api.COLS;c++){ if(api.board[r][c]&&Math.random()<0.4){api.board[r][c]=0;n++;} } api.addScore(n*12); return '👻 FAZLANMA!'; } },
  { id:'gravity', c:'#26C6DA', ic:'🌊',  nm:'YERÇEKİMİ',  desc:'Bloklar aşağı düşer',
    run:(api)=>{ for(let c=0;c<api.COLS;c++){ const col=[]; for(let r=0;r<api.ROWS;r++) if(api.board[r][c]) col.push(api.board[r][c]); const st=api.ROWS-col.length; for(let r=0;r<api.ROWS;r++) api.board[r][c]=(r>=st)?col[r-st]:0; } api.addScore(200); return '🌊 YERÇEKİMİ!'; } },
  { id:'shuffle', c:'#FF6E40', ic:'🔄',  nm:'KARIŞTIR',   desc:'Alt yarıyı temizle',
    run:(api)=>{ let n=0; for(let r=Math.floor(api.ROWS/2);r<api.ROWS;r++){ if(api.board[r].some(c=>c))n++; api.board[r]=api.emptyRow(); } api.addScore(n*60+150); return '🔄 KARIŞTIR!'; } },
  { id:'smash',   c:'#4CAF50', ic:'💪',  nm:'HULK EZME',  desc:'Alttaki 4 sırayı sıkıştır',
    run:(api)=>{ let n=0; for(let i=0;i<4;i++){ if(api.board[api.ROWS-1].some(c=>c)){ api.board.splice(api.ROWS-1,1); api.board.unshift(api.emptyRow()); n++; } } api.addScore(n*120+250); return '💪 HULK EZME!'; } },
  { id:'chaos',   c:'#9C27B0', ic:'🃏',  nm:'KAOS',       desc:'Rastgele güçlü etki',
    run:(api)=>{ if(Math.random()<0.5){ let n=0; for(let r=8;r<api.ROWS;r++){ if(api.board[r].some(c=>c))n++; api.board[r]=api.emptyRow(); } api.addScore(n*70+200); return '🃏 KAOS: TEMİZLİK!'; } api.addScore(800); return '🃏 KAOS: +800!'; } },
  { id:'magnet',  c:'#FF1744', ic:'🧲',  nm:'MIKNATIS',   desc:'Blokları merkeze çek',
    run:(api)=>{ for(let r=0;r<api.ROWS;r++){ const cells=api.board[r].filter(c=>c); const empty=api.COLS-cells.length; const left=Math.floor(empty/2); const newRow=api.emptyRow(); for(let i=0;i<cells.length;i++) newRow[left+i]=cells[i]; api.board[r]=newRow; } api.addScore(180); return '🧲 MIKNATIS!'; } }
];

export const GEM_BY_ID = {};
GEMS.forEach(g => { GEM_BY_ID[g.id] = g; });

export const GEM_MAX = 5;          // envanter kapasitesi
export const GEM_BASE_CHANCE = 0.12;  // her parça konunca temel gem şansı
export const FUSION_COUNT = 3;     // aynı gemden kaç tane → fusion

// Kahramana özel gem eğilimleri (eski oyundaki gibi)
export const HERO_GEM_BIAS = {
  fla: { chance:0.3, ids:['phase'] },
  hlk: { chance:0.3, ids:['smash','gravity'] },
  jok: { chance:0.25, ids:['chaos'] },
  nex: { chance:0.2, ids:['phase','magnet','gravity'] },
  sup: { chance:0.2, ids:['supm'] },
  kry: { chance:0.2, ids:['kryp'] },
  bat: { chance:0.2, ids:['bomb'] },
  won: { chance:0.2, ids:['double'] },
  spi: { chance:0.2, ids:['web'] }
};

// Bir gem seç (kahraman eğilimi + rastgele)
export function rollGem(heroKey){
  const bias = HERO_GEM_BIAS[heroKey];
  if(bias && Math.random() < bias.chance){
    const id = bias.ids[Math.floor(Math.random()*bias.ids.length)];
    if(GEM_BY_ID[id]) return GEM_BY_ID[id];
  }
  return GEMS[Math.floor(Math.random()*GEMS.length)];
}
