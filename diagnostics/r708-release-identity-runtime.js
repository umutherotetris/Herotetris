(()=>{
'use strict';
const build=document.querySelector('meta[name="sukun-build"]')?.content||'r708';
const label=document.getElementById('surumEtiket');
if(label){
 const text='SÜKÛN v20.21 — build 2026-09-07-'+build;
 if(label.textContent!==text)label.textContent=text;
 label.dataset.sukunBuild=build;
}
window.SukunReleaseIdentity=Object.freeze({build,version:'r708',snapshot:()=>({build,footer:label?.textContent||'',meta:document.querySelector('meta[name="sukun-build"]')?.content||''})});
})();