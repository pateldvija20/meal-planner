/* The day's plate — a stainless thali with a protein / carbs / fat ring.
   Motion explains change: when the day or person changes, the ring segments spring to their
   new energy share and the plate turns a little; it tilts gently under the pointer.
   Renders only while something is moving; pauses off-screen; static when reduced motion is on.
   Falls back to the CSS ring (.plate-fallback) if WebGL or the module is unavailable. */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#888';

let renderer, scene, camera, plateGroup, segs = [], canvas, host = null, running = false, visible = true;
const GAP = 0.09;                                  // radians between segments
const sp = { cur:[1/3,1/3,1/3], vel:[0,0,0], tgt:[1/3,1/3,1/3] };   // spring state for shares
const tilt = { x:0, y:0, tx:0, ty:0 };
let spin = 0, spinV = 0, lastT = 0, built = [null,null,null];

function init(){
  canvas = document.createElement('canvas');
  try{
    renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:true, powerPreference:'low-power' });
  }catch(e){ return false; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 2.95, 2.2); camera.lookAt(0, -0.05, 0);
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 4, 3); scene.add(key);

  plateGroup = new THREE.Group(); scene.add(plateGroup);
  const steel = new THREE.MeshStandardMaterial({ color:0xd7dcd9, metalness:0.92, roughness:0.28 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 0.94, 0.05, 96), steel); plateGroup.add(base);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.035, 18, 160), steel); rim.rotation.x = Math.PI/2; rim.position.y = 0.03; plateGroup.add(rim);
  const katori = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.30, 0.09, 64), new THREE.MeshStandardMaterial({ color:0xe6eae8, metalness:0.85, roughness:0.22 }));
  katori.position.y = 0.065; plateGroup.add(katori);

  const colors = ['--pro','--carb','--fat'].map(v => new THREE.Color(css(v)));
  segs = colors.map(c => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color:c, roughness:0.5, metalness:0 }));
    m.rotation.x = Math.PI/2; m.position.y = 0.07; plateGroup.add(m); return m;
  });
  // keep segment colours in step with light/dark theme
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    ['--pro','--carb','--fat'].forEach((v,i) => segs[i].material.color.set(css(v))); kick();
  });

  canvas.addEventListener('pointermove', e => {
    if(reduced()) return;
    const r = canvas.getBoundingClientRect();
    tilt.tx = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
    tilt.ty = ((e.clientX - r.left) / r.width - 0.5) * 0.45;
    kick();
  });
  canvas.addEventListener('pointerleave', () => { tilt.tx = 0; tilt.ty = 0; kick(); });
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if(visible) kick(); }).observe(canvas);
  return true;
}

// rebuild a segment's arc only when its length really changed
function setArc(i, start, len){
  const L = Math.max(0.02, len);
  if(built[i] === null || Math.abs(built[i] - L) > 0.004){
    segs[i].geometry.dispose();
    segs[i].geometry = new THREE.TorusGeometry(0.66, 0.12, 18, Math.max(6, Math.round(64 * L / (Math.PI*2))), L);
    built[i] = L;
  }
  segs[i].rotation.z = start;
}
function layout(){
  const total = Math.PI*2 - GAP*3;
  let a = -Math.PI/2 + spin;
  sp.cur.forEach((s,i) => { const len = Math.max(0, s) * total; setArc(i, a, len); a += len + GAP; });
  plateGroup.rotation.x = tilt.x; plateGroup.rotation.z = -tilt.y;
}
function frame(t){
  if(!running) return;
  const dt = Math.min(0.033, (t - (lastT || t)) / 1000) || 0.016; lastT = t;
  let moving = false;
  // spring the shares (stiffness 140, damping 22 → settles quickly, no wobble)
  for(let i=0;i<3;i++){
    const f = (sp.tgt[i] - sp.cur[i]) * 140 - sp.vel[i] * 22;
    sp.vel[i] += f * dt; sp.cur[i] += sp.vel[i] * dt;
    if(Math.abs(sp.tgt[i]-sp.cur[i]) > 0.0008 || Math.abs(sp.vel[i]) > 0.002) moving = true; else { sp.cur[i]=sp.tgt[i]; sp.vel[i]=0; }
  }
  // damped spin impulse
  spinV *= Math.pow(0.02, dt); spin += spinV * dt; spin *= Math.pow(0.12, dt);
  if(Math.abs(spinV) > 0.002 || Math.abs(spin) > 0.002) moving = true; else { spin = 0; spinV = 0; }
  // smooth-damp tilt toward the pointer
  tilt.x += (tilt.tx - tilt.x) * Math.min(1, dt*8); tilt.y += (tilt.ty - tilt.y) * Math.min(1, dt*8);
  if(Math.abs(tilt.tx-tilt.x) > 0.0005 || Math.abs(tilt.ty-tilt.y) > 0.0005) moving = true;
  layout(); renderer.render(scene, camera);
  if(moving && visible) requestAnimationFrame(frame); else { running = false; lastT = 0; }
}
function kick(){ if(!renderer) return; if(reduced()){ layout(); renderer.render(scene,camera); return; } if(!running){ running = true; requestAnimationFrame(frame); } }
function size(){
  if(!host) return;
  const w = host.clientWidth || 112;
  renderer.setSize(w, w, false); camera.aspect = 1; camera.updateProjectionMatrix();
}

let firstAttach = true;
const Plate = {
  attach(el, data){
    if(!el) return;
    if(!renderer && !init()) return;            // no WebGL → the CSS ring stays
    if(canvas.parentNode !== el){ el.appendChild(canvas); host = el; size(); }
    const tot = (data.p*4 + data.c*4 + data.f*9) || 1;
    const next = [data.p*4/tot, data.c*4/tot, data.f*9/tot];
    const changed = next.some((v,i) => Math.abs(v - sp.tgt[i]) > 0.002) || data.key !== Plate._key;
    sp.tgt = next;
    if(firstAttach || reduced()){ sp.cur = next.slice(); sp.vel = [0,0,0]; if(firstAttach && !reduced()) spinV = -2.4; firstAttach = false; }
    else if(changed && data.key !== Plate._key) spinV += (data.dir || 1) * 2.2;  // the plate turns when you change day/person
    Plate._key = data.key;
    el.classList.add('live');
    kick();
  },
  _key: null,
};
window.addEventListener('resize', () => { if(renderer){ size(); kick(); } });

const pending = window.Plate && window.Plate.pending;
window.Plate = Plate;
if(pending) Plate.attach(pending[0], pending[1]);
