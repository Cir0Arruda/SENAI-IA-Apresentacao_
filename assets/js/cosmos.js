/* =========================================================
   IA na Prática · final: "Do Big Bang ao SENAI Iracemápolis"
   13,8 bilhões de anos num plano-sequência só (sem cortes nem transições),
   todo em three.js: Big Bang → sopa de quarks → núcleos → primeira luz →
   primeiras estrelas → teia cósmica → Via Láctea → Sistema Solar → Terra →
   mergulho até Iracemápolis → a Escola SENAI em 3D (assets/models/senai.glb).

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
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

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

/* ---------- Capítulos: só as legendas mudam. A imagem é um plano-sequência, sem cortes nem transições ---------- */
const ACTS = [
  { id: 'bang', t0: 0, kicker: '13,8 bilhões de anos atrás', title: 'O Big Bang', sub: 'Não foi uma explosão no espaço: foi o próprio espaço que começou a crescer. Na inflação, ele se esticou mais de 10²⁶ vezes numa fração de segundo.' },
  { id: 'qgp', t0: 4, kicker: 'Primeiro milionésimo de segundo', title: 'A sopa de quarks', sub: 'Quente demais para existir próton: quarks e glúons livres, como no plasma recriado no LHC, do CERN. Ao esfriar, eles se prendem de três em três.' },
  { id: 'nuc', t0: 9, kicker: 'Os 3 primeiros minutos', title: 'Nascem os primeiros núcleos', sub: 'Prótons (vermelho) e nêutrons (cinza) se juntam. O universo sai com cerca de 75% de hidrogênio e 25% de hélio, em massa.' },
  { id: 'cmb', t0: 13, kicker: '380 mil anos depois', title: 'A primeira luz', sub: 'A ~3.000 °C os átomos se formam e a névoa clareia. Essa luz chega até hoje como micro-ondas, mapeadas pelo satélite Planck.' },
  { id: 'dark', t0: 18.5, kicker: 'De 380 mil a 200 milhões de anos', title: 'Trevas e primeiras estrelas', sub: 'Sem estrelas, a gravidade puxa o gás para fios e nós. Neles acendem as primeiras estrelas, gigantes e azuis.' },
  { id: 'web', t0: 25, kicker: '~1 bilhão de anos', title: 'A teia cósmica', sub: 'Como nas simulações Millennium e IllustrisTNG: filamentos de matéria escura, com galáxias nos cruzamentos.' },
  { id: 'mw', t0: 31, kicker: 'Uma galáxia entre centenas de bilhões', title: 'A Via Láctea', sub: '100 a 400 bilhões de estrelas numa espiral barrada, com faixas de poeira e berçários de estrelas. O Sol fica num braço, a 26 mil anos-luz do centro.' },
  { id: 'sol', t0: 37.5, kicker: '4,6 bilhões de anos atrás', title: 'Nasce o Sistema Solar', sub: 'Uma nuvem de gás colapsa e o Sol acende. No disco em volta, anéis e lacunas, como os que o ALMA fotografou no HL Tau, mostram planetas se formando.' },
  { id: 'earth', t0: 46, kicker: '4,5 bilhões de anos atrás até hoje', title: 'A Terra', sub: 'Uma bola de lava esfria e ganha crosta, oceanos, atmosfera e vida.' },
  { id: 'zoom', t0: 53, kicker: 'Hoje', title: 'Brasil · São Paulo · Iracemápolis', sub: 'Do espaço até o interior paulista: 22,58° S, 47,50° O.' },
  { id: 'senai', t0: 64, kicker: 'Rua Camilo Ferrari, 765 · Distrito Industrial II', title: 'SENAI Iracemápolis', sub: 'Do Big Bang até aqui num plano-sequência só, sem vídeo: cada quadro é calculado ao vivo pela placa de vídeo, com código escrito por IA.' }
];
const TOTAL = 78;
ACTS.forEach((a, i) => { a.dur = (i < ACTS.length - 1 ? ACTS[i + 1].t0 : TOTAL) - a.t0; });
const T_ACT = ACTS.map(a => a.t0);

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
    attribute vec3 aColor; attribute float aSize; uniform float uPx, uScale, uNear; varying vec3 vC;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
      float s = aSize * uScale * uPx / max(-mv.z, 0.0001); vC = aColor * (uNear > 0.0 ? smoothstep(uNear * 0.3, uNear, -mv.z) : 1.0); if (s < 1.4) { vC *= (s / 1.4) * (s / 1.4); s = 1.4; } gl_PointSize = min(s, 64.0); }`;
  const PTS_FS = /* glsl */`
    uniform float uAlpha; varying vec3 vC;
    void main(){ vec2 c = gl_PointCoord - 0.5; float d = dot(c, c); float a = exp(-d * 22.0) + 0.12 * exp(-d * 6.0); if (a < 0.01) discard; gl_FragColor = vec4(vC * a * uAlpha, 1.0); }`;
  function pointsMat(scale = 1) {
    return new THREE.ShaderMaterial({ uniforms: { uPx: { value: 500 }, uScale: { value: scale }, uAlpha: { value: 1 }, uNear: { value: 0 } }, vertexShader: PTS_VS, fragmentShader: PTS_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
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

  /* =========================================================
     Espaço profundo: UMA cena e UMA câmera, sem cortes (plano-sequência).
     Três níveis encaixados, como numa "potência de dez": o universo (teia cósmica) → a Via Láctea,
     que mora num nó da teia → o Sistema Solar, que mora no ponto do Sol. A Terra (cena em km) mora no
     ponto da Terra. A cada quadro a cena é montada a partir do nível onde a câmera está ("rebase"):
     os números ficam pequenos e a imagem não treme, mesmo descendo de bilhões de anos-luz até metros.
     ========================================================= */
  const deep = new THREE.Scene();
  const dcam = mkCam(55, 0.01, 6000); cams.deep = dcam;
  const LV = [0, 1, 2].map(() => { const g = new THREE.Group(); g.matrixAutoUpdate = false; deep.add(g); return g; });
  const lvPts = [[], [], []];                    // pontos de cada nível: o tamanho do ponto acompanha a escala do nível
  const ptsIn = (k, n, scale = 1) => { const p = mkPoints(n, scale); p.material.userData.base = scale; lvPts[k].push(p.material); return p; };
  const S_G = 0.035, S_S = 0.012;                // tamanho da Via Láctea dentro da teia e do Sistema Solar dentro da Via Láctea
  const Y = new THREE.Vector3(0, 1, 0), IDQ = new THREE.Quaternion();

  /* ---------- Nível 0: o universo inteiro ---------- */
  // névoa primordial: o ponto, o clarão, a bola de fogo que é o próprio espaço crescendo (inflação),
  // a sopa de quarks, a névoa laranja de 3.000 °C que clareia e, atrás dela, o céu do satélite Planck
  const prim = bgQuad(/* glsl */`
    uniform float uR, uIn, uHot, uFog, uCmb, uPre, uFl; uniform vec2 uC; varying vec2 vUv;
    vec3 planck(float x){
      vec3 a = vec3(0.0, 0.03, 0.35), b = vec3(0.1, 0.45, 0.95), c = vec3(0.95, 0.9, 0.78), d = vec3(1.0, 0.55, 0.12), e = vec3(0.71, 0.2, 0.16);
      return x < 0.25 ? mix(a, b, x / 0.25) : x < 0.5 ? mix(b, c, (x - 0.25) / 0.25) : x < 0.75 ? mix(c, d, (x - 0.5) / 0.25) : mix(d, e, (x - 0.75) / 0.25); }
    float cmb(vec3 d){ return fbmT(d * 9.0 + 3.0) * 0.55 + fbmT(d * 26.0 + 17.0) * 0.45; }
    vec3 emit(float n, float temp, vec3 p){
      vec3 hot = mix(vec3(0.42, 0.25, 1.0), vec3(0.75, 0.88, 1.25), smoothstep(0.25, 0.6, temp));
      hot = mix(hot, vec3(1.5, 1.4, 1.3), smoothstep(0.6, 0.95, temp)) * (0.35 + 1.4 * temp * temp) * mix(1.0, 0.42, uIn);
      vec3 qgp = mix(vec3(1.0, 0.38, 0.08), vec3(1.5, 1.25, 0.75), smoothstep(0.55, 0.9, n));
      qgp = mix(qgp, vec3(0.9, 0.25, 0.6), smoothstep(0.75, 0.95, tn(p * 3.0 + uT))) * 0.8;
      vec3 nuc = mix(vec3(0.55, 0.16, 0.03), vec3(0.95, 0.5, 0.16), smoothstep(0.3, 0.8, n)) * 0.75;
      return uHot > 0.66 ? mix(qgp, hot, (uHot - 0.66) / 0.34) : uHot > 0.33 ? mix(nuc, qgp, (uHot - 0.33) / 0.33) : nuc * mix(0.5, 1.0, uHot / 0.33);
    }
    void main(){
      vec3 rd = rayDir(vUv), ro = cameraPosition; vec3 col = vec3(0.0); float T = 1.0;
      if (uFog > 0.002 && uR > 0.0) {
        float b = dot(ro, rd), c = dot(ro, ro) - uR * uR, h = b * b - c;
        if (h > 0.0) {
          h = sqrt(h); float t0 = max(-b - h, 0.0), t1 = min(-b + h, t0 + 16.0);
          if (t1 > t0) {
            float dt = (t1 - t0) / 22.0, tt = t0 + dt * h12(gl_FragCoord.xy + uT);
            for (int i = 0; i < 22; i++) {
              vec3 p = ro + rd * tt; float r = length(p) / uR;
              vec3 q = p / uR * 2.6; q += (tn4(q * 1.7 + vec3(0.0, uT * 0.35, 0.0)).gba - 0.5) * 2.2;   // dobra o espaço (domain warp)
              float n = fbmT(q * 2.2 - vec3(uT * 0.25, 0.0, 0.0));
              float ball = smoothstep(0.45, 0.8, n) * (1.0 - smoothstep(0.7, 1.0, r)) * (0.35 + 1.2 * exp(-r * 4.0));
              float fog = (0.3 + 0.7 * smoothstep(0.35, 0.85, n)) * (1.0 - smoothstep(0.85, 1.0, r));
              float temp = clamp(mix(1.15 - r * 0.9, 0.42, uIn) + (n - 0.5) * mix(0.8, 1.1, uIn), 0.0, 1.0);
              float a = mix(ball, fog, uIn) * dt * mix(2.4, 0.55, uIn) * uFog;
              col += T * emit(n, temp, p) * a; T *= exp(-a * 2.2); if (T < 0.03) break; tt += dt;
            }
          }
        }
      }
      col += T * planck(clamp((cmb(rd) - 0.47) * 4.5 + 0.5, 0.0, 1.0)) * 0.5 * uCmb;   // a luz que escapou: o fundo de micro-ondas
      vec2 d2 = (vUv - 0.5) * vec2(uAsp, 1.0) - uC; float d = length(d2);
      col += vec3(1.0, 0.97, 0.92) * (uPre * exp(-d * 260.0) + uFl * (2.2 * exp(-d * 2.2) + 6.0 * exp(-d * 18.0)));
      col += vec3(0.45, 0.65, 1.3) * uFl * 2.5 * exp(-abs(d2.y) * 80.0) * exp(-abs(d2.x) * 1.2);     // raio anamórfico
      gl_FragColor = vec4(col, 1.0);
    }`, { uR: { value: 0 }, uIn: { value: 0 }, uHot: { value: 1 }, uFog: { value: 1 }, uCmb: { value: 0 }, uPre: { value: 0 }, uFl: { value: 0 }, uC: { value: new THREE.Vector2() } });
  deep.add(prim.mesh);

  // esqueleto da teia cósmica: cada nó liga nos 3 vizinhos mais perto (como nas simulações Millennium e IllustrisTNG)
  const NODES = 52, BOX = 9;
  const nodes = []; for (let i = 0; i < NODES; i++) nodes.push(new THREE.Vector3((rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX));
  const edges = [];
  nodes.forEach((a, i) => { nodes.map((b, j) => [a.distanceTo(b), j]).sort((x, y) => x[0] - y[0]).slice(1, 4).forEach(([, j]) => { if (i < j) edges.push([i, j]); }); });
  const tgt = nodes.filter(n => n.length() > 2.5).reduce((best, n) => n.length() < best.length() ? n : best);   // o nó onde vai nascer a Via Láctea

  // as MESMAS partículas fazem tudo: fagulhas do Big Bang → quarks → prótons e nêutrons → gás escuro → teia cósmica.
  // A posição é calculada na placa de vídeo a partir do tempo: nada é trocado, tudo evolui.
  const NG = small ? 24000 : 48000;
  const gas = (() => {
    const g = new THREE.BufferGeometry(), U = new Float32Array(NG * 3), Wp = new Float32Array(NG * 3), TR = new Float32Array(NG * 3), WC = new Float32Array(NG * 3), SE = new Float32Array(NG * 4);
    const cVoid = new THREE.Color(0.12, 0.2, 0.55), cFil = new THREE.Color(0.25, 0.65, 0.63), cWarm = new THREE.Color(0.9, 0.83, 0.35), cNode = new THREE.Color(1.3, 1.25, 1.15), c = new THREE.Color(), v = new THREE.Vector3();
    for (let i = 0; i < NG; i++) {
      v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(11 * Math.cbrt(rand())); U.set([v.x, v.y, v.z], i * 3);
      const u = rand(); let sz = 0.02 + Math.pow(rand(), 7) * 0.08;
      if (u < 0.2) { const n = nodes[(rand() * NODES) | 0], r = Math.abs(gauss()) * 0.32; v.copy(n).add(new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(r)); c.copy(cWarm).lerp(cNode, Math.exp(-r * 6)); }
      else if (u < 0.9) { const [a, b] = edges[(rand() * edges.length) | 0], w = rand(), sp = 0.08 + 0.12 * Math.sin(w * Math.PI); v.copy(nodes[a]).lerp(nodes[b], w).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(sp)); c.copy(cFil).lerp(cWarm, Math.pow(1 - Math.sin(w * Math.PI), 3) * 0.8); }
      else { v.set((rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX, (rand() - 0.5) * 2 * BOX); c.copy(cVoid).multiplyScalar(0.35); }
      Wp.set([v.x, v.y, v.z], i * 3); const b = 0.25 + Math.pow(rand(), 3); WC.set([c.r * b, c.g * b, c.b * b], i * 3);
      SE.set([rand(), rand(), i % 3, sz], i * 4);
    }
    for (let i = 0; i < NG; i++) { const j = i - (i % 3); TR.set([U[j * 3], U[j * 3 + 1], U[j * 3 + 2]], i * 3); }   // trios de quarks: prótons e nêutrons
    g.setAttribute('position', new THREE.BufferAttribute(U, 3)); g.setAttribute('aW', new THREE.BufferAttribute(Wp, 3)); g.setAttribute('aTri', new THREE.BufferAttribute(TR, 3));
    g.setAttribute('aWc', new THREE.BufferAttribute(WC, 3)); g.setAttribute('aS', new THREE.BufferAttribute(SE, 4));
    const u = { uPx: { value: 500 }, uScale: { value: 1 }, uAlpha: { value: 1 }, uT: { value: 0 }, uA: { value: 0 }, uBind: { value: 0 }, uQ: { value: 0 }, uNuc: { value: 0 }, uGas: { value: 0 }, uCol: { value: 0 }, uWeb: { value: 0 }, uNear: { value: 0.5 }, uBr: { value: 0 } };
    const m = new THREE.ShaderMaterial({
      uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: PTS_FS,
      vertexShader: /* glsl */`
        attribute vec3 aW, aTri, aWc; attribute vec4 aS;
        uniform float uPx, uScale, uT, uA, uBind, uQ, uNuc, uGas, uCol, uWeb, uNear, uBr; varying vec3 vC;
        void main(){
          vec3 j = vec3(sin(uT * 2.2 + aS.x * 60.0), cos(uT * 1.9 + aS.y * 70.0), sin(uT * 1.6 + aS.x * 90.0 + 1.0)) * 0.12 * (1.0 - uBind * 0.8);
          vec3 g = mix(position, aTri, uBind * 0.97) * uA + j * (1.0 - uCol);
          float k = smoothstep(aS.x * 0.45, aS.x * 0.45 + 0.55, uCol);          // a gravidade puxa cada pedaço de gás para a teia
          vec3 p = mix(g, aW, k * k * (3.0 - 2.0 * k));
          vec3 cq = aS.z < 0.5 ? vec3(1.6, 0.25, 0.2) : aS.z < 1.5 ? vec3(0.3, 1.5, 0.35) : vec3(0.35, 0.5, 1.7);   // "cor" dos quarks
          vec3 cn = mix(vec3(0.56, 0.64, 0.72), vec3(0.95, 0.27, 0.24), step(0.22, fract(aTri.x * 13.71 + aTri.z * 7.3)));   // ~7 prótons para cada nêutron
          vec3 c = vec3(1.5, 1.45, 1.7);
          c = mix(c, cq, uQ); c = mix(c, cn, uNuc); c = mix(c, vec3(0.16, 0.11, 0.08), uGas); c = mix(c, aWc * 1.25, k * uWeb);
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          float z = -mv.z, s = aS.w * uScale * uPx / max(z, 0.0001);
          c *= uBr * smoothstep(uNear * 0.3, uNear, z);
          if (s < 1.4) { c *= (s / 1.4) * (s / 1.4); s = 1.4; } gl_PointSize = min(s, 48.0); vC = c; }`
    });
    m.userData.base = 1; lvPts[0].push(m); allPtsMats.push(m);
    const p = new THREE.Points(g, m); p.frustumCulled = false; LV[0].add(p); return { p, u };
  })();

  // primeiras estrelas: acendem nos fios da teia, azuis e gigantes, e viram o brilho das primeiras galáxias
  const FST = [];
  { const wp = gas.p.geometry.attributes.aW;
    for (let i = 0, n = 0; i < NG && n < 16; i += 97) { const v = new THREE.Vector3().fromBufferAttribute(wp, i); if (v.length() < 3.6 && v.length() > 0.6) { const f = flare(0xa8c4ff, 1, 0), c = sprite(0xd8e6ff, 1, 0); f.position.copy(v); c.position.copy(v); LV[0].add(f, c); FST.push({ f, c, at: 21.6 + n * 0.3 + rand() * 0.2 }); n++; } } }
  const nodeGlow = nodes.map(n => { const g = sprite(0xffe9c8, 0.7, 0); g.position.copy(n); LV[0].add(g); return g; });

  /* ---------- Nível 1: a Via Láctea (espiral barrada, poeira, berçários rosados e o "você está aqui") ---------- */
  const MWW = 0.03, SUN_R = 5.6, SUN_A = 3.6 * Math.log(SUN_R / 1.4) + 0.35;
  const SUN0 = new THREE.Vector3(Math.cos(SUN_A) * SUN_R, 0, Math.sin(SUN_A) * SUN_R);
  const mwSpin = new THREE.Group(); LV[1].add(mwSpin);
  const mwPts = ptsIn(1, small ? 50000 : 90000);
  { const pa = mwPts.geometry.attributes, N = pa.position.count;
    const cB = new THREE.Color(1.0, 0.86, 0.62), cA = new THREE.Color(0.62, 0.77, 1.0), cH = new THREE.Color(1.0, 0.43, 0.66), c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rand(); let x, y, z, sz = 0.03 + Math.pow(rand(), 8) * 0.1;
      if (u < 0.22) { const r = Math.abs(gauss()) * 0.9; const a = rand() * TAU; x = Math.cos(a) * r * 1.6; z = Math.sin(a) * r * 0.7; y = gauss() * 0.25 * Math.exp(-r); c.copy(cB); }
      else {
        const k = rand() < 0.5 ? 0 : Math.PI, r = 1.4 + Math.pow(rand(), 0.8) * 8.5, th = k + 3.6 * Math.log(r / 1.4) + gauss() * (0.12 + 0.03 * r);
        x = Math.cos(th) * r; z = Math.sin(th) * r; y = gauss() * 0.06; c.copy(cA).lerp(cB, Math.exp(-r / 2.5)); if (rand() < 0.05 && r > 3) { c.copy(cH); sz *= 2.2; }
      }
      pa.position.setXYZ(i, x, y, z); const b = 0.25 + Math.pow(rand(), 3) * 0.9; pa.aColor.setXYZ(i, c.r * b, c.g * b, c.b * b); pa.aSize.setX(i, sz);
    } }
  // poeira: escurece o que já foi desenhado, seguindo os braços um pouco por dentro
  const mwDust = new THREE.Mesh(new THREE.PlaneGeometry(22, 22), new THREE.ShaderMaterial({
    uniforms: { tN: { value: NOISE3 }, uA: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform sampler3D tN; uniform float uA; varying vec2 vP;
      void main(){ float r = length(vP), th = atan(vP.y, vP.x);
        float arm = 0.5 + 0.5 * cos(2.0 * (th - 3.6 * log(max(r, 0.3) / 1.4)) - 0.55);
        float n = texture(tN, vec3(vP * 0.06, 0.3)).r * 0.6 + texture(tN, vec3(vP * 0.17, 0.7)).r * 0.4;
        float dd = pow(arm, 5.0) * smoothstep(1.2, 2.2, r) * smoothstep(10.5, 6.0, r) * smoothstep(0.35, 0.7, n);
        gl_FragColor = vec4(mix(vec3(1.0), vec3(0.32, 0.22, 0.16), dd * 0.85 * uA), 1.0); }`
  }));
  mwDust.rotation.x = -Math.PI / 2; mwDust.renderOrder = 5;
  const mwCore = sprite(0xffe2b5, 5.5, 0), mwSun = sprite(0xfff1c0, 0.5, 0); mwSun.position.copy(SUN0);
  mwSpin.add(mwPts, mwDust, mwCore, mwSun);
  const skyStars = starfield(4000, 300, 0.75); deep.add(skyStars);     // estrelas do fundo: presas à câmera, como no céu de verdade

  /* ---------- Nível 2: o Sistema Solar (nuvem que colapsa, protoestrela com jatos e o disco com lacunas, como o HL Tau do ALMA) ---------- */
  const solPts = ptsIn(2, small ? 16000 : 30000);
  const gaps = [1.0, 1.5, 2.1, 2.9, 4.4, 5.8, 7.1, 8.4];
  const NS = solPts.geometry.attributes.position.count, SR = new Float32Array(NS), SA = new Float32Array(NS), SY = new Float32Array(NS), SR0 = new Float32Array(NS);
  { const pa = solPts.geometry.attributes;
    for (let i = 0; i < NS; i++) { SR[i] = 0.5 + Math.pow(rand(), 0.7) * 9; SR0[i] = 6 + rand() * 14; SA[i] = rand() * TAU; SY[i] = gauss() * 0.04 * SR[i]; const w = 0.4 + Math.pow(rand(), 2); pa.aColor.setXYZ(i, w, w * 0.62, w * 0.36); pa.aSize.setX(i, 0.02 + Math.pow(rand(), 6) * 0.05); } }
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
  const sunG = sprite(0xffcf80, 4, 0), sunF = flare(0xffe0b0, 2.2, 0);
  const jets = [1, -1].map(sg => { const j = sprite(0x9fc4ff, 1, 0); j.center.set(0.5, sg > 0 ? 0 : 1); LV[2].add(j); return j; });
  const PLN = [[0.10, 0x9f9f9f], [0.13, 0xe8c48f], [0.14, 0xd0552a], [0.11, 0xc65a3a], [0.4, 0xd8b48a], [0.34, 0xe6d3a2], [0.22, 0x9fe3ec], [0.21, 0x5b7cff]];
  const planets = PLN.map(([r, c], i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8, emissive: i === 2 ? 0x3a0c02 : 0 })); LV[2].add(m); return { m, a: rand() * TAU, R: gaps[i] }; });
  const solL = new THREE.PointLight(0xfff0d8, 60, 0, 1.2);
  LV[2].add(solPts, disk, sunM, sunG, sunF, solL);
  deep.add(new THREE.AmbientLight(0x202030, 1));
  // relógio das órbitas: desacelera até parar quando a câmera chega na Terra (sem isso o Sol "andaria" no céu)
  const oc = t => t < 41 ? t : t < 46 ? 41 + (t - 41) - (t - 41) ** 2 / 10 : 43.5;
  planets[2].a = -(0.6 + 46.4 * 0.045) - 43.5 * 0.4 / Math.pow(planets[2].R, 1.5);
  const planetPos = (i, t, v = new THREE.Vector3()) => { const o = planets[i], a = o.a + oc(t) * 0.4 / Math.pow(o.R, 1.5); return v.set(Math.cos(a) * o.R, 0, Math.sin(a) * o.R); };

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
  const moon = new THREE.Mesh(new THREE.SphereGeometry(1737, 48, 32), new THREE.MeshStandardMaterial({ color: 0x9a9aa0, roughness: 1, envMapIntensity: 0 }));
  moon.position.copy(N0).multiplyScalar(-1).addScaledVector(EAST, 1).normalize().multiplyScalar(60000);
  const sunLight = new THREE.DirectionalLight(0xffffff, 3.2); sunLight.position.copy(SUN).multiplyScalar(1e5);
  es.add(earth, atmo, moon, sunLight, new THREE.AmbientLight(0x8090b0, 0.5));   // as estrelas do fundo vêm da cena do espaço, desenhada antes

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
  const getJ = u => fetch(u).then(r => r.json()).catch(() => null);
  // modelo novo da escola, exportado do Blender (assets/models/senai.glb, comprimido com Draco).
  // Se o arquivo não existir, a escola é montada peça por peça a partir de campus.json, como antes.
  const GLB_URL = 'assets/models/senai.glb';
  const getGLB = () => fetch(GLB_URL, { method: 'HEAD', cache: 'no-store' }).then(r => !r.ok ? null : new Promise(res => {
    const ld = new GLTFLoader(), dr = new DRACOLoader(); dr.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/'); ld.setDRACOLoader(dr);
    ld.load(GLB_URL, g => { dr.dispose(); res(g.scene); }, undefined, e => { console.warn('senai.glb não carregou; usando campus.json', e); res(null); });
  })).catch(() => null);
  Promise.all([...['senai-iracemapolis', 'campus', 'cobertura', 'carros'].map(n => getJ(`assets/data/${n}.json`)), getGLB()]).then(([d, cd, cov, cars, glb]) => { if (!d) return; siteData = d; carData = cars; buildSite(d, cd, cov, glb); }).catch(e => console.error(e));
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
    const U = { uTile: { value: tile }, uGray: { value: o.gray || 0 }, uGain: { value: o.gain || 1 }, uEdge: { value: o.edge || 0 }, uCmap: { value: o.cmap || null }, uCB: { value: new THREE.Vector4(...(o.cbox || [0, 0, 1, 1])) } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP, vTN;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvTP = position; vTN = normal;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vTP, vTN; uniform float uTile, uGray, uGain, uEdge;' + (o.cmap ? '\nuniform sampler2D uCmap; uniform vec4 uCB;' : '')).replace('#include <map_fragment>', `
        vec3 bw = pow(abs(normalize(vTN)), vec3(4.0)); bw /= (bw.x + bw.y + bw.z);
        vec3 P = vTP / uTile;
        vec4 tc = texture2D(map, P.zy) * bw.x + texture2D(map, P.xz) * bw.y + texture2D(map, P.xy) * bw.z;
        vec4 tc2 = texture2D(map, P.xz * 0.13 + 0.37) * bw.y + texture2D(map, P.xy * 0.13 + 0.37) * bw.z + texture2D(map, P.zy * 0.13) * bw.x;
        tc.rgb *= 0.8 + 0.4 * dot(tc2.rgb, vec3(0.333));          // quebra a repetição da textura
        tc.rgb = mix(tc.rgb, vec3(dot(tc.rgb, vec3(0.3, 0.59, 0.11))), uGray) * uGain;
        diffuseColor *= tc;${o.cmap ? `
        vec2 cu = (vTP.xz - uCB.xy) / uCB.zw; diffuseColor.rgb *= texture2D(uCmap, vec2(cu.x, 1.0 - cu.y)).rgb;` : ''}
        if (uEdge > 0.0) diffuseColor.a *= smoothstep(uEdge, uEdge * 0.55, length(vTP.xy));`);
    };
    m.customProgramCacheKey = () => 'tri' + (o.cmap ? 'c' : '');
    return m;
  }
  let carData = null;
  function buildSite(d, cd, cov, glb) {
    const M = (c, r = 0.85, m = 0, ex) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...ex });
    const DS = THREE.DoubleSide;
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
    // caixa por limites (x leste, z sul, y altura), como no gerador do Blender
    const box = (mat, x0, x1, z0, z1, y0, y1) => { if (x1 - x0 > 1e-3 && z1 - z0 > 1e-3 && y1 - y0 > 1e-3) put(mat, B(x1 - x0, y1 - y0, z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); };
    const poly = (mat, V, F) => {                          // malha livre: V = [[x,y,z]...], F = faces (tri/quad)
      const a = []; F.forEach(f => { for (let i = 1; i < f.length - 1; i++) [f[0], f[i], f[i + 1]].forEach(k => a.push(...V[k])); });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); g.computeVertexNormals();
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(a.length / 3 * 2), 2)); put(mat, g, 0, 0, 0);
    };
    const [AX0, AX1, AZ0, AZ1] = cov ? cov.area : [0, 0, 0, 0];
    const inCov = (x, z) => cov && x > AX0 && x < AX1 && z > AZ0 && z < AZ1;
    // chão: fora da área do satélite, o chão genérico; dentro, a cobertura do solo classificada (grama, mata, terra roxa, pavimento)
    const ground = new THREE.Mesh(PL(2400, 2000), triMat('leafy_grass', 4, 0x8f9a62, 1, 0, { gray: 0.25, edge: 1150, mat: { transparent: true, depthWrite: false } }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = 0.05; site.add(ground);
    if (cov) {
      const cg = PL(AX1 - AX0, AZ1 - AZ0); cg.rotateX(-Math.PI / 2); cg.translate((AX0 + AX1) / 2, 0.1, (AZ0 + AZ1) / 2);
      const ct = TXL.load('assets/tex/solo_cor.jpg'); ct.colorSpace = THREE.SRGBColorSpace; ct.anisotropy = 8;
      site.add(new THREE.Mesh(cg, triMat('leafy_grass', 3, 0xffffff, 1, 0, { gray: 1, gain: 1.75, cmap: ct, cbox: [AX0, AZ0, AX1 - AX0, AZ1 - AZ0] })));
    }
    const AREA = { lot: [0xb9b4aa, 0.25, 'concrete_floor_02', 5, 0xe4e2dc], garden: [0x4f8a3a, 0.35, 'leafy_grass', 3, 0x8fae70], parking: [0x55585e, 0.3, 'asphalt_02', 6, 0xb8b8b8], forest: [0x2f5a2a, 0.0, 'leafy_grass', 5, 0x7f9a66], field: [0x7f8f45, 0.0, 'leafy_grass', 4, 0xb8b27a], dirt: [0xa86a3e, 0.0, 'red_laterite_soil_stones', 8, 0xd8b8a8] };
    const areaMat = {}, trees = [];
    d.areas.forEach(a => {
      if (inCov(a.x0, a.z0) && inCov(a.x1, a.z1)) return;   // já descrita pela cobertura do satélite
      const [c, hgt, tn, tl, tc] = AREA[a.t] || [0x888888, 0], w = a.x1 - a.x0, dd = a.z1 - a.z0;
      const mt = areaMat[a.t] || (areaMat[a.t] = tn ? triMat(tn, tl, tc, 0.95) : M(c, 1));
      const m = new THREE.Mesh(PL(w, dd), mt); m.rotation.x = -Math.PI / 2; m.position.set((a.x0 + a.x1) / 2, 0.12 + hgt, (a.z0 + a.z1) / 2); site.add(m);
      if (a.t === 'forest') { const n = Math.min(900, Math.round(w * dd / 70)); for (let i = 0; i < n; i++) { const x = a.x0 + rand() * w, z = a.z0 + rand() * dd; if (!inCov(x, z)) trees.push([x, z, 6 + rand() * 7, 0]); } }
    });
    // árvores medidas no satélite: posição da copa (corrigida da inclinação da imagem), raio e altura
    const campusR = (cd ? cd.els : []).filter(e => e.r && e.t !== 'surf').map(e => e.r);
    const inside = (x, z, rs, pad = 1) => rs.some(r => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad);
    const nbR = d.predios.filter(b => !b.id.startsWith('senai')).map(b => [b.x - b.w / 2, b.x + b.w / 2, b.z - b.d / 2, b.z + b.d / 2]);
    if (cov) cov.arvores.forEach(([x, z, r, h]) => { if (!inside(x, z, campusR) && !inside(x, z, nbR)) trees.push([x, z, h, r]); });
    const crownGeo = new THREE.IcosahedronGeometry(1, 2); { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 0.82 + 0.3 * Math.abs(Math.sin(p.getX(i) * 7.1 + p.getY(i) * 5.3 + p.getZ(i) * 3.7)); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } crownGeo.computeVertexNormals(); }
    if (cd && !glb) cd.els.filter(e => e.t === 'trees' && e.keep).forEach(e => e.pts.forEach(([x, z]) => trees.push([x, z, e.h || 6, 0])));   // árvores vistas nas fotos (praça interna)
    const crowns = new THREE.InstancedMesh(crownGeo, M(0xffffff, 0.95), trees.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion();
    const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.26, 1, 6), M(0x5a4a3a, 0.9), trees.length);
    trees.forEach(([x, z, h, r], i) => {
      const cr = r ? Math.max(1.6, r * 1.05) : h * 0.42, cy = h - cr * 0.75;
      m4.compose(new THREE.Vector3(x, cy, z), qq.setFromEuler(_e.set(0, rand() * 6.3, 0)), new THREE.Vector3(cr, cr * 0.8, cr)); crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, new THREE.Color().setHSL(0.25 + rand() * 0.06, 0.5, 0.09 + rand() * 0.06));
      m4.compose(new THREE.Vector3(x, cy / 2, z), qq.identity(), new THREE.Vector3(1, cy, 1)); trunkM.setMatrixAt(i, m4);
    });
    site.add(crowns, trunkM);
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
    // vizinhos do distrito: volume + telhado com a cor medida no satélite
    const wallV = triMat('concrete_wall_008', 4, 0xdedcd6, 0.92, 0, { gray: 0.6 }), solarV = M(0x1d2a4a, 0.25, 0.4), steel = M(0x8d949c, 0.4, 0.8);
    const roofV = triMat('box_profile_metal_sheet', 2.5, 0xd8dce2, 0.55, 0.12, { gray: 1, gain: 2.0 }), roofC = {};
    const roofOf = i => { const c = cov && cov.telhados[String(i)]; if (!c) return roofV; const k = c.map(v => Math.round(v * 20) / 20).join(); return roofC[k] || (roofC[k] = triMat('box_profile_metal_sheet', 2.5, new THREE.Color().setRGB(...c, THREE.SRGBColorSpace), 0.55, 0.12, { gray: 1, gain: 2.0 })); };
    const gableGeo = (b, wh) => {
      const along = b.w >= b.d, Lr = along ? b.w : b.d, Wr = along ? b.d : b.w, rh = b.h - wh;
      const sh = new THREE.Shape(); sh.moveTo(-Wr / 2, 0); sh.lineTo(Wr / 2, 0); sh.lineTo(0, rh); sh.closePath();
      const rg = new THREE.ExtrudeGeometry(sh, { depth: Lr, bevelEnabled: false }); rg.translate(0, 0, -Lr / 2); if (along) rg.rotateY(Math.PI / 2); return rg;
    };
    d.predios.forEach((b, i) => {
      if (b.id.startsWith('senai')) return;                  // a escola vem de campus.json (medida no satélite)
      if (b.roof === 'solar') { for (let k = 0; k < 6; k++) put(solarV, B(b.w / 6 - 0.6, 0.12, b.d), b.x - b.w / 2 + (k + 0.5) * b.w / 6, 1.3, b.z, -0.3); return; }
      if (b.roof === 'frame') {
        for (let k = 0; k <= 6; k++) { for (const sx of [-1, 1]) put(steel, B(0.4, b.h, 0.4), b.x + sx * b.w / 2, b.h / 2, b.z - b.d / 2 + k * b.d / 6); put(steel, B(b.w, 0.4, 0.4), b.x, b.h, b.z - b.d / 2 + k * b.d / 6); }
        return;
      }
      const wh = b.roof === 'gable' ? b.h * 0.72 : b.h, rm = roofOf(i);
      put(wallV, B(b.w, wh, b.d), b.x, wh / 2, b.z);
      if (b.roof === 'gable') put(rm, gableGeo(b, wh), b.x, wh, b.z);
      else { put(rm, B(b.w - 0.6, 0.3, b.d - 0.6), b.x, b.h + 0.05, b.z); put(wallV, B(b.w + 0.2, 0.7, b.d + 0.2), b.x, b.h - 0.2, b.z); }
    });
    if (cd) buildCampus(cd, { M, put, box, poly, flat, B, PL, m4, qq }, glb);
    // junta cada lote numa malha só
    lots.forEach((gs, mat) => { const g = mergeGeometries(gs, false); gs.forEach(x => x.dispose()); if (g) site.add(new THREE.Mesh(g, mat)); });
    if (glb) addGLB(glb);
    // rótulos: primeiro os pontos que mais chamam atenção
    const pri = ['senai-oficinas', 'senai-bloco-l', 'senai-torre', 'senai-bloco-o1'], rk = o => (pri.indexOf(o.b.id) + 1) || 9;
    hot.sort((a, b) => rk(a) - rk(b));
    site.traverse(o => { if (o.isMesh) { o.castShadow = o !== ground && !o.userData.proxy && !o.userData.noShadow; o.receiveShadow = true; } });
    site.userData.ready = true; shadowDirty = true;
  }

  // Escola SENAI "João Guilherme Sabino Ometto" a partir de campus.json: cada peça medida no ortomosaico (0,11 m/px) e
  // conferida nas fotos aéreas e de solo da Bilenge Engenharia (projeto padrão SENAI-SP, NPC Arquitetura)
  // materiais do Blender → as mesmas texturas reais (Poly Haven) do resto do distrito, mantendo a cor do modelo
  const GLB_TEX = [[/piso|calcada|calçada|pavimento/i, 'concrete_pavement', 3], [/parede|reboco|plaster/i, 'white_plaster_02', 3], [/concreto|pilar|forma/i, 'concrete_wall_008', 4],
    [/telha|chapa/i, 'box_profile_metal_sheet', 2.5], [/bloquete|paver/i, 'hexagonal_concrete_paving', 1.4], [/grama|gramado|lawn/i, 'leafy_grass', 2.5], [/asfalto/i, 'asphalt_02', 6], [/terra|solo/i, 'red_laterite_soil_stones', 5]];
  function addGLB(g) {
    const cache = new Map();
    g.traverse(o => {
      if (!o.isMesh || Array.isArray(o.material)) return;
      const old = o.material, nm = old.name || '';
      o.userData.glb = true;
      if (/vidro|glass/i.test(nm) || old.transparent || /^car_/i.test(nm)) { old.envMapIntensity = /vidro/i.test(nm) ? 1.4 : 1; return; }
      const hit = GLB_TEX.find(([re]) => re.test(nm)); if (!hit) return;
      if (!cache.has(nm)) cache.set(nm, triMat(hit[1], hit[2], old.color ? old.color.clone() : 0xffffff, old.roughness ?? 0.9, old.metalness ?? 0, { gray: 0.7, gain: 1.15, mat: { side: old.side } }));
      o.material = cache.get(nm);
    });
    site.add(g); site.userData.glb = true;
  }
  // Escola: com o modelo novo (GLB) só ficam daqui os volumes invisíveis do clique e os ônibus da rua;
  // sem ele, a escola inteira é montada aqui, peça por peça
  function buildCampus(cd, K, glb) {
    const G = !!glb, noop = () => {}, addS = (...o) => { if (!G) site.add(...o); };
    const { M, B, PL, m4, qq } = K, put = G ? noop : K.put, box = G ? noop : K.box, poly = G ? noop : K.poly, DS = THREE.DoubleSide;
    const mosaic = (() => {                                 // pastilha cerâmica vermelha 10 x 10 cm com rejunte claro
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#d9d2c8'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) { const k = 0.85 + rand() * 0.25; g.fillStyle = `rgb(${158 * k | 0},${22 * k | 0},${26 * k | 0})`; g.fillRect(i * 16 + 1, j * 16 + 1, 14.5, 14.5); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; TXC.mosaico = t; return t;
    })();
    const meshTex = (() => {                                // tela soldada do gradil: fios a cada 5 cm (vertical) e 20 cm (horizontal)
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#c7cccc'; g.fillRect(0, 0, 7, 64); g.fillRect(0, 0, 64, 4);
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(50, 10); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const mt = {
      parede: triMat('white_plaster_02', 3, 0xffffff, 0.85, 0, { gray: 0.8, gain: 1.22 }),
      concreto: triMat('concrete_wall_008', 4, 0xd8d5ce, 0.9),
      forma: triMat('concrete_wall_008', 7, 0xe6e3dc, 0.9, 0, { gray: 0.7, gain: 1.18 }),
      pilar: triMat('concrete_wall_008', 2, 0xe0ddd6, 0.85, 0, { gray: 0.6, gain: 1.15 }),
      telha: triMat('box_profile_metal_sheet', 2.5, 0xf2ecdc, 0.55, 0.08, { gray: 1, gain: 2.3, mat: { side: DS } }),
      azul: triMat('box_profile_metal_sheet', 1.2, 0x1f8199, 0.6, 0.0, { gray: 1, gain: 1.8, mat: { side: DS } }),
      testeira: M(0x0f6a80, 0.45, 0.1), rufo: M(0xaeb1b3, 0.4, 0.6), forro: M(0xcdc2aa, 0.8), trelica: M(0xc9b993, 0.5, 0.4),
      vidro: M(0x1a242c, 0.05, 0.85, { envMapIntensity: 1.3 }), esquadria: M(0xf2f2ee, 0.4, 0.1),
      pastilha: triMat('mosaico', 1.6, 0xffffff, 0.3), forroBeiral: M(0x6b5c4d, 0.8), ceramica: triMat('mosaico', 0.8, 0xd8c9a8, 0.35), vermelho: M(0xa3161d, 0.35), branco: M(0xf4f4f2, 0.5),
      galv: M(0xbfc3c3, 0.35, 0.85), preto: M(0x161616, 0.5, 0.3), painel: M(0x0e1630, 0.12, 0.5),
      gradil: M(0xc7cccc, 0.45, 0.7, { map: meshTex, alphaTest: 0.5, side: DS }), toldo: M(0x1f4fb4, 0.35, 0.2, { side: DS }),
      grama: triMat('leafy_grass', 2.5, 0x8db062, 1), terra_batida: triMat('red_laterite_soil_stones', 5, 0xe0aa90, 1),
      piso_concreto: triMat('concrete_pavement', 3, 0xe6e4de, 0.95, 0, { gray: 0.5 }), bloquete: triMat('hexagonal_concrete_paving', 1.4, 0xd8ccc4, 1),
      calcada: triMat('concrete_pavement', 2.5, 0xf0eee8, 0.95), piso_vermelho: triMat('concrete_pavement', 3, 0xc08a70, 0.9), granito: M(0x55575b, 0.45, 0.1), sebe: M(0x1f3a12, 0.95), pingpong: M(0x1f4d52, 0.4),
    };
    const ribbon = (x0, x1, z0, z1, y0, y1, side, step = 1.25, rows = 1, gm = mt.vidro) => {   // faixa de janelas: vidro + montantes e travessas brancos
      const e = 0.06;
      if (side === 'n' || side === 's') {
        const z = side === 'n' ? z0 : z1; box(gm, x0 + 0.3, x1 - 0.3, z - e, z + e, y0, y1);
        const n = Math.max(1, Math.floor((x1 - x0 - 0.6) / step));
        for (let i = 0; i <= n; i++) { const x = x0 + 0.3 + i * (x1 - x0 - 0.6) / n; box(mt.esquadria, x - 0.04, x + 0.04, z - e - 0.02, z + e + 0.02, y0, y1); }
        for (let k = 0; k <= rows; k++) { const y = y0 + k * (y1 - y0) / rows; box(mt.esquadria, x0 + 0.3, x1 - 0.3, z - e - 0.03, z + e + 0.03, y - 0.04, y + 0.04); }
      } else {
        const x = side === 'e' ? x1 : x0; box(gm, x - e, x + e, z0 + 0.3, z1 - 0.3, y0, y1);
        const n = Math.max(1, Math.floor((z1 - z0 - 0.6) / step));
        for (let i = 0; i <= n; i++) { const z = z0 + 0.3 + i * (z1 - z0 - 0.6) / n; box(mt.esquadria, x - e - 0.02, x + e + 0.02, z - 0.04, z + 0.04, y0, y1); }
        for (let k = 0; k <= rows; k++) { const y = y0 + k * (y1 - y0) / rows; box(mt.esquadria, x - e - 0.03, x + e + 0.03, z0 + 0.3, z1 - 0.3, y - 0.04, y + 0.04); }
      }
    };
    const trusses = (x0, x1, z0, z1, y, along = 'x', sp = 5, depth = 0.55) => {    // vigas treliçadas aparentes nos beirais
      if (along === 'x') {
        const n = Math.max(1, Math.floor((x1 - x0) / sp));
        for (let i = 0; i <= n; i++) {
          const x = x0 + i * (x1 - x0) / n; box(mt.trelica, x - 0.08, x + 0.08, z0, z1, y - 0.08, y); box(mt.trelica, x - 0.06, x + 0.06, z0, z1, y - depth, y - depth + 0.08);
          const m = Math.max(2, Math.floor((z1 - z0) / 1.2)); for (let j = 0; j < m; j++) { const za = z0 + j * (z1 - z0) / m; box(mt.trelica, x - 0.03, x + 0.03, za, za + 0.06, y - depth, y); }
        }
      } else {
        const n = Math.max(1, Math.floor((z1 - z0) / sp));
        for (let i = 0; i <= n; i++) { const z = z0 + i * (z1 - z0) / n; box(mt.trelica, x0, x1, z - 0.08, z + 0.08, y - 0.08, y); box(mt.trelica, x0, x1, z - 0.06, z + 0.06, y - depth, y - depth + 0.08); }
      }
    };
    const columns = (x0, x1, z0, z1, y1, sp = 6, s = 0.4, sides = 'nsew') => {
      const pts = new Set();
      for (const sd of sides) {
        if (sd === 'n' || sd === 's') { const z = sd === 'n' ? z0 : z1, n = Math.max(1, Math.round((x1 - x0) / sp)); for (let i = 0; i <= n; i++) pts.add(`${(x0 + i * (x1 - x0) / n).toFixed(2)},${z}`); }
        else { const x = sd === 'w' ? x0 : x1, n = Math.max(1, Math.round((z1 - z0) / sp)); for (let i = 0; i <= n; i++) pts.add(`${x},${(z0 + i * (z1 - z0) / n).toFixed(2)}`); }
      }
      pts.forEach(p => { const [x, z] = p.split(',').map(Number); const yt = typeof y1 === 'function' ? y1(x) : y1;
        box(mt.pilar, x - s / 2, x + s / 2, z - s / 2, z + s / 2, 0, yt); });          // pilar quadrado de concreto, como nas fotos
    };
    const fascia = (x0, x1, z0, z1, y, hh = 0.45, t = 0.08) => {
      box(mt.testeira, x0 - t, x1 + t, z0 - t, z0, y - hh, y); box(mt.testeira, x0 - t, x1 + t, z1, z1 + t, y - hh, y);
      box(mt.testeira, x0 - t, x0, z0, z1, y - hh, y); box(mt.testeira, x1, x1 + t, z0, z1, y - hh, y);
    };
    const hipRoof = (x0, x1, z0, z1, ye, yr, mat) => {      // quatro águas bem baixa (administração e refeitório)
      const L = x1 - x0, W = z1 - z0, cz = (z0 + z1) / 2, cx = (x0 + x1) / 2;
      const V = [[x0, ye, z0], [x1, ye, z0], [x1, ye, z1], [x0, ye, z1]];
      if (L >= W) { V.push([x0 + W / 2, yr, cz], [x1 - W / 2, yr, cz]); poly(mat, V, [[0, 4, 5, 1], [2, 5, 4, 3], [3, 4, 0], [1, 5, 2]]); }
      else { V.push([cx, yr, z0 + L / 2], [cx, yr, z1 - L / 2]); poly(mat, V, [[1, 4, 5, 2], [3, 5, 4, 0], [0, 4, 1], [2, 5, 3]]); }
    };
    const gableRoof = (x0, x1, z0, z1, ye, yr, mat) => { const zc = (z0 + z1) / 2; poly(mat, [[x0, ye, z0], [x1, ye, z0], [x1, yr, zc], [x0, yr, zc], [x0, ye, z1], [x1, ye, z1]], [[0, 3, 2, 1], [3, 4, 5, 2]]); };
    const sign = (text, color, w, h, italic = true, bg = null) => {
      const c = document.createElement('canvas'); c.width = 1024; c.height = Math.round(1024 * h / w); const g = c.getContext('2d');
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
      g.fillStyle = color; g.font = `${italic ? 'italic ' : ''}900 ${c.height * 0.78}px "Inter Tight", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, c.width / 2, c.height * 0.54);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
      const m = new THREE.Mesh(PL(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: !bg, roughness: 0.4, alphaTest: bg ? 0 : 0.3 })); m.userData.noShadow = true; return m;
    };
    const addHot = (e, r, h) => {                          // volume invisível só para o clique e o rótulo
      const g = new THREE.Group(), pm = new THREE.Mesh(B(r[1] - r[0], h, r[3] - r[2]), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
      pm.position.set((r[0] + r[1]) / 2, h / 2, (r[2] + r[3]) / 2); pm.userData.proxy = true; g.add(pm); site.add(g);
      hot.push({ b: { id: e.id, desc: e.desc, x: (r[0] + r[1]) / 2, z: (r[2] + r[3]) / 2, w: r[1] - r[0], d: r[3] - r[2], h }, g });
    };
    const palms = [], cars = [];
    const bege = M(0xcdc3aa, 0.6, 0.05, { side: DS });
    const vidroReal = new THREE.MeshPhysicalMaterial({ color: 0x9fb4b2, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.32, depthWrite: false, envMapIntensity: 1.5, side: DS });
    const pisoInt = M(0x9e9a91, 0.3), luz = new THREE.MeshBasicMaterial({ color: 0xfff6e8 }), mesa = M(0x8c6b4d, 0.5), cadeira = M(0x1a2a52, 0.55);
    for (const e of cd.els) {
      const t = e.t, r = e.r;
      if (t === 'shed') {
        const [x0, x1, z0, z1] = r, ov = e.over, ye = e.eave, yr = e.ridge, wx0 = x0 + ov, wx1 = x1 - ov, wz0 = z0 + ov, wz1 = z1 - ov, zc = (wz0 + wz1) / 2;
        box(mt.concreto, wx0, wx1, wz0, wz1, 0, 4.6); box(mt.parede, wx0 + 0.1, wx1 - 0.1, wz0 + 0.1, wz1 - 0.1, 4.6, ye);
        for (const sd of 'ns') { ribbon(wx0, wx1, wz0, wz1, 5.2, ye - 0.5, sd, 1.5, 2); ribbon(wx0, wx1, wz0, wz1, 1.2, 2.6, sd, 1.5, 1); }
        for (const xg of [wx0 - 0.05, wx1 + 0.05]) poly(mt.azul, [[xg, 4.6, wz0], [xg, 4.6, wz1], [xg, ye, wz1], [xg, yr, zc], [xg, ye, wz0]], [[0, 1, 2, 3, 4]]);
        gableRoof(x0, x1, z0, z1, ye + 0.15, yr + 0.15, mt.telha);
        const [lw, lh] = e.lantern; box(mt.galv, x0 + 1, x1 - 1, zc - lw / 2, zc + lw / 2, yr, yr + lh);
        gableRoof(x0 + 0.6, x1 - 0.6, zc - lw / 2 - 0.5, zc + lw / 2 + 0.5, yr + lh, yr + lh + 0.35, mt.telha);
        fascia(x0, x1, z0 - 0.05, z0 + 0.05, ye + 0.2, 0.55); fascia(x0, x1, z1 - 0.05, z1 + 0.05, ye + 0.2, 0.55);
        trusses(x0, x1, z0, wz0, ye, 'x', 6, 0.5); trusses(x0, x1, wz1, z1, ye, 'x', 6, 0.5);
        addHot(e, r, yr);
      } else if (t === 'block') {
        const [x0, x1, z0, z1] = r, h = e.h;
        box(mt[e.wall] || mt.parede, x0, x1, z0, z1, 0, h); box(mt.parede, x0 - 0.1, x1 + 0.1, z0 - 0.1, z1 + 0.1, h - 0.05, h + 0.6); box(mt.telha, x0 + 0.2, x1 - 0.2, z0 + 0.2, z1 - 0.2, h + 0.05, h + 0.25);
        if (e.win) for (const sd of 'ns') ribbon(x0, x1, z0, z1, 1.1, 2.3, sd, 1.2);
        if (e.awning) { box(mt.toldo, x0 + 2, x1 - 4, z1, z1 + 1.6, 2.8, 2.95); for (let k = 0; k < 3; k++) box(mt.vidro, x0 + 3 + k * 3.2, x0 + 5 + k * 3.2, z1 - 0.05, z1 + 0.05, 0.05, 2.6); }
        addHot(e, r, h);
      } else if (t === 'gallery') {
        const [x0, x1, z0, z1] = r, h = e.h;
        box(mt.parede, x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 2.6, 0, 3.4); box(mt.concreto, x0, x1, z0, z1 - 0.2, 3.4, 3.65); box(mt.parede, x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 2.6, 3.65, h - 0.3);
        ribbon(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 2.6, 1.0, 2.6, 's', 1.25); ribbon(x0 + 0.3, x1 - 0.3, z0 + 0.3, z1 - 2.6, 4.6, 6.1, 's', 1.25);
        box(mt.galv, x0, x1, z1 - 0.3, z1 - 0.24, 4.7, 4.76); box(mt.galv, x0, x1, z1 - 0.3, z1 - 0.24, 4.2, 4.24);
        for (let xx = x0; xx <= x1; xx += 1.5) box(mt.galv, xx - 0.025, xx + 0.025, z1 - 0.3, z1 - 0.25, 3.65, 4.76);
        columns(x0 + 0.3, x1 - 0.3, z1 - 0.4, z1 - 0.4, h - 0.4, 6, 0.35, 'n');
        gableRoof(x0 - 0.8, x1 + 0.8, z0 - 0.5, z1 + 1.4, h - 0.3, h + 0.7, mt.telha); fascia(x0 - 0.8, x1 + 0.8, z1 + 1.35, z1 + 1.45, h - 0.25, 0.5);
        trusses(x0 - 0.8, x1 + 0.8, z1 - 0.3, z1 + 1.4, h - 0.3, 'x', 6, 0.4);
        addHot(e, r, h);
      } else if (t === 'bluebox') {                         // cobertura alta plana sobre pilares, saia de telha azul só a leste/norte
        const [x0, x1, z0, z1] = r, h = e.h, bh = e.base, o = e.over, lx0 = x0 + o.w, lx1 = x1 - o.e, lz0 = z0 + o.n, lz1 = z1 - o.s;
        if (e.vao_n) {                                      // térreo com vão aberto na ponta norte (DSC_2084): sala fechada, vão com pingue-pongue, resto envidraçado
          const vn = lz0 + (e.vao_n0 || 0), vz = lz0 + e.vao_n;
          box(mt.parede, lx0, lx1, vz, lz1, 0, bh); for (const sd of 'nsew') ribbon(lx0, lx1, vz, lz1, 1.0, 3.0, sd, 1.25, 2);
          if (vn > lz0) { box(mt.parede, lx0, lx1, lz0, vn, 0, bh); ribbon(lx0, lx1, lz0, vn, 1.0, 3.0, 'w', 1.25, 2); }
          box(mt.granito, lx0, lx1 + 0.6, vn, vz, 0, 0.17);
          for (let k = 0; k < 2; k++) { const xm = lx0 + 3 + k * 4, zm = (vn + vz) / 2; box(mt.pingpong, xm - 1.37, xm + 1.37, zm - 0.76, zm + 0.76, 0.74, 0.77); box(mt.preto, xm - 0.01, xm + 0.01, zm - 0.76, zm + 0.76, 0.77, 0.92); for (const dx of [-0.9, 0.9]) box(mt.galv, xm + dx - 0.04, xm + dx + 0.04, zm - 0.5, zm + 0.5, 0.17, 0.74); }
        } else { box(mt.parede, lx0, lx1, lz0, lz1, 0, bh); for (const sd of 'nsew') ribbon(lx0, lx1, lz0, lz1, 1.0, 3.0, sd, 1.25, 2); }
        box(mt.telha, lx0 - 0.6, lx1 + 0.6, lz0 - 0.6, lz1 + 0.6, bh, bh + 0.18); fascia(lx0 - 0.6, lx1 + 0.6, lz0 - 0.6, lz1 + 0.6, bh + 0.18, 0.35);
        const ix0 = lx0 + 1.2, ix1 = lx1 - 1.2, iz0 = lz0 + 1.2, iz1 = lz1 - 1.2;
        box(mt.parede, ix0, ix1, iz0, iz1, bh + 0.18, h - 0.8); for (const sd of 'nsew') ribbon(ix0, ix1, iz0, iz1, bh + 0.8, h - 1.4, sd, 1.25, 1);
        box(mt.telha, x0, x1, z0, z1, h - 0.3, h); fascia(x0, x1, z0, z1, h + 0.05, 0.5); box(mt.forro, x0, x1, z0, z1, h - 0.33, h - 0.3);
        for (const sd of (e.skirt || 'e')) {
          if (sd === 'e') box(mt.azul, x1 - 0.1, x1 + 0.02, z0, z1, bh + 0.6, h - 0.3); else if (sd === 'w') box(mt.azul, x0 - 0.02, x0 + 0.1, z0, z1, bh + 0.6, h - 0.3);
          else if (sd === 'n') box(mt.azul, x0, x1, z0 - 0.02, z0 + 0.1, bh + 0.6, h - 0.3); else box(mt.azul, x0, x1, z1 - 0.1, z1 + 0.02, bh + 0.6, h - 0.3);
        }
        columns(x0 + 0.4, x1 - 0.4, z0 + 0.4, z1 - 0.4, h - 0.3, 5.6, 0.4); trusses(x0, x1, z0, z1, h - 0.3, 'x', 5.6, 0.6);
        addHot(e, r, h);
      } else if (t === 'pavilion') {
        const [x0, x1, z0, z1] = r, ov = e.over, wx0 = x0 + ov, wx1 = x1 - ov, wz0 = z0 + ov, wz1 = z1 - ov;
        const gl = e.glass || '', hc = e.eave - 0.6;
        if (!gl) { box(mt.parede, wx0, wx1, wz0, wz1, 0, e.eave - 0.3); for (const sd of 'nsew') ribbon(wx0, wx1, wz0, wz1, 1.0, 2.6, sd, 1.25, 2); }
        else {                                           // casca oca: paredes finas, pele de vidro transparente e interior (piso, forro, luminárias, divisória, mesas)
          const wt = 0.2, W = { s: [wx0, wx1, wz1 - wt, wz1], n: [wx0, wx1, wz0, wz0 + wt], w: [wx0, wx0 + wt, wz0, wz1], e: [wx1 - wt, wx1, wz0, wz1] };
          for (const sd of 'nsew') {
            if (gl.includes(sd)) { ribbon(wx0, wx1, wz0, wz1, 0.1, hc, sd, 1.41, 2, vidroReal); const [a, b, c, d] = W[sd]; box(mt.parede, a, b, c, d, hc, e.eave - 0.3); }
            else { const [a, b, c, d] = W[sd]; box(mt.parede, a, b, c, d, 0, e.eave - 0.3); ribbon(wx0, wx1, wz0, wz1, 1.0, 2.6, sd, 1.25, 2); }
          }
          const ix0 = wx0 + 0.2, ix1 = wx1 - 0.2, iz0 = wz0 + 0.2, iz1 = wz1 - 0.2;
          box(pisoInt, ix0, ix1, iz0, iz1, 0, 0.17); box(mt.branco, ix0, ix1, iz0, iz1, hc, hc + 0.05);
          for (let x = ix0 + 1.2; x < ix1 - 0.6; x += 2.4) for (let z = iz0 + 1.2; z < iz1 - 0.6; z += 2.4) box(luz, x - 0.3, x + 0.3, z - 0.3, z + 0.3, hc - 0.02, hc);
          for (const sd of gl) { const [a, b, c, d] = W[sd]; if (sd === 's' || sd === 'n') box(mt.vermelho, a, b, (sd === 's' ? d : c) - 0.02, (sd === 's' ? d : c) + 0.02, 1.05, 1.15); else box(mt.vermelho, (sd === 'e' ? b : a) - 0.02, (sd === 'e' ? b : a) + 0.02, c, d, 1.05, 1.15); }   // faixa vermelha de segurança no vidro
          if (e.interior === 'refeitorio') {               // refeitório (foto DSC_2027): duas fileiras de mesas longas brancas com bancos fixos, pilares, parede de pastilha
            box(mt.branco, ix0, ix1, iz0, iz0 + 0.05, 0.1, hc);
            for (const xp of [ix0 + (ix1 - ix0) / 3, ix0 + 2 * (ix1 - ix0) / 3]) box(mt.pilar, xp - 0.2, xp + 0.2, (iz0 + iz1) / 2 - 0.2, (iz0 + iz1) / 2 + 0.2, 0.1, hc);
            for (const zr of [iz0 + (iz1 - iz0) * 0.3, iz0 + (iz1 - iz0) * 0.72]) for (let x = ix0 + 1.5; x + 2.4 <= ix1 - 1.5; x += 2.5) {
              box(mt.branco, x, x + 2.4, zr - 0.4, zr + 0.4, 0.72, 0.75); box(mt.preto, x + 0.1, x + 2.3, zr - 0.02, zr + 0.02, 0.3, 0.33);
              for (let k = 0; k < 4; k++) for (const sz of [-1, 1]) { const xb = x + 0.3 + k * 0.6, zb = zr + sz * 0.62; box(mt.branco, xb - 0.16, xb + 0.16, zb - 0.16, zb + 0.16, 0.44, 0.47); box(mt.preto, xb - 0.02, xb + 0.02, zb - 0.02, zb + 0.02, 0.1, 0.44); }
            }
          } else {
            const zb = iz0 + (iz1 - iz0) * 0.45; box(mt.forro, ix0, ix1, zb - 0.06, zb + 0.06, 0.1, hc);
            for (let x = ix0 + 2; x < ix1 - 1; x += 3) for (const zm of [iz1 - 2.4, iz1 - 5.2]) if (zm - 0.4 > zb + 0.5) { box(mesa, x - 0.7, x + 0.7, zm - 0.4, zm + 0.4, 0.72, 0.76); box(mt.preto, x - 0.05, x + 0.05, zm - 0.05, zm + 0.05, 0.1, 0.72); box(cadeira, x - 0.5, x + 0.5, zm - 0.9, zm - 0.5, 0.43, 0.9); }
          }
        }
        // cobertura curva (pontas leste/oeste levantadas, foto da fachada): laje, testeira bege grossa, forro bege e vigas aparentes
        const ye = e.eave + 0.1, rise = 0.5, xc = (x0 + x1) / 2, hl = (x1 - x0) / 2, yy = x => ye + rise * ((x - xc) / hl) ** 2, N = 24, tk = 0.35;
        const top = [], bot = [], fz0 = [], fz1 = [], Ft = [], Fb = [], Ff = [];
        for (let i = 0; i <= N; i++) { const x = x0 + (x1 - x0) * i / N, y = yy(x);
          top.push([x, y + 0.1, z0], [x, y + 0.1, z1]); bot.push([x, y - tk, z0], [x, y - tk, z1]);
          fz0.push([x, y + 0.15, z0 - 0.08], [x, y - tk - 0.35, z0 - 0.08]); fz1.push([x, y + 0.15, z1 + 0.08], [x, y - tk - 0.35, z1 + 0.08]); }
        for (let i = 0; i < N; i++) { const a = 2 * i, b = 2 * i + 2; Ft.push([a, a + 1, b + 1, b]); Fb.push([a, b, b + 1, a + 1]); Ff.push([a, b, b + 1, a + 1]); }
        poly(mt.telha, top, Ft); poly(mt.forroBeiral, bot, Fb); poly(bege, fz0, Ff); poly(bege, fz1, Ff.map(f => [f[0], f[3], f[2], f[1]]));
        for (const x of [x0, x1]) { const y = yy(x), dx = x === x0 ? -0.08 : 0.08; poly(bege, [[x + dx, y + 0.15, z0 - 0.08], [x + dx, y + 0.15, z1 + 0.08], [x + dx, y - tk - 0.35, z1 + 0.08], [x + dx, y - tk - 0.35, z0 - 0.08]], [[0, 1, 2, 3], [0, 3, 2, 1]]); }
        for (let x = x0 + 1.2; x < x1; x += 2.4) box(mt.trelica, x - 0.07, x + 0.07, z0, z1, yy(x) - tk - 0.32, yy(x) - tk);
        columns(x0 + 0.7, x1 - 0.7, z0 + 0.7, z1 - 0.7, x => yy(x) - 0.3, 6.2, 0.5);
        addHot(e, r, e.ridge);
      } else if (t === 'cube') {                            // sanitários: cubo de pastilha vermelha com telhadinho azul
        const [x0, x1, z0, z1] = r, h = e.h;
        box(mt.vermelho, x0, x1, z0, z1, 0, h); box(mt.concreto, x0, x1, z0, z1, h, h + 0.15);
        poly(mt.toldo, [[x0 - 0.3, h + 0.55, z0 - 0.3], [x1 + 0.3, h + 0.55, z0 - 0.3], [x1 + 0.3, h + 0.15, z1 + 0.3], [x0 - 0.3, h + 0.15, z1 + 0.3]], [[0, 3, 2, 1]]);
        box(mt.esquadria, (x0 + x1) / 2 - 0.5, (x0 + x1) / 2 + 0.5, z1 - 0.02, z1 + 0.04, 0, 2.2);
        addHot(e, r, h);
      } else if (t === 'patio') {
        const [x0, x1, z0, z1] = r, h = e.h;
        box(mt.granito, x0 + 0.5, x1 - 0.5, z0 + 0.5, z1 - 0.5, 0, 0.16); box(mt.parede, x0 + 0.6, x0 + 4.8, z0 + 1, z1 - 1, 0, 3.5); ribbon(x0 + 0.6, x0 + 4.8, z0 + 1, z1 - 1, 0.3, 3.0, 'e', 1.4, 2);   // vão livre de ~12 m (DSC_2064)
        box(mt.ceramica, x1 - 3.6, x1 - 0.6, z0 + 1, z1 - 1, 0, 3.8);                         // bloco de serviço em cerâmica creme (foto DSC_2064)
        for (const zd of [z0 + 3.0, z0 + 6.2, z0 + 9.6]) { box(mt.branco, x1 - 3.68, x1 - 3.6, zd - 0.45, zd + 0.45, 0.16, 2.25); box(mt.vermelho, x1 - 3.66, x1 - 3.6, zd - 0.12, zd + 0.12, 2.5, 2.7); }
        box(mt.telha, x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, h - 0.2, h + 0.05); fascia(x0 - 0.3, x1 + 0.3, z0 - 0.3, z1 + 0.3, h + 0.08, 0.45);
        for (const f of [0.35, 0.62]) { const zz = z0 + (z1 - z0) * f; box(mt.vidro, x0 + 1, x1 - 1, zz - 0.6, zz + 0.6, h + 0.05, h + 0.08); }
        columns(x0 + 0.8, x1 - 0.8, z0 + 0.8, z1 - 0.8, h - 0.2, 6, 0.5); trusses(x0, x1, z0, z1, h - 0.2, 'z', 5, 0.9); trusses(x0, x1, z0, z1, h - 0.2, 'x', 6.5, 0.5);
        addHot(e, r, h);
      } else if (t === 'portaria') {
        const [cx0, cx1, cz0, cz1] = e.canopy, [bx0, bx1, bz0, bz1] = e.box, h = e.h;
        box(mt.vermelho, bx0, bx1, bz0, bz1, 0, 3.0); ribbon(bx0, bx1, bz0, bz1, 1.1, 2.4, 's', 1.0); ribbon(bx0, bx1, bz0, bz1, 1.1, 2.4, 'e', 1.0);
        box(bege, cx0, cx1, cz0, cz1, h - 0.5, h); box(mt.forroBeiral, cx0 + 0.15, cx1 - 0.15, cz0 + 0.15, cz1 - 0.15, h - 0.52, h - 0.5);   // laje grossa de concreto claro (DSC_2025)
        const px = (cx0 + cx1) / 2 + 2.5, pz = (cz0 + cz1) / 2; box(mt.pilar, px - 0.25, px + 0.25, pz - 0.25, pz + 0.25, 0, h - 0.45);
        for (let k = 0; k < 3; k++) { const xx = bx1 + 1.6 + k * 1.2; box(mt.galv, xx - 0.15, xx + 0.15, bz1 - 0.5, bz1 - 0.2, 0, 1.0); }
        const s = sign('765', '#b3121b', 1.4, 0.36, false); s.position.set(bx0 + 2.2, h - 0.22, cz1 + 0.02); addS(s);
        addHot(e, [cx0, cx1, cz0, cz1], h);
      } else if (t === 'tower') {                           // torre da caixa d'água: dois fustes de concreto de forma deslizante
        e.shafts.forEach(([x0, x1, z0, z1, h]) => { box(mt.forma, x0, x1, z0, z1, 0, h); box(mt.concreto, x0 + 0.2, x1 - 0.2, z0 + 0.2, z1 - 0.2, h, h + 0.12); });
        const [lx0, lx1, lz0, lz1, lh] = e.link; box(mt.forma, lx0, lx1, lz0, lz1, 0, lh);
        const [x0, x1, z0, z1, h] = e.shafts[0];
        const s1 = sign('SENAI', '#c8141e', 3.6, 0.95); s1.position.set((x0 + x1) / 2, h - 2.4, z1 + 0.03); addS(s1);
        const s2 = sign('SENAI', '#c8141e', 2.9, 0.78); s2.position.set(x0 - 0.03, h - 2.4, (z0 + z1) / 2); s2.rotation.y = -Math.PI / 2; addS(s2);
        box(mt.galv, (x0 + x1) / 2 - 0.03, (x0 + x1) / 2 + 0.03, (z0 + z1) / 2 - 0.03, (z0 + z1) / 2 + 0.03, h, h + 2.2);
        const xs = e.shafts.flatMap(s => [s[0], s[1]]), zs = e.shafts.flatMap(s => [s[2], s[3]]);
        addHot({ id: e.id, desc: e.desc }, [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)], h);
      } else if (t === 'totem') {
        const { x, z, d: dd, h } = e, rot = e.rot === 90;          // rot: face larga voltada para leste (foto DSC_2025)
        const hw = (rot ? dd : e.w) / 2, hd = (rot ? e.w : dd) / 2;
        box(mt.vermelho, x - hw, x + hw, z - hd, z + hd, 0.15, h); box(mt.preto, x - hw - 0.1, x + hw + 0.1, z - hd - 0.1, z + hd + 0.1, 0, 0.15);
        for (const sg of [1, -1]) {
          const s = sign('SENAI', '#ffffff', 3.6, 0.82, false); s.material.alphaTest = 0.3;
          if (rot) { s.rotation.set(0, sg * Math.PI / 2, Math.PI / 2); s.position.set(x + sg * (dd / 2 + 0.012), h * 0.55, z); }
          else { s.rotation.set(0, sg > 0 ? 0 : Math.PI, Math.PI / 2); s.position.set(x, h * 0.55, z + sg * (dd / 2 + 0.012)); }
          addS(s);
        }
      } else if (t === 'flags') {
        for (let k = 0; k < e.n; k++) { const xx = e.x0 + k * (e.x1 - e.x0) / (e.n - 1); put(mt.galv, new THREE.CylinderGeometry(0.045, 0.06, e.h, 8), xx, e.h / 2 + 0.48, e.z); }
      } else if (t === 'steps') {
        const [x0, x1, z0, z1] = r; for (let k = 0; k < e.n; k++) box(mt.piso_concreto, x0, x1, z0, z1 - k * 0.45, 0, e.rise * (k + 1) + 0.12);
      } else if (t === 'ramp') {
        const [x0, x1, z0, z1] = r, h = e.h + 0.12, L = z1 - z0, a = Math.atan2(h, L), Ls = Math.hypot(L, h);
        put(mt.piso_concreto, B(x1 - x0, 0.3, Ls), (x0 + x1) / 2, h / 2 - 0.1, (z0 + z1) / 2, a, 0, 0);
        for (const xx of [x0 + 0.1, x1 - 0.1, (x0 + x1) / 2]) {
          for (const yy of [0.7, 0.92]) put(mt.galv, B(0.05, 0.05, Ls), xx, h / 2 + yy, (z0 + z1) / 2, a, 0, 0);
          for (let zz = z0; zz <= z1; zz += 1.5) { const yb = h + (0.12 - h) * (zz - z0) / L; box(mt.galv, xx - 0.025, xx + 0.025, zz - 0.025, zz + 0.025, yb, yb + 0.92); }
        }
      } else if (t === 'solar') {
        const h = e.h, tl = Math.tan(20 * Math.PI / 180) * 0.5;
        e.rows.forEach(([x0, x1, z0, z1]) => {
          const dz = z1 - z0; poly(mt.painel, [[x0, h, z0], [x1, h, z0], [x1, h - dz * tl, z1], [x0, h - dz * tl, z1]], [[0, 3, 2, 1]]);
          for (let xx = x0; xx <= x1; xx += 4) { box(mt.galv, xx - 0.05, xx + 0.05, z0 + 0.45, z0 + 0.55, 0, h - 0.1); box(mt.galv, xx - 0.05, xx + 0.05, z1 - 0.55, z1 - 0.45, 0, h - dz * tl - 0.1); }
          for (let xx = x0; xx < x1; xx += 1.05) poly(mt.galv, [[xx, h + 0.02, z0], [xx + 0.03, h + 0.02, z0], [xx + 0.03, h - dz * tl + 0.02, z1], [xx, h - dz * tl + 0.02, z1]], [[0, 3, 2, 1]]);
        });
      } else if (t === 'surf') {
        const [x0, x1, z0, z1] = r; K.flat(mt[e.m] || mt.piso_concreto, x1 - x0, z1 - z0, (x0 + x1) / 2, 0.14 + e.y, (z0 + z1) / 2);
      } else if (t === 'fence' || t === 'gate') {
        const pts = e.pts || [[e.x0, e.z], [e.x1, e.z]], h = e.h;
        for (let i = 0; i < pts.length - 1; i++) {
          const [xa, za] = pts[i], [xb, zb] = pts[i + 1], L = Math.hypot(xb - xa, zb - za), n = Math.max(1, Math.round(L / 2.5)), ry = -Math.atan2(zb - za, xb - xa);
          for (let k = 0; k < n; k++) {
            const xs = xa + (xb - xa) * k / n, zs = za + (zb - za) * k / n, xm = xa + (xb - xa) * (k + 0.5) / n, zm = za + (zb - za) * (k + 0.5) / n;
            put(mt.gradil, PL(L / n, h - 0.1), xm, 0.1 + (h - 0.1) / 2, zm, 0, ry, 0);
            box(mt.galv, xs - 0.03, xs + 0.03, zs - 0.03, zs + 0.03, 0, h + 0.05);
          }
        }
      } else if (t === 'lamps') {
        for (const [x, z] of e.pts) {
          const h = e.h; box(mt.preto, x - 0.07, x + 0.07, z - 0.07, z + 0.07, 0, h);
          if (h < 4) box(mt.esquadria, x - 0.2, x + 0.2, z - 0.2, z + 0.2, 0, 0.3); else box(mt.concreto, x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 0.3);
          for (const sg of [-1, 1]) { box(mt.preto, Math.min(x + sg * 0.1, x + sg * 0.75), Math.max(x + sg * 0.1, x + sg * 0.75), z - 0.05, z + 0.05, h - 0.35, h - 0.27); box(mt.preto, Math.min(x + sg * 0.55, x + sg * 1.1), Math.max(x + sg * 0.55, x + sg * 1.1), z - 0.22, z + 0.22, h - 0.32, h - 0.2); }
        }
      } else if (t === 'bancos') {                          // bancos de concreto (tampo sobre dois apoios)
        for (const [x, z, rz] of e.pts) {
          const [a, b] = rz ? [0.25, 1.0] : [1.0, 0.25]; box(mt.concreto, x - a, x + a, z - b, z + b, 0.38, 0.47);
          for (const sg of [-1, 1]) { const ax = rz ? x : x + sg * (a - 0.3), bz = rz ? z + sg * (b - 0.3) : z; box(mt.concreto, ax - 0.12, ax + 0.12, bz - 0.18, bz + 0.18, 0, 0.38); }
        }
      } else if (t === 'sebe') {                            // cerca viva podada
        for (const [x0, x1, z0, z1] of e.r) box(mt.sebe, x0, x1, z0, z1, 0.1, e.h || 0.9);
      } else if (t === 'lawnpatch') {                       // canteiro gramado no miolo da praça (DSC_2098)
        const [x0, x1, z0, z1] = e.r, y = 0.14 + e.y; K.flat(mt.grama, x1 - x0, z1 - z0, (x0 + x1) / 2, y, (z0 + z1) / 2);
        for (const [a0, a1, b0, b1] of [[x0 - 0.1, x1 + 0.1, z0 - 0.1, z0], [x0 - 0.1, x1 + 0.1, z1, z1 + 0.1], [x0 - 0.1, x0, z0, z1], [x1, x1 + 0.1, z0, z1]]) box(mt.concreto, a0, a1, b0, b1, 0.12, y + 0.02);
      } else if (t === 'muro') {                            // muro de blocos de concreto nas divisas oeste (DJI_0002, DSC_2025)
        for (let i = 0; i < e.pts.length - 1; i++) {
          const [xa, za] = e.pts[i], [xb, zb] = e.pts[i + 1];
          box(mt.concreto, Math.min(xa, xb) - 0.08, Math.max(xa, xb) + 0.08, Math.min(za, zb) - 0.08, Math.max(za, zb) + 0.08, 0, e.h);
        }
      } else if (t === 'postes_energia') {                  // postes de concreto da entrada de energia
        for (const [x, z] of e.pts) { box(mt.concreto, x - 0.12, x + 0.12, z - 0.12, z + 0.12, 0, 9.5); box(mt.concreto, x - 1, x + 1, z - 0.06, z + 0.06, 8.9, 9.05); }
      } else if (t === 'palms') e.pts.forEach(([x, z]) => palms.push([x, z, 7 + rand() * 4]));
    }
    // palmeiras: folhas arqueadas com folíolos (mesma receita da copa do Blender), instanciadas
    const crown = (() => {
      const V = [], seed = (() => { let s = 3; return () => (s = (s * 16807) % 2147483647) / 2147483647; })(), F = new THREE.Vector3(), Sd = new THREE.Vector3();
      const quad = (a, b, c, d2) => V.push(...a, ...b, ...c, ...a, ...c, ...d2);
      for (let f = 0; f < 16; f++) {
        const az = f * Math.PI * 2 / 16 + (seed() - 0.5) * 0.3, el = (f % 2 ? -10 + seed() * 65 : 25 + seed() * 45) * Math.PI / 180, L = 2.6 + seed(), n = 20, P = [[0, 0, 0]];
        for (let i = 1; i <= n; i++) { const s = i / n, an = el - s * s * 95 * Math.PI / 180, p = P[i - 1]; P.push([p[0] + Math.cos(az) * Math.cos(an) * L / n, p[1] + Math.sin(an) * L / n, p[2] + Math.sin(az) * Math.cos(an) * L / n]); }
        Sd.set(-Math.sin(az), 0, Math.cos(az));
        for (let i = 2; i < n; i++) {
          const s = i / n, ln = 0.75 * Math.sin(Math.PI * Math.min(1, s * 1.1)) + 0.12, b = P[i]; F.set(P[i + 1][0] - b[0], P[i + 1][1] - b[1], P[i + 1][2] - b[2]).normalize();
          for (const sg of [-1, 1]) {
            const dv = new THREE.Vector3().addScaledVector(Sd, sg * 0.8).addScaledVector(F, 0.55).add(new THREE.Vector3(0, -0.55, 0)).normalize(), w = F.clone().multiplyScalar(0.045);
            const tip = [b[0] + dv.x * ln, b[1] + dv.y * ln, b[2] + dv.z * ln];
            quad([b[0] - w.x, b[1] - w.y, b[2] - w.z], [b[0] + w.x, b[1] + w.y, b[2] + w.z], [tip[0] + w.x * 0.2, tip[1] + w.y * 0.2, tip[2] + w.z * 0.2], [tip[0] - w.x * 0.2, tip[1] - w.y * 0.2, tip[2] - w.z * 0.2]);
          }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3)); g.computeVertexNormals(); return g;
    })();
    const pLeaf = new THREE.InstancedMesh(crown, M(0x2f5418, 0.6, 0, { side: DS }), palms.length);
    const pTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.17, 0.22, 1, 8), M(0x9a958a, 0.85), palms.length);
    const pShaft = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.24, 0.24, 1.4, 8), M(0x4d6a2a, 0.55), palms.length), one = new THREE.Vector3(1, 1, 1), eu = new THREE.Euler();
    palms.forEach(([x, z, h], i) => {
      m4.compose(new THREE.Vector3(x, h / 2, z), qq.identity(), new THREE.Vector3(1, h, 1)); pTrunk.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, h + 0.2, z), qq.identity(), one); pShaft.setMatrixAt(i, m4);
      const s = 0.85 + rand() * 0.3; m4.compose(new THREE.Vector3(x, h + 0.85, z), qq.setFromEuler(eu.set(0, rand() * 6.3, 0)), new THREE.Vector3(s, s, s)); pLeaf.setMatrixAt(i, m4);
    });
    addS(pLeaf, pTrunk, pShaft);
    // carros nos estacionamentos e no meio-fio (posições do Street View e do satélite)
    for (let j = 0; j < 7; j++) cars.push([30 + j * 2.6, -26.5, Math.PI / 2]);
    for (const j of [0, 2, 3, 5]) cars.push([30 + j * 2.6, -14.5, Math.PI / 2]);
    for (const j of [0, 1, 3, 4, 6]) cars.push([1 + j * 2.6, -3.1, Math.PI / 2]);      // vagas junto ao meio-fio (atrás delas, gramado com árvores)
    for (const x of [-40, -34, -28, -21]) cars.push([x, 2.6, 0]);
    const carCols = [0xdedfe0, 0x8e939a, 0x18191b, 0x8a1418, 0xf0f0f0, 0x3a4554], col = new THREE.Color();
    // carros modelados no Blender (sedã, hatch e SUV: carroceria com caixas de roda, vidros, rodas, faróis), um InstancedMesh por material
    const carMats = { pintura: M(0xffffff, 0.3, 0.55), vidro: M(0x0b0f12, 0.05, 0.6, { envMapIntensity: 1.4 }), escuro: M(0x111112, 0.7, 0.1),
      claro: M(0xcfd2d6, 0.25, 0.9), lanterna: M(0x7a0a0c, 0.2, 0.1) };
    const kinds = carData ? Object.keys(carData) : [];
    const carGroup = new THREE.Group();
    if (kinds.length) kinds.forEach((k, ki) => {
      const mine = cars.filter((_, i) => i % kinds.length === ki); if (!mine.length) return;
      const pos = new THREE.Float32BufferAttribute(carData[k].p.map(v => v / 100), 3);
      for (const [g, idx] of Object.entries(carData[k].g)) {
        const geo = new THREE.BufferGeometry(); geo.setAttribute('position', pos); geo.setIndex(idx); geo.computeVertexNormals();
        const im = new THREE.InstancedMesh(geo, carMats[g] || carMats.escuro, mine.length);
        mine.forEach(([x, z, ry], i) => { m4.compose(new THREE.Vector3(x, 0.12, z), qq.setFromEuler(eu.set(0, ry, 0)), one); im.setMatrixAt(i, m4);
          if (g === 'pintura') im.setColorAt(i, col.set(carCols[(i * kinds.length + ki) % 6])); });
        carGroup.add(im);
      }
    });
    const carB = carGroup, carC = new THREE.Group();
    const buses = [[30, 0xf0c419], [44, 0xf0c419], [-62, 0xffffff], [-84, 0xd9282f], [-110, 0xffffff], [-190, 0xffffff], [-210, 0xd9282f]];
    const busMesh = new THREE.InstancedMesh(B(12.5, 3.2, 2.6), M(0xffffff, 0.4, 0.3), buses.length);
    buses.forEach(([x, c], i) => { busMesh.setMatrixAt(i, m4.makeTranslation(x, 1.7, 6.5)); busMesh.setColorAt(i, col.set(c)); });
    addS(carB, carC); site.add(busMesh);
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

  /* =========================================================
     A câmera: um caminho só, do ponto inicial até o pátio do SENAI.
     Cada trecho é escrito no nível onde ele acontece; na troca de nível a pose é só convertida de
     um sistema de coordenadas para o outro (mesma imagem), por isso não existe corte em lugar nenhum.
     ========================================================= */
  const tgtW = N0.clone().multiplyScalar(RE);
  const BR = toVec(-12, -52), SP = toVec(-22.3, -48.6), IRA = toVec(-22.5869, -47.5161);
  const sunL1 = (t, v = new THREE.Vector3()) => v.copy(SUN0).applyAxisAngle(Y, MWW * t);
  const RE_S = 0.14 / RE;                                   // a Terra de 6.371 km é o planetinha de raio 0,14 do disco
  const _sd = new THREE.Vector3();
  // a Terra em km é girada para que o "SUN" dela aponte para o Sol do disco: a luz bate igual nas duas cenas
  // (duas direções casadas, Sol e eixo da Terra: a rotação nunca "vira" de repente)
  const _m1 = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
  const basisOf = (a, m) => { const b = Y.clone().addScaledVector(a, -a.dot(Y)).normalize(); return m.makeBasis(a, b, new THREE.Vector3().crossVectors(a, b)); };
  const rotE = t => new THREE.Quaternion().setFromRotationMatrix(basisOf(planetPos(2, t, _sd).negate().normalize(), _m1).multiply(basisOf(SUN.clone(), _m2).transpose()));
  function lvMat(k, t) {                                    // do nível k para o nível de cima (k - 1)
    const m = new THREE.Matrix4();
    if (k === 1) return m.compose(tgt, IDQ, new THREE.Vector3(S_G, S_G, S_G));
    if (k === 2) return m.compose(sunL1(t), IDQ, new THREE.Vector3(S_S, S_S, S_S));
    return m.compose(planetPos(2, t), rotE(t), new THREE.Vector3(RE_S, RE_S, RE_S));
  }
  function lvMap(a, b, t) {                                 // coordenadas do nível a → nível b
    if (a < b) return lvMap(b, a, t).invert();
    const m = new THREE.Matrix4(); for (let k = a; k > b; k--) m.premultiply(lvMat(k, t)); return m;
  }
  const P = (tg, of, up = Y) => ({ tg, of, up });           // pose: alvo, câmera em relação ao alvo, "para cima"
  function convert(p, a, b, t) {
    if (a === b) return p;
    const m = lvMap(a, b, t), tg = p.tg.clone().applyMatrix4(m), cp = p.tg.clone().add(p.of).applyMatrix4(m);
    return P(tg, cp.sub(tg), p.up.clone().transformDirection(m));
  }
  function blendPose(a, b, w) {                             // distância interpolada em escala log (como uma potência de dez)
    if (w <= 0) return a; if (w >= 1) return b;
    const la = a.of.length(), lb = b.of.length(), d = a.of.clone().divideScalar(la).lerp(b.of.clone().divideScalar(lb), w);
    if (d.lengthSq() < 1e-6) d.copy(b.of).divideScalar(lb);
    return P(a.tg.clone().lerp(b.tg, w), d.normalize().multiplyScalar(Math.exp(lerp(Math.log(la), Math.log(lb), w))), a.up.clone().lerp(b.up, w).normalize());
  }
  const keyLog = (K, t) => { if (t <= K[0][0]) return K[0][1]; for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const [t0, a] = K[i - 1], [t1, b] = K[i]; return Math.exp(lerp(Math.log(a), Math.log(b), sstep(t0, t1, t))); } return K[K.length - 1][1]; };

  // a câmera gira devagar sempre para o mesmo lado, do Big Bang até a Terra: um movimento só
  const AZ = t => 0.6 + t * 0.045, HV = (az, el) => new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
  // 1) universo: olha o ponto, treme no clarão, é engolida pela bola de fogo, flutua no plasma, abre para ver a teia e mergulha num nó
  function poseUniverse(t) {
    const D = keyLog([[0, 7], [1, 6.2], [1.5, 7.8], [3.2, 5.8], [21, 4.4], [28.5, 24], [33.5, 0.45]], t);
    const tg = new THREE.Vector3().lerp(tgt, ease(sstep(28.2, 33.5, t)));
    const of = HV(AZ(t), lerp(0.05, 0.42, sstep(20, 28.5, t))).multiplyScalar(D);
    const sh = t > 1 && t < 3.5 ? Math.exp(-(t - 1) * 2.5) * 0.09 : 0;            // tremor de câmera no clarão
    if (sh) of.add(new THREE.Vector3(Math.sin(t * 61), Math.sin(t * 47 + 1), Math.sin(t * 53 + 2) * 0.5).multiplyScalar(sh));
    return P(tg, of);
  }
  // 2) Via Láctea: vista de cima e mergulho até o braço onde está o Sol
  function poseGalaxy(t) {
    const sun = sunL1(t), k = ease(sstep(33.5, 37.4, t));
    const D = Math.exp(lerp(Math.log(17), Math.log(0.4), ease(sstep(33, 37.4, t))));
    const far = HV(AZ(t), 1.03), near = HV(AZ(t), 0.62);       // de cima (a espiral inteira) até a altura do braço
    return P(new THREE.Vector3().lerp(sun, k), far.lerp(near, k).normalize().multiplyScalar(D));
  }
  // 3) Sistema Solar: a câmera inclina sobre o disco e depois vai até a Terra, pelo lado do dia
  function poseSolar(t) {
    const q = clamp((t - 37) / 7.5, 0, 1), over = HV(AZ(t), lerp(0.62, 0.5, ease(sstep(0, 0.7, q)))).multiplyScalar(lerp(15, 12, q));
    const E = planetPos(2, t), eh = E.clone().normalize();
    // chega pelo mesmo lado de onde vinha, um pouco virada para o Sol: a Terra aparece mais da metade iluminada
    const near = HV(AZ(t), 0).multiplyScalar(0.8).addScaledVector(Y, 0.35).addScaledVector(eh, -0.3).normalize().multiplyScalar(0.14 * 7);
    return blendPose(P(new THREE.Vector3(), over), P(E, near), ease(sstep(43, 47.2, t)));
  }
  // 4) Terra (km): parte exatamente de onde a câmera do disco estava e gira até ficar em cima de Iracemápolis
  let earthStart = null;
  function poseEarth(t) {
    if (!earthStart) earthStart = convert(poseAt(2, STAGES[3].t0), 2, 3, STAGES[3].t0);
    const k = ease(sstep(STAGES[3].t0, 53, t)), s0 = earthStart.of.clone().normalize();
    const dir = s0.clone().applyQuaternion(new THREE.Quaternion().slerp(new THREE.Quaternion().setFromUnitVectors(s0, N0), k));
    const D = Math.exp(lerp(Math.log(earthStart.of.length()), Math.log(RE * 2.6), k));
    return P(earthStart.tg.clone().multiplyScalar(1 - k), dir.multiplyScalar(D), earthStart.up.clone().lerp(NORTH, k).normalize());
  }
  // 5) descida: 10 mil km → 750 m olhando para baixo, depois inclina como um drone e dá a volta na escola
  const siteC = () => { const of = siteData && siteData.predios.find(b => b.id === 'senai-oficinas'); return new THREE.Vector3(of ? of.x : 0, 0, of ? of.z + 40 : 0).multiplyScalar(0.001); };
  function poseGround(t) {
    const u = t - 53, D = keyLog([[0, RE * 1.6], [11.5, 0.75], [20.5, 0.17]], u);
    const el = lerp(Math.PI / 2, 0.3, ease(sstep(8.5, 20.5, u))), az = lerp(-0.7, 1.32, ease(sstep(9.5, 22, u))) + (u > 22 ? Math.sin((u - 22) * 0.25) * 0.08 : 0);
    const tl = siteC().multiplyScalar(sstep(6, 14, u));
    const ol = new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).multiplyScalar(D);
    const cp = local.localToWorld(tl.clone().add(ol)), tg = local.localToWorld(tl.clone().setY(lerp(0, 0.026, sstep(17, 22, u))));   // no fim a câmera levanta o olhar: céu e "Obrigado!"
    return P(tg, cp.sub(tg), NORTH.clone().lerp(N0, sstep(0.02, 0.5, Math.PI / 2 - el)).normalize());
  }
  const STAGES = [
    { lv: 0, t0: 0, blend: 0, own: poseUniverse },
    { lv: 1, t0: 30.5, blend: 3.5, own: poseGalaxy },
    { lv: 2, t0: 36.6, blend: 3, own: poseSolar },
    { lv: 3, t0: 46.4, blend: 2.2, own: poseEarth },
    { lv: 3, t0: 53, blend: 0.6, own: poseGround }
  ];
  const stageAt = t => { let i = 0; while (i < STAGES.length - 1 && t >= STAGES[i + 1].t0) i++; return i; };
  function poseAt(si, t) {
    const S = STAGES[si], o = S.own(t);
    if (si === 0 || S.blend <= 0) return o;
    const w = ease(clamp((t - S.t0) / S.blend, 0, 1));
    // a pose anterior continua andando durante a mistura: a velocidade da câmera também não tem tranco
    return w >= 1 ? o : blendPose(convert(poseAt(si - 1, t), STAGES[si - 1].lv, S.lv, t), o, w);
  }
  const aim = (cam, p) => { cam.position.copy(p.tg).add(p.of); cam.up.copy(p.up); cam.lookAt(p.tg); cam.updateMatrixWorld(); };

  /* ---------- O que acontece em cada instante (tudo é função do tempo: dá para voltar e avançar) ---------- */
  const _o = new THREE.Vector3();
  function updateDeep(t, ref, dD) {
    const lvS = [];
    for (let k = 0; k < 3; k++) { const m = lvMap(k, ref, t); LV[k].matrix.copy(m); LV[k].matrixWorldNeedsUpdate = true; lvS.push(m.getMaxScaleOnAxis()); }
    const NEAR = [0, 0.45, 0.12];                         // perto da câmera a estrela some, em vez de virar uma bola gigante
    lvPts.forEach((ms, k) => ms.forEach(m => { m.uniforms.uScale.value = m.userData.base * lvS[k]; if (k) m.uniforms.uNear.value = NEAR[k] * lvS[k]; }));
    // universo
    const U = prim.u; U.uT.value = t;
    U.uR.value = t < 1 ? 0.02 : 0.02 + 13 * (1 - Math.exp(-(t - 1) * 2.4)) + 0.25 * (t - 1);        // inflação: quase tudo no primeiro instante
    U.uIn.value = sstep(1.25, 2.5, t);
    U.uHot.value = 1 - 0.34 * sstep(2.6, 4.5, t) - 0.33 * sstep(8, 10.5, t) - 0.33 * sstep(11.5, 14, t);
    U.uFog.value = 1 - sstep(13.8, 16.8, t); U.uCmb.value = sstep(14.2, 16.5, t) * (1 - sstep(18.2, 20.6, t));
    U.uPre.value = t < 1 ? sstep(0, 0.6, t) * (0.45 + 0.55 * Math.sin(t * 9) ** 2) : 0;
    U.uFl.value = t >= 1 ? Math.exp(-(t - 1) * 4) * sstep(1, 1.03, t) : 0;
    _o.set(0, 0, 0).applyMatrix4(LV[0].matrix).project(dcam);
    if (_o.z < 1) U.uC.value.set(_o.x * 0.5 * dcam.aspect, _o.y * 0.5); else U.uC.value.set(9, 9);
    prim.mesh.visible = ref === 0 && t < 21.6;
    const fade0 = lerp(1, 0.25, sstep(33, 37, t)) * (1 - sstep(40, 44, t));
    const g = gas.u; g.uT.value = t; g.uA.value = t < 1 ? 0 : 1 - Math.exp(-(t - 1) * 2.2);
    g.uQ.value = sstep(3.2, 5, t); g.uBind.value = sstep(7, 9.2, t); g.uNuc.value = sstep(8.5, 10.5, t); g.uGas.value = sstep(14, 17, t);
    g.uCol.value = sstep(19.5, 27.5, t); g.uWeb.value = sstep(21, 27, t);
    g.uBr.value = sstep(1.0, 1.3, t) * lerp(0.6, 0.55, sstep(3, 6, t)) * lerp(1, 0.25, sstep(14, 17, t)) * lerp(1, 8, sstep(20, 27, t)) * fade0;
    g.uNear.value = clamp(dD / lvS[0] * 0.5, 0.01, 0.35) * lvS[0];
    gas.p.visible = g.uBr.value > 0.001;
    const fst = (1 - 0.7 * sstep(27, 31, t)) * fade0;
    FST.forEach(o => {
      const e = t - o.at, on = e > 0 ? 1 : 0, pop = e > 0 ? Math.exp(-e * 6) * 3 : 0;
      o.f.material.opacity = on * (0.35 + pop * 0.3) * fst; o.f.scale.set((0.6 + pop * 1.2) * 4, 0.6 + pop * 1.2, 1);
      o.c.material.opacity = on * 0.8 * fst; o.c.scale.setScalar(0.35 + pop * 0.6);
    });
    const mwA = sstep(27, 31, t) * (1 - 0.5 * sstep(34, 36.5, t)) * (1 - 0.7 * sstep(36.5, 39.5, t));
    nodeGlow.forEach((n, i) => { n.material.opacity = 0.45 * sstep(23, 28, t) * fade0 * (nodes[i] === tgt ? 1 - sstep(27, 31, t) * 0.85 : 1); });
    // Via Láctea: nasce no nó da teia
    LV[1].visible = mwA > 0.001; mwSpin.rotation.y = MWW * t;
    mwPts.material.uniforms.uAlpha.value = mwA; mwDust.material.uniforms.uA.value = mwA; mwCore.material.opacity = 0.65 * mwA;
    mwSun.material.opacity = mwA * (1 - sstep(36.5, 38.5, t)); mwSun.scale.setScalar(0.4 + 0.3 * Math.sin(t * 4) ** 2);
    skyStars.position.copy(dcam.position); skyStars.material.uniforms.uAlpha.value = sstep(32, 37, t);
    label('mw', sunL1(t, _o).applyMatrix4(LV[1].matrix), dcam, t > 32.5 && t < 37.6 ? 'Você está aqui: o Sol' : '');
    // Sistema Solar
    const solOn = t > 34; LV[2].visible = solOn;
    if (solOn) {
      const q = clamp((t - 37) / 7.5, 0, 1), fall = sstep(0.0, 0.35, q), clear = sstep(0.62, 1, q), pa = solPts.geometry.attributes, tc = oc(t);
      for (let i = 0; i < NS; i++) {
        const r1 = lerp(SR0[i], SR[i], fall), w = 0.5 / Math.pow(r1, 1.5), a = SA[i] + tc * w * 2 + (1 - fall) * 2.5 / r1;
        let r = r1; for (let k = 0; k < 8; k++) { const d = r - gaps[k]; r += clear * 0.1 * Math.sign(d) * Math.exp(-d * d / 0.05); }
        pa.position.setXYZ(i, Math.cos(a) * r, SY[i] * (1 - 0.5 * clear) * (1 + (1 - fall) * 20), Math.sin(a) * r);
      }
      pa.position.needsUpdate = true; solPts.material.uniforms.uAlpha.value = (1 - 0.8 * clear) * (0.5 + 0.5 * (1 - sstep(0.35, 0.6, q))) * sstep(34, 36, t) * (1 - 0.6 * sstep(44, 47, t));
      const on = sstep(0.22, 0.42, q); sunM.scale.setScalar(0.2 + on); sunG.material.opacity = on; sunF.material.opacity = on * 0.8; solL.intensity = 60 * on;
      disk.material.uniforms.uT.value = tc; disk.material.uniforms.uA.value = sstep(0.3, 0.5, q) * (1 - 0.7 * clear) * (1 - 0.6 * sstep(44, 47, t));
      const jt = sstep(0.25, 0.4, q) * (1 - sstep(0.6, 0.8, q));
      jets.forEach(j => { j.material.opacity = jt * 0.8; j.scale.set(0.35, 5 * jt + 0.01, 1); });
      planets.forEach((o, i) => { const gg = sstep(0.6 + i * 0.03, 0.72 + i * 0.03, q); o.m.scale.setScalar(Math.max(gg, 0.001)); planetPos(i, t, o.m.position); });
      planets[2].m.visible = t < 44.2;                      // a partir daqui a Terra de verdade (cena em km) toma o lugar dela
      label('sol', planetPos(2, t, _o).applyMatrix4(LV[2].matrix), dcam, t > 42.8 && t < 46.6 ? 'Terra' : '');
    } else label('sol', _o, dcam, '');
  }
  function updateEarth(t, h) {
    earthU.uLava.value = 1 - sstep(48, 51.5, t); earthU.uT.value = t; earthU.uCloud.value = sstep(50, 52.5, t) * sstep(3000, 12000, h);
    atmo.material.uniforms.uA.value = sstep(49, 52, t);
    if (t < 52) tileFade(1e9); else tileFade(h);
    if (h < 6) { makeEnv(); groundLook(true, sstep(6, 0.6, h)); sky.position.copy(ecam.position); } else groundLook(false);
    site.visible = h < 3 && !!site.userData.ready;
    if (site.visible) {
      const c = siteC(); sunS.target.position.copy(c); sunS.position.copy(c).addScaledVector(SUNL, 0.8); sunS.target.updateMatrixWorld(); sunS.updateMatrixWorld();
    }
    // "Obrigado!" sobe ao fundo, sempre atrás da escola em relação à câmera
    const k = sstep(68, 72, t), c = siteC(), cl = local.worldToLocal(ecam.position.clone()), dir = c.clone().sub(cl).setY(0).normalize();
    thanks.visible = k > 0 && site.visible; thanks.material.opacity = k;
    thanks.position.copy(c).addScaledVector(dir, 0.3).setY(lerp(-0.045, 0.062, ease(k))); thanks.up.copy(N0);
    thanks.lookAt(local.localToWorld(new THREE.Vector3(cl.x, thanks.position.y, cl.z)));
    root.classList.toggle('ended', t > 75.5);
    label('z-br', BR, ecam, t > 52 && h > 2500 && h < 15000 ? 'Brasil' : '');
    label('z-sp', SP, ecam, h > 250 && h < 2500 ? 'Estado de São Paulo' : '');
    label('z-ira', IRA, ecam, h > 3 && h < 250 ? 'Iracemápolis' : '');
    label('z-se', tgtW, ecam, h <= 3 && h > 0.9 ? 'SENAI' : '');
    hot.forEach((o, i) => label('s-' + i, local.localToWorld(new THREE.Vector3(o.b.x, o.b.h + 4, o.b.z).multiplyScalar(0.001)), ecam, t > 67 && site.visible && (i < 4 || hoverIdx === i) ? short(o.b.desc) : ''));
  }
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
  let orbit = null;
  function groundLook(on, k = 1) {
    sky.visible = on; es.environment = on ? envTex : null; es.environmentIntensity = 0.55;
    es.fog.near = on ? lerp(6, 0.9, k) : 1e8; es.fog.far = on ? lerp(60, 14, k) : 1e9;
    sunS.intensity = on ? 3.4 * k : 0; sunLight.intensity = on ? 3.2 * (1 - k) : 3.2;   // perto do chão, só o sol que faz sombra
  }
  // legenda curta, embaixo à direita
  function hudAt(t, h) {
    if (t < 1) return 'Tudo o que existe, menor que um átomo';
    if (t < 3.2) return 'Inflação: o espaço cresce 10²⁶ vezes em 10⁻³² s';
    if (t < 7.2) return 'Quarks livres a ~4 trilhões de °C';
    if (t < 9.5) return 'Esfriou: três quarks formam cada próton e nêutron';
    if (t < 13.6) { const b = sstep(9.5, 12.5, t); return `Hidrogênio ${Math.round(100 - 25 * b)}% · Hélio ${Math.round(25 * b)}% (em massa)`; }
    if (t < 15) return 'Plasma a 3.000 °C: a luz fica presa';
    if (t < 18.6) return 'A luz escapa: o céu do satélite Planck (azul mais frio, vermelho mais quente)';
    if (t < 21.6) return 'Nenhuma estrela ainda: a gravidade junta o gás em fios';
    if (t < 25) return 'Estrelas de até 300 vezes a massa do Sol acendem nos fios';
    if (t < 30.5) return 'Cada ponto claro é uma galáxia inteira';
    if (t < 37.5) return 'O Sol, a 26 mil anos-luz do centro';
    if (t < 40.5) return 'Uma nuvem de gás e poeira colapsa e o Sol acende';
    if (t < 43) return 'No disco, anéis e lacunas mostram planetas se formando';
    if (t < 47) return 'Os planetas varrem o disco';
    if (t < 51) return 'Terra primitiva: um oceano de magma esfriando';
    if (t < 53.5) return 'Hoje: 71% da superfície é água';
    return h > 2500 ? 'América do Sul' : h > 250 ? 'Interior de São Paulo, a 160 km da capital' : h > 3 ? 'Iracemápolis · cerca de 24 mil habitantes' : t > 64 ? 'Escola SENAI "João Guilherme Sabino Ometto"' : 'Distrito Industrial II';
  }
  // relógio cósmico: idade do universo, em escala log (de 10⁻³⁶ s até 13,8 bilhões de anos)
  const AGE = [[1, -36], [3, -32], [9.5, -6], [13.5, 2.26], [18, 13.08], [22, 15.8], [27, 16.5], [34, 17.2], [38.5, 17.464], [46, 17.47], [52.5, 17.639]];
  const SUPD = '⁰¹²³⁴⁵⁶⁷⁸⁹', sup = n => (n < 0 ? '⁻' : '') + String(Math.abs(n)).split('').map(c => SUPD[+c]).join('');
  function ageText(t) {
    if (t < 1) return 't = 0';
    let L = AGE[AGE.length - 1][1];
    for (let i = 1; i < AGE.length; i++) if (t <= AGE[i][0]) { const [t0, a] = AGE[i - 1], [t1, b] = AGE[i]; L = lerp(a, b, clamp((t - t0) / (t1 - t0), 0, 1)); break; }
    const s = 10 ** L, yr = s / 3.156e7, n = x => Math.round(x).toLocaleString('pt-BR');
    const v = s < 1e-3 ? `10${sup(Math.round(L))} s` : s < 1 ? `${n(s * 1000)} ms` : s < 120 ? `${n(s)} s` : s < 7200 ? `${n(s / 60)} min` : yr < 1 ? `${n(s / 86400)} dias` : yr < 1000 ? `${n(yr)} anos`
      : yr < 1e6 ? `${n(yr / 1000)} mil anos` : yr < 1e9 ? `${n(yr / 1e6)} milhões de anos` : `${(yr / 1e9).toFixed(1).replace('.', ',')} bilhões de anos`;
    return t > 52.4 ? `${v} · hoje` : v;
  }

  /* =========================================================
     Render: a cena do espaço e, por cima, a cena da Terra (o fundo da Terra é o espaço de verdade)
     ========================================================= */
  const comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
  const rpDeep = new RenderPass(deep, dcam), rpEs = new RenderPass(es, ecam); rpEs.clear = false; rpEs.clearDepth = true; rpEs.enabled = false;
  comp.addPass(rpDeep); comp.addPass(rpEs);
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
  // deixa os shaders da Terra e da escola prontos antes de precisar (assim a viagem não engasga no meio)
  function warm() {
    const vis = [sky, site, thanks, ...levels.map(L => L.grp)].map(o => [o, o.visible]); vis.forEach(([o]) => (o.visible = true));
    try { const p = renderer.compileAsync ? renderer.compileAsync(es, ecam) : renderer.compile(es, ecam); p?.catch?.(() => {}); } catch { /* sem pressa */ }
    vis.forEach(([o, v]) => (o.visible = v));
  }
  let t = 0, playing = true, on = false, raf = 0, last = 0, actIdx = -1, hoverIdx = -1, fps = 60, aiT = 0;
  const range = $('#cos-time'), playBtn = $('#cos-play'), chips = $('#cos-chips'), aiEl = $('#cos-ai');
  ACTS.forEach((a, i) => { const b = document.createElement('button'); b.textContent = a.title.split(' · ')[0]; b.dataset.i = i; chips.append(b); });
  chips.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; t = T_ACT[+b.dataset.i] + 0.01; if (orbit) orbit.enabled = false; setPlay(true); });
  range.max = Math.round(TOTAL * 10);
  range.addEventListener('input', () => { t = +range.value / 10; if (orbit) orbit.enabled = false; });
  playBtn.addEventListener('click', () => setPlay(!playing));
  function setPlay(p) { playing = p; playBtn.innerHTML = `<svg class="i sm"><use href="#i-${p ? 'pause' : 'play'}"/></svg>`; }
  const capK = $('#cos-kicker'), capT = $('#cos-title'), capS = $('#cos-sub');
  function setAct(i) {
    if (i === actIdx) return;
    actIdx = i; const a = ACTS[i];
    capK.textContent = a.kicker; capT.textContent = a.title; capS.textContent = a.sub;
    root.querySelector('.cos-cap').classList.remove('in'); void root.offsetWidth; root.querySelector('.cos-cap').classList.add('in');
    [...chips.children].forEach((b, k) => b.classList.toggle('on', k === i));
    root.dataset.act = a.id; clearLabels();
    if (orbit) orbit.enabled = false;
    root.classList.toggle('free', false);
  }
  function actAt(tt) { let i = 0; while (i < ACTS.length - 1 && tt >= T_ACT[i + 1]) i++; return i; }
  const PARTS = NG + mwPts.geometry.attributes.position.count + NS;
  function draw(dt) {
    setAct(actAt(t));
    const si = stageAt(t), S = STAGES[si], free = !!(orbit && orbit.enabled);
    const pose = free ? null : poseAt(si, t), ref = Math.min(S.lv, 2), esOn = t > 43.8;
    let h = 1e9;
    if (esOn) {
      if (!free) aim(ecam, convert(pose, S.lv, 3, t));
      h = ecam.position.length() - RE; setNearFar(Math.max(h, 0.05));
    }
    const dp = free ? convert(P(orbit.target.clone(), ecam.position.clone().sub(orbit.target), ecam.up.clone()), 3, 2, t) : convert(pose, S.lv, ref, t);
    aim(dcam, dp);
    const dD = dp.of.length(); dcam.near = clamp(dD * 0.02, 1e-4, 0.5); dcam.far = 6000; dcam.updateProjectionMatrix();
    const deepOn = !(esOn && h < 6);
    if (deepOn) updateDeep(t, free ? 2 : ref, dD);
    if (esOn) updateEarth(t, h); else { label('z-br', BR, ecam, ''); }
    if (esOn && !deepOn && shadowDirty && site.userData.ready) { renderer.shadowMap.needsUpdate = true; shadowDirty = false; }
    rpDeep.enabled = deepOn; rpEs.enabled = esOn; rpEs.clear = !deepOn; rpEs.clearDepth = deepOn;
    // a "lente" muda aos poucos: brilho forte no espaço, contido perto do chão
    const gk = sstep(47, 53, t), s2 = sstep(60, 66, t);
    bloom.strength = lerp(lerp(1.1, 0.85, sstep(3, 6, t)), 0.35, gk) * lerp(1, 0.46, s2);
    bloom.threshold = lerp(lerp(0.55, 0.85, gk), 0.95, s2);
    renderer.toneMappingExposure = lerp(1, lerp(1.1, 0.92, s2), sstep(52, 56, t));
    film.uniforms.uT.value = t; const gr = sstep(53, 58, t); film.uniforms.uGrain.value = lerp(0.06, 0.035, gr); film.uniforms.uCA.value = lerp(0.0009, 0.0005, gr);
    comp.render(dt);
    const a = ACTS[actIdx];
    hud(hudAt(t, h), (t - a.t0) / a.dur);
    $('#cos-alt').textContent = t < 53 ? ageText(t) : actIdx === ACTS.length - 1 && h < 1.2 ? 'Rua Camilo Ferrari, 765' : h >= 10 ? `${Math.round(h).toLocaleString('pt-BR')} km de altura` : `${(h * 1000).toFixed(0)} m de altura`;
    range.value = Math.round(t * 10);
    $('#cos-clock').textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} / ${Math.floor(TOTAL / 60)}:${String(Math.round(TOTAL % 60)).padStart(2, '0')}`;
    fps = fps * 0.95 + (dt > 0 ? 1 / dt : 60) * 0.05; aiT -= dt;
    if (aiEl && aiT <= 0) { aiT = 0.5; aiEl.textContent = `Feito com IA · ${Math.round(PARTS / 1000)} mil partículas calculadas ao vivo · ${Math.round(fps)} quadros/s · nenhum vídeo`; }
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
    orbit.target.copy(local.localToWorld(siteC()));
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
  es.updateMatrixWorld(true);
  let warmed = false;
  demos.cosmos = {
    enter() {
      on = true; cinema(true); last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); if (t >= TOTAL) t = 0; setPlay(true);
      loadEarth(); if (!warmed) { warmed = true; setTimeout(warm, 400); }
    },
    leave() { on = false; cancelAnimationFrame(raf); cinema(false); root.classList.remove('ended'); }
  };
  if ($('.slide[data-id="cosmos"]')?.classList.contains('active')) demos.cosmos.enter();
  if (TEST) window.IACosmos = {
    seek: x => { t = x; setPlay(false); if (orbit) orbit.enabled = false; }, acts: ACTS.map((a, i) => ({ id: a.id, t0: T_ACT[i], dur: a.dur })), total: TOTAL,
    // posição da câmera no nível 0 (universo) e na Terra: o teste confere que ela nunca "pula"
    cam: x => { const si = stageAt(x), S = STAGES[si], p = poseAt(si, x); const w = c => c.tg.clone().add(c.of).toArray(); return { lv: S.lv, deep: w(convert(p, S.lv, 2, x)), es: w(convert(p, S.lv, 3, x)), look: convert(p, S.lv, 3, x).of.clone().normalize().toArray(), look0: convert(p, S.lv, 0, x).of.clone().normalize().toArray(), d0: convert(p, S.lv, 0, x).of.length(), tg0: convert(p, S.lv, 0, x).tg.toArray() }; },
    state: () => ({ t, act: ACTS[actIdx]?.id, tiles: levels.reduce((s, L) => s + L.mats.filter(m => m.userData.ok).length, 0), site: !!site.userData.ready, glb: !!site.userData.glb, siteMeshes: (() => { let n = 0; site.traverse(o => { if (o.isMesh) n++; }); return n; })(), hi: earthU.uHiOn.value })
  };
}
