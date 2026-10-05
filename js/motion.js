/* Motion toolkit — transforms/opacity only, content is always visible if animation never runs,
   everything collapses to instant when the user prefers reduced motion. */
const Motion = (()=>{
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = ()=>mq.matches;
  const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
  const last = {};                                   // last indicator positions, keyed by name

  // count a number up/down inside an element
  function countUp(el, to, from, {dur=520, fmt=v=>Math.round(v).toLocaleString()}={}){
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
  function enter(nodes, {y=10, stagger=28, dur=360, max=18}={}){
    if(reduced()||!nodes) return;
    [...nodes].slice(0,max).forEach((n,i)=>{
      if(!n.animate) return;
      n.animate([{opacity:0,transform:`translateY(${y}px)`},{opacity:1,transform:'none'}],
        {duration:dur,delay:i*stagger,easing:EASE_OUT,fill:'backwards'});
    });
  }
  function pop(el){
    if(!el||reduced()||!el.animate) return;
    el.animate([{transform:'scale(1)'},{transform:'scale(1.16)'},{transform:'scale(1)'}],{duration:360,easing:EASE_OUT});
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
    ],{duration:620,easing:'cubic-bezier(.45,0,.2,1)'});
    let finished=false; const end=()=>{ if(finished) return; finished=true; dot.remove(); pop(toEl); done&&done(); };
    anim.onfinish=end; setTimeout(end,700);        // background tabs can delay onfinish — never leave a dot behind
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
  // wrap a DOM update in a view transition when supported
  function transition(update){
    if(reduced() || !document.startViewTransition){ update(); return; }
    try{
      const vt=document.startViewTransition(update);
      [vt.ready,vt.finished,vt.updateCallbackDone].forEach(p=>p&&p.catch(()=>{}));   // an aborted transition is harmless
    }catch(e){ update(); }
  }
  // draw the day dial's arcs in, one after another
  function drawDial(svg){
    if(!svg||reduced()) return;
    svg.querySelectorAll('.dial-seg').forEach((c,i)=>{
      const len=parseFloat(c.style.getPropertyValue('--len')), C=parseFloat(c.style.getPropertyValue('--C'));
      if(!c.animate||!len) return;
      c.animate([{strokeDasharray:`0 ${C}`},{strokeDasharray:`${len} ${C-len}`}],{duration:620,delay:120+i*90,easing:EASE_OUT,fill:'backwards'});
    });
    svg.querySelectorAll('.dial-mark').forEach((g,i)=>g.animate&&g.animate([{opacity:0,transform:g.getAttribute('transform')+' scale(.4)'},{opacity:1,transform:g.getAttribute('transform')+' scale(1)'}],{duration:420,delay:420+i*90,easing:EASE_OUT,fill:'backwards'}));
  }
  return {reduced, countUp, enter, pop, flyTo, slide, transition, drawDial};
})();

