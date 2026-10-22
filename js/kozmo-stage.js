// The habitat is presentation only: it never changes rewards or progression.
const SOUND_KEY = 'hero_kozmo_sound';
const RARITIES = {common:'Sıradan',rare:'Nadir',epic:'Epik',legendary:'Görkemli',mythical:'Olağanüstü',gorkem:'Görkemli',olagan:'Olağanüstü'};
const VOICES = {
  soft:{notes:[523.25,659.25,783.99],wave:'sine',length:.17},
  cute:{notes:[880,1174.66,987.77],wave:'sine',length:.10},
  fierce:{notes:[220,329.63,440],wave:'triangle',length:.17},
  majestic:{notes:[261.63,392,523.25],wave:'triangle',length:.23},
  epic:{notes:[196,293.66,587.33],wave:'triangle',length:.21},
  crystal:{notes:[1046.5,1318.51,1567.98],wave:'sine',length:.26},
  mystic:{notes:[349.23,523.25,698.46],wave:'sine',length:.26},
  magical:{notes:[659.25,987.77,1318.51],wave:'sine',length:.22},
  roar:{notes:[130.81,196,261.63],wave:'triangle',length:.25},
  fairy:{notes:[1174.66,1567.98,1760],wave:'sine',length:.13}
};
const HABITATS = {
  stars:{name:'Yıldız Bahçesi',mood:'Küçük bir evren, büyük bir dostluk',accent:'#c2b5ff'},
  fire:{name:'Kor Bahçesi',mood:'Sıcacık bir karşılaşma',accent:'#ffb479'},
  leaves:{name:'Ay Ormanı',mood:'Yaprakların arasında bir dost',accent:'#93e8bd'},
  spirits:{name:'Ay Ormanı',mood:'Orman fısıltılarını dinliyor',accent:'#93e8bd'},
  bubbles:{name:'Gelgit Koyu',mood:'Yıldızların altında sakin bir koy',accent:'#8fdff5'},
  clouds:{name:'Bulut Adası',mood:'Birlikte gökyüzüne bakın',accent:'#c5dcff'},
  lightning:{name:'Işık Vadisi',mood:'İçinde minik bir fırtına var',accent:'#ffe59c'},
  crystals:{name:'Prizma Bahçesi',mood:'Işıkla dolu bir keşif',accent:'#b7e9ff'},
  prism:{name:'Prizma Bahçesi',mood:'Her açıdan başka bir ışıltı',accent:'#b7e9ff'},
  rainbow:{name:'Aurora Bahçesi',mood:'Renkler birlikte daha güzel',accent:'#f2bdff'},
  aurora:{name:'Aurora Bahçesi',mood:'Kuzey ışıklarının küçük yoldaşı',accent:'#f2bdff'},
  void:{name:'Gece Sığınağı',mood:'Sessiz gecenin meraklı yoldaşı',accent:'#d2bcff'}
};
const MOTES = [[9,26,1.1,0],[22,13,.65,1.4],[36,25,.8,.6],[54,12,1,2.3],[73,19,.65,.9],[88,34,1.05,3.1],[13,62,.7,2.1],[29,49,.6,3.8],[68,50,.7,1.7],[84,68,.85,.4],[47,39,.55,2.8],[61,68,.5,4.2]];
const color = value => typeof value === 'string' && /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) ? value : '#c2a4ff';
const text = (value,fallback='') => typeof value === 'string' && value.trim() ? value.slice(0,180) : fallback;
export function ensureKozmoStageStyles(){
  if(document.querySelector('link[data-kozmo-stage-style]')) return;
  const link=document.createElement('link');
  link.rel='stylesheet';link.href=new URL('../css/kozmo-premium.css',import.meta.url).href;
  link.dataset.kozmoStageStyle='';document.head.appendChild(link);
}
function el(tag,className,content){
  const node=document.createElement(tag);if(className)node.className=className;
  if(content!==undefined)node.textContent=content;return node;
}
function button(className,label){const node=el('button',className,label);node.type='button';return node;}
function safeVisual(markup){
  // Only the code-owned SVG renderer supplies markup. Remove active content and
  // remote references anyway; account names and metadata never enter this path.
  const template=document.createElement('template');template.innerHTML=String(markup||'');
  template.content.querySelectorAll('script,iframe,object,embed,foreignObject,audio,video,link,style').forEach(node=>node.remove());
  template.content.querySelectorAll('*').forEach(node=>{
    for(const attribute of [...node.attributes]){
      const key=attribute.name.toLowerCase(),value=attribute.value;
      if(key.startsWith('on') || ((key==='href'||key==='xlink:href'||key==='src')&&!/^#[\w-]+$/.test(value))
        || /(?:url\(\s*['"]?(?!#)|expression\s*\(|javascript:|@import)/i.test(value))node.removeAttribute(attribute.name);
    }
  });
  return template.content;
}

/** Mount a selected companion. renderVisual({size}) is the existing SVG renderer.
 * All callbacks are optional and owned by the signed-in collection controller.
 * Destroy on close/re-render; a detach observer is a final safety net.
 */
export function mountKozmoStage(host,initial={}){
  if(!host?.appendChild)throw new TypeError('Kozmo yaşam alanı için bir kapsayıcı gerekli');
  ensureKozmoStageStyles();
  let model=initial,disposed=false,actionToken=0,reactionTimer=null,audio=null,soundEnabled=false;
  const timers=new Set(),voices=new Set(),cleanups=[];
  try{soundEnabled=localStorage.getItem(SOUND_KEY)==='1';}catch(_){}
  const reduced=typeof matchMedia==='function'?matchMedia('(prefers-reduced-motion: reduce)'):null;
  const root=el('section','kozmo-stage');root.setAttribute('aria-label','Kozmo yaşam alanı');
  const top=el('div','kozmo-stage-top');
  const caption=el('div','kozmo-stage-caption');
  caption.append(el('span','kozmo-stage-eyebrow','KOZMO · YAŞAM ALANI'));
  const habitatLabel=el('strong','kozmo-stage-habitat');caption.append(habitatLabel);
  const soundButton=button('kozmo-stage-sound','');
  top.append(caption,soundButton);
  const scene=el('div','kozmo-stage-scene');scene.setAttribute('aria-label','Etkileşimli kozmo sahnesi');
  const sky=el('div','kozmo-stage-sky');sky.setAttribute('aria-hidden','true');
  for(const cls of ['kozmo-stage-nebula nebula-one','kozmo-stage-nebula nebula-two','kozmo-stage-moon','kozmo-stage-orbit orbit-back','kozmo-stage-orbit orbit-front'])sky.append(el('i',cls));
  for(const [x,y,scale,delay]of MOTES){const mote=el('i','kozmo-stage-mote');mote.style.cssText=`--mx:${x}%;--my:${y}%;--ms:${scale};--md:${delay}s`;sky.append(mote);}
  const floor=el('div','kozmo-stage-floor');floor.setAttribute('aria-hidden','true');floor.append(el('i','kozmo-stage-island'),el('i','kozmo-stage-floor-ring ring-one'),el('i','kozmo-stage-floor-ring ring-two'),el('i','kozmo-stage-shadow'));
  const actor=button('kozmo-stage-actor','');
  const actorBody=el('span','kozmo-stage-actor-body');actorBody.setAttribute('aria-hidden','true');actor.append(actorBody);
  const burst=el('div','kozmo-stage-burst');burst.setAttribute('aria-hidden','true');
  const speech=el('p','kozmo-stage-speech');speech.setAttribute('role','status');speech.setAttribute('aria-live','polite');
  const hint=el('span','kozmo-stage-touch-hint','Dokun · Bir tepki keşfet');
  scene.append(sky,floor,actor,burst,speech,hint);
  const info=el('div','kozmo-stage-info');
  const name=el('h3','kozmo-stage-name'),badges=el('div','kozmo-stage-badges');
  const rarity=el('span','kozmo-stage-rarity'),element=el('span','kozmo-stage-element'),level=el('span','kozmo-stage-level');badges.append(rarity,element,level);
  const description=el('p','kozmo-stage-description');info.append(name,badges,description);
  const actions=el('div','kozmo-stage-actions');
  const petButton=button('kozmo-stage-action','♡ Sev'),playButton=button('kozmo-stage-action','✧ Oyna'),detailsButton=button('kozmo-stage-action kozmo-stage-details','Bilgiler ↗');
  actions.append(petButton,playButton,detailsButton);
  const extra=el('div','kozmo-stage-extra');
  const activeButton=button('kozmo-stage-activate',''),feedButton=button('kozmo-stage-action kozmo-stage-feed','🍎 Besle');
  extra.append(activeButton,feedButton);
  root.append(top,scene,info,actions,extra);host.appendChild(root);
  const later=(callback,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!disposed)callback();},ms);timers.add(id);return id;};
  const listen=(node,event,fn,opts)=>{node.addEventListener(event,fn,opts);cleanups.push(()=>node.removeEventListener(event,fn,opts));};
  const pause=()=>{
    root.classList.toggle('is-paused',!!document.hidden);
    root.classList.toggle('is-reduced',!!reduced?.matches);
    if(document.hidden){for(const voice of voices){try{voice.stop();}catch(_){}}voices.clear();if(audio?.state==='running')audio.suspend?.().catch?.(()=>{});}
  };
  function voiceFor(){return VOICES[model.type?.sound]||VOICES[model.creature?.unique?'crystal':'soft'];}
  function soundState(){
    soundButton.textContent=soundEnabled?'♪ Ses açık':'♪ Ses kapalı';
    soundButton.setAttribute('aria-pressed',String(soundEnabled));
    soundButton.setAttribute('aria-label',soundEnabled?'Kozmo seslerini kapat':'Kozmo seslerini aç');
  }
  function playVoice(action,event){
    if(disposed||!soundEnabled||document.hidden||event?.isTrusted!==true)return;
    try{
      const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
      if(!audio)audio=new Audio();
      if(audio.state==='suspended')audio.resume().catch(()=>{});
      for(const voice of voices){try{voice.stop();}catch(_){}}voices.clear();
      const profile=voiceFor(),factor=action==='play'?1.18:action==='pet'?.88:1;
      for(const [index,note]of profile.notes.entries()){
        const oscillator=audio.createOscillator(),gain=audio.createGain(),start=audio.currentTime+index*.095;
        oscillator.type=profile.wave;oscillator.frequency.setValueAtTime(note*factor,start);
        oscillator.frequency.exponentialRampToValueAtTime(note*factor*(index===2?1.04:1.12),start+profile.length);
        gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.045/(1+index*.2),start+.018);gain.gain.exponentialRampToValueAtTime(.0001,start+profile.length+.1);
        oscillator.connect(gain);gain.connect(audio.destination);voices.add(oscillator);
        oscillator.onended=()=>{voices.delete(oscillator);oscillator.disconnect();gain.disconnect();};
        oscillator.start(start);oscillator.stop(start+profile.length+.12);
      }
    }catch(_){/* Sound is optional; the interaction still works. */}
  }
  function react(action,event){
    if(disposed||!['pet','play','feed','listen','activate'].includes(action))return;
    actionToken++;if(reactionTimer){clearTimeout(reactionTimer);timers.delete(reactionTimer);}
    root.dataset.reaction=action;
    const messages={pet:['Yanında çok mutluyum.','Biraz daha kalır mısın?','Bu küçük anı sevdim.'],play:['Hazırsan yıldızları yakalayalım!','Bir tur daha!','Seninle oynamak çok güzel.'],feed:['Lezzetli bir mola!'],listen:['Bu ses yalnızca bana ait.'],activate:['Birlikte yola çıkalım.']};
    const lines=messages[action];speech.textContent=lines[Math.floor(Math.random()*lines.length)];
    speech.classList.add('is-visible');burst.replaceChildren();
    if(!reduced?.matches){
      for(let index=0;index<7;index++){
        const spark=el('span','kozmo-stage-spark',action==='pet'?'♡':action==='feed'?'✦':'✧');
        spark.style.cssText=`--bx:${(index-3)*23}px;--by:${-40-Math.abs(index-3)*13}px;--br:${(index-3)*13}deg;--bd:${index*.045}s`;burst.append(spark);
      }
    }
    playVoice(action,event);
    reactionTimer=later(()=>{delete root.dataset.reaction;speech.classList.remove('is-visible');burst.replaceChildren();},2600);
  }
  function update(next={}){
    if(disposed)return;
    actionToken++;if(reactionTimer){clearTimeout(reactionTimer);timers.delete(reactionTimer);reactionTimer=null;}
    delete root.dataset.reaction;speech.classList.remove('is-visible');burst.replaceChildren();
    model={...model,...next};const c=model.creature||{},type=model.type||{};
    const habitat=Object.hasOwn(HABITATS,type.particle)?HABITATS[type.particle]:HABITATS[c.unique?'prism':'stars'];
    root.style.setProperty('--kozmo-accent',color(c.color||type.c||habitat.accent));
    root.style.setProperty('--kozmo-sky-accent',habitat.accent);
    root.dataset.element=text(type.particle,c.unique?'prism':'stars');
    name.textContent=text(c.name,text(type.n,'Kozmo'));
    actor.setAttribute('aria-label',name.textContent+' ile etkileşime gir');
    habitatLabel.textContent=habitat.name;
    rarity.textContent=text(model.rarityLabel,RARITIES[c.rarity||type.r]||'Kozmik yoldaş');
    element.textContent=text(c.element,text(type.element,'Kozmos'));
    level.textContent=text(model.levelLabel,'Seviye '+(Number.isSafeInteger(c.level)&&c.level>0?c.level:1));
    description.textContent=text(c.power,text(type.power,habitat.mood));
    detailsButton.hidden=typeof model.onDetails!=='function';
    activeButton.hidden=typeof model.onActivate!=='function';
    feedButton.hidden=typeof model.onFeed!=='function';
    extra.hidden=activeButton.hidden&&feedButton.hidden;
    activeButton.textContent=model.active?'✓ Aktif yoldaşın':'✦ Yoldaş olarak seç';
    activeButton.setAttribute('aria-pressed',String(!!model.active));
    if(typeof model.renderVisual==='function'){
      try{actorBody.replaceChildren(safeVisual(model.renderVisual({size:196,creature:c,type})));}catch(_){actorBody.textContent='✦';}
    }else actorBody.textContent=text(c.icon,text(type.e,'✦'));
    soundState();pause();
  }
  listen(actor,'click',event=>react('pet',event));
  listen(petButton,'click',event=>react('pet',event));
  listen(playButton,'click',event=>react('play',event));
  listen(soundButton,'click',event=>{
    soundEnabled=!soundEnabled;try{localStorage.setItem(SOUND_KEY,soundEnabled?'1':'0');}catch(_){}
    soundState();if(soundEnabled)react('listen',event);
    else{for(const voice of voices){try{voice.stop();}catch(_){}}voices.clear();}
  });
  listen(detailsButton,'click',()=>{if(!disposed)model.onDetails?.(model.creature,model.type);});
  for(const [control,callback,action]of [[activeButton,'onActivate','activate'],[feedButton,'onFeed','feed']]){
    listen(control,'click',async event=>{
      if(disposed||control.disabled||typeof model[callback]!=='function')return;
      const current=model,token=++actionToken;control.disabled=true;
      try{
        const result=await current[callback](current.creature,current.type);
        if(disposed||model!==current||token!==actionToken||result===false)return;
        if(action==='activate'){model={...model,active:true};activeButton.textContent='✓ Aktif yoldaşın';activeButton.setAttribute('aria-pressed','true');}
        react(action,event);
      }catch(_){if(!disposed&&model===current){speech.textContent='Tamamlanamadı. Yeniden deneyebilirsin.';speech.classList.add('is-visible');}}
      finally{if(!disposed)control.disabled=false;}
    });
  }
  listen(actor,'pointermove',event=>{
    if(reduced?.matches||event.pointerType==='touch')return;
    const rect=actor.getBoundingClientRect();
    if(rect.width&&rect.height){actorBody.style.setProperty('--look-x',(((event.clientX-rect.left)/rect.width-.5)*10).toFixed(2)+'deg');actorBody.style.setProperty('--look-y',(((event.clientY-rect.top)/rect.height-.5)*-8).toFixed(2)+'deg');}
  });
  listen(actor,'pointerleave',()=>{actorBody.style.setProperty('--look-x','0deg');actorBody.style.setProperty('--look-y','0deg');});
  listen(document,'visibilitychange',pause);
  if(reduced?.addEventListener){reduced.addEventListener('change',pause);cleanups.push(()=>reduced.removeEventListener('change',pause));}
  else if(reduced?.addListener){reduced.addListener(pause);cleanups.push(()=>reduced.removeListener(pause));}
  let observer=null;
  if(typeof MutationObserver==='function'){
    observer=new MutationObserver(()=>{if(!root.isConnected)destroy();});
    observer.observe(document.body,{childList:true,subtree:true});
  }
  function destroy(){
    if(disposed)return;disposed=true;actionToken++;
    for(const id of timers)clearTimeout(id);timers.clear();
    for(const stop of cleanups)stop();observer?.disconnect();
    for(const voice of voices){try{voice.stop();}catch(_){}}voices.clear();
    if(audio&&audio.state!=='closed')audio.close?.().catch?.(()=>{});
    root.remove();
  }
  update(initial);
  // Programmatic reactions remain silent; audio requires a trusted UI gesture.
  return {update,react:action=>react(action),destroy,element:root};
}

export default mountKozmoStage;
