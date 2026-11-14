/* Watchmode multi-service search. Preserves Version 3 prototype. */
(()=>{
const form=document.getElementById('search-form'), input=document.getElementById('query');
const live=document.getElementById('netflix-live-results'), demo=document.getElementById('results');
const status=document.getElementById('netflix-live-status'), clear=document.getElementById('clear-search');
const heading=document.getElementById('results-heading');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let counter=0;
function reset(){
 counter++;live.hidden=true;live.innerHTML='';demo.hidden=false;status.textContent='';
 heading.textContent='Popular right now';clear.hidden=true;
}
form.addEventListener('submit',async e=>{
 e.preventDefault();e.stopImmediatePropagation();
 const q=input.value.trim();if(!q){reset();return}
 const n=++counter;
 live.hidden=false;demo.hidden=true;heading.textContent=`Results for “${q}”`;
 clear.hidden=false;status.textContent='Searching titles and checking streaming services in the US…';
 live.innerHTML='';
 try{
  const response=await fetch('/api/search?q='+encodeURIComponent(q));
  const data=await response.json();
  if(!response.ok)throw Error(data.error||'Search failed');
  if(n!==counter)return;
  const unavailable=(data.services||[]).filter(s=>!s.available).map(s=>s.name);
  const results=data.results||[];
  status.textContent=`${results.length} matching titles checked across supported US streaming services.`+
    (unavailable.length?' Provider mapping not confirmed for: '+unavailable.join(', ')+'.':'');
  live.innerHTML=results.length?results.map(t=>{
   const providers=t.providers||[];
   const selectedServices=(()=>{try{return JSON.parse(localStorage.getItem('streamtube_demo_services'))||['netflix','hulu','disney']}catch{return ['netflix','hulu','disney']}})();
   const matches=providers.filter(p=>selectedServices.includes(p.id));
   const label=!t.availabilityKnown?'Availability not confirmed':matches.length?
     '✓ Included in your selected services: '+matches.map(p=>p.name).join(', '):
     providers.length?'Available on: '+providers.map(p=>p.name).join(', '):
     'Not listed on the supported subscription services';
   const watchedButton=`<button type="button" data-watched-live="${esc(t.id)}">✓ Mark watched</button>`;
   const links=providers.filter(p=>p.url&&/^https:\/\//i.test(p.url)).map(p=>
     `<a class="provider-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open ${esc(p.name)} ↗</a>`).join('');
   return `<article class="card"><div class="poster" style="--c1:#453681;--c2:#15121e"><strong>${esc(t.title)}</strong></div><div class="card-body"><div class="meta">${esc(t.year)} · ${esc(t.type)}</div><div class="${matches.length?'match':'match not-match'}">${esc(label)}</div><div class="provider-tags">${providers.map(p=>`<span>${esc(p.name)}</span>`).join('')}</div><div class="card-actions">${watchedButton}${links}</div></div></article>`;
  }).join(''):'<div class="empty">No matching titles were found.</div>';
  window.StreamTubeRecommendations?.bindLive(results);
 }catch(err){if(n!==counter)return;status.textContent='Live search unavailable: '+err.message;live.innerHTML='<div class="empty">Check the server and Watchmode API key. Clear the search to return to the demo titles.</div>';}
},true);
clear.addEventListener('click',()=>reset());
})();
