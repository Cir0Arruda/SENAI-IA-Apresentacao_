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
  { id: 'senai', dur: 16, kicker: 'Rua Camilo Ferrari, 765 · Distrito Industrial II', title: 'SENAI Iracemápolis', sub: 'Escola SENAI "João Guilherme Sabino Ometto", reconstruída em 3D peça por peça: medidas no satélite, fotos da obra (Bilenge Engenharia) e Street View.' }
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
  const getJ = u => fetch(u).then(r => r.json()).catch(() => null);
  Promise.all(['senai-iracemapolis', 'campus', 'cobertura', 'carros'].map(n => getJ(`assets/data/${n}.json`))).then(([d, cd, cov, cars]) => { if (!d) return; siteData = d; carData = cars; buildSite(d, cd, cov); }).catch(e => console.error(e));
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
  function buildSite(d, cd, cov) {
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
    if (cd) buildCampus(cd, { M, put, box, poly, flat, B, PL, m4, qq });
    // junta cada lote numa malha só
    lots.forEach((gs, mat) => { const g = mergeGeometries(gs, false); gs.forEach(x => x.dispose()); if (g) site.add(new THREE.Mesh(g, mat)); });
    // rótulos: primeiro os pontos que mais chamam atenção
    const pri = ['senai-oficinas', 'senai-bloco-l', 'senai-torre', 'senai-bloco-o1'], rk = o => (pri.indexOf(o.b.id) + 1) || 9;
    hot.sort((a, b) => rk(a) - rk(b));
    site.traverse(o => { if (o.isMesh) { o.castShadow = o !== ground && !o.userData.proxy && !o.userData.noShadow; o.receiveShadow = true; } });
    site.userData.ready = true; shadowDirty = true;
  }

  // Escola SENAI "João Guilherme Sabino Ometto" a partir de campus.json: cada peça medida no ortomosaico (0,11 m/px) e
  // conferida nas fotos aéreas e de solo da Bilenge Engenharia (projeto padrão SENAI-SP, NPC Arquitetura)
  function buildCampus(cd, K) {
    const { M, put, box, poly, B, PL, m4, qq } = K, DS = THREE.DoubleSide;
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
      azul: triMat('box_profile_metal_sheet', 1.2, 0x2f86b8, 0.45, 0.15, { gray: 1, gain: 1.8, mat: { side: DS } }),
      testeira: M(0x0d5584, 0.4, 0.35), rufo: M(0xaeb1b3, 0.4, 0.6), forro: M(0xcdc2aa, 0.8), trelica: M(0xc9b993, 0.5, 0.4),
      vidro: M(0x1a242c, 0.05, 0.85, { envMapIntensity: 1.3 }), esquadria: M(0xf2f2ee, 0.4, 0.1),
      pastilha: triMat('mosaico', 1.6, 0xffffff, 0.3), forroBeiral: M(0x6b5c4d, 0.8), ceramica: triMat('mosaico', 0.8, 0xd8c9a8, 0.35), vermelho: M(0xa3161d, 0.35), branco: M(0xf4f4f2, 0.5),
      galv: M(0xbfc3c3, 0.35, 0.85), preto: M(0x161616, 0.5, 0.3), painel: M(0x0e1630, 0.12, 0.5),
      gradil: M(0xc7cccc, 0.45, 0.7, { map: meshTex, alphaTest: 0.5, side: DS }), toldo: M(0x1f4fb4, 0.35, 0.2, { side: DS }),
      grama: triMat('leafy_grass', 2.5, 0x8db062, 1), terra_batida: triMat('red_laterite_soil_stones', 5, 0xe0aa90, 1),
      piso_concreto: triMat('concrete_pavement', 3, 0xe6e4de, 0.95, 0, { gray: 0.5 }), bloquete: triMat('hexagonal_concrete_paving', 1.4, 0xd8ccc4, 1),
      calcada: triMat('concrete_pavement', 2.5, 0xf0eee8, 0.95), piso_vermelho: triMat('concrete_pavement', 3, 0xc08a70, 0.9), granito: M(0x55575b, 0.45, 0.1),
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
        box(mt.parede, lx0, lx1, lz0, lz1, 0, bh); for (const sd of 'nsew') ribbon(lx0, lx1, lz0, lz1, 1.0, 3.0, sd, 1.25, 2);
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
        const ye = e.eave + 0.1, rise = 1.1, xc = (x0 + x1) / 2, hl = (x1 - x0) / 2, yy = x => ye + rise * ((x - xc) / hl) ** 2, N = 24, tk = 0.35;
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
        box(mt.granito, x0 + 0.5, x1 - 0.5, z0 + 0.5, z1 - 0.5, 0, 0.16); box(mt.parede, x0 + 0.6, x0 + 6.5, z0 + 1, z1 - 1, 0, 3.5); ribbon(x0 + 0.6, x0 + 6.5, z0 + 1, z1 - 1, 0.3, 3.0, 'e', 1.4, 2);
        box(mt.ceramica, x1 - 4.5, x1 - 0.6, z0 + 1, z1 - 1, 0, 3.8);                         // bloco de serviço em cerâmica creme (foto DSC_2064)
        for (const zd of [z0 + 3.0, z0 + 6.2, z0 + 9.6]) { box(mt.branco, x1 - 4.58, x1 - 4.5, zd - 0.45, zd + 0.45, 0.16, 2.25); box(mt.vermelho, x1 - 4.56, x1 - 4.5, zd - 0.12, zd + 0.12, 2.5, 2.7); }
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
        const s = sign('765', '#b3121b', 1.4, 0.36, false); s.position.set(bx0 + 2.2, h - 0.22, cz1 + 0.02); site.add(s);
        addHot(e, [cx0, cx1, cz0, cz1], h);
      } else if (t === 'tower') {                           // torre da caixa d'água: dois fustes de concreto de forma deslizante
        e.shafts.forEach(([x0, x1, z0, z1, h]) => { box(mt.forma, x0, x1, z0, z1, 0, h); box(mt.concreto, x0 + 0.2, x1 - 0.2, z0 + 0.2, z1 - 0.2, h, h + 0.12); });
        const [lx0, lx1, lz0, lz1, lh] = e.link; box(mt.forma, lx0, lx1, lz0, lz1, 0, lh);
        const [x0, x1, z0, z1, h] = e.shafts[0];
        const s1 = sign('SENAI', '#c8141e', 3.6, 0.95); s1.position.set((x0 + x1) / 2, h - 2.4, z1 + 0.03); site.add(s1);
        const s2 = sign('SENAI', '#c8141e', 2.9, 0.78); s2.position.set(x0 - 0.03, h - 2.4, (z0 + z1) / 2); s2.rotation.y = -Math.PI / 2; site.add(s2);
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
          site.add(s);
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
          const h = e.h; box(mt.preto, x - 0.07, x + 0.07, z - 0.07, z + 0.07, 0, h); box(mt.concreto, x - 0.3, x + 0.3, z - 0.3, z + 0.3, 0, 0.3);
          for (const sg of [-1, 1]) { box(mt.preto, Math.min(x + sg * 0.1, x + sg * 0.75), Math.max(x + sg * 0.1, x + sg * 0.75), z - 0.05, z + 0.05, h - 0.35, h - 0.27); box(mt.preto, Math.min(x + sg * 0.55, x + sg * 1.1), Math.max(x + sg * 0.55, x + sg * 1.1), z - 0.22, z + 0.22, h - 0.32, h - 0.2); }
        }
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
    site.add(pLeaf, pTrunk, pShaft);
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
    site.add(carB, carC, busMesh);
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
    es.fog.near = on ? lerp(6, 0.9, k) : 1e8; es.fog.far = on ? lerp(60, 14, k) : 1e9;
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
      // sobrevoo de nordeste para a frente da escola (sul-sudeste), terminando no ângulo das fotos de drone da Bilenge
      const a = lerp(-0.7, 1.32, ease(q)) + (q >= 1 ? Math.sin(t * 0.05) * 0.12 : 0), dist = lerp(0.42, 0.16, ease(q)), hgt = lerp(0.42, 0.05, ease(q));
      const lp = c.clone().add(new THREE.Vector3(Math.cos(a) * dist, hgt, Math.sin(a) * dist));
      const lift = lerp(0, 0.02, sstep(0.45, 0.9, q));          // no fim a câmera levanta o olhar: céu e "Obrigado!" atrás da escola
      ecam.position.copy(local.localToWorld(lp)); ecam.up.copy(N0); ecam.lookAt(local.localToWorld(c.clone().setY(lift)));
    }
    setNearFar(0.15);
    sunS.target.position.copy(c); sunS.position.copy(c).addScaledVector(SUNL, 0.8); sunS.target.updateMatrixWorld(); sunS.updateMatrixWorld();
    // "Obrigado!" sobe ao fundo, sempre atrás da escola em relação à câmera
    const k = sstep(0.5, 0.82, q), cl = local.worldToLocal(ecam.position.clone()), dir = c.clone().sub(cl).setY(0).normalize();
    thanks.visible = k > 0; thanks.material.opacity = k;
    thanks.position.copy(c).addScaledVector(dir, 0.3).setY(lerp(-0.045, 0.074, ease(k))); thanks.up.copy(N0);
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
    const ground = ['earth', 'zoom', 'senai'].includes(a.id); bloom.strength = a.id === 'senai' ? 0.16 : ground ? 0.35 : a.id === 'bang' ? 1.1 : 0.85; bloom.threshold = a.id === 'senai' ? 0.95 : ground ? 0.85 : 0.55;
    renderer.toneMappingExposure = a.id === 'zoom' ? 1.1 : a.id === 'senai' ? 0.92 : 1.0;
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
