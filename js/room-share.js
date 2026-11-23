// Oda davetini telefonun paylaşım menüsüyle gönder; destek yoksa panoya kopyala.
const names={chess:'Satranç',tavla:'Tavla',tetris:'Tetris',kelime:'Kelimecik'};
// Accept the exact text our share/copy controls generate as well as a bare
// code. Never truncate arbitrary prose or a longer invalid code to six letters.
export function normalizeRoomCode(value){
  if(typeof value!=='string'||value.length>4096)return '';
  const text=value.trim().toUpperCase();
  if(/^[A-Z2-9]{6}$/.test(text))return text;
  const labels=[...text.matchAll(/(?:^|[\s])ODA[ \t]+KODU[ \t]*:[ \t]*([A-Z2-9]{6})(?=$|[\s.,;!?])/g)];
  return labels.length===1?labels[0][1]:'';
}
export async function shareRoomCode(game,code){
  const room=normalizeRoomCode(code);
  if(!room) return 'unsupported';
  const name=names[game]||'Oyun';
  const url=new URL('./',location.href).href;
  const text=`${name} oynamaya davetlisin.\nOda kodu: ${room}\nOyunu aç, çevrimiçi oda bölümüne bu kodla katıl.`;
  if(typeof navigator.share==='function'){
    try{await navigator.share({title:`HerOyun • ${name}`,text,url});return 'shared';}
    catch(error){if(error?.name==='AbortError') return 'cancelled';}
  }
  const invite=text+'\n'+url;
  try{
    if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(invite);return 'copied';}
  }catch(_){}
  const active=document.activeElement;
  const field=document.createElement('textarea');
  field.value=invite;field.readOnly=true;
  field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';
  document.body.appendChild(field);
  try{field.select();return document.execCommand('copy')?'copied':'unsupported';}
  catch(_){return 'unsupported';}
  finally{field.remove();if(active?.isConnected)active.focus({preventScroll:true});}
}
