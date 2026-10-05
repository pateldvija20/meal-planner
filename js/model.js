/* ================= people & targets ================= */
// Mifflin-St Jeor (calculator.net default). Activity: light 1.375, moderate (4-5×/wk) 1.465.
const mifflin = p => 10*p.kg + 6.25*p.cm - 5*p.age + (p.sex==='f' ? -161 : 5);
const round50 = x => Math.round(x/50)*50;
const PEOPLE = [
  {id:'m3', key:'dvija',  label:'Dvija',  note:'losing',  goal:'Lose 0.5 kg/wk · build muscle', sex:'f', age:25, kg:80, cm:175.3, act:1.375, adj:-550, protein:120,
    email:'pateldvija20@gmail.com', hex:'#1F7A72'},
  {id:'m1', key:'akshar', label:'Akshar', note:'gaining', goal:'Lean gain 0.25 kg/wk · build muscle', sex:'m', age:25, kg:59, cm:172.7, act:1.465, adj:275, protein:115,
    email:'axr230102@gmail.com', hex:'#B26A12'},
  {id:'m2', key:'aum',    label:'Aum',    note:'gaining', goal:'Lean gain 0.25 kg/wk · build muscle', sex:'m', age:25, kg:62, cm:180.3, act:1.465, adj:275, protein:120,
    email:'aumsathwara2811@gmail.com', hex:'#7A4E8C'},
];
function computePerson(p){
  p.bmr = Math.round(mifflin(p));
  p.tdee = Math.round(p.bmr*p.act);
  p.target = round50(p.tdee + p.adj);
  p.bmi = +(p.kg/((p.cm/100)**2)).toFixed(1);
}
PEOPLE.forEach(p=>{ p.baseKg=p.kg; computePerson(p); });
// weights saved from the tracker ("use for my targets") override the starting weight
function applyProfiles(){ PEOPLE.forEach(p=>{ const o=(state&&state.profile||{})[p.id]; p.kg = o&&o.kg ? o.kg : p.baseKg; computePerson(p); }); }
const personById = id => PEOPLE.find(p=>p.id===id);
const personByEmail = em => PEOPLE.find(p=>p.email===(em||'').toLowerCase());
// Micronutrient reference intakes (adult DRIs)
const MICRO_TARGET = {
  m3:{fib:25,fe:18,ca:1000,mg:320,k:2600,b12:2.4,d:15},
  m1:{fib:38,fe:8,ca:1000,mg:420,k:3400,b12:2.4,d:15},
  m2:{fib:38,fe:8,ca:1000,mg:420,k:3400,b12:2.4,d:15},
};
const MICRO_KEYS=[['fib','Fibre','g'],['fe','Iron','mg'],['ca','Calcium','mg'],['mg','Magnesium','mg'],['k','Potassium','mg'],['b12','Vitamin B12','mcg'],['d','Vitamin D','mcg']];

/* ================= day structure ================= */
const DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const FULLDAY=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS=[
  {id:'drink',     label:'Morning drink', fixed:true},
  {id:'breakfast', label:'Breakfast'},
  {id:'shake',     label:'Protein shake', fixed:true},
  {id:'lunch',     label:'Lunch'},
  {id:'snack',     label:'Weekly snack', weekly:true},
  {id:'dinner',    label:'Dinner'},
];
const MEAL_SLOTS=['breakfast','lunch','dinner'];
const SLOT_LABEL=Object.fromEntries(SLOTS.map(s=>[s.id,s.label]));
const SPLIT={breakfast:.36, lunch:.30, dinner:.34};     // share of what's left after drink + shake
const LEFTOVER_DAYS=[0,1,2,3,4];                         // Mon–Fri lunch = previous night's dinner
const FARALI={pid:'m2', day:3};                          // Aum eats farali lunch + dinner on Thursday
const DAYNOTE=['','','','Farali · Aum','','','Cook for Mon lunch'];
const CATS={breakfast:'#D79A12', main:'#B9432B', drink:'#2F6FA8', shake:'#2F6FA8', snack:'#2B7346'};
const CAT_LABEL={breakfast:'breakfast', main:'lunch & dinner', drink:'daily', shake:'daily', snack:'weekly snack'};

/* ================= protein variants (shared-base chicken dishes) ================= */
const CHICKEN_EATERS=['m1','m2'];           // Akshar & Aum eat chicken; Dvija is vegetarian
const NO_CHICKEN_DAYS=[3,5];                // never on Thursday or Saturday (day the food is EATEN)
// which protein a person gets from a two-protein recipe; d = day eaten (null = generic view)
function variantFor(r,pid,d){
  if(!r||!r.protein) return null;
  return CHICKEN_EATERS.includes(pid) && !NO_CHICKEN_DAYS.includes(d) ? 'chicken' : 'veg';
}
const recipeIng=(r,variant)=> r.protein ? (r.ing||[]).concat([r.protein[variant||'veg']]) : (r.ing||[]);

/* ================= nutrition ================= */
const nutCache={};
function gramsOf(foodKey,qty,unit){ const f=FOODS[foodKey]; return unit===''? qty*((f&&f.each)||100) : qty; }
function nutritionOf(r,variant){            // per ONE serving
  const ck=r.id+'|'+(variant||'');
  if(nutCache[ck]) return nutCache[ck];
  const t=Object.fromEntries(NKEYS.map(k=>[k,0]));
  if(r.per){ Object.assign(t,r.per); }
  else recipeIng(r,variant).forEach(([k,q,u])=>{ const f=FOODS[k]; if(!f) return; const g=gramsOf(k,q,u); NKEYS.forEach((key,i)=>t[key]+=f.n[i]*g/100); });
  t.known = !r.per;                         // micros only meaningful when computed from foods
  return nutCache[ck]=t;
}
// derived labels
const hasEgg=r=>recipeIng(r,'veg').some(i=>i[0]==='egg'||i[0]==='eggwhite');
function isPcodFriendly(r){                 // high fibre + high protein + whole grains (no maida/white rice in library)
  if(r.fixed||r.custom) return false;
  const n=nutritionOf(r,'veg'); return n.fib>=7 && n.p>=18;
}
const scaleN=(n,s)=>{ const o={}; NKEYS.forEach(k=>o[k]=n[k]*s); o.known=n.known; return o; };
function fixedKcal(pid){ return nutritionOf(rec(FIXED.drink[pid])).kcal + nutritionOf(rec(FIXED.shake[pid])).kcal; }
// the weekly snack box: one recipe, one serving a day for each person in `eaters`
function snackKcal(pid){ const sn=state.snack; if(!sn||!sn.rid||!sn.eaters.includes(pid)) return 0; const r=rec(sn.rid); return r?nutritionOf(r).kcal:0; }
function slotBudget(pid,slot){ const p=personById(pid); return (p.target - fixedKcal(pid) - snackKcal(pid)) * (SPLIT[slot]||0); }
// servings of recipe r for person pid in slot (quarter-serving steps)
function servingsFor(r,pid,slot,d){
  if(!r) return 0;
  if(r.fixed || r.cat==='snack') return 1;
  const s = slotBudget(pid,slot) / (nutritionOf(r,variantFor(r,pid,d)).kcal||1);
  return Math.min(4, Math.max(0.5, Math.round(s*4)/4));
}
function portion(rid,pid,slot,d){
  const r=rec(rid); if(!r) return null;
  const v=variantFor(r,pid,d), s=servingsFor(r,pid,slot,d), n=nutritionOf(r,v);
  return {s, v, kcal:Math.round(n.kcal*s), p:Math.round(n.p*s), c:Math.round(n.c*s), f:Math.round(n.f*s), n:scaleN(n,s)};
}

/* ================= quantities & formatting ================= */
const FRAC={0.25:'¼',0.5:'½',0.75:'¾',0.33:'⅓'};
function niceCount(x){
  const w=Math.floor(x+1e-9), fr=+(x-w).toFixed(2);
  const sym = FRAC[fr] || (fr? fr.toString().slice(1):'');
  return (w? w:'') + (sym||'') || '0';
}
function roundQty(q,u){
  if(u==='g'||u==='ml') return q>=100? Math.round(q/10)*10 : Math.max(5,Math.round(q/5)*5);
  return Math.round(q*2)/2 || 0.5;          // counts in halves
}
function serveText(r,servings,variant){
  if(r.serveText) return r.serveText;
  const items=(r.serve||[]).slice();
  if(r.protein){ const [,q,u,l]=r.protein[variant||'veg']; items.push([q,u,l]); }
  return items.map(([q,u,l])=>{
    const v=roundQty(q*servings,u);
    if(u==='g'||u==='ml') return `${fmtQty(v,u)} ${l}`;
    return `${niceCount(v)}${u&&u!==''?' '+u:''} ${l}`;
  }).join(' · ');
}

/* ================= weeks ================= */
const ROLL_HOUR=21;                          // Sunday 9 pm: next week becomes the active week
const isoDate=x=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
function mondayOf(dt){ const x=new Date(dt); x.setHours(0,0,0,0); x.setDate(x.getDate()-(x.getDay()+6)%7); return x; }
const addDaysIso=(iso,n)=>{ const [y,m,d]=iso.split('-').map(Number); return isoDate(new Date(y,m-1,d+n)); };
const weeksBetween=(a,b)=>{ const [y1,m1,d1]=a.split('-').map(Number), [y2,m2,d2]=b.split('-').map(Number); return Math.round((new Date(y2,m2-1,d2)-new Date(y1,m1-1,d1))/6048e5); };
function activeWeekStart(now=new Date()){
  const m=mondayOf(now); if(now.getDay()===0 && now.getHours()>=ROLL_HOUR) m.setDate(m.getDate()+7);
  return isoDate(m);
}
// index of "today" inside the active week (Sunday night shows tomorrow = Monday)
function todayIndex(now=new Date()){ return activeWeekStart(now)===isoDate(mondayOf(now)) ? (now.getDay()+6)%7 : 0; }
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayDate(d){ const [y,m,dd]=addDaysIso(state.weekStart,d).split('-').map(Number); return `${MONTHS[m-1]} ${dd}`; }

/* ================= state ================= */
const store=(()=>{ let mem={}, ok=false;
  try{ const k='__t'+Date.now(); localStorage.setItem(k,'1'); localStorage.removeItem(k); ok=true; }catch(e){}
  return {
    get(k){ try{ return ok? JSON.parse(localStorage.getItem(k)||'null') : (mem[k]??null); }catch(e){ return null; } },
    set(k,v){ try{ ok? localStorage.setItem(k,JSON.stringify(v)) : (mem[k]=v); }catch(e){ mem[k]=v; } },
  };
})();
const STATE_KEY='mp3_state';
const emptyDay=()=>({breakfast:null,lunch:null,dinner:null,lunchFresh:false,locks:{}});
function seedState(){
  const B=['chilla','eggsando','poha','oats','pancake','dosa','paratha'];
  const D=['palak','chole','rajma','pavbhaji','pizza','mexican','makhni'];
  const plan={};
  DAYS.forEach((_,d)=>{ plan[d]=emptyDay(); plan[d].breakfast=B[d]; plan[d].dinner=D[d]; });
  plan[0].lunchFresh=true; plan[0].lunch='dalrice';     // first week: no Sunday leftovers yet
  plan[5].lunch='khichdi'; plan[6].lunch='misal';        // weekend lunches are fresh
  return {v:3, weekStart:activeWeekStart(), plan, farali:{lunch:'sabudana',dinner:'samo'}, snack:{rid:'seedcookie',eaters:['m3'],locked:false},
    prevSunDinner:null, queue:[], custom:[], grocery:{}, log:{}, history:[], updatedAt:0};
}
function migrateOld(){                       // from the v2 (single-file) planner
  const old=store.get('mp_plan'); if(!old) return null;
  const st=seedState(), ok=(id,cat)=>{ const r=rec(id); return r && (!cat||r.cat===cat) ? id : null; };
  DAYS.forEach((_,d)=>{
    const o=old[d]||{};
    st.plan[d].breakfast = ok((o.breakfast||[])[0],'breakfast') || st.plan[d].breakfast;
    st.plan[d].dinner    = ok((o.dinner||[])[0],'main')        || st.plan[d].dinner;
    if(d>=5) st.plan[d].lunch = ok((o.lunch||[])[0],'main') || st.plan[d].lunch;
  });
  st.queue=(store.get('mp_queue')||[]).filter(id=>rec(id)&&!rec(id).fixed);
  return st;
}
function normalize(st){
  st.plan=st.plan||{}; DAYS.forEach((_,d)=>{ st.plan[d]=Object.assign(emptyDay(),st.plan[d]||{}); st.plan[d].locks=st.plan[d].locks||{}; });
  st.farali=Object.assign({lunch:null,dinner:null},st.farali||{});
  st.snack=Object.assign({rid:'seedcookie',eaters:['m3'],locked:false},st.snack||{});
  if(!Array.isArray(st.snack.eaters)) st.snack.eaters=['m3'];
  ['queue','custom','history'].forEach(k=>st[k]=Array.isArray(st[k])?st[k]:[]);
  st.grocery=st.grocery||{}; st.log=st.log||{};
  st.stores=Array.isArray(st.stores)&&st.stores.length?st.stores:STORES_DEFAULT.map(x=>Object.assign({},x));
  st.storeMap=st.storeMap||{};
  st.profile=st.profile||{};
  st.weekStart=st.weekStart||activeWeekStart();
  return st;
}
let state = normalize(store.get(STATE_KEY) || migrateOld() || seedState());
applyProfiles();
let onStateSaved = null;                    // hook set by sync.js
function saveState(opts){
  state.updatedAt=Date.now();
  store.set(STATE_KEY,state);
  if(onStateSaved && !(opts&&opts.localOnly)) onStateSaved(state);
}
function replaceState(remote){ state=normalize(remote); applyProfiles(); mountCustoms(); store.set(STATE_KEY,state); }

/* custom recipes live in state (synced) */
function mountCustoms(){
  for(let i=RECIPES.length-1;i>=0;i--) if(RECIPES[i].custom) RECIPES.splice(i,1);
  Object.keys(nutCache).forEach(k=>{ if(k.startsWith('cust_')) delete nutCache[k]; });
  state.custom.forEach(c=>RECIPES.push(RC(Object.assign({},c,{custom:true}))));
}
mountCustoms();

/* ================= plan logic ================= */
const isFarali=(pid,d)=>pid===FARALI.pid && d===FARALI.day;
const nextDay=d=>(d+1)%7;
// effective meal for a person (or the family when pid omitted) in a slot
function mealFor(d,slot,pid){
  const day=state.plan[d];
  if(slot==='drink'||slot==='shake') return {rid:FIXED[slot][pid||'m1'], fixed:true};
  if(slot==='snack'){ const sn=state.snack; if(!sn.rid || (pid && !sn.eaters.includes(pid))) return null; return {rid:sn.rid, weekly:true}; }
  if(pid && (slot==='lunch'||slot==='dinner') && isFarali(pid,d)) return state.farali[slot] ? {rid:state.farali[slot], farali:true} : null;
  if(slot==='lunch' && LEFTOVER_DAYS.includes(d) && !day.lunchFresh){
    const src = d===0 ? state.prevSunDinner : state.plan[d-1].dinner;
    return src ? {rid:src, leftover:true, from: d===0?'last Sun':DAYS[d-1]} : null;
  }
  return day[slot] ? {rid:day[slot]} : null;
}
const isLeftoverLunch=d=>LEFTOVER_DAYS.includes(d) && !state.plan[d].lunchFresh;
// who eats the family meal in a slot on day d
const eatersOf=(d,slot)=>PEOPLE.filter(p=>!(isFarali(p.id,d)&&(slot==='lunch'||slot==='dinner'))).map(p=>p.id);

/* skipped / ate-out log (per person, per meal, this week) */
const OUT_OPTS=[['out-light','Light',0.8],['out-usual','Usual',1.2],['out-heavy','Heavy',1.6]];
const logKey=(d,slot,pid)=>`${d}-${slot}-${pid}`;
const statusOf=(d,slot,pid)=>(state.log||{})[logKey(d,slot,pid)]||null;
function setStatus(d,slot,pid,v){ const k=logKey(d,slot,pid); if(v) state.log[k]=v; else delete state.log[k]; }
const statusLabel=v=>!v?'As planned':v==='skip'?'Skipped':'Ate out · '+OUT_OPTS.find(o=>o[0]===v)[1].toLowerCase();
function outEstimate(d,slot,pid,v){
  const f=(OUT_OPTS.find(o=>o[0]===v)||[,,1.2])[2];
  let base=SPLIT[slot]?slotBudget(pid,slot):0;
  if(!base){ const m=mealFor(d,slot,pid); const pt=m&&portion(m.rid,pid,slot,d); base=pt?pt.kcal:300; }
  return Math.round(base*f);
}
const partAway=p=>!!statusOf(p.day,p.slot,p.pid);

// one cooking session: recipe + everyone's servings (dinner includes tomorrow's leftover lunch).
// Anyone marked skipped / ate out for that meal is left out of the batch.
function batchFor(d,slot){
  const m=mealFor(d,slot); if(!m||m.leftover||m.fixed||m.weekly) return null;
  const r=rec(m.rid);
  const parts=eatersOf(d,slot).map(pid=>({pid,day:d,slot,s:servingsFor(r,pid,slot,d)}));
  if(slot==='dinner'){
    const n=nextDay(d);
    const nextIsLeftover = d===6 ? true : isLeftoverLunch(n);   // Sunday dinner feeds next Monday
    if(nextIsLeftover) eatersOf(n,'lunch').forEach(pid=>parts.push({pid,day:n,slot:'lunch',s:servingsFor(r,pid,'lunch',n),leftover:true,nextWeek:d===6}));
  }
  const kept=parts.filter(p=>p.nextWeek||!partAway(p));
  if(!kept.length) return null;
  return {rid:m.rid, d, slot, parts:kept, servings:kept.reduce((a,p)=>a+p.s,0)};
}
function snackBatch(){
  const sn=state.snack, r=rec(sn.rid); if(!r) return null;
  const parts=[]; sn.eaters.forEach(pid=>DAYS.forEach((_,d)=>{ const p={pid,day:d,slot:'snack',s:1}; if(!partAway(p)) parts.push(p); }));
  if(!parts.length) return null;
  return {rid:sn.rid, d:6, slot:'snack', weekly:true, parts, servings:parts.length};
}
function faraliBatch(slot){
  const rid=state.farali[slot]; if(!rid) return null;
  const part={pid:FARALI.pid,day:FARALI.day,slot,s:servingsFor(rec(rid),FARALI.pid,slot,FARALI.day)};
  if(partAway(part)) return null;
  return {rid, d:FARALI.day, slot, farali:true, parts:[part], servings:part.s};
}
// every cooking session this week (what the grocery list is built from)
function weekBatches(){
  const out=[];
  DAYS.forEach((_,d)=>MEAL_SLOTS.forEach(slot=>{ const b=batchFor(d,slot); if(b) out.push(b); }));
  ['lunch','dinner'].forEach(s=>{ const b=faraliBatch(s); if(b) out.push(b); });
  const sb=snackBatch(); if(sb) out.push(sb);
  return out;
}
// ingredients for a set of portions [{pid,day,s}] — each part uses that person's protein for that day
function batchIngredients(r,parts){
  const agg={}, order=[];
  parts.forEach(p=>recipeIng(r,variantFor(r,p.pid,p.day)).forEach(([k,q,u])=>{
    if(!agg[k]){ agg[k]={key:k,name:(FOODS[k]||{name:k}).name,q:0,u,who:new Set()}; order.push(k); }
    agg[k].q+=q*p.s; if(r.protein && (k===r.protein.veg[0]||k===r.protein.chicken[0])) agg[k].who.add(p.pid);
  }));
  return order.map(k=>agg[k]);
}
const genericParts=(r,slot)=>PEOPLE.map(p=>({pid:p.id,day:null,slot,s:servingsFor(r,p.id,slot,null)}));

/* ================= totals ================= */
function dayTotals(d,pid){
  const t=Object.fromEntries(NKEYS.map(k=>[k,0])); t.n=0; t.unk=0; t.skip=0; t.out=0;
  SLOTS.forEach(s=>{
    const m=mealFor(d,s.id,pid); if(!m) return;
    const st=statusOf(d,s.id,pid);
    if(st==='skip'){ t.skip++; return; }
    if(st){ const k=outEstimate(d,s.id,pid,st); t.kcal+=k; t.p+=k*.15/4; t.c+=k*.5/4; t.f+=k*.35/9; t.out++; t.unk++; return; }
    const pt=portion(m.rid,pid,s.id,d); if(!pt) return;
    NKEYS.forEach(k=>t[k]+=pt.n[k]); if(!s.fixed) t.n++; if(!pt.n.known) t.unk++;
  });
  ['kcal','p','c','f'].forEach(k=>t[k]=Math.round(t[k]));
  return t;
}
function macroGuide(pid){
  const p=personById(pid), f=Math.round(p.target*.3/9);
  return {p:p.protein, c:Math.round((p.target-p.protein*4-f*9)/4), f};
}

/* ================= grocery ================= */
function buildGrocery(){
  const agg={}; let sessions=0;
  const add=(key,q,u)=>{
    const f=FOODS[key]; const g = f ? gramsOf(key,q,u) : 0;
    const id=key;
    if(!agg[id]) agg[id]={id,key,n:f?f.name:key,cat:f?f.cat:'Other',store:f?f.store:null,g:0,count:0,each:f&&f.each,u};
    if(u==='') agg[id].count+=q; else agg[id].g+=g;
  };
  weekBatches().forEach(b=>{ sessions++; const r=rec(b.rid); if(!r) return;
    if(r.custom){ (r.ingText||[]).forEach(t=>{ const id='txt:'+t.toLowerCase(); agg[id]=agg[id]||{id,n:t,cat:'Other',g:0,count:0,u:'txt'}; }); return; }
    batchIngredients(r,b.parts).forEach(it=>add(it.key,it.q,it.u));
  });
  // fixed daily items × 7 days
  PEOPLE.forEach(p=>['drink','shake'].forEach(s=>{ const r=rec(FIXED[s][p.id]); const n=DAYS.filter((_,d)=>!statusOf(d,s,p.id)).length; (r.ing||[]).forEach(([k,q,u])=>add(k,q*n,u)); }));
  const items=Object.values(agg).map(it=>{
    if(it.u==='txt') return Object.assign(it,{qty:''});
    const qty = it.count && !it.g ? niceCount(Math.ceil(it.count*2)/2)
              : fmtQty(Math.ceil((it.g + (it.count*(it.each||0)))/10)*10, it.u==='ml'?'ml':'g');
    return Object.assign(it,{qty});
  }).sort((a,b)=>a.n.localeCompare(b.n));
  return {items, sessions};
}
function cellsForIngredient(key){
  const cells=[];
  DAYS.forEach((_,d)=>MEAL_SLOTS.forEach(slot=>{
    const m=mealFor(d,slot); if(!m) return; const r=rec(m.rid);
    if(r && recipeIng(r,'veg').concat(r.protein?[r.protein.chicken]:[]).some(i=>i[0]===key)) cells.push({d,slot,leftover:!!m.leftover});
  }));
  ['lunch','dinner'].forEach(slot=>{ const r=rec(state.farali[slot]); if(r&&recipeIng(r,'veg').some(i=>i[0]===key)) cells.push({d:FARALI.day,slot,farali:true}); });
  const sn=rec(state.snack.rid); if(sn && recipeIng(sn,'veg').some(i=>i[0]===key)) cells.push({d:0,slot:'snack',weekly:true});
  return cells;
}

/* ================= generate & weekly refresh ================= */
const CHICKEN_DINNER_DAYS=[0,1,4,6];          // Mon, Tue, Fri, Sun — tomorrow's leftover lunch can still be chicken
const needsLeftover=d=>[6,0,1,2,3].includes(d); // Sun–Thu dinners become Mon–Fri lunches
const pick=(arr,w)=>{ const ws=arr.map(w), tot=ws.reduce((a,b)=>a+b,0); if(!tot) return null; let x=Math.random()*tot; for(let i=0;i<arr.length;i++){ x-=ws[i]; if(x<=0) return arr[i]; } return arr[arr.length-1]; };

// Fill the plan from day `from` (0 = whole week). Locked meals and earlier days are kept.
// Queue first, then 1–2 chicken dinners, then the library. Returns a summary.
function generateWeek({from=0}={}){
  const plan=state.plan, used={}, inc=id=>{ if(id) used[id]=(used[id]||0)+1; };
  const keep=(d,slot)=> d<from || !!plan[d].locks[slot];
  const lib=RECIPES.filter(r=>!r.fixed);
  const sum={placed:0,fromQueue:0,chicken:0};
  // what stays
  DAYS.forEach((_,d)=>{
    ['breakfast','dinner'].forEach(s=>{ if(keep(d,s)) inc(plan[d][s]); else plan[d][s]=null; });
    if(keep(d,'lunch')){ if(!isLeftoverLunch(d)) inc(plan[d].lunch); }
    else { plan[d].lunch=null; plan[d].lunchFresh = d>=5 || (d===0 && !state.prevSunDinner); }
  });
  const isChickenDinner=d=>{ const r=rec(plan[d].dinner); return r&&r.protein; };
  let chicken=DAYS.filter((_,d)=>isChickenDinner(d)).length;
  const freeDinner=d=>d>=from && !plan[d].dinner && !plan[d].locks.dinner;
  const fitsDinner=(r,d)=> r.cat==='main' && !r.farali && (!needsLeftover(d) || r.leftover);
  const okRepeat=(r,d,slot)=> (used[r.id]||0)<2 && plan[(d+6)%7][slot]!==r.id && plan[(d+1)%7][slot]!==r.id;
  const place=(d,slot,r,q)=>{ plan[d][slot]=r.id; inc(r.id); sum.placed++; if(q) sum.fromQueue++; if(slot==='dinner'&&r.protein){ chicken++; sum.chicken++; } };
  // 1) queue
  const leftoverQ=[], faraliQ={};
  state.queue.forEach(id=>{
    const r=rec(id); if(!r){ return; }
    let done=false;
    if(r.cat==='snack'){ if(from===0 && !state.snack.locked && !sum.snackFromQueue){ state.snack.rid=r.id; sum.fromQueue++; sum.snackFromQueue=true; done=true; } }
    else if(r.farali && r.cat==='main' && from<=FARALI.day){
      const s=['lunch','dinner'].find(x=>!faraliQ[x]);
      if(s){ state.farali[s]=r.id; faraliQ[s]=true; sum.fromQueue++; done=true; }
    }
    else if(r.cat==='breakfast'){
      const d=DAYS.findIndex((_,d)=>d>=from && !plan[d].breakfast && !plan[d].locks.breakfast && okRepeat(r,d,'breakfast'));
      if(d>-1){ place(d,'breakfast',r,true); done=true; }
    } else if(r.cat==='main'){
      const days=DAYS.map((_,d)=>d).filter(d=>freeDinner(d) && fitsDinner(r,d) && okRepeat(r,d,'dinner') && (!r.protein || (CHICKEN_DINNER_DAYS.includes(d) && chicken<2)));
      if(days.length){ place(days[0],'dinner',r,true); done=true; }
      else { const wl=[5,6].find(d=>d>=from && !plan[d].lunch && !plan[d].locks.lunch); if(wl!==undefined && !r.protein){ plan[wl].lunch=r.id; inc(r.id); sum.placed++; sum.fromQueue++; done=true; } }
    }
    if(!done) leftoverQ.push(id);
  });
  state.queue=leftoverQ;
  // 2) chicken: aim for 1–2 a week
  const chickenTarget = Math.random()<0.5 ? 1 : 2;
  const chickenRecipes=lib.filter(r=>r.protein);
  while(chicken<chickenTarget){
    const days=CHICKEN_DINNER_DAYS.filter(freeDinner); if(!days.length) break;
    const d=days[Math.floor(Math.random()*days.length)];
    const r=pick(chickenRecipes.filter(r=>okRepeat(r,d,'dinner')&&!used[r.id]), ()=>1); if(!r) break;
    place(d,'dinner',r);
  }
  // 3) dinners
  DAYS.forEach((_,d)=>{
    if(!freeDinner(d)) return;
    const prev=rec(plan[(d+6)%7].dinner);
    const r=pick(lib.filter(r=>fitsDinner(r,d) && !r.protein && okRepeat(r,d,'dinner')),
      r=>(used[r.id]?0.25:1) * (isPcodFriendly(r)?1.6:1) * (prev&&prev.cuisine===r.cuisine?0.5:1));
    if(r) place(d,'dinner',r);
  });
  // 4) fresh lunches (weekends, or Monday with no Sunday leftovers)
  DAYS.forEach((_,d)=>{
    if(d<from || plan[d].locks.lunch || isLeftoverLunch(d) || plan[d].lunch) return;
    const r=pick(lib.filter(r=>r.cat==='main' && !r.farali && !r.protein && r.id!==plan[d].dinner && r.id!==plan[(d+6)%7].dinner && (used[r.id]||0)<2),
      r=>(used[r.id]?0.25:1) * (r.leftover?1:1.8) * (isPcodFriendly(r)?1.4:1));
    if(r){ plan[d].lunch=r.id; inc(r.id); sum.placed++; }
  });
  // 5) breakfasts
  DAYS.forEach((_,d)=>{
    if(d<from || plan[d].breakfast || plan[d].locks.breakfast) return;
    const r=pick(lib.filter(r=>r.cat==='breakfast' && !r.farali && okRepeat(r,d,'breakfast')),
      r=>(used[r.id]?0.15:1) * (isPcodFriendly(r)?1.5:1));
    if(r) place(d,'breakfast',r);
  });
  // 6) Aum's farali Thursday
  if(from<=FARALI.day){
    const far=lib.filter(r=>r.farali && r.cat==='main');
    ['lunch','dinner'].forEach(s=>{ if(!faraliQ[s] && (!state.farali[s] || from===0)){ const other=state.farali[s==='lunch'?'dinner':'lunch'];
      const r=pick(far.filter(r=>r.id!==other),()=>1); if(r) state.farali[s]=r.id; } });
  }
  // 7) weekly snack (only when the whole week is being planned)
  if(from===0 && !state.snack.locked && !sum.snackFromQueue){
    const last=(state.history[0]&&state.history[0].snack)?state.history[0].snack.rid:null;
    const snacks=lib.filter(r=>r.cat==='snack'), fresh=snacks.filter(r=>r.id!==last && r.id!==state.snack.rid);
    const r=pick(fresh.length?fresh:snacks,()=>1); if(r) state.snack.rid=r.id;
  }
  return sum;
}
// archive this week and start the given week (ISO Monday)
function startNewWeek(ws){
  const gap=weeksBetween(state.weekStart,ws);
  state.history.unshift({weekStart:state.weekStart, plan:state.plan, farali:state.farali, snack:state.snack, log:state.log});
  state.history=state.history.slice(0,8);
  state.prevSunDinner = gap===1 ? state.plan[6].dinner : null;
  const plan={}; DAYS.forEach((_,d)=>{ plan[d]=emptyDay(); });
  state.plan=plan; state.weekStart=ws; state.log={}; state.grocery={};
  state.farali={lunch:null,dinner:null}; state.snack=Object.assign({},state.snack,{locked:false});
  return generateWeek({from:0});
}
function rolloverIfNeeded(){
  const ws=activeWeekStart();
  if(!state.weekStart){ state.weekStart=ws; return null; }
  if(state.weekStart>=ws) return null;
  return startNewWeek(ws);
}

/* ================= stores ================= */
const storeById=id=>state.stores.find(x=>x.id===id);
// where an item is bought: family override, else the food's default store; null = unassigned
function storeOf(it){ const id=state.storeMap[it.id] ?? it.store; return id && storeById(id) ? id : null; }
function addStore(name){
  name=(name||'').trim(); if(!name) return null;
  const base=name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'store';
  let id=base, i=2; while(storeById(id)) id=base+'-'+(i++);
  state.stores.push({id,name}); return id;
}
function renameStore(id,name){ const st=storeById(id); if(st&&name.trim()) st.name=name.trim(); }
function removeStore(id){
  state.stores=state.stores.filter(x=>x.id!==id);
  Object.keys(state.storeMap).forEach(k=>{ if(state.storeMap[k]===id) delete state.storeMap[k]; });
}
