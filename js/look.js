/* Visual language helpers: theme, category colours, recipe emoji, dial / segmented bar / sparkline. */

/* ---------- theme (per phone): 'system' | 'light' | 'dark' ---------- */
const Theme = {
  get(){ try{ return JSON.parse(localStorage.getItem('mp_theme')) || 'system'; }catch(e){ return 'system'; } },
  set(t){ try{ localStorage.setItem('mp_theme', JSON.stringify(t)); }catch(e){} this.apply(); },
  effective(){ const t=this.get(); return t==='system' ? (matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light') : t; },
  apply(){
    const t=this.get(), root=document.documentElement;
    if(t==='system') delete root.dataset.theme; else root.dataset.theme=t;
    // one theme-color per scheme (matches the page's top colour); a forced theme overrides both so the status bar can't disagree
    const C={light:'#EDEDEC',dark:'#0C0C0D'};
    document.querySelectorAll('meta[name="theme-color"]').forEach(m=>{ m.content = C[t==='system' ? m.dataset.scheme : t]; });
  },
  toggle(){ this.set(this.effective()==='dark'?'light':'dark'); },
};
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>Motion.transition(()=>{ Theme.apply(); if(typeof renderEverything==='function') renderEverything(); }));

/* ---------- colour per meal slot / recipe category ---------- */
const SLOT_COLOR = {drink:'var(--c-drink)', breakfast:'var(--c-breakfast)', shake:'var(--c-shake)', lunch:'var(--c-lunch)', snack:'var(--c-snack)', dinner:'var(--c-dinner)'};
const CAT_COLOR  = {breakfast:'var(--c-breakfast)', main:'var(--c-dinner)', snack:'var(--c-snack)', drink:'var(--c-drink)', shake:'var(--c-shake)'};

/* ---------- emoji as icons ---------- */
const EMOJI = {
  mdrink:'🍋', shake_lite:'🥤', shake_gain:'🥤',
  chilla:'🥞', eggsando:'🥪', poha:'🍚', oats:'🥣', pancake:'🥞', dosa:'🫓', paratha:'🫓', avotoast:'🥑', parfait:'🍨', rajgira:'🫓',
  dalrice:'🍛', chole:'🫘', rajma:'🫘', palak:'🥬', mattar:'🫛', pinkpasta:'🍝', friedrice:'🍚', khichdi:'🥣', mexican:'🌮', misal:'🌶️',
  makhni:'🍛', pavbhaji:'🍞', pizza:'🍕', subway:'🥖', sabudana:'🥔', samo:'🌾',
  idli:'🍲', pesarattu:'🫓', ragidosa:'🫓', daliyaupma:'🥣', uttapam:'🥞', adai:'🫓', appe:'🧆', ragiporridge:'🥣', thepla:'🫓',
  khaman:'🥮', handvo:'🥧', muthiya:'🥬', dhebra:'🫓', usal:'🌱', paneerbhurji:'🧀', sattuparatha:'🫓', omelette:'🍳', andabhurji:'🍳',
  besanchilla:'🥞', masalaoats:'🥣', quinoaupma:'🥣', kuttuchilla:'🥞',
  sambarrice:'🍲', bisibele:'🍲', lemonrice:'🍋', avial:'🥥', kootu:'🥥', curdrice:'🍚', chettinad:'🍗', keralastew:'🥥',
  daldhokli:'🍲', undhiyu:'🥘', ringanolo:'🍆', magrotla:'🫘', dalbhaat:'🍛', daltadka:'🍛', kadhipakora:'🍲', sarson:'🥬',
  aloogobi:'🥔', matarmushroom:'🍄', butterchicken:'🍗', tikkamasala:'🍢', saagchicken:'🥬', laukidal:'🥒', soyacurry:'🫘',
  bharta:'🍆', masoorveg:'🥕', lobia:'🫘', kalachanacurry:'🫘', kadai:'🫑', biryani:'🍚', keema:'🌶️', eggcurry:'🥚', dalpalak:'🥬',
  quinoabowl:'🥗', hakka:'🍜', kathiroll:'🌯', shakarkand:'🍠', singhara:'🫓', faraliBhurji:'🧀',
  makhana:'🍿', seedcookie:'🍪', brownie:'🍫', tiramisu:'☕', bananaloaf:'🍌', proteinballs:'🍡', trailmix:'🥜', khakhra:'🍘',
};
const AISLE_EMOJI = {'Proteins & dairy':'🥛','Produce':'🥦','Grains & legumes':'🌾','Nuts, seeds & spreads':'🥜','Pantry & supplements':'🧂','Other':'🛒'};
const emojiOf = r => (r && (EMOJI[r.id] || r.emoji)) || (r && r.cat==='breakfast' ? '🍳' : r && r.cat==='snack' ? '🍪' : '🍛');

/* ---------- data visuals ---------- */
// segmented bar: n blocks, filled by ratio (over target shows the overflow in the warn colour)
function segBar(ratio, color, n=12){
  const f=Math.min(n, Math.round(Math.max(0,ratio)*n)), over=ratio>1.05;
  let h='<span class="segbar" role="img" aria-label="'+Math.round(ratio*100)+'% of target">';
  for(let i=0;i<n;i++) h+=`<i style="${i<f?`background:${over&&i===n-1?'var(--warn)':color}`:''}"></i>`;
  return h+'</span>';
}
// radial day dial: one arc per meal (sized by kcal) around a ring that represents the day's target
function dialSVG(parts, target){
  const R=84, C=2*Math.PI*R, total=parts.reduce((a,p)=>a+p.kcal,0), scale=Math.max(target,total)||1, GAP=5;
  let start=0, arcs='', marks='';
  parts.forEach((p,i)=>{
    const len=p.kcal/scale*C; if(len<2){ start+=len; return; }
    const draw=Math.max(1,len-GAP-14);                      // round caps add ~stroke width
    arcs+=`<circle class="dial-seg" data-i="${i}" r="${R}" cx="100" cy="100" stroke="${p.color}" stroke-dasharray="${draw.toFixed(1)} ${(C-draw).toFixed(1)}" stroke-dashoffset="${(-(start+GAP/2+7)).toFixed(1)}" style="--len:${draw.toFixed(1)};--C:${C.toFixed(1)}"/>`;
    if(len>26){ const a=(start+len/2)/C*2*Math.PI-Math.PI/2, x=100+R*Math.cos(a), y=100+R*Math.sin(a);
      marks+=`<g class="dial-mark" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="12.5"/><text dy="1" text-anchor="middle" dominant-baseline="middle">${p.emoji}</text></g>`; }
    start+=len;
  });
  // target tick (only visible when over target)
  const tick = total>target ? (()=>{ const a=target/scale*2*Math.PI-Math.PI/2; return `<line class="dial-target" x1="${100+70*Math.cos(a)}" y1="${100+70*Math.sin(a)}" x2="${100+98*Math.cos(a)}" y2="${100+98*Math.sin(a)}"/>`; })() : '';
  return `<svg class="dial" viewBox="0 0 200 200" aria-hidden="true"><circle class="dial-track" r="${R}" cx="100" cy="100"/>${arcs}${tick}${marks}</svg>`;
}
// small sparkline with area fill and emphasized endpoint
function sparkline(vals, {w=240,h=56,color='var(--accent)'}={}){
  const v=vals.filter(x=>x!=null); if(v.length<2) return '';
  const mn=Math.min(...v), mx=Math.max(...v), rng=(mx-mn)||1, P=6;
  const pts=vals.map((x,i)=>x==null?null:[P+i*(w-2*P)/(vals.length-1), h-P-(x-mn)/rng*(h-2*P)]).filter(Boolean);
  const line=pts.map(p=>p.map(n=>n.toFixed(1)).join(',')).join(' '), last=pts[pts.length-1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polygon points="${pts[0][0]},${h} ${line} ${last[0]},${h}" fill="${color}" opacity=".14"/><polyline points="${line}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/><circle cx="${last[0]}" cy="${last[1]}" r="3.6" fill="${color}"/></svg>`;
}
// tick-ruler slider (1..5 or any range) — a range input over a row of ticks
function tickRuler(field, value, {min=1,max=5,step=1,labels=[],disabled=false}={}){
  const n=Math.round((max-min)/step), ticks=Array.from({length:n*4+1},(_,i)=>`<i class="${i%4===0?'major':''}"></i>`).join('');
  const v=value??null, lab = v==null ? 'Slide to set' : (labels[Math.round((v-min)/step)] || v);
  return `<div class="ruler ${v==null?'unset':''}"><div class="ruler-ticks" aria-hidden="true">${ticks}</div>
    <input type="range" min="${min}" max="${max}" step="${step}" value="${v??(min+max)/2}" data-ruler="${field}" ${disabled?'disabled':''} aria-label="${field}" aria-valuetext="${lab}">
    <output>${lab}</output></div>`;
}
const FOOD_EMOJI = {
  egg:'🥚',eggwhite:'🥚',milk:'🥛',curd:'🥣',greek:'🥣',chaas:'🥛',paneer:'🧀',feta:'🧀',mozzarella:'🧀',butter:'🧈',ghee:'🧈',tofu:'🧊',chicken:'🍗',whey:'🥤',collagen:'🥤',creatine:'🥤',
  onion:'🧅',tomato:'🍅',spinach:'🥬',methi:'🥬',sarson:'🥬',cucumber:'🥒',lauki:'🥒',potato:'🥔',sweetpotato:'🍠',cauliflower:'🥦',broccoli:'🥦',capsicum:'🫑',mushroom:'🍄',carrot:'🥕',
  peas:'🫛',corn:'🌽',berries:'🫐',avocado:'🥑',banana:'🍌',lemon:'🍋',baingan:'🍆',bhindi:'🥒',cabbage:'🥬',beans:'🫛',coconut:'🥥',coconutmilk:'🥥',sprouts:'🌱',mixveg:'🥗',
  brownrice:'🍚',poha:'🍚',oats:'🌾',daliya:'🌾',quinoa:'🌾',atta:'🌾',bread:'🍞',pav:'🍞',subroll:'🥖',pizzabase:'🍕',tortilla:'🫓',pasta:'🍝',noodles:'🍜',dosabatter:'🫓',sabudana:'⚪',
  peanuts:'🥜',pb:'🥜',almondbutter:'🌰',walnut:'🌰',cashew:'🌰',almondflour:'🌰',chia:'🌱',flax:'🌱',basil:'🌱',pumpkinseed:'🌱',sunflower:'🌻',makhana:'🍿',
  oil:'🫒',olives:'🫒',honey:'🍯',passata:'🍅',cocoa:'🍫',darkchoc:'🍫',monkfruit:'🍬',
};
