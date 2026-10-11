/* Stream Tube demonstration: sample data only. No third-party API or provider authentication. */
const SERVICES = [
  {id:'netflix',name:'Netflix',mark:'N',color:'#922c39'},
  {id:'hulu',name:'Hulu',mark:'h',color:'#196c54'},
  {id:'disney',name:'Disney+',mark:'D+',color:'#1c4e91'},
  {id:'max',name:'Max',mark:'M',color:'#533a91'},
  {id:'prime',name:'Prime Video',mark:'▶',color:'#216d91'},
  {id:'peacock',name:'Peacock',mark:'P',color:'#6b468e'}
];
// Illustrative fictional titles and provider matches; replace with licensed API results later.
const CATALOG = [
  {id:1,title:'Beyond the Horizon',type:'Movie',year:2025,genre:'Sci-Fi · Adventure',providers:['netflix','prime'],colors:['#314f87','#13172b'],description:'A crew follows a mysterious signal beyond familiar stars.'},
  {id:2,title:'City After Dark',type:'TV Series',year:2024,genre:'Mystery · Drama',providers:['hulu','disney'],colors:['#7c3e5d','#221c3c'],description:'A reporter uncovers secrets hidden in a sleepless city.'},
  {id:3,title:'The Last Kingdom Road',type:'Movie',year:2026,genre:'Fantasy · Action',providers:['max'],colors:['#756142','#24253b'],description:'A traveler returns to a kingdom on the edge of change.'},
  {id:4,title:'Deep Blue',type:'TV Series',year:2023,genre:'Nature · Documentary',providers:['disney','peacock'],colors:['#1b7b9d','#11283c'],description:'Explore life beneath the ocean surface.'},
  {id:5,title:'Second Chances',type:'Movie',year:2024,genre:'Comedy · Romance',providers:['netflix','hulu'],colors:['#aa6d69','#41274d'],description:'Two old friends reconnect in an unexpected way.'},
  {id:6,title:'Orbit Station',type:'TV Series',year:2026,genre:'Sci-Fi · Thriller',providers:['prime','max'],colors:['#386b80','#1d1c46'],description:'A distant station receives an impossible message.'}
];
const keyServices='streamtube_demo_services',keyWatchlist='streamtube_demo_watchlist';
function read(key,fallback){try{const value=JSON.parse(localStorage.getItem(key));return Array.isArray(value)?value:fallback}catch{return fallback}}
let selected=read(keyServices,['netflix','hulu','disney']);
let saved=read(keyWatchlist,[]);
const $=id=>document.getElementById(id);
const serviceName=id=>SERVICES.find(s=>s.id===id)?.name||id;
function persist(){localStorage.setItem(keyServices,JSON.stringify(selected));localStorage.setItem(keyWatchlist,JSON.stringify(saved))}
function renderServices(){
 $('service-count').textContent=`${selected.length} selected`;
 $('service-grid').innerHTML=SERVICES.map(s=>`<label class="service ${selected.includes(s.id)?'selected':''}"><span class="symbol" style="--shade:${s.color}">${s.mark}</span><span class="service-name">${s.name}</span><input type="checkbox" data-service="${s.id}" ${selected.includes(s.id)?'checked':''} aria-label="Select ${s.name}"></label>`).join('');
 document.querySelectorAll('[data-service]').forEach(input=>input.addEventListener('change',()=>{selected=input.checked?[...selected,input.dataset.service]:selected.filter(x=>x!==input.dataset.service);persist();renderServices();renderCards();}));
}
function card(item){const matches=item.providers.filter(p=>selected.includes(p));const isSaved=saved.includes(item.id);
 return `<article class="card"><div class="poster" style="--c1:${item.colors[0]};--c2:${item.colors[1]}"><strong>${item.title}</strong></div><div class="card-body"><div class="meta">${item.year} · ${item.type} · ${item.genre}</div><div class="${matches.length?'match':'match not-match'}">${matches.length?'✓ Included in your services':'Not in your selected services'}</div><div class="provider-tags">${item.providers.map(p=>`<span>${serviceName(p)}</span>`).join('')}</div><div class="card-actions"><button data-details="${item.id}">Where to watch</button><button data-save="${item.id}">${isSaved?'♥ Saved':'♡ Save'}</button></div></div></article>`}
let searchTerm='';
function attachCardEvents(){document.querySelectorAll('[data-save]').forEach(b=>b.onclick=()=>{const id=Number(b.dataset.save);saved=saved.includes(id)?saved.filter(x=>x!==id):[...saved,id];persist();renderCards()});document.querySelectorAll('[data-details]').forEach(b=>b.onclick=()=>openDetails(Number(b.dataset.details)))}
function renderCards(){const filtered=CATALOG.filter(item=>(item.title+' '+item.genre+' '+item.type).toLowerCase().includes(searchTerm.toLowerCase()));$('results-heading').textContent=searchTerm?`Results for “${searchTerm}”`:'Popular right now';$('clear-search').hidden=!searchTerm;$('results').innerHTML=filtered.length?filtered.map(card).join(''):'<div class="empty">No matching titles in the demo catalog. Try “Orbit,” “City,” or “Blue.”</div>';
 const watch=CATALOG.filter(item=>saved.includes(item.id));$('watchlist-results').innerHTML=watch.length?watch.map(card).join(''):'<div class="empty">Your watchlist is empty. Explore titles and select “Save” to add them here.</div>';attachCardEvents()}
function openDetails(id){const item=CATALOG.find(x=>x.id===id);const matches=item.providers.filter(p=>selected.includes(p));$('details-body').innerHTML=`<p class="eyebrow">${item.type} · ${item.year}</p><h2>${item.title}</h2><p>${item.description}</p><p class="meta">${item.genre}</p><h3>Streaming availability (demo)</h3><p>${matches.length?'Available on '+matches.map(serviceName).join(', ')+' in your selected services.':'None of your selected services match this title.'}</p><div class="details-providers">${item.providers.map(p=>`<div class="provider-row"><strong>${serviceName(p)}</strong><span>${selected.includes(p)?'✓ Your service':'Other provider'}</span></div>`).join('')}</div><p class="meta">Provider links are intentionally disabled in this mockup. Actual availability and supported links will come from an external API.</p>`;$('details').showModal()}
function navigate(){const page=['home','services','watchlist'].includes(location.hash.slice(1))?location.hash.slice(1):'home';document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page);document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page))}
$('search-form').addEventListener('submit',e=>{e.preventDefault();searchTerm=$('query').value.trim();renderCards()});$('clear-search').onclick=()=>{searchTerm='';$('query').value='';renderCards()};$('services-done').onclick=()=>location.hash='home';$('close-details').onclick=()=>$('details').close();window.addEventListener('hashchange',navigate);renderServices();renderCards();navigate();

/* ---------- Version 2 account prototype ---------- */
const keyAccount='streamtube_demo_account';
const keySession='streamtube_demo_session';
let account=null;
try{account=JSON.parse(localStorage.getItem(keyAccount))}catch{account=null}
let signedIn=localStorage.getItem(keySession)==='true' && !!account;

function initials(user){return user?`${user.firstName?.[0]||''}${user.lastName?.[0]||''}`.toUpperCase()||'ST':'ST'}
function clearAuthErrors(){document.querySelectorAll('.field-error,.form-error').forEach(el=>el.textContent='');document.querySelectorAll('.auth-form input').forEach(el=>el.classList.remove('invalid'))}
function setFieldError(id,message){const input=$(id),error=$(`${id}-error`);if(input)input.classList.add('invalid');if(error)error.textContent=message}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)}

function updateAccountUI(){
  $('auth-actions').hidden=signedIn;
  $('user-menu').hidden=!signedIn;
  $('signed-out-account').hidden=signedIn;
  $('signed-in-account').hidden=!signedIn;
  if(signedIn&&account){
    const fullName=`${account.firstName} ${account.lastName}`.trim();
    $('avatar').textContent=initials(account);$('user-menu-name').textContent=account.firstName;
    $('profile-avatar').textContent=initials(account);$('profile-name').textContent=fullName;
    $('profile-email').textContent=account.email;$('profile-username').textContent=`@${account.username}`;
    $('profile-services').textContent=selected.length;$('profile-watchlist').textContent=saved.length;
  }
}

function showAuth(mode='signin'){
  clearAuthErrors();
  const create=mode==='create';
  $('signin-form').hidden=create;$('create-form').hidden=!create;
  $('signin-tab').classList.toggle('active',!create);$('create-tab').classList.toggle('active',create);
  if(!$('auth-dialog').open)$('auth-dialog').showModal();
}

document.querySelectorAll('[data-open-auth]').forEach(button=>button.addEventListener('click',()=>showAuth(button.dataset.openAuth)));
$('signin-tab').onclick=()=>showAuth('signin');$('create-tab').onclick=()=>showAuth('create');$('close-auth').onclick=()=>$('auth-dialog').close();
$('user-menu').onclick=()=>location.hash='account';

$('create-form').addEventListener('submit',e=>{
  e.preventDefault();clearAuthErrors();
  const firstName=$('first-name').value.trim(),lastName=$('last-name').value.trim(),email=$('create-email').value.trim().toLowerCase(),username=$('create-username').value.trim(),password=$('create-password').value,confirm=$('confirm-password').value;
  let ok=true;
  if(firstName.length<2){setFieldError('first-name','Enter at least 2 characters.');ok=false}
  if(lastName.length<2){setFieldError('last-name','Enter at least 2 characters.');ok=false}
  if(!validEmail(email)){setFieldError('create-email','Enter a valid email address.');ok=false}
  if(!/^[A-Za-z0-9_]{3,20}$/.test(username)){setFieldError('create-username','Use 3–20 letters, numbers, or underscores.');ok=false}
  if(password.length<8){setFieldError('create-password','Password must be at least 8 characters.');ok=false}
  if(confirm!==password){setFieldError('confirm-password','Passwords do not match.');ok=false}
  if(!ok)return;
  account={firstName,lastName,email,username,password}; // Demo only; never store plain-text passwords in production.
  localStorage.setItem(keyAccount,JSON.stringify(account));localStorage.setItem(keySession,'true');signedIn=true;
  $('create-form').reset();$('auth-dialog').close();updateAccountUI();location.hash='account';
});

$('signin-form').addEventListener('submit',e=>{
  e.preventDefault();clearAuthErrors();
  const id=$('signin-id').value.trim().toLowerCase(),password=$('signin-password').value;
  if(!account){$('signin-error').textContent='No local account exists yet. Choose Create account first.';return}
  const identityMatch=id===account.email.toLowerCase()||id===account.username.toLowerCase();
  if(!identityMatch||password!==account.password){$('signin-error').textContent='The username/email or password does not match this demo account.';return}
  signedIn=true;localStorage.setItem(keySession,'true');$('signin-form').reset();$('auth-dialog').close();updateAccountUI();location.hash='account';
});

$('sign-out').onclick=()=>{signedIn=false;localStorage.removeItem(keySession);updateAccountUI();location.hash='home'};

// Extend the original navigation to include the Account page.
function navigateV2(){const page=['home','services','watchlist','account'].includes(location.hash.slice(1))?location.hash.slice(1):'home';document.querySelectorAll('.page').forEach(el=>el.hidden=el.id!==page);document.querySelectorAll('[data-page]').forEach(el=>el.classList.toggle('active',el.dataset.page===page));updateAccountUI()}
window.removeEventListener('hashchange',navigate);window.addEventListener('hashchange',navigateV2);
updateAccountUI();navigateV2();

/* ---------- Version 3 streaming-account connection prototype ---------- */
const keyConnections='streamtube_demo_connections';
let connections={};
try{connections=JSON.parse(localStorage.getItem(keyConnections))||{}}catch{connections={}}

function connectionState(id){
  if(!selected.includes(id)) return 'unselected';
  return connections[id]?.status || 'selected';
}
function connectionLabel(state){
  return {unselected:'Not selected',selected:'Selected · Not verified',verified:'Verified · Active',disconnected:'Disconnected'}[state]||state;
}
function persistConnections(){localStorage.setItem(keyConnections,JSON.stringify(connections))}
function verifiedCount(){return SERVICES.filter(s=>connectionState(s.id)==='verified').length}
function connectionCard(service){
  const state=connectionState(service.id);
  const selectedNow=selected.includes(service.id);
  const action = !selectedNow
    ? `<button class="secondary" data-add-service="${service.id}">Add service</button>`
    : state==='verified'
      ? `<button class="secondary" data-connect="${service.id}">View connection</button><button class="secondary danger" data-disconnect="${service.id}">Disconnect</button>`
      : `<button class="primary" data-connect="${service.id}">Connect account</button>`;
  return `<article class="connection-card"><span class="symbol" style="--shade:${service.color}">${service.mark}</span><div class="connection-card-main"><span class="status-badge status-${state}">${connectionLabel(state)}</span><h3>${service.name}</h3><p>${state==='verified'?'Prototype verification completed. A production version would rely on the provider’s approved authorization response.':'Connect through the provider when supported. Never enter your provider password into Stream Tube.'}</p><div class="connection-actions">${action}</div></div></article>`;
}
function renderConnections(){
  const html=SERVICES.map(connectionCard).join('');
  if($('connection-grid')) $('connection-grid').innerHTML=html;
  if($('account-connection-grid')) $('account-connection-grid').innerHTML=html;
  if($('profile-verified')) $('profile-verified').textContent=verifiedCount();
  document.querySelectorAll('[data-add-service]').forEach(b=>b.onclick=()=>{if(!selected.includes(b.dataset.addService))selected.push(b.dataset.addService);persist();renderServices();renderConnections();updateAccountUI();});
  document.querySelectorAll('[data-connect]').forEach(b=>b.onclick=()=>openConnection(b.dataset.connect));
  document.querySelectorAll('[data-disconnect]').forEach(b=>b.onclick=()=>{connections[b.dataset.disconnect]={status:'disconnected'};persistConnections();renderConnections();updateAccountUI();});
}
function openConnection(id){
  const service=SERVICES.find(s=>s.id===id); if(!service)return;
  const state=connectionState(id);
  $('connect-body').innerHTML=`<p class="eyebrow">SECURE PROVIDER CONNECTION</p><h2>${service.name}</h2><p>Stream Tube would send you to ${service.name}'s approved authorization page if an integration is available.</p><div class="connection-step"><b>1</b><p>Leave Stream Tube and authenticate directly with the streaming provider.</p></div><div class="connection-step"><b>2</b><p>Approve only the permissions required to confirm subscription status.</p></div><div class="connection-step"><b>3</b><p>Return to Stream Tube with a provider-issued authorization result. Your provider password is never stored by Stream Tube.</p></div><div class="verify-note"><strong>Prototype simulation:</strong> This button does not contact ${service.name}. It only demonstrates what a successful provider verification would look like.</div>${state==='verified'?`<p class="status-badge status-verified">Verified · Active</p>`:`<button class="primary" id="simulate-verification">Simulate successful verification →</button>`}`;
  if(!$('connect-dialog').open)$('connect-dialog').showModal();
  const simulate=$('simulate-verification');
  if(simulate)simulate.onclick=()=>{connections[id]={status:'verified',verifiedAt:new Date().toISOString()};persistConnections();$('connect-dialog').close();renderConnections();updateAccountUI();};
}
$('close-connect').onclick=()=>$('connect-dialog').close();
$('manage-connections').onclick=()=>location.hash='services';

// Keep connection status aligned with service selection changes.
const originalRenderServicesV3=renderServices;
renderServices=function(){
  originalRenderServicesV3();
  document.querySelectorAll('[data-service]').forEach(input=>{
    input.addEventListener('change',()=>{
      if(!input.checked && connections[input.dataset.service]?.status==='verified') connections[input.dataset.service]={status:'disconnected'};
      persistConnections(); renderConnections(); updateAccountUI();
    });
  });
  renderConnections();
};

// Extend account UI with verified-service count.
const originalUpdateAccountUIV3=updateAccountUI;
updateAccountUI=function(){originalUpdateAccountUIV3();if($('profile-verified'))$('profile-verified').textContent=verifiedCount();renderConnections();};

renderServices();
updateAccountUI();
