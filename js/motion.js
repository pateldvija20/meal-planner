/* Motion toolkit — transforms/opacity only, content is always visible if animation never runs,
   everything collapses to instant when the user prefers reduced motion. */
const Motion = (()=>{
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = ()=>mq.matches;
  const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
  const last = {};                                   // last indicator positions, keyed by name

  // count a number up/down inside an element
  function countUp(el, to, from, {dur=320, fmt=v=>Math.round(v).toLocaleString()}={}){
    if(!el) return;
    if(reduced() || from==null || from===to){ el.textContent=fmt(to); return; }
    const t0=performance.now();
    const step=now=>{
      const k=Math.min(1,(now-t0)/dur), e=1-Math.pow(1-k,3);
      el.textContent=fmt(from+(to-from)*e);
      if(k<1) requestAnimationFrame(step);
    };
    el.textContent=fmt(from); requestAnimationFrame(step);
  }
  // staggered entrance for freshly rendered items
  function enter(nodes, {y=8, stagger=28, dur=280, max=18}={}){
    if(!nodes) return;
    const calm=reduced();                               // reduced motion: no travel, no stagger — a short fade only
    const list=[...nodes].slice(0,max), gap=Math.min(stagger,260/Math.max(1,list.length));   // whole cascade stays inside ~260ms
    stagger=gap;
    list.forEach((n,i)=>{
      if(!n.animate) return;
      n.animate(calm?[{opacity:0},{opacity:1}]:[{opacity:0,transform:`translateY(${y}px)`},{opacity:1,transform:'none'}],
        {duration:calm?160:dur,delay:calm?0:i*stagger,easing:calm?'ease':EASE_OUT,fill:'backwards'});
    });
  }
  function pop(el){
    if(!el||reduced()||!el.animate) return;
    el.animate([{transform:'scale(1)'},{transform:'scale(1.12)'},{transform:'scale(1)'}],{duration:220,easing:EASE_OUT});
  }
  // a dot flies from a button to a target (e.g. the Queue tab) along a gentle arc
  function flyTo(fromEl, toEl, done){
    if(!fromEl||!toEl||reduced()){ done&&done(); return; }
    const a=fromEl.getBoundingClientRect?fromEl.getBoundingClientRect():fromEl, b=toEl.getBoundingClientRect();
    if(!b.width){ done&&done(); return; }
    const x0=a.left+a.width/2, y0=a.top+a.height/2, x1=b.left+b.width/2, y1=b.top+b.height/2;
    const dot=document.createElement('div'); dot.className='fly-dot'; dot.style.left=x0+'px'; dot.style.top=y0+'px';
    document.body.appendChild(dot);
    const dx=x1-x0, dy=y1-y0, lift=Math.min(160,Math.abs(dx)*0.4+60);
    const anim=dot.animate([
      {transform:'translate(0,0) scale(1)',opacity:1},
      {transform:`translate(${dx*0.5}px,${dy*0.5-lift}px) scale(1.15)`,opacity:1,offset:.5},
      {transform:`translate(${dx}px,${dy}px) scale(.5)`,opacity:.2}
    ],{duration:460,easing:'cubic-bezier(.77,0,.175,1)'});
    let finished=false; const end=()=>{ if(finished) return; finished=true; dot.remove(); pop(toEl); done&&done(); };
    anim.onfinish=end; setTimeout(end,560);        // background tabs can delay onfinish — never leave a dot behind
  }
  // sliding indicator inside a grid of equal-width buttons
  function slide(name, container, cls, index, count){
    if(!container) return;
    let ind=container.querySelector('.'+cls);
    if(!ind){ ind=document.createElement('span'); ind.className=cls; ind.setAttribute('aria-hidden','true'); container.prepend(ind); }
    const pos=i=>`translateX(calc(${i} * (100% + var(--gap,4px))))`;
    const prev=last[name];
    if(prev==null || prev===index || reduced()){ ind.style.transition='none'; ind.style.transform=pos(index); requestAnimationFrame(()=>ind.style.transition=''); }
    else { ind.style.transition='none'; ind.style.transform=pos(prev); ind.getBoundingClientRect(); ind.style.transition=''; ind.style.transform=pos(index); }
    last[name]=index;
  }
  // clip-path indicator: --i is the active index; the previous index is applied first so the rebuilt layer animates from where it was
  function clip(name, el, index){
    if(!el) return;
    const prev=last[name];
    el.style.transition='none';
    if(prev==null || prev===index || reduced()){ el.style.setProperty('--i',index); el.getBoundingClientRect(); }
    else { el.style.setProperty('--i',prev); el.getBoundingClientRect(); el.style.transition=''; el.style.setProperty('--i',index); }
    if(prev==null || prev===index || reduced()) el.style.transition='';
    last[name]=index;
  }
  // wrap a DOM update in a view transition when supported
  function transition(update, kind='theme'){            // kind 'tab' (frequent, short) or 'theme' (rare)
    if(reduced() || !document.startViewTransition){ update(); return; }
    const root=document.documentElement; root.dataset.vt=kind;
    try{
      const vt=document.startViewTransition(update);
      [vt.ready,vt.updateCallbackDone].forEach(p=>p&&p.catch(()=>{}));               // an aborted transition is harmless
      Promise.resolve(vt.finished).catch(()=>{}).then(()=>{ delete root.dataset.vt; });
    }catch(e){ delete root.dataset.vt; update(); }
  }
  // draw the day dial's arcs in, one after another
  function drawDial(svg){
    if(!svg||reduced()) return;
    svg.querySelectorAll('.dial-seg').forEach((c,i)=>{
      const len=parseFloat(c.style.getPropertyValue('--len')), C=parseFloat(c.style.getPropertyValue('--C'));
      if(!c.animate||!len) return;
      c.animate([{strokeDasharray:`0 ${C}`},{strokeDasharray:`${len} ${C-len}`}],{duration:460,delay:80+i*55,easing:EASE_OUT,fill:'backwards'});
    });
    svg.querySelectorAll('.dial-mark').forEach((g,i)=>g.animate&&g.animate([{opacity:0,transform:g.getAttribute('transform')+' scale(.4)'},{opacity:1,transform:g.getAttribute('transform')+' scale(1)'}],{duration:280,delay:260+i*55,easing:EASE_OUT,fill:'backwards'}));
  }
  /* ---------- physics (apple-design): springs that inherit velocity, momentum projection, rubber-banding ---------- */
  // Apple's response/damping spring in closed form. Critically damped (1) by default: no overshoot unless a flick carried momentum.
  function spring({from=0,to=0,velocity=0,response=.34,damping=1,rest=.35,onUpdate,onDone}={}){
    if(reduced()){ onUpdate&&onUpdate(to); onDone&&onDone(); return {cancel(){}}; }
    const w=2*Math.PI/response, x0=from-to, wd=damping<1?w*Math.sqrt(1-damping*damping):0;
    const at=t=> damping>=1 ? (x0+(velocity+w*x0)*t)*Math.exp(-w*t)
                            : Math.exp(-damping*w*t)*(x0*Math.cos(wd*t)+((velocity+damping*w*x0)/wd)*Math.sin(wd*t));
    let raf=0, t0=0, prev=x0, prevT=0, dead=false;
    const step=now=>{
      if(dead) return;
      if(!t0) t0=now;
      const t=Math.min((now-t0)/1000,2), x=at(t), v=t>prevT?(x-prev)/(t-prevT):0;
      onUpdate&&onUpdate(to+x);
      prev=x; prevT=t;
      if(t>=2 || (t>.05 && Math.abs(x)<rest && Math.abs(v)<rest*8)){ onUpdate&&onUpdate(to); dead=true; onDone&&onDone(); return; }
      raf=requestAnimationFrame(step);
    };
    raf=requestAnimationFrame(step);
    return {cancel(){ dead=true; cancelAnimationFrame(raf); }};
  }
  // where a flick will come to rest (exponential deceleration, as in UIScrollView): velocity in px/s
  const project=(v,rate=.998)=>(v/1000)*rate/(1-rate);
  // progressive resistance past an edge: the further you drag, the less it follows
  const rubber=(over,dim,c=.55)=>(over*dim*c)/(dim+c*Math.abs(over));

  /* Drag a panel away along one axis (sheet: +y, mobile drawer: +x).
     1:1 tracking with pointer capture, velocity from the last few samples, projection decides commit vs. return,
     the release spring inherits that velocity, and grabbing it mid-flight takes over from where it is on screen. */
  function dragDismiss(el,{axis='y',handle=()=>true,ignore='',touchOnly=false,reverse=false,scrim=null,onDismiss}){
    const A=axis==='y'?'clientY':'clientX', other=axis==='y'?'clientX':'clientY';
    let id=null, start=0, startOther=0, base=0, offset=0, samples=[], size=1, locked=false, anim=null;
    const apply=v=>{ offset=v; el.style.transform=axis==='y'?`translate3d(0,${v}px,0)`:`translate3d(${v}px,0,0)`;
      if(scrim) scrim.style.opacity=String(Math.max(0,1-Math.max(0,v)/size)); };
    const clear=()=>{ el.style.transition='none'; el.style.transform=''; if(scrim){ scrim.style.transition='none'; scrim.style.opacity=''; }
      requestAnimationFrame(()=>requestAnimationFrame(()=>{ el.style.transition=''; if(scrim) scrim.style.transition=''; })); };
    el.addEventListener('pointerdown',e=>{
      if(e.button>0 || id!==null) return;                                   // one finger only — extra touches are ignored
      if(touchOnly && e.pointerType==='mouse') return;
      if(!handle(e.target) || (ignore && e.target.closest(ignore))) return;
      if(anim){ anim.cancel(); anim=null; base=offset; }                    // interrupt: continue from the live position
      else base=0;
      id=e.pointerId; start=e[A]; startOther=e[other]; locked=false;
      size=axis==='y'?el.offsetHeight:el.offsetWidth; samples=[{t:e.timeStamp,v:e[A]}];
      if(base) { locked=true; try{ el.setPointerCapture(id); }catch(_){} el.style.transition='none'; }
    });
    el.addEventListener('pointermove',e=>{
      if(e.pointerId!==id) return;
      const d=e[A]-start, o=e[other]-startOther;
      if(!locked){                                                          // small movement threshold, then commit to a direction
        if(Math.abs(d)<8 && Math.abs(o)<8) return;
        if(Math.abs(o)>Math.abs(d)*1.2 || (d<0 && !reverse)){ id=null; return; }          // not ours (wrong axis / wrong way) — let the page have it
        locked=true; try{ el.setPointerCapture(e.pointerId); }catch(_){}
        el.style.transition='none'; if(scrim) scrim.style.transition='none';
      }
      samples.push({t:e.timeStamp,v:e[A]}); if(samples.length>6) samples.shift();
      const v=base+d; apply(v<0?-rubber(-v,size):v);
      e.preventDefault();
    });
    const release=e=>{
      if(e.pointerId!==id) return; id=null;
      if(!locked) return;
      try{ el.releasePointerCapture(e.pointerId); }catch(_){}
      const a=samples[0], b=samples[samples.length-1];
      const vel=b.t>a.t ? (b.v-a.v)/((b.t-a.t)/1000) : 0;                  // px/s along the axis
      const rest=offset+project(vel);                                       // where it would land if left alone
      const flick = vel>=110 && offset>=24;                                // ~0.11 px/ms: a flick dismisses whatever the distance
      const dismiss = e.type!=='pointercancel' && vel>-250 && (rest>size*.5 || flick);
      const target=dismiss?size+24:0;
      anim=spring({from:offset,to:target,velocity:vel,response:dismiss?.3:.38,damping:dismiss?1:.82,
        onUpdate:apply,
        onDone:()=>{ anim=null; if(dismiss){ clear(); onDismiss&&onDismiss(); } else clear(); }});
    };
    el.addEventListener('pointerup',release); el.addEventListener('pointercancel',release);
  }
  return {reduced, countUp, enter, pop, flyTo, slide, clip, transition, drawDial, spring, project, rubber, dragDismiss};
})();

