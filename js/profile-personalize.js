const games = {tetris:'HeroTetris',chess:'Satranç',tavla:'Tavla',kelime:'Kelimecik'};
const accents = ['#b48aff','#39d9ff','#ffd166','#6ee7b7','#ff8fab'];
const avatars = ['','💎','👑','🐉','🦊','🦁','👾','🌙','⚡','🎮','🌊','⭐'];
const backgrounds = {default:'Tema ile uyumlu',space:'Uzay',ocean:'Okyanus',forest:'Orman',sunset:'Gün batımı',ice:'Buz'};
const key = uid => 'hero_profile_style_' + (uid || 'guest');
const clean = p => ({
  title:typeof p?.title==='string'?p.title.slice(0,24):'',
  bio:typeof p?.bio==='string'?p.bio.slice(0,120):'',
  game:Object.hasOwn(games,p?.game)?p.game:'',
  accent:accents.includes(p?.accent)?p.accent:accents[0],
  avatar:avatars.includes(p?.avatar)?p.avatar:'',
  background:Object.hasOwn(backgrounds,p?.background)?p.background:'default',
  frame:p?.frame===true
});
export function getProfileStyle(uid){
  try{return clean(JSON.parse(localStorage.getItem(key(uid))));}catch{return clean({});}
}
export function openPersonalize(getState,onSave){
  if(document.getElementById('profilePersonalize')) return;
  const uid=getState().uid||'', original=getProfileStyle(uid);
  const dialog=document.createElement('dialog');dialog.id='profilePersonalize';dialog.className='lobby-dialog personalize-dialog';
  dialog.setAttribute('aria-labelledby','personalizeTitle');
  dialog.innerHTML=`<form method="dialog"><div class="dialog-top"><h2 id="personalizeTitle">Profilini kişiselleştir</h2><button type="button" data-close aria-label="Kapat">×</button></div>
    <p class="personalize-note">Bu cihazdaki profil görünümün. Her hesap için ayrı saklanır.</p>
    <div class="personalize-preview"><span data-preview-avatar></span><div><strong data-preview-title></strong><p data-preview-bio></p></div></div>
    <label>Oyuncu unvanın<input name="title" maxlength="24" placeholder="Örneğin: Gece oyuncusu"></label>
    <label>Kendinden bir cümle<textarea name="bio" maxlength="120" rows="3" placeholder="Oyun tarzını anlat…"></textarea></label>
    <div class="personalize-grid"><label>Favori oyunun<select name="game"><option value="">Seçmedim</option></select></label><label>Profil arka planı<select name="background"></select></label></div>
    <label>Profil avatarı<select name="avatar"></select></label>
    <fieldset><legend>Vurgu rengi</legend><div class="personalize-colors"></div></fieldset>
    <label class="personalize-check"><input type="checkbox" name="frame"> Avatarı seçtiğim renkle çerçevele</label>
    <label>Elmas ve taç açılış konumu<select name="jewels"><option value="park">Her açılışta üstte park et</option><option value="remember">Son bıraktığım yeri hatırla</option></select></label>
    <button type="button" data-park class="nm-btn nm-cancel">💎 👑 Şimdi üstte park et</button>
    <p role="status" data-status></p>
    <div class="nm-actions"><button type="button" data-reset class="nm-btn nm-cancel">Görünümü sıfırla</button><button type="submit" class="nm-btn">Kaydet</button></div></form>`;
  const form=dialog.querySelector('form'), fields=form.elements;
  const add=(name,value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;fields[name].appendChild(option);};
  Object.entries(games).forEach(([v,n])=>add('game',v,n));
  Object.entries(backgrounds).forEach(([v,n])=>add('background',v,n));
  avatars.forEach(v=>add('avatar',v,v||'Mevcut avatar / fotoğraf'));
  for(const color of accents){
    const label=document.createElement('label');label.style.setProperty('--swatch',color);
    const input=document.createElement('input');input.type='radio';input.name='accent';input.value=color;
    input.setAttribute('aria-label',({'#b48aff':'Mor','#39d9ff':'Mavi','#ffd166':'Altın','#6ee7b7':'Yeşil','#ff8fab':'Pembe'})[color]);
    label.appendChild(input);form.querySelector('.personalize-colors').appendChild(label);
  }
  const fill=p=>{for(const name of ['title','bio','game','background','avatar','accent'])fields[name].value=p[name];fields.frame.checked=p.frame;};
  const value=()=>clean(Object.fromEntries([...new FormData(form),['frame',fields.frame.checked]]));
  const preview=()=>{const p=value();const box=form.querySelector('.personalize-preview');box.style.setProperty('--profile-accent',p.accent);box.querySelector('[data-preview-avatar]').textContent=p.avatar||getState().profile?.avatar||'⭐';box.querySelector('[data-preview-title]').textContent=p.title||getState().displayName||'Oyuncu';box.querySelector('[data-preview-bio]').textContent=p.bio||'Burası senin oyun alanın.';};
  fill(original);try{fields.jewels.value=localStorage.getItem('hero_jewel_start')==='remember'?'remember':'park';}catch{}
  form.addEventListener('input',preview);preview();
  dialog.querySelector('[data-close]').onclick=()=>dialog.close();
  dialog.querySelector('[data-reset]').onclick=()=>{fill(clean({}));preview();};
  dialog.querySelector('[data-park]').onclick=()=>{window.dispatchEvent(new Event('hero:park-jewels'));dialog.querySelector('[data-status]').textContent='İkonlar üstteki yerlerine alındı.';};
  form.addEventListener('submit',e=>{
    e.preventDefault();
    if((getState().uid||'')!==uid){dialog.close();return;}
    try{
      localStorage.setItem(key(uid),JSON.stringify(value()));localStorage.setItem('hero_jewel_start',fields.jewels.value);
      onSave();dialog.close();
    }catch{dialog.querySelector('[data-status]').textContent='Kaydedilemedi. Tarayıcının depolama alanını kontrol et.';}
  });
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});
  document.body.appendChild(dialog);dialog.showModal();
}

export function decorateProfile(box,style){
  const card=box.querySelector('.prf-card');if(!card)return;
  card.style.setProperty('--profile-accent',style.accent);card.classList.add('personalized-card');
  const info=document.createElement('div');info.className='profile-intro';
  if(style.title){const title=document.createElement('strong');title.textContent=style.title;info.appendChild(title);}
  if(style.bio){const bio=document.createElement('p');bio.textContent=style.bio;info.appendChild(bio);}
  if(style.game){const game=document.createElement('span');game.className='profile-favorite';game.textContent='♥ '+games[style.game];info.appendChild(game);}
  card.querySelector('.prf-top').after(info);
}
