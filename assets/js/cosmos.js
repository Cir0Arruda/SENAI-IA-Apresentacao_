/* =========================================================
   IA na Prática · final: "Do Big Bang ao SENAI Iracemápolis"
   Uma viagem de 13,8 bilhões de anos em 10 capítulos, toda em three.js:
   Big Bang → 3 primeiros minutos → primeira luz → primeiras estrelas →
   teia cósmica → Via Láctea → Sistema Solar → Terra → mergulho até
   Iracemápolis → a Escola SENAI reconstruída em 3D.

   Dados reais usados:
   - Terra: texturas do exemplo de planetas do three.js (NASA Blue Marble)
   - América do Sul e São Paulo: NASA GIBS, Blue Marble Next Generation (domínio público)
   - Iracemápolis: Sentinel-2 cloudless 2023 da EOX (CC BY-NC-SA 4.0, uso educacional)
   - Ruas: OpenStreetMap (ODbL); prédios do SENAI medidos sobre imagem de satélite
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const $ = (s, r = document) => r.querySelector(s);
const root = $('.cos');
const canvas = $('#cos-canvas');
const demos = (window.IADemos = window.IADemos || {});
const TEST = /[?&]teste\b/.test(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const TAU = Math.PI * 2;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- Capítulos ---------- */
const ACTS = [
  { id: 'bang', dur: 9, kicker: '13,8 bilhões de anos atrás', title: 'O Big Bang', sub: 'Espaço, tempo, matéria e energia surgem juntos. Numa fração de segundo, a inflação estica o universo mais de 10²⁶ vezes.' },
  { id: 'nuc', dur: 8, kicker: 'Os 3 primeiros minutos', title: 'Nascem os primeiros núcleos', sub: 'Prótons (vermelho) e nêutrons (azul) se juntam. O universo sai com cerca de 75% de hidrogênio e 25% de hélio, em massa.' },
  { id: 'cmb', dur: 8, kicker: '380 mil anos depois', title: 'A primeira luz', sub: 'O universo esfria a ~3.000 °C, os átomos se formam e a luz escapa. Ela chega até hoje como micro-ondas a 2,7 K: o fundo cósmico.' },
  { id: 'stars', dur: 8, kicker: '~200 milhões de anos', title: 'As primeiras estrelas', sub: 'Depois da "idade das trevas", a gravidade junta o gás e acende estrelas gigantes. As que explodem espalham carbono, oxigênio e ferro.' },
  { id: 'web', dur: 9, kicker: '~1 bilhão de anos', title: 'A teia cósmica', sub: 'A matéria escura puxa o gás para filamentos enormes. Nos cruzamentos nascem as galáxias, em aglomerados.' },
  { id: 'mw', dur: 9, kicker: '~13,6 bilhões de anos atrás até hoje', title: 'A Via Láctea', sub: '100 a 400 bilhões de estrelas numa espiral barrada. O Sol fica num braço, a 26 mil anos-luz do centro.' },
  { id: 'sol', dur: 9, kicker: '4,6 bilhões de anos atrás', title: 'Nasce o Sistema Solar', sub: 'Uma nuvem de gás e poeira colapsa. O Sol acende no centro, e os planetas crescem no disco em volta dele.' },
  { id: 'earth', dur: 9, kicker: '4,54 bilhões de anos atrás até hoje', title: 'A Terra', sub: 'Começa como uma bola de lava. Esfria, ganha oceanos e atmosfera, e hoje abriga cerca de 8 bilhões de pessoas.' },
  { id: 'zoom', dur: 16, kicker: 'Hoje', title: 'Brasil · São Paulo · Iracemápolis', sub: 'Do espaço até o interior paulista: 22,58° S, 47,50° O.' },
  { id: 'senai', dur: 12, kicker: 'Rua Camilo Ferrari, 765 · Distrito Industrial II', title: 'SENAI Iracemápolis', sub: 'Escola SENAI "João Guilherme Sabino Ometto". Reconstruída em 3D a partir de imagens de satélite e do OpenStreetMap.' }
];
let T_ACT = []; { let a = 0; ACTS.forEach(c => { T_ACT.push(a); a += c.dur; }); }
const TOTAL = ACTS.reduce((s, c) => s + c.dur, 0);

let ok = !!canvas;
let renderer;
try { if (ok) renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); if (renderer && !renderer.capabilities.isWebGL2) ok = false; } catch { ok = false; }
if (!ok) { root?.classList.add('nogl'); }
else init();

function init() {
  const rand = mulberry32(20261105);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const PR = Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 1);
  const view = $('.cos-view');

  /* ---------- Pontos (partículas) com brilho suave ---------- */
  const PTS_VS = /* glsl */`
    attribute vec3 aColor; attribute float aSize; uniform float uPx, uScale; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float s = aSize * uScale * uPx / max(-mv.z, 0.001); vC = aColor; if (s < 1.4) { vC *= (s / 1.4) * (s / 1.4); s = 1.4; } gl_PointSize = min(s, 64.0); }`;
  const PTS_FS = /* glsl */`
    uniform float uAlpha; varying vec3 vC;
    void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); float a = exp(-d * 22.0) + 0.12 * exp(-d * 6.0); if (a < 0.01) discard; gl_FragColor = vec4(vC * a * uAlpha, 1.0); }`;
  function pointsMat(scale = 1) {
    return new THREE.ShaderMaterial({ uniforms: { uPx: { value: 500 }, uScale: { value: scale }, uAlpha: { value: 1 } }, vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }
  function pointsGeo(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    return g;
  }
  const allPtsMats = [];
  const mkPoints = (n, scale) => { const m = pointsMat(scale); allPtsMats.push(m); const p = new THREE.Points(pointsGeo(n), m); p.frustumCulled = false; return p; };
  function starfield(n, R, dim = 1) {
    const p = mkPoints(n, 1), pa = p.geometry.attributes;
    const cols = [[1, 1, 1], [0.8, 0.86, 1], [1, 0.9, 0.78], [0.7, 0.78, 1]];
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(R);
      pa.position.setXYZ(i, v.x, v.y, v.z);
      const c = cols[(rand() * 4) | 0], b = (0.15 + Math.pow(rand(), 4) * 0.9) * dim;
      pa.aColor.setXYZ(i, c[0] * b, c[1] * b, c[2] * b); pa.aSize.setX(i, R * (0.0016 + Math.pow(rand(), 6) * 0.004));
    }
    return p;
  }
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sprite = (col, s, op = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false })); m.scale.setScalar(s); return m; };

  const NOISE = /* glsl */`
    float h3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++){ s += a * n3(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }`;

  /* =========================================================
     Cenas do espaço profundo (capítulos 1 a 7): unidades livres
     ========================================================= */
  const scenes = {};
  const cams = {};
  const mkCam = (fov = 55, near = 0.01, far = 5000) => new THREE.PerspectiveCamera(fov, 16 / 9, near, far);

  // 1) Big Bang: partículas que se afastam, esfriando (branco → amarelo → laranja → vermelho)
  {
    const s = new THREE.Scene(), N = small ? 14000 : 26000, p = mkPoints(N, 1);
    const dir = new Float32Array(N * 3), spd = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize();
      dir.set([v.x, v.y, v.z], i * 3); spd[i] = 0.25 + Math.pow(rand(), 0.6) * 1.0;
      p.geometry.attributes.aSize.setX(i, 0.012 + Math.pow(rand(), 5) * 0.03);
    }
    const flash = sprite(0xffffff, 1, 1), halo = sprite(0xffd7a0, 1, 0.8);
    s.add(p, flash, halo);
    scenes.bang = s; cams.bang = mkCam(55);
    const col = new THREE.Color(), hot = new THREE.Color(1.6, 1.6, 1.8), warm = new THREE.Color(1.4, 1.05, 0.55), cool = new THREE.Color(0.9, 0.32, 0.12), dim = new THREE.Color(0.25, 0.08, 0.05);
    scenes.bang.update = (q, t) => {
      // inflação (subida muito rápida) e depois expansão desacelerando
      const a = 3.2 * (1 - Math.exp(-q * 14)) + 1.6 * q;
      const pa = p.geometry.attributes.position, ca = p.geometry.attributes.aColor;
      for (let i = 0; i < N; i++) {
        const r = a * spd[i] * (1 + 0.04 * Math.sin(t * 2 + i));
        pa.setXYZ(i, dir[i * 3] * r, dir[i * 3 + 1] * r, dir[i * 3 + 2] * r);
        const k = clamp(q * 1.25 + (spd[i] - 0.6) * 0.25, 0, 1);
        col.copy(hot).lerp(warm, sstep(0.0, 0.35, k)).lerp(cool, sstep(0.35, 0.75, k)).lerp(dim, sstep(0.75, 1.0, k));
        ca.setXYZ(i, col.r, col.g, col.b);
      }
      pa.needsUpdate = ca.needsUpdate = true;
      const f = Math.exp(-q * 9);
      flash.scale.setScalar(0.3 + 9 * (1 - f)); flash.material.opacity = f;
      halo.scale.setScalar(2 + 10 * q); halo.material.opacity = 0.7 * Math.exp(-q * 3);
      cams.bang.position.set(Math.sin(t * 0.08) * 0.6, 0.4, 7.5 - q * 1.8); cams.bang.lookAt(0, 0, 0);
    };
  }

  // 2) Nucleossíntese: prótons e nêutrons que se juntam em núcleos de hélio (2p + 2n)
  {
    const s = new THREE.Scene(), N = small ? 900 : 1600;
    const geo = new THREE.SphereGeometry(0.05, 12, 8);
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.0, emissive: 0x000000 });
    const im = new THREE.InstancedMesh(geo, mat, N);
    const P = [], G = [], KIND = [];
    const groups = Math.floor(N * 0.07);
    for (let i = 0; i < N; i++) { P.push(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1.6)); KIND.push(rand() < 0.86 ? 0 : 1); G.push(-1); }
    const tet = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, -1, 1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, -1, -1)].map(v => v.multiplyScalar(0.045));
    const centers = [];
    for (let g = 0; g < groups; g++) { centers.push(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1.4)); for (let k = 0; k < 4; k++) { const i = g * 4 + k; G[i] = g; KIND[i] = k < 2 ? 0 : 1; } }
    const cP = new THREE.Color(1.0, 0.32, 0.28), cN = new THREE.Color(0.35, 0.55, 1.0);
    for (let i = 0; i < N; i++) im.setColorAt(i, KIND[i] ? cN : cP);
    s.add(im, new THREE.AmbientLight(0x6070a0, 0.6));
    const L = new THREE.PointLight(0xffe0b0, 40, 0, 1.6); L.position.set(2, 2, 3); s.add(L);
    const glow = sprite(0xffb070, 9, 0.35); s.add(glow);
    scenes.nuc = s; cams.nuc = mkCam(50);
    const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q4 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    scenes.nuc.update = (q, t) => {
      const bind = sstep(0.25, 0.8, q);
      for (let i = 0; i < N; i++) {
        const j = Math.sin(t * 3 + i * 1.7) * 0.03;
        v.copy(P[i]).addScaledVector(P[i], 0.08 * Math.sin(t * 0.7 + i)).addScalar(j);
        if (G[i] >= 0) { const tg = centers[G[i]].clone().addScaledVector(centers[G[i]], 0.05 * Math.sin(t)).add(tet[i % 4]); v.lerp(tg, bind); }
        m4.compose(v, q4, one); im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
      glow.material.opacity = 0.35 * (1 - q * 0.7);
      cams.nuc.position.set(Math.cos(t * 0.15) * 5.2, 1.2, Math.sin(t * 0.15) * 5.2); cams.nuc.lookAt(0, 0, 0);
      hud(`Hidrogênio ${Math.round(100 - 25 * bind)}% · Hélio ${Math.round(25 * bind)}% (em massa)`, bind);
    };
  }

  // 3) Fundo cósmico de micro-ondas: o plasma opaco clareia e mostra as pequenas diferenças de temperatura
  {
    const s = new THREE.Scene();
    const m = new THREE.ShaderMaterial({
      uniforms: { uFog: { value: 1 }, uT: { value: 0 } }, side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${NOISE} uniform float uFog, uT; varying vec3 vP;
        vec3 planck(float x){ // escala de cores parecida com o mapa do satélite Planck
          vec3 a = vec3(0.0, 0.05, 0.4), b = vec3(0.2, 0.6, 1.0), c = vec3(1.0, 0.98, 0.9), d = vec3(1.0, 0.6, 0.15), e = vec3(0.75, 0.1, 0.05);
          return x < 0.25 ? mix(a, b, x / 0.25) : x < 0.5 ? mix(b, c, (x - 0.25) / 0.25) : x < 0.75 ? mix(c, d, (x - 0.5) / 0.25) : mix(d, e, (x - 0.75) / 0.25); }
        void main(){ vec3 d = normalize(vP);
          float n = fbm(d * 6.0 + 3.0) * 0.65 + fbm(d * 18.0) * 0.35;
          vec3 cmb = planck(clamp((n - 0.28) * 2.4, 0.0, 1.0)) * 0.42;
          vec3 plasma = vec3(0.95, 0.42, 0.14) * (0.35 + 0.35 * fbm(d * 3.0 + uT * 0.3));
          gl_FragColor = vec4(mix(cmb, plasma, uFog), 1.0); }`
    });
    const sph = new THREE.Mesh(new THREE.SphereGeometry(50, 64, 32), m);
    s.add(sph); scenes.cmb = s; cams.cmb = mkCam(70, 0.1, 200);
    scenes.cmb.update = (q, t) => {
      m.uniforms.uFog.value = 1 - sstep(0.1, 0.45, q); m.uniforms.uT.value = t;
      sph.scale.setScalar(1 + sstep(0.65, 1, q) * 2);
      cams.cmb.position.set(0, 0, 0); cams.cmb.rotation.set(0.1 * Math.sin(t * 0.2), t * 0.05, 0);
      hud(q < 0.4 ? 'Plasma quente e opaco: a luz fica presa' : 'Pontos azuis: mais frios · vermelhos: mais quentes (diferença de 0,00001 grau)', sstep(0.1, 0.45, q));
    };
  }

  // 4) Idade das trevas → primeiras estrelas (e supernovas)
  {
    const s = new THREE.Scene(), N = 420;
    const gas = new THREE.Mesh(new THREE.SphereGeometry(60, 48, 24), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: { uK: { value: 0 } },
      vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `${NOISE} uniform float uK; varying vec3 vP; void main(){ vec3 d = normalize(vP); float n = fbm(d * 4.0 + 9.0);
        gl_FragColor = vec4(vec3(0.05, 0.07, 0.16) * smoothstep(0.35, 0.8, n) * (0.6 + uK), 1.0); }`
    }));
    const st = mkPoints(N, 1), pa = st.geometry.attributes, born = new Float32Array(N), P = [];
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3(gauss(), gauss() * 0.6, gauss()).multiplyScalar(6); P.push(v); pa.position.setXYZ(i, v.x, v.y, v.z); born[i] = 0.1 + rand() * 0.75; }
    const sn = [0, 1, 2].map(() => { const sp = sprite(0xbfd8ff, 1, 0); s.add(sp); return { sp, at: 0.55 + rand() * 0.35, p: P[(rand() * N) | 0] }; });
    s.add(gas, st); scenes.stars = s; cams.stars = mkCam(60, 0.05, 300);
    scenes.stars.update = (q, t) => {
      for (let i = 0; i < N; i++) {
        const k = sstep(born[i], born[i] + 0.05, q), pop = Math.exp(-Math.max(0, q - born[i]) * 30) * 4;
        const b = k * (0.8 + pop);
        pa.aColor.setXYZ(i, 0.55 * b, 0.7 * b, 1.3 * b); pa.aSize.setX(i, 0.05 + pop * 0.05);
      }
      pa.aColor.needsUpdate = pa.aSize.needsUpdate = true;
      sn.forEach(o => { const e = q - o.at; o.sp.position.copy(o.p); o.sp.material.opacity = e > 0 ? Math.exp(-e * 8) : 0; o.sp.scale.setScalar(e > 0 ? 0.5 + e * 12 : 0.01); });
      gas.material.uniforms.uK.value = q;
      cams.stars.position.set(Math.sin(t * 0.07) * 12, 2.5, Math.cos(t * 0.07) * 12 - q * 3); cams.stars.lookAt(0, 0, 0);
      hud(`Estrelas acesas: ${Math.round(N * sstep(0.1, 0.9, q))}`, sstep(0.1, 0.9, q));
    };
  }

  // 5) Teia cósmica: filamentos de matéria e galáxias nos cruzamentos
  {
    const s = new THREE.Scene(), NODES = 46, NP = small ? 26000 : 46000, BOX = 9;
    const nodes = []; for (let i = 0; i < NODES; i++) nodes.push(new THREE.Vector3((rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX));
    const edges = [];
    nodes.forEach((a, i) => { nodes.map((b, j) => [a.distanceTo(b), j]).sort((x, y) => x[0] - y[0]).slice(1, 4).forEach(([, j]) => { if (i < j) edges.push([i, j]); }); });
    const p = mkPoints(NP, 1), pa = p.geometry.attributes, base = new Float32Array(NP);
    const c1 = new THREE.Color(0.5, 0.35, 1.0), c2 = new THREE.Color(1.0, 0.75, 0.55), c = new THREE.Color();
    for (let i = 0; i < NP; i++) {
      let v;
      if (rand() < 0.22) { const n = nodes[(rand() * NODES) | 0]; v = n.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.35)); c.copy(c2); }
      else { const [a, b] = edges[(rand() * edges.length) | 0], u = rand(); v = nodes[a].clone().lerp(nodes[b], u).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(0.12 + 0.1 * Math.sin(u * Math.PI))); c.copy(c1).lerp(c2, rand() * 0.3); }
      pa.position.setXYZ(i, v.x, v.y, v.z); base[i] = 0.2 + Math.pow(rand(), 3); pa.aColor.setXYZ(i, c.r, c.g, c.b); pa.aSize.setX(i, 0.025 + Math.pow(rand(), 6) * 0.08);
    }
    const cols = Float32Array.from(pa.aColor.array);
    s.add(p); nodes.forEach(n => { const g = sprite(0xffd9b0, 0.9, 0.5); g.position.copy(n); s.add(g); });
    scenes.web = s; cams.web = mkCam(60, 0.05, 400);
    scenes.web.update = (q, t) => {
      const k = sstep(0, 0.6, q);
      for (let i = 0; i < NP; i++) { const b = base[i] * (0.3 + 1.2 * k); pa.aColor.setXYZ(i, cols[i * 3] * b, cols[i * 3 + 1] * b, cols[i * 3 + 2] * b); }
      pa.aColor.needsUpdate = true;
      const a = t * 0.05 + 0.6;
      cams.web.position.set(Math.cos(a) * (16 - q * 6), 3 * Math.sin(t * 0.1), Math.sin(a) * (16 - q * 6)); cams.web.lookAt(0, 0, 0);
      hud('Cada ponto claro é uma galáxia inteira', k);
    };
  }

  // 6) Via Láctea: espiral barrada vista de fora, com o "você está aqui"
  {
    const s = new THREE.Scene(), N = small ? 50000 : 90000, p = mkPoints(N, 1), pa = p.geometry.attributes;
    const cB = new THREE.Color(1.0, 0.82, 0.58), cA = new THREE.Color(0.55, 0.68, 1.0), cH = new THREE.Color(1.0, 0.4, 0.55), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rand(); let x, y, z;
      if (u < 0.22) { const r = Math.abs(gauss()) * 0.9; const a = rand() * TAU; x = Math.cos(a) * r * 1.6; z = Math.sin(a) * r * 0.7; y = gauss() * 0.25 * Math.exp(-r); c.copy(cB); }
      else {
        const k = rand() < 0.5 ? 0 : Math.PI, r = 1.4 + Math.pow(rand(), 0.8) * 8.5, th = k + 3.6 * Math.log(r / 1.4) + gauss() * (0.12 + 0.03 * r);
        x = Math.cos(th) * r; z = Math.sin(th) * r; y = gauss() * 0.06; c.copy(cA).lerp(cB, Math.exp(-r / 2.5)); if (rand() < 0.03) c.copy(cH);
      }
      pa.position.setXYZ(i, x, y, z); const b = 0.25 + Math.pow(rand(), 3) * 0.9; pa.aColor.setXYZ(i, c.r * b, c.g * b, c.b * b); pa.aSize.setX(i, 0.03 + Math.pow(rand(), 8) * 0.1);
    }
    const core = sprite(0xffe2b5, 5, 0.6), sun = sprite(0xfff1c0, 0.5, 1);
    const sunR = 5.6, sunA = 3.6 * Math.log(sunR / 1.4) + 0.35; sun.position.set(Math.cos(sunA) * sunR, 0, Math.sin(sunA) * sunR);
    s.add(p, core, sun, starfield(2500, 300, 0.6)); scenes.mw = s; cams.mw = mkCam(50, 0.05, 900);
    scenes.mw.sunPos = sun.position;
    scenes.mw.update = (q, t) => {
      p.rotation.y = t * 0.03; sun.position.set(Math.cos(sunA + t * 0.03) * sunR, 0, Math.sin(sunA + t * 0.03) * sunR).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0);
      const sp = sun.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -t * 0.03 * 0);
      const far = new THREE.Vector3(0, 13, 17), near = sp.clone().add(new THREE.Vector3(0, 1.4, 2.2));
      const k = ease(sstep(0.35, 1, q));
      cams.mw.position.copy(far).lerp(near, k); cams.mw.lookAt(new THREE.Vector3().lerp(sp, k));
      sun.scale.setScalar(0.4 + 0.3 * Math.sin(t * 4) ** 2);
      label('mw', sp, cams.mw, q > 0.3 ? 'Você está aqui: o Sol' : '');
      hud('26 mil anos-luz do centro', k);
    };
  }

  // 7) Sistema Solar: disco protoplanetário, o Sol acende e os planetas surgem nas lacunas
  {
    const s = new THREE.Scene(), N = small ? 20000 : 36000, p = mkPoints(N, 1), pa = p.geometry.attributes;
    const R = new Float32Array(N), A = new Float32Array(N), Y = new Float32Array(N);
    const gaps = [1.0, 1.5, 2.1, 2.9, 4.4, 5.8, 7.1, 8.4];
    for (let i = 0; i < N; i++) { R[i] = 0.5 + Math.pow(rand(), 0.7) * 9; A[i] = rand() * TAU; Y[i] = gauss() * 0.04 * R[i]; const w = 0.4 + Math.pow(rand(), 2); pa.aColor.setXYZ(i, w, w * 0.7, w * 0.45); pa.aSize.setX(i, 0.02 + Math.pow(rand(), 6) * 0.05); }
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(0.35, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) }));
    const sunG = sprite(0xffcf80, 4, 0.9);
    const PL = [[0.10, 0x9f9f9f], [0.13, 0xe8c48f], [0.14, 0x4f8fff], [0.11, 0xc65a3a], [0.4, 0xd8b48a], [0.34, 0xe6d3a2], [0.22, 0x9fe3ec], [0.21, 0x5b7cff]];
    const planets = PL.map(([r, c], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); s.add(m); return { m, a: rand() * TAU, R: gaps[i] }; });
    const L = new THREE.PointLight(0xfff0d8, 60, 0, 1.2);
    s.add(p, sunM, sunG, L, new THREE.AmbientLight(0x202030, 1), starfield(2500, 300, 0.7));
    scenes.sol = s; cams.sol = mkCam(50, 0.05, 900);
    scenes.sol.update = (q, t) => {
      const clear = sstep(0.45, 1, q);
      for (let i = 0; i < N; i++) {
        const w = 0.5 / Math.pow(R[i], 1.5), a = A[i] + t * w * 2;
        let r = R[i]; gaps.forEach(gp => { const d = r - gp; r += clear * 0.25 * Math.sign(d) * Math.exp(-d * d / 0.05) * 0.4; });
        pa.position.setXYZ(i, Math.cos(a) * r, Y[i] * (1 - 0.5 * clear), Math.sin(a) * r);
      }
      pa.position.needsUpdate = true; p.material.uniforms.uAlpha.value = 1 - 0.75 * clear;
      const on = sstep(0.15, 0.4, q); sunM.scale.setScalar(0.2 + on); sunG.material.opacity = on; L.intensity = 60 * on;
      planets.forEach((o, i) => { const g = sstep(0.45 + i * 0.04, 0.6 + i * 0.04, q); o.m.scale.setScalar(Math.max(g, 0.001)); const a = o.a + t * 0.4 / Math.pow(o.R, 1.5); o.m.position.set(Math.cos(a) * o.R, 0, Math.sin(a) * o.R); });
      const e = planets[2].m.position;
      cams.sol.position.set(0, 7 - 2 * q, 12 - 3 * q); cams.sol.lookAt(0, 0, 0);
      label('sol', e, cams.sol, q > 0.65 ? 'Terra' : '');
      hud(q < 0.4 ? 'Nuvem de gás e poeira girando' : 'O Sol acende; os planetas varrem o disco', sstep(0.1, 1, q));
    };
  }

  /* =========================================================
     Terra, mergulho e SENAI (capítulos 8 a 10): unidades em km
     ========================================================= */
  const RE = 6371;                                       // raio da Terra (km)
  const LAT0 = -22.5782409, LON0 = -47.4956812;          // SENAI Iracemápolis (Rua Camilo Ferrari, 765)
  const toVec = (lat, lon, r = RE) => { const ph = THREE.MathUtils.degToRad(lon + 180), th = THREE.MathUtils.degToRad(90 - lat); return new THREE.Vector3(-Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)).multiplyScalar(r); };
  const N0 = toVec(LAT0, LON0, 1);
  const EAST = new THREE.Vector3(Math.sin(THREE.MathUtils.degToRad(LON0 + 180)), 0, Math.cos(THREE.MathUtils.degToRad(LON0 + 180))).normalize();
  const NORTH = new THREE.Vector3().crossVectors(N0, EAST).normalize();
  const SUN = N0.clone().multiplyScalar(0.75).addScaledVector(EAST, -0.45).addScaledVector(NORTH, 0.35).normalize();   // manhã em Iracemápolis

  const es = new THREE.Scene(); scenes.earth = scenes.zoom = scenes.senai = es;
  const ecam = mkCam(40, 1, 200000); cams.earth = cams.zoom = cams.senai = ecam;
  const loader = new THREE.TextureLoader(); loader.setCrossOrigin('anonymous');
  const TEXB = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/planets/';
  const lt = (u, srgb = true) => { const t = loader.load(u); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const earthU = { tDay: { value: null }, tNight: { value: null }, tSpec: { value: null }, tClouds: { value: null }, uSun: { value: SUN }, uLava: { value: 1 }, uT: { value: 0 }, uHi: { value: null }, uHiOn: { value: 0 }, uHiBox: { value: new THREE.Vector4() }, uCloud: { value: 1 } };
  let earthLoaded = false;
  function loadEarth() {
    if (earthLoaded) return; earthLoaded = true;
    earthU.tDay.value = lt(TEXB + 'earth_atmos_2048.jpg');
    earthU.tNight.value = lt(TEXB + 'earth_lights_2048.png');
    earthU.tSpec.value = lt(TEXB + 'earth_specular_2048.jpg', false);
    earthU.tClouds.value = lt(TEXB + 'earth_clouds_1024.png');
    buildHiRes(); buildTiles();
  }
  // Terra: dia (cor), noite (luzes das cidades), brilho do Sol nos oceanos e o começo como lava
  const earthMat = new THREE.ShaderMaterial({
    uniforms: earthU,
    vertexShader: `varying vec2 vUv; varying vec3 vN, vW, vO; void main(){ vUv = uv; vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${NOISE}
      uniform sampler2D tDay, tNight, tSpec, tClouds, uHi; uniform vec3 uSun; uniform float uLava, uT, uHiOn, uCloud; uniform vec4 uHiBox; varying vec2 vUv; varying vec3 vN, vW, vO;
      float mercY(float lat){ return log(tan(0.78539816 + lat * 0.5)); }
      void main(){
        vec3 n = normalize(vN), V = normalize(cameraPosition - vW);
        float dl = dot(n, uSun), day = smoothstep(-0.12, 0.25, dl);
        vec3 col = texture2D(tDay, vUv).rgb;
        // imagem de satélite mais detalhada da América do Sul (NASA GIBS), por cima da textura global
        if (uHiOn > 0.5) {
          float lat = asin(clamp(vO.y, -1.0, 1.0)), lon = atan(vO.z, -vO.x) - 3.14159265;
          lon = mod(lon + 3.14159265, 6.2831853) - 3.14159265;
          vec2 h = vec2((lon - uHiBox.x) / (uHiBox.y - uHiBox.x), (mercY(lat) - uHiBox.z) / (uHiBox.w - uHiBox.z));
          if (h.x > 0.0 && h.x < 1.0 && h.y > 0.0 && h.y < 1.0) { vec2 e = min(h, 1.0 - h); float f = smoothstep(0.0, 0.04, min(e.x, e.y)); col = mix(col, texture2D(uHi, h).rgb, f); }
        }
        float spec = texture2D(tSpec, vUv).r;
        vec3 H = normalize(uSun + V);
        vec3 lit = col * (0.04 + 1.05 * max(dl, 0.0)) + vec3(1.0, 0.92, 0.8) * pow(max(dot(n, H), 0.0), 60.0) * spec * 0.6 * day;
        vec3 night = texture2D(tNight, vUv).rgb * vec3(1.0, 0.78, 0.45) * 1.4 * (1.0 - day);
        float cl = texture2D(tClouds, vUv + vec2(uT * 0.0004, 0.0)).r;
        lit = mix(lit + night, vec3(1.0) * (0.03 + max(dl, 0.0)), cl * 0.75 * uCloud);
        float rim = pow(1.0 - max(dot(n, V), 0.0), 3.0);
        lit += vec3(0.3, 0.55, 1.0) * rim * 0.6 * smoothstep(-0.3, 0.4, dl);
        // Terra primitiva: oceano de magma com crosta escura se formando
        float lv = fbm(vO * 5.0 + vec3(0.0, uT * 0.05, 0.0));
        vec3 lava = mix(vec3(1.4, 0.35, 0.05), vec3(0.08, 0.03, 0.02), smoothstep(0.45, 0.6, lv)) * (0.6 + 0.6 * smoothstep(0.3, 0.5, lv));
        gl_FragColor = vec4(mix(lit, lava, uLava), 1.0);
      }`
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(RE, 160, 96), earthMat);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.025, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN }, uA: { value: 1 } }, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform vec3 uSun; uniform float uA; varying vec3 vN, vW; void main(){ vec3 V = normalize(cameraPosition - vW); float r = pow(clamp(1.0 + dot(vN, V) * 1.0, 0.0, 1.0), 4.0);
      float l = smoothstep(-0.4, 0.5, dot(-vN, uSun)); gl_FragColor = vec4(vec3(0.3, 0.6, 1.0) * r * l * 1.6 * uA, 1.0); }`
  }));
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1737, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9a9aa0, roughness: 1 }));
  moon.position.copy(N0).multiplyScalar(-1).addScaledVector(EAST, 1).normalize().multiplyScalar(60000);
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2); sunLight.position.copy(SUN).multiplyScalar(1e5);
  es.add(earth, atmo, moon, sunLight, new THREE.AmbientLight(0x8090b0, 0.5), starfield(5000, 150000, 0.8));

  // América do Sul em alta (NASA GIBS, zoom 6: ~2,4 km por pixel) montada num canvas
  const tileXY = (lat, lon, z) => { const n = 2 ** z; return [(lon + 180) / 360 * n, (1 - Math.asinh(Math.tan(THREE.MathUtils.degToRad(lat))) / Math.PI) / 2 * n]; };
  const tileLon = (x, z) => x / 2 ** z * 360 - 180;
  const tileMercY = (y, z) => Math.PI * (1 - 2 * y / 2 ** z);          // = ln(tan(π/4 + lat/2))
  const GIBS = (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`;
  const EOX = (z, x, y) => `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2023_3857/default/g/${z}/${y}/${x}.jpg`;
  function buildHiRes() {
    const z = 6, [cx, cy] = tileXY(LAT0, LON0, z), x0 = Math.floor(cx) - 3, y0 = Math.floor(cy) - 3, NT = 7;
    const cv = document.createElement('canvas'); cv.width = cv.height = 256 * NT; const g = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.flipY = false;
    let n = 0;
    for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) {
      const im = new Image(); im.crossOrigin = 'anonymous';
      im.onload = () => { g.drawImage(im, i * 256, j * 256); tex.needsUpdate = true; if (++n >= NT * NT * 0.6) earthU.uHiOn.value = 1; };
      im.src = GIBS(z, x0 + i, y0 + j);
    }
    const D = Math.PI / 180;
    earthU.uHi.value = tex;
    // flipY = false: a linha 0 do canvas é o norte (mercY maior)
    earthU.uHiBox.value.set(tileLon(x0, z) * D, tileLon(x0 + NT, z) * D, tileMercY(y0, z), tileMercY(y0 + NT, z));
  }

  /* ---------- Plano local (leste, norte) no ponto do SENAI ---------- */
  const local = new THREE.Group();                          // x = leste, y = cima, z = sul (km)
  local.matrixAutoUpdate = false;
  local.matrix.makeBasis(EAST, N0, NORTH.clone().negate()).setPosition(N0.clone().multiplyScalar(RE + 0.002));
  es.add(local);
  const COSL = Math.cos(THREE.MathUtils.degToRad(LAT0));
  const MERC = 40075.016686;                                // circunferência (km)
  const tileKm = z => MERC * COSL / 2 ** z;
  const levels = [];
  function buildTiles() {
    const [X0, Y0] = [tileXY(LAT0, LON0, 0)[0], tileXY(LAT0, LON0, 0)[1]];
    for (let z = 8; z <= 15; z++) {
      const grp = new THREE.Group(), n = 2 ** z, cx = X0 * n, cy = Y0 * n, size = tileKm(z), NT = z >= 14 ? 6 : 4;
      const mats = [];
      for (let j = 0; j < NT; j++) for (let i = 0; i < NT; i++) {
        const tx = Math.floor(cx) - (NT / 2 - 1) + i, ty = Math.floor(cy) - (NT / 2 - 1) + j;
        const m = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, depthTest: true });
        const t = loader.load(z <= 8 ? GIBS(z, tx, ty) : EOX(z, tx, ty), tt => { tt.colorSpace = THREE.SRGBColorSpace; tt.anisotropy = 8; m.map = tt; m.needsUpdate = true; m.userData.ok = true; });
        const q = new THREE.Mesh(new THREE.PlaneGeometry(size, size), m);
        q.rotation.x = -Math.PI / 2;
        q.position.set((tx + 0.5 - cx) * size, -(15 - z) * 0.0002, (ty + 0.5 - cy) * size);
        q.renderOrder = z; q.frustumCulled = false; grp.add(q); mats.push(m);
      }
      local.add(grp); levels.push({ z, size, mats, grp });
    }
  }
  // brilho suave do horizonte quando estamos baixo (névoa azul)
  const haze = new THREE.Mesh(new THREE.SphereGeometry(RE * 1.0006, 96, 64), new THREE.MeshBasicMaterial({ color: 0x9cc4ff, transparent: true, opacity: 0, depthWrite: false, side: THREE.BackSide }));
  es.add(haze);

  /* ---------- Distrito Industrial II e a Escola SENAI em 3D (metros → km) ---------- */
  const site = new THREE.Group(); site.scale.setScalar(0.001); site.visible = false; local.add(site);
  const hot = [];                                           // partes clicáveis do SENAI
  let siteData = null;
  fetch('assets/data/senai-iracemapolis.json').then(r => r.json()).then(d => { siteData = d; buildSite(d); }).catch(() => {});
  function signTex(text, bg, fg, w = 1024, h = 256) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = fg; g.font = `800 ${h * 0.62}px "Inter Tight", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h * 0.54);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
  }
  function roofTex(seed, light) {
    const c = document.createElement('canvas'); c.width = 64; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = light; g.fillRect(0, 0, 64, 256);
    for (let i = 0; i < 64; i += 4) { g.fillStyle = `rgba(0,0,0,${0.06 + 0.04 * Math.sin(i + seed)})`; g.fillRect(i, 0, 1.5, 256); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function buildSite(d) {
    const M = (c, r = 0.85, m = 0, ex) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ex });
    // desempenho: tudo o que é estático vai para um lote por material e vira UMA malha (poucas chamadas de desenho)
    const lots = new Map(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
    const put = (mat, geo, x, y, z, rx = 0, ry = 0, rz = 0) => {
      _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(1, 1, 1));
      let g = geo.index ? geo.toNonIndexed() : geo.clone(); g.applyMatrix4(_m); g.clearGroups();
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
      (lots.get(mat) || lots.set(mat, []).get(mat)).push(g);
    };
    const B = (w, h, dd) => new THREE.BoxGeometry(w, h, dd), PL = (w, h) => new THREE.PlaneGeometry(w, h);
    const flat = (mat, w, dd, x, y, z, ry = 0) => put(mat, PL(w, dd), x, y, z, -Math.PI / 2, 0, ry);
    // chão: terra, campos, mata e o asfalto das ruas (o chão de satélite fica embaixo, um pouco visível)
    const ground = new THREE.Mesh(PL(2400, 2000), M(0x8b6f4e, 1, 0, { transparent: true, opacity: 0.1 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05; site.add(ground);
    const AREA = { lot: [0xb9b4aa, 0.25], garden: [0x4f8a3a, 0.35], parking: [0x55585e, 0.3], forest: [0x2f5a2a, 0.0], field: [0x7f8f45, 0.0], dirt: [0xa86a3e, 0.0] };
    const areaMat = {}, trees = [];
    d.areas.forEach(a => {
      const [c, hgt] = AREA[a.t] || [0x888888, 0], w = a.x1 - a.x0, dd = a.z1 - a.z0;
      const mt = areaMat[a.t] || (areaMat[a.t] = M(c, 1, 0, { transparent: true, opacity: a.t === 'field' || a.t === 'dirt' ? 0.3 : a.t === 'forest' ? 0.6 : 0.85 }));
      const m = new THREE.Mesh(PL(w, dd), mt); m.rotation.x = -Math.PI / 2; m.position.set((a.x0 + a.x1) / 2, 0.12 + hgt, (a.z0 + a.z1) / 2); site.add(m);
      if (a.t === 'forest') { const n = Math.min(900, Math.round(w * dd / 70)); for (let i = 0; i < n; i++) trees.push([a.x0 + rand() * w, a.z0 + rand() * dd, 6 + rand() * 7]); }
    });
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M(0x3c6e33, 0.95), trees.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    trees.forEach(([x, z, h], i) => { m4.compose(new THREE.Vector3(x, h * 0.7, z), qq, new THREE.Vector3(h * 0.42, h * 0.38, h * 0.42)); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, new THREE.Color().setHSL(0.27 + rand() * 0.06, 0.45, 0.22 + rand() * 0.1)); });
    site.add(crowns);
    // ruas (OpenStreetMap) com faixa central na rodovia
    const asphalt = M(0x3d3f44, 0.95), line = new THREE.MeshBasicMaterial({ color: 0xf2d06b });
    d.ruas.forEach(r => {
      for (let i = 0; i < r.p.length - 1; i++) {
        const [x0, z0] = r.p[i], [x1, z1] = r.p[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.5) continue;
        const rz = -Math.atan2(z1 - z0, x1 - x0);
        put(asphalt, PL(L + r.w * 0.5, r.w), (x0 + x1) / 2, 0.25, (z0 + z1) / 2, -Math.PI / 2, 0, rz);
        if (r.w >= 14) put(line, PL(L, 0.3), (x0 + x1) / 2, 0.3, (z0 + z1) / 2, -Math.PI / 2, 0, rz);
      }
    });
    // prédios. Cores do SENAI conferidas no Street View (jul/2025): paredes brancas e faixa azul no topo
    const wallV = M(0xe9e6df, 0.9), wallS = M(0xf6f6f3, 0.75), blue = M(0x1f4fa8, 0.5), red = M(0xc8232c, 0.6), glass = M(0x5c7590, 0.15, 0.6), steel = M(0x8d949c, 0.4, 0.8), solar = M(0x1d2a4a, 0.25, 0.4);
    const white = M(0xf4f4f2, 0.6), concrete = M(0xa9a7a1, 0.9), lawn = M(0x5d8f3a, 1), walk = M(0xc4bfb6, 0.95), paver = M(0x8f8076, 1);
    const roofV = M(0xc9ccd0, 0.55, 0.35); roofV.map = roofTex(1, '#d4d7da');
    const roofS = M(0xd8dadd, 0.5, 0.45); roofS.map = roofTex(3, '#e2e4e6');
    const gableGeo = (b, wh) => {
      const along = b.w >= b.d, Lr = along ? b.w : b.d, Wr = along ? b.d : b.w, rh = b.h - wh;
      const sh = new THREE.Shape(); sh.moveTo(-Wr / 2, 0); sh.lineTo(Wr / 2, 0); sh.lineTo(0, rh); sh.closePath();
      const rg = new THREE.ExtrudeGeometry(sh, { depth: Lr, bevelEnabled: false }); rg.translate(0, 0, -Lr / 2); if (along) rg.rotateY(Math.PI / 2); return rg;
    };
    d.predios.forEach(b => {
      if (b.id === 'senai-portaria') return;                 // montada abaixo, com a marquise
      const isS = b.id.startsWith('senai');
      if (b.roof === 'solar') { for (let k = 0; k < 6; k++) put(solar, B(b.w / 6 - 0.6, 0.12, b.d), b.x - b.w / 2 + (k + 0.5) * b.w / 6, 1.3, b.z, -0.3); return; }
      if (b.roof === 'frame') {
        for (let i = 0; i <= 6; i++) { for (const sx of [-1, 1]) put(steel, B(0.4, b.h, 0.4), b.x + sx * b.w / 2, b.h / 2, b.z - b.d / 2 + i * b.d / 6); put(steel, B(b.w, 0.4, 0.4), b.x, b.h, b.z - b.d / 2 + i * b.d / 6); }
        return;
      }
      const wh = b.roof === 'gable' ? b.h * 0.72 : b.h;
      if (!isS) {                                          // vizinhos: tudo no lote (sem clique)
        put(wallV, B(b.w, wh, b.d), b.x, wh / 2, b.z);
        if (b.roof === 'gable') put(roofV, gableGeo(b, wh), b.x, wh, b.z);
        else { put(roofV, B(b.w - 0.6, 0.3, b.d - 0.6), b.x, b.h + 0.05, b.z); put(wallV, B(b.w + 0.2, 0.7, b.d + 0.2), b.x, b.h - 0.2, b.z); }
        return;
      }
      const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
      const add = (geo, mat, y) => { const o = new THREE.Mesh(geo, mat); o.position.y = y; g.add(o); };
      add(B(b.w, wh, b.d), wallS, wh / 2);
      if (b.roof === 'gable') { const o = new THREE.Mesh(gableGeo(b, wh), roofS); o.position.y = wh; g.add(o); }
      else add(B(b.w - 0.4, 0.3, b.d - 0.4), roofS, b.h + 0.05);
      const top = b.roof === 'gable' ? wh : b.h;
      add(B(b.w + 0.35, 1.3, b.d + 0.35), blue, top - 0.65);
      if (b.h >= 7) for (const fy of [1.9, 5.0]) add(B(b.w + 0.15, 1.1, b.d + 0.15), glass, fy);
      else if (b.h >= 4) add(B(b.w + 0.15, 1.0, b.d + 0.15), glass, 1.8);
      site.add(g);
      if (b.desc) hot.push({ b, g });
    });
    // portaria de pedestres: paredes vermelhas sob marquise branca, catracas, escadaria e rampa
    const por = d.predios.find(b => b.id === 'senai-portaria');
    if (por) {
      const g = new THREE.Group(); g.position.set(por.x, 0, por.z);
      const add = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); };
      add(B(por.w, 3.0, por.d), red, 0, 1.5, 0); add(B(por.w + 0.1, 1.0, por.d + 0.1), glass, 0, 1.7, 0);
      const mx0 = -por.w / 2 - 0.8, mx1 = por.w / 2 + 6, mz0 = -por.d / 2 - 1.5, mz1 = por.d / 2 + 2;
      add(B(mx1 - mx0, 0.45, mz1 - mz0), white, (mx0 + mx1) / 2, 3.8, (mz0 + mz1) / 2);
      for (const cz of [mz0 + 0.4, mz1 - 0.4]) add(new THREE.CylinderGeometry(0.15, 0.15, 3.6, 8), white, mx1 - 0.4, 1.8, cz);
      site.add(g); hot.push({ b: por, g });
      for (let k = 0; k < 4; k++) put(steel, B(0.25, 1.0, 1.2), por.x + por.w / 2 + 1.2 + k * 1.3, 0.5, por.z);
      for (let k = 0; k < 4; k++) put(walk, B(8, 0.18 * (k + 1), 0.9), -15, 0.09 * (k + 1), por.z - 1 - k * 0.9);
      flat(walk, 2.2, 10.5, -21.5, 0.52, -20);
    }
    // torre da caixa d'água: dois prismas de concreto (26 m e 23 m) com "SENAI" em vermelho no alto
    const TX = 9.8, TZ = -6.3, tower = new THREE.Group(); tower.position.set(TX, 0, TZ);
    for (const [dx, h] of [[-1.75, 26], [1.75, 23]]) { const o = new THREE.Mesh(B(3.0, h, 3.4), concrete); o.position.set(dx, h / 2, 0); tower.add(o); }
    { const o = new THREE.Mesh(B(0.6, 3, 2.4), concrete); o.position.y = 20.5; tower.add(o); }
    const tSign = new THREE.Mesh(PL(2.8, 0.75), new THREE.MeshBasicMaterial({ map: signTex('SENAI', '#a9a7a1', '#c8232c'), transparent: true }));
    tSign.position.set(-1.75, 24.2, 1.72); tower.add(tSign);
    const tSign2 = tSign.clone(); tSign2.position.set(3.27, 21.4, 0); tSign2.rotation.y = Math.PI / 2; tower.add(tSign2);
    site.add(tower); hot.push({ b: { id: 'senai-torre', x: TX, z: TZ, w: 6.5, d: 3.4, h: 26, desc: "Torre da caixa d'água (dois prismas de concreto)" }, g: tower });
    // totem vermelho levemente inclinado, com "SENAI" na vertical
    const totem = new THREE.Group(); totem.position.set(-23, 0, -2); totem.rotation.x = -0.07;
    { const o = new THREE.Mesh(B(1.3, 6.6, 0.55), red); o.position.y = 3.3; totem.add(o); }
    const vs = new THREE.Mesh(PL(4.6, 1.0), new THREE.MeshBasicMaterial({ map: signTex('SENAI', '#c8232c', '#ffffff') }));
    vs.rotation.z = Math.PI / 2; vs.position.set(0, 3.4, 0.29); totem.add(vs); site.add(totem);
    // cinco mastros com bandeiras, gramado, calçada, acesso de veículos em bloquete e gradil branco
    const flagCols = [0x009c3b, 0xffffff, 0xc8232c, 0xffffff, 0x1f4fa8].map(c => M(c, 0.8, 0, { side: THREE.DoubleSide }));
    flagCols.forEach((fm, k) => { const fx = -12.5 + k * 2.4; put(steel, new THREE.CylinderGeometry(0.05, 0.06, 10, 6), fx, 5, -9.5); put(fm, PL(1.6, 1.1), fx + 0.85, 9.2, -9.5); });
    flat(lawn, 50, 11, 0, 0.5, -7.5); flat(walk, 92, 2.4, 5, 0.5, -0.2); flat(paver, 6.5, 26, 27.2, 0.52, -12.5);
    const posts = [];
    for (let gx = -41; gx < 51; gx += 2.5) if (!(gx > -31 && gx < -12) && !(gx > 23.5 && gx < 31)) { posts.push(gx); put(white, B(2.5, 0.06, 0.04), gx + 1.25, 1.75, -1.6); put(white, B(2.5, 0.06, 0.04), gx + 1.25, 0.25, -1.6); }
    const fence = new THREE.InstancedMesh(B(0.08, 1.9, 0.08), white, posts.length * 6);
    let fi = 0; posts.forEach(gx => { for (let k = 0; k < 6; k++) { m4.makeTranslation(gx + k * 0.42, 0.95, -1.6); fence.setMatrixAt(fi++, m4); } });
    site.add(fence);
    for (const sx of [23.6, 30.9]) put(white, B(0.5, 2.4, 0.5), sx, 1.2, -1.6);
    for (const [x, z] of [[-6, -4], [14, -3], [34, -20], [-36, -18]]) { put(steel, new THREE.CylinderGeometry(0.08, 0.1, 9, 6), x, 4.5, z); put(steel, B(1.4, 0.2, 0.4), x + 0.6, 9, z); }
    // palmeiras (pátio interno e frente): troncos e folhas instanciados
    const palms = [];
    const pt = d.areas.find(a => a.id === 'patio');
    if (pt) for (let k = 0; k < 9; k++) palms.push([pt.x0 + 2 + (k % 2) * (pt.x1 - pt.x0 - 4), pt.z0 + 4 + Math.floor(k / 2) * 10, 7 + rand() * 4]);
    [[-8, -14], [-3, -6], [3, -13], [18, -16], [-34, -6], [40, -4]].forEach(([x, z]) => palms.push([x, z, 8 + rand() * 4]));
    const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.24, 1, 7), M(0x8a7a63, 0.9), palms.length);
    const leafGeo = new THREE.PlaneGeometry(4, 0.8); leafGeo.translate(2, 0, 0); leafGeo.rotateX(-Math.PI / 2);
    const leaves = new THREE.InstancedMesh(leafGeo, M(0x3f7a2c, 0.85, 0, { side: THREE.DoubleSide }), palms.length * 9);
    const eu = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    palms.forEach(([x, z, h], i) => {
      m4.compose(new THREE.Vector3(x, h / 2, z), qq, new THREE.Vector3(1, h, 1)); trunks.setMatrixAt(i, m4);
      for (let k = 0; k < 9; k++) { eu.set(0, k * 2 * Math.PI / 9 + i, -0.5, 'YXZ'); m4.compose(new THREE.Vector3(x, h, z), new THREE.Quaternion().setFromEuler(eu), one); leaves.setMatrixAt(i * 9 + k, m4); }
    });
    site.add(trunks, leaves);
    // carros (estacionamentos e junto ao meio-fio, como no Street View) e ônibus: instanciados, cor por instância
    const cars = [];
    const est = d.areas.find(a => a.id === 'estac');
    if (est) for (let i = 0; i < 18; i++) cars.push([est.x0 + 3 + (i % 3) * 6.2, est.z0 + 3 + Math.floor(i / 3) * 3.4, Math.PI / 2]);
    const ef = d.areas.find(a => a.id === 'estac-frente');
    if (ef) { [0, 1, 3, 4, 6].forEach(s => cars.push([ef.x0 + 2.2 + s * 2.5, ef.z0 + 3, Math.PI / 2])); for (let k = 0; k < 8; k++) flat(white, 0.15, 5, ef.x0 + 1 + k * 2.5, 0.46, ef.z0 + 3); }
    [-38, -31, -9, -3, 3, 15, 20].forEach(x => cars.push([x, 2.4, 0]));
    const carCols = [0xf2f2f2, 0x9aa1aa, 0x22262c, 0xc0392b, 0x2e5c9e, 0xd8d8d8];
    const carMesh = new THREE.InstancedMesh(B(4.3, 1.5, 1.8), M(0xffffff, 0.35, 0.5), cars.length), col = new THREE.Color();
    cars.forEach(([x, z, ry], i) => { m4.compose(new THREE.Vector3(x, 0.9, z), new THREE.Quaternion().setFromEuler(eu.set(0, ry, 0)), one); carMesh.setMatrixAt(i, m4); carMesh.setColorAt(i, col.set(carCols[i % 6])); });
    const buses = [[30, 0xf0c419], [44, 0xf0c419], [-62, 0xffffff], [-84, 0xd9282f], [-110, 0xffffff], [-190, 0xffffff], [-210, 0xd9282f]];
    const busMesh = new THREE.InstancedMesh(B(12.5, 3.2, 2.6), M(0xffffff, 0.4, 0.3), buses.length);
    buses.forEach(([x, c], i) => { busMesh.setMatrixAt(i, m4.makeTranslation(x, 1.7, 6.5)); busMesh.setColorAt(i, col.set(c)); });
    site.add(carMesh, busMesh);
    // junta cada lote numa malha só
    lots.forEach((gs, mat) => { const g = mergeGeometries(gs, false); gs.forEach(x => x.dispose()); if (g) site.add(new THREE.Mesh(g, mat)); });
    // rótulos: primeiro os pontos que mais chamam atenção
    const pri = ['senai-oficinas', 'senai-bloco-l', 'senai-torre', 'senai-bloco-o1'], rk = o => (pri.indexOf(o.b.id) + 1) || 9;
    hot.sort((a, b) => rk(a) - rk(b));
    site.userData.ready = true;
  }

  /* ---------- Rótulos e HUD ---------- */
  const labels = {};
  function label(key, pos, cam, text) {
    let el = labels[key];
    if (!el) { el = labels[key] = document.createElement('span'); el.className = 'cos-label'; $('.cos-labels').append(el); }
    if (!text) { el.classList.remove('on'); return; }
    const v = pos.clone().project(cam);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) { el.classList.remove('on'); return; }
    el.textContent = text; el.classList.add('on');
    el.style.transform = `translate(${(v.x + 1) / 2 * W}px, ${(1 - v.y) / 2 * H}px)`;
  }
  const hudEl = $('#cos-hud'), hudBar = $('#cos-hud-bar');
  function hud(text, k) { if (hudEl.textContent !== text) hudEl.textContent = text; hudBar.style.transform = `scaleX(${clamp(k ?? 0, 0, 1)})`; }
  function clearLabels(except) { Object.keys(labels).forEach(k => { if (!except || !k.startsWith(except)) labels[k].classList.remove('on'); }); }

  /* ---------- Capítulos 8 a 10: câmera da Terra até o SENAI ---------- */
  const tmp = new THREE.Vector3(), tgtW = N0.clone().multiplyScalar(RE);
  const BR = toVec(-12, -52), SP = toVec(-22.3, -48.6), IRA = toVec(-22.5869, -47.5161);
  const orbitAz = () => { /* ângulo da câmera em volta do SENAI */ };
  scenes.earth.updateEarth = (q, t) => {
    earthU.uLava.value = 1 - sstep(0.2, 0.55, q); earthU.uT.value = t; earthU.uCloud.value = 1; atmo.material.uniforms.uA.value = sstep(0.3, 0.6, q);
    // a câmera dá a volta na Terra e termina em cima do Brasil
    const a = lerp(-2.2, 0, ease(q)), d = RE * 3.4;
    tmp.copy(N0).applyAxisAngle(NORTH, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), a).normalize();
    ecam.position.copy(tmp).multiplyScalar(d).addScaledVector(NORTH, RE * 0.35 * (1 - q));
    ecam.up.copy(NORTH); ecam.lookAt(0, 0, 0);
    setNearFar(d - RE);
    hud(q < 0.35 ? 'Terra primitiva: oceano de magma' : q < 0.6 ? 'Esfria: crosta, oceanos e atmosfera' : 'Hoje: 71% da superfície é água', sstep(0, 1, q));
    clearLabels();
  };
  const hKm = q => Math.exp(lerp(Math.log(RE * 2.4), Math.log(0.55), q));
  scenes.zoom.updateZoom = (q, t) => {
    const k = ease(q), h = hKm(k);
    earthU.uLava.value = 0; atmo.material.uniforms.uA.value = 1; earthU.uCloud.value = sstep(5000, 13000, h);
    // inclina a câmera aos poucos no fim (vista oblíqua, como num drone)
    const tilt = sstep(0.75, 1, q) * 0.9;
    const up = N0.clone(), back = NORTH.clone().negate();
    const target = tgtW.clone();
    ecam.position.copy(target).addScaledVector(up, h * Math.cos(tilt)).addScaledVector(back, h * Math.sin(tilt));
    ecam.up.copy(NORTH); ecam.lookAt(target);
    setNearFar(h);
    tileFade(h);
    label('z-br', BR, ecam, h > 2500 && h < 15000 ? 'Brasil' : '');
    label('z-sp', SP, ecam, h > 250 && h < 2500 ? 'Estado de São Paulo' : '');
    label('z-ira', IRA, ecam, h > 3 && h < 250 ? 'Iracemápolis' : '');
    label('z-se', tgtW, ecam, h <= 3 ? 'SENAI' : '');
    $('#cos-alt').textContent = h >= 10 ? `${Math.round(h).toLocaleString('pt-BR')} km de altura` : `${(h * 1000).toFixed(0)} m de altura`;
    hud(h > 2500 ? 'América do Sul' : h > 250 ? 'Interior de São Paulo, a 160 km da capital' : h > 3 ? 'Iracemápolis · cerca de 24 mil habitantes' : 'Distrito Industrial II', 1 - Math.log(h / 0.55) / Math.log(RE * 2.4 / 0.55));
  };
  let orbit = null;
  scenes.senai.updateSenai = (q, t) => {
    tileFade(0.5);
    site.visible = !!site.userData.ready;
    const of = siteData && siteData.predios.find(b => b.id === 'senai-oficinas');
    const c = new THREE.Vector3(of ? of.x : 0, 0, of ? of.z + 40 : 0).multiplyScalar(0.001);
    const cw = local.localToWorld(c.clone());
    if (!orbit || !orbit.enabled) {
      const a = -Math.PI / 2 + lerp(0, 1.6, ease(q)) + (q >= 1 ? t * 0.03 : 0), dist = lerp(0.42, 0.2, ease(q)), hgt = lerp(0.42, 0.11, ease(q));
      const lp = c.clone().add(new THREE.Vector3(Math.cos(a) * dist, hgt, Math.sin(a) * dist));
      ecam.position.copy(local.localToWorld(lp)); ecam.up.copy(N0); ecam.lookAt(cw);
    }
    setNearFar(0.15);
    $('#cos-alt').textContent = 'Rua Camilo Ferrari, 765';
    hot.forEach((o, i) => label('s-' + i, local.localToWorld(new THREE.Vector3(o.b.x, o.b.h + 4, o.b.z).multiplyScalar(0.001)), ecam, q > 0.5 && (i < 4 || hoverIdx === i) ? short(o.b.desc) : ''));
    label('z-se', cw, ecam, '');
    hud('Escola SENAI "João Guilherme Sabino Ometto"', 1);
  };
  const short = s => s.split('(')[0].trim();
  function setNearFar(h) { ecam.near = Math.max(0.0008, h * 0.02); ecam.far = Math.max(h * 30, RE * 12); ecam.updateProjectionMatrix(); }
  function tileFade(h) {
    levels.forEach(L => {
      const k = sstep(L.size * 4.5, L.size * 2.2, h);
      L.mats.forEach(m => { m.opacity = m.userData.ok ? k : 0; });
      L.grp.visible = k > 0.001;
    });
    haze.material.opacity = 0;
  }

  /* =========================================================
     Linha do tempo, render e controles
     ========================================================= */
  const comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  const rp = new RenderPass(scenes.bang, cams.bang); comp.addPass(rp);
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.7, 0.5, 0.75); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, view.clientWidth); H = Math.max(1, view.clientHeight);
    renderer.setSize(W, H, false); comp.setPixelRatio(PR); comp.setSize(W, H);
    Object.values(cams).forEach(c => { c.aspect = W / H; c.updateProjectionMatrix(); });
    allPtsMats.forEach(m => (m.uniforms.uPx.value = H * PR / (2 * Math.tan(THREE.MathUtils.degToRad(27)))));
  }
  let t = 0, playing = true, on = false, raf = 0, last = 0, actIdx = -1, hoverIdx = -1;
  const range = $('#cos-time'), playBtn = $('#cos-play'), chips = $('#cos-chips'), fade = $('.cos-fade');
  ACTS.forEach((a, i) => { const b = document.createElement('button'); b.textContent = a.title.split(' · ')[0]; b.dataset.i = i; chips.append(b); });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; t = T_ACT[+b.dataset.i] + 0.01; if (orbit) orbit.enabled = false; setPlay(true); });
  range.max = Math.round(TOTAL * 10);
  range.addEventListener('input', () => { t = +range.value / 10; if (orbit) orbit.enabled = false; });
  playBtn.addEventListener('click', () => setPlay(!playing));
  function setPlay(p) { playing = p; playBtn.innerHTML = `<svg class="i sm"><use href="#i-${p ? 'pause' : 'play'}"/></svg>`; }
  const capK = $('#cos-kicker'), capT = $('#cos-title'), capS = $('#cos-sub');
  function setAct(i) {
    if (i === actIdx) return;
    const prev = actIdx; actIdx = i;
    const a = ACTS[i];
    capK.textContent = a.kicker; capT.textContent = a.title; capS.textContent = a.sub;
    root.querySelector('.cos-cap').classList.remove('in'); void root.offsetWidth; root.querySelector('.cos-cap').classList.add('in');
    [...chips.children].forEach((b, k) => b.classList.toggle('on', k === i));
    root.dataset.act = a.id;
    clearLabels();
    // corte de cinema entre cenas diferentes: um clarão no Big Bang, um fade nos outros
    const sameScene = prev >= 0 && scenes[ACTS[prev].id] === scenes[a.id];
    if (!sameScene && prev >= 0) { fade.classList.remove('go'); void fade.offsetWidth; fade.classList.add('go'); }
    if (i >= 6) loadEarth();
    bloom.strength = i >= 7 ? 0.35 : 0.8; bloom.threshold = i >= 7 ? 0.85 : 0.6;
    renderer.toneMappingExposure = i >= 8 ? 1.1 : 1.0;
    $('#cos-alt').textContent = '';
    if (orbit) orbit.enabled = false;
    root.classList.toggle('free', false);
  }
  function actAt(tt) { let i = 0; while (i < ACTS.length - 1 && tt >= T_ACT[i + 1]) i++; return i; }
  function draw(dt) {
    const i = actAt(t), a = ACTS[i], q = clamp((t - T_ACT[i]) / a.dur, 0, 1);
    setAct(i);
    const sc = scenes[a.id];
    rp.scene = sc; rp.camera = cams[a.id];
    if (a.id === 'earth') sc.updateEarth(q, t);
    else if (a.id === 'zoom') sc.updateZoom(q, t);
    else if (a.id === 'senai') sc.updateSenai(q, t);
    else sc.update(q, t);
    if (a.id !== 'senai') site.visible = a.id === 'zoom' && q > 0.8 && !!site.userData.ready;
    if (a.id === 'earth') tileFade(1e9);
    comp.render(dt);
    range.value = Math.round(t * 10);
    $('#cos-clock').textContent = `${String(Math.floor(t / 60)).padStart(1, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')} / ${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, '0')}`;
  }
  function frame(now) {
    if (!on) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    if (playing && !(orbit && orbit.enabled)) {
      t += dt * (reduce ? 3 : 1);
      if (t >= TOTAL) { t = TOTAL; setPlay(false); freeOrbit(); }
    }
    if (orbit && orbit.enabled) orbit.update();
    draw(dt);
  }
  // no fim: a câmera fica livre para girar em volta do SENAI
  function freeOrbit() {
    if (!orbit) { orbit = new OrbitControls(ecam, canvas); orbit.enableDamping = true; orbit.minDistance = 0.04; orbit.maxDistance = 1.2; orbit.maxPolarAngle = 1.45; }
    const of = siteData && siteData.predios.find(b => b.id === 'senai-oficinas');
    orbit.target.copy(local.localToWorld(new THREE.Vector3(of ? of.x : 0, 0, of ? of.z + 40 : 0).multiplyScalar(0.001)));
    orbit.enabled = true; orbit.update(); root.classList.add('free');
  }
  // clique nas partes do SENAI: mostra o que funciona em cada prédio
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  canvas.addEventListener('pointermove', e => {
    if (actIdx !== ACTS.length - 1) return;
    const r = canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, ecam); const hits = ray.intersectObjects(hot.map(o => o.g), true);
    hoverIdx = hits.length ? hot.findIndex(o => o.g === hits[0].object.parent || o.g === hits[0].object) : -1;
    canvas.style.cursor = hoverIdx >= 0 ? 'pointer' : '';
  });
  canvas.addEventListener('click', () => {
    if (hoverIdx < 0) return;
    const o = hot[hoverIdx], box = $('#cos-info');
    box.innerHTML = `<b>${o.b.desc}</b><span>${o.b.w.toFixed(0)} m × ${o.b.d.toFixed(0)} m · cerca de ${o.b.h.toFixed(0)} m de altura</span>`;
    box.classList.add('on');
  });
  addEventListener('resize', () => { if (on) resize(); });
  $('#cos-fs')?.addEventListener('click', () => { const v = $('.cos-view'); (document.fullscreenElement ? document.exitFullscreen() : v.requestFullscreen?.())?.catch?.(() => {}); });
  document.addEventListener('fullscreenchange', () => setTimeout(resize, 60));
  demos.cosmos = {
    enter() { on = true; resize(); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); if (t >= TOTAL) t = 0; setPlay(true); },
    leave() { on = false; cancelAnimationFrame(raf); }
  };
  if ($('.slide[data-id="cosmos"]')?.classList.contains('active')) demos.cosmos.enter();
  if (TEST) window.IACosmos = { seek: x => { t = x; setPlay(false); if (orbit) orbit.enabled = false; }, acts: ACTS.map((a, i) => ({ id: a.id, t0: T_ACT[i], dur: a.dur })), total: TOTAL, state: () => ({ t, act: ACTS[actIdx]?.id, tiles: levels.reduce((s, L) => s + L.mats.filter(m => m.userData.ok).length, 0), site: !!site.userData.ready, siteMeshes: (() => { let n = 0; site.traverse(o => { if (o.isMesh) n++; }); return n; })(), hi: earthU.uHiOn.value }) };
}
