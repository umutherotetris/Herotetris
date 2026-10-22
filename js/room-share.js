// Oda davetini telefonun paylaşım menüsüyle gönder; destek yoksa panoya kopyala.
const names={chess:'Satranç',tavla:'Tavla',tetris:'Tetris',kelime:'Kelimecik'};
export async function shareRoomCode(game,code){
  const room=String(code||'').trim();
  if(!room || room.length>80) return 'unsupported';
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
