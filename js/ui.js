/* ================= view state (per phone, not synced) ================= */
let selPerson = store.get('mp_person') || 'm1';
let units = store.get('mp_units') || 'us';
let filter='all', cuisine='all', query='', armed=null, drawerView=null;
let personal=null;            // person id when the page was opened with #dvija / #akshar / #aum
let ingMode=null;             // 'family' | 'me' — null = default for the current view
function readHash(){
  const k=decodeURIComponent(location.hash.replace('#','')).toLowerCase();
  const p=PEOPLE.find(x=>x.key===k); personal=p?p.id:null;
  if(p){ selPerson=p.id; store.set('mp_person',p.id); }
  document.body.classList.toggle('personal',!!personal);
}
readHash();
const personalLink=pid=>`${location.origin}${location.pathname}#${personById(pid).key}`;
let TODAY_IDX=todayIndex();
let mTab=store.get('mp_tab'); if(!['discover','today','grocery','queue'].includes(mTab)) mTab='today';
let mDay=TODAY_IDX, mOpenIng=null, sheetState=null;

const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const person=()=>personById(selPerson);
const defSlot=r=>r.cat==='breakfast'?'breakfast':r.cat==='snack'?'snack':'dinner';
const isLocked=(d,slot)=>slot==='snack'?!!state.snack.locked:!!state.plan[d].locks[slot];
const shortName=r=>r.name.split('(')[0].trim();
let toastT;
function toast(msg){ const t=$('#toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),1900); }
function fmtQty(q,u){
  if(q==null) return '';
  if(units==='us'){
    if(u==='g'){ const oz=q/28.3495; return oz>=16 ? (+(oz/16).toFixed(2))+' lb' : (+oz.toFixed(oz<3?1:1))+' oz'; }
    if(u==='ml'){ const fl=q/29.5735; if(fl>=6){ const c=Math.round(q/236.588*4)/4; return niceCount(c)+' '+(c>1?'cups':'cup'); } return (+fl.toFixed(1))+' fl oz'; }
  }
  if(u==='g') return q>=1000?(+(q/1000).toFixed(2))+' kg':Math.round(q)+' g';
  if(u==='ml') return q>=1000?(+(q/1000).toFixed(2))+' L':Math.round(q)+' ml';
  return q+' '+u;
}
function macroBar(pt){
  const pk=pt.p*4, ck=pt.c*4, fk=pt.f*9, tot=pk+ck+fk||1, w=x=>(x/tot*100).toFixed(1)+'%';
  return `<div class="macro-bar" role="img" aria-label="Protein ${Math.round(pt.p)}g, carbs ${Math.round(pt.c)}g, fat ${Math.round(pt.f)}g"><span style="width:${w(pk)};background:var(--pro)"></span><span style="width:${w(ck)};background:var(--carb)"></span><span style="width:${w(fk)};background:var(--fat)"></span></div>`;
}
const SV='viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
const ICON={
  discover:`<svg ${SV}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
  today:`<svg ${SV}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none"/></svg>`,
  grocery:`<svg ${SV}><path d="M3 4h2.2l2.1 10.4a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.1L20.5 8H6.1"/><circle cx="9.5" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></svg>`,
  queue:`<svg ${SV}><rect x="4" y="3.5" width="16" height="5" rx="1.5"/><rect x="4" y="10.5" width="16" height="5" rx="1.5"/><path d="M6 19.5h12"/></svg>`,
  chart:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M5 19v-6M12 19V5M19 19v-9"/></svg>`,
  lock:`<svg ${SV}><rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`,
  unlock:`<svg ${SV}><rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/></svg>`,
  swap:`<svg ${SV}><path d="M7 4 3.5 7.5 7 11M3.5 7.5H17M17 13l3.5 3.5L17 20M20.5 16.5H7"/></svg>`,
  check:`<svg ${SV}><circle cx="12" cy="12" r="8.5"/><path d="m8.5 12.2 2.4 2.4 4.6-5"/></svg>`,
  spark:`<svg ${SV}><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/></svg>`,
};

/* ================= mutations ================= */
function commit(){ saveState(); renderEverything(); }
const parseCtx=k=>{ const [d,slot]=k.split('|'); return {d:+d,slot}; };
function setMealView(d,slot,rid,pid=selPerson){
  const r=rec(rid); if(!r) return false;
  if(slot==='snack'){
    if(r.cat!=='snack'){ toast('Pick a snack-box recipe for the weekly snack'); return false; }
    state.snack.rid=rid; commit(); toast(`${shortName(r)} is this week’s snack box`); return true;
  }
  if(r.cat==='snack'){ toast('That’s a snack-box recipe — it goes in the weekly snack'); return false; }
  if((slot==='lunch'||slot==='dinner') && isFarali(pid,d)){
    if(!r.farali){ toast(`${personById(pid).label}'s Thursday needs a farali recipe`); return false; }
    state.farali[slot]=rid; commit(); toast(`Farali ${slot} set for ${personById(pid).label}`); return true;
  }
  if(slot==='breakfast' && r.cat!=='breakfast'){ toast('That’s a lunch/dinner recipe — pick a breakfast'); return false; }
  if(slot!=='breakfast' && r.cat==='breakfast'){ toast('That’s a breakfast — pick a lunch/dinner recipe'); return false; }
  const day=state.plan[d];
  if(slot==='lunch' && LEFTOVER_DAYS.includes(d)) day.lunchFresh=true;
  day[slot]=rid; armed=null; commit();
  toast(`${shortName(r)} → ${DAYS[d]} ${SLOT_LABEL[slot].toLowerCase()}`);
  return true;
}
function removeMealView(d,slot,pid=selPerson){
  if(slot==='snack'){ state.snack.rid=null; return commit(); }
  if((slot==='lunch'||slot==='dinner') && isFarali(pid,d)){ state.farali[slot]=null; return commit(); }
  const day=state.plan[d];
  if(slot==='lunch' && isLeftoverLunch(d)){ day.lunchFresh=true; day.lunch=null; commit(); return toast('Leftovers off — add a fresh lunch'); }
  day[slot]=null; delete day.locks[slot]; commit();
}
function useLeftovers(d){ const day=state.plan[d]; day.lunchFresh=false; day.lunch=null; delete day.locks.lunch; commit(); toast(`${DAYS[d]} lunch is ${d===0?'Sunday':DAYS[d-1]}’s dinner again`); }
function toggleLock(d,slot){
  if(slot==='snack'){ state.snack.locked=!state.snack.locked; commit(); return toast(state.snack.locked?'Snack box locked for next week too':'Unlocked'); }
  const l=state.plan[d].locks; l[slot]=!l[slot]; if(!l[slot]) delete l[slot]; commit(); toast(l[slot]?'Locked — Generate will keep it':'Unlocked');
}
function toggleQueue(id){
  if(!state.queue.includes(id)){ state.queue.push(id); toast('Added to plan — tap Generate to place it'); }
  else { state.queue=state.queue.filter(x=>x!==id); toast('Removed from the plan queue'); }
  armed=null; commit();
}
function runGenerate(mode){
  let sum;
  if(mode==='next'){ sum=startNewWeek(addDaysIso(state.weekStart,7)); }
  else sum=generateWeek({from: mode==='rest' ? TODAY_IDX+1 : 0});
  TODAY_IDX=todayIndex(); if(mode==='next') mDay=0;
  commit();
  toast(`${mode==='next'?'Next week planned':'Plan refreshed'} · ${sum.placed} meals${sum.fromQueue?` · ${sum.fromQueue} from your queue`:''}${sum.chicken?` · ${sum.chicken} chicken night${sum.chicken>1?'s':''}`:''}`);
}
function applyStatus(d,slot,pids,v){ pids.forEach(pid=>setStatus(d,slot,pid,v)); commit(); toast(`${DAYS[d]} ${SLOT_LABEL[slot].toLowerCase()}: ${statusLabel(v).toLowerCase()}${pids.length>1?' for everyone':''}`); }
function resetPlan(){ const s=seedState(); s.queue=state.queue; s.custom=state.custom; s.grocery={}; state=normalize(s); commit(); toast('Week reset to the starter plan'); }

/* ================= desktop ================= */
function renderSeg(){
  $('#seg').innerHTML=PEOPLE.map(p=>`<button data-p="${p.id}" class="${p.id===selPerson?'active':''}"><span class="dot" style="background:${p.hex}"></span>${p.label}<small>${p.note} · ${p.target.toLocaleString()}</small></button>`).join('');
}
function renderUnits(){ $('#unitseg').innerHTML=[['us','US · oz'],['metric','Metric · g']].map(([u,l])=>`<button data-u="${u}" class="${u===units?'active':''}">${l}</button>`).join(''); }
function renderSync(){
  const s=Sync.status, who=Sync.person;
  $('#syncBox').innerHTML=`<span class="sync-pill s-${s}"><i></i>${SYNC_LABEL[s]}</span>`+
    (Sync.user ? `<span class="sync-who">${esc(who?who.label:Sync.user.email)}</span><button class="ghost-btn" data-signout>Sign out</button>`
               : `<button class="ghost-btn solid" data-signin>Sign in to sync</button>`);
  $('#weekLabel').textContent=`Week of ${dayDate(0)} – ${dayDate(6)}`;
  $('#footer').innerHTML=`Targets (Mifflin-St Jeor): ${PEOPLE.map(p=>`${p.label} ${p.target.toLocaleString()} kcal · ${p.protein}g P`).join(' · ')}. Every day includes the morning seed water and a protein shake. Nutrition estimates ±10–25%.`;
}
function chipHtml(m,d,slot,pid){
  const r=rec(m.rid); if(!r) return '';
  const pt=portion(m.rid,pid,slot,d), key=d+'|'+slot, locked=isLocked(d,slot), pp=personById(pid), st=statusOf(d,slot,pid);
  const tag = st?`<div class="lo st">${esc(statusLabel(st))}</div>` : m.weekly?`<div class="lo">weekly snack · made Sunday</div>` : m.leftover?`<div class="lo">↩ ${m.from} dinner${pt.v==='chicken'?' · chicken':''}</div>` : m.farali?`<div class="lo">farali · ${pp.label}</div>` : pt.v?`<div class="lo">${pt.v==='chicken'?'chicken':esc(r.protein.veg[3])} · ${pp.label}</div>`:'';
  const acts = m.fixed ? '' : `<div class="chip-act">${(!m.leftover&&!m.farali&&!(m.weekly&&d>0))?`<button class="lk ${locked?'on':''}" data-lock="${key}" title="${locked?'Unlock':'Lock so Generate keeps it'}" aria-label="${locked?'Unlock':'Lock'}">${locked?ICON.lock:ICON.unlock}</button>`:''}<button class="x" data-remove="${key}" title="${m.leftover?'Cook a fresh lunch instead':'Remove'}" aria-label="Remove">×</button></div>`;
  return `<div class="chip ${m.fixed?'fixed':''} ${m.leftover?'leftover':''} ${m.farali?'farali':''} ${m.weekly?'weekly':''} ${locked?'locked':''} ${st?(st==='skip'?'st-skip':'st-out'):''}" ${m.fixed?'':'draggable="true"'} data-rid="${m.rid}" data-open="${m.rid}" data-ctx="${key}" style="--cat:${CATS[r.cat]};--sel:${pp.hex}">
    ${tag}<div class="nm">${esc(shortName(r))}</div>
    <div class="mac"><b>${pt.kcal}</b> kcal · <b style="color:var(--pro)">${pt.p}g</b> P${pt.s!==1&&!m.fixed?` · ${niceCount(pt.s)}×`:''}</div>${acts}</div>`;
}
function renderCal(){
  const pid=selPerson, pp=person();
  let h=`<div class="corner"></div>`+DAYS.map((d,i)=>`<div class="day-h ${i===TODAY_IDX?'is-today':''}">${d} <span class="dnum">${dayDate(i).split(' ')[1]}</span><small>${DAYNOTE[i]||'&nbsp;'}</small></div>`).join('');
  SLOTS.forEach(s=>{
    h+=`<div class="row-lbl">${s.label}</div>`;
    DAYS.forEach((_,d)=>{
      const m=mealFor(d,s.id,pid), key=d+'|'+s.id;
      let inner = m ? chipHtml(m,d,s.id,pid) : '';
      if(!m && s.id==='snack'){
        inner = state.snack.rid ? `<span class="cell-empty">not in ${pp.label}’s snack box</span>` : `<span class="cell-empty">drop a snack-box recipe</span>`;
      } else if(!m && !s.fixed){
        inner = (s.id==='lunch' && LEFTOVER_DAYS.includes(d) && state.plan[d].lunchFresh && !isFarali(pid,d))
          ? `<button class="use-lo" data-uselo="${d}">↩ use ${d===0?'Sunday':DAYS[d-1]} leftovers</button>` : `<span class="cell-empty">${armed?'tap to place':'drop a recipe'}</span>`;
      }
      const note=(s.id==='lunch'||s.id==='dinner') && d===FARALI.day && pid!==FARALI.pid && state.farali[s.id] ? `<div class="cell-note">Aum: ${esc(shortName(rec(state.farali[s.id])))}</div>` : '';
      h+=`<div class="cell ${m?'':'empty'} ${s.fixed?'fixed-row':''} ${armed&&!s.fixed?'place-armed':''}" ${s.fixed?'':`data-drop="${key}"`}>${inner}${note}</div>`;
    });
  });
  h+=`<div class="row-lbl total-lbl">Total</div>`;
  DAYS.forEach((_,d)=>{
    const t=dayTotals(d,pid), pct=Math.min(100,Math.round(t.kcal/pp.target*100)), over=pp.note==='losing'&&t.kcal>pp.target*1.05;
    h+=`<div class="total"><div class="kv ${over?'over':''}"><span class="cal-n">${t.kcal}</span><span style="color:var(--ink-soft)">/${pp.target}</span></div>
      <div class="bar ${over?'over':''}" style="--sel:${pp.hex}"><span style="width:${pct}%"></span></div>
      <div class="kv"><span class="p">${t.p}g P</span><span style="color:var(--ink-soft)">${Math.round(t.kcal/pp.target*100)}%</span></div></div>`;
  });
  $('#cal').innerHTML=h;
}
function renderQueue(){
  $('#qcount').textContent=state.queue.length;
  if(!state.queue.length){ $('#qstrip').innerHTML='<div class="q-empty">Nothing queued. Tap “Add to plan” on any recipe — Generate places queued recipes first, then fills the rest of the week.</div>'; return; }
  $('#qstrip').innerHTML=state.queue.map((rid,i)=>{ const r=rec(rid); if(!r) return ''; const slot=defSlot(r), pt=portion(rid,selPerson,slot,null);
    return `<div class="q-chip ${armed&&armed.rid===rid&&armed.qi===i?'armed':''}" draggable="true" data-rid="${rid}" data-qi="${i}" style="--cat:${CATS[r.cat]}"><div><div class="qn">${esc(shortName(r))}</div><div class="qm">${pt.kcal} kcal · ${pt.p}g P · ${person().label}</div></div><button data-deq="${i}" title="Remove from queue" aria-label="Remove from queue">×</button></div>`;
  }).join('');
}
const LIB_FILTERS=[['all','all'],['breakfast','breakfast'],['main','lunch & dinner'],['snack','snack box'],['chicken','chicken'],['pcod','PCOD-friendly'],['farali','farali']];
const libRecipes=()=>RECIPES.filter(r=>!r.fixed);
const cuisineList=()=>['all',...[...new Set(libRecipes().map(r=>r.cuisine).filter(Boolean))].sort()];
function matches(r){
  if(filter==='farali' && !r.farali) return false;
  if(filter==='chicken' && !r.protein) return false;
  if(filter==='pcod' && !isPcodFriendly(r)) return false;
  if((filter==='breakfast'||filter==='main'||filter==='snack') && r.cat!==filter) return false;
  if(cuisine!=='all' && r.cuisine!==cuisine) return false;
  if(!query) return true;
  const hay=(r.name+' '+r.tags.join(' ')+' '+r.upgrade+' '+r.cuisine+' '+recipeIng(r,'veg').concat(r.protein?[r.protein.chicken]:[]).map(i=>(FOODS[i[0]]||{}).name).join(' ')).toLowerCase();
  return hay.includes(query.toLowerCase());
}
function recipeBadges(r){
  const b=[];
  if(r.protein) b.push(`<span class="badge ch">chicken · ${esc(r.protein.veg[3])} for Dvija</span>`);
  if(hasEgg(r)) b.push('<span class="badge">egg</span>');
  if(isPcodFriendly(r)) b.push('<span class="badge pc">PCOD-friendly</span>');
  if(r.leftover) b.push('<span class="badge">reheats well</span>');
  return b.join('');
}
function renderFilters(){
  $('#filters').innerHTML=LIB_FILTERS.map(([c,l])=>`<button data-f="${c}" class="${c===filter?'active':''}">${l}</button>`).join('');
  const cu=cuisineList().map(c=>`<button data-cu="${esc(c)}" class="${c===cuisine?'active':''}">${c==='all'?'all cuisines':esc(c)}</button>`).join('');
  $('#cuisines').innerHTML=cu; $('#mCuisines').innerHTML=cu;
}
function renderLib(){
  const all=libRecipes(), list=all.filter(matches);
  $('#libcount').textContent=list.length+' of '+all.length+' recipes';
  if(!list.length){ $('#lib').innerHTML=`<div class="no-res">No recipes match “${esc(query)}”. Try another ingredient or tag.</div>`; return; }
  $('#lib').innerHTML=list.map(r=>{
    const slot=defSlot(r), pt=portion(r.id,selPerson,slot,null), inQ=state.queue.includes(r.id);
    const cols=PEOPLE.map(p=>{ const q=portion(r.id,p.id,slot,null); return `<div class="pcol ${p.id===selPerson?'is-sel':''}" style="--pc:${p.hex}"><div class="who"><i></i>${p.label}<small>${niceCount(q.s)}×</small></div><div class="serve">${esc(serveText(r,q.s,q.v))}</div><div class="nums"><span class="kc">${q.kcal}</span><span class="pr">${q.p}g P</span></div></div>`; }).join('');
    return `<article class="rc" draggable="true" data-rid="${r.id}" style="--cat:${CATS[r.cat]}">
      <div class="top"><div class="name">${esc(r.name)}</div><div class="tag">${r.farali?'farali':CAT_LABEL[r.cat]}${r.custom?' · custom':''}</div></div>
      <div class="rc-meta">${esc(r.cuisine||'')}</div><div class="badges">${recipeBadges(r)}</div>
      <div class="upgrade"><span class="lift">Upgrade</span><span>${esc(r.upgrade)}</span></div>
      <div class="macro-wrap"><div class="macro-label"><span>Macros — <b>${person().label}</b> portion</span><span><b>${pt.kcal}</b> kcal</span></div>${macroBar(pt)}
        <div class="macro-key"><span><i style="background:var(--pro)"></i>P ${pt.p}g</span><span><i style="background:var(--carb)"></i>C ${pt.c}g</span><span><i style="background:var(--fat)"></i>F ${pt.f}g</span></div></div>
      <div class="portions"><div class="ph">Portions · ${slot}</div><div class="ptable">${cols}</div></div>
      <button class="addq ${inQ?'added':''}" data-addq="${r.id}">${inQ?'✓ Queued for Generate':'+ Add to plan'}</button>
    </article>`;
  }).join('');
}

/* ================= recipe drawer ================= */
function ingLine(it){
  const qt = it.u==='' ? niceCount(Math.ceil(it.q*2)/2) : fmtQty(roundQty(it.q,it.u),it.u);
  const who = it.who && it.who.size ? `<small class="ing-who">for ${[...it.who].map(id=>personById(id).label).join(', ')}</small>` : '';
  return `<li><span>${esc(it.name)}${who}</span><b class="gc-q">${qt}</b></li>`;
}
function batchSummary(b){
  const groups={};
  b.parts.forEach(p=>{ const k=p.leftover?`${DAYS[p.day]} lunch (leftovers)`:(p.slot==='breakfast'?'Breakfast':p.slot==='lunch'?'Lunch':'Tonight'); (groups[k]=groups[k]||[]).push(`${personById(p.pid).label} ${niceCount(p.s)}`); });
  return Object.entries(groups).map(([k,v])=>`<div><b>${k}:</b> ${v.join(' · ')}</div>`).join('');
}
function openDrawer(rid,ctxKey,keep){
  const r=rec(rid); if(!r) return;
  const ctx=ctxKey?parseCtx(ctxKey):null;
  drawerView={t:'recipe',rid,ctx:ctxKey};
  const n=nutritionOf(r);
  const slot = ctx? ctx.slot : (r.fixed?r.cat:defSlot(r));
  let m=null, batch=null, batchNote='';
  if(ctx){
    m=mealFor(ctx.d,ctx.slot,selPerson);
    if(m&&m.weekly) batch=snackBatch();
    else if(m&&m.farali) batch=faraliBatch(ctx.slot);
    else if(m&&m.leftover){ const srcDay=(ctx.d+6)%7; batch=ctx.d===0?null:batchFor(srcDay,'dinner'); batchNote=`Cooked ${ctx.d===0?'last Sunday':FULLDAY[srcDay]} night as part of the dinner batch.`; }
    else if(m&&!m.fixed) batch=batchFor(ctx.d,ctx.slot);
  }
  let servings, ingTitle, ingSub='';
  if(r.fixed){ servings=1; ingTitle='Per person'; }
  else if(r.cat==='snack' && !batch){ const eat=state.snack.eaters.length||1; batch={parts:[].concat(...state.snack.eaters.map(pid=>DAYS.map((_,d)=>({pid,day:d,slot:'snack',s:1})))),servings:7*eat}; servings=batch.servings; ingTitle=`Sunday batch · ${servings} servings`; ingSub=`<div>One serving a day for ${state.snack.eaters.map(id=>personById(id).label).join(', ')||'—'}. Keeps ${esc(r.keeps||'a week')}.</div>`; }
  else if(batch && batch.slot==='snack'){ servings=batch.servings; ingTitle=`Sunday batch · ${servings} servings`; ingSub=`<div>One a day for ${state.snack.eaters.map(id=>personById(id).label).join(', ')} (skipped days left out). Keeps ${esc(r.keeps||'a week')}.</div>`; }
  else if(batch){ servings=batch.servings; ingTitle=`Family batch · ${niceCount(servings)} servings`; ingSub=batchSummary(batch); }
  else { servings=PEOPLE.reduce((a,p)=>a+servingsFor(r,p.id,slot),0); ingTitle=`Family batch · ${niceCount(servings)} servings`; ingSub=`<div>One ${slot==='breakfast'?'breakfast':'meal'} for all three. Weekday dinners also cook tomorrow’s lunch.</div>`; }
  const parts = r.fixed ? [{pid:selPerson,day:null,s:1}] : batch ? batch.parts : genericParts(r,slot);
  const mode = r.fixed ? 'me' : (ingMode || (personal?'me':'family'));
  let partsUsed=parts;
  if(mode==='me' && !r.fixed){
    const mine=parts.filter(p=>p.pid===selPerson);
    partsUsed = mine.length ? mine : genericParts(r,slot).filter(p=>p.pid===selPerson);
    const sv=partsUsed.reduce((a,p)=>a+p.s,0);
    ingTitle=`Just ${person().label} · ${niceCount(sv)} serving${sv===1?'':'s'}`;
    ingSub = partsUsed.length>3 ? `<div>One a day through the week.</div>`
      : partsUsed.length>1 ? `<div>${partsUsed.map(p=>`<b>${p.leftover?DAYS[p.day]+' lunch':'This meal'}:</b> ${niceCount(p.s)}`).join(' · ')}</div>` : '';
  }
  const ings = r.custom ? (r.ingText||[]).map(t=>`<li><span>${esc(t)}</span></li>`).join('') : batchIngredients(r,partsUsed).map(ingLine).join('');
  const locked = ctx && isLocked(ctx.d,ctx.slot);
  const st = ctx && statusOf(ctx.d,ctx.slot,selPerson);
  const slotActs = ctx && m ? `<div class="slot-acts">
      ${!m.fixed?`<button class="m-btn ghost" data-dswap="${ctxKey}">${ICON.swap} Swap</button>`:''}
      ${!m.fixed&&!m.leftover&&!m.farali?`<button class="m-btn ghost ${locked?'added':''}" data-dlock="${ctxKey}">${locked?ICON.lock+' Locked':ICON.unlock+' Lock'}</button>`:''}
      <button class="m-btn ghost ${st?'added':''}" data-dstatus="${ctxKey}">${ICON.check} ${st?esc(statusLabel(st)):'Mark eaten / skipped'}</button>
      ${!m.fixed?`<button class="m-btn ghost" data-dremove="${ctxKey}">${m.leftover?'Cook fresh instead':'Remove'}</button>`:''}</div>` : '';
  const dd = ctx ? (m&&m.leftover ? ctx.d : ctx.d) : null;
  const ppOrder = personal ? [personById(selPerson)].concat(PEOPLE.filter(p=>p.id!==selPerson)) : PEOPLE;
  const pp=ppOrder.map(p=>{ const q=portion(rid,p.id,slot,dd); return `<div class="dp ${p.id===selPerson?'is-sel':''}" style="--pc:${p.hex}"><div class="dp-h"><span class="who"><i></i>${p.label} <small>${niceCount(q.s)} serving${q.s===1?'':'s'}${q.v?' · '+(q.v==='chicken'?'chicken':esc(r.protein.veg[3])):''}</small></span><span class="dp-k">${q.kcal} kcal · <b>${q.p}g P</b></span></div><div class="dp-serve">${esc(serveText(r,q.s,q.v))}</div>${macroBar(q)}</div>`; }).join('');
  const nv=r.protein?nutritionOf(r,'chicken'):null;
  const li=arr=>(arr&&arr.length?arr:['—']).map(x=>`<li>${esc(x)}</li>`).join('');
  $('#drawerBody').innerHTML=`
    ${ctx?`<div class="d-ctx">${FULLDAY[ctx.d]} · ${SLOT_LABEL[ctx.slot]}${m&&m.leftover?` · leftovers from ${m.from} dinner`:''}${m&&m.farali?` · farali for ${person().label}`:''}</div>`:''}
    <h2 class="d-name">${esc(r.name)}</h2>
    <div class="d-tagrow"><span class="tag" style="background:${CATS[r.cat]}">${r.farali?'farali':CAT_LABEL[r.cat]}</span>${r.cuisine?`<span class="tag ghost">${esc(r.cuisine)}</span>`:''}${r.custom?'<span class="tag ghost">custom</span>':''}</div>
    <div class="badges">${recipeBadges(r)}</div>
    ${r.protein?`<p class="pf-note">Shared base: one gravy, split into two pots — chicken for Akshar &amp; Aum, ${esc(r.protein.veg[3])} for Dvija. On Thursdays and Saturdays everyone gets ${esc(r.protein.veg[3])}.</p>`:''}
    ${slotActs}
    ${!ctx&&!r.fixed?`<div class="slot-acts"><button class="m-btn ${state.queue.includes(rid)?'ghost added':''}" data-dq="${rid}">${state.queue.includes(rid)?'✓ Queued for Generate':'+ Add to plan'}</button></div>`:''}
    ${r.cat==='snack'?`<div class="pf-set snack-who"><span>Snack box for</span><div class="seg">${PEOPLE.map(p=>`<button data-snackeater="${p.id}" class="${state.snack.eaters.includes(p.id)?'active':''}">${p.label}</button>`).join('')}</div></div>`:''}
    <div class="upgrade"><span class="lift">Upgrade</span><span>${esc(r.upgrade)}</span></div>
    <div class="d-sec"><h3>Portions <small>${r.fixed?'fixed daily':SLOT_LABEL[slot].toLowerCase()+' budget'}</small></h3><div class="d-portions">${personal&&!r.fixed ? ppOne(pp) : pp}</div>
      <p class="pf-note">1 serving ≈ ${Math.round(n.kcal)} kcal · ${Math.round(n.p)}g P · ${Math.round(n.c)}g C · ${Math.round(n.f)}g F · ${Math.round(n.fib)}g fibre${nv?` (with chicken: ${Math.round(nv.kcal)} kcal · ${Math.round(nv.p)}g P)`:''}${r.protein?' — veg version':''}</p></div>
    <div class="d-sec"><h3>Ingredients ${r.fixed?`<small>${ingTitle}</small>`:`<span class="seg ing-toggle"><button data-ingmode="family" class="${mode==='family'?'active':''}" aria-pressed="${mode==='family'}">Family</button><button data-ingmode="me" class="${mode==='me'?'active':''}" aria-pressed="${mode==='me'}">Just ${esc(person().label)}</button></span>`}</h3>${r.fixed?'':`<p class="ing-title">${ingTitle}</p>`}${ingSub?`<div class="batch-sub">${ingSub}</div>`:''}${batchNote?`<p class="pf-note">${batchNote}</p>`:''}<ul class="d-ing">${ings||'<li><span>—</span></li>'}</ul></div>
    <div class="d-sec"><h3>Method <small>${r.fixed?'per glass':mode==='me'?'same steps — use your amounts above':'for the whole batch'}</small></h3><ol class="d-steps">${li(r.method)}</ol></div>
    ${r.swaps&&r.swaps.length?`<div class="d-sec"><h3>Possible swaps</h3><ul class="d-swaps">${li(r.swaps)}</ul></div>`:''}
    ${r.custom?`<div class="form-actions"><button class="btn-ghost danger" id="d_del">Delete this recipe</button></div>`:''}`;
  if(r.custom){ const del=$('#d_del'); if(del) del.addEventListener('click',()=>removeCustom(rid)); }
  openShell(keep);
}
function ppOne(html){
  const cards=html.split('<div class="dp ').filter(Boolean).map(c=>'<div class="dp '+c);
  return cards[0] + (cards.length>1?`<details class="pp-more"><summary>Everyone’s portions</summary>${cards.slice(1).join('')}</details>`:'');
}
function closeDrawer(){ const dr=$('#drawer'); dr.classList.remove('open'); dr.setAttribute('aria-hidden','true'); $('#scrim').classList.remove('show'); drawerView=null; }
function openShell(keep){ const dr=$('#drawer'); dr.classList.add('open'); dr.setAttribute('aria-hidden','false'); if(!keep) dr.querySelector('.drawer-body').scrollTop=0; $('#scrim').classList.add('show'); }
function refreshDrawer(){ if(!drawerView) return; if(drawerView.t==='recipe') openDrawer(drawerView.rid,drawerView.ctx,true); else if(drawerView.t==='grocery') openGrocery(true); else if(drawerView.t==='profile') openProfile(true); }

/* ================= custom recipes ================= */
function openAddForm(){
  drawerView={t:'form'};
  $('#drawerBody').innerHTML=`
    <div class="d-ctx">New recipe</div><h2 class="d-name">Build a recipe</h2>
    <p class="form-note">Describe ONE standard serving. Each person's portion (and the family batch) is worked out from their calorie budget.</p>
    <div class="d-sec"><h3>Basics</h3><div class="fm-grid">
      <label class="wide">Name<input type="text" id="f_name" placeholder="e.g. Tofu bhurji toast"></label>
      <label>Meal<select id="f_cat"><option value="breakfast">breakfast</option><option value="main" selected>lunch & dinner</option></select></label>
      <label>Cuisine<input type="text" id="f_cuisine" placeholder="e.g. Gujarati"></label>
      <label class="wide">Protein note<input type="text" id="f_upgrade" placeholder="what makes it protein-rich"></label>
      <label class="wide">One serving looks like<input type="text" id="f_serve" placeholder="e.g. 1 bowl · 150 g tofu · 2 roti"></label>
      <label>Calories<input type="number" id="f_kcal" min="0" placeholder="kcal"></label>
      <label>Protein <small>g</small><input type="number" id="f_p" min="0" placeholder="g"></label>
      <label>Carbs <small>g</small><input type="number" id="f_c" min="0" placeholder="g"></label>
      <label>Fat <small>g</small><input type="number" id="f_f" min="0" placeholder="g"></label>
    </div>
    <div class="chk-row"><label class="chk"><input type="checkbox" id="f_left" checked> Reheats well (OK as next-day lunch)</label><label class="chk"><input type="checkbox" id="f_farali"> Farali</label><label class="chk"><input type="checkbox" id="f_nosugar"> No added sugar</label></div>
    <div class="fm-fb" id="f_fb"></div></div>
    <div class="d-sec"><h3>Ingredients <small>one per line, for one serving</small></h3><textarea id="f_ing" rows="4" placeholder="60 g moong dal\n1 egg"></textarea></div>
    <div class="d-sec"><h3>Method <small>one step per line</small></h3><textarea id="f_method" rows="4"></textarea></div>
    <div class="d-sec"><h3>Swaps <small>one per line</small></h3><textarea id="f_swaps" rows="3"></textarea></div>
    <div class="form-actions"><button class="btn-ghost" id="f_cancel">Cancel</button><button class="btn-solid" id="f_save">Save recipe</button></div>`;
  const upd=()=>{
    const kcal=+$('#f_kcal').value||0, p=+$('#f_p').value||0, slot=$('#f_cat').value==='breakfast'?'breakfast':'dinner';
    if(!kcal){ $('#f_fb').innerHTML=''; return; }
    $('#f_fb').innerHTML=PEOPLE.map(pp=>{ const s=Math.min(4,Math.max(.5,Math.round(slotBudget(pp.id,slot)/kcal*4)/4)); return `<span class="pill ok">${pp.label}: ${niceCount(s)}× = ${Math.round(kcal*s)} kcal · ${Math.round(p*s)}g P</span>`; }).join('')
      + `<span class="pill ${p/kcal*100>=8?'ok':'warn'}">${p/kcal*100>=8?'protein-forward':'low protein'}</span>`;
  };
  ['#f_kcal','#f_p','#f_cat'].forEach(s=>$(s).addEventListener('input',upd));
  $('#f_cancel').addEventListener('click',closeDrawer);
  $('#f_save').addEventListener('click',saveForm);
  openShell();
}
function saveForm(){
  const name=$('#f_name').value.trim(); if(!name){ toast('Add a recipe name'); $('#f_name').focus(); return; }
  const kcal=+$('#f_kcal').value||0; if(!kcal){ toast('Add calories per serving'); $('#f_kcal').focus(); return; }
  const p=+$('#f_p').value||0, cv=$('#f_c').value, fv=$('#f_f').value;
  let c=cv===''?null:+cv, f=fv===''?null:+fv; const rem=Math.max(0,kcal-p*4);
  if(c==null&&f==null){ f=Math.round(rem*.3/9); c=Math.round((rem-f*9)/4); } else if(c==null) c=Math.round(Math.max(0,rem-f*9)/4); else if(f==null) f=Math.round(Math.max(0,rem-c*4)/9);
  const lines=id=>$('#'+id).value.split('\n').map(s=>s.trim()).filter(Boolean);
  const tags=[]; if($('#f_nosugar').checked) tags.push('no-sugar'); if($('#f_farali').checked) tags.push('farali');
  state.custom.push({id:'cust_'+Date.now().toString(36),name,cat:$('#f_cat').value,cuisine:$('#f_cuisine').value.trim(),upgrade:$('#f_upgrade').value.trim()||'Custom recipe.',
    tags,per:{kcal,p,c,f},serveText:$('#f_serve').value.trim()||'1 serving',ingText:lines('f_ing'),method:lines('f_method'),swaps:lines('f_swaps'),
    leftover:$('#f_left').checked,farali:$('#f_farali').checked});
  mountCustoms(); filter='all'; query=''; $('#search').value=''; $('#mSearch').value='';
  closeDrawer(); renderFilters(); commit(); toast('Recipe added to the library');
}
function removeCustom(id){
  state.custom=state.custom.filter(c=>c.id!==id);
  DAYS.forEach((_,d)=>MEAL_SLOTS.forEach(s=>{ if(state.plan[d][s]===id) state.plan[d][s]=null; }));
  ['lunch','dinner'].forEach(s=>{ if(state.farali[s]===id) state.farali[s]=null; });
  if(state.prevSunDinner===id) state.prevSunDinner=null;
  state.queue=state.queue.filter(x=>x!==id);
  mountCustoms(); closeDrawer(); commit(); toast('Recipe deleted');
}

/* ================= grocery ================= */
let gStore = store.get('mp_gstore') || 'all';      // which store tab this phone is looking at
const AISLES=['Proteins & dairy','Produce','Grains & legumes','Nuts, seeds & spreads','Pantry & supplements','Other'];
function groceryModel(){
  const {items,sessions}=buildGrocery(), checked=state.grocery||{};
  items.forEach(it=>{ it.storeId=storeOf(it); it.done=!!checked[it.id]; });
  const sections=state.stores.map(st=>({id:st.id,name:st.name,items:items.filter(it=>it.storeId===st.id)}));
  const un=items.filter(it=>!it.storeId); if(un.length) sections.push({id:'none',name:'Unassigned',items:un});
  if(gStore!=='all' && !sections.some(x=>x.id===gStore)) gStore='all';
  return {items,sessions,sections};
}
function groceryHTML(scope){
  const {items,sessions,sections}=groceryModel();
  const row=it=>{
    const open=mOpenIng===it.id;
    let extra='';
    if(open){
      const cells=it.key&&FOODS[it.key]?cellsForIngredient(it.key):[];
      extra=`<div class="gc-loc">${it.key&&FOODS[it.key]?(cells.length?'Used in '+cells.map(c=>`<button data-jump="${c.d}|${c.slot}">${c.weekly?'Snack box':DAYS[c.d]+' · '+SLOT_LABEL[c.slot]}${c.farali?' (Aum)':''}${c.leftover?' ↩':''}</button>`).join(''):'Daily drink / shake'):'From a custom recipe'}</div>
        <div class="gc-move"><span>Buy at</span>${state.stores.map(st=>`<button data-setstore="${esc(it.id)}|${st.id}" class="${it.storeId===st.id?'on':''}">${esc(st.name)}</button>`).join('')}</div>`;
    }
    return `<div class="gc-item ${it.done?'done':''} ${open?'active':''}"><input type="checkbox" data-g="${esc(it.id)}" ${it.done?'checked':''} aria-label="Tick off ${esc(it.n)}"><button type="button" class="gc-txt" data-ing="${esc(it.id)}" aria-expanded="${open}"><span class="gc-name">${esc(it.n)}</span><b class="gc-q">${it.qty||'as listed'}</b></button>${extra}</div>`;
  };
  const byAisle=list=>AISLES.map(a=>{ const g=list.filter(it=>(it.cat||'Other')===a); return g.length?`<div class="gc-group">${a}</div>`+g.map(row).join(''):''; }).join('');
  const shown = gStore==='all' ? sections : sections.filter(x=>x.id===gStore);
  const visible = shown.flatMap(x=>x.items), done=visible.filter(it=>it.done).length;
  const tabs=[{id:'all',name:'All',items}].concat(sections).map(x=>{ const d=x.items.filter(it=>it.done).length;
    return `<button data-gstore="${x.id}" class="${gStore===x.id?'active':''}" aria-pressed="${gStore===x.id}">${esc(x.name)} <small>${d?d+'/':''}${x.items.length}</small></button>`; }).join('');
  const body = !items.length ? '<p class="form-note">Nothing planned yet.</p>'
    : gStore==='all' ? shown.filter(x=>x.items.length).map(x=>`<div class="gc-store"><div class="gc-store-h"><b>${esc(x.name)}</b><span>${x.items.filter(i=>i.done).length}/${x.items.length}</span></div>${x.items.map(row).join('')}</div>`).join('')
    : (visible.length ? byAisle(visible) : `<p class="form-note">Nothing to buy at ${esc((shown[0]||{}).name||'this store')} this week.</p>`);
  const label = gStore==='all' ? '' : ' '+((shown[0]||{}).name||'');
  return `<p class="${scope==='m'?'m-sub':'form-note'}">Everything for this week’s ${sessions} cooking sessions (dinners include tomorrow’s lunch, plus the Sunday snack box) and 7 days of drinks and shakes. Tap an item to see where it’s used or move it to another store. Salt, spices and herbs assumed on hand.</p>
    ${items.length?`<div class="filters g-tabs">${tabs}</div>
    <div class="m-prog"><div class="bar" style="--sel:var(--olive)"><span style="width:${visible.length?Math.round(done/visible.length*100):0}%"></span></div></div>
    <div class="gc-actions"><button class="btn-ghost" data-gcopy>Copy${esc(label)} list</button><button class="btn-ghost" data-gclear>Clear ticks</button><button class="btn-ghost" data-gmanage>Stores…</button><span class="hint">${done}/${visible.length} ticked</span></div>`:''}
    <div class="gc-list">${body}</div>`;
}
function openGrocery(keep){
  drawerView={t:'grocery'};
  $('#drawerBody').innerHTML=`<div class="d-ctx">Week of ${dayDate(0)}</div><h2 class="d-name">Grocery list</h2>${groceryHTML('d')}`;
  openShell(keep);
}
function copyGroceryText(){
  const {sections}=groceryModel();
  const secs=(gStore==='all'?sections:sections.filter(x=>x.id===gStore)).map(x=>{
    const left=x.items.filter(it=>!it.done); if(!left.length) return null;
    return x.name.toUpperCase()+'\n'+left.map(it=>`[ ] ${it.n} — ${it.qty||'as listed'}`).join('\n');
  }).filter(Boolean);
  if(!secs.length){ toast('Everything here is ticked off'); return; }
  try{ navigator.clipboard.writeText(secs.join('\n\n')).then(()=>toast('Copied what’s left to buy'),()=>toast('Copy isn’t available here')); }catch(e){ toast('Copy isn’t available here'); }
}
function onGroceryClick(e){
  const q=s=>e.target.closest(s); let b;
  if(b=q('[data-gstore]')){ gStore=b.dataset.gstore; store.set('mp_gstore',gStore); mOpenIng=null; return true; }
  if(b=q('[data-setstore]')){ const [id,sid]=b.dataset.setstore.split('|'); state.storeMap[id]=sid; saveState(); toast(`Moved to ${storeById(sid).name} for everyone`); return true; }
  if(b=q('[data-ing]')){ mOpenIng=mOpenIng===b.dataset.ing?null:b.dataset.ing; return true; }
  if(q('[data-gclear]')){ state.grocery={}; saveState(); return true; }
  if(q('[data-gcopy]')){ copyGroceryText(); return false; }
  if(q('[data-gmanage]')){ openStoresSheet(); return false; }
  return false;
}
function onGroceryChange(e){
  const cb=e.target.closest('[data-g]'); if(!cb) return false;
  if(cb.checked) state.grocery[cb.dataset.g]=1; else delete state.grocery[cb.dataset.g];
  saveState(); return true;
}
/* manage stores (sheet) */
function openStoresSheet(){
  sheetState={t:'stores'};
  const {items}=buildGrocery(); items.forEach(it=>it.storeId=storeOf(it));
  openSheet('Grocery','Your stores',`
    <p class="m-sub">Rename, add or remove stores. Removing a store moves its items to their default store, or to “Unassigned”.</p>
    <div class="store-list">${state.stores.map(st=>`<div class="store-row"><input type="text" value="${esc(st.name)}" data-rename="${st.id}" aria-label="Store name"><small>${items.filter(i=>i.storeId===st.id).length} items</small><button class="m-ic" data-delstore="${st.id}" aria-label="Remove ${esc(st.name)}">×</button></div>`).join('')}</div>
    <div class="store-add"><input type="text" id="newStore" placeholder="Add a store — e.g. Trader Joe’s" autocomplete="off"><button class="btn-solid" data-addstore>Add</button></div>`);
}
$('#sheet').addEventListener('click',e=>{
  if(!sheetState||sheetState.t!=='stores') return;
  const q=s=>e.target.closest(s); let b;
  if(q('[data-addstore]')){ const id=addStore($('#newStore').value); if(!id) return toast('Type a store name first'); commit(); openStoresSheet(); return toast('Store added'); }
  if(b=q('[data-delstore]')){
    if(state.stores.length<=1) return toast('Keep at least one store');
    if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='✓'; b.setAttribute('aria-label','Tap again to remove'); toast('Tap again to remove this store'); return; }
    removeStore(b.dataset.delstore); commit(); openStoresSheet(); return toast('Store removed');
  }
});
$('#sheet').addEventListener('change',e=>{ const i=e.target.closest('[data-rename]'); if(!i||!sheetState||sheetState.t!=='stores') return; renameStore(i.dataset.rename,i.value); commit(); });
$('#sheet').addEventListener('keydown',e=>{ if(e.key==='Enter' && e.target.id==='newStore'){ e.preventDefault(); $('[data-addstore]').click(); } });
function jumpTo(key){
  const {d,slot}=parseCtx(key);
  if(isMobile()){ mDay=d; closeDrawer(); setTab('today'); return; }
  closeDrawer();
  const cell=document.querySelector(`[data-drop="${key}"]`); if(!cell) return;
  cell.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});
  cell.classList.add('hl'); setTimeout(()=>cell.classList.remove('hl'),2600);
}
const isMobile=()=>window.matchMedia('(max-width:760px)').matches;

/* ================= mobile ================= */
const TABS=[['discover','Discover'],['today','Today'],['grocery','Grocery'],['queue','Queue']];
function renderMobile(){
  const pp=person();
  $('#mProfile').innerHTML=`<span style="--pc:${pp.hex}">${pp.label[0]}</span>${ICON.chart}<i class="sync-dot s-${Sync.status}"></i>`;
  $('#mKicker').textContent = Sync.user ? `${SYNC_LABEL[Sync.status]} · ${Sync.person?Sync.person.label:''}` : 'Family of three · not synced';
  $('#mPeople').innerHTML=PEOPLE.map(p=>`<button data-mp="${p.id}" class="${p.id===selPerson?'active':''}" aria-pressed="${p.id===selPerson}"><span class="dot" style="background:${p.hex}"></span>${p.label}</button>`).join('');
  $('#mTabs').innerHTML=TABS.map(([id,l])=>`<button class="m-tab ${id===mTab?'active':''}" data-tab="${id}" ${id===mTab?'aria-current="page"':''}>${ICON[id]}${l}${id==='queue'&&state.queue.length?`<span class="m-badge">${state.queue.length}</span>`:''}</button>`).join('');
  document.querySelectorAll('.m-panel').forEach(p=>p.hidden=p.dataset.panel!==mTab);
  ({discover:renderMDiscover,today:renderMToday,grocery:renderMGrocery,queue:renderMQueue})[mTab]();
}
function setTab(t){ mTab=t; store.set('mp_tab',t); renderMobile(); window.scrollTo(0,0); }
function renderMDiscover(){
  $('#mFilters').innerHTML=LIB_FILTERS.map(([c,l])=>`<button data-mf="${c}" class="${c===filter?'active':''}">${l}</button>`).join('');
  if($('#mSearch').value!==query) $('#mSearch').value=query;
  const all=libRecipes(), list=all.filter(matches), pp=person();
  $('#mLibCount').textContent=list.length+' of '+all.length;
  if(!list.length){ $('#mLib').innerHTML=`<div class="m-empty">No recipes match “${esc(query)}”.</div>`; return; }
  $('#mLib').innerHTML=list.map(r=>{
    const slot=defSlot(r), pt=portion(r.id,selPerson,slot,null), inQ=state.queue.includes(r.id);
    return `<article class="m-card" style="--cat:${CATS[r.cat]}"><button class="m-hit" data-open="${r.id}">
        <span class="top"><span class="name">${esc(r.name)}</span><span class="tag">${r.farali?'farali':CAT_LABEL[r.cat]}</span></span>
        <span class="m-upg">${esc(r.cuisine?r.cuisine+' · ':'')}${esc(r.upgrade)}</span>
        <span class="m-mac"><span><b>${pt.kcal}</b> kcal · ${pp.label} ${niceCount(pt.s)}×</span><span><b style="color:var(--pro)">P ${pt.p}g</b> · C ${pt.c} · F ${pt.f}</span></span>${macroBar(pt)}<span class="badges">${recipeBadges(r)}</span></button>
      <div class="m-card-actions"><button class="m-btn ${inQ?'ghost added':''}" data-mq="${r.id}">${inQ?'✓ Queued for Generate':'+ Add to plan'}</button></div></article>`;
  }).join('');
}
function renderMToday(dir){
  const pid=selPerson, pp=person(), t=dayTotals(mDay,pid), g=macroGuide(pid);
  const pct=Math.round(t.kcal/pp.target*100), over=pp.note==='losing'&&t.kcal>pp.target*1.05;
  const days=DAYS.map((dn,d)=>{ const w=Math.min(100,Math.round(dayTotals(d,pid).kcal/pp.target*100));
    return `<button class="m-day ${d===mDay?'active':''} ${d===TODAY_IDX?'is-today':''}" data-day="${d}" aria-pressed="${d===mDay}" aria-label="${FULLDAY[d]}${d===TODAY_IDX?' (today)':''}">${dn}<span class="pip"><i style="width:${w}%"></i></span></button>`; }).join('');
  const stat=(lbl,v,tg,col)=>`<div class="m-stat"><div class="k">${lbl}</div><div class="v">${v}<small>/${tg}g</small></div><div class="bar" style="--sel:${col}"><span style="width:${Math.min(100,Math.round(v/tg*100))}%"></span></div></div>`;
  const rows=SLOTS.map(s=>{
    const m=mealFor(mDay,s.id,pid), key=mDay+'|'+s.id;
    let body;
    if(!m && s.id==='snack') return '';
    if(m){ const r=rec(m.rid), pt=portion(m.rid,pid,s.id,mDay), locked=isLocked(mDay,s.id), st=statusOf(mDay,s.id,pid);
      const vtag=pt.v?` · ${pt.v==='chicken'?'chicken':esc(r.protein.veg[3])}`:'';
      const badge=st?`<span class="m-badge-lo st">${esc(statusLabel(st))}${st!=='skip'?` · ~${outEstimate(mDay,s.id,pid,st)} kcal`:''}</span>`:m.weekly?`<span class="m-badge-lo fixed">weekly snack · made Sunday</span>`:m.leftover?`<span class="m-badge-lo">↩ ${m.from} dinner leftovers${vtag}</span>`:m.farali?`<span class="m-badge-lo">farali</span>`:m.fixed?`<span class="m-badge-lo fixed">every day</span>`:vtag?`<span class="m-badge-lo">${vtag.slice(3)}</span>`:'';
      body=`<div class="m-item ${m.fixed?'fixed':''} ${locked?'locked':''} ${st?(st==='skip'?'st-skip':'st-out'):''}" style="--cat:${CATS[r.cat]}">
        <button class="m-hit" data-open="${m.rid}" data-ctx="${key}">${badge}<span class="nm">${esc(r.name)}</span><span class="meta"><b>${pt.kcal}</b> kcal · <b class="p">${pt.p}g P</b> · ${esc(serveText(r,pt.s,pt.v))}</span></button>
        <div class="m-acts"><button class="m-ic ${st?'on':''}" data-mstatus="${key}" aria-label="Mark eaten, skipped or ate out">${ICON.check}</button>${m.fixed?'':`<button class="m-ic" data-mswap="${key}" aria-label="Swap">${ICON.swap}</button>${!m.leftover&&!m.farali&&!m.weekly?`<button class="m-ic ${locked?'on':''}" data-mlock="${key}" aria-label="${locked?'Unlock':'Lock'}">${locked?ICON.lock:ICON.unlock}</button>`:''}`}</div>
      </div>`;
    } else {
      const canLo = s.id==='lunch' && LEFTOVER_DAYS.includes(mDay) && state.plan[mDay].lunchFresh && !isFarali(pid,mDay);
      body=`<div class="m-empty-row"><button class="m-add" data-slot="${key}">+ Add ${s.label.toLowerCase()}</button>${canLo?`<button class="m-add lo" data-uselo="${mDay}">↩ Use ${mDay===0?'Sunday':DAYS[mDay-1]} leftovers</button>`:''}</div>`;
    }
    const st0=m&&statusOf(mDay,s.id,pid);
    const kc=!m?0: st0==='skip'?0 : st0?outEstimate(mDay,s.id,pid,st0) : portion(m.rid,pid,s.id,mDay).kcal;
    return `<div class="m-meal"><div class="m-meal-h"><span>${s.label}</span>${kc?`<b>${kc} kcal</b>`:''}</div>${body}</div>`;
  }).join('');
  const dinnerBatch=batchFor(mDay,'dinner');
  const cookNote = dinnerBatch && dinnerBatch.parts.some(p=>p.leftover) ? `<p class="m-cook">Tonight: cook ${niceCount(dinnerBatch.servings)} servings of ${esc(shortName(rec(dinnerBatch.rid)))} — includes ${FULLDAY[nextDay(mDay)]}’s lunch.</p>` : '';
  const snackR=rec(state.snack.rid);
  const snackNote = mDay===0 && snackR ? `<p class="m-cook">Snack box this week: ${esc(snackR.name)} — prep ${snackBatch()?snackBatch().servings:0} servings on Sunday (keeps ${esc(snackR.keeps||'a week')}).</p>` : '';
  const faraliNote = mDay===FARALI.day && pid!==FARALI.pid ? `<p class="m-cook">Aum eats farali today: ${esc(state.farali.lunch?shortName(rec(state.farali.lunch)):'—')} for lunch, ${esc(state.farali.dinner?shortName(rec(state.farali.dinner)):'—')} for dinner.</p>`:'';
  $('#mToday').innerHTML=`
    <div class="m-days" style="--sel:${pp.hex}">${days}</div>
    <div class="m-daybody ${dir?'m-anim':''}" style="--dx:${(dir||0)*28}px">
      <div class="m-dayhead"><div><div class="d-ctx">${mDay===TODAY_IDX?'Today':dayDate(mDay)}${mDay===TODAY_IDX?' · '+dayDate(mDay):''}${DAYNOTE[mDay]?' · '+DAYNOTE[mDay]:''}</div><h2 class="m-h2">${FULLDAY[mDay]}</h2></div>
        <div class="m-arrows"><button data-step="-1" aria-label="Previous day">‹</button><button data-step="1" aria-label="Next day">›</button></div></div>
      <div class="m-sum">
        <div class="m-sum-top"><div><span class="big ${over?'over':''}">${t.kcal.toLocaleString()}</span><span class="of">/ ${pp.target.toLocaleString()} kcal · ${pp.label}</span></div><span class="pct">${pct}%</span></div>
        <div class="bar ${over?'over':''}" style="--sel:${pp.hex}"><span style="width:${Math.min(100,pct)}%"></span></div>
        <div class="m-stats">${stat('Protein',t.p,g.p,'var(--pro)')}${stat('Carbs',t.c,g.c,'var(--carb)')}${stat('Fat',t.f,g.f,'var(--fat)')}</div>
      </div>
      ${cookNote}${snackNote}${faraliNote}${rows}
    </div>
    <div class="m-foot"><button class="btn-solid" data-gen>${ICON.spark} Generate</button><button class="btn-ghost" id="mReset">↺ Starter plan</button></div>`;
}
function renderMGrocery(){ $('#mGrocery').innerHTML=`<div class="m-title"><h2 class="m-h2">Grocery list</h2></div>${groceryHTML('m')}`; }
function renderMQueue(){
  const rows=state.queue.map((rid,i)=>{ const r=rec(rid); if(!r) return ''; const slot=defSlot(r), pt=portion(rid,selPerson,slot,null);
    return `<div class="m-item" style="--cat:${CATS[r.cat]}"><button class="m-hit" data-open="${rid}"><span class="nm">${esc(r.name)}</span><span class="meta">${r.farali?'farali':CAT_LABEL[r.cat]} · <b>${pt.kcal}</b> kcal · <b class="p">${pt.p}g P</b></span></button><button class="m-btn sm" data-plan="${rid}">Place</button><button class="m-ic" data-mdeq="${i}" aria-label="Remove ${esc(r.name)} from queue">×</button></div>`; }).join('');
  $('#mQueue').innerHTML=`<div class="m-title"><h2 class="m-h2">Queue</h2><span class="hint">${state.queue.length} staged</span></div>
    <p class="m-sub">Recipes you’ve added to the plan. Generate places them first, then fills the rest of the week — 1–2 chicken nights, reheatable Sun–Thu dinners, no recipe more than twice.</p>
    <button class="btn-solid wide gen-big" data-gen>${ICON.spark} Generate plan</button>
    ${state.queue.length?`<div style="margin-top:14px">${rows}</div>`:`<div class="m-qempty"><p>Your queue is empty. Browse recipes and tap <b>+ Queue</b> to stage them here.</p><button class="m-btn sm" data-goto="discover">Discover recipes</button></div>`}`;
}

/* ================= bottom sheet pickers ================= */
function openSheet(ctx,title,html){
  const s=$('#sheet'), wasOpen=s.classList.contains('open');
  $('#sheetCtx').textContent=ctx; $('#sheetTitle').textContent=title; $('#sheetBody').innerHTML=html;
  if(!wasOpen) $('#sheetBody').scrollTop=0;
  s.classList.add('open'); s.setAttribute('aria-hidden','false'); $('#sheetScrim').classList.add('show');
}
function closeSheet(){ const s=$('#sheet'); s.classList.remove('open'); s.setAttribute('aria-hidden','true'); $('#sheetScrim').classList.remove('show'); sheetState=null; }
function openPlacePicker(rid){
  const r=rec(rid); if(!r) return;
  if(r.cat==='snack'){ setMealView(0,'snack',rid); state.queue=state.queue.filter(x=>x!==rid); return commit(); }
  sheetState={t:'place',rid,d:mDay,m: r.cat==='breakfast'?'breakfast':'dinner'};
  renderPlacePicker();
}
function renderPlacePicker(){
  const s=sheetState, r=rec(s.rid), pt=portion(s.rid,selPerson,s.m,s.d);
  const meals = r.cat==='breakfast' ? ['breakfast'] : ['lunch','dinner'];
  const cur=mealFor(s.d,s.m);
  const warn = s.m==='lunch' && isLeftoverLunch(s.d) ? `<p class="pf-note">${DAYS[s.d]} lunch is normally ${s.d===0?'Sunday':DAYS[s.d-1]}’s leftovers — this cooks a fresh lunch instead.</p>` : cur&&!cur.fixed ? `<p class="pf-note">Replaces ${esc(shortName(rec(cur.rid)))}.</p>` : '';
  openSheet('Add to plan', r.name, `
    <p class="m-sub">${pt.kcal} kcal · ${pt.p}g P for ${person().label} · ${esc(serveText(r,pt.s,pt.v))}</p>
    <div class="sh-lbl">Day</div>
    <div class="opt-grid days">${DAYS.map((dn,d)=>`<button class="opt ${d===s.d?'active':''}" data-pd="${d}" aria-pressed="${d===s.d}">${dn}${d===TODAY_IDX?'<i class="now"></i>':''}</button>`).join('')}</div>
    <div class="sh-lbl">Meal</div>
    <div class="opt-grid meals">${meals.map(m=>{ const c=mealFor(s.d,m); return `<button class="opt ${m===s.m?'active':''}" data-pm="${m}" aria-pressed="${m===s.m}">${SLOT_LABEL[m]}<small>${c?(c.leftover?'leftovers':esc(shortName(rec(c.rid)))):'empty'}</small></button>`; }).join('')}</div>
    ${r.farali?`<div class="sh-lbl">Or for Aum's Thursday</div><div class="opt-grid meals">${['lunch','dinner'].map(m=>`<button class="opt" data-pfar="${m}">Farali ${m}<small>${state.farali[m]?esc(shortName(rec(state.farali[m]))):'empty'}</small></button>`).join('')}</div>`:''}
    ${warn}
    <button class="btn-solid wide" id="shConfirm">Add to ${FULLDAY[s.d]} · ${SLOT_LABEL[s.m]}</button>`);
}
function openSlotPicker(key){
  const {d,slot}=parseCtx(key), far=isFarali(selPerson,d)&&(slot==='lunch'||slot==='dinner');
  sheetState={t:'slot',d,slot,far,q:''};
  openSheet(FULLDAY[d], (far?'Farali ':'')+SLOT_LABEL[slot].toLowerCase(),
    `<div class="search m-search"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input id="shSearch" type="text" enterkeyhint="search" placeholder="Search recipes…" autocomplete="off"></div><div id="shList"></div>`);
  renderSlotList();
}
function renderSlotList(){
  const s=sheetState, cat=s.slot==='breakfast'?'breakfast':s.slot==='snack'?'snack':'main', q=s.q.toLowerCase();
  const fits=r=>!r.fixed && (s.far ? r.farali : r.cat===cat) && (!q||(r.name+' '+r.tags.join(' ')+' '+r.cuisine).toLowerCase().includes(q));
  const pslot=s.slot;
  const row=r=>{ const pt=portion(r.id,selPerson,pslot,s.d); return `<button class="pick" data-pick="${r.id}" style="--cat:${CATS[r.cat]}"><span class="tx"><span class="nm">${esc(r.name)}</span><span class="meta">${esc(r.cuisine||CAT_LABEL[r.cat])}${r.protein?' · chicken/'+esc(r.protein.veg[3]):''}${r.leftover&&s.slot==='dinner'?' · reheats well':''}${isPcodFriendly(r)?' · PCOD':''} · ${pt.kcal} kcal · ${pt.p}g P</span></span><span class="plus" aria-hidden="true">+</span></button>`; };
  const qd=state.queue.map(id=>rec(id)).filter(r=>r&&fits(r));
  const rest=RECIPES.filter(r=>fits(r)&&!state.queue.includes(r.id));
  const sec=(t,arr)=>arr.length?`<div class="sh-lbl">${t}</div>${arr.map(row).join('')}`:'';
  $('#shList').innerHTML=(sec('From your queue',qd)+sec(s.far?'Farali recipes':'Recipes',rest))||'<div class="m-empty">No recipes match.</div>';
}

/* ================= profile dashboard ================= */
function openProfile(keep){
  const pid=selPerson, pp=person(), g=macroGuide(pid), mt=MICRO_TARGET[pid];
  const days=DAYS.map((_,d)=>dayTotals(d,pid));
  const wk=Object.fromEntries(NKEYS.map(k=>[k,0])); days.forEach(t=>NKEYS.forEach(k=>wk[k]+=t[k]));
  const A={kcal:Math.round(wk.kcal/7),p:Math.round(wk.p/7),c:Math.round(wk.c/7),f:Math.round(wk.f/7)};
  const onTgt=days.filter(t=>t.kcal>=pp.target*.9&&t.kcal<=pp.target*1.1).length, pHit=days.filter(t=>t.p>=g.p*.9).length;
  const delta=A.kcal-pp.target, deltaCls=(pp.note==='losing'?delta<=0:delta>=0)?'good':'warn';
  const kpi=(k,v,unit,sub,cls)=>`<div class="kpi"><div class="k">${k}</div><div class="v">${v}<small>${unit}</small></div><div class="s ${cls||''}">${sub}</div></div>`;
  const max=Math.max(pp.target*1.25,...days.map(t=>t.kcal));
  const bars=days.map((t,d)=>{ const over=pp.note==='losing'&&t.kcal>pp.target*1.05, low=t.kcal<pp.target*.8;
    return `<button class="wk-col" data-pfday="${d}" style="--h:${(t.kcal/max*100).toFixed(1)}%;--sel:${pp.hex}" aria-label="${FULLDAY[d]}: ${t.kcal} kcal"><span class="b ${over?'over':''} ${low?'low':''}"></span><span class="n">${t.kcal||''}</span></button>`; }).join('');
  const pk=A.p*4, ck=A.c*4, fk=A.f*9, tot=pk+ck+fk||1, share=x=>Math.round(x/tot*100);
  const row=(l,sub,pct,col)=>`<div class="pf-row"><div class="l">${l}<small>${sub}</small></div><div class="bar" style="--sel:${col}"><span style="width:${Math.min(100,pct)}%"></span></div><div class="r">${pct}%</div></div>`;
  const macroRows=[['Protein',A.p,g.p,'var(--pro)'],['Carbs',A.c,g.c,'var(--carb)'],['Fat',A.f,g.f,'var(--fat)']].map(([l,v,t,c])=>row(l,`${v} / ${t}g`,Math.round(v/t*100),c)).join('');
  const micro=MICRO_KEYS.map(([k,l,u])=>{ const v=wk[k]/7, t=mt[k]; return {l,u,v,t,pct:Math.round(v/t*100)}; });
  const microRows=micro.map(x=>row(x.l,`${x.v<10?x.v.toFixed(1):Math.round(x.v)} / ${x.t} ${x.u}`,x.pct,x.pct>=90?'var(--pro)':x.pct>=50?'var(--carb)':'var(--accent)')).join('');
  const lowest=micro.filter(x=>x.pct<90).sort((a,b)=>a.pct-b.pct).slice(0,3).map(x=>x.l);
  const freq={}, empty=[];
  DAYS.forEach((dn,d)=>MEAL_SLOTS.forEach(s=>{ const m=mealFor(d,s,pid); if(!m) empty.push(dn+' '+s); else if(!m.leftover) freq[m.rid]=(freq[m.rid]||0)+1; }));
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const acct = Sync.user
    ? `<div class="acct"><div><b>${esc(Sync.person?Sync.person.label:Sync.user.email)}</b><small>${esc(Sync.user.email)} · ${SYNC_LABEL[Sync.status]}</small></div><button class="btn-ghost" data-signout>Sign out</button></div>${Sync.status==='denied'?'<p class="pf-note warn">This Google account isn’t on the family list, so nothing syncs.</p>':''}`
    : `<div class="acct"><div><b>Not signed in</b><small>Changes save on this phone only</small></div><button class="btn-solid" data-signin>Sign in with Google</button></div>`;
  $('#drawerBody').innerHTML=`
    <div class="d-ctx">${personal?`${pp.label}’s view`:'Profile'} · week of ${dayDate(0)}</div>
    <h2 class="d-name">${pp.label}'s dashboard</h2>
    ${acct}
    ${personal?`<div class="pview-row">Personal view — only ${pp.label}’s portions. <button class="btn-ghost" data-familyview>Family view</button></div>`:''}
    <div class="pf-people" ${personal?'hidden':''}>${PEOPLE.map(p=>`<button class="pf-person ${p.id===pid?'active':''}" style="--pc:${p.hex}" data-pfp="${p.id}" aria-pressed="${p.id===pid}"><b>${p.label}</b><small>${p.note} · ${p.target.toLocaleString()}</small></button>`).join('')}</div>
    <div class="seg pf-tabs" role="tablist"><button role="tab" data-ptab="tracker" class="${profTab==='tracker'?'active':''}" aria-selected="${profTab==='tracker'}">Tracker</button><button role="tab" data-ptab="week" class="${profTab==='week'?'active':''}" aria-selected="${profTab==='week'}">This week’s plan</button></div>
    ${profTab==='tracker' ? trackerHTML(pid) : `
    <div class="d-sec"><h3>Targets <small>${esc(pp.goal)}</small></h3><div class="pf-kpis four">
      ${kpi('BMI',pp.bmi,'',pp.bmi>=25?'overweight range':pp.bmi<18.5?'underweight range':'healthy range')}
      ${kpi('BMR',pp.bmr.toLocaleString(),'kcal','at complete rest')}
      ${kpi('Maintenance',pp.tdee.toLocaleString(),'kcal',`${pp.act===1.375?'light':'moderate'} activity`)}
      ${kpi('Daily target',pp.target.toLocaleString(),'kcal',`${pp.adj>0?'+':''}${pp.adj} for the goal · ${pp.protein}g P`)}
    </div><p class="pf-note">${pp.age} y · ${pp.kg} kg · ${Math.floor(pp.cm/30.48)}′${Math.round((pp.cm/2.54)%12)}″ · Mifflin-St Jeor (the calculator.net default). Every day includes the morning seed water and ${esc(rec(FIXED.shake[pid]).name)}.</p></div>
    <div class="d-sec"><h3>This week <small>daily average</small></h3><div class="pf-kpis">
      ${kpi('Calories',A.kcal.toLocaleString(),'kcal',`${delta>0?'+':''}${delta} vs target`,deltaCls)}
      ${kpi('Protein',A.p,'g',`${Math.round(A.p/g.p*100)}% of ${g.p}g goal`,A.p>=g.p*.9?'good':'warn')}
      ${kpi('Days on target',onTgt,'/ 7','calories within ±10%')}
      ${kpi('Protein days',pHit,'/ 7','reached ≥90% of goal')}</div></div>
    <div class="d-sec"><h3>Calories by day <small>tap a bar to open that day</small></h3>
      <div class="wk">${bars}<div class="wk-target" style="bottom:${(pp.target/max*100).toFixed(1)}%"></div></div>
      <div class="wk-lbls">${DAYS.map((dn,d)=>`<span class="${d===TODAY_IDX?'t':''}">${dn}</span>`).join('')}</div>
      <p class="pf-note">Dashed line marks the ${pp.target.toLocaleString()} kcal target.</p></div>
    <div class="d-sec"><h3>Macros <small>avg per day vs goal</small></h3><div class="pf-split">${macroBar(A)}</div>
      <div class="macro-key"><span><i style="background:var(--pro)"></i>Protein ${share(pk)}%</span><span><i style="background:var(--carb)"></i>Carbs ${share(ck)}%</span><span><i style="background:var(--fat)"></i>Fat ${share(fk)}%</span></div>
      ${macroRows}</div>
    <div class="d-sec"><h3>Micronutrients <small>estimated · avg per day</small></h3>${microRows}
      <p class="pf-note">${lowest.length?`Below 90% this week: <b>${lowest.join(', ')}</b>. `:'Every tracked micronutrient is at 90% or more. '}Calculated from each ingredient’s USDA/IFCT values — estimates, not lab data.</p></div>
    <div class="d-sec"><h3>The plan <small>${21-empty.length} of 21 meals planned</small></h3>
      <div class="sh-lbl">Most repeated</div><ul class="pf-list">${top.map(([rid,n])=>`<li><span>${esc(rec(rid).name)}</span><span>×${n}</span></li>`).join('')||'<li><span>Nothing planned yet</span><span></span></li>'}</ul>
      <div class="sh-lbl">Open meals</div><p class="pf-note" style="margin:0">${empty.length?esc(empty.join(' · ')):'Every meal has something planned.'}</p></div>`}
    <div class="d-sec"><h3>Settings</h3>
      <div class="pf-set links"><span>Personal links<small class="pf-sub">Opens straight into one person’s view</small></span><div class="link-list">${PEOPLE.map(p=>`<button class="btn-ghost" data-copylink="${p.id}">${p.label}’s link</button>`).join('')}</div></div>
      <div class="pf-set"><span>Grocery stores<small class="pf-sub">${state.stores.map(x=>esc(x.name)).join(' · ')}</small></span><button class="btn-ghost" data-gmanage>Manage</button></div>
      <div class="pf-set"><span>Weekly snack box for</span><div class="seg">${PEOPLE.map(p=>`<button data-snackeater="${p.id}" class="${state.snack.eaters.includes(p.id)?'active':''}">${p.label}</button>`).join('')}</div></div>
      <div class="pf-set"><span>Units</span><div class="seg">${[['us','US · oz'],['metric','Metric · g']].map(([u,l])=>`<button data-pfu="${u}" class="${u===units?'active':''}">${l}</button>`).join('')}</div></div></div>`;
  drawerView={t:'profile'};
  openShell(keep);
}

/* ================= render all ================= */
function renderPview(){
  const html = personal ? `<span><b>${esc(personById(personal).label)}’s view</b> · only ${esc(personById(personal).label)}’s portions</span><button class="btn-ghost" data-familyview>Family view</button>` : '';
  $('#pviewD').innerHTML=html; $('#pviewM').innerHTML=html;
}
function renderEverything(){
  renderPview(); renderSeg(); renderUnits(); renderSync(); renderCal(); renderQueue(); renderLib(); renderMobile();
  if(drawerView && drawerView.t!=='form') refreshDrawer();
  if(sheetState){ if(sheetState.t==='place') renderPlacePicker(); else renderSlotList(); }
}
function setPerson(id){ selPerson=id; store.set('mp_person',id); renderEverything(); }

/* ================= events ================= */
$('#seg').addEventListener('click',e=>{ const b=e.target.closest('[data-p]'); if(b) setPerson(b.dataset.p); });
$('#unitseg').addEventListener('click',e=>{ const b=e.target.closest('[data-u]'); if(!b) return; units=b.dataset.u; store.set('mp_units',units); renderEverything(); });
$('#filters').addEventListener('click',e=>{ const b=e.target.closest('[data-f]'); if(!b) return; filter=b.dataset.f; renderFilters(); renderLib(); });
$('#cuisines').addEventListener('click',e=>{ const b=e.target.closest('[data-cu]'); if(!b) return; cuisine=b.dataset.cu; renderFilters(); renderEverything(); });
$('#search').addEventListener('input',e=>{ query=e.target.value; renderLib(); renderMobile(); });
$('#syncBox').addEventListener('click',e=>{ if(e.target.closest('[data-signin]')) Sync.signIn(); if(e.target.closest('[data-signout]')) Sync.signOut(); });
$('#dashBtn').addEventListener('click',()=>openProfile());
$('#lib').addEventListener('click',e=>{
  const a=e.target.closest('[data-addq]'); if(a) return toggleQueue(a.dataset.addq);
  const card=e.target.closest('.rc[data-rid]'); if(card) openDrawer(card.dataset.rid,null);
});
$('#qstrip').addEventListener('click',e=>{
  const rm=e.target.closest('[data-deq]'); if(rm){ state.queue.splice(+rm.dataset.deq,1); armed=null; return commit(); }
  const chip=e.target.closest('.q-chip'); if(!chip) return;
  const rid=chip.dataset.rid, qi=+chip.dataset.qi;
  armed=(armed&&armed.rid===rid&&armed.qi===qi)?null:{rid,qi};
  renderQueue(); renderCal(); if(armed) toast('Now click a meal to place it');
});
$('#cal').addEventListener('click',e=>{
  const q=s=>e.target.closest(s); let b;
  if(b=q('[data-lock]')){ const c=parseCtx(b.dataset.lock); return toggleLock(c.d,c.slot); }
  if(b=q('[data-remove]')){ const c=parseCtx(b.dataset.remove); return removeMealView(c.d,c.slot); }
  if(b=q('[data-uselo]')) return useLeftovers(+b.dataset.uselo);
  const cell=q('[data-drop]');
  if(cell && armed){ const c=parseCtx(cell.dataset.drop); return setMealView(c.d,c.slot,armed.rid); }
  if(b=q('[data-open]')) return openDrawer(b.dataset.open,b.dataset.ctx);
  if(cell) return openSlotPicker(cell.dataset.drop);
});
let dragRid=null;
document.addEventListener('dragstart',e=>{ const src=e.target.closest('[data-rid]'); if(!src) return; dragRid=src.dataset.rid; e.dataTransfer.setData('text/plain',dragRid); e.dataTransfer.effectAllowed='copy'; });
document.addEventListener('dragover',e=>{ const cell=e.target.closest('[data-drop]'); if(!cell) return; e.preventDefault(); e.dataTransfer.dropEffect='copy'; cell.classList.add('drop-hover'); });
document.addEventListener('dragleave',e=>{ const cell=e.target.closest('[data-drop]'); if(cell) cell.classList.remove('drop-hover'); });
document.addEventListener('drop',e=>{ const cell=e.target.closest('[data-drop]'); if(!cell) return; e.preventDefault(); cell.classList.remove('drop-hover');
  const rid=e.dataTransfer.getData('text/plain')||dragRid; if(!rid) return; const c=parseCtx(cell.dataset.drop); setMealView(c.d,c.slot,rid); dragRid=null; });
$('#drawerX').addEventListener('click',closeDrawer);
$('#scrim').addEventListener('click',closeDrawer);
$('#drawerBody').addEventListener('click',e=>{
  const q=s=>e.target.closest(s); let b;
  if(b=q('[data-dswap]')) return openSlotPicker(b.dataset.dswap);
  if(b=q('[data-dlock]')){ const c=parseCtx(b.dataset.dlock); return toggleLock(c.d,c.slot); }
  if(b=q('[data-dremove]')){ const c=parseCtx(b.dataset.dremove); closeDrawer(); return removeMealView(c.d,c.slot); }
  if(b=q('[data-dq]')) return toggleQueue(b.dataset.dq);
  if(b=q('[data-dplan]')) return openPlacePicker(b.dataset.dplan);
  if(b=q('[data-pfp]')) return setPerson(b.dataset.pfp);
  if(b=q('[data-pfday]')){ mDay=+b.dataset.pfday; closeDrawer(); if(isMobile()) setTab('today'); else jumpTo(mDay+'|dinner'); return; }
  if(b=q('[data-pfu]')){ units=b.dataset.pfu; store.set('mp_units',units); return renderEverything(); }
  if(q('[data-signin]')) return Sync.signIn();
  if(q('[data-signout]')) return Sync.signOut();
  if(b=q('[data-jump]')) return jumpTo(b.dataset.jump);
  if(onGroceryClick(e)) return renderEverything();
});
$('#drawerBody').addEventListener('change',e=>{ if(onGroceryChange(e)) renderEverything(); });
document.addEventListener('click',e=>{
  let b;
  if(e.target.closest('[data-familyview]')){ history.replaceState(null,'',location.pathname+location.search); readHash(); ingMode=null; renderEverything(); return toast('Family view'); }
  if(b=e.target.closest('[data-copylink]')){ const url=personalLink(b.dataset.copylink);
    try{ navigator.clipboard.writeText(url).then(()=>toast('Link copied — '+url.split('//')[1]),()=>toast(url)); }catch(err){ toast(url); } return; }
  if(b=e.target.closest('[data-ingmode]')){ ingMode=b.dataset.ingmode; return refreshDrawer(); }
});
window.addEventListener('hashchange',()=>{ readHash(); ingMode=null; renderEverything(); });

// mobile
$('#mApp').addEventListener('click',e=>{
  const q=s=>e.target.closest(s); let b;
  if(b=q('[data-tab]')) return setTab(b.dataset.tab);
  if(b=q('[data-goto]')) return setTab(b.dataset.goto);
  if(b=q('[data-mp]')) return setPerson(b.dataset.mp);
  if(q('#mProfile')) return openProfile();
  if(b=q('[data-mf]')){ filter=b.dataset.mf; renderFilters(); return renderEverything(); }
  if(b=q('[data-cu]')){ cuisine=b.dataset.cu; renderFilters(); return renderEverything(); }
  if(b=q('[data-mq]')) return toggleQueue(b.dataset.mq);
  if(b=q('[data-plan]')) return openPlacePicker(b.dataset.plan);
  if(b=q('[data-mswap]')) return openSlotPicker(b.dataset.mswap);
  if(b=q('[data-mlock]')){ const c=parseCtx(b.dataset.mlock); return toggleLock(c.d,c.slot); }
  if(b=q('[data-mremove]')){ const c=parseCtx(b.dataset.mremove); return removeMealView(c.d,c.slot); }
  if(b=q('[data-uselo]')) return useLeftovers(+b.dataset.uselo);
  if(b=q('[data-slot]')) return openSlotPicker(b.dataset.slot);
  if(b=q('[data-open]')) return openDrawer(b.dataset.open,b.dataset.ctx||null);
  if(b=q('[data-day]')){ const nd=+b.dataset.day; if(nd===mDay) return; const dir=nd>mDay?1:-1; mDay=nd; return renderMToday(dir); }
  if(b=q('[data-step]')){ const st=+b.dataset.step; mDay=(mDay+st+7)%7; return renderMToday(st); }
  if(b=q('#mReset')){
    if(!b.dataset.armed){ b.dataset.armed='1'; b.textContent='Tap again to reset the week'; setTimeout(()=>{ if(b.isConnected){ delete b.dataset.armed; b.textContent='↺ Reset week to plan'; } },3000); return; }
    return resetPlan();
  }
  if(b=q('[data-jump]')) return jumpTo(b.dataset.jump);
  if(b=q('[data-mdeq]')){ state.queue.splice(+b.dataset.mdeq,1); return commit(); }
  if(q('#mNewRecipe')) return openAddForm();
  if(onGroceryClick(e)) return renderEverything();
});
$('#mApp').addEventListener('change',e=>{ if(onGroceryChange(e)) renderEverything(); });
$('#mSearch').addEventListener('input',e=>{ query=e.target.value; $('#search').value=query; renderLib(); renderMDiscover(); });
(()=>{ let sx=0,sy=0,st=0; const el=$('#mToday');
  el.addEventListener('touchstart',e=>{ const t=e.touches[0]; sx=t.clientX; sy=t.clientY; st=Date.now(); },{passive:true});
  el.addEventListener('touchend',e=>{ const t=e.changedTouches[0], dx=t.clientX-sx, dy=t.clientY-sy;
    if(Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.6 && Date.now()-st<700){ const dir=dx<0?1:-1; mDay=(mDay+dir+7)%7; renderMToday(dir); } },{passive:true});
})();
$('#sheet').addEventListener('click',e=>{
  const q=s=>e.target.closest(s); let b;
  if(q('#sheetX')) return closeSheet();
  if(!sheetState) return;
  if(b=q('[data-pd]')){ sheetState.d=+b.dataset.pd; return renderPlacePicker(); }
  if(b=q('[data-pm]')){ sheetState.m=b.dataset.pm; return renderPlacePicker(); }
  if(b=q('[data-pfar]')){ const rid=sheetState.rid; closeSheet(); return setMealView(FARALI.day,b.dataset.pfar,rid,FARALI.pid); }
  if(q('#shConfirm')){ const {rid,d,m}=sheetState; closeSheet(); return setMealView(d,m,rid); }
  if(b=q('[data-pick]')){ const {d,slot,far}=sheetState; closeSheet(); return setMealView(d,slot,b.dataset.pick, far?FARALI.pid:selPerson); }
});
$('#sheet').addEventListener('input',e=>{ if(e.target.id==='shSearch'&&sheetState){ sheetState.q=e.target.value; renderSlotList(); } });
$('#sheetScrim').addEventListener('click',closeSheet);
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape') return;
  if($('#sheet').classList.contains('open')) return closeSheet();
  if($('#drawer').classList.contains('open')) return closeDrawer();
  if(armed){ armed=null; renderQueue(); renderCal(); }
});
$('#reset').addEventListener('click',()=>{ if(confirm('Reset the whole week back to the starter plan?')) resetPlan(); });
$('#newRecipe').addEventListener('click',openAddForm);
$('#grocery').addEventListener('click',()=>openGrocery());

/* ================= init ================= */
let lastAuthKey=null;
Sync.onChange(s=>{
  const k=s.user?s.user.uid:null;
  if(k!==lastAuthKey){ lastAuthKey=k; if(s.person && !personal) { selPerson=s.person.id; store.set('mp_person',selPerson); } }
  renderEverything();
});
renderFilters(); renderEverything();
Sync.init();

/* ================= generate + status sheets ================= */
function openGenerateSheet(){
  sheetState={t:'gen'};
  const restOk=TODAY_IDX<6;
  const q=state.queue.length;
  openSheet(`Week of ${dayDate(0)}`,'Generate the plan',`
    <p class="m-sub">${q?`<b>${q} queued recipe${q>1?'s':''}</b> go in first. `:''}Then the library fills the gaps: 1–2 chicken nights (never Thu/Sat), reheatable Sun–Thu dinners for leftover lunches, Aum’s farali Thursday, no recipe more than twice, and a weekly snack box. Locked meals stay put.</p>
    <div class="gen-opts">
      ${restOk?`<button class="gen-opt" data-genmode="rest"><b>Rest of this week</b><small>${FULLDAY[TODAY_IDX+1]} → Sunday · keeps today and earlier</small></button>`:''}
      <button class="gen-opt" data-genmode="week"><b>Whole week</b><small>Mon ${dayDate(0).split(' ')[1]} → Sun ${dayDate(6).split(' ')[1]} · new snack box</small></button>
      <button class="gen-opt" data-genmode="next"><b>Start next week now</b><small>Archives this week; Sunday’s dinner becomes Monday’s lunch. Happens automatically Sunday 9 pm.</small></button>
    </div>`);
}
function openStatusSheet(key){
  const {d,slot}=parseCtx(key);
  const eaters = slot==='snack' ? state.snack.eaters.slice() : (slot==='drink'||slot==='shake') ? PEOPLE.map(p=>p.id) : PEOPLE.map(p=>p.id).filter(pid=>mealFor(d,slot,pid));
  sheetState={t:'status',d,slot,who:new Set([eaters.includes(selPerson)?selPerson:eaters[0]]),eaters};
  renderStatusSheet();
}
function renderStatusSheet(){
  const s=sheetState, who=[...s.who], cur=who.length===1?statusOf(s.d,s.slot,who[0]):null;
  const est=v=>who.length?outEstimate(s.d,s.slot,who[0],v):0;
  openSheet(`${FULLDAY[s.d]} · ${SLOT_LABEL[s.slot]}`,'How did this meal go?',`
    <div class="sh-lbl">Who</div>
    <div class="opt-grid who">${s.eaters.map(pid=>`<button class="opt ${s.who.has(pid)?'active':''}" data-swho="${pid}" aria-pressed="${s.who.has(pid)}">${personById(pid).label}</button>`).join('')}</div>
    <div class="sh-lbl">Status</div>
    <div class="gen-opts">
      <button class="gen-opt ${!cur?'on':''}" data-sset=""><b>Eaten as planned</b><small>Counts the planned portion</small></button>
      <button class="gen-opt ${cur==='skip'?'on':''}" data-sset="skip"><b>Skipped</b><small>Counts 0 kcal; left out of the cooking batch and grocery list</small></button>
      ${OUT_OPTS.map(([v,l])=>`<button class="gen-opt ${cur===v?'on':''}" data-sset="${v}"><b>Ate out / ordered in · ${l.toLowerCase()}</b><small>Counts ~${est(v)} kcal${who.length>1?' each':''} (estimate)</small></button>`).join('')}
    </div>`);
}
$('#sheet').addEventListener('click',e=>{
  const q=s=>e.target.closest(s); let b;
  if(!sheetState) return;
  if(sheetState.t==='gen' && (b=q('[data-genmode]'))){ const m=b.dataset.genmode; closeSheet(); return runGenerate(m); }
  if(sheetState.t==='status'){
    if(b=q('[data-swho]')){ const id=b.dataset.swho; if(sheetState.who.has(id)&&sheetState.who.size>1) sheetState.who.delete(id); else sheetState.who.add(id); return renderStatusSheet(); }
    if(b=q('[data-sset]')){ const {d,slot,who}=sheetState; closeSheet(); return applyStatus(d,slot,[...who],b.dataset.sset||null); }
  }
});
document.addEventListener('click',e=>{
  const g=e.target.closest('[data-gen]'); if(g){ e.preventDefault(); openGenerateSheet(); return; }
  const st=e.target.closest('[data-mstatus],[data-dstatus]'); if(st){ openStatusSheet(st.dataset.mstatus||st.dataset.dstatus); return; }
  const se=e.target.closest('[data-snackeater]'); if(se){ const id=se.dataset.snackeater, ea=state.snack.eaters;
    if(ea.includes(id)){ if(ea.length>1) state.snack.eaters=ea.filter(x=>x!==id); else return toast('At least one person needs the snack box'); } else ea.push(id);
    return commit(); }
});
// weekly refresh: run once the shared plan is loaded (or we know we're local-only), and keep checking while open
let rolledChecked=false;
function maybeRollover(){
  if(rolledChecked) return; rolledChecked=true;
  const sum=rolloverIfNeeded();
  TODAY_IDX=todayIndex(); mDay=TODAY_IDX;
  if(sum){ saveState(); toast(`New week planned · ${sum.placed} meals${sum.fromQueue?` · ${sum.fromQueue} from your queue`:''}`); }
  renderEverything();
}
Sync.onChange(s=>{ if(['synced','local','denied','error','offline'].includes(s.status)) maybeRollover(); });
setInterval(()=>{ if(activeWeekStart()>state.weekStart){ rolledChecked=false; maybeRollover(); } else if(todayIndex()!==TODAY_IDX){ TODAY_IDX=todayIndex(); renderEverything(); } }, 10*60*1000);

// local-only visitors (or Firebase unavailable): don't wait for a sync that will never come
setTimeout(()=>{ if(!Sync.user) maybeRollover(); },3000);
