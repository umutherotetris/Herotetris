import { Auth } from './auth.js';
import { openPanel, element, button } from './portal-panels.js';

const GAMES={tetris:'Tetris',chess:'Satranç',tavla:'Tavla',kelime:'Kelimecik'};
const outcomeLabel=value=>({win:'Kazandın',loss:'Rakip kazandı',draw:'Berabere',practice:'Antrenman'})[value]||String(value||'Maç tamamlandı');
const key=uid=>'hero_reviews:'+uid,MAX_BYTES=1400000;
const text=value=>String(value??'').slice(0,500);
function plain(value){return JSON.parse(JSON.stringify(value));}
export function getGameReviews(uid=Auth.getState().uid){
  if(!uid||Auth.getState().uid!==uid)return [];
  try{const rows=JSON.parse(localStorage.getItem(key(uid))||'[]');return Array.isArray(rows)?rows.filter(r=>r?.uid===uid&&Object.hasOwn(GAMES,r.game)&&Array.isArray(r.frames)).slice(0,12):[];}catch(_){return [];}
}
export function recordGameReview(spec={}){
  const uid=spec.uid||Auth.getState().uid;
  if(!uid||Auth.getState().uid!==uid||!Object.hasOwn(GAMES,spec.game))return null;
  let frames;try{frames=plain((Array.isArray(spec.frames)?spec.frames:[]).slice(-120));}catch(_){return null;}
  const review={id:globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'_'+Math.random().toString(36).slice(2),uid,game:spec.game,mode:text(spec.mode),title:text(spec.title||GAMES[spec.game]),outcome:text(spec.outcome),insights:(Array.isArray(spec.insights)?spec.insights:[]).map(text).slice(0,8),frames,createdAt:Date.now()};
  // A large snapshot must never silently evict every other match.
  while(JSON.stringify(review).length>MAX_BYTES&&review.frames.length>1)review.frames.splice(0,Math.ceil(review.frames.length/4));
  if(JSON.stringify(review).length>MAX_BYTES)return {...review,frames:[],saved:false,error:'Maç görüntüsü kayıt sınırını aştı'};
  const rows=[review,...getGameReviews(uid)].slice(0,12);
  while(JSON.stringify(rows).length>MAX_BYTES&&rows.length>1)rows.pop();
  try{localStorage.setItem(key(uid),JSON.stringify(rows));return {...review,saved:true};}
  catch(_){return {...review,saved:false,error:'Cihaz depolaması dolu; bu maç yalnızca açık ekran boyunca incelenebilir'};}
}
export async function openGameReview(reviewOrId,options={}){
  const uid=Auth.getState().uid;
  const review=typeof reviewOrId==='string'?getGameReviews(uid).find(r=>r.id===reviewOrId):reviewOrId;
  if(!review||review.uid!==uid||!Object.hasOwn(GAMES,review.game))return null;
  const panel=openPanel({id:'gameReviewCenter',title:review.title||'Maç incelemesi',subtitle:'Bu cihazdaki maç kaydı · '+new Date(review.createdAt).toLocaleString('tr-TR'),uid});
  if(review.error)panel.message(review.error,true);
  panel.body.append(element('p','pc-muted',outcomeLabel(review.outcome)));
  const stage=element('div','pc-review-stage'),label=element('p','pc-muted');label.setAttribute('aria-live','polite');
  const controls=element('div','pc-review-controls'),slider=element('input');slider.type='range';slider.min='0';slider.max=String(Math.max(0,review.frames.length-1));slider.value='0';slider.setAttribute('aria-label','Maç anı');
  let index=0,timer=null,renderer=options.renderFrame;
  const stop=()=>{clearInterval(timer);timer=null;play.textContent='▶ Oynat';};
  const draw=()=>{
    if(!panel.current())return stop();
    stage.replaceChildren();
    if(review.frames.length){
      try{renderer(review.frames[index],stage);}catch(_){stage.textContent='Bu maç anı çizilemedi.';stop();}
      label.textContent=(index+1)+' / '+review.frames.length+' · '+text(review.frames[index]?.label||'Maç anı');
    }else{stage.textContent='Bu maç için görüntü kaydı yok.';label.textContent='';}
    slider.value=String(index);prev.disabled=index===0;next.disabled=index>=review.frames.length-1;
  };
  const prev=button('← Önceki',()=>{stop();index=Math.max(0,index-1);draw();});
  const play=button('▶ Oynat',()=>{if(timer)return stop();if(index>=review.frames.length-1)index=0;play.textContent='Ⅱ Duraklat';draw();timer=setInterval(()=>{if(index>=review.frames.length-1)return stop();index++;draw();},900);});
  const next=button('Sonraki →',()=>{stop();index=Math.min(review.frames.length-1,index+1);draw();});
  slider.addEventListener('input',()=>{stop();index=Number(slider.value);draw();});
  controls.append(prev,play,next,slider);panel.body.append(stage,label,controls);
  const notes=element('ul','pc-insights');(review.insights||[]).forEach(note=>notes.append(element('li','',note)));if(notes.childNodes.length)panel.body.append(notes);
  panel.body.append(element('small','pc-muted','Analiz, kaydedilen hamle ve ölçümlere dayanır. Tekrar oynatma canlı maçı değiştirmez.'));
  panel.cleanup(stop);
  const visibility=()=>{if(document.hidden)stop();};document.addEventListener('visibilitychange',visibility);panel.cleanup(()=>document.removeEventListener('visibilitychange',visibility));
  try{if(!renderer){const module=await import('./games/'+review.game+'.js');renderer=module.renderReviewFrame;}if(!panel.current())return null;if(typeof renderer!=='function')throw new Error();draw();play.disabled=review.frames.length<2;slider.disabled=review.frames.length<2;}
  catch(_){panel.message('Maç görüntüleyicisi yüklenemedi. Kayıt profilinde korunuyor.',true);controls.hidden=true;}
  return panel;
}
export function openReviewLibrary(){
  const uid=Auth.getState().uid,panel=openPanel({id:'gameReviewLibrary',title:'Maç arşivin',subtitle:'Bu hesap ve cihaz için son 12 maç',uid});
  const rows=getGameReviews(uid);
  if(!rows.length)panel.body.append(element('p','pc-empty','Tamamladığın maçların incelemeleri burada görünecek.'));
  rows.forEach(review=>{
    const card=element('div','pc-card');card.append(element('h3','',review.title),element('p','pc-muted',outcomeLabel(review.outcome)),element('small','pc-muted',new Date(review.createdAt).toLocaleString('tr-TR')));
    card.append(button('Maçı incele →',()=>openGameReview(review)));panel.body.append(card);
  });return panel;
}
