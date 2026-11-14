const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
require('dotenv').config({path:path.join(__dirname,'..','.env')});
const app=express(), root=path.join(__dirname,'..'), cache=new Map(), pending=new Map();
const dataDir=path.resolve(process.env.STREAM_TUBE_DATA_DIR||path.join(__dirname,'private'));
fs.mkdirSync(dataDir,{recursive:true});
// Portable shared quotas: atomic lock directories coordinate multiple local Node workers.
// On network filesystems use a transactional shared store (e.g. Redis) instead.
const quotaFile=path.join(dataDir,'quotas.json'), quotaLock=path.join(dataDir,'quotas.lock');
function sleepSync(ms){const b=new SharedArrayBuffer(4);Atomics.wait(new Int32Array(b),0,0,ms)}
function withQuotaLock(fn){
 let acquired=false;
 for(let i=0;i<80;i++){
  try{fs.mkdirSync(quotaLock);acquired=true;break}catch(e){if(e.code!=='EEXIST')throw e;sleepSync(5)}
 }
 if(!acquired)throw Error('Rate limiter storage busy');
 try{
  let data={};try{data=JSON.parse(fs.readFileSync(quotaFile,'utf8'))}catch{}
  const outcome=fn(data);
  const tmp=quotaFile+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data),{mode:0o600});fs.renameSync(tmp,quotaFile);
  return outcome;
 }finally{fs.rmdirSync(quotaLock)}
}
function quota(key,limit,windowMs=60000){
 const now=Date.now();return withQuotaLock(data=>{
  const b=data[key];const fresh=!b||now-b.start>=windowMs;
  const next=fresh?{start:now,count:1}:{start:b.start,count:b.count+1};data[key]=next;
  if(Object.keys(data).length>12000)for(const k of Object.keys(data))if(now-data[k].start>=windowMs)delete data[k];
  return {allowed:next.count<=limit,retryAfter:Math.max(1,Math.ceil((windowMs-(now-next.start))/1000))};
 });
}
const PROVIDER_LIMIT=Math.max(1,Number(process.env.WATCHMODE_REQUESTS_PER_MINUTE)||90);
const ACCOUNT_LIMIT=Math.max(1,Number(process.env.ACCOUNT_REQUESTS_PER_MINUTE)||60);
const MAX_PROVIDER_INFLIGHT=Math.max(1,Number(process.env.WATCHMODE_MAX_INFLIGHT)||6);
let providerInflight=0;
async function providerSlot(fn){
 if(providerInflight>=MAX_PROVIDER_INFLIGHT)throw Error('Streaming data provider busy; try again shortly.');
 providerInflight++;try{return await fn()}finally{providerInflight--}
}

app.disable('x-powered-by');
app.use(express.json({limit:'8kb'}));
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
 res.setHeader('X-Frame-Options','DENY');
 res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
 next();
});
// Shared per-IP and per-account quotas; protect provider separately below.
function rateLimit(req,res,next){
 try{
  const ip=req.ip||req.socket?.remoteAddress||'local';
  const auth=req.path.startsWith('/api/auth/');
  const ipResult=quota('ip:'+ip+':'+(auth?'auth':'api'),auth?12:120);
  if(!ipResult.allowed){res.setHeader('Retry-After',String(ipResult.retryAfter));return res.status(429).json({error:'Too many requests. Try again shortly.'});}
  const u=userFor(req);
  if(u&&!auth){const a=quota('account:'+u.username,ACCOUNT_LIMIT);
   if(!a.allowed){res.setHeader('Retry-After',String(a.retryAfter));return res.status(429).json({error:'Account request limit reached. Try again shortly.'});}
  }
  next();
 }catch(e){return res.status(503).json({error:'Rate limiting temporarily unavailable.'});}
}
app.use('/api',rateLimit);
function scalar(v){return typeof v==='string'?v:null}
function checkQuery(req,res,next){
 const raw=req.originalUrl||req.url||'';
 if(raw.length>4096)return res.status(414).json({error:'Request URL is too long.'});
 for(const [k,v] of Object.entries(req.query||{}))if(typeof v!=='string'||v.length>2000)return res.status(400).json({error:'Invalid query parameter: '+k});
 next();
}
app.use('/api',checkQuery);
function safeProviderUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname&&!u.hostname.endsWith('.local')?u.href:null}catch{return null}}
// Authentication: password hashes are stored server-side; sessions are HttpOnly cookies.
// Single-instance local prototype store; move to a transactional database before deployment.
const dbPath=path.join(dataDir,'accounts.json');
let users=[];try{users=JSON.parse(fs.readFileSync(dbPath,'utf8'))}catch{}
const sessions=new Map();
function sameOrigin(req){const origin=req.headers?.origin;if(!origin)return true;try{const u=new URL(origin);return u.host===req.headers.host}catch{return false}}
app.use('/api/auth',(req,res,next)=>req.method==='POST'&&!sameOrigin(req)?res.status(403).json({error:'Cross-origin request denied.'}):next());
function persistUsers(){fs.mkdirSync(path.dirname(dbPath),{recursive:true});const tmp=dbPath+'.tmp';fs.writeFileSync(tmp,JSON.stringify(users),{mode:0o600});fs.renameSync(tmp,dbPath)}
function publicUser(u){return {firstName:u.firstName,lastName:u.lastName,email:u.email,username:u.username}}
function hashPassword(password,salt){return crypto.scryptSync(password,salt,64).toString('hex')}
function cookieSession(req){const raw=String(req.headers?.cookie||'');const match=raw.match(/(?:^|;\s*)st_session=([a-f0-9]{64})(?:;|$)/);return match?match[1]:null}
function userFor(req){const token=cookieSession(req),s=token&&sessions.get(crypto.createHash('sha256').update(token).digest('hex'));if(!s)return null;if(Date.now()>s.exp){sessions.delete(crypto.createHash('sha256').update(token).digest('hex'));return null}return users.find(u=>u.username===s.username)||null}
function setSession(res,u){const token=crypto.randomBytes(32).toString('hex');sessions.set(crypto.createHash('sha256').update(token).digest('hex'),{username:u.username,exp:Date.now()+86400000});res.setHeader('Set-Cookie',`st_session=${token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=86400${process.env.COOKIE_SECURE==='true'?'; Secure':''}`)}
function requireUser(req,res,next){const u=userFor(req);if(!u)return res.status(401).json({error:'Sign in to access this feature.'});req.user=u;next()}
// Enforced on the server; frontend checks are only a usability aid.
const BLOCKED_PASSWORDS=new Set(['password123456','password12345678','qwerty123456','123456789012','1234567890123456','letmein123456','admin12345678','streamtube123','correcthorsebatterystaple']);
function accountPolicy(username,password,email){
 if(!/^[A-Za-z][A-Za-z0-9_]{3,23}$/.test(username))return 'Username must be 4–24 characters, start with a letter, and contain only letters, numbers or underscores.';
 if(username.includes('__'))return 'Username cannot contain consecutive underscores.';
 if(password.length<12||password.length>128||Buffer.byteLength(password,'utf8')>512)return 'Password must be 12–128 characters (up to 512 UTF-8 bytes).';
 if(/[\u0000-\u001f\u007f]/.test(password))return 'Password cannot contain control characters.';
 const normalized=password.toLowerCase().replace(/[^a-z0-9]/g,'');
 if(BLOCKED_PASSWORDS.has(normalized)||/^(.)\1{11,}$/.test(password))return 'Choose a less common password.';
 if(normalized.includes(username.toLowerCase())||normalized.includes(email.split('@')[0].toLowerCase()))return 'Password cannot contain your username or email name.';
 return null;
}
app.post('/api/auth/register',(req,res)=>{
 const {firstName,lastName,email,username,password}=req.body||{};
 if(![firstName,lastName,email,username,password].every(x=>typeof x==='string')||![firstName,lastName].every(x=>x.trim().length>=2&&x.length<=60)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200||false)return res.status(400).json({error:'Check the fields. Passwords must contain 12–128 characters.'});
 const policyError=accountPolicy(username,password,email);if(policyError)return res.status(400).json({error:policyError});
 if(users.some(u=>u.email===email.toLowerCase()||u.username===username.toLowerCase()))return res.status(409).json({error:'That username or email is already registered.'});
 const salt=crypto.randomBytes(16).toString('hex');const u={firstName:firstName.trim(),lastName:lastName.trim(),email:email.toLowerCase(),username:username.toLowerCase(),salt,hash:hashPassword(password,salt)};
 users.push(u);persistUsers();setSession(res,u);res.status(201).json({user:publicUser(u)});
});
app.post('/api/auth/login',(req,res)=>{
 const {identity,password}=req.body||{};
 if(typeof identity!=='string'||typeof password!=='string'||identity.length>200||password.length>128||Buffer.byteLength(password,'utf8')>512)return res.status(400).json({error:'Invalid sign-in request.'});
 const u=users.find(x=>x.username===identity.toLowerCase()||x.email===identity.toLowerCase());
 const candidate=hashPassword(password,u?.salt||'00000000000000000000000000000000');
 if(!u||!crypto.timingSafeEqual(Buffer.from(candidate,'hex'),Buffer.from(u.hash,'hex')))return res.status(401).json({error:'Invalid username/email or password.'});
 setSession(res,u);res.json({user:publicUser(u)});
});
app.get('/api/auth/me',(req,res)=>{const u=userFor(req);return u?res.json({user:publicUser(u)}):res.status(401).json({error:'Not signed in.'})});
app.post('/api/auth/logout',(req,res)=>{const token=cookieSession(req);if(token)sessions.delete(crypto.createHash('sha256').update(token).digest('hex'));res.setHeader('Set-Cookie','st_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0');res.json({ok:true})});

const API='https://api.watchmode.com/v1';
const SERVICES=[
 {id:'netflix',name:'Netflix',match:/^netflix$/i},
 {id:'hulu',name:'Hulu',match:/^hulu$/i},
 {id:'disney',name:'Disney+',match:/^disney\+$/i},
 {id:'max',name:'Max',match:/^(max|hbo max)$/i},
 {id:'prime',name:'Prime Video',match:/^(amazon prime video|prime video)$/i},
 {id:'peacock',name:'Peacock',match:/^peacock( premium)?$/i}
];
async function watchmode(endpoint,params={}){
 return providerSlot(async()=>{
 const budget=quota('watchmode:global',PROVIDER_LIMIT);
 if(!budget.allowed)throw Error('Streaming provider request budget reached.');
 if(!process.env.WATCHMODE_API_KEY)throw Error('WATCHMODE_API_KEY is missing from .env');
 const url=new URL(API+endpoint);
 Object.entries(params).forEach(([k,v])=>url.searchParams.set(k,v));
 for(let attempt=0;attempt<3;attempt++){
  let response;
  try{response=await fetch(url,{headers:{'X-API-Key':process.env.WATCHMODE_API_KEY},signal:AbortSignal.timeout(12000)})}
  catch(e){if(attempt===2)throw Error('Streaming data provider unavailable.');await new Promise(r=>setTimeout(r,100*(attempt+1)));continue}
  if(response.ok)return response.json();
  if(![429,502,503,504].includes(response.status)||attempt===2)throw Error('Streaming data provider temporarily unavailable.');
  await new Promise(r=>setTimeout(r,150*(attempt+1)));
 }
 throw Error('Streaming data provider unavailable.');
 });
}
async function cached(key,fn,ttl=30*60*1000){
 const hit=cache.get(key);
 if(hit&&Date.now()-hit.time<ttl)return hit.data;
 if(pending.has(key))return pending.get(key);
 const task=Promise.resolve().then(fn).then(data=>{cache.set(key,{time:Date.now(),data});if(cache.size>2500)cache.delete(cache.keys().next().value);return data}).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
async function sourcesDirectory(){
 return cached('sources:US',()=>watchmode('/sources/',{regions:'US',types:'sub'}),24*60*60*1000);
}
function availableServiceIds(directory){
 const found={};
 for(const service of SERVICES){
  const sources=directory.filter(s=>s.type==='sub'&&service.match.test(s.name)&&Array.isArray(s.regions)&&s.regions.includes('US'));
  found[service.id]=sources.map(s=>s.id);
 }
 return found;
}
app.get('/api/health',(req,res)=>res.json({ok:true,apiConfigured:!!process.env.WATCHMODE_API_KEY,providerLimit:PROVIDER_LIMIT}));
app.get('/api/services',async(req,res)=>{
 try{
  const ids=availableServiceIds(await sourcesDirectory());
  res.json({region:'US',services:SERVICES.map(s=>({id:s.id,name:s.name,available:ids[s.id].length>0}))});
 }catch(e){res.status(502).json({error:e.message});}
});
async function search(req,res,netflixOnly=false){
 const q=String(req.query.q||'').trim();
 if(q.length<2||q.length>100)return res.status(400).json({error:'Enter a title between 2 and 100 characters.'});
 try{
  const directory=await sourcesDirectory(), ids=availableServiceIds(directory);
  const found=await cached('search:'+q.toLowerCase(),()=>watchmode('/search/',{search_field:'name',search_value:q,types:'movie,tv'}));
  const titles=(found.title_results||[]).slice(0,12);
  const results=await Promise.all(titles.map(async t=>{
   try{
    const sourceRows=await cached('title:'+t.id+':US',()=>watchmode(`/title/${t.id}/sources/`,{regions:'US'}));
    const rows=Array.isArray(sourceRows)?sourceRows.filter(s=>s.region==='US'&&s.type==='sub'):[];
    const providers=SERVICES.filter(s=>ids[s.id].length>0&&rows.some(row=>ids[s.id].includes(Number(row.source_id)))).map(s=>{
      const entry=rows.find(row=>ids[s.id].includes(Number(row.source_id)));
      return {id:s.id,name:s.name,url:safeProviderUrl(entry?.web_url)};
    });
    return {id:t.id,title:t.name,type:t.type,year:t.year||'',providers,availabilityKnown:true,
      netflix:providers.some(p=>p.id==='netflix'),url:providers.find(p=>p.id==='netflix')?.url||null};
   }catch(e){return {id:t.id,title:t.name,type:t.type,year:t.year||'',providers:[],availabilityKnown:false,netflix:null,url:null};}
  }));
  res.json({query:q,region:'US',services:SERVICES.map(s=>({id:s.id,name:s.name,available:ids[s.id].length>0})),results});
 }catch(e){res.status(502).json({error:e.message});}
}

// Real catalog discovery: only US subscription titles from the selected services.
app.get('/api/recommendations',requireUser,async(req,res)=>{
 const requested=[...new Set(String(req.query.services||'').split(',').filter(id=>SERVICES.some(s=>s.id===id)))];
 const watchedIds=new Set(String(req.query.watched||'').split(',').filter(x=>/^\d+$/.test(x)).slice(0,100));
 const genreNames=String(req.query.genres||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).slice(0,1);
 const requestedCount=Math.min(12,Math.max(8,Number(req.query.count)||8));
 if(!requested.length)return res.json({results:[],message:'Select your streaming services to receive real recommendations.'});
 try{
  const directory=await sourcesDirectory(), mapping=availableServiceIds(directory);
  const sourceIds=[...new Set(requested.flatMap(id=>mapping[id]||[]))];
  if(!sourceIds.length)return res.json({results:[],message:'Watchmode did not identify any selected US subscription providers.'});
  const genreDirectory=await cached('genres',()=>watchmode('/genres/'),24*60*60*1000);
  const genres=Array.isArray(genreDirectory)?genreDirectory:[];
  const genreIds=genres.filter(g=>genreNames.includes(String(g.name||'').toLowerCase())).map(g=>g.id);
  if(genreNames.length&&!genreIds.length)return res.json({results:[],requested:requestedCount,genre:genreNames[0],message:'Unknown genre; no catalog search performed.',pagination:{pagesSearched:0,candidatesChecked:0}});
  const params={types:'movie,tv_series',regions:'US',source_types:'sub',source_ids:sourceIds.join(','),sort_by:'popularity_desc',limit:25};
  if(genreIds.length)params.genres=genreIds.join(',');
  // Page deeper only as necessary. Upper bounds protect the API quota.
  const MAX_RESULTS=requestedCount, MAX_PAGES=12, MAX_CANDIDATES=240;
  const PAGE_SIZE=50;
  params.limit=PAGE_SIZE;
  let pagesSearched=0, apiTitleErrors=0, reachedCatalogEnd=false;
  const results=[];
  const checked=new Set();
  let candidatesChecked=0;
  // Search deeper into the catalog as watched titles are excluded. A single
  // fixed first-page batch cannot replace watched recommendations.
  for(let page=1;page<=MAX_PAGES&&results.length<MAX_RESULTS&&candidatesChecked<MAX_CANDIDATES;page++){
    let pageParams={...params,page};
    let catalog=await cached('recommendations:'+JSON.stringify(pageParams),()=>watchmode('/list-titles/',pageParams));
    let titles=Array.isArray(catalog.titles)?catalog.titles:[];
    pagesSearched++;
    if(!titles.length){reachedCatalogEnd=true;break;}
    // Do not silently fall back to a different genre: each row must match its label.
    for(const t of titles){
      if(results.length>=MAX_RESULTS||candidatesChecked>=MAX_CANDIDATES)break;
      if(watchedIds.has(String(t.id))||checked.has(String(t.id)))continue;
      checked.add(String(t.id));candidatesChecked++;
      try{
        const [detail,sourceRows]=await Promise.all([
          cached('details:'+t.id,()=>watchmode(`/title/${t.id}/details/`),24*60*60*1000),
          cached('title:'+t.id+':US',()=>watchmode(`/title/${t.id}/sources/`,{regions:'US'}))
        ]);
        const rows=Array.isArray(sourceRows)?sourceRows.filter(r=>r.region==='US'&&r.type==='sub'):[];
        const providers=SERVICES.filter(p=>requested.includes(p.id)&&rows.some(r=>(mapping[p.id]||[]).includes(Number(r.source_id)))).map(p=>{
          const entry=rows.find(r=>(mapping[p.id]||[]).includes(Number(r.source_id)));
          return {id:p.id,name:p.name,url:safeProviderUrl(entry?.web_url)};
        });
        if(!providers.length)continue;
        const titleGenres=Array.isArray(detail.genre_names)?detail.genre_names:
          (Array.isArray(detail.genres)?detail.genres.map(id=>genres.find(g=>Number(g.id)===Number(id))?.name).filter(Boolean):[]);
        const overlap=titleGenres.filter(g=>genreNames.includes(g.toLowerCase())).length;
        if(genreNames.length&&!overlap)continue;
        results.push({id:t.id,title:detail.title||t.title||'Untitled',year:detail.year||t.year||'',
          type:detail.type||t.type||'',genre:titleGenres.join(' · '),providers,
          score:overlap*40+(providers.length*12)+(Number(detail.user_rating||0)*2),
          reason:overlap?'Matches genres in your watch history':'Popular on your selected services'});
      }catch(e){apiTitleErrors++;/* Skip this title and try another candidate. */}
    }
    if(titles.length<params.limit){reachedCatalogEnd=true;break;}
  }
  res.json({results:results.sort((a,b)=>b.score-a.score).slice(0,MAX_RESULTS),requested:MAX_RESULTS,
    genre:genreNames[0]||null,region:'US',source:'Watchmode',
    pagination:{pagesSearched,candidatesChecked,apiTitleErrors,maxPages:MAX_PAGES,
      reachedCatalogEnd,filled:results.length>=MAX_RESULTS,
      stoppedByLimit:!reachedCatalogEnd&&results.length<MAX_RESULTS&&(pagesSearched>=MAX_PAGES||candidatesChecked>=MAX_CANDIDATES)}});
 }catch(e){res.status(502).json({error:e.message});}
});

app.get('/api/search',(req,res)=>search(req,res));
app.get('/api/netflix/search',(req,res)=>search(req,res,true));
app.use('/server',(req,res)=>res.sendStatus(404));
app.use('/private',(req,res)=>res.sendStatus(404));
app.use('/data',(req,res)=>res.sendStatus(404));
app.use(express.static(root,{dotfiles:'deny',index:'index.html'}));
if(require.main===module)app.listen(Number(process.env.PORT)||3000,process.env.HOST||'127.0.0.1',()=>console.log('Stream Tube: http://localhost:'+(process.env.PORT||3000)));
module.exports={app,quota,accountPolicy};
