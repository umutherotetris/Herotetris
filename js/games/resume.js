// resume.js — "Kaldığın yerden devam" için localStorage anlık görüntü + süre kotası.
// Hile önleme: kayıt yalnız RESUME_MAX_AGE içinde geçerli; oyun bitince temizlenir.
const PREFIX = 'hero_resume_';
export const RESUME_MAX_AGE = 12 * 3600 * 1000;   // 12 saat kotası

export function saveSnapshot(game, data){
  try{ localStorage.setItem(PREFIX + game, JSON.stringify({ t: Date.now(), v: 1, data })); }catch(e){}
}
export function loadSnapshot(game, maxAge){
  try{
    const raw = localStorage.getItem(PREFIX + game); if(!raw) return null;
    const o = JSON.parse(raw);
    if(!o || !o.data) return null;
    const age = Date.now() - (o.t || 0);
    if(age > (maxAge || RESUME_MAX_AGE)){ clearSnapshot(game); return null; }   // kota doldu → sil
    return { data: o.data, age };
  }catch(e){ return null; }
}
export function clearSnapshot(game){ try{ localStorage.removeItem(PREFIX + game); }catch(e){} }
export function hasSnapshot(game, maxAge){ return !!loadSnapshot(game, maxAge); }
export function fmtAge(ms){
  if(ms < 60000) return 'az önce';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} saat ${m} dk önce` : `${m} dk önce`;
}
