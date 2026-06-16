// ═══════════════════════════════════════════════════════════════
//  Hero Oyun Portalı — ROZET SİSTEMİ (Badge System)
//  Kalite seviyeli rozetler — otomatik + admin verebilir
// ═══════════════════════════════════════════════════════════════
import { Auth, db, fdb } from './auth.js';

// ── Rozet kaliteleri (rarity) ────────────────────────────────
export const BADGE_RARITY = {
  common:    { label:'Sıradan',   color:'#9fb0d8', glow:'rgba(159,176,216,.4)' },
  rare:      { label:'Nadir',     color:'#42A5F5', glow:'rgba(66,165,245,.5)' },
  epic:      { label:'Epik',      color:'#AB47BC', glow:'rgba(171,71,188,.55)' },
  legendary: { label:'Efsanevi',  color:'#FFB300', glow:'rgba(255,179,0,.6)' },
  mythic:    { label:'Mitik',     color:'#FF5252', glow:'rgba(255,82,82,.65)' },
  special:   { label:'Özel',      color:'#00E5FF', glow:'rgba(0,229,255,.6)' },
};

// ── Tüm rozet tanımları ──────────────────────────────────────
// auto: otomatik kazanılır (koşul kontrol edilir)
// adminOnly: sadece admin verebilir
export const BADGES = {
  // ── Seviye rozetleri ──
  first_step:   { icon:'👣', name:'İlk Adım',      desc:'Seviye 2\'ye ulaş',           rarity:'common',    cond:(p)=>(p.level||1)>=2 },
  rising:       { icon:'🚀', name:'Yükselen',       desc:'Seviye 5\'e ulaş',           rarity:'common',    cond:(p)=>(p.level||1)>=5 },
  master:       { icon:'🌟', name:'Usta',           desc:'Seviye 10\'a ulaş',          rarity:'rare',      cond:(p)=>(p.level||1)>=10 },
  grandmaster:  { icon:'👑', name:'Büyük Usta',     desc:'Seviye 25\'e ulaş',          rarity:'epic',      cond:(p)=>(p.level||1)>=25 },
  legend_lvl:   { icon:'⚡', name:'Efsane',         desc:'Seviye 50\'ye ulaş',         rarity:'legendary', cond:(p)=>(p.level||1)>=50 },
  // ── Kaju rozetleri ──
  saver:        { icon:'🥜', name:'Birikimci',      desc:'10.000 Kaju biriktir',       rarity:'common',    cond:(p)=>(p.kaju||0)>=10000 },
  rich:         { icon:'🤑', name:'Zengin',         desc:'100.000 Kaju biriktir',      rarity:'rare',      cond:(p)=>(p.kaju||0)>=100000 },
  millionaire:  { icon:'💎', name:'Milyoner',       desc:'1.000.000 Kaju biriktir',    rarity:'epic',      cond:(p)=>(p.kaju||0)>=1000000 },
  tycoon:       { icon:'🏦', name:'Kodaman',        desc:'5.000.000 Kaju biriktir',    rarity:'legendary', cond:(p)=>(p.kaju||0)>=5000000 },
  // ── Sosyal rozetleri ──
  social:       { icon:'👥', name:'Sosyal',         desc:'3 arkadaş edin',             rarity:'common',    cond:(p,x)=>(x.frCount||0)>=3 },
  popular:      { icon:'🦋', name:'Popüler',        desc:'10 arkadaş edin',            rarity:'rare',      cond:(p,x)=>(x.frCount||0)>=10 },
  influencer:   { icon:'🌐', name:'Fenomen',        desc:'25 arkadaş edin',            rarity:'epic',      cond:(p,x)=>(x.frCount||0)>=25 },
  // ── Oyun rozetleri ──
  tetris_ace:   { icon:'🧱', name:'Tetrisçi',       desc:'Tetris rekoru kır',          rarity:'common',    cond:(p)=>!!(p.bestScores&&p.bestScores.tetris) },
  chess_ace:    { icon:'♟️', name:'Stratejist',     desc:'Satranç rekoru kır',         rarity:'common',    cond:(p)=>!!(p.bestScores&&p.bestScores.chess) },
  tavla_ace:    { icon:'🎲', name:'Tavlacı',        desc:'Tavla rekoru kır',           rarity:'common',    cond:(p)=>!!(p.bestScores&&p.bestScores.tavla) },
  word_ace:     { icon:'🔤', name:'Kelime Kurdu',   desc:'30+ puanlık kelime yap',     rarity:'rare',      cond:(p)=>!!(p.kelimeRecords&&p.kelimeRecords.best&&p.kelimeRecords.best.score>=30) },
  all_rounder:  { icon:'🎯', name:'Çok Yönlü',      desc:'4 oyunda da rekor kır',      rarity:'epic',      cond:(p)=>{const b=p.bestScores||{};return !!(b.tetris&&b.chess&&b.tavla)&&!!(p.kelimeRecords&&p.kelimeRecords.best);} },
  // ── Kozmos rozetleri ──
  egg_hatcher:  { icon:'🥚', name:'Yumurtacı',      desc:'İlk kozmonu doğur',          rarity:'rare',      cond:(p,x)=>(x.creatureCount||0)>=1 },
  collector:    { icon:'🦄', name:'Koleksiyoncu',   desc:'5 kozmo topla',              rarity:'epic',      cond:(p,x)=>(x.creatureCount||0)>=5 },
  // ── Kişiselleştirme ──
  stylish:      { icon:'🎭', name:'Karakterli',     desc:'Avatar seç',                 rarity:'common',    cond:(p)=>!!p.avatar },
  decorated:    { icon:'🖼️', name:'Süslü',          desc:'Profil çerçevesi seç',       rarity:'common',    cond:(p)=>!!p.frame },
  // ── Özel/Admin rozetleri (sadece admin verir) ──
  founder:      { icon:'🏛️', name:'Kurucu',         desc:'Portalın ilk üyelerinden',   rarity:'mythic',    adminOnly:true },
  vip:          { icon:'💠', name:'VIP',            desc:'Özel VIP üyesi',             rarity:'legendary', adminOnly:true },
  beta_tester:  { icon:'🧪', name:'Beta Testçi',    desc:'Beta sürümü test etti',      rarity:'special',   adminOnly:true },
  champion:     { icon:'🏆', name:'Şampiyon',       desc:'Bir turnuva kazandı',        rarity:'legendary', adminOnly:true },
  helper:       { icon:'🤝', name:'Yardımsever',    desc:'Topluluğa katkıda bulundu',  rarity:'epic',      adminOnly:true },
  artist:       { icon:'🎨', name:'Sanatçı',        desc:'Yaratıcı içerik üretti',     rarity:'epic',      adminOnly:true },
  bug_hunter:   { icon:'🐛', name:'Hata Avcısı',    desc:'Önemli bir hata buldu',      rarity:'rare',      adminOnly:true },
  moderator:    { icon:'🛡️', name:'Moderatör',      desc:'Sohbet operatörü',           rarity:'special',   adminOnly:true },
  legend_badge: { icon:'⭐', name:'Efsane Üye',     desc:'Portal efsanesi',            rarity:'mythic',    adminOnly:true },
};

// ── Kullanıcının rozetlerini al (otomatik + verilen) ─────────
export async function getUserBadges(uid, profileData){
  let p = profileData;
  if(!p){
    try{ const s=await fdb.get(fdb.ref(db,'users/'+uid)); p = s.exists()?s.val():{}; }catch(e){ p={}; }
  }
  // Ekstra veri (arkadaş + kozmo sayısı)
  let frCount=0, creatureCount=0;
  try{ const s=await fdb.get(fdb.ref(db,'friends/'+uid)); if(s.exists()) frCount=Object.keys(s.val()).length; }catch(e){}
  try{ const s=await fdb.get(fdb.ref(db,'kozmos/'+uid+'/creatures')); if(s.exists()) creatureCount=Object.keys(s.val()).length; }catch(e){}
  const x = { frCount, creatureCount };
  // Admin tarafından verilen rozetler
  let awarded = {};
  try{ const s=await fdb.get(fdb.ref(db,'users/'+uid+'/badges')); if(s.exists()) awarded=s.val()||{}; }catch(e){}

  const result = [];
  for(const key of Object.keys(BADGES)){
    const b = BADGES[key];
    let earned = false;
    if(b.adminOnly){
      earned = awarded[key] === true;
    } else if(b.cond){
      earned = !!b.cond(p, x) || awarded[key] === true;
    }
    result.push({ key, ...b, earned });
  }
  return result;
}

// ── Admin: rozet ver / al ────────────────────────────────────
export async function awardBadge(uid, badgeKey, targetName){
  const me = Auth.getState();
  if(me.isAdmin !== true) return { ok:false, error:'Yetki yok' };
  if(!BADGES[badgeKey]) return { ok:false, error:'Geçersiz rozet' };
  try{
    await fdb.update(fdb.ref(db,'users/'+uid+'/badges'), { [badgeKey]: true });
    const b = BADGES[badgeKey];
    await fdb.push(fdb.ref(db,'userNotifs/'+uid), { icon:b.icon, text:'🏅 Yeni rozet kazandın: '+b.name+'!', ts:Date.now() });
    return { ok:true };
  }catch(e){ return { ok:false, error:e.message||'Hata' }; }
}
export async function revokeBadge(uid, badgeKey){
  const me = Auth.getState();
  if(me.isAdmin !== true) return { ok:false, error:'Yetki yok' };
  try{
    await fdb.update(fdb.ref(db,'users/'+uid+'/badges'), { [badgeKey]: null });
    return { ok:true };
  }catch(e){ return { ok:false, error:e.message||'Hata' }; }
}
export async function resetBadges(uid){
  const me = Auth.getState();
  if(me.isAdmin !== true) return { ok:false, error:'Yetki yok' };
  try{
    await fdb.set(fdb.ref(db,'users/'+uid+'/badges'), null);
    return { ok:true };
  }catch(e){ return { ok:false, error:e.message||'Hata' }; }
}

export default getUserBadges;
