(()=>{'use strict';
if(window.__SUKUN_R776_BERHET_AUTHORITY__)return;window.__SUKUN_R776_BERHET_AUTHORITY__=1;
const A='./assets/berhetiyye-premium/';
const touched=new Map();let timer=0,last=false,painting=false;
function selected(){
 try{if(typeof Z!=='undefined'&&String(Z.cat||'')==='berhet')return true}catch(e){}
 try{if(document.querySelector('#zCats [data-c="berhet"].act'))return true}catch(e){}
 try{const b=window.BERHET_SEYIR;if(b&&(b.run||b.paused||b.systemHold))return true}catch(e){}
 try{const s=window.SukunActiveNameInfo?.snapshot?.().state;if(String(s?.cat||'')==='berhet')return true}catch(e){}
 try{if(document.body.dataset.r474NameCategory==='berhet')return true}catch(e){}
 return false;
}
function visible(){const z=document.getElementById('tab-zkr');return !!z&&!z.hidden}
function remember(el,p){let m=touched.get(el);if(!m){m=new Map();touched.set(el,m)}if(!m.has(p))m.set(p,[el.style.getPropertyValue(p),el.style.getPropertyPriority(p)])}
function imp(el,p,v){if(!el)return;remember(el,p);el.style.setProperty(p,v,'important')}
function paint(sel,props){document.querySelectorAll(sel).forEach(el=>{for(const [p,v] of Object.entries(props))imp(el,p,v)})}
function restore(){for(const [el,m] of touched){if(!el||!el.style)continue;for(const [p,[v,pr]] of m){if(v)el.style.setProperty(p,v,pr||'');else el.style.removeProperty(p)}}touched.clear()}
function bg(img){return `url("${A}${img}")`}
const panel={
 'background-image':'linear-gradient(155deg,rgba(3,17,35,.79),rgba(8,12,31,.87))','background-color':'transparent','border':'1px solid rgba(246,217,138,.42)','box-shadow':'0 16px 40px rgba(0,0,0,.32),inset 0 1px rgba(255,245,205,.07)','backdrop-filter':'blur(10px) saturate(1.06)','-webkit-backdrop-filter':'blur(10px) saturate(1.06)'
};
const smallPanel={'background-image':'linear-gradient(145deg,rgba(4,29,48,.88),rgba(12,13,38,.91))','background-color':'transparent','border':'1px solid rgba(246,217,138,.34)','box-shadow':'inset 0 1px rgba(255,255,255,.05)','color':'#f3eee1'};
function ctrl(el,img,minH){if(!el)return;const o={'background-image':bg(img),'background-color':'transparent','background-size':'100% 100%','background-position':'center','background-repeat':'no-repeat','border':'0','box-shadow':'none','color':'#fff0c2','text-shadow':'0 1px 3px rgba(0,0,0,.90)','filter':'drop-shadow(0 8px 12px rgba(0,0,0,.25))','border-radius':'0'};if(minH)o['min-height']=minH;for(const [p,v] of Object.entries(o))imp(el,p,v)}
function ring(){const host=document.getElementById('zCountVisual');if(!host)return;let r=document.getElementById('r776RingSkin');if(!r){r=document.createElement('div');r.id='r776RingSkin';r.setAttribute('aria-hidden','true');host.insertBefore(r,host.firstChild)}}
function skin(){if(painting)return;painting=true;try{
 const b=document.body;
 imp(b,'background-color','#020816');imp(b,'background-image',`linear-gradient(180deg,rgba(2,7,18,.12),rgba(2,9,22,.30) 44%,rgba(2,7,18,.62)),${bg('berhetiyye-palace.png')}`);imp(b,'background-size','cover,cover');imp(b,'background-position','center top,center top');imp(b,'background-repeat','no-repeat,no-repeat');imp(b,'background-attachment','fixed,fixed');
 paint('.app,#tab-zkr',{'background':'transparent'});
 paint('.tabs',{...panel,'background-image':`linear-gradient(155deg,rgba(2,15,34,.88),rgba(8,10,29,.90)),${bg('berhetiyye-name-frame.png')}`,'background-size':'cover,100% 100%','background-position':'center','background-repeat':'no-repeat'});
 paint('.tabs .tab,#tekkeTab',{...smallPanel,'border-color':'rgba(246,217,138,.25)'});
 paint('.tabs .tab[data-t="zkr"],.tabs .tab.act',{...smallPanel,'background-image':'linear-gradient(145deg,rgba(23,73,82,.92),rgba(48,25,79,.92))','border-color':'rgba(246,217,138,.65)','box-shadow':'0 0 18px rgba(116,231,238,.12),inset 0 0 18px rgba(246,217,138,.07)'});
 paint('#tab-zkr .zNav',{...panel});paint('#tab-zkr .zNav button',{...smallPanel});paint('#tab-zkr .zNav button.act',{...smallPanel,'border-color':'rgba(246,217,138,.63)','color':'#fff0bd','background-image':'linear-gradient(145deg,rgba(19,76,84,.90),rgba(44,24,75,.91))'});
 paint('#tab-zkr>.card.zCtl,#zStage',{...panel,'background-image':'linear-gradient(160deg,rgba(3,18,37,.42),rgba(7,11,28,.56))'});
 paint('#berhetAtlas,#berhetSeyir,#r679ZikirAyarBox,#targetPremium,#r642ZikirInfoCard,#r754TefBerhetContext,#r754AtlasContext,#r754SeyirContext,#r170AtlasTools,.r754Ctx',{...panel});
 paint('#berhetAtlas .r168Cell,#berhetSeyir .r168MiniRow,#berhetSeyir .r168Status,#berhetSeyir .r168Progress,#targetPremium .targetDetailCard,#targetPremium .targetDetailCol',{...smallPanel});
 paint('#tab-zkr :is(.cat,.zItem,#zListToggle,.targetModeBtn,.targetManualBtn,.targetApplyBtn,.targetValueBox,.targetValueInput,#bsMode,#bsGap,#bsCustom)',smallPanel);
 paint('#tab-zkr :is(.cat.act,.zItem.act,.targetModeBtn.act,.targetApplyBtn)',{...smallPanel,'border-color':'rgba(246,217,138,.62)','color':'#fff0bd','background-image':'linear-gradient(145deg,rgba(19,74,82,.92),rgba(43,24,75,.92))'});
 // Counter plates: inline-important wins against r721/r722/r616 long selectors.
 document.querySelectorAll('.zCounterSide').forEach(el=>ctrl(el,'control-primary.png','58px'));
 ctrl(document.getElementById('undoBtn'),'control-minus.png','58px');ctrl(document.getElementById('plusBtn'),'control-plus.png','58px');ctrl(document.getElementById('autoBtn'),'control-primary.png','60px');ctrl(document.getElementById('resetBtn'),'control-restart.png','48px');ctrl(document.getElementById('spkOnce'),'control-sound.png','44px');
 const nav=document.querySelectorAll('#r616ZikirNavRow button');if(nav[0])ctrl(nav[0],'control-prev.png','48px');if(nav[1])ctrl(nav[1],'control-restart.png','48px');if(nav[2])ctrl(nav[2],'control-next.png','48px');
 document.querySelectorAll('#r494TefNavSlot .r494NavBtn').forEach(el=>{const a=el.dataset.action;ctrl(el,a==='prev'?'control-prev.png':a==='next'?'control-next.png':'control-restart.png','42px')});
 document.querySelectorAll('#berhetSeyir .r168Buttons button').forEach(el=>{const id=el.id||'';ctrl(el,id==='bsPause'||id==='bsStart'?'control-primary.png':id==='bsPrev'?'control-prev.png':id==='bsNext'?'control-next.png':'control-restart.png','44px')});
 paint('#tfRefinedLayout,#tfRefinedLayout>.tfVisualPanel,#tfRefinedLayout>.tfControlPanel',{...panel,'background-image':'linear-gradient(160deg,rgba(3,16,34,.32),rgba(6,11,28,.58))'});
 paint('#tfRefinedLayout #r706AtmosphereControls,#tfRefinedLayout #r706Motion,#tfRefinedLayout #r470VoiceSource,#tefExitBtn',{...smallPanel});
 paint('#r170Now,#r588DockShell,#r588Peek,#r588Bar,.r588Peek,.r588Bar',{...panel,'background-image':`linear-gradient(155deg,rgba(2,14,31,.94),rgba(7,10,26,.97)),${bg('berhetiyye-name-frame.png')}`,'background-size':'cover,100% 100%','background-position':'center','background-repeat':'no-repeat','border':'0','box-shadow':'0 -10px 34px rgba(0,0,0,.42),0 0 22px rgba(111,230,236,.08)'});
 paint('#r588DockShell button,#r170Now button',{...smallPanel,'color':'#ffe9ae'});
 ring();
 }finally{painting=false}}
function on(){return selected()&&(visible()||document.body.classList.contains('sukun-tefekkur-mode')||!!window.BERHET_SEYIR?.run||!!window.BERHET_SEYIR?.paused)}
function sync(reason){const active=on();if(active!==last){document.body.classList.toggle('r776-berhet-palace',active);try{document.body.dataset.r776BerhetPalace=active?'1':'0'}catch(e){};if(!active){restore();document.getElementById('r776RingSkin')?.remove()}last=active}if(active)skin()}
function queue(ms=16){clearTimeout(timer);timer=setTimeout(()=>sync('queued'),ms)}
function boot(){sync('boot');new MutationObserver(()=>queue(24)).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class','hidden','data-r474-name-category','aria-selected','aria-pressed']})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
['sukun:nowplayingchange','sukun:playbackchange','sukun:zikirchange','sukun:currentzikirchange','sukun:zikirselectionchange','sukun:journey-advance','sukun:secretaccesschange','popstate','pageshow'].forEach(ev=>addEventListener(ev,()=>queue(10),{passive:true}));
document.addEventListener('pointerup',()=>queue(30),{passive:true});document.addEventListener('change',()=>queue(10),{passive:true});setInterval(()=>sync('lease'),900);
window.SukunR776BerhetiyyeAuthority=Object.freeze({version:'r776',sync:()=>sync('api'),active:()=>document.body.classList.contains('r776-berhet-palace'),repaint:skin});
})();
