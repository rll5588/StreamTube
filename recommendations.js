/* Version 8.1: local watch history and live Watchmode recommendations grouped by genre. */
(()=>{
'use strict';
const KEY='streamtube_watch_history_v1';
const GENRES=['Action','Adventure','Comedy','Documentary','Drama','Fantasy','Mystery','Nature','Romance','Sci-Fi','Thriller'];
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function history(){try{const v=JSON.parse(localStorage.getItem(KEY));return Array.isArray(v)?v:[]}catch{return []}}
function save(items){localStorage.setItem(KEY,JSON.stringify(items));render()}
function add(item){
 const all=history().filter(x=>x.key!==item.key);
 all.unshift({...item,watchedAt:new Date().toISOString()});save(all);
}
function demo(id){
 const t=CATALOG.find(x=>x.id===Number(id));if(!t)return;
 add({key:'demo:'+t.id,title:t.title,year:t.year,type:t.type,genre:t.genre,providers:t.providers,source:'sample'});
}
function live(t){
 const options=GENRES.map(x=>`<option value="${esc(x)}">${esc(x)}</option>`).join('');
 const genre=prompt('What genre best describes "'+t.title+'"?\nChoose one: '+GENRES.join(', '),'Drama');
 if(genre===null)return;
 const normalized=GENRES.find(x=>x.toLowerCase()===genre.trim().toLowerCase());
 if(!normalized){alert('Choose one of the listed genres to add this title to watch history.');return}
 add({key:'live:'+t.id,title:t.title,year:t.year,type:t.type,genre:normalized,providers:(t.providers||[]).map(x=>x.id),source:'watchmode'});
}
function bindLive(results){
 const map=new Map(results.map(x=>[String(x.id),x]));
 document.querySelectorAll('[data-watched-live]').forEach(b=>b.onclick=()=>{const t=map.get(b.dataset.watchedLive);if(t)live(t)});
}

let requestNumber=0;
function serviceSelection(){
 try{
  const v=typeof selected!=='undefined'?selected:[];
  return Array.isArray(v)?v.filter(x=>typeof x==='string'):[];
 }catch{return []}
}
async function refresh(){
 const all=history(),services=serviceSelection(),number=++requestNumber;
 if(typeof signedIn!=='undefined'&&!signedIn){$('recommendation-results').innerHTML='<div class="empty">Sign in to request personalized recommendations.</div>';return;}
 const output=$('recommendation-results'),status=$('recommendation-explanation');
 if(!services.length){
  output.innerHTML='<div class="empty">Select your streaming services to see real recommendations.</div>';
  status.textContent='Recommendations are based on selected services and manually recorded watch history.';
  return;
 }
 output.innerHTML='<div class="empty">Loading recommendations by genre…</div>';
 const counts=new Map();
 all.forEach(x=>String(x.genre||'').split(/[·,/]/).map(g=>g.trim()).filter(Boolean).forEach(g=>counts.set(g.toLowerCase(),(counts.get(g.toLowerCase())||0)+1)));
 const favorites=[...counts].sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 const defaults=['Drama','Comedy','Action','Sci-Fi'];
 const genreNames=[...new Set([...favorites,...defaults.map(x=>x.toLowerCase())])].slice(0,4).map(x=>GENRES.find(g=>g.toLowerCase()===x)||defaults.find(g=>g.toLowerCase()===x)||x);
 const watched=all.filter(x=>x.source==='watchmode').map(x=>x.key.split(':')[1]).filter(x=>/^\d+$/.test(x)).slice(0,100);
 const seenTitles=new Set(all.map(x=>String(x.title||'').toLowerCase()));
 const card=t=>`<article class="card"><div class="poster" style="--c1:#453681;--c2:#15121e"><strong>${esc(t.title)}</strong></div><div class="card-body"><div class="meta">WATCHMODE · ${esc(t.year)} · ${esc(t.type)}</div><p>${esc(t.genre||'Genre unavailable')}</p><p>${esc(t.reason)}</p><div class="provider-tags">${(t.providers||[]).map(p=>`<span>${esc(p.name)}</span>`).join('')}</div><div class="card-actions"><button type="button" data-watched-recommendation="${esc(t.id)}">✓ Watched</button>${(t.providers||[]).filter(p=>p.url&&/^https:\/\//.test(p.url)).map(p=>`<a class="provider-link" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Open ${esc(p.name)} ↗</a>`).join('')}</div></div></article>`;
 output.innerHTML=genreNames.map(genre=>`<section class="recommendation-genre" data-genre="${esc(genre)}"><div class="section-head recommendation-genre-heading"><h3>${esc(genre)}</h3><span class="genre-count">Loading…</span></div><p class="genre-pagination-note" aria-live="polite"></p><div class="cards" role="region" tabindex="0" aria-label="Scroll ${esc(genre)} recommendations horizontally"><div class="empty">Finding titles…</div></div></section>`).join('');
 status.textContent='Searching Watchmode separately for each genre. Up to 8 titles per genre on your selected services (not subscription-verified). Additional catalog pages are checked as needed.';
 const allFound=new Map();
 // Sequential requests prevent a large simultaneous burst against Watchmode.
 for(const genre of genreNames){
  if(number!==requestNumber)return;
  const section=[...output.querySelectorAll('.recommendation-genre')].find(el=>el.dataset.genre===genre);
  if(!section)continue;
  const grid=section.querySelector('.cards'),count=section.querySelector('.genre-count');
  const params=new URLSearchParams({services:services.join(','),genres:genre,watched:watched.join(','),count:'8'});
  try{
   const response=await fetch('/api/recommendations?'+params,{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Recommendation request failed');
   if(number!==requestNumber)return;
   const titles=(data.results||[]).filter(t=>!seenTitles.has(String(t.title||'').toLowerCase())&&!allFound.has(String(t.id))).slice(0,8);
   titles.forEach(t=>allFound.set(String(t.id),t));
   count.textContent=`${titles.length} of 8 titles`;
   const info=data.pagination||{};
   const details=section.querySelector('.genre-pagination-note');
   if(details)details.textContent=info.pagesSearched
    ?`Searched ${info.pagesSearched} catalog ${info.pagesSearched===1?'page':'pages'} · ${info.candidatesChecked||0} titles checked${info.stoppedByLimit?' · Search limit reached':''}`
    :'';
   grid.innerHTML=titles.length?titles.map(card).join(''):'<div class="empty">No eligible titles found in this genre for your selected services.</div>';
   grid.querySelectorAll('[data-watched-recommendation]').forEach(b=>b.onclick=()=>{
    const t=allFound.get(b.dataset.watchedRecommendation);
    if(t)add({key:'live:'+t.id,title:t.title,year:t.year,type:t.type,genre:t.genre,providers:t.providers.map(p=>p.id),source:'watchmode'});
   });
  }catch(e){
   if(number!==requestNumber)return;
   count.textContent='Unavailable';
   grid.innerHTML=`<div class="empty">Could not load ${esc(genre)} recommendations: ${esc(e.message)}</div>`;
  }
 }
}
function render(){
 const all=history();
 $('history-results').innerHTML=all.length?all.map(t=>`<div class="history-entry"><div><strong>${esc(t.title)}</strong><div class="meta">${esc(t.type||'')} · ${esc(t.genre||'')} · ${t.source==='watchmode'?'Watchmode':'Sample catalog'}</div></div><button class="secondary" type="button" data-remove-history="${esc(t.key)}">Remove</button></div>`).join(''):'<div class="empty">No watch history yet. Search for a title and select “Mark watched.”</div>';
 document.querySelectorAll('[data-remove-history]').forEach(b=>b.onclick=()=>save(history().filter(x=>x.key!==b.dataset.removeHistory)));
 document.querySelectorAll('[data-watched-demo]').forEach(b=>b.onclick=()=>demo(b.dataset.watchedDemo));
 refresh();
}
$('clear-history').onclick=()=>{if(confirm('Remove all locally saved watch history?'))save([])};
window.StreamTubeRecommendations={render,bindLive};
render();
window.addEventListener('storage',render);
window.addEventListener('streamtube-services-changed',refresh);
})();
