/* IA na Prática · slide "Cenas 3D no vídeo"
   Uma cena three.js desenhada só a partir do tempo t, como o HyperFrames faz no render:
   desenhar(t) é uma função pura do tempo (sem relógio, sem sorteio sem semente). */
import * as THREE from 'three';

const $ = (s, r = document) => r.querySelector(s);
const canvas = $('#t3-canvas');
const demos = (window.IADemos = window.IADemos || {});
const DUR = 6, FPS = 30;

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

let ok = !!canvas;
let renderer;
try { if (ok) renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'low-power' }); } catch { ok = false; }

if (!ok) {
  const v = $('.t3-view'); if (v) v.classList.add('nogl');
} else {
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x07070f, 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  const rand = mulberry32(42);

  // textura do planeta: faixas, feita uma vez num canvas (com semente)
  const tex = (() => {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
    const g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 512);
    const cols = ['#f3d2ad', '#d99a64', '#b5653a', '#e8b98a', '#9c4f2f', '#f0cfa8', '#c47a48', '#7d3a24', '#e3ae80'];
    cols.forEach((col, i) => grd.addColorStop(i / (cols.length - 1), col));
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 160; i++) {               // turbulência nas faixas
      const y = rand() * 512, h = 2 + rand() * 9;
      g.fillStyle = `rgba(${rand() < 0.5 ? '255,240,220' : '90,40,25'},${0.05 + rand() * 0.12})`;
      g.beginPath(); g.ellipse(rand() * 1024, y, 60 + rand() * 260, h, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(160,60,40,.55)'; g.beginPath(); g.ellipse(700, 300, 46, 20, 0, 0, Math.PI * 2); g.fill();   // tempestade
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const ringTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 8;
    const g = c.getContext('2d');
    for (let x = 0; x < 512; x++) {
      const u = x / 511, gap = Math.exp(-Math.pow((u - 0.62) / 0.03, 2));
      const a = (0.35 + 0.45 * Math.abs(Math.sin(u * 47)) * (0.6 + 0.4 * Math.sin(u * 13))) * (1 - 0.9 * gap) * Math.min(1, u * 8) * Math.min(1, (1 - u) * 10);
      g.fillStyle = `rgba(255,${210 + Math.round(30 * u)},${170 + Math.round(40 * u)},${a.toFixed(3)})`; g.fillRect(x, 0, 1, 8);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();

  const planet = new THREE.Group();
  scene.add(planet);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 }));
  planet.add(body);
  // anel: uma coroa com a textura aplicada no raio
  const rg = new THREE.RingGeometry(1.45, 2.45, 160, 1);
  const uv = rg.attributes.uv, pos = rg.attributes.position, v3 = new THREE.Vector3();
  for (let i = 0; i < uv.count; i++) { v3.fromBufferAttribute(pos, i); uv.setXY(i, (v3.length() - 1.45) / 1.0, 0.5); }
  const ring = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: ringTex, transparent: true, side: THREE.DoubleSide, roughness: 0.8, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2 + 0.42;
  planet.add(ring);
  planet.rotation.z = 0.18;
  const moons = [[2.9, 0.16, 0.9, 0], [3.7, 0.11, 0.55, 2.2]].map(([d, r, sp, ph]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.MeshStandardMaterial({ color: 0xd9d2c8, roughness: 0.9 }));
    scene.add(m); return { m, d, sp, ph };
  });
  // estrelas com semente
  {
    const n = 1400, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(60 + rand() * 40); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.16, sizeAttenuation: true, transparent: true, opacity: 0.8 })));
  }
  // luz de estúdio: quente na frente, fria na borda, ambiente fraco
  const key = new THREE.DirectionalLight(0xffd6a8, 3.2); key.position.set(-4, 2.5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x8fb4ff, 2.4); rim.position.set(5, 1.5, -4); scene.add(rim);
  scene.add(new THREE.AmbientLight(0x2a2a48, 0.6));

  const smooth = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
  let shot = 'orbit';
  function cameraAt(t, out) {
    const k = t / DUR;
    if (shot === 'orbit') { const a = 0.4 + k * Math.PI * 0.9; out.set(Math.sin(a) * 7.5, 1.6 + Math.sin(k * Math.PI) * 0.8, Math.cos(a) * 7.5); }
    else if (shot === 'dive') { const d = 9 - smooth(k) * 6.2; const a = 0.3 + k * 0.8; out.set(Math.sin(a) * d, 0.5 + d * 0.16, Math.cos(a) * d); }
    else { const a = k * 0.8; out.set(Math.sin(a) * 0.6, 8.5 - smooth(k) * 1.5, Math.cos(a) * 0.6 + 0.01); }
    return out;
  }
  const cp = new THREE.Vector3();
  function desenhar(t) {
    planet.rotation.y = t * 0.6;
    moons.forEach(({ m, d, sp, ph }) => { const a = t * sp + ph; m.position.set(Math.cos(a) * d, Math.sin(a) * d * 0.28, Math.sin(a) * d); });
    camera.position.copy(cameraAt(t, cp));
    camera.lookAt(0, 0, 0);
    renderer.render(scene, camera);
  }

  const view = $('.t3-view'), range = $('#t3-time'), hud = $('#t3-hud'), playBtn = $('#t3-play');
  let t = 0, playing = true, on = false, raf = 0, last = 0;
  const label = x => `${x.toFixed(2).replace('.', ',')} s`;
  function resize() {
    const w = Math.max(1, view.clientWidth), h = Math.max(1, view.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  function show() {
    desenhar(t);
    range.value = Math.round(t * 100);
    hud.textContent = `t = ${label(t)} · quadro ${Math.round(t * FPS)}`;
  }
  function setPlay(p) {
    playing = p;
    playBtn.innerHTML = `<svg class="i sm"><use href="#i-${p ? 'pause' : 'play'}"/></svg>`;
    playBtn.classList.toggle('on', p);
  }
  function frame(now) {
    if (!on) return;
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    if (playing) t = (t + dt) % DUR;
    show();
    raf = requestAnimationFrame(frame);
  }
  range.addEventListener('input', () => { setPlay(false); t = +range.value / 100; show(); });
  playBtn.addEventListener('click', () => setPlay(!playing));
  $('#t3-shot').addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (!b) return;
    shot = b.dataset.c;
    [...b.parentNode.children].forEach(x => x.classList.toggle('on', x === b));
    show();
  });
  // "grava" três quadros: renderiza os instantes 0 s, 2 s e 4 s e guarda a imagem de cada um
  $('#t3-snap').addEventListener('click', () => {
    const box = $('#t3-thumbs'); box.innerHTML = '';
    [0, 2, 4].forEach(s => {
      desenhar(s);
      const img = new Image(); img.alt = `Quadro em ${s} segundos`; img.src = canvas.toDataURL('image/jpeg', 0.82);
      const f = document.createElement('figure'); f.append(img);
      const c = document.createElement('figcaption'); c.textContent = `t = ${s},0 s · quadro ${s * FPS}`; f.append(c);
      box.append(f);
    });
    show();
  });
  addEventListener('resize', () => { if (on) { resize(); show(); } });
  demos.v3d = {
    enter() { on = true; resize(); setPlay(true); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); },
    leave() { on = false; cancelAnimationFrame(raf); }
  };
  // o módulo carrega depois do main.js: se o slide já estiver aberto, começa agora
  if ($('.slide[data-id="v3d"]')?.classList.contains('active')) demos.v3d.enter();
  window.IAStudio3D = { desenhar, setShot: s => { shot = s; } };
}
