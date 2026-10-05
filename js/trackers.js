/* ================= personal trackers =================
   trackers/{dvija|akshar|aum}   — family can read, only the owner writes (firestore.rules)
   private/{email}/cycle/main    — Dvija's cycle log, readable by Dvija only
   Signed out → kept in this browser only. */
const TRK_LOCAL='mp_trk', CYC_LOCAL='mp_cycle';
let TRK = store.get(TRK_LOCAL) || {};
let CYCLE = store.get(CYC_LOCAL) || {periods:[]};
let trkDate = isoDate(new Date());
let profTab = store.get('mp_proftab') || 'tracker';
const WORKOUT_GOAL={m3:[2,3], m1:[4,5], m2:[4,5]};
const pkey=pid=>personById(pid).key;
function trk(pid){
  const k=pkey(pid); const t=TRK[k]=TRK[k]||{};
  t.weights=Array.isArray(t.weights)?t.weights:[]; t.days=t.days||{};
  return t;
}
const canEdit=pid=>!Sync.user || (!!Sync.person && Sync.person.id===pid);
const canSeeCycle=pid=> pid==='m3' && (!Sync.user || (!!Sync.person && Sync.person.id==='m3'));
function saveTrk(pid){ store.set(TRK_LOCAL,TRK); TrackerSync.push(pid); }
function saveCycle(){ CYCLE.periods.sort((a,b)=>a.start<b.start?-1:1); store.set(CYC_LOCAL,CYCLE); TrackerSync.pushCycle(); }

const TrackerSync={
  unsubs:[], uid:null,
  start(){
    this.stop(); this.uid=Sync.user?Sync.user.uid:null;
    if(!Sync.user||!Sync.person||!window.firebase) return;
    const db=firebase.firestore();
    PEOPLE.forEach(p=>{
      this.unsubs.push(db.doc('trackers/'+p.key).onSnapshot(snap=>{
        if(snap.metadata.hasPendingWrites) return;
        if(snap.exists){ TRK[p.key]=snap.data(); store.set(TRK_LOCAL,TRK); }
        else if(Sync.person.id===p.id){ const t=trk(p.id); if(t.weights.length||Object.keys(t.days).length) this.push(p.id); }
        refreshTracker();
      }, err=>console.warn('tracker',p.key,err.code)));
    });
    if(Sync.person.id==='m3'){
      this.unsubs.push(db.doc(`private/${Sync.user.email}/cycle/main`).onSnapshot(snap=>{
        if(snap.metadata.hasPendingWrites) return;
        if(snap.exists){ CYCLE=Object.assign({periods:[]},snap.data()); store.set(CYC_LOCAL,CYCLE); }
        else if(CYCLE.periods.length) this.pushCycle();
        refreshTracker();
      }, err=>console.warn('cycle',err.code)));
    }
  },
  stop(){ this.unsubs.forEach(u=>u()); this.unsubs=[]; },
  push(pid){
    if(!Sync.user||!Sync.person||Sync.person.id!==pid) return;
    firebase.firestore().doc('trackers/'+pkey(pid)).set(JSON.parse(JSON.stringify(trk(pid))))
      .catch(e=>toast(e.code==='permission-denied'?'Tracker can’t sync yet — the database rules aren’t published':'Tracker didn’t save — try again'));
  },
  pushCycle(){
    if(!Sync.user||!Sync.person||Sync.person.id!=='m3') return;
    firebase.firestore().doc(`private/${Sync.user.email}/cycle/main`).set(JSON.parse(JSON.stringify(CYCLE)))
      .catch(()=>toast('Cycle log didn’t save — try again'));
  },
};
Sync.onChange(s=>{ const uid=s.user?s.user.uid:null; if(uid!==TrackerSync.uid) TrackerSync.start(); });
function refreshTracker(){ if(drawerView&&drawerView.t==='profile') openProfile(true); }

/* ---------- units ---------- */
const kgShow=kg=>units==='us'?(kg*2.20462).toFixed(1):(+kg).toFixed(1);
const kgUnit=()=>units==='us'?'lb':'kg';
const cmShow=cm=>units==='us'?(cm/2.54).toFixed(1):(+cm).toFixed(1);
const cmUnit=()=>units==='us'?'in':'cm';
const toKg=v=>units==='us'?v/2.20462:v;
const toCm=v=>units==='us'?v*2.54:v;
const shortDate=iso=>{ const [y,m,d]=iso.split('-').map(Number); return `${MONTHS[m-1]} ${d}`; };
const daysBetween=(a,b)=>Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5);
const weekdayName=iso=>FULLDAY[(new Date(iso+'T12:00').getDay()+6)%7];

/* ---------- cycle maths ---------- */
function cycleStats(){
  const ps=CYCLE.periods.filter(p=>p.start).sort((a,b)=>a.start<b.start?-1:1);
  const lens=[]; for(let i=1;i<ps.length;i++) lens.push(daysBetween(ps[i-1].start,ps[i].start));
  const recent=lens.slice(-6), avg=recent.length?Math.round(recent.reduce((a,b)=>a+b,0)/recent.length):null;
  const spread=recent.length>1?Math.max(...recent)-Math.min(...recent):null;
  const last=ps[ps.length-1]||null, today=isoDate(new Date());
  const cycleDay=last?daysBetween(last.start,today)+1:null;
  const next=last&&avg?addDaysIso(last.start,avg):null;
  const open=last&&!last.end&&!last.closed;
  return {ps,lens,recent,avg,spread,last,cycleDay,next,open};
}

/* ---------- render ---------- */
function weightChart(ws){
  const pts=ws.slice(-12); if(pts.length<2) return '';
  const W=300,H=90,P=8, vals=pts.map(w=>+kgShow(w.kg)), mn=Math.min(...vals), mx=Math.max(...vals), rng=(mx-mn)||1;
  const x=i=>P+i*(W-2*P)/(pts.length-1), y=v=>H-P-(v-mn)/rng*(H-2*P-14);
  const line=vals.map((v,i)=>`${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area=`${x(0)},${H-P} ${line} ${x(vals.length-1)},${H-P}`;
  const lx=x(vals.length-1), ly=y(vals[vals.length-1]);
  return `<svg class="wchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Weight trend, last ${pts.length} entries">
    <line x1="${P}" x2="${W-P}" y1="${H-P}" y2="${H-P}" stroke="var(--line-2)"/>
    <polygon points="${area}" fill="var(--sel)" opacity=".12"/>
    <polyline points="${line}" fill="none" stroke="var(--sel)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${lx}" cy="${ly}" r="4" fill="var(--sel)"/>
    <text x="${P}" y="11" class="wc-t">${mx} ${kgUnit()}</text><text x="${P}" y="${H-P-3}" class="wc-t">${mn}</text>
    <text x="${Math.min(lx,W-40)}" y="${Math.max(ly-8,11)}" class="wc-t b">${vals[vals.length-1]}</text></svg>`;
}
function scaleBtns(field,val,labels){
  return `<div class="scale">${[1,2,3,4,5].map(n=>`<button data-tset="${field}|${n}" class="${val===n?'on':''}" aria-pressed="${val===n}" title="${labels[n-1]}">${n}</button>`).join('')}</div><small class="scale-l">${val?labels[val-1]:'tap to rate'}</small>`;
}
function trackerHTML(pid){
  const pp=personById(pid), t=trk(pid), ed=canEdit(pid), day=t.days[trkDate]||{}, today=isoDate(new Date());
  const ro=ed?'':`<p class="pf-note warn">You’re viewing ${pp.label}’s tracker — only ${pp.label} can edit it.</p>`;
  // which planned week day is trkDate?
  const di=daysBetween(state.weekStart,trkDate), inWeek=di>=0&&di<=6;
  const meals=inWeek?SLOTS.map(s=>{ const m=mealFor(di,s.id,pid); if(!m) return ''; const st=statusOf(di,s.id,pid);
      return `<button class="tmeal ${st?(st==='skip'?'skip':'out'):'ok'}" ${ed||!Sync.user?`data-mstatus="${di}|${s.id}"`:'disabled'}><span>${s.label}</span><b>${st?esc(statusLabel(st)):'✓ eaten'}</b></button>`; }).join('')
    : '<p class="pf-note">Meals are tracked for the current plan week.</p>';
  const dis=ed?'':'disabled';
  // week summary (plan week)
  const wdates=DAYS.map((_,d)=>addDaysIso(state.weekStart,d)).filter(x=>x<=today);
  const wd=wdates.map(x=>t.days[x]||{});
  const avg=k=>{ const v=wd.map(o=>o[k]).filter(x=>x!=null); return v.length?(v.reduce((a,b)=>a+b,0)/v.length):null; };
  const workouts=wd.filter(o=>o.workout===true).length, goal=WORKOUT_GOAL[pid];
  let planned=0,asPlanned=0; wdates.forEach(x=>{ const d=daysBetween(state.weekStart,x); MEAL_SLOTS.concat(['snack']).forEach(s=>{ if(mealFor(d,s,pid)){ planned++; if(!statusOf(d,s,pid)) asPlanned++; } }); });
  // weight
  const ws=t.weights.slice().sort((a,b)=>a.date<b.date?-1:1), lastW=ws[ws.length-1], firstW=ws[0];
  const diff=lastW&&firstW&&ws.length>1?(+kgShow(lastW.kg))-(+kgShow(firstW.kg)):null;
  const goodDir=pp.note==='losing'?diff<0:diff>0;
  const suggest=lastW && Math.abs(lastW.kg-pp.kg)>=1 && ed ? `<div class="t-suggest">Your calorie target uses ${kgShow(pp.kg)} ${kgUnit()}. <button class="btn-ghost" data-tuse="${lastW.kg}">Use ${kgShow(lastW.kg)} ${kgUnit()} for my targets</button></div>`:'';
  const prevDate=addDaysIso(trkDate,-1), nextDate=addDaysIso(trkDate,1);
  // cycle
  let cyc='';
  if(canSeeCycle(pid)){
    const c=cycleStats();
    const irregular = c.avg && (c.avg>35 || c.avg<21 || (c.spread!=null && c.spread>7));
    cyc=`<div class="d-sec"><h3>Cycle <small>private · only you can see this</small></h3>
      <div class="t-card">
        ${c.last?`<div class="cyc-now"><div><span class="big">Day ${c.cycleDay}</span><small>${c.open?'period in progress':'of this cycle'} · started ${shortDate(c.last.start)}</small></div>
          ${c.next?`<div class="cyc-next"><small>Next expected</small><b>${shortDate(c.next)}</b><small>±${Math.max(3,Math.ceil((c.spread||6)/2))} days</small></div>`:''}</div>`
          :'<p class="pf-note" style="margin:0">Log the first day of your next period to start tracking cycle length.</p>'}
        <div class="cyc-actions">
          <label class="t-field"><span>Date</span><input type="date" id="cycDate" value="${today}" max="${today}"></label>
          <button class="btn-solid" data-cyc="start">Period started</button>
          ${c.open?`<button class="btn-ghost" data-cyc="end">Period ended</button>`:''}
        </div>
        ${c.recent.length?`<div class="cyc-stats"><div><b>${c.avg}</b><small>avg cycle (days)</small></div><div><b>${c.spread??'—'}</b><small>variation (days)</small></div><div><b>${c.ps.length}</b><small>periods logged</small></div></div>`:''}
        ${irregular?`<p class="pf-note warn">Your recent cycles are ${c.avg>35?'longer than 35 days':c.avg<21?'shorter than 21 days':'varying by more than a week'} — worth mentioning at your next check-up.</p>`:''}
        ${c.ps.length?`<ul class="pf-list">${c.ps.slice(-6).reverse().map((p,i,arr)=>{ const nextP=c.ps[c.ps.indexOf(p)+1]; const len=nextP?daysBetween(p.start,nextP.start):null;
          return `<li><span>${shortDate(p.start)}${p.end?' – '+shortDate(p.end):''}${p.end?` <small>(${daysBetween(p.start,p.end)+1}-day period)</small>`:''}</span><span>${len?len+'-day cycle':'current'} <button class="link-x" data-cycdel="${p.start}" aria-label="Delete this entry">×</button></span></li>`; }).join('')}</ul>`:''}
      </div></div>`;
  }
  return `${ro}
    <div class="d-sec"><h3>Daily check-in <small>${weekdayName(trkDate)}</small></h3>
      <div class="t-card">
        <div class="t-daynav"><button class="m-ic" data-tday="${prevDate}" aria-label="Previous day">‹</button><b>${trkDate===today?'Today · ':''}${shortDate(trkDate)}</b><button class="m-ic" data-tday="${nextDate}" ${nextDate>today?'disabled':''} aria-label="Next day">›</button></div>
        <div class="t-row"><span>Workout</span><div class="seg"><button data-tset="workout|1" class="${day.workout===true?'active':''}" ${dis}>Done</button><button data-tset="workout|0" class="${day.workout===false?'active':''}" ${dis}>Rest day</button></div></div>
        <div class="t-row"><span>Mood</span>${scaleBtns('mood',day.mood,['Low','Meh','Okay','Good','Great'])}</div>
        <div class="t-row"><span>Energy</span>${scaleBtns('energy',day.energy,['Drained','Low','Steady','Good','Buzzing'])}</div>
        <div class="t-row"><span>Sleep</span><div class="stepper"><button data-tsleep="-0.5" ${dis} aria-label="Less sleep">−</button><b>${day.sleep!=null?day.sleep+' h':'—'}</b><button data-tsleep="0.5" ${dis} aria-label="More sleep">+</button></div></div>
        <div class="t-meals"><span class="sh-lbl">Meals</span>${meals}</div>
      </div></div>
    <div class="d-sec"><h3>Weight & waist <small>${ws.length?`${ws.length} entries`:'log weekly, same time of day'}</small></h3>
      <div class="t-card" style="--sel:${pp.hex}">
        ${lastW?`<div class="w-now"><div><span class="big">${kgShow(lastW.kg)}</span> ${kgUnit()}<small>${shortDate(lastW.date)}${lastW.waist?` · waist ${cmShow(lastW.waist)} ${cmUnit()}`:''}</small></div>${diff!=null?`<div class="w-diff ${goodDir?'good':'warn'}">${diff>0?'+':''}${diff.toFixed(1)} ${kgUnit()}<small>since ${shortDate(firstW.date)}</small></div>`:''}</div>${weightChart(ws)}`:''}
        ${ed?`<div class="w-form"><label class="t-field"><span>Weight (${kgUnit()})</span><input type="number" step="0.1" id="wKg" inputmode="decimal" placeholder="${kgShow(pp.kg)}"></label><label class="t-field"><span>Waist (${cmUnit()}) · optional</span><input type="number" step="0.1" id="wWaist" inputmode="decimal"></label><button class="btn-solid" data-wlog>Log</button></div>`:''}
        ${suggest}
        ${ws.length?`<details class="w-hist"><summary>All entries</summary><ul class="pf-list">${ws.slice().reverse().map(w=>`<li><span>${shortDate(w.date)}</span><span>${kgShow(w.kg)} ${kgUnit()}${w.waist?` · ${cmShow(w.waist)} ${cmUnit()}`:''}${ed?` <button class="link-x" data-wdel="${w.date}" aria-label="Delete entry">×</button>`:''}</span></li>`).join('')}</ul></details>`:''}
      </div></div>
    <div class="d-sec"><h3>This week so far <small>${shortDate(state.weekStart)} – ${shortDate(addDaysIso(state.weekStart,6))}</small></h3>
      <div class="pf-kpis">
        <div class="kpi"><div class="k">Workouts</div><div class="v">${workouts}<small>/ ${goal[0]}–${goal[1]}</small></div><div class="s ${workouts>=goal[0]?'good':''}">${workouts>=goal[0]?'on track':'goal this week'}</div></div>
        <div class="kpi"><div class="k">Meals as planned</div><div class="v">${planned?Math.round(asPlanned/planned*100):0}<small>%</small></div><div class="s">${asPlanned} of ${planned} so far</div></div>
        <div class="kpi"><div class="k">Mood · energy</div><div class="v">${avg('mood')?avg('mood').toFixed(1):'—'}<small>· ${avg('energy')?avg('energy').toFixed(1):'—'}</small></div><div class="s">average out of 5</div></div>
        <div class="kpi"><div class="k">Sleep</div><div class="v">${avg('sleep')?avg('sleep').toFixed(1):'—'}<small>h</small></div><div class="s">average a night</div></div>
      </div></div>
    ${cyc}`;
}

/* ---------- events (inside the drawer) ---------- */
$('#drawerBody').addEventListener('click',e=>{
  if(!drawerView||drawerView.t!=='profile') return;
  const q=s=>e.target.closest(s); let b;
  const pid=selPerson, t=trk(pid);
  if(b=q('[data-ptab]')){ profTab=b.dataset.ptab; store.set('mp_proftab',profTab); return openProfile(true); }
  if(b=q('[data-tday]')){ trkDate=b.dataset.tday; return openProfile(true); }
  if(!canEdit(pid) && q('[data-tset],[data-tsleep],[data-wlog],[data-wdel],[data-tuse]')) return toast(`Only ${personById(pid).label} can edit this tracker`);
  const day=()=>t.days[trkDate]=t.days[trkDate]||{};
  if(b=q('[data-tset]')){ const [f,v]=b.dataset.tset.split('|'); const d=day();
    if(f==='workout') d.workout = d.workout===(v==='1') ? null : v==='1';
    else d[f] = d[f]===+v ? null : +v;
    Object.keys(d).forEach(k=>{ if(d[k]==null) delete d[k]; }); if(!Object.keys(d).length) delete t.days[trkDate];
    saveTrk(pid); return openProfile(true); }
  if(b=q('[data-tsleep]')){ const d=day(); d.sleep=Math.max(0,Math.min(14,(d.sleep??7)+ +b.dataset.tsleep)); saveTrk(pid); return openProfile(true); }
  if(q('[data-wlog]')){
    const v=parseFloat($('#wKg').value), w=parseFloat($('#wWaist').value);
    if(!(v>0)) { toast('Enter your weight first'); $('#wKg').focus(); return; }
    const kg=+toKg(v).toFixed(2); if(kg<30||kg>250){ toast('That weight looks off — check the units'); return; }
    const today=isoDate(new Date()); t.weights=t.weights.filter(x=>x.date!==today);
    t.weights.push(Object.assign({date:today,kg}, w>0?{waist:+toCm(w).toFixed(1)}:{}));
    saveTrk(pid); toast('Weight logged'); return openProfile(true); }
  if(b=q('[data-wdel]')){ t.weights=t.weights.filter(x=>x.date!==b.dataset.wdel); saveTrk(pid); return openProfile(true); }
  if(b=q('[data-tuse]')){ state.profile[pid]={kg:+b.dataset.tuse}; applyProfiles(); commit(); return toast(`Targets updated — ${personById(pid).label} is now ${personById(pid).target.toLocaleString()} kcal/day`); }
  if(b=q('[data-cyc]')){
    if(!canSeeCycle(pid)) return;
    const date=($('#cycDate')&&$('#cycDate').value)||isoDate(new Date()), c=cycleStats();
    if(b.dataset.cyc==='start'){
      if(c.open && daysBetween(c.last.start,date)<10) return toast('A period is already in progress — tap “Period ended” first');
      if(CYCLE.periods.some(p=>p.start===date)) return toast('Already logged for that date');
      if(c.open) c.last.closed=true;            // previous end wasn't logged — close it without inventing a date
      CYCLE.periods.push({start:date}); saveCycle(); toast('Period start logged');
    } else {
      if(!c.open) return; if(date<c.last.start) return toast('End date is before the start date');
      c.last.end=date; saveCycle(); toast('Period end logged');
    }
    return openProfile(true);
  }
  if(b=q('[data-cycdel]')){ CYCLE.periods=CYCLE.periods.filter(p=>p.start!==b.dataset.cycdel); saveCycle(); return openProfile(true); }
});
