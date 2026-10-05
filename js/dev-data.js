/* DEV ONLY — worst-case data for stress-testing the UI (break-ui skill).
   Loaded by a tiny loader in index.html, and only on localhost when the URL has ?data=demo|worst|empty|one|huge.
   Everything here is in-memory: nothing is saved to localStorage and nothing syncs, so the real plan can't be touched.
   Values are plausible user input (custom recipes, store names, a typo'd calorie count) — the app has no length limits. */
(()=>{
  const mode=new URLSearchParams(location.search).get('data')||'demo';

  /* ---- never persist or sync while stress data is on ---- */
  store.set=()=>{};
  saveState=()=>{};
  Sync.init=()=>{};

  const custom=(id,name,over)=>Object.assign({id:'cust_'+id,name,cat:'main',cuisine:'',upgrade:'',tags:[],
    per:{kcal:520,p:28,c:60,f:16},serveText:'1 bowl',ingText:['100 g dal','1 onion'],method:['Cook it.'],swaps:[],leftover:true,farali:false},over||{});

  const LONG='Grandma Wiśniewska-Kowalczyk’s Sunday Slow-Cooked Dal Makhani with Smoked Paneer & Pickled Onions (double batch)';
  const WORST=[
    custom('w1',LONG,{cuisine:'North Indian (Punjabi-style, restaurant)',per:{kcal:1240,p:62,c:140,f:48},
      upgrade:'Smoked paneer adds slow-release casein protein and the lentils cover fibre, iron and folate, so this one meal carries most of the day’s micronutrients for the whole family.',
      serveText:'1 big bowl · 200 g dal makhani · 150 g smoked paneer · 2 rotis · 1 tbsp pickled onions · small salad',
      ingText:['200 g whole black lentils (soaked overnight)','150 g smoked paneer, cubed','2 tbsp cultured butter','1 tsp kasuri methi','1 tbsp pickled red onions, drained','2 rotis, to serve']}),
    custom('w2','Ä',{cat:'breakfast',cuisine:'',upgrade:'',serveText:'',per:{kcal:380,p:22,c:40,f:12}}),                                   // one-letter, non-ASCII, everything optional left empty
    custom('w3','Dal + Brown Rice + Curd + Papad + Pickle + Salad + Buttermilk',{cuisine:'Gujarati'}),                                           // seven components -> six side chips
    custom('w4','Mom’s <b>Spicy</b> Chana & "Rice" 100% **v2** <script>alert(1)</script>',{cuisine:'Punjabi'}),                                   // escaping
    custom('w5','दाल मखनी चिल्ला 🍛',{cat:'breakfast',cuisine:'हिन्दी · Hindi'}),                                                                  // non-Latin + emoji
    custom('w6','Paneer-Butter-Masala-Cheesecake-Stuffed-Parathas-Supreme',{cuisine:'Fusion'}),                                                  // long unbreakable token
    custom('w7','Pesarattu',{cuisine:'Andhra',per:{kcal:12480,p:999,c:80,f:20}}),                                                               // "12480" typed instead of "480"
    custom('w8','Overnight Oats',{cat:'breakfast',cuisine:'Make-ahead'}),                                                                         // duplicates a library name
  ];
  const STORES=['Trader Joe’s – Union Square (the one near the farmers market)','Patel Brothers','H Mart','Whole Foods Market – 365 Fulton Street','Costco Business Center Wholesale Warehouse','Aldi','Local Farmers Market (Saturdays only)'];

  function fresh(){ const st=normalize({}); st.weekStart=activeWeekStart(); return st; }

  if(mode==='worst'){
    state.custom=WORST; mountCustoms();
    state.plan[0].dinner='cust_w1'; state.plan[0].breakfast='cust_w2';
    state.plan[1].breakfast='cust_w5'; state.plan[1].dinner='cust_w3';
    state.plan[2].dinner='cust_w4'; state.plan[2].breakfast='cust_w8';
    state.plan[3].dinner='cust_w6'; state.plan[4].dinner='cust_w7';
    state.queue=['cust_w1','cust_w3','cust_w4','cust_w6','cust_w7','dalrice','chole','pavbhaji','pizza','subway','khichdi','misal'];   // 12 -> two-digit badge
    state.stores[0].name=STORES[0]; STORES.slice(1).forEach(addStore);
    state.changes=[{id:'c1',at:Date.now()-90e6,d:0,slot:'dinner',from:'dalrice',to:'cust_w1',by:'Aleksandra Wiśniewska-Kowalczyk'},
                   {id:'c2',at:Date.now()-40e6,d:1,slot:'dinner',from:'cust_w3',to:'cust_w4',by:'Dvija'}];
    state.weekStart=activeWeekStart();
  }
  if(mode==='empty'){ state=fresh(); state.snack.rid=null; state.farali={lunch:null,dinner:null}; state.prevSunDinner=null; mountCustoms(); }
  if(mode==='one'){ state=fresh(); state.snack.rid=null; state.farali={lunch:null,dinner:null}; state.plan[0].dinner='dalrice'; state.queue=['chilla']; state.stores=[state.stores[0]]; mountCustoms(); }
  if(mode==='huge'){
    const adj=['Smoky','Creamy','Spicy','Crispy','Slow-cooked','Lemony','Herbed','Roasted'], dish=['Chana Masala','Paneer Tikka Bowl','Moong Dal Khichdi','Veg Biryani','Palak Tofu','Mushroom Pulao','Rajma Chawal','Oats Upma'];
    state.custom=Array.from({length:1000},(_,i)=>custom('h'+i,`${adj[i%8]} ${dish[(i*3)%8]} ${i+1}`,{cuisine:['Gujarati','Punjabi','Fusion','South Indian'][i%4]}));
    mountCustoms(); state.queue=state.custom.slice(0,150).map(c=>c.id);
  }

  /* ---- the toggle: plain chrome, bottom-centre, instant, no animation ---- */
  const css=document.createElement('style');
  css.textContent='#devData{position:fixed;left:50%;bottom:10px;transform:translateX(-50%);z-index:9999;display:flex;gap:2px;padding:3px;background:#c9c9cd;border-radius:999px;font:12px/1 system-ui,sans-serif;box-shadow:0 1px 6px rgba(0,0,0,.35)}'
    +'#devData a{padding:7px 10px;border-radius:999px;color:#222;text-decoration:none;white-space:nowrap}#devData a.on{background:#fff;font-weight:600}'
    +'@media (max-width:760px){#devData{bottom:calc(92px + env(safe-area-inset-bottom))}}';
  document.head.appendChild(css);
  const bar=document.createElement('div'); bar.id='devData'; bar.setAttribute('aria-label','Data set (dev only)');
  bar.innerHTML=[['demo','Demo data'],['worst','Worst case'],['empty','Empty'],['one','One'],['huge','1,000']]
    .map(([m,l])=>`<a href="?data=${m}${location.hash}" class="${m===mode?'on':''}">${l}</a>`).join('');
  document.body.appendChild(bar);
})();
