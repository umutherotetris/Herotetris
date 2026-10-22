import { Auth, db, fdb } from './auth.js';
import { openPanel, element, button } from './portal-panels.js';
import { getUserBadges } from './badges.js';

export async function openBadgeShowcase(onSaved){
  const me=Auth.getState(),uid=me.uid,panel=openPanel({id:'badgeShowcaseEditor',title:'Başarı vitrinin',subtitle:'Kazandığın rozetlerden en çok üç tanesini öne çıkar',uid});
  if(me.status!=='google'){panel.body.append(element('p','pc-empty','Rozet vitrinin için hesabını bağla.'));return panel;}
  panel.message('Rozetler yükleniyor…');
  try{
    const profile=(await fdb.get(fdb.ref(db,'users/'+uid))).val()||{};if(!panel.current())return panel;
    const badges=(await getUserBadges(uid,profile)).filter(b=>b.earned);if(!panel.current())return panel;
    const allowed=new Set(badges.map(b=>b.key)),selected=new Set((Array.isArray(profile.badgeShowcase)?profile.badgeShowcase:[]).filter(id=>allowed.has(id)).slice(0,3));
    const grid=element('div','pc-grid'),choices=new Map();
    badges.forEach(b=>{
      const tile=button(b.icon+' '+b.name,()=>{if(selected.has(b.key))selected.delete(b.key);else if(selected.size<3)selected.add(b.key);else{panel.message('En çok üç rozet seçebilirsin.',true);return;}refresh();});tile.title=b.desc;choices.set(b.key,tile);grid.append(tile);
    });
    const refresh=()=>{choices.forEach((b,key)=>b.setAttribute('aria-pressed',String(selected.has(key))));panel.message(selected.size+' / 3 rozet seçildi');};
    if(!badges.length)panel.body.append(element('p','pc-empty','İlk rozetini kazandığında burada seçebilirsin.'));
    panel.body.append(grid);let busy=false;
    panel.body.append(button('Vitrini kaydet',async()=>{
      if(busy||!panel.current()||Auth.getState().status!=='google')return;busy=true;panel.dialog.setAttribute('aria-busy','true');
      try{await fdb.set(fdb.ref(db,'users/'+uid+'/badgeShowcase'),[...selected]);if(!panel.current())return;panel.message('Başarı vitrinin kaydedildi.');onSaved?.();panel.close();}
      catch(_){panel.message('Vitrin kaydedilemedi. Seçimlerin açık ekranda korunuyor.',true);}
      finally{busy=false;if(panel.current())panel.dialog.removeAttribute('aria-busy');}
    },'pc-button primary'));refresh();
  }catch(_){panel.message('Rozetler yüklenemedi. Daha sonra yeniden deneyebilirsin.',true);}
  return panel;
}
