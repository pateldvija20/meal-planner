/* ================= people & targets ================= */
// Mifflin-St Jeor (calculator.net default). Activity: light 1.375, moderate (4-5×/wk) 1.465.
const mifflin = p => 10*p.kg + 6.25*p.cm - 5*p.age + (p.sex==='f' ? -161 : 5);
const round50 = x => Math.round(x/50)*50;
const PEOPLE = [
  {id:'m3', key:'dvija',  label:'Dvija',  note:'losing',  goal:'Lose 0.5 kg/wk · build muscle', sex:'f', age:25, kg:80, cm:175.3, act:1.375, adj:-550, protein:120,
    email:'pateldvija20@gmail.com', hex:'#2E6E7E'},
  {id:'m1', key:'akshar', label:'Akshar', note:'gaining', goal:'Lean gain 0.25 kg/wk · build muscle', sex:'m', age:25, kg:59, cm:172.7, act:1.465, adj:275, protein:115,
    email:'axr230102@gmail.com', hex:'#B27E23'},
  {id:'m2', key:'aum',    label:'Aum',    note:'gaining', goal:'Lean gain 0.25 kg/wk · build muscle', sex:'m', age:25, kg:62, cm:180.3, act:1.465, adj:275, protein:120,
    email:'aumsathwara2811@gmail.com', hex:'#8A4767'},
];
PEOPLE.forEach(p=>{
  p.bmr = Math.round(mifflin(p));
  p.tdee = Math.round(p.bmr*p.act);
  p.target = round50(p.tdee + p.adj);
  p.bmi = +(p.kg/((p.cm/100)**2)).toFixed(1);
});
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
  {id:'dinner',    label:'Dinner'},
];
const MEAL_SLOTS=['breakfast','lunch','dinner'];
const SLOT_LABEL=Object.fromEntries(SLOTS.map(s=>[s.id,s.label]));
const SPLIT={breakfast:.36, lunch:.30, dinner:.34};     // share of what's left after drink + shake
const LEFTOVER_DAYS=[0,1,2,3,4];                         // Mon–Fri lunch = previous night's dinner
const FARALI={pid:'m2', day:3};                          // Aum eats farali lunch + dinner on Thursday
const DAYNOTE=['','','','Farali · Aum','','','Cook for Mon lunch'];
const CATS={breakfast:'#B27E23', main:'#BE5630', drink:'#2E6E7E', shake:'#2E6E7E'};
const CAT_LABEL={breakfast:'breakfast', main:'lunch & dinner', drink:'daily', shake:'daily'};

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
function slotBudget(pid,slot){ const p=personById(pid); return (p.target - fixedKcal(pid)) * SPLIT[slot]; }
// servings of recipe r for person pid in slot (quarter-serving steps)
function servingsFor(r,pid,slot,d){
  if(!r) return 0;
  if(r.fixed) return 1;
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
  return {v:3, plan, farali:{lunch:'sabudana',dinner:'samo'}, prevSunDinner:null, queue:[], custom:[], grocery:{}, updatedAt:0};
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
  ['queue','custom'].forEach(k=>st[k]=Array.isArray(st[k])?st[k]:[]);
  st.grocery=st.grocery||{};
  return st;
}
let state = normalize(store.get(STATE_KEY) || migrateOld() || seedState());
let onStateSaved = null;                    // hook set by sync.js
function saveState(opts){
  state.updatedAt=Date.now();
  store.set(STATE_KEY,state);
  if(onStateSaved && !(opts&&opts.localOnly)) onStateSaved(state);
}
function replaceState(remote){ state=normalize(remote); mountCustoms(); store.set(STATE_KEY,state); }

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

// one cooking session: recipe + everyone's servings (dinner includes tomorrow's leftover lunch)
function batchFor(d,slot){
  const m=mealFor(d,slot); if(!m||m.leftover||m.fixed) return null;
  const r=rec(m.rid);
  const parts=eatersOf(d,slot).map(pid=>({pid,day:d,slot,s:servingsFor(r,pid,slot,d)}));
  if(slot==='dinner'){
    const n=nextDay(d);
    const nextIsLeftover = d===6 ? true : isLeftoverLunch(n);   // Sunday dinner feeds next Monday
    if(nextIsLeftover) eatersOf(n,'lunch').forEach(pid=>parts.push({pid,day:n,slot:'lunch',s:servingsFor(r,pid,'lunch',n),leftover:true}));
  }
  return {rid:m.rid, d, slot, parts, servings:parts.reduce((a,p)=>a+p.s,0)};
}
function faraliBatch(slot){
  const rid=state.farali[slot]; if(!rid) return null;
  return {rid, d:FARALI.day, slot, farali:true, parts:[{pid:FARALI.pid,day:FARALI.day,slot,s:servingsFor(rec(rid),FARALI.pid,slot,FARALI.day)}], get servings(){return this.parts[0].s;}};
}
// every cooking session this week (what the grocery list is built from)
function weekBatches(){
  const out=[];
  DAYS.forEach((_,d)=>MEAL_SLOTS.forEach(slot=>{ const b=batchFor(d,slot); if(b) out.push(b); }));
  ['lunch','dinner'].forEach(s=>{ const b=faraliBatch(s); if(b) out.push(b); });
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
  const t=Object.fromEntries(NKEYS.map(k=>[k,0])); t.n=0; t.unk=0;
  SLOTS.forEach(s=>{
    const m=mealFor(d,s.id,pid); if(!m) return;
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
  PEOPLE.forEach(p=>['drink','shake'].forEach(s=>{ const r=rec(FIXED[s][p.id]); (r.ing||[]).forEach(([k,q,u])=>add(k,q*7,u)); }));
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
  return cells;
}
