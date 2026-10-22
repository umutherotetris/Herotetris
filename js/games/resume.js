// resume.js — "Kaldığın yerden devam" için localStorage anlık görüntü + süre kotası.
// Hile önleme: kayıt yalnız RESUME_MAX_AGE içinde geçerli; oyun bitince temizlenir.
const PREFIX = 'hero_resume_';
export const RESUME_MAX_AGE = 12 * 3600 * 1000;   // 12 saat kotası

function resumeOwner(){
  try{return (typeof window!=='undefined' && window.Hero?.Auth?.getState?.()?.uid)||'guest';}catch(_){return 'guest';}
}
function resumeKey(game,owner=resumeOwner()){return PREFIX+game+':'+encodeURIComponent(owner);}
export function saveSnapshot(game, data){
  const owner=resumeOwner();
  try{localStorage.setItem(resumeKey(game,owner),JSON.stringify({t:Date.now(),v:2,owner,data}));}catch(_){}
}
export function loadSnapshot(game, maxAge=RESUME_MAX_AGE){
  const owner=resumeOwner(),key=resumeKey(game,owner);
  try{
    const raw=localStorage.getItem(key);if(!raw)return null;
    const o=JSON.parse(raw),age=Date.now()-o?.t;
    if(!o || o.v!==2 || o.owner!==owner || !o.data || !Number.isFinite(o.t) || o.t<0 || !Number.isFinite(age) || age<0 || !Number.isFinite(maxAge) || maxAge<0 || age>maxAge){localStorage.removeItem(key);return null;}
    return {data:o.data,age};
  }catch(_){return null;}
}
export function clearSnapshot(game){try{localStorage.removeItem(resumeKey(game));}catch(_){} }
export function hasSnapshot(game, maxAge){ return !!loadSnapshot(game, maxAge); }
export function fmtAge(ms){
  if(ms < 60000) return 'az önce';
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h} saat ${m} dk önce` : `${m} dk önce`;
}
