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
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { Sky } from 'three/addons/objects/Sky.js';

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
  { id: 'bang', dur: 11, kicker: '13,8 bilhões de anos atrás · 10⁻³² s', title: 'O Big Bang', sub: 'Não foi uma explosão no espaço: foi o próprio espaço que começou a crescer. Na inflação, ele se esticou mais de 10²⁶ vezes numa fração de segundo.' },
  { id: 'qgp', dur: 7, kicker: 'Primeiro milionésimo de segundo', title: 'A sopa de quarks', sub: 'Tão quente que nem prótons existiam: quarks e glúons livres, como o plasma recriado no acelerador LHC, do CERN.' },
  { id: 'nuc', dur: 7, kicker: 'Os 3 primeiros minutos', title: 'Nascem os primeiros núcleos', sub: 'Prótons (vermelho) e nêutrons (cinza) se juntam. O universo sai com cerca de 75% de hidrogênio e 25% de hélio, em massa.' },
  { id: 'cmb', dur: 10, kicker: '380 mil anos depois', title: 'A primeira luz', sub: 'O universo esfria a ~3.000 °C, os átomos se formam e a luz escapa. Ela chega até hoje como micro-ondas a 2,7 K, mapeadas pelo satélite Planck.' },
  { id: 'dark', dur: 6, kicker: 'De 380 mil a 100 milhões de anos', title: 'A Idade das Trevas', sub: 'Nenhuma estrela brilha. A matéria escura junta o gás, devagar, em fios e nós.' },
  { id: 'stars', dur: 9, kicker: '~200 milhões de anos', title: 'As primeiras estrelas', sub: 'Estrelas gigantes e azuis acendem. A luz delas abre bolhas no gás (a reionização) e, ao explodir, espalham carbono, oxigênio e ferro.' },
  { id: 'web', dur: 9, kicker: '~1 bilhão de anos', title: 'A teia cósmica', sub: 'Como nas simulações Millennium e IllustrisTNG: a matéria escura forma filamentos enormes, e as galáxias nascem nos cruzamentos.' },
  { id: 'mw', dur: 9, kicker: '~13,6 bilhões de anos atrás até hoje', title: 'A Via Láctea', sub: '100 a 400 bilhões de estrelas numa espiral barrada, com faixas de poeira e berçários de estrelas. O Sol fica num braço, a 26 mil anos-luz do centro.' },
  { id: 'sol', dur: 10, kicker: '4,6 bilhões de anos atrás', title: 'Nasce o Sistema Solar', sub: 'Uma nuvem de gás colapsa e o Sol acende. No disco em volta, anéis e lacunas, como os que o telescópio ALMA fotografou no HL Tau, mostram planetas se formando.' },
  { id: 'earth', dur: 13, kicker: '4,5 bilhões de anos atrás até hoje', title: 'A Terra', sub: 'Uma bola de lava. Um planeta do tamanho de Marte, Theia, bate nela, e os destroços formam a Lua. A Terra esfria, ganha oceanos, atmosfera e vida.' },
  { id: 'zoom', dur: 16, kicker: 'Hoje', title: 'Brasil · São Paulo · Iracemápolis', sub: 'Do espaço até o interior paulista: 22,58° S, 47,50° O.' },
  { id: 'senai', dur: 16, kicker: 'Rua Camilo Ferrari, 765 · Distrito Industrial II', title: 'SENAI Iracemápolis', sub: 'Escola SENAI "João Guilherme Sabino Ometto", reconstruída em 3D a partir de imagens de satélite, do OpenStreetMap e do Street View.' }
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
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; renderer.shadowMap.autoUpdate = false;
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

  /* ---------- Volumes: ruído 3D em textura (o filtro da GPU faz a interpolação: muito mais barato que ruído calculado) ---------- */
  const NOISE3 = (() => {
    const S = 64, d = new Uint8Array(S * S * S * 4);
    for (let i = 0; i < d.length; i++) d[i] = (rand() * 256) | 0;
    const tx = new THREE.Data3DTexture(d, S, S, S); tx.format = THREE.RGBAFormat; tx.minFilter = tx.magFilter = THREE.LinearFilter;
    tx.wrapS = tx.wrapT = tx.wrapR = THREE.RepeatWrapping; tx.unpackAlignment = 1; tx.needsUpdate = true; return tx;
  })();
  const VOL = /* glsl */`
    uniform sampler3D tN; uniform mat4 uIP, uCW; uniform float uT, uQ, uAsp;
    float tn(vec3 p){ return texture(tN, p * 0.015625).r; }
    vec4 tn4(vec3 p){ return texture(tN, p * 0.015625); }
    float fbmT(vec3 p){ return 0.5 * tn(p) + 0.25 * tn(p * 2.07 + 0.13) + 0.125 * tn(p * 4.11 + 0.37) + 0.0625 * tn(p * 8.13 + 0.71); }
    float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 rayDir(vec2 uv){ vec4 p = uIP * vec4(uv * 2.0 - 1.0, 1.0, 1.0); return normalize((uCW * vec4(p.xyz / p.w, 0.0)).xyz); }`;
  const FS_VS = `varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.99999, 1.0); }`;
  // fundo de tela inteira que conhece a câmera (os raios acompanham o movimento, como num volume de verdade)
  function bgQuad(frag, extra = {}) {
    const u = Object.assign({ tN: { value: NOISE3 }, uIP: { value: new THREE.Matrix4() }, uCW: { value: new THREE.Matrix4() }, uT: { value: 0 }, uQ: { value: 0 }, uAsp: { value: 16 / 9 } }, extra);
    const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: FS_VS, fragmentShader: VOL + frag, depthTest: false, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m); mesh.frustumCulled = false; mesh.renderOrder = -10;
    mesh.onBeforeRender = (r, s, cam) => { u.uIP.value.copy(cam.projectionMatrixInverse); u.uCW.value.copy(cam.matrixWorld); u.uAsp.value = cam.aspect; };
    return { mesh, u };
  }
  // brilho com raio anamórfico (lente de cinema) para estrelas e clarões
  const flareTex = (() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128; const g = c.getContext('2d');
    let gr = g.createRadialGradient(256, 64, 0, 256, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(192, 0, 128, 128);
    gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, 'rgba(140,180,255,0)'); gr.addColorStop(0.5, 'rgba(200,225,255,.9)'); gr.addColorStop(1, 'rgba(140,180,255,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(0, 61, 512, 6); g.fillRect(96, 63, 320, 2);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const flare = (col, s, op = 1) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: flareTex, color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); m.scale.set(s * 4, s, 1); return m; };

  // 1) Big Bang: um ponto, o clarão e a bola de fogo que é o próprio espaço se esticando (inflação)
  {
    const s = new THREE.Scene();
    const bg = bgQuad(/* glsl */`
      varying vec2 vUv;
      void main(){
        vec3 rd = rayDir(vUv), ro = cameraPosition;
        float R = 0.02 + 3.4 * (1.0 - exp(-uQ * 9.0)) + 1.4 * uQ;     // inflação: quase tudo no primeiro instante
        float b = dot(ro, rd), c = dot(ro, ro) - R * R, h = b * b - c;
        vec3 col = vec3(0.0); float T = 1.0;
        if (h > 0.0) {
          h = sqrt(h); float t0 = max(-b - h, 0.0), t1 = -b + h, dt = (t1 - t0) / 22.0, tt = t0 + dt * h12(gl_FragCoord.xy + uT);
          for (int i = 0; i < 22; i++) {
            vec3 p = ro + rd * tt; float r = length(p) / R;
            vec3 q = p / R * 2.6; q += (tn4(q * 1.7 + vec3(0.0, uT * 0.35, 0.0)).gba - 0.5) * 2.2;   // dobra o espaço (domain warp)
            float n = fbmT(q * 2.2 - vec3(uT * 0.25, 0.0, 0.0));
            float dens = smoothstep(0.45, 0.8, n) * (1.0 - smoothstep(0.7, 1.0, r)) * (0.35 + 1.2 * exp(-r * 4.0));
            float temp = clamp(1.15 - r * 0.9 - uQ * 0.55 + (n - 0.5) * 0.8, 0.0, 1.0);
            vec3 e = mix(vec3(0.42, 0.25, 1.0), vec3(0.75, 0.88, 1.25), smoothstep(0.25, 0.6, temp));
            e = mix(e, vec3(1.5, 1.4, 1.3), smoothstep(0.6, 0.95, temp)) * (0.35 + 1.4 * temp * temp);
            float a = dens * dt * 2.4; col += T * e * a; T *= exp(-a * 2.2); if (T < 0.03) break; tt += dt;
          }
        }
        vec2 uv = (vUv - 0.5) * vec2(uAsp, 1.0); float d = length(uv);
        float pre = 1.0 - smoothstep(0.0, 0.025, uQ), fl = exp(-uQ * 14.0) * smoothstep(0.0, 0.02, uQ);
        col += vec3(1.0, 0.97, 0.92) * (pre * 0.6 * exp(-d * 260.0) + fl * (2.2 * exp(-d * 2.2) + 6.0 * exp(-d * 18.0)));
        col += vec3(0.45, 0.65, 1.3) * fl * 2.5 * exp(-abs(uv.y) * 80.0) * exp(-abs(uv.x) * 1.2);   // raio anamórfico
        gl_FragColor = vec4(col, 1.0);
      }`);
    // fagulhas: matéria que voa junto com o espaço, esfriando
    const N = small ? 6000 : 12000, p = mkPoints(N, 1), dir = new Float32Array(N * 3), spd = new Float32Array(N);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize(); dir.set([v.x, v.y, v.z], i * 3); spd[i] = 0.3 + Math.pow(rand(), 0.6); p.geometry.attributes.aSize.setX(i, 0.01 + Math.pow(rand(), 6) * 0.025); }
    s.add(bg.mesh, p); scenes.bang = s; cams.bang = mkCam(55);
    const col = new THREE.Color(), hot = new THREE.Color(1.5, 1.5, 1.8), cool = new THREE.Color(0.9, 0.4, 0.2);
    scenes.bang.update = (q, t) => {
      bg.u.uQ.value = q; bg.u.uT.value = t;
      const a = 3.6 * (1 - Math.exp(-q * 9)) + 1.6 * q, pa = p.geometry.attributes.position, ca = p.geometry.attributes.aColor;
      for (let i = 0; i < N; i++) { const r = a * spd[i]; pa.setXYZ(i, dir[i * 3] * r, dir[i * 3 + 1] * r, dir[i * 3 + 2] * r); col.copy(hot).lerp(cool, clamp(q * 1.3, 0, 1)).multiplyScalar(sstep(0.02, 0.08, q) * 0.8); ca.setXYZ(i, col.r, col.g, col.b); }
      pa.needsUpdate = ca.needsUpdate = true;
      // câmera: puxa para trás no clarão (como nos documentários) e depois flutua dentro da expansão
      const pull = 6.5 + 2.5 * sstep(0.0, 0.25, q) - 3.0 * sstep(0.3, 1, q);
      cams.bang.position.set(Math.sin(t * 0.09) * 0.5, 0.35 + Math.sin(t * 0.13) * 0.1, pull); cams.bang.lookAt(0, 0, 0);
      hud(q < 0.05 ? 'Tudo o que existe, menor que um átomo' : 'Inflação: o espaço cresce 10²⁶ vezes em 10⁻³² s', sstep(0, 0.3, q));
    };
  }

  // 2) Sopa de quarks e glúons: plasma turbulento com quarks de três "cores" (carga de cor)
  {
    const s = new THREE.Scene();
    const bg = bgQuad(/* glsl */`
      varying vec2 vUv;
      void main(){
        vec3 rd = rayDir(vUv), ro = cameraPosition; vec3 col = vec3(0.0); float T = 1.0, dt = 0.32, tt = dt * h12(gl_FragCoord.xy + uT);
        for (int i = 0; i < 18; i++) {
          vec3 p = ro + rd * tt;
          vec3 w = (tn4(p * 0.55 + vec3(uT * 0.3, 0.0, uT * 0.2)).gba - 0.5) * 3.0;
          float n = fbmT(p * 0.9 + w + vec3(0.0, uT * 0.5, 0.0));
          float d = smoothstep(0.45, 0.85, n);
          vec3 e = mix(vec3(1.0, 0.38, 0.08), vec3(1.5, 1.25, 0.75), smoothstep(0.55, 0.9, n));
          e = mix(e, vec3(0.9, 0.25, 0.6), smoothstep(0.75, 0.95, tn(p * 3.0 + uT))) * mix(0.75, 0.45, uQ);
          float a = d * 0.22; col += T * e * a; T *= 1.0 - a; tt += dt;
        }
        gl_FragColor = vec4(col + vec3(0.06, 0.012, 0.004) * T, 1.0);
      }`);
    const N = small ? 3000 : 6000, p = mkPoints(N, 1), pa = p.geometry.attributes, P = new Float32Array(N * 3), PH = new Float32Array(N);
    const QC = [[1.6, 0.25, 0.2], [0.3, 1.5, 0.35], [0.35, 0.5, 1.7]];
    for (let i = 0; i < N; i++) { P.set([gauss() * 2.2, gauss() * 1.4, gauss() * 2.2], i * 3); PH[i] = rand() * 100; const c = QC[i % 3]; pa.aColor.setXYZ(i, c[0], c[1], c[2]); pa.aSize.setX(i, 0.025 + Math.pow(rand(), 5) * 0.03); }
    s.add(bg.mesh, p); scenes.qgp = s; cams.qgp = mkCam(55);
    scenes.qgp.update = (q, t) => {
      bg.u.uQ.value = q; bg.u.uT.value = t;
      const bind = sstep(0.55, 1, q);                                     // no fim, os quarks se prendem em trios (prótons e nêutrons)
      for (let i = 0; i < N; i++) {
        const j = i - (i % 3), k = PH[i] + t * 2.2, tr = 0.18 * (1 - bind) + 0.025;
        const cx = P[j * 3], cy = P[j * 3 + 1], cz = P[j * 3 + 2];
        pa.position.setXYZ(i, lerp(P[i * 3], cx, bind) + Math.sin(k * 1.3) * tr, lerp(P[i * 3 + 1], cy, bind) + Math.cos(k * 1.7) * tr, lerp(P[i * 3 + 2], cz, bind) + Math.sin(k * 0.9) * tr);
      }
      pa.position.needsUpdate = true;
      cams.qgp.position.set(Math.sin(t * 0.06) * 4.2, 0.6, Math.cos(t * 0.06) * 4.2 - q * 1.5); cams.qgp.lookAt(0, 0, 0);
      hud(q < 0.55 ? 'Quarks livres a ~4 trilhões de °C' : 'Esfriou: três quarks formam cada próton e nêutron', sstep(0, 1, q));
    };
  }

  // 3) Nucleossíntese: prótons e nêutrons que se juntam em núcleos de hélio (2p + 2n), no meio da névoa que esfria
  {
    const s = new THREE.Scene(), N = small ? 900 : 1600;
    const bg = bgQuad(/* glsl */`
      varying vec2 vUv;
      void main(){ vec3 d = rayDir(vUv); float n = fbmT(d * 3.0 + vec3(uT * 0.05, 0.0, 0.0) + 11.0);
        vec3 c = mix(vec3(0.55, 0.16, 0.03), vec3(0.95, 0.5, 0.16), smoothstep(0.3, 0.8, n)) * mix(0.9, 0.45, uQ);
        gl_FragColor = vec4(c, 1.0); }`);
    const geo = new THREE.SphereGeometry(0.05, 14, 10);
    const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.0, clearcoat: 0.6, sheen: 0.4 });
    const im = new THREE.InstancedMesh(geo, mat, N);
    const P = [], G = [], KIND = [];
    const groups = Math.floor(N * 0.07);
    for (let i = 0; i < N; i++) { P.push(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1.6)); KIND.push(rand() < 0.86 ? 0 : 1); G.push(-1); }
    const tet = [new THREE.Vector3(1, 1, 1), new THREE.Vector3(-1, -1, 1), new THREE.Vector3(-1, 1, -1), new THREE.Vector3(1, -1, -1)].map(v => v.multiplyScalar(0.045));
    const centers = [];
    for (let g = 0; g < groups; g++) { centers.push(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1.4)); for (let k = 0; k < 4; k++) { const i = g * 4 + k; G[i] = g; KIND[i] = k < 2 ? 0 : 1; } }
    const cP = new THREE.Color(0.95, 0.27, 0.24), cN = new THREE.Color(0.56, 0.64, 0.72);
    for (let i = 0; i < N; i++) im.setColorAt(i, KIND[i] ? cN : cP);
    s.add(bg.mesh, im, new THREE.AmbientLight(0x6070a0, 0.5), new THREE.HemisphereLight(0xffb070, 0x301008, 1.2));
    const L = new THREE.PointLight(0xffe0b0, 40, 0, 1.6); L.position.set(2, 2, 3); s.add(L);
    scenes.nuc = s; cams.nuc = mkCam(50);
    const m4 = new THREE.Matrix4(), v = new THREE.Vector3(), q4 = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    scenes.nuc.update = (q, t) => {
      bg.u.uQ.value = q; bg.u.uT.value = t;
      const bind = sstep(0.25, 0.8, q);
      for (let i = 0; i < N; i++) {
        const j = Math.sin(t * 3 + i * 1.7) * 0.03;
        v.copy(P[i]).addScaledVector(P[i], 0.08 * Math.sin(t * 0.7 + i)).addScalar(j);
        if (G[i] >= 0) { const tg = centers[G[i]].clone().addScaledVector(centers[G[i]], 0.05 * Math.sin(t)).add(tet[i % 4]); v.lerp(tg, bind); }
        m4.compose(v, q4, one); im.setMatrixAt(i, m4);
      }
      im.instanceMatrix.needsUpdate = true;
      cams.nuc.position.set(Math.cos(t * 0.15) * 5.2, 1.2, Math.sin(t * 0.15) * 5.2); cams.nuc.lookAt(0, 0, 0);
      hud(`Hidrogênio ${Math.round(100 - 25 * bind)}% · Hélio ${Math.round(25 * bind)}% (em massa)`, bind);
    };
  }

  // 4) Recombinação: a névoa laranja de 3.000 K clareia e o céu vira o mapa do satélite Planck, que "desenrola" em elipse (Mollweide)
  {
    const s = new THREE.Scene();
    const bg = bgQuad(/* glsl */`
      uniform float uFog, uMap; varying vec2 vUv;
      vec3 planck(float x){
        vec3 a = vec3(0.0, 0.03, 0.35), b = vec3(0.1, 0.45, 0.95), c = vec3(0.95, 0.9, 0.78), d = vec3(1.0, 0.55, 0.12), e = vec3(0.71, 0.2, 0.16);
        return x < 0.25 ? mix(a, b, x / 0.25) : x < 0.5 ? mix(b, c, (x - 0.25) / 0.25) : x < 0.75 ? mix(c, d, (x - 0.5) / 0.25) : mix(d, e, (x - 0.75) / 0.25); }
      float cmb(vec3 d){ return fbmT(d * 9.0 + 3.0) * 0.55 + fbmT(d * 26.0 + 17.0) * 0.45; }
      void main(){
        vec3 d = rayDir(vUv);
        vec3 sky = planck(clamp((cmb(d) - 0.47) * 4.5 + 0.5, 0.0, 1.0)) * 0.55;
        vec3 plasma = vec3(1.0, 0.62, 0.3) * (0.55 + 0.35 * fbmT(d * 3.0 + uT * 0.15));
        vec3 col = mix(sky, plasma, uFog);
        if (uMap > 0.0) {                                   // projeção de Mollweide do céu inteiro, como na imagem da ESA
          vec2 m = (vUv - 0.5) * 2.0 * vec2(uAsp, 1.0) / mix(3.2, 1.0, uMap);
          float X = m.x / 1.6 * 2.8284, Y = m.y / 0.8 * 1.4142;
          vec3 mapc = vec3(0.0);
          if (X * X / 8.0 + Y * Y / 2.0 <= 1.0) {
            float th = asin(clamp(Y / 1.4142, -1.0, 1.0)), lat = asin(clamp((2.0 * th + sin(2.0 * th)) / 3.14159, -1.0, 1.0)), lon = 3.14159 * X / (2.8284 * cos(th)) + uT * 0.02;
            vec3 dd = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
            mapc = planck(clamp((cmb(dd) - 0.47) * 4.5 + 0.5, 0.0, 1.0)) * 0.42;
          } else { float e = X * X / 8.0 + Y * Y / 2.0; mapc = vec3(0.03, 0.035, 0.05) * smoothstep(1.06, 1.0, e); }
          col = mix(col, mapc, smoothstep(0.0, 0.6, uMap));
        }
        gl_FragColor = vec4(col, 1.0);
      }`, { uFog: { value: 1 }, uMap: { value: 0 } });
    s.add(bg.mesh); scenes.cmb = s; cams.cmb = mkCam(70, 0.1, 200);
    scenes.cmb.update = (q, t) => {
      bg.u.uT.value = t; bg.u.uFog.value = 1 - sstep(0.08, 0.4, q); bg.u.uMap.value = sstep(0.5, 0.92, q);
      cams.cmb.position.set(0, 0, 0); cams.cmb.rotation.set(0.1 * Math.sin(t * 0.2), t * 0.05, 0); cams.cmb.updateMatrixWorld();
      hud(q < 0.4 ? 'Plasma a 3.000 °C: a luz fica presa' : q < 0.55 ? 'Os átomos se formam e a luz escapa' : 'O céu inteiro visto pelo satélite Planck (ESA): azul mais frio, vermelho mais quente', sstep(0.08, 0.9, q));
    };
  }

  // 5) Idade das Trevas e 6) primeiras estrelas + reionização: o mesmo gás, primeiro escuro, depois furado por bolhas de luz
  const darkFrag = /* glsl */`
    uniform vec4 uS[10]; uniform float uOn; varying vec2 vUv;
    float web(vec3 p){ float n = fbmT(p * 0.6); return pow(1.0 - abs(2.0 * n - 1.0), 6.0); }     // filamentos (ruído "ridged")
    void main(){
      vec3 rd = rayDir(vUv), ro = cameraPosition; vec3 col = vec3(0.0); float T = 1.0, dt = 0.9, tt = dt * h12(gl_FragCoord.xy + uT);
      for (int i = 0; i < 20; i++) {
        vec3 p = ro + rd * tt;
        float f = web(p + vec3(0.0, 0.0, uT * 0.05)), neut = 0.25 + 0.75 * f;
        vec3 e = mix(vec3(0.05, 0.035, 0.03), vec3(0.23, 0.16, 0.11), f) * (0.07 + 0.25 * uOn);
        float ion = 0.0; vec3 rim = vec3(0.0);
        for (int k = 0; k < 10; k++) {
          float r = uS[k].w; if (r <= 0.0) continue;
          float dd = length(p - uS[k].xyz) + (fbmT(p * 1.3) - 0.5) * r * 0.6;
          ion = max(ion, smoothstep(r, r * 0.8, dd));
          rim += vec3(0.6, 0.78, 1.25) * exp(-abs(dd - r) * 4.0) * 0.12;
        }
        float a = neut * (1.0 - ion) * 0.16 * dt;
        col += T * (e * (1.0 - ion) + rim * neut * uOn) * a * 4.0;
        T *= exp(-a); tt += dt;
      }
      gl_FragColor = vec4(col, 1.0);
    }`;
  {
    const s = new THREE.Scene(), bg = bgQuad(darkFrag, { uS: { value: Array.from({ length: 10 }, () => new THREE.Vector4()) }, uOn: { value: 0 } });
    s.add(bg.mesh); scenes.dark = s; cams.dark = mkCam(60, 0.05, 300);
    scenes.dark.update = (q, t) => {
      bg.u.uT.value = t; bg.u.uOn.value = 0;
      cams.dark.position.set(Math.sin(t * 0.03) * 2, 0.5, 14 - q * 5); cams.dark.lookAt(0, 0, -20);
      hud('Nenhuma estrela ainda: só hidrogênio, hélio e matéria escura', sstep(0, 1, q));
    };
  }
  {
    const s = new THREE.Scene(), SP = [];
    for (let k = 0; k < 10; k++) SP.push({ p: new THREE.Vector3(gauss() * 5, gauss() * 2.5, -4 - rand() * 18), at: 0.08 + k * 0.06 + rand() * 0.03 });
    const bg = bgQuad(darkFrag, { uS: { value: SP.map(() => new THREE.Vector4()) }, uOn: { value: 1 } });
    const fl = SP.map(o => { const f = flare(0xa8c4ff, 1, 0); f.position.copy(o.p); s.add(f); const c = sprite(0xd8e6ff, 1, 0); c.position.copy(o.p); s.add(c); return { f, c }; });
    s.add(bg.mesh); scenes.stars = s; cams.stars = mkCam(60, 0.05, 300);
    scenes.stars.update = (q, t) => {
      bg.u.uT.value = t;
      SP.forEach((o, k) => {
        const e = q - o.at, on = e > 0 ? 1 : 0, r = on ? (0.6 + Math.pow(e, 0.8) * 13) : 0;
        bg.u.uS.value[k].set(o.p.x, o.p.y, o.p.z, r);
        const pop = e > 0 ? Math.exp(-e * 9) * 3 : 0;
        fl[k].f.material.opacity = on * (0.35 + pop * 0.3); fl[k].f.scale.set((1.4 + pop * 3) * 4, 1.4 + pop * 3, 1);
        fl[k].c.material.opacity = on * 0.8; fl[k].c.scale.setScalar(0.5 + pop * 1.2);
      });
      cams.stars.position.set(Math.sin(t * 0.03) * 2, 0.5, 9 - q * 4); cams.stars.lookAt(0, 0, -20);
      hud(q < 0.45 ? 'Estrelas de até 300 vezes a massa do Sol, azuis e quentíssimas' : 'Reionização: a luz delas abre bolhas no gás neutro', sstep(0.05, 1, q));
    };
  }

  // 7) Teia cósmica (paleta das simulações IllustrisTNG/Millennium): vazios escuros, filamentos azul-esverdeados, nós brancos
  {
    const s = new THREE.Scene(), NODES = 52, NP = small ? 30000 : 60000, BOX = 9;
    const nodes = []; for (let i = 0; i < NODES; i++) nodes.push(new THREE.Vector3((rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX));
    const edges = [];
    nodes.forEach((a, i) => { nodes.map((b, j) => [a.distanceTo(b), j]).sort((x, y) => x[0] - y[0]).slice(1, 4).forEach(([, j]) => { if (i < j) edges.push([i, j]); }); });
    const p = mkPoints(NP, 1), pa = p.geometry.attributes, base = new Float32Array(NP);
    const cVoid = new THREE.Color(0.12, 0.2, 0.55), cFil = new THREE.Color(0.25, 0.65, 0.63), cWarm = new THREE.Color(0.9, 0.83, 0.35), cNode = new THREE.Color(1.3, 1.25, 1.15), c = new THREE.Color();
    for (let i = 0; i < NP; i++) {
      let v; const u = rand();
      if (u < 0.2) { const n = nodes[(rand() * NODES) | 0], r = Math.abs(gauss()) * 0.32; v = n.clone().add(new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(r)); c.copy(cWarm).lerp(cNode, Math.exp(-r * 6)); }
      else if (u < 0.9) { const [a, b] = edges[(rand() * edges.length) | 0], w = rand(), sp = 0.08 + 0.12 * Math.sin(w * Math.PI); v = nodes[a].clone().lerp(nodes[b], w).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(sp)); c.copy(cFil).lerp(cWarm, Math.pow(1 - Math.sin(w * Math.PI), 3) * 0.8); }
      else { v = new THREE.Vector3((rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX); c.copy(cVoid).multiplyScalar(0.35); }
      pa.position.setXYZ(i, v.x, v.y, v.z); base[i] = 0.25 + Math.pow(rand(), 3); pa.aColor.setXYZ(i, c.r, c.g, c.b); pa.aSize.setX(i, 0.02 + Math.pow(rand(), 7) * 0.08);
    }
    const cols = Float32Array.from(pa.aColor.array);
    s.add(p); nodes.forEach(n => { const g = sprite(0xffe9c8, 0.7, 0.45); g.position.copy(n); s.add(g); });
    const tgt = nodes.reduce((best, n) => n.length() < best.length() ? n : best, nodes[0]);
    scenes.web = s; cams.web = mkCam(60, 0.01, 400);
    scenes.web.update = (q, t) => {
      const k = sstep(0, 0.5, q);
      for (let i = 0; i < NP; i++) { const b = base[i] * (0.25 + 1.15 * k); pa.aColor.setXYZ(i, cols[i * 3] * b, cols[i * 3 + 1] * b, cols[i * 3 + 2] * b); }
      pa.aColor.needsUpdate = true;
      // zoom contínuo e exponencial até um nó (como o "Millennium Run")
      const dist = Math.exp(lerp(Math.log(22), Math.log(1.6), ease(q))), a = t * 0.04 + 0.6;
      cams.web.position.set(tgt.x + Math.cos(a) * dist, tgt.y + dist * 0.25, tgt.z + Math.sin(a) * dist); cams.web.lookAt(tgt);
      hud('Cada ponto claro é uma galáxia inteira', k);
    };
  }

  // 8) Via Láctea: espiral barrada com faixas de poeira, berçários rosados e o "você está aqui"
  {
    const s = new THREE.Scene(), N = small ? 50000 : 90000, p = mkPoints(N, 1), pa = p.geometry.attributes;
    const cB = new THREE.Color(1.0, 0.86, 0.62), cA = new THREE.Color(0.62, 0.77, 1.0), cH = new THREE.Color(1.0, 0.43, 0.66), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rand(); let x, y, z, sz = 0.03 + Math.pow(rand(), 8) * 0.1;
      if (u < 0.22) { const r = Math.abs(gauss()) * 0.9; const a = rand() * TAU; x = Math.cos(a) * r * 1.6; z = Math.sin(a) * r * 0.7; y = gauss() * 0.25 * Math.exp(-r); c.copy(cB); }
      else {
        const k = rand() < 0.5 ? 0 : Math.PI, r = 1.4 + Math.pow(rand(), 0.8) * 8.5, th = k + 3.6 * Math.log(r / 1.4) + gauss() * (0.12 + 0.03 * r);
        x = Math.cos(th) * r; z = Math.sin(th) * r; y = gauss() * 0.06; c.copy(cA).lerp(cB, Math.exp(-r / 2.5)); if (rand() < 0.05 && r > 3) { c.copy(cH); sz *= 2.2; }
      }
      pa.position.setXYZ(i, x, y, z); const b = 0.25 + Math.pow(rand(), 3) * 0.9; pa.aColor.setXYZ(i, c.r * b, c.g * b, c.b * b); pa.aSize.setX(i, sz);
    }
    // poeira: multiplica (escurece) o que já foi desenhado, seguindo os braços um pouco por dentro
    const dust = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.ShaderMaterial({
      uniforms: { tN: { value: NOISE3 } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler3D tN; varying vec2 vP;
        void main(){ float r = length(vP), th = atan(vP.y, vP.x);
          float arm = 0.5 + 0.5 * cos(2.0 * (th - 3.6 * log(max(r, 0.3) / 1.4)) - 0.55);
          float n = texture(tN, vec3(vP * 0.06, 0.3)).r * 0.6 + texture(tN, vec3(vP * 0.17, 0.7)).r * 0.4;
          float dd = pow(arm, 5.0) * smoothstep(1.2, 2.2, r) * smoothstep(10.5, 6.0, r) * smoothstep(0.35, 0.7, n);
          gl_FragColor = vec4(mix(vec3(1.0), vec3(0.32, 0.22, 0.16), dd * 0.85), 1.0); }`
    }));
    dust.rotation.x = -Math.PI / 2; dust.renderOrder = 5; p.add(dust);
    const core = sprite(0xffe2b5, 5.5, 0.65), sun = sprite(0xfff1c0, 0.5, 1);
    const sunR = 5.6, sunA = 3.6 * Math.log(sunR / 1.4) + 0.35; sun.position.set(Math.cos(sunA) * sunR, 0, Math.sin(sunA) * sunR);
    s.add(p, core, sun, starfield(2500, 300, 0.6)); scenes.mw = s; cams.mw = mkCam(50, 0.05, 900);
    scenes.mw.update = (q, t) => {
      p.rotation.y = t * 0.03; sun.position.set(Math.cos(sunA + t * 0.03) * sunR, 0, Math.sin(sunA + t * 0.03) * sunR);
      const sp = sun.position.clone();
      const far = new THREE.Vector3(0, 15, 9), near = sp.clone().add(new THREE.Vector3(0, 1.4, 2.2));
      const k = ease(sstep(0.35, 1, q));
      cams.mw.position.copy(far).lerp(near, k); cams.mw.lookAt(new THREE.Vector3().lerp(sp, k));
      sun.scale.setScalar(0.4 + 0.3 * Math.sin(t * 4) ** 2);
      label('mw', sp, cams.mw, q > 0.3 ? 'Você está aqui: o Sol' : '');
      hud('26 mil anos-luz do centro', k);
    };
  }

  // 9) Sistema Solar: nuvem que colapsa, protoestrela com jatos e o disco com anéis e lacunas (como o HL Tau visto pelo ALMA)
  {
    const s = new THREE.Scene(), N = small ? 16000 : 30000, p = mkPoints(N, 1), pa = p.geometry.attributes;
    const R = new Float32Array(N), A = new Float32Array(N), Y = new Float32Array(N), R0 = new Float32Array(N);
    const gaps = [1.0, 1.5, 2.1, 2.9, 4.4, 5.8, 7.1, 8.4];
    for (let i = 0; i < N; i++) { R[i] = 0.5 + Math.pow(rand(), 0.7) * 9; R0[i] = 6 + rand() * 14; A[i] = rand() * TAU; Y[i] = gauss() * 0.04 * R[i]; const w = 0.4 + Math.pow(rand(), 2); pa.aColor.setXYZ(i, w, w * 0.62, w * 0.36); pa.aSize.setX(i, 0.02 + Math.pow(rand(), 6) * 0.05); }
    const disk = new THREE.Mesh(new THREE.RingGeometry(0.3, 9.5, 160, 1), new THREE.ShaderMaterial({
      uniforms: { tN: { value: NOISE3 }, uT: { value: 0 }, uA: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler3D tN; uniform float uT, uA; varying vec2 vP;
        void main(){ float r = length(vP), th = atan(vP.y, vP.x) + uT * 0.6 / pow(max(r, 0.4), 1.5);     // rotação de Kepler: dentro gira mais rápido
          float g = 1.0;
          g *= 1.0 - 0.85 * exp(-pow((r - 1.5) / 0.12, 2.0)); g *= 1.0 - 0.8 * exp(-pow((r - 2.9) / 0.16, 2.0)); g *= 1.0 - 0.85 * exp(-pow((r - 4.4) / 0.2, 2.0));
          g *= 1.0 - 0.7 * exp(-pow((r - 5.8) / 0.18, 2.0)); g *= 1.0 - 0.75 * exp(-pow((r - 7.1) / 0.2, 2.0));
          float n = texture(tN, vec3(cos(th) * r * 0.12, sin(th) * r * 0.12, r * 0.05)).r;
          float I = exp(-r / 3.2) * g * (0.75 + 0.5 * n) * smoothstep(0.3, 0.8, r) * smoothstep(9.5, 7.5, r);
          vec3 c = mix(vec3(1.0, 0.42, 0.1), vec3(1.4, 1.0, 0.6), exp(-r / 1.2));
          gl_FragColor = vec4(c * I * 2.2 * uA, 1.0); }`
    }));
    disk.rotation.x = -Math.PI / 2;
    const sunM = new THREE.Mesh(new THREE.SphereGeometry(0.35, 48, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 1.2) }));
    const sunG = sprite(0xffcf80, 4, 0.9), sunF = flare(0xffe0b0, 2.2, 0);
    const jets = [1, -1].map(sg => { const j = sprite(0x9fc4ff, 1, 0); j.center.set(0.5, sg > 0 ? 0 : 1); s.add(j); return j; });
    const PL = [[0.10, 0x9f9f9f], [0.13, 0xe8c48f], [0.14, 0x4f8fff], [0.11, 0xc65a3a], [0.4, 0xd8b48a], [0.34, 0xe6d3a2], [0.22, 0x9fe3ec], [0.21, 0x5b7cff]];
    const planets = PL.map(([r, c], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })); s.add(m); return { m, a: rand() * TAU, R: gaps[i] }; });
    const L = new THREE.PointLight(0xfff0d8, 60, 0, 1.2);
    s.add(p, disk, sunM, sunG, sunF, L, new THREE.AmbientLight(0x202030, 1), starfield(2500, 300, 0.7));
    scenes.sol = s; cams.sol = mkCam(50, 0.05, 900);
    scenes.sol.update = (q, t) => {
      const fall = sstep(0.0, 0.35, q), clear = sstep(0.62, 1, q);
      for (let i = 0; i < N; i++) {
        const r1 = lerp(R0[i], R[i], fall), w = 0.5 / Math.pow(r1, 1.5), a = A[i] + t * w * 2 + (1 - fall) * 2.5 / r1;
        let r = r1; gaps.forEach(gp => { const d = r - gp; r += clear * 0.25 * Math.sign(d) * Math.exp(-d * d / 0.05) * 0.4; });
        pa.position.setXYZ(i, Math.cos(a) * r, Y[i] * (1 - 0.5 * clear) * (1 + (1 - fall) * 20), Math.sin(a) * r);
      }
      pa.position.needsUpdate = true; p.material.uniforms.uAlpha.value = (1 - 0.8 * clear) * (0.5 + 0.5 * (1 - sstep(0.35, 0.6, q)));
      const on = sstep(0.22, 0.42, q); sunM.scale.setScalar(0.2 + on); sunG.material.opacity = on; sunF.material.opacity = on * 0.8; L.intensity = 60 * on;
      disk.material.uniforms.uT.value = t; disk.material.uniforms.uA.value = sstep(0.3, 0.5, q) * (1 - 0.7 * clear);
      const jt = sstep(0.25, 0.4, q) * (1 - sstep(0.6, 0.8, q));
      jets.forEach((j, k) => { j.material.opacity = jt * 0.8; j.scale.set(0.35, 5 * jt + 0.01, 1); j.position.set(0, 0, 0); });
      planets.forEach((o, i) => { const g = sstep(0.6 + i * 0.03, 0.72 + i * 0.03, q); o.m.scale.setScalar(Math.max(g, 0.001)); const a = o.a + t * 0.4 / Math.pow(o.R, 1.5); o.m.position.set(Math.cos(a) * o.R, 0, Math.sin(a) * o.R); });
      const e = planets[2].m.position;
      const tilt = lerp(0.12, 0.55, ease(sstep(0.0, 0.7, q))), d = lerp(15, 12, q);
      cams.sol.position.set(Math.sin(t * 0.02) * 2, Math.sin(tilt) * d, Math.cos(tilt) * d); cams.sol.lookAt(0, 0, 0);
      label('sol', e, cams.sol, q > 0.75 ? 'Terra' : '');
      hud(q < 0.25 ? 'Uma nuvem de gás e poeira colapsa' : q < 0.62 ? 'O Sol nasce; no disco, os anéis e lacunas mostram planetas se formando' : 'Os planetas varrem o disco', sstep(0.05, 1, q));
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
        vec4 ct = texture2D(tClouds, vUv + vec2(uT * 0.0004, 0.0)); float cl = ct.r * ct.a;   // o PNG guarda lixo no RGB onde é transparente
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
  // céu físico (espalhamento Rayleigh + Mie) com o "para cima" de Iracemápolis, e o mesmo céu como luz ambiente (PMREM)
  const sky = new Sky(); sky.scale.setScalar(40); sky.visible = false; sky.renderOrder = -5; sky.frustumCulled = false;
  sky.material.uniforms.turbidity.value = 5.5; sky.material.uniforms.rayleigh.value = 1.4;
  sky.material.uniforms.mieCoefficient.value = 0.004; sky.material.uniforms.mieDirectionalG.value = 0.8; sky.material.uniforms.sunPosition.value.copy(SUN); sky.material.uniforms.up.value.copy(N0);
  es.add(sky);
  let envTex = null;
  function makeEnv() {
    if (envTex) return; const ps = new THREE.Scene(), sk = new Sky(); sk.scale.setScalar(100); Object.keys(sky.material.uniforms).forEach(k => sk.material.uniforms[k].value = sky.material.uniforms[k].value);
    ps.add(sk); const pm = new THREE.PMREMGenerator(renderer); envTex = pm.fromScene(ps, 0, 0.1, 1000).texture; pm.dispose();
  }
  es.fog = new THREE.Fog(0xa9c1dc, 1e8, 1e9);                // só "liga" no capítulo da escola (sem recompilar shaders)
  // Sol com sombras só no lote: calculadas uma vez (a cena é parada), custo zero por quadro
  const SUNL = new THREE.Vector3(SUN.dot(EAST) * 1.7, SUN.dot(N0), -SUN.dot(NORTH) * 1.7).normalize();   // sol de meio da manhã: sombras mais longas
  const sunS = new THREE.DirectionalLight(0xfff0dc, 0); sunS.castShadow = true;
  sunS.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
  Object.assign(sunS.shadow.camera, { left: -0.26, right: 0.26, top: 0.26, bottom: -0.26, near: 0.05, far: 1.6 }); sunS.shadow.camera.updateProjectionMatrix();
  sunS.shadow.bias = -0.0004; sunS.shadow.normalBias = 0.0004;
  local.add(sunS, sunS.target);
  let shadowDirty = true;
  // "Obrigado!" gigante que sobe atrás da escola (o prédio fica na frente: teste de profundidade)
  const thanks = (() => {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 560; const g = c.getContext('2d');
    g.font = '800 330px "Inter Tight", "Inter", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(20,10,40,.55)'; g.shadowBlur = 50;
    const gr = g.createLinearGradient(0, 80, 0, 480); gr.addColorStop(0, '#ff9a3d'); gr.addColorStop(0.55, '#ff5a1f'); gr.addColorStop(1, '#d61f2c');
    g.fillStyle = gr; g.fillText('Obrigado!', 1024, 290); g.shadowBlur = 0; g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText('Obrigado!', 1024, 290); g.fillText('Obrigado!', 1024, 290);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.082), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide, color: new THREE.Color(1.1, 1.1, 1.1) }));
    m.renderOrder = 2; m.visible = false; local.add(m); return m;
  })();
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
  // texturas reais (Poly Haven, CC0) reduzidas para a web; projeção triplanar: não depende de UV, o tamanho fica certo em qualquer prédio
  const TXL = new THREE.TextureLoader(), TXC = {};
  const tx = n => TXC[n] || (TXC[n] = (() => { const t = TXL.load(`assets/tex/${n}_diff.jpg`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; })());
  function triMat(tex, tile, color, rough = 0.9, metal = 0, o = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: tx(tex), ...(o.mat || {}) });
    const U = { uTile: { value: tile }, uGray: { value: o.gray || 0 }, uGain: { value: o.gain || 1 }, uEdge: { value: o.edge || 0 } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP, vTN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = position; vTN = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP, vTN; uniform float uTile, uGray, uGain, uEdge;').replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vTN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 P = vTP / uTile;
        vec4 tc = texture2D(map, P.zy) * bw.x + texture2D(map, P.xz) * bw.y + texture2D(map, P.xy) * bw.z;
        vec4 tc2 = texture2D(map, P.xz * 0.13 + 0.37) * bw.y + texture2D(map, P.xy * 0.13 + 0.37) * bw.z + texture2D(map, P.zy * 0.13) * bw.x;
        tc.rgb *= 0.8 + 0.4 * dot(tc2.rgb, vec3(0.333));          // quebra a repetição da textura
        tc.rgb = mix(tc.rgb, vec3(dot(tc.rgb, vec3(0.3, 0.59, 0.11))), uGray) * uGain;
        diffuseColor *= tc;
        if (uEdge > 0.0) diffuseColor.a *= smoothstep(uEdge, uEdge * 0.55, length(vTP.xy));`);
    };
    m.customProgramCacheKey = () => 'tri';
    return m;
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
    const ground = new THREE.Mesh(PL(2400, 2000), triMat('leafy_grass', 4, 0xa8a874, 1, 0, { gray: 0.25, edge: 1150, mat: { transparent: true, depthWrite: false } }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05; site.add(ground);
    const AREA = { lot: [0xb9b4aa, 0.25, 'concrete_floor_02', 5, 0xe4e2dc], garden: [0x4f8a3a, 0.35, 'leafy_grass', 3, 0x8fae70], parking: [0x55585e, 0.3, 'asphalt_02', 6, 0xb8b8b8], forest: [0x2f5a2a, 0.0, 'leafy_grass', 5, 0x7f9a66], field: [0x7f8f45, 0.0, 'leafy_grass', 4, 0xb8b27a], dirt: [0xa86a3e, 0.0, 'red_laterite_soil_stones', 8, 0xd8b8a8] };
    const areaMat = {}, trees = [];
    d.areas.forEach(a => {
      const [c, hgt, tn, tl, tc] = AREA[a.t] || [0x888888, 0], w = a.x1 - a.x0, dd = a.z1 - a.z0;
      const mt = areaMat[a.t] || (areaMat[a.t] = tn ? triMat(tn, tl, tc, 0.95) : M(c, 1));
      const m = new THREE.Mesh(PL(w, dd), mt); m.rotation.x = -Math.PI / 2; m.position.set((a.x0 + a.x1) / 2, 0.12 + hgt, (a.z0 + a.z1) / 2); site.add(m);
      if (a.t === 'forest') { const n = Math.min(900, Math.round(w * dd / 70)); for (let i = 0; i < n; i++) trees.push([a.x0 + rand() * w, a.z0 + rand() * dd, 6 + rand() * 7]); }
    });
    const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), M(0x3c6e33, 0.95), trees.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    trees.forEach(([x, z, h], i) => { m4.compose(new THREE.Vector3(x, h * 0.7, z), qq, new THREE.Vector3(h * 0.42, h * 0.38, h * 0.42)); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, new THREE.Color().setHSL(0.27 + rand() * 0.06, 0.45, 0.22 + rand() * 0.1)); });
    site.add(crowns);
    // ruas (OpenStreetMap) com faixa central na rodovia
    const asphalt = triMat('asphalt_02', 6, 0xa4a6aa, 0.92), line = new THREE.MeshBasicMaterial({ color: 0xf2d06b });
    d.ruas.forEach(r => {
      for (let i = 0; i < r.p.length - 1; i++) {
        const [x0, z0] = r.p[i], [x1, z1] = r.p[i + 1], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.5) continue;
        const rz = -Math.atan2(z1 - z0, x1 - x0);
        put(asphalt, PL(L + r.w * 0.5, r.w), (x0 + x1) / 2, 0.25, (z0 + z1) / 2, -Math.PI / 2, 0, rz);
        if (r.w >= 14) put(line, PL(L, 0.3), (x0 + x1) / 2, 0.3, (z0 + z1) / 2, -Math.PI / 2, 0, rz);
      }
    });
    // prédios. Cores do SENAI conferidas no Street View (jul/2025): paredes brancas e faixa azul no topo
    const wallV = triMat('concrete_wall_008', 4, 0xe6e2da, 0.92), wallS = triMat('white_plaster_02', 3, 0xffffff, 0.8, 0, { gray: 0.8, gain: 1.15 }), blue = M(0x1f4fa8, 0.5), red = M(0xc8232c, 0.6), glass = M(0x5c7590, 0.15, 0.6), steel = M(0x8d949c, 0.4, 0.8), solar = M(0x1d2a4a, 0.25, 0.4);
    const white = M(0xf4f4f2, 0.6), concrete = triMat('concrete_wall_008', 4, 0xd0cdc6, 0.9), lawn = triMat('leafy_grass', 3, 0x93b072, 1), walk = triMat('concrete_pavement', 2.5, 0xf0eee8, 0.95), paver = triMat('hexagonal_concrete_paving', 1.6, 0xd8ccc4, 1);
    const roofV = triMat('box_profile_metal_sheet', 2.5, 0xd8dce2, 0.45, 0.7, { gray: 1, gain: 1.9 });
    const roofS = triMat('box_profile_metal_sheet', 2.5, 0xe4e7ec, 0.4, 0.75, { gray: 1, gain: 2.1 });
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
    site.traverse(o => { if (o.isMesh) { o.castShadow = o !== ground; o.receiveShadow = true; } });
    site.userData.ready = true; shadowDirty = true;
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
  // Terra primitiva: Theia (do tamanho de Marte) bate de raspão, os destroços formam um anel e o anel vira a Lua (Kegerreis et al., 2022)
  const MOON0 = moon.position.clone(), Y = new THREE.Vector3(0, 1, 0);
  const camDir = q => tmp.copy(N0).applyAxisAngle(Y, lerp(-2.2, 0, ease(q))).normalize().clone();
  const Cimp = camDir(0.22), sideV = new THREE.Vector3().crossVectors(Cimp, Y).normalize();
  const HIT = Cimp.clone().multiplyScalar(0.3).addScaledVector(sideV, 0.95).normalize(), VDIR = new THREE.Vector3().crossVectors(Y, HIT).normalize();
  const e1 = HIT.clone().projectOnPlane(Y).normalize(), e2 = new THREE.Vector3().crossVectors(Y, e1);
  const theiaMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 } }, vertexShader: 'varying vec3 vO, vN, vW; void main(){ vO = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `${NOISE} uniform float uT; varying vec3 vO, vN, vW; void main(){ float n = fbm(vO * 4.0 + 7.0); vec3 c = mix(vec3(1.3, 0.38, 0.06), vec3(0.09, 0.05, 0.04), smoothstep(0.42, 0.58, n)); float rim = pow(1.0 - max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0), 2.0); gl_FragColor = vec4(c * (0.7 + 0.5 * rim), 1.0); }` });
  const theia = new THREE.Mesh(new THREE.SphereGeometry(3390, 64, 40), theiaMat);
  const ND = small ? 4000 : 8000, debris = mkPoints(ND, 1), dpa = debris.geometry.attributes, DR = new Float32Array(ND), DA = new Float32Array(ND), DY = new Float32Array(ND), DS = new Float32Array(ND * 3);
  for (let i = 0; i < ND; i++) { DR[i] = RE * (1.3 + Math.pow(rand(), 0.7) * 3.4); DA[i] = rand() * TAU; DY[i] = gauss() * 300; const v = new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(1400); DS.set([v.x, v.y, v.z], i * 3); const w = 0.6 + rand(); dpa.aColor.setXYZ(i, 1.5 * w, 0.62 * w, 0.22 * w); dpa.aSize.setX(i, 70 + Math.pow(rand(), 5) * 160); }
  const impact = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc890, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }));
  const impactF = flare(0xffe2c0, RE * 1.4, 0);
  const MA = Math.atan2(HIT.dot(e2), HIT.dot(e1)) + 2.2, MR = RE * 3.8;
  es.add(theia, debris, impact, impactF);
  const _v = new THREE.Vector3(), HP = HIT.clone().multiplyScalar(RE * 1.02);
  scenes.earth.updateEarth = (q, t) => {
    theia.visible = debris.visible = true; groundLook(false); thanks.visible = false; root.classList.remove('ended');
    earthU.uLava.value = 1 - sstep(0.5, 0.78, q); earthU.uT.value = t; earthU.uCloud.value = sstep(0.7, 0.9, q); atmo.material.uniforms.uA.value = sstep(0.55, 0.85, q);
    // 1) Theia chega de lado e bate de raspão
    const hitQ = 0.2, pre = q < hitQ;
    theia.position.copy(HIT).multiplyScalar(RE + 2600).addScaledVector(VDIR, -(hitQ - q) * RE * 20);
    theia.scale.setScalar(pre ? 1 : Math.max(0.001, 1 - (q - hitQ) / 0.06)); theia.visible = theia.scale.x > 0.002;
    const fl = q >= hitQ ? Math.exp(-(q - hitQ) * 30) : 0;
    impact.position.copy(HP); impact.scale.setScalar(RE * (1.5 + 6 * (1 - fl))); impact.material.opacity = fl * 1.2;
    impactF.position.copy(HP); impactF.material.opacity = fl; impactF.scale.set(RE * 14 * (0.5 + fl), RE * 3.5 * (0.5 + fl), 1);
    // 2) os destroços abrem um anel e depois se juntam na Lua
    const sp = sstep(hitQ, 0.32, q), co = sstep(0.36, 0.58, q);
    debris.visible = q > hitQ && co < 1;
    debris.material.uniforms.uAlpha.value = (1 - co) * sstep(hitQ, hitQ + 0.02, q);
    for (let i = 0; i < ND; i++) {
      const r = lerp(DR[i], MR, co * co), a = lerp(DA[i] + t * 1.6 * Math.pow(RE / DR[i], 1.5), MA, co * co);
      _v.copy(e1).multiplyScalar(Math.cos(a) * r).addScaledVector(e2, Math.sin(a) * r).addScaledVector(Y, DY[i] * (1 - co));
      _v.lerp(tmp.copy(HP).add(new THREE.Vector3(DS[i * 3], DS[i * 3 + 1], DS[i * 3 + 2]).multiplyScalar(1 + sp * 2)), 1 - sp);
      dpa.position.setXYZ(i, _v.x, _v.y, _v.z);
    }
    dpa.position.needsUpdate = true;
    // 3) a Lua nasce perto e se afasta (até hoje se afasta 3,8 cm por ano)
    const mg = sstep(0.42, 0.6, q), away = sstep(0.6, 1, q);
    moon.scale.setScalar(Math.max(mg, 0.001)); moon.visible = mg > 0.002;
    _v.copy(e1).multiplyScalar(Math.cos(MA + t * 0.05) * MR).addScaledVector(e2, Math.sin(MA + t * 0.05) * MR);
    moon.position.copy(_v).lerp(MOON0, ease(away));
    // a câmera abre para ver o choque e o anel, depois dá a volta e para em cima do Brasil
    const d = lerp(RE * 8.5, RE * 3.4, ease(sstep(0.5, 1, q)));
    ecam.position.copy(camDir(q)).multiplyScalar(d).addScaledVector(NORTH, RE * 0.35 * (1 - q));
    ecam.up.copy(NORTH); ecam.lookAt(0, 0, 0);
    setNearFar(d - RE * 5.5 > 0 ? d - RE * 5.5 : RE);
    hud(q < hitQ ? 'Terra primitiva: oceano de magma. Theia se aproxima' : q < 0.42 ? 'O impacto lança rocha derretida em órbita' : q < 0.62 ? 'O anel de destroços se junta: nasce a Lua' : q < 0.82 ? 'A Terra esfria: crosta, oceanos e atmosfera' : 'Hoje: 71% da superfície é água', sstep(0, 1, q));
    clearLabels();
  };
  const hKm = q => Math.exp(lerp(Math.log(RE * 2.4), Math.log(0.55), q));
  scenes.zoom.updateZoom = (q, t) => {
    const k = ease(q), h = hKm(k);
    earthU.uLava.value = 0; atmo.material.uniforms.uA.value = 1; theia.visible = debris.visible = false; impact.material.opacity = impactF.material.opacity = 0; moon.visible = true; moon.scale.setScalar(1); moon.position.copy(MOON0); earthU.uCloud.value = sstep(5000, 13000, h);
    // inclina a câmera aos poucos no fim (vista oblíqua, como num drone)
    const tilt = sstep(0.75, 1, q) * 0.9;
    const up = N0.clone(), back = NORTH.clone().negate();
    const target = tgtW.clone();
    ecam.position.copy(target).addScaledVector(up, h * Math.cos(tilt)).addScaledVector(back, h * Math.sin(tilt));
    ecam.up.copy(NORTH); ecam.lookAt(target);
    setNearFar(h);
    tileFade(h);
    if (h < 6) { makeEnv(); groundLook(true, sstep(6, 0.6, h)); sky.position.copy(ecam.position); } else groundLook(false);
    thanks.visible = false; root.classList.remove('ended');
    label('z-br', BR, ecam, h > 2500 && h < 15000 ? 'Brasil' : '');
    label('z-sp', SP, ecam, h > 250 && h < 2500 ? 'Estado de São Paulo' : '');
    label('z-ira', IRA, ecam, h > 3 && h < 250 ? 'Iracemápolis' : '');
    label('z-se', tgtW, ecam, h <= 3 ? 'SENAI' : '');
    $('#cos-alt').textContent = h >= 10 ? `${Math.round(h).toLocaleString('pt-BR')} km de altura` : `${(h * 1000).toFixed(0)} m de altura`;
    hud(h > 2500 ? 'América do Sul' : h > 250 ? 'Interior de São Paulo, a 160 km da capital' : h > 3 ? 'Iracemápolis · cerca de 24 mil habitantes' : 'Distrito Industrial II', 1 - Math.log(h / 0.55) / Math.log(RE * 2.4 / 0.55));
  };
  let orbit = null;
  function groundLook(on, k = 1) {
    sky.visible = on; es.environment = on ? envTex : null; es.environmentIntensity = 0.55;
    es.fog.near = on ? lerp(6, 0.9, k) : 1e8; es.fog.far = on ? lerp(60, 9, k) : 1e9;
    sunS.intensity = on ? 3.4 * k : 0; sunLight.intensity = on ? 3.2 * (1 - k) : 3.2;   // perto do chão, só o sol que faz sombra
  }
  scenes.senai.updateSenai = (q, t) => {
    tileFade(0.5);
    theia.visible = debris.visible = false;
    makeEnv(); groundLook(true, 1); sky.position.copy(ecam.position);
    if (shadowDirty && site.userData.ready) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    site.visible = !!site.userData.ready;
    const of = siteData && siteData.predios.find(b => b.id === 'senai-oficinas');
    const c = new THREE.Vector3(of ? of.x : 0, 0, of ? of.z + 40 : 0).multiplyScalar(0.001);
    const cw = local.localToWorld(c.clone());
    if (!orbit || !orbit.enabled) {
      const a = -Math.PI / 2 + lerp(0, 1.6, ease(q)) + (q >= 1 ? t * 0.03 : 0), dist = lerp(0.42, 0.17, ease(q)), hgt = lerp(0.42, 0.045, ease(q));
      const lp = c.clone().add(new THREE.Vector3(Math.cos(a) * dist, hgt, Math.sin(a) * dist));
      ecam.position.copy(local.localToWorld(lp)); ecam.up.copy(N0); ecam.lookAt(cw);
    }
    setNearFar(0.15);
    sunS.target.position.copy(c); sunS.position.copy(c).addScaledVector(SUNL, 0.8); sunS.target.updateMatrixWorld(); sunS.updateMatrixWorld();
    // "Obrigado!" sobe ao fundo, sempre atrás da escola em relação à câmera
    const k = sstep(0.5, 0.82, q), cl = local.worldToLocal(ecam.position.clone()), dir = c.clone().sub(cl).setY(0).normalize();
    thanks.visible = k > 0; thanks.material.opacity = k;
    thanks.position.copy(c).addScaledVector(dir, 0.38).setY(lerp(-0.04, 0.042, ease(k)));
    thanks.lookAt(local.localToWorld(new THREE.Vector3(cl.x, thanks.position.y, cl.z)));
    root.classList.toggle('ended', q > 0.88);
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
  // lente de cinema: grão de filme, vinheta e aberração cromática nas bordas (uma passada só, barata)
  const film = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uT: { value: 0 }, uGrain: { value: 0.05 }, uCA: { value: 0.0015 }, uVig: { value: 0.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uT, uGrain, uCA, uVig; varying vec2 vUv;
      float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){ vec2 d = vUv - 0.5; float r2 = dot(d, d);
        vec2 o = d * r2 * uCA * 40.0;
        vec3 c = vec3(texture2D(tDiffuse, vUv + o).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - o).b);
        c *= 1.0 - uVig * smoothstep(0.12, 0.62, r2 * 1.6);
        float g = h(vUv * 1024.0 + fract(uT * 7.13) * 91.0) - 0.5; c += g * uGrain * (1.0 - 0.6 * dot(c, vec3(0.333)));
        gl_FragColor = vec4(c, 1.0); }`
  });
  comp.addPass(film);
  // resolução adaptativa: se o quadro passar de ~25 ms, baixa a resolução interna; se sobrar tempo, sobe de novo
  let rs = 1, ema = 1 / 60, adaptT = 0, settle = 0;
  function adapt(dt) {
    ema = ema * 0.92 + dt * 0.08; adaptT += dt; settle -= dt;
    if (adaptT < 0.8 || settle > 0) return; adaptT = 0;
    const nrs = ema > 1 / 40 ? Math.max(0.5, rs * 0.85) : ema < 1 / 56 ? Math.min(1, rs * 1.08) : rs;
    if (Math.abs(nrs - rs) > 0.02) { rs = nrs; resize(); }
  }
  let W = 1, H = 1;
  function resize() {
    W = Math.max(1, view.clientWidth); H = Math.max(1, view.clientHeight);
    renderer.setSize(W, H, false); renderer.setPixelRatio(PR * rs); comp.setPixelRatio(PR * rs); comp.setSize(W, H);
    Object.values(cams).forEach(c => { c.aspect = W / H; c.updateProjectionMatrix(); });
    allPtsMats.forEach(m => (m.uniforms.uPx.value = H * PR * rs / (2 * Math.tan(THREE.MathUtils.degToRad(27)))));
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
    settle = 2;                                    // troca de cena: dá tempo de compilar antes de medir
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
    if (i >= ACTS.findIndex(x => x.id === 'sol')) loadEarth();
    const ground = ['earth', 'zoom', 'senai'].includes(a.id); bloom.strength = ground ? 0.35 : a.id === 'bang' ? 1.1 : 0.85; bloom.threshold = ground ? 0.85 : 0.55;
    renderer.toneMappingExposure = a.id === 'zoom' || a.id === 'senai' ? 1.1 : 1.0;
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
    film.uniforms.uT.value = t; const deep = !['zoom', 'senai'].includes(a.id); film.uniforms.uGrain.value = deep ? 0.06 : 0.035; film.uniforms.uCA.value = deep ? 0.0009 : 0.0005;
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
    draw(dt); adapt(dt);
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
  // modo cinema: ao chegar no fim da apresentação a viagem ocupa a tela inteira, com faixas pretas de cinema
  let weFS = false, uiT = 0;
  const home = document.createComment('cos');
  function cinema(onC) {
    if (onC && root.parentNode !== document.body) { root.before(home); document.body.append(root); }
    if (!onC && home.parentNode) home.replaceWith(root);
    root.classList.toggle('cinema', onC);
    if (onC && !document.fullscreenElement && !TEST) document.documentElement.requestFullscreen?.().then(() => { weFS = true; }).catch(() => {});
    if (!onC && weFS && document.fullscreenElement) { weFS = false; document.exitFullscreen().catch(() => {}); }
    setTimeout(resize, 60);
  }
  $('#cos-fs')?.addEventListener('click', () => cinema(!root.classList.contains('cinema')));
  $('#cos-exit')?.addEventListener('click', () => cinema(false));
  $('#cos-replay')?.addEventListener('click', () => { t = 0; if (orbit) orbit.enabled = false; root.classList.remove('ended', 'free'); setPlay(true); });
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && weFS) { weFS = false; root.classList.remove('cinema'); } setTimeout(resize, 60); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && on && root.classList.contains('cinema')) cinema(false); });
  root.addEventListener('pointermove', () => { root.classList.add('ui'); clearTimeout(uiT); uiT = setTimeout(() => root.classList.remove('ui'), 2200); });
  demos.cosmos = {
    enter() { on = true; cinema(true); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); if (t >= TOTAL) t = 0; setPlay(true); },
    leave() { on = false; cancelAnimationFrame(raf); cinema(false); root.classList.remove('ended'); }
  };
  if ($('.slide[data-id="cosmos"]')?.classList.contains('active')) demos.cosmos.enter();
  if (TEST) window.IACosmos = { seek: x => { t = x; setPlay(false); if (orbit) orbit.enabled = false; }, acts: ACTS.map((a, i) => ({ id: a.id, t0: T_ACT[i], dur: a.dur })), total: TOTAL, state: () => ({ t, act: ACTS[actIdx]?.id, tiles: levels.reduce((s, L) => s + L.mats.filter(m => m.userData.ok).length, 0), site: !!site.userData.ready, siteMeshes: (() => { let n = 0; site.traverse(o => { if (o.isMesh) n++; }); return n; })(), hi: earthU.uHiOn.value }) };
}
