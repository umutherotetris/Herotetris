// Discovery stays independent of account services. Only successful launches enter recents.
import { go } from './nav.js';
const games = {
  tetris: { name:'HeroTetris', id:'gameTetris', category:'ARCADE', line:'Ritmini bul.\nRekorunu kır.', description:'Bloklar düşer, dünya yavaşlar. Sıradaki rekorun bir hamle uzağında.', tags:['Tek oyuncu','Refleks & ritim'], art:'lobby-tetris.svg?v=141', search:'tetris blok arcade refleks tek', solo:true, together:false, steps:['Oyun ekranından istediğin modu seç.','Düşen blokları hareket ettir ve döndür. Boşluk bırakmadan yatay sıraları doldur.','Tamamlanan sıralar silinir. Bloklar tepeye ulaşmadan skorunu yükselt.'], note:'Klavye ve dokunmatik kontroller oyun ekranında gösterilir.' },
  chess: { name:'Satranç', id:'gameChess', category:'STRATEJİ', line:'Bir hamle önde.\nBir dünya ihtimal.', description:'Tahtayı oku, planını kur. Her hamlede yeni bir ihtimal keşfet.', tags:['AI & 2 oyuncu','Strateji & odak'], art:'game-chess.svg?v=140', search:'satranç chess strateji zeka yapay ai arkadaş', solo:true, together:true, steps:['Oyun ekranından rakip ve oyun türünü seç.','Bir taşa dokun, ardından geçerli hedef kareyi seç.','Kendi şahını korurken rakibin şahını mat etmeye çalış.'], note:'Oyun türü ve süre ayarlarını satranç ekranında seçebilirsin.' },
  tavla: { name:'Tavla', id:'gameTavla', category:'KLASİK', line:'Şansın başlasın.\nTaktiğin konuşsun.', description:'Zarın sürprizini doğru hamleyle buluştur. Klasik rekabet, yeni bir tur.', tags:['AI & 2 oyuncu','Şans & taktik'], art:'game-tavla.svg?v=140', search:'tavla backgammon zar taktik arkadaş', solo:true, together:true, steps:['Tavla ekranında oyun türünü seç.','Zarları at ve pullarını gelen sayılara göre hareket ettir.','Tüm pullarını kendi evine getir, sonra rakibinden önce topla.'], note:'Rakip seçimi ve bağlantı seçenekleri oyun içinde açılır.' },
  kelime: { name:'Kelimecik', id:'gameKelime', category:'KELİME', line:'Harfler senin.\nHikâye senin.', description:'Bir avuç harften yeni yollar aç. En iyi kelimen henüz oynanmadı.', tags:['AI & 2 oyuncu','Harfler & keşif'], art:'game-word.svg?v=140', search:'kelimecik kelime harf sözcük zeka ai arkadaş', solo:true, together:true, steps:['Yerel, yapay zekâ veya diğer oyun seçeneklerinden birini seç.','Elindeki harfleri tahtaya yerleştirerek kelimeler oluştur.','Tahtadaki kelimelerden yararlan, puanını büyüt ve sıranı tamamla.'], note:'Aynı cihazda iki kişi sırayla oynayabilir; AI modunda tek başına başlayabilirsin.' }
};
const keys=Object.keys(games);
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));}catch{}};
let initialized=false;
export default function initLobby(){
  if(initialized) return; initialized=true;
  const $=id=>document.getElementById(id);
  let selected='tetris', filter='all';
  const stored=read('hero_lobby_favorites',[]);
  let favorites=new Set(Array.isArray(stored)?stored.filter(key=>keys.includes(key)):[]);
  let recent=read('hero_lobby_recent',null);
  if(!keys.includes(recent)) recent=null;
  function renderRecent(){
    $('recentGame').hidden=!recent;
    if(recent) $('recentName').textContent=games[recent].name;
  }
  function select(key){
    if(!games[key]) return;
    selected=key;const g=games[key], index=keys.indexOf(key)+1;
    document.querySelector('.game-stage').dataset.game=key;
    $('stageTitle').textContent=g.name;$('stageCategory').textContent=`0${index} / ${g.category}`;
    $('stageLine').textContent=g.line;$('stageDescription').textContent=g.description;
    $('stageArt').src='assets/'+g.art;
    $('stageTags').replaceChildren(...g.tags.map(text=>{const span=document.createElement('span');span.textContent=text;return span;}));
    $('stageIndex').textContent=`0${index} — 04`;
    $('stagePlay').setAttribute('aria-label',g.name+' oyununu aç');
    document.querySelectorAll('[data-select],[data-stage-select]').forEach(b=>b.setAttribute('aria-pressed',String((b.dataset.select||b.dataset.stageSelect)===key)));
  }
  function renderCollection(){
    let count=0;
    document.querySelectorAll('[data-game-card]').forEach(card=>{
      const key=card.dataset.gameCard;
      const visible=filter==='all'||filter==='favorites'&&favorites.has(key)||filter==='solo'&&games[key].solo||filter==='together'&&games[key].together;
      card.hidden=!visible;if(visible) count++;
    });
    $('gameCount').textContent=count+' oyun';$('collectionEmpty').hidden=count>0;
    document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===filter)));
    document.querySelectorAll('[data-favorite]').forEach(b=>{
      const key=b.dataset.favorite,on=favorites.has(key);b.textContent=on?'★':'☆';b.setAttribute('aria-pressed',String(on));b.setAttribute('aria-label',games[key].name+(on?' favorilerden çıkar':' favorilere ekle'));
    });
  }
  document.querySelectorAll('[data-select],[data-stage-select]').forEach(b=>b.addEventListener('click',()=>select(b.dataset.select||b.dataset.stageSelect)));
  document.querySelectorAll('[data-favorite]').forEach(b=>b.addEventListener('click',()=>{
    const key=b.dataset.favorite;favorites.has(key)?favorites.delete(key):favorites.add(key);write('hero_lobby_favorites',[...favorites]);renderCollection();
    // Removing the focused last favorite must not lose the keyboard position.
    if(b.closest('[data-game-card]').hidden) document.querySelector('[data-filter="favorites"]').focus();
  }));
  document.querySelectorAll('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;renderCollection();}));
  $('resetFilter').addEventListener('click',()=>{filter='all';renderCollection();document.querySelector('[data-filter="all"]').focus();});
  function launch(key){
    // Keep launch authority, boot recovery and lazy loading in the existing entrypoint.
    $(games[key].id).click();
    const status=$('portalStatus');if(!status.hidden) status.scrollIntoView({block:'nearest'});
  }
  $('stagePlay').addEventListener('click',()=>launch(selected));
  $('recentGame').addEventListener('click',()=>{if(recent){select(recent);launch(recent);}});
  document.addEventListener('hero:game-opened',event=>{
    const key=keys.find(k=>event.detail?.modulePath===`./games/${k}.js`);
    if(key){recent=key;write('hero_lobby_recent',key);renderRecent();}
  });
  const guide=$('gameGuide'), search=$('gameSearch');
  $('stageHelp').addEventListener('click',()=>{
    const g=games[selected];$('guideTitle').textContent=g.name;$('guideIntro').textContent=g.description;
    $('guideSteps').replaceChildren(...g.steps.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
    $('guideNote').textContent=g.note;guide.showModal();
  });
  $('guidePlay').addEventListener('click',()=>{guide.close();launch(selected);});
  document.querySelectorAll('[data-close-dialog]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
  [guide,search].forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
  const normalize=text=>text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  function renderSearch(){
    const q=normalize($('gameSearchInput').value.trim()), results=keys.filter(k=>normalize(games[k].name+' '+games[k].search).includes(q));
    const box=$('searchResults');box.replaceChildren();
    if(!results.length){const p=document.createElement('p');p.className='search-empty';p.textContent='Oyun bulunamadı. Başka bir ad veya tür dene.';box.append(p);return;}
    results.forEach(key=>{
      const g=games[key], b=document.createElement('button');b.type='button';b.className='search-result';
      const name=document.createElement('strong'),meta=document.createElement('span');name.textContent=g.name;meta.textContent=g.tags.join(' · ');b.append(name,meta);
      b.addEventListener('click',()=>{search.close();go('home',false,'push');select(key);$('stagePlay').focus();});box.append(b);
    });
  }
  function openSearch(){if(search.open||guide.open||document.querySelector('dialog[open],.tetris-overlay,.hero-select-overlay,.chess-root,.tavla-root,.kl-root,.nick-overlay'))return;$('gameSearchInput').value='';renderSearch();search.showModal();$('gameSearchInput').focus();}
  $('searchTrigger').addEventListener('click',openSearch);
  $('gameSearchInput').addEventListener('input',renderSearch);
  $('gameSearchInput').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();$('searchResults').querySelector('button')?.focus();}});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.repeat&&!e.target.closest('input,textarea,select,[contenteditable="true"]')){e.preventDefault();openSearch();}});
  window.addEventListener('storage',e=>{if(e.key==='hero_lobby_favorites'){const value=read(e.key,[]);favorites=new Set(Array.isArray(value)?value.filter(k=>keys.includes(k)):[]);renderCollection();}});
  select(recent||'tetris');renderCollection();renderRecent();
}
