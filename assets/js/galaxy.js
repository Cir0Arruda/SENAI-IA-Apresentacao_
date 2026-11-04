/* =========================================================
   Abertura · Galáxia + buraco negro + sistema planetário
   (three.js r170 + GLSL)
   - galáxia espiral volumétrica: um mapa da galáxia vista de cima
     (gás, estrelas jovens, regiões HII e poeira) é calculado uma vez
     na placa de vídeo; a cada quadro, cada raio de luz atravessa o
     disco (raymarching), somando o brilho do gás e perdendo luz na
     poeira, como nas fotos do Hubble
   - 150 mil estrelas sorteadas a partir desse mapa, escurecidas pela
     poeira que fica entre elas e a câmera
   - clique num braço: um único voo de câmera, sem cortes, mergulha no
     braço, atravessa uma nebulosa volumétrica e chega a um sistema
     planetário (um planeta por tema), com o braço ao fundo
   - buraco negro com raytracing: a luz é curvada pela gravidade
     (aproximação de Schwarzschild, integrando cada raio no shader)
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const root = document.getElementById('gx');
const canvas = document.getElementById('gx-canvas');
const $ = s => root.querySelector(s);
const html = document.documentElement;
const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const lowEnd = small || (navigator.hardwareConcurrency || 8) <= 4;
const TEST = /[?&]teste\b/.test(location.search);

function noGL(msg) {
  root.classList.add('nogl');
  const c = $('#gx-count'); if (c) c.textContent = 'modo simples';
  window.IAGalaxy = { warp: () => Promise.resolve(), setActive() {} };
  if (msg) console.warn('[galáxia]', msg);
}

try { init(); } catch (err) { noGL(err && err.message); }

function init() {
  /* ---------- Renderizador e câmeras ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  if (!renderer.capabilities.isWebGL2) throw new Error('WebGL2 indisponível');
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x020206, 1);
  const basePR = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.6);
  let pr = basePR;
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();        // estrelas da galáxia e céu
  const bhScene = new THREE.Scene();      // buraco negro (desenhado depois da lente)
  const sysScene = new THREE.Scene();     // sistema planetário
  const nebStarScene = new THREE.Scene(); // estrelas dentro da nebulosa
  const HOME_BASE = new THREE.Vector3(0, 12.6, 15.6), HOME_POS = HOME_BASE.clone(), ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.004, 2000);
  camera.position.copy(HOME_POS);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 48;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.22;

  const sysCam = new THREE.PerspectiveCamera(50, 1, 0.1, 5000);
  const bgCam = new THREE.PerspectiveCamera(50, 1, 0.002, 2000);   // galáxia vista de dentro do sistema
  const sysControls = new OrbitControls(sysCam, canvas);
  sysControls.enabled = false;
  sysControls.enableDamping = true;
  sysControls.dampingFactor = 0.06;
  sysControls.enablePan = false;
  sysControls.minDistance = 10;
  sysControls.maxDistance = 150;
  sysControls.rotateSpeed = 0.5;
  sysControls.zoomSpeed = 0.7;
  sysControls.autoRotateSpeed = 0.16;

  const rand = mulberry32(20261103);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const clamp = THREE.MathUtils.clamp;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- Uniforms compartilhados ---------- */
  const U = {
    uTime: { value: 0 },
    uPR: { value: pr },
    uMouse: { value: new THREE.Vector3(999, 0, 999) },
    uMouseOn: { value: 0 },
    uWarp: { value: 0 },
    uCube: { value: 0 }
  };

  /* =========================================================
     Galáxia espiral
     Os braços seguem uma espiral logarítmica:
       ângulo = k·π + K·ln(r / R0)   (k = braço 0 ou 1)
     A galáxia gira como um bloco (padrão de onda de densidade),
     então os braços não se enrolam com o tempo.
     ========================================================= */
  const KS = 1.9, R0 = 1.6, R_MAX = 13;
  const SPAN = 28;                         // o mapa cobre de -14 a 14
  const MAP_RES = lowEnd ? 1024 : 2048;
  const HE = 0.13, HD = 0.05, SIG = 2.7;   // espessura do gás, da poeira e opacidade da poeira
  const armAngle = (r, k) => k * Math.PI + KS * Math.log(r / R0);
  const galaxy = new THREE.Group();
  scene.add(galaxy);

  const GLSL_NOISE = /* glsl */`
    float h2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
    float fb2(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
      for (int i = 0; i < 6; i++){ s += a * n2(p); p = m * p + 1.7; a *= 0.5; } return s; }
    float h3(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fb3(vec3 p, int oct){ float s = 0.0, a = 0.5;
      for (int i = 0; i < 6; i++){ if (i >= oct) break; s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; } return s; }
    float ign(vec2 p){ return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`;
  // integral de exp(-|y|/h) num trecho do raio (exata na vertical): o disco é fino,
  // então somar o perfil vertical exato evita faixas e ruído com poucos passos
  const GLSL_COL = /* glsl */`
    float colF(float y, float h){ return sign(y) * h * (1.0 - exp(-abs(y) / h)); }
    float colI(float ya, float yb, float h, float ds){
      float dy = yb - ya;
      if (abs(dy) < 0.02 * h) return exp(-abs(ya + yb) * 0.5 / h) * ds;
      return (colF(yb, h) - colF(ya, h)) / dy * ds;
    }`;
  const FSQ_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

  /* ---------- 1) Mapa da galáxia vista de cima (calculado uma vez) ----------
     rgb = brilho (estrelas velhas, braços azuis, regiões HII rosadas)
     a   = poeira (faixas escuras na borda interna dos braços) */
  const mapMat = new THREE.ShaderMaterial({
    uniforms: { uLDR: { value: 0 } },
    vertexShader: FSQ_VS,
    fragmentShader: /* glsl */`
      uniform float uLDR; varying vec2 vUv;
      ${GLSL_NOISE}
      const float KS = ${KS.toFixed(3)}, R0 = ${R0.toFixed(3)};
      void main(){
        vec2 p = (vUv - 0.5) * ${SPAN.toFixed(1)};
        float r0 = length(p);
        // distorção suave: braços irregulares, como nas galáxias reais
        vec2 wv = vec2(fb2(p * 0.42 + 3.1), fb2(p * 0.42 - 8.7)) - 0.5;
        vec2 q = p + wv * 0.62;
        float r = max(length(q), 0.02), th = atan(q.y, q.x), lr = log(r / R0);
        float phi = th - KS * lr;                       // coordenada da espiral (0 = crista do braço)
        float armC = 0.5 + 0.5 * cos(2.0 * phi);
        vec3 sp = vec3(cos(phi) * 3.4, sin(phi) * 3.4, lr * 2.6);   // ruído que acompanha os braços
        float flo = fb3(sp + vec3(0.0, 0.0, 1.7), 5);
        float spur = fb3(vec3(cos(th - KS * 0.45 * lr) * 4.0, sin(th - KS * 0.45 * lr) * 4.0, lr * 5.0), 4);
        float clump = fb2(p * 2.2 + 5.0), fine = fb2(p * 7.0 - 2.0);
        float inner = smoothstep(0.7, 2.6, r0), outer = smoothstep(13.9, 7.5, r0);
        float arm = pow(armC, 2.4) * (0.45 + 1.0 * flo) * (0.75 + 0.5 * spur) * inner * outer;
        float armN = pow(armC, 12.0) * inner * outer;
        // disco de estrelas velhas, que também se concentra um pouco nos braços
        float dw = mix(1.0, 0.5 + 0.75 * armC, smoothstep(1.4, 3.5, r0));
        float disk = exp(-r0 / 3.3) * (0.9 + 0.25 * clump) * dw + 0.16 * exp(-r0 / 6.0) * (0.5 + 0.9 * flo) * outer * dw;
        // aglomerados azuis e regiões HII (rosadas) na borda externa dos braços
        float kn = fb2(p * 3.3 + 11.0) * 0.72 + fine * 0.28;
        float hii = smoothstep(0.6, 0.77, kn) * pow(0.5 + 0.5 * cos(2.0 * (phi + 0.16)), 5.0) * inner * outer;
        float blu = smoothstep(0.56, 0.74, fb2(p * 4.4 - 3.0) * 0.8 + fine * 0.2) * armC * armC * inner * outer;
        vec3 OLD = vec3(1.0, 0.76, 0.52), YOUNG = vec3(0.5, 0.66, 1.0), HII = vec3(1.0, 0.3, 0.5);
        vec3 E = OLD * disk * 0.5
               + YOUNG * arm * 0.5 * exp(-r0 / 10.0) * mix(0.4, 1.0, smoothstep(1.5, 4.5, r0))
               + vec3(0.62, 0.74, 1.0) * blu * 0.75 + vec3(0.86, 0.9, 1.0) * armN * 0.18 * exp(-r0 / 9.0)
               + HII * hii * 1.5;
        E *= smoothstep(14.0, 12.2, r0);
        // poeira: faixas finas na borda interna dos braços e filamentos pelo disco
        float lane = pow(0.5 + 0.5 * cos(2.0 * (phi - 0.4)), 12.0);
        float laneN = fb3(sp * 1.9 + 4.0, 4);
        float ridge = pow(1.0 - abs(2.0 * fb2(p * 2.6 + 1.0) - 1.0), 6.0);
        float ridgeB = pow(1.0 - abs(2.0 * fb3(sp * 2.4 + 7.0, 4) - 1.0), 8.0);
        float dust = lane * (0.25 + 1.35 * smoothstep(0.32, 0.72, laneN)) * smoothstep(1.0, 2.6, r0) * smoothstep(13.0, 6.5, r0)
                   + (ridge * 0.45 + ridgeB * 0.5) * smoothstep(1.3, 3.2, r0) * smoothstep(12.5, 3.5, r0)
                   + 0.05 * exp(-r0 / 4.0);
        if (uLDR > 0.5) gl_FragColor = vec4(E / (1.0 + E), clamp(dust, 0.0, 1.0));
        else gl_FragColor = vec4(E * 0.5, dust);
      }`,
    depthTest: false, depthWrite: false
  });
  const mapRT = new THREE.WebGLRenderTarget(MAP_RES, MAP_RES, {
    type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false
  });
  const RB = 512;
  const mapLDR = new THREE.WebGLRenderTarget(RB, RB, { type: THREE.UnsignedByteType, depthBuffer: false });
  const mapQuad = new FullScreenQuad(mapMat);
  renderer.setRenderTarget(mapRT); mapQuad.render(renderer);
  mapMat.uniforms.uLDR.value = 1;
  renderer.setRenderTarget(mapLDR); mapQuad.render(renderer);
  renderer.setRenderTarget(null);
  const mapPix = new Uint8Array(RB * RB * 4);
  renderer.readRenderTargetPixels(mapLDR, 0, 0, RB, RB, mapPix);
  mapQuad.dispose(); mapLDR.dispose();
  const MAP = mapRT.texture;

  /* ---------- 2) Estrelas sorteadas a partir do mapa ---------- */
  const N = reduce ? 50000 : lowEnd ? 65000 : 150000;
  const C = hex => new THREE.Color(hex);
  const PAL = {
    bulge: [C('#fff0d8'), C('#ffe2bb'), C('#ffcf96'), C('#fff6ea')],
    disk: [C('#f3dcc4'), C('#e6d8ff'), C('#ffe7cf')],
    young: C('#d8e6ff'), hii: C('#ff78b0'), white: C('#ffffff')
  };
  const pick = arr => arr[(rand() * arr.length) | 0];
  function starGeometry(pos, col, size, seed) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }
  const mapIdx = (x, z) => ((clamp(((z / SPAN + 0.5) * RB) | 0, 0, RB - 1) * RB) + clamp(((x / SPAN + 0.5) * RB) | 0, 0, RB - 1)) * 4;
  function buildStars() {
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    const c = new THREE.Color(), d3 = new THREE.Vector3();
    let maxL = 0;
    for (let i = 0; i < mapPix.length; i += 4) maxL = Math.max(maxL, 0.3 * mapPix[i] + 0.5 * mapPix[i + 1] + 0.2 * mapPix[i + 2]);
    for (let i = 0; i < N; i++) {
      const u = rand();
      let x, y, z, s, b;
      if (u < 0.08) {                       // bojo central, levemente achatado
        let r = 0.42 * Math.pow(-Math.log(1 - rand() * 0.9995), 1.25);
        if (r > 3) r = rand() * 3;
        d3.set(gauss(), gauss(), gauss()).normalize();
        x = d3.x * r; y = d3.y * r * 0.6; z = d3.z * r;
        c.copy(pick(PAL.bulge));
        b = 0.45 + 0.3 * Math.min(1, r / 1.5); s = 0.5 + rand() * 0.7;
      } else if (u < 0.105) {               // halo esparso
        d3.set(gauss(), gauss(), gauss()).normalize();
        const r = 3 + rand() * 13;
        x = d3.x * r; y = d3.y * r * 0.45; z = d3.z * r;
        c.copy(pick(PAL.disk)); b = 0.3; s = 0.5 + rand() * 0.5;
      } else {                              // disco: sorteio proporcional ao brilho do mapa
        let k = 0, r = 0;
        for (let tries = 0; tries < 400; tries++) {
          r = 0.6 + 13.2 * Math.sqrt(rand());
          const a = rand() * TAU;
          x = Math.cos(a) * r; z = Math.sin(a) * r;
          k = mapIdx(x, z);
          const l = (0.3 * mapPix[k] + 0.5 * mapPix[k + 1] + 0.2 * mapPix[k + 2]) / maxL;
          if (rand() < Math.pow(l, 1.35)) break;
        }
        const mr = mapPix[k], mg = mapPix[k + 1], mb = mapPix[k + 2], mx = Math.max(mr, mg, mb, 1);
        const blue = mb > mr * 0.95, pink = mr > mg * 1.45 && mb > mg * 0.8;
        y = gauss() * (blue ? 0.028 + 0.004 * r : 0.05 + 0.01 * r);
        c.setRGB(mr / mx, mg / mx, mb / mx).lerp(PAL.white, 0.45);
        b = 0.42 + Math.pow(rand(), 3) * 0.7; s = 0.45 + Math.pow(rand(), 3) * 1.3;
        if (blue && rand() < 0.1) { c.copy(PAL.young); s *= 1.6; b = 1.25; }
        if (pink && rand() < 0.35) { c.copy(PAL.hii).lerp(PAL.white, rand() * 0.3); b = 1.1; s *= 1.2; }
      }
      pos.set([x, y, z], i * 3);
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = s; seed[i] = rand();
    }
    return starGeometry(pos, col, size, seed);
  }
  const STAR_VS = /* glsl */`
    uniform float uTime, uPR, uMouseOn, uWarp, uCube, uScaleK, uAlpha, uMaxSize, uDustOn;
    uniform vec2 uNear;
    uniform vec3 uMouse, uCamL;
    uniform sampler2D tMap;
    attribute vec3 aColor; attribute float aSize; attribute float aSeed;
    varying vec3 vColor;
    ${GLSL_COL}
    // poeira entre a estrela e a câmera (alguns passos pelo mapa)
    float dustTau(vec3 a, vec3 b){
      vec3 d = b - a; float L = length(d), tau = 0.0;
      for (int i = 0; i < 6; i++){
        float x0 = float(i) / 6.0, x1 = float(i + 1) / 6.0;
        x0 *= x0; x1 *= x1;
        vec3 pa = a + d * x0, pb = a + d * x1, pm = (pa + pb) * 0.5;
        float m = textureLod(tMap, pm.xz / ${SPAN.toFixed(1)} + 0.5, 2.0 + 4.0 * x1).a;
        tau += m * colI(pa.y, pb.y, ${HD}, L * (x1 - x0)) / ${(2 * HD).toFixed(3)};
      }
      return tau * ${SIG.toFixed(2)};
    }
    void main() {
      vec3 p = position;
      float wob = uTime * (0.15 + aSeed * 0.25) + aSeed * 60.0;
      p.xz += vec2(cos(wob), sin(wob)) * 0.01;
      vec2 d = p.xz - uMouse.xz;
      float dl = length(d);
      float infl = uMouseOn * smoothstep(2.2, 0.0, dl);
      p.xz += (d / max(dl, 0.001)) * infl * 1.0;
      p.y += infl * 0.4 * (aSeed - 0.5);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.8 + 0.2 * sin(uTime * (1.1 + aSeed * 3.0) + aSeed * 50.0);
      float z = max(-mv.z, 0.001);
      float s = aSize * uPR * (1.0 + infl * 1.4) * (1.0 + uWarp * 2.5) * mix(1.0, 0.35, uCube) * uScaleK / z;
      // estrelas menores que 1 pixel: mantém o tamanho e reduz o brilho (sem cintilar)
      float mn = 1.1 * uPR, e = 1.0;
      if (s < mn) { e = (s / mn) * (s / mn); s = mn; }
      gl_PointSize = min(s, uMaxSize * uPR);
      float nearCut = mix(1.0, 0.25 + 0.75 * smoothstep(1.4, 4.5, length(p)), uCube);
      float camFade = smoothstep(uNear.x, uNear.y, z);
      float att = uDustOn > 0.5 ? exp(-dustTau(p, uCamL) * 0.9) : 1.0;
      vColor = aColor * tw * (1.0 + infl * 1.3) * nearCut * camFade * uAlpha * e * att;
    }`;
  const STAR_FS = /* glsl */`
    varying vec3 vColor;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d2 = dot(c, c);
      float a = exp(-d2 * 26.0) + 0.16 * exp(-d2 * 7.0);
      if (a < 0.015) discard;
      gl_FragColor = vec4(vColor * a, 1.0);
    }`;
  const makeStarMat = (dust, k, maxS, extra = {}) => new THREE.ShaderMaterial({
    uniforms: { ...U, uScaleK: { value: k }, uAlpha: { value: 1 }, uMaxSize: { value: maxS }, uNear: { value: new THREE.Vector2(0.03, 0.6) },
      uDustOn: { value: dust ? 1 : 0 }, uCamL: { value: new THREE.Vector3() }, tMap: { value: MAP } },
    vertexShader: STAR_VS, fragmentShader: STAR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra
  });
  const starMat = makeStarMat(true, 34, 10);
  const stars = new THREE.Points(buildStars(), starMat);
  stars.frustumCulled = false;
  stars.renderOrder = 1;
  // posição da câmera no espaço da galáxia (serve para qualquer câmera: principal, fundo ou cubo)
  stars.onBeforeRender = (r, s, cam) => { galaxy.worldToLocal(starMat.uniforms.uCamL.value.setFromMatrixPosition(cam.matrixWorld)); };
  galaxy.add(stars);
  // perto (dentro da galáxia) as estrelas ficam menores, para não virarem bolas
  function setStarView(k) {
    starMat.uniforms.uScaleK.value = 34 + (9 - 34) * k * k;
    starMat.uniforms.uMaxSize.value = 10 + (4 - 10) * k;
    starMat.uniforms.uNear.value.set(0.03 - 0.02 * k, 0.6 - 0.45 * k);
  }

  /* Céu de fundo */
  {
    const n = 6000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(600);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = pick([C('#ffffff'), C('#d4d4fb'), C('#ffe3c8'), C('#c9d8ff')]).multiplyScalar(0.25 + Math.pow(rand(), 3) * 0.8);
      col.set([c.r, c.g, c.b], i * 3); size[i] = 0.8 + Math.pow(rand(), 4) * 2.2;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uPR: U.uPR },
      vertexShader: `uniform float uPR; attribute vec3 aColor; attribute float aSize; varying vec3 vColor;
        void main(){ vColor = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = aSize * uPR; }`,
      fragmentShader: `varying vec3 vColor; void main(){ vec2 c = gl_PointCoord-.5; float a = smoothstep(.25,0.,dot(c,c)); gl_FragColor = vec4(vColor*a,1.); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    const sky = new THREE.Points(g, m); sky.frustumCulled = false; sky.renderOrder = -1;
    scene.add(sky);
  }

  /* ---------- 3) Raymarching do disco (gás que brilha + poeira que absorve) ---------- */
  const CAM_UNI = () => ({ uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() }, uCamPos: { value: new THREE.Vector3() }, uPixAng: { value: 0.001 } });
  const galInv = new THREE.Matrix4();
  const galMarch = new THREE.ShaderMaterial({
    uniforms: { ...CAM_UNI(), tMap: { value: MAP }, uGalInv: { value: galInv }, uBulge: { value: 1 } },
    vertexShader: FSQ_VS,
    fragmentShader: /* glsl */`
      uniform sampler2D tMap; uniform mat4 uInvProj, uCamWorld, uGalInv; uniform vec3 uCamPos; uniform float uPixAng, uBulge;
      varying vec2 vUv;
      ${GLSL_NOISE}
      ${GLSL_COL}
      float erf1(float x){ float x2 = x * x, a = 0.147; return sign(x) * sqrt(max(1.0 - exp(-x2 * (1.2732395 + a * x2) / (1.0 + a * x2)), 0.0)); }
      void main(){
        vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 rdW = normalize(mat3(uCamWorld) * normalize(v.xyz / v.w));
        vec3 ro = (uGalInv * vec4(uCamPos, 1.0)).xyz;
        vec3 rd = normalize(mat3(uGalInv) * rdW);
        const float YM = 1.7, RM = 14.2;
        float t0 = 0.0, t1 = 90.0;
        if (abs(rd.y) > 1e-5) { float ta = (-YM - ro.y) / rd.y, tb = (YM - ro.y) / rd.y; t0 = max(min(ta, tb), 0.0); t1 = max(ta, tb); }
        else if (abs(ro.y) > YM) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float A = dot(rd.xz, rd.xz), B = dot(ro.xz, rd.xz), Cc = dot(ro.xz, ro.xz) - RM * RM, disc = B * B - A * Cc;
        if (A > 1e-8) {
          if (disc <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
          float sq = sqrt(disc); t0 = max(t0, (-B - sq) / A); t1 = min(t1, (-B + sq) / A);
        }
        if (t1 <= t0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        // bojo: soma de três gaussianas achatadas, integradas exatamente ao longo do raio (sem ruído)
        const float Q = 0.6;
        vec3 o2 = vec3(ro.x, ro.y / Q, ro.z), d2 = vec3(rd.x, rd.y / Q, rd.z);
        float bA = dot(d2, d2), bB = dot(o2, d2), bC = dot(o2, o2) - bB * bB / bA, sA = sqrt(bA), tc = bB / bA;
        vec3 S = vec3(0.07, 0.24, 0.8), AMP = vec3(4.5, 1.25, 0.42) * uBulge;
        vec3 K = AMP * S * 0.8862269 / sA * exp(-bC / (S * S));
        vec3 prevE = vec3(erf1(sA * (t0 + tc) / S.x), erf1(sA * (t0 + tc) / S.y), erf1(sA * (t0 + tc) / S.z));
        float L = t1 - t0;
        float g = clamp((L - 4.0) / 12.0, 0.0, 1.0);    // raios rasantes: passos crescem com a distância
        float j = ign(gl_FragCoord.xy);
        vec3 E = vec3(0.0); float T = 1.0, tA = t0;
        for (int i = 1; i <= ${lowEnd ? 30 : 44}; i++){
          float x = float(i) / ${lowEnd ? '30.0' : '44.0'};
          float tB = t0 + L * mix(x, x * x, g), ds = tB - tA;
          vec3 pa = ro + rd * tA, pb = ro + rd * tB, pm = mix(pa, pb, j);
          float foot = max(ds * sqrt(A), tB * uPixAng);
          float lod = clamp(log2(foot / ${(SPAN / MAP_RES).toFixed(5)}), 0.0, 9.0);
          vec4 m = textureLod(tMap, pm.xz / ${SPAN.toFixed(1)} + 0.5, lod);
          float ce = colI(pa.y, pb.y, ${HE}, ds) / ${(2 * HE).toFixed(3)};
          float cd = colI(pa.y, pb.y, ${HD}, ds) / ${(2 * HD).toFixed(3)};
          vec3 nE = vec3(erf1(sA * (tB + tc) / S.x), erf1(sA * (tB + tc) / S.y), erf1(sA * (tB + tc) / S.z));
          vec3 bk = K * (nE - prevE); prevE = nE;
          vec3 em = m.rgb * 2.0 * ce + vec3(1.0, 0.9, 0.74) * bk.x + vec3(1.0, 0.8, 0.56) * bk.y + vec3(1.0, 0.74, 0.5) * bk.z;
          // perto da câmera a luz do disco já aparece como estrelas separadas (os pontos), não como névoa
          em *= smoothstep(0.04, 1.1, mix(tA, tB, j));
          float tau = m.a * ${SIG.toFixed(2)} * cd;
          float tr = exp(-tau);
          E += T * em * (tau > 1e-4 ? (1.0 - tr) / tau : 1.0);
          T *= tr; tA = tB;
          if (T < 0.004) break;
        }
        gl_FragColor = vec4(E, T);
      }`,
    depthTest: false, depthWrite: false
  });

  /* ---------- 4) Nebulosa volumétrica atravessada na viagem ---------- */
  const NEB_R = 0.6;
  const nebMarch = new THREE.ShaderMaterial({
    uniforms: { ...CAM_UNI(), uTime: U.uTime, uNebC: { value: new THREE.Vector3(0, -99, 0) }, uNebSeed: { value: new THREE.Vector3() },
      uNL: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) } },
    vertexShader: FSQ_VS,
    fragmentShader: /* glsl */`
      uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos, uNebC, uNebSeed; uniform vec3 uNL[4]; uniform float uTime;
      varying vec2 vUv;
      ${GLSL_NOISE}
      const float R = ${NEB_R.toFixed(2)};
      void main(){
        vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec3 rd = normalize(mat3(uCamWorld) * normalize(v.xyz / v.w));
        vec3 oc = uCamPos - uNebC;
        float b = dot(oc, rd), c = dot(oc, oc) - R * R, disc = b * b - c;
        if (disc <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        float sq = sqrt(disc), t0 = max(-b - sq, 0.0), t1 = -b + sq;
        if (t1 <= 0.0) { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }
        const int NS = ${lowEnd ? 26 : 40};
        float ds = (t1 - t0) / float(NS), j = ign(gl_FragCoord.xy);
        vec3 E = vec3(0.0); float T = 1.0;
        for (int i = 0; i < NS; i++){
          vec3 p = uCamPos + rd * (t0 + (float(i) + j) * ds);
          vec3 q = (p - uNebC) / R;
          float r = length(q);
          if (r > 1.0) continue;
          vec3 w = q * 2.7 + uNebSeed;
          vec3 wp = w + 0.55 * vec3(n3(w * 0.9 + 3.0), n3(w * 0.9 - 7.0), n3(w * 0.9 + 11.0));
          float n = fb3(wp, ${lowEnd ? 4 : 5});
          float shape = smoothstep(1.0, 0.3, r);
          float dens = shape * smoothstep(0.47, 0.8, n);
          float dn = shape * smoothstep(0.52, 0.8, fb3(wp * 1.45 + 9.0, ${lowEnd ? 3 : 4}));
          // luz das estrelas jovens dentro da nebulosa
          float ill = 0.0;
          for (int k = 0; k < 4; k++){ vec3 dl = (p - uNL[k]) / R; ill += 1.0 / (dot(dl, dl) * 14.0 + 0.35); }
          ill = min(ill, 9.0);
          // perto das estrelas o oxigênio brilha verde-azulado; longe, o hidrogênio brilha rosa
          vec3 col = mix(vec3(1.0, 0.26, 0.46), vec3(0.32, 0.86, 0.92), smoothstep(1.6, 5.5, ill));
          col = mix(col, vec3(1.0, 0.62, 0.42), smoothstep(0.55, 0.85, n) * 0.35);
          float rim = 0.55 + 1.4 * smoothstep(0.42, 0.52, n) * (1.0 - smoothstep(0.6, 0.72, n));
          vec3 em = col * dens * ill * rim * 0.85 * smoothstep(0.015, 0.16, t0 + (float(i) + j) * ds);
          float tau = (dens * 1.6 + dn * 7.0) * ds / R;
          float tr = exp(-tau);
          E += T * em * (ds / R) * (tau > 1e-4 ? (1.0 - tr) / tau : 1.0);
          T *= tr;
          if (T < 0.01) break;
        }
        gl_FragColor = vec4(E, T);
      }`,
    depthTest: false, depthWrite: false
  });
  // estrelas novas dentro da nebulosa
  const NEB_STARS = lowEnd ? 700 : 1400;
  const nebStarGeo = (() => {
    const pos = new Float32Array(NEB_STARS * 3), col = new Float32Array(NEB_STARS * 3), size = new Float32Array(NEB_STARS), seed = new Float32Array(NEB_STARS);
    const c = new THREE.Color();
    for (let i = 0; i < NEB_STARS; i++) {
      c.copy(rand() < 0.25 ? PAL.hii : rand() < 0.6 ? PAL.young : PAL.white).multiplyScalar(0.7 + rand() * 0.7);
      col.set([c.r, c.g, c.b], i * 3); size[i] = 0.06 + Math.pow(rand(), 4) * 0.22; seed[i] = rand();
    }
    return starGeometry(pos, col, size, seed);
  })();
  const nebStarMat = makeStarMat(false, 9, 6, { depthTest: false });
  const nebStars = new THREE.Points(nebStarGeo, nebStarMat);
  nebStars.frustumCulled = false;
  nebStarScene.add(nebStars);
  let nebOn = false;
  function placeNebula(Cn) {
    nebMarch.uniforms.uNebC.value.copy(Cn);
    nebMarch.uniforms.uNebSeed.value.set(rand() * 40, rand() * 40, rand() * 40);
    const q = new THREE.Vector3(), pa = nebStarGeo.attributes.position, sa = nebStarGeo.attributes.aSize, ca = nebStarGeo.attributes.aColor;
    nebMarch.uniforms.uNL.value.forEach(L => L.copy(Cn).add(q.set(gauss(), gauss() * 0.7, gauss()).multiplyScalar(NEB_R * 0.28)));
    for (let i = 0; i < NEB_STARS; i++) {
      if (i < 4) { q.copy(nebMarch.uniforms.uNL.value[i]); sa.setX(i, 0.9); ca.setXYZ(i, 1.4, 1.5, 1.8); }
      else {
        // metade em volta das estrelas que iluminam a nebulosa, metade espalhada
        if (i % 2) q.copy(nebMarch.uniforms.uNL.value[i % 4]).add(new THREE.Vector3(gauss(), gauss(), gauss()).multiplyScalar(NEB_R * 0.12));
        else q.set(gauss(), gauss() * 0.6, gauss()).multiplyScalar(NEB_R * 0.55).add(Cn);
      }
      pa.setXYZ(i, q.x, q.y, q.z);
    }
    pa.needsUpdate = sa.needsUpdate = ca.needsUpdate = true;
  }
  function setNebula(on) { nebOn = on; nebStars.visible = on; }
  setNebula(false);

  /* =========================================================
     Sistema planetário (cada planeta é um tema da apresentação)
     ========================================================= */
  const PLANETS = [
    { name: 'Fundamentos', slide: 2, icon: 'brain', tag: 'Fundamentos · 4 slides', r: 8, size: 1.35, cols: ['#a7a4f4', '#e4e3ff', '#2c2a6b'], type: 0, ring: false,
      text: 'O que é IA, como um modelo de linguagem escreve, a matemática de um neurônio e como a IA é treinada.', facts: [['brain', 'Neurônio interativo'], ['trend', 'Descida do gradiente'], ['layers', 'Tokens e atenção']] },
    { name: 'Tradução', slide: 6, icon: 'languages', tag: '1.1 Ferramenta', r: 11, size: 1.0, cols: ['#ffc79f', '#fff0e2', '#8a3a14'], type: 1,
      text: 'Um tradutor por dentro: tokens, vetores e atenção ligando cada palavra à tradução, e a armadilha das expressões.', facts: [['languages', 'Inglês, espanhol e japonês'], ['gem', 'Sua frase com Gemini']] },
    { name: 'Assistentes', slide: 7, icon: 'mic', tag: '1.2 Ferramenta', r: 14, size: 0.95, cols: ['#9cc0ff', '#f1f6ff', '#2f4f8f'], type: 2,
      text: 'Do som da voz até a resposta: as 5 etapas de um assistente virtual, com a intenção em JSON.', facts: [['mic', 'Voz para texto'], ['code', 'Intenção em JSON']] },
    { name: 'Chatbots', slide: 8, icon: 'message', tag: '1.3 Ferramenta', r: 17.5, size: 1.3, cols: ['#ff9a4d', '#ffe2c8', '#8a3010'], type: 0, ring: true,
      text: 'Bot de regras, bot com IA e o Gemini respondendo ao vivo, com memória da conversa.', facts: [['message', '3 modos'], ['gem', 'Gemini ao vivo']] },
    { name: 'Geração', slide: 9, icon: 'image', tag: '1.4 Ferramenta', r: 21, size: 1.0, cols: ['#ff8ab8', '#ffe0ec', '#6e1f47'], type: 1,
      text: 'Como uma imagem nasce do ruído, passo a passo, num modelo de difusão.', facts: [['image', 'Difusão em 40 passos'], ['palette', 'Prompt de imagem']] },
    { name: 'Prompts', slide: 11, icon: 'sparkles', tag: '1.6 Ferramenta', r: 26.5, size: 1.6, cols: ['#d4d4fb', '#ffffff', '#4a46b8'], type: 0, ring: true,
      text: 'Monte um prompt com papel, contexto, formato e exemplo, e veja a resposta melhorar.', facts: [['sparkles', '6 ingredientes'], ['gem', 'Teste real no Gemini']] },
    { name: 'Agentes e Excel', slide: 12, icon: 'bot', tag: 'Extra', r: 31, size: 1.2, cols: ['#4fe3ff', '#d8fbff', '#0f4c5c'], type: 2,
      text: 'Agentes que pensam, agem e conferem. Inclui o Claude automatizando uma planilha inteira do Excel.', facts: [['repeat', 'Ciclo do agente'], ['table', 'Claude + Excel']] },
    { name: 'Vídeo', slide: 16, icon: 'film', tag: 'Bônus', r: 35.5, size: 1.0, cols: ['#ffb36b', '#fff3e3', '#7a3e0a'], type: 1,
      text: 'Como criar e editar vídeos com o Claude Code usando HTML: cada pedido no chat vira uma edição.', facts: [['film', 'Editor simulado'], ['code', 'HyperFrames']] }
  ];
  const PLANET_VS = /* glsl */`
    varying vec3 vN; varying vec3 vW; varying vec3 vO;
    void main(){ vO = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const NOISE = /* glsl */`
    float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h3(i), h3(i+vec3(1,0,0)), f.x), mix(h3(i+vec3(0,1,0)), h3(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h3(i+vec3(0,0,1)), h3(i+vec3(1,0,1)), f.x), mix(h3(i+vec3(0,1,1)), h3(i+vec3(1,1,1)), f.x), f.y), f.z); }
    float fbm3(vec3 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * n3(p); p *= 2.02; a *= 0.5; } return s; }`;
  const PLANET_FS = /* glsl */`
    uniform vec3 uC1, uC2, uC3; uniform float uType, uTime, uHover, uSeed;
    varying vec3 vN; varying vec3 vW; varying vec3 vO;
    ${NOISE}
    void main(){
      vec3 n = normalize(vN);
      vec3 L = normalize(-vW);
      vec3 V = normalize(cameraPosition - vW);
      vec3 o = normalize(vO);
      float pat;
      if (uType < 0.5) {
        float w = fbm3(o * 2.6 + vec3(uSeed, uTime * 0.02, 0.0));
        pat = 0.5 + 0.5 * sin(o.y * 13.0 + w * 5.0 + uSeed);
      } else if (uType < 1.5) {
        pat = smoothstep(0.32, 0.78, fbm3(o * 3.6 + uSeed));
      } else {
        pat = fbm3(o * 2.2 + uSeed);
        pat = mix(pat, 1.0, smoothstep(0.62, 0.9, abs(o.y)));
      }
      vec3 base = mix(uC3, uC1, smoothstep(0.1, 0.7, pat));
      base = mix(base, uC2, smoothstep(0.7, 1.0, pat));
      float nl = dot(n, L);
      float diff = max(nl, 0.0);
      float term = smoothstep(-0.12, 0.35, nl);                 // terminador suave (atmosfera)
      float fill = max(dot(n, V), 0.0) * 0.1;
      float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
      vec3 col = base * (0.04 + 0.95 * diff * term + fill) * 0.92;
      col += uC1 * fres * (0.32 + uHover * 0.4) * (0.2 + 0.8 * term);          // brilho da atmosfera na borda
      col += vec3(1.0, 0.9, 0.8) * pow(max(dot(reflect(-L, n), V), 0.0), 24.0) * 0.12 * diff;
      gl_FragColor = vec4(col, 1.0);
    }`;
  const RING_FS = /* glsl */`
    uniform vec3 uC1, uC2; uniform float uHover;
    varying vec3 vN; varying vec3 vW; varying vec3 vO;
    ${NOISE}
    void main(){
      float r = length(vO.xy);
      float t = (r - 1.45) / 0.85;
      float bands = 0.55 + 0.45 * sin(t * 40.0) * n3(vec3(t * 18.0, 1.0, 2.0));
      float a = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.85, t) * bands * 0.75;
      float lit = 0.35 + 0.65 * max(dot(normalize(vN), normalize(-vW)) * 0.5 + 0.5, 0.0);
      gl_FragColor = vec4(mix(uC1, uC2, t) * lit * (1.0 + uHover * 0.6), a);
    }`;
  function glowTex() {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }
  const GLOW = glowTex();

  // Sol
  const sun = new THREE.Mesh(new THREE.SphereGeometry(3.1, 64, 40), new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime },
    vertexShader: PLANET_VS,
    fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vO; ${NOISE}
      void main(){
        vec3 o = normalize(vO);
        float f = fbm3(o * 3.2 + vec3(0.0, uTime * 0.08, 0.0)), g = fbm3(o * 8.0 - vec3(uTime * 0.05));
        vec3 c = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.6), smoothstep(0.3, 0.8, f));
        c += vec3(1.0, 0.95, 0.85) * pow(g, 3.0) * 0.8;
        float mu = max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
        gl_FragColor = vec4(c * (0.55 + 0.75 * pow(mu, 0.5)) * 1.7, 1.0);
      }`
  }));
  sysScene.add(sun);
  [[24, '#ffb070', 0.95], [64, '#ff7a3d', 0.32]].forEach(([s, col, op]) => {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: C(col), opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    g.scale.setScalar(s); sysScene.add(g);
  });
  // Órbitas e cinturão de asteroides
  const orbitMat = new THREE.LineBasicMaterial({ color: 0xa7a4f4, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false });
  PLANETS.forEach(p => {
    const pts = [];
    for (let i = 0; i < 256; i++) { const a = i / 256 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * p.r, 0, Math.sin(a) * p.r)); }
    sysScene.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), orbitMat));
  });
  const belt = (() => {
    const n = lowEnd ? 1400 : 2800, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = rand() * TAU, r = 23.2 + gauss() * 0.55; pos.set([Math.cos(a) * r, gauss() * 0.18, Math.sin(a) * r], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.22, map: GLOW, color: 0xd9cfc4, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending }));
  })();
  sysScene.add(belt);

  const sphereGeo = new THREE.SphereGeometry(1, 64, 40);
  const ringGeo = new THREE.RingGeometry(1.45, 2.3, 128, 1);
  const planetMeshes = [];
  PLANETS.forEach((p, i) => {
    p.phase = i * 2.39996 + 0.6;
    p.speed = 0.16 / Math.pow(p.r, 0.9);
    p.spin = 0.15 + rand() * 0.2;
    p.hover = 0;
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uC1: { value: C(p.cols[0]) }, uC2: { value: C(p.cols[1]) }, uC3: { value: C(p.cols[2]) }, uType: { value: p.type }, uTime: U.uTime, uHover: { value: 0 }, uSeed: { value: i * 3.7 } },
      vertexShader: PLANET_VS, fragmentShader: PLANET_FS
    });
    const m = new THREE.Mesh(sphereGeo, mat);
    m.scale.setScalar(p.size);
    m.rotation.z = 0.25 - rand() * 0.5;
    m.userData.i = i;
    g.add(m);
    if (p.ring) {
      const rm = new THREE.ShaderMaterial({
        uniforms: { uC1: { value: C(p.cols[1]) }, uC2: { value: C(p.cols[0]) }, uHover: mat.uniforms.uHover },
        vertexShader: PLANET_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false
      });
      const ring = new THREE.Mesh(ringGeo, rm);
      ring.scale.setScalar(p.size);
      ring.rotation.x = -Math.PI / 2 + 0.45;
      ring.rotation.y = 0.3;
      g.add(ring);
    }
    p.group = g; p.mesh = m; p.mat = mat;
    sysScene.add(g);
    planetMeshes.push(m);
  });

  /* Rótulos em HTML */
  const labelsBox = $('#gx-labels');
  const iconSvg = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  let labelHover = -1;
  PLANETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'gx-label off';
    b.innerHTML = `${iconSvg(p.icon)}<span>${p.name}</span>`;
    b.addEventListener('click', () => focusPlanet(i));
    b.addEventListener('pointerenter', () => (labelHover = i));
    b.addEventListener('pointerleave', () => (labelHover = -1));
    labelsBox.appendChild(b);
    p.label = b;
  });
  const bhLabel = document.createElement('button');
  bhLabel.className = 'gx-label bh';
  bhLabel.innerHTML = `${iconSvg('target')}<span>Buraco negro · clique para entrar</span>`;
  bhLabel.addEventListener('click', () => enterBH());
  labelsBox.appendChild(bhLabel);
  // marcador fixo num dos braços, para quem não sabe onde clicar
  const PIN_R = 7.2;
  const pinLocal = new THREE.Vector3(Math.cos(armAngle(PIN_R, 1)) * PIN_R, 0, Math.sin(armAngle(PIN_R, 1)) * PIN_R);
  const pinLabel = document.createElement('button');
  pinLabel.className = 'gx-label pin';
  pinLabel.innerHTML = `<span class="pd">${iconSvg('planet')}</span><span>Sistema dos temas · clique para viajar</span>`;
  pinLabel.addEventListener('click', () => travelTo(pinLocal));
  labelsBox.appendChild(pinLabel);
  const armLabel = document.createElement('div');
  armLabel.className = 'gx-label arm off';
  armLabel.innerHTML = `${iconSvg('spiral')}<span>Braço espiral · clique para viajar</span>`;
  const reticle = document.createElement('div');
  reticle.className = 'gx-reticle off';
  labelsBox.append(reticle, armLabel);
  // lista de planetas no painel do sistema
  const plist = $('#gxs-list');
  plist.innerHTML = PLANETS.map((p, i) => `<button data-i="${i}" style="--c1:${p.cols[0]};--c2:${p.cols[2]}"><span class="dot"></span>${p.name}</button>`).join('');
  plist.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) focusPlanet(+b.dataset.i); });

  /* Legendas no estilo de documentário */
  const cap = $('#gx-cap');
  let capTimer = 0, capKey = '';
  function caption(key, kicker, title, sub, ms = 3600) {
    if (!cap || capKey === key) return;
    capKey = key;
    clearTimeout(capTimer);
    cap.classList.remove('on');
    capTimer = setTimeout(() => {
      cap.innerHTML = `<small>${kicker}</small><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}`;
      void cap.offsetWidth;
      cap.classList.add('on');
      capTimer = setTimeout(() => cap.classList.remove('on'), ms);
    }, cap.classList.contains('on') ? 450 : 0);
  }
  function hideCaption() { if (!cap) return; clearTimeout(capTimer); cap.classList.remove('on'); capKey = ''; }

  /* =========================================================
     Buraco negro: raytracing no shader
     Unidade: rs = raio de Schwarzschild. Cada raio de luz é
     integrado com a aceleração  a = -1,5 · h² · x / |x|⁵,
     que reproduz a curvatura da luz perto do buraco negro.
     ========================================================= */
  const BH_SCALE = 0.11;                 // unidades do mundo por rs
  const tilt = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.32, 0, 0.18));
  const TILT = new THREE.Matrix3().setFromMatrix4(tilt);
  const TILT_INV = TILT.clone().transpose();
  const BH_COMMON = /* glsl */`
    uniform float uTime, uLens, uDoppler, uDisk, uHighlight, uBright, uRB, uHasEnv;
    uniform mat3 uTilt, uTiltInv;
    uniform samplerCube uEnv;
    const float RIN = 3.0;
    const float ROUT = 12.0;
    float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ s += a * noise(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
    vec3 skyStars(vec3 d){
      vec2 uv = vec2(atan(d.z, d.x), asin(clamp(d.y, -1.0, 1.0)));
      vec3 c = vec3(0.0);
      for (int k = 0; k < 2; k++){
        float sc = k == 0 ? 160.0 : 380.0;
        vec2 g = uv * sc / 6.2831853;
        vec2 id = floor(g), f = fract(g) - 0.5;
        float h = hash(id + float(k) * 17.0);
        if (h > 0.982) {
          vec2 o = vec2(hash(id + 3.1), hash(id + 9.7)) - 0.5;
          c += mix(vec3(1.0, 0.85, 0.75), vec3(0.8, 0.82, 1.0), hash(id + 1.3)) * smoothstep(0.16, 0.0, length(f - o * 0.6)) * (h - 0.982) * 70.0;
        }
      }
      return c;
    }
    vec3 background(vec3 dl){
      vec3 dw = uTilt * dl;
      vec3 c = skyStars(dw) * 0.5;
      if (uHasEnv > 0.5) c += min(textureCube(uEnv, dw).rgb, vec3(1.2)) * 0.5;
      else c += vec3(0.45, 0.38, 0.8) * pow(max(0.0, 1.0 - abs(dw.y) * 2.5), 3.0) * 0.18;
      return c;
    }
    vec4 diskColor(vec3 q, vec3 v){
      float r = length(q.xz);
      float a = atan(q.z, q.x) - uTime * 1.6 / pow(r, 1.5);
      vec2 pc = vec2(cos(a), sin(a)) * r;
      float n = fbm(pc * 1.05);
      n = mix(n, fbm(pc * 3.1 + 4.0), 0.45);
      float t = clamp((r - RIN) / (ROUT - RIN), 0.0, 1.0);
      vec3 c = mix(vec3(1.0, 0.96, 0.9), vec3(1.0, 0.64, 0.3), smoothstep(0.0, 0.35, t));
      c = mix(c, vec3(0.78, 0.3, 0.32), smoothstep(0.4, 1.0, t));
      float I = pow(1.0 - t, 1.8) * 2.3 + 0.2;
      vec3 vel = normalize(vec3(-q.z, 0.0, q.x));
      float beta = clamp(sqrt(0.5 / max(r - 1.0, 0.2)), 0.0, 0.72);
      float cosT = dot(vel, -normalize(v));
      float g = sqrt(1.0 - beta * beta) / (1.0 - beta * cosT);
      float dop = uDoppler * (uHighlight == 5.0 ? 1.6 : 1.0);
      float D = mix(1.0, pow(g, 3.0), clamp(dop, 0.0, 1.0)) * (1.0 + max(dop - 1.0, 0.0) * (g - 1.0) * 2.0);
      c = mix(c, c * vec3(0.72, 0.9, 1.45), clamp(dop * (g - 1.0) * 1.4, 0.0, 1.0));
      c = mix(c, c * vec3(1.25, 0.7, 0.55), clamp(dop * (1.0 - g) * 1.4, 0.0, 1.0));
      float edge = smoothstep(RIN - 0.2, RIN + 0.9, r) * (1.0 - smoothstep(ROUT - 4.0, ROUT, r));
      float dens = edge * (0.3 + 0.9 * n);
      return vec4(c * I * max(D, 0.08) * (0.5 + 1.0 * n) * uBright, clamp(dens * 0.95, 0.0, 1.0));
    }
    // devolve cor (rgb) e opacidade (a)
    vec4 trace(vec3 ro, vec3 rd, int STEPS, bool wantBg){
      vec3 p = ro, v = rd;
      float b = dot(p, v), cc = dot(p, p) - uRB * uRB;
      vec3 col = vec3(0.0); float al = 0.0;
      float minR = 1e3, nc = 0.0; int state = 0;
      if (cc > 0.0) {
        float disc = b * b - cc;
        if (disc < 0.0 || b > 0.0) state = 2; else p += v * (-b - sqrt(disc));
      }
      if (state == 0) {
        vec3 hv = cross(p, v); float h2 = dot(hv, hv);
        for (int i = 0; i < 400; i++){
          if (i >= STEPS) break;
          float r2 = dot(p, p), r = sqrt(r2);
          minR = min(minR, r);
          float dt = clamp(0.085 * r, 0.025, 0.9);
          vec3 acc = -1.5 * h2 * p / (r2 * r2 * r) * uLens;
          vec3 pp = p;
          v += acc * dt; p += v * dt;
          if (uDisk > 0.5 && pp.y * p.y < 0.0) {
            float t = pp.y / (pp.y - p.y);
            vec3 q = mix(pp, p, t);
            float rq = length(q.xz);
            if (rq > RIN - 0.3 && rq < ROUT) {
              vec4 dc = diskColor(q, v);
              if (uHighlight == 4.0 && nc > 0.5) dc.rgb = mix(dc.rgb, vec3(0.62, 0.58, 1.0) * 2.4, 0.65);
              col += (1.0 - al) * dc.rgb * dc.a; al += (1.0 - al) * dc.a; nc += 1.0;
              if (al > 0.985) { state = 3; break; }
            }
          }
          if (dot(p, p) < 1.0) { state = 1; break; }
          if (r > uRB && dot(p, v) > 0.0) { state = 2; break; }
        }
        if (state == 0) state = 1;
      }
      float outA = al;
      if (state == 2) {
        if (wantBg) col += (1.0 - al) * background(normalize(v));
        float ringGlow = exp(-max(minR - 1.5, 0.0) * 5.0) * step(minR, 3.0);
        col += vec3(1.0, 0.82, 0.62) * ringGlow * 0.22 * (1.0 - al) * uLens;
        if (uHighlight == 2.0) col += vec3(1.0, 0.78, 0.45) * exp(-pow((minR - 1.55) / 0.16, 2.0)) * 2.6;
      } else if (state == 1) {
        outA = 1.0;
        if (uHighlight == 1.0) col += (1.0 - al) * vec3(0.55, 0.16, 0.04) * (0.6 + 0.4 * sin(uTime * 3.0));
      }
      if (uHighlight == 3.0) col = mix(col * 0.18, col * 1.25, clamp(al * 1.4, 0.0, 1.0));
      if (uHighlight == 4.0 && state == 2) col *= 1.2;
      if (wantBg) outA = 1.0;
      return vec4(col, outA);
    }`;
  const bhUniforms = () => ({
    uTime: U.uTime, uLens: { value: 1 }, uDoppler: { value: 1 }, uDisk: { value: 1 }, uHighlight: { value: 0 }, uBright: { value: 1 },
    uRB: { value: 17 }, uHasEnv: { value: 0 }, uTilt: { value: TILT }, uTiltInv: { value: TILT_INV }, uEnv: { value: null }
  });
  // 1) Versão "billboard": um quadrado virado para a câmera no centro da galáxia
  const bbMat = new THREE.ShaderMaterial({
    uniforms: { ...bhUniforms(), uScale: { value: BH_SCALE }, uFade: { value: 1 } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${BH_COMMON}
      uniform float uScale, uFade; varying vec3 vW;
      void main(){
        vec3 ro = uTiltInv * (cameraPosition / uScale);
        vec3 rd = normalize(uTiltInv * (vW - cameraPosition));
        vec4 c = trace(ro, rd, ${lowEnd ? 120 : 170}, false);
        gl_FragColor = vec4(c.rgb, c.a) * uFade;
      }`,
    transparent: true, depthWrite: false, depthTest: false,
    blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor
  });
  const BB_SIZE = 2 * 17 * BH_SCALE;
  const bb = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), bbMat);
  bb.scale.setScalar(BB_SIZE);
  bb.frustumCulled = false;
  bhScene.add(bb);

  // 2) Versão em tela cheia (dentro do buraco negro)
  const fullMat = new THREE.ShaderMaterial({
    uniforms: { ...bhUniforms(), uCam: { value: new THREE.Vector3() }, uBasis: { value: new THREE.Matrix3() }, uTanFov: { value: Math.tan(THREE.MathUtils.degToRad(30)) }, uAspect: { value: 1 }, uShift: { value: new THREE.Vector2() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: `${BH_COMMON}
      uniform vec3 uCam; uniform mat3 uBasis; uniform float uTanFov, uAspect; uniform vec2 uShift; varying vec2 vUv;
      void main(){
        vec2 p = vUv * 2.0 - 1.0 - uShift;
        vec3 rd = normalize(uBasis * vec3(p.x * uTanFov * uAspect, p.y * uTanFov, -1.0));
        vec4 c = trace(uCam, rd, ${lowEnd ? 200 : 300}, true);
        gl_FragColor = vec4(c.rgb, 1.0);
      }`,
    depthWrite: false, depthTest: false
  });
  fullMat.uniforms.uRB.value = 42;
  const insideScene = new THREE.Scene();
  const fsq = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fullMat);
  fsq.frustumCulled = false;
  insideScene.add(fsq);
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  /* =========================================================
     Passe volumétrico: cada pixel lança um raio pelo disco
     (em meia resolução) e o resultado é somado à cena.
     modo 0: galáxia (as estrelas já são escurecidas pela poeira)
     modo 1: nebulosa (o que está atrás é coberto pela nuvem)
     ========================================================= */
  const COMP_FS = /* glsl */`
    uniform sampler2D tScene, tVol; uniform float uMode, uExposure; varying vec2 vUv;
    void main(){
      vec4 s = texture2D(tScene, vUv), v = texture2D(tVol, vUv);
      vec3 e = 1.0 - exp(-v.rgb * uExposure);
      gl_FragColor = vec4(s.rgb * mix(1.0, v.a, uMode) + e, 1.0);
    }`;
  class VolumePass extends Pass {
    constructor(cam, mat, mode, scale) {
      super();
      this.cam = cam; this.mat = mat; this.scale = scale; this.h = 1;
      this.quad = new FullScreenQuad(mat);
      this.rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
      this.comp = new THREE.ShaderMaterial({
        uniforms: { tScene: { value: null }, tVol: { value: this.rt.texture }, uMode: { value: mode }, uExposure: { value: mode ? 1.25 : 1.55 } },
        vertexShader: FSQ_VS, fragmentShader: COMP_FS, depthTest: false, depthWrite: false
      });
      this.cq = new FullScreenQuad(this.comp);
    }
    setSize(w, h) { this.h = Math.max(1, Math.round(h * this.scale)); this.rt.setSize(Math.max(1, Math.round(w * this.scale)), this.h); }
    march(renderer) {
      const u = this.mat.uniforms, cam = this.cam;
      cam.updateMatrixWorld();
      u.uInvProj.value.copy(cam.projectionMatrixInverse);
      u.uCamWorld.value.copy(cam.matrixWorld);
      u.uCamPos.value.setFromMatrixPosition(cam.matrixWorld);
      u.uPixAng.value = 2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) / this.h;
      renderer.setRenderTarget(this.rt);
      this.quad.render(renderer);
    }
    render(renderer, writeBuffer, readBuffer) {
      this.march(renderer);
      this.comp.uniforms.tScene.value = readBuffer.texture;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.cq.render(renderer);
    }
    renderInto(renderer, sceneTex, target, face) {
      this.march(renderer);
      this.comp.uniforms.tScene.value = sceneTex;
      renderer.setRenderTarget(target, face);
      this.cq.render(renderer);
    }
  }
  const VOL_SCALE = lowEnd ? 0.42 : 0.5;

  // Céu capturado do centro da galáxia (é o que a lente distorce lá dentro)
  const CUBE = lowEnd ? 256 : 512;
  const cubeRT = new THREE.WebGLCubeRenderTarget(CUBE, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 1500, cubeRT);
  const cubeTmp = new THREE.WebGLRenderTarget(CUBE, CUBE, { type: THREE.HalfFloatType });
  const cubeVol = new VolumePass(null, galMarch, 0, 0.5);
  cubeVol.setSize(CUBE, CUBE);
  cubeVol.comp.uniforms.uExposure.value = 0.45;   // visto do centro, o disco inteiro brilha: exposição menor
  function captureSky() {
    cubeCam.position.set(0, 0, 0);
    if (cubeCam.coordinateSystem !== renderer.coordinateSystem) { cubeCam.coordinateSystem = renderer.coordinateSystem; cubeCam.updateCoordinateSystem(); }
    cubeCam.updateMatrixWorld(true);
    galaxy.updateMatrixWorld(); galInv.copy(galaxy.matrixWorld).invert();
    const sv = nebStars.visible; nebStars.visible = false;
    starMat.uniforms.uCube.value = 1;
    galMarch.uniforms.uBulge.value = 0.025;
    const mo = U.uMouseOn.value; U.uMouseOn.value = 0;
    const prev = renderer.getRenderTarget();
    cubeCam.children.forEach((cam, i) => {
      renderer.setRenderTarget(cubeTmp); renderer.clear(); renderer.render(scene, cam);
      cubeVol.cam = cam;
      cubeVol.renderInto(renderer, cubeTmp.texture, cubeRT, i);
    });
    renderer.setRenderTarget(prev);
    U.uMouseOn.value = mo;
    starMat.uniforms.uCube.value = 0;
    galMarch.uniforms.uBulge.value = 1;
    nebStars.visible = sv;
    fullMat.uniforms.uEnv.value = cubeRT.texture;
    fullMat.uniforms.uHasEnv.value = 1;
  }

  /* =========================================================
     Pós-processamento: volume + lente gravitacional + brilho (bloom)
     ========================================================= */
  const LensShader = {
    uniforms: { tDiffuse: { value: null }, uCenter: { value: new THREE.Vector2(0.5, 0.5) }, uR: { value: 0.05 }, uAspect: { value: 1 }, uOn: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uCenter; uniform float uR, uAspect, uOn; varying vec2 vUv;
      void main(){
        vec2 d = vUv - uCenter; d.x *= uAspect;
        float r2 = max(dot(d, d), 1e-7);
        float k = min(uR * uR / r2, 3.0) * uOn;
        vec2 s = d * (1.0 - k); s.x /= uAspect;
        gl_FragColor = texture2D(tDiffuse, uCenter + s);
      }`
  };
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const volG = new VolumePass(camera, galMarch, 0, VOL_SCALE);
  composer.addPass(volG);
  const nebG = new VolumePass(camera, nebMarch, 1, VOL_SCALE);
  composer.addPass(nebG);
  const nebStarsG = new RenderPass(nebStarScene, camera); nebStarsG.clear = false;
  composer.addPass(nebStarsG);
  const lensPass = new ShaderPass(LensShader);
  composer.addPass(lensPass);
  const bhPass = new RenderPass(bhScene, camera);
  bhPass.clear = false;
  composer.addPass(bhPass);
  const BLOOM = 0.55;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.55, 0.62);
  composer.addPass(bloom);

  const composerIn = new EffectComposer(renderer);
  composerIn.addPass(new RenderPass(insideScene, orthoCam));
  const bloomIn = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.55);
  composerIn.addPass(bloomIn);

  // sistema: a galáxia vista de dentro, os planetas, e a nebulosa por cima
  const composerSys = new EffectComposer(renderer);
  composerSys.addPass(new RenderPass(scene, bgCam));
  const volS = new VolumePass(bgCam, galMarch, 0, VOL_SCALE);
  volS.comp.uniforms.uExposure.value = 2.3;     // de dentro do disco a faixa da galáxia é mais fraca
  composerSys.addPass(volS);
  const sysPass = new RenderPass(sysScene, sysCam);
  sysPass.clear = false; sysPass.clearDepth = true;
  composerSys.addPass(sysPass);
  const nebS = new VolumePass(bgCam, nebMarch, 1, VOL_SCALE);
  composerSys.addPass(nebS);
  const nebStarsS = new RenderPass(nebStarScene, bgCam); nebStarsS.clear = false;
  composerSys.addPass(nebStarsS);
  const BLOOM_SYS = 0.8;
  const bloomSys = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM_SYS, 0.55, 0.58);
  composerSys.addPass(bloomSys);

  /* ---------- Tamanho ---------- */
  let W = 1, H = 1, viewShift = 0, viewShiftTo = 0, viewShiftY = 0, viewShiftYTo = 0;
  const CAMS = [camera, sysCam, bgCam];
  function applyView() {
    CAMS.forEach(c => {
      if (Math.abs(viewShift) > 0.001 || Math.abs(viewShiftY) > 0.001) c.setViewOffset(W, H, -viewShift * W, viewShiftY * H, W, H);
      else c.clearViewOffset();
      c.updateProjectionMatrix();
    });
  }
  function resize() {
    W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
    // tela em pé: a câmera inicial fica mais longe para a galáxia caber
    HOME_POS.copy(HOME_BASE).multiplyScalar(clamp(1.25 / (W / H), 1, 1.9));
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pr); composer.setSize(W, H);
    composerSys.setPixelRatio(pr); composerSys.setSize(W, H);
    composerIn.setPixelRatio(pr * insideScale); composerIn.setSize(W, H);
    CAMS.forEach(c => (c.aspect = W / H));
    applyView();
    U.uPR.value = pr;
    lensPass.uniforms.uAspect.value = W / H;
    fullMat.uniforms.uAspect.value = W / H;
    // desloca o buraco negro para longe do painel: à direita no desktop, para cima no celular
    fullMat.uniforms.uShift.value.set(W > 1100 ? 0.22 : 0, W <= 760 ? 0.42 : 0);
    viewShiftTo = targetShift(); viewShiftYTo = targetShiftY();
  }
  // no celular os painéis ficam embaixo: a cena sobe
  const targetShiftY = () => (W > 760 ? 0 : (mode === 'system' || mode === 'focus') ? 0.24 : mode === 'galaxy' ? -0.06 : 0);
  const targetShift = () => (mode === 'galaxy' && W > 1100 ? 0.12 : mode === 'system' && W > 1100 ? 0.1 : mode === 'focus' && W > 760 ? -0.1 : 0);
  let insideScale = lowEnd ? 0.55 : 0.8;
  addEventListener('resize', resize);

  /* =========================================================
     Interação
     ========================================================= */
  let mode = 'galaxy';                   // galaxy | travel | system | focus | inside | warp
  let view = 'galaxy';                   // o que está sendo desenhado: galaxy | system | inside
  let active = html.classList.contains('intro-on');
  let hoverIdx = -1, hoverBH = false, hoverArm = null, focusIdx = -1;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const mouseTarget = new THREE.Vector3(999, 0, 999);
  let pointerIn = false, down = null, dragged = false;

  const BUBBLE = {
    galaxy: 'Oi! <b>Clique em um braço</b> da galáxia para viajar até o sistema dos temas, ou entre no buraco negro do centro.',
    travel: 'Segura firme: vamos <b>entrar no braço</b> da galáxia e atravessar uma nebulosa cheia de estrelas novas.',
    system: 'Chegamos! <b>Clique em um planeta</b> para ver o tema que ele guarda.',
    focus: 'Este planeta guarda um tema. Clique em <b>Ir para este tema</b> para pular direto para ele.',
    inside: '<b>Arraste</b> para dar a volta no buraco negro e clique nas partes para entender cada uma.'
  };
  const HINT = {
    galaxy: 'Arraste para girar · roda do mouse para aproximar',
    system: 'Arraste para girar o sistema · roda do mouse para aproximar',
    focus: 'Arraste para girar em volta do planeta'
  };
  function setMode(m) {
    mode = m;
    root.classList.remove('mode-galaxy', 'mode-travel', 'mode-system', 'mode-focus', 'mode-inside', 'mode-warp');
    root.classList.add(`mode-${m}`);
    viewShiftTo = targetShift(); viewShiftYTo = targetShiftY();
    $('#gx-hero').hidden = m !== 'galaxy';
    $('#gx-sys').hidden = m !== 'system';
    $('#gx-planet').hidden = m !== 'focus';
    $('#gx-bh').hidden = m !== 'inside';
    if (BUBBLE[m]) $('#gx-bubble').innerHTML = BUBBLE[m];
    $('#gx-hint').textContent = HINT[m] || '';
  }

  // ponto do braço mais próximo (em coordenadas da galáxia), ou null
  function armAt(local) {
    const r = Math.hypot(local.x, local.z);
    if (r < 2.3 || r > 12.2) return null;
    const th = Math.atan2(local.z, local.x);
    let best = 1e9, bk = 0;
    for (let k = 0; k < 2; k++) {
      let d = th - armAngle(r, k);
      d = ((d + Math.PI) % TAU + TAU) % TAU - Math.PI;
      if (Math.abs(d) * r < best) { best = Math.abs(d) * r; bk = k; }
    }
    if (best > Math.max(1.5, 0.3 * r)) return null;
    const a = armAngle(r, bk);
    return new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  function updateHover() {
    hoverBH = false; hoverArm = null; hoverIdx = -1;
    mouseTarget.set(999, 0, 999);
    if (pointerIn && mode === 'galaxy') {
      ray.setFromCamera(ndc, camera);
      hoverBH = ray.ray.distanceSqToPoint(ORIGIN) < (7 * BH_SCALE) ** 2;
      if (ray.ray.intersectPlane(plane, hit)) {
        const local = galaxy.worldToLocal(hit.clone());
        mouseTarget.copy(local);
        if (!hoverBH) hoverArm = armAt(local);
      }
    } else if (mode === 'system' || mode === 'focus') {
      if (pointerIn) {
        ray.setFromCamera(ndc, sysCam);
        const h = ray.intersectObjects(planetMeshes, false);
        if (h.length) hoverIdx = h[0].object.userData.i;
      }
      if (hoverIdx < 0) hoverIdx = labelHover;
    }
    canvas.classList.toggle('point', hoverIdx >= 0 || hoverBH || !!hoverArm);
  }
  const setNdc = e => ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);

  canvas.addEventListener('pointermove', e => {
    pointerIn = true; setNdc(e);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragged = true;
    if (mode === 'inside' && down) {
      insideCam.az -= (e.clientX - down.lx) * 0.006;
      insideCam.el = clamp(insideCam.el + (e.clientY - down.ly) * 0.005, -1.45, 1.45);
      down.lx = e.clientX; down.ly = e.clientY;
    }
  });
  canvas.addEventListener('pointerleave', () => { pointerIn = false; });
  canvas.addEventListener('pointerdown', e => {
    pointerIn = true; setNdc(e);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }; dragged = false;
    canvas.classList.add('drag');
    if (mode === 'inside') canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointerup', e => {
    canvas.classList.remove('drag');
    if (down && !dragged) {
      setNdc(e); pointerIn = true; updateHover();
      if (mode === 'galaxy') {
        if (hoverBH) enterBH();
        else if (hoverArm) travelTo(hoverArm);
      } else if ((mode === 'system' || mode === 'focus') && hoverIdx >= 0) focusPlanet(hoverIdx);
    }
    down = null;
  });
  canvas.addEventListener('pointercancel', () => { down = null; canvas.classList.remove('drag'); });
  canvas.addEventListener('wheel', e => {
    if (mode !== 'inside') return;
    e.preventDefault();
    setDist(insideCam.dist * Math.exp(e.deltaY * 0.0012));
  }, { passive: false });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !active || !html.classList.contains('intro-on')) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
    if (mode === 'focus') backToSystem();
    else if (mode === 'system') backToGalaxy();
    else if (mode === 'inside') exitBH();
  });

  /* ---------- Voo de câmera (genérico) ---------- */
  let fly = null;
  function flyRig(cam, ctrl, pos, target, ms, done, follow) {
    fly = { cam, ctrl, p0: cam.position.clone(), t0: ctrl.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), ms: reduce ? 1 : ms, done, follow };
    ctrl.enabled = false; ctrl.autoRotate = false;
  }
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const tmpF = new THREE.Vector3();
  function stepFly() {
    const t = Math.min(1, (performance.now() - fly.start) / fly.ms), k = ease(t);
    fly.cam.position.lerpVectors(fly.p0, fly.p1, k);
    if (fly.follow) { fly.follow(tmpF); fly.ctrl.target.lerpVectors(fly.t0, tmpF, k); }
    else fly.ctrl.target.lerpVectors(fly.t0, fly.t1, k);
    fly.cam.lookAt(fly.ctrl.target);
    if (t >= 1) { const d = fly.done; fly = null; d && d(); }
  }
  function flash(kind) {
    const f = $('#gx-flash');
    f.classList.remove('go', 'neb'); void f.offsetWidth;
    if (kind) f.classList.add(kind);
    f.classList.add('go');
  }

  /* =========================================================
     Viagem: braço da galáxia → nebulosa → sistema planetário
     Um único movimento de câmera, sem corte:
     1. a câmera sobrevoa o braço e mergulha no disco;
     2. entra na nebulosa, que fica no meio do braço;
     3. dentro da nebulosa, a câmera da galáxia passa o controle
        para a do sistema exatamente na mesma posição, direção e
        velocidade; a galáxia continua desenhada ao fundo;
     4. a câmera sai da nebulosa e se aproxima do sol.
     ========================================================= */
  const SYS_SCALE = 0.0035;              // 1 unidade do sistema = 0,0035 unidade da galáxia
  const ARRIVE_D = 400;                  // a câmera do sistema começa dentro da nebulosa
  const T_IN = 6.8, T_ARR = 5.2, T_LEAVE = 3.0, T_OUT = 5.2;   // segundos
  const LY = 3.85;                       // mil anos-luz por unidade da galáxia
  let trip = null;
  // tempo da curva: começa parado e chega com velocidade m1 (para emendar com a fase seguinte)
  const hermite = (t, m1) => -2 * t * t * t + 3 * t * t + m1 * (t * t * t - t * t);
  function tripCurve(start, Q, F) {
    const A = Q.clone().addScaledVector(F, -5.5).addScaledVector(UP, 3.4);
    const B = Q.clone().addScaledVector(F, -2.1).addScaledVector(UP, 0.62);
    const pts = [start.clone()];
    if (start.distanceTo(Q) > A.distanceTo(Q) + 1) pts.push(A);
    pts.push(B, Q.clone().addScaledVector(F, -0.9), Q.clone());
    const c = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    c.arcLengthDivisions = 500;
    return c;
  }
  function travelTo(localP) {
    if (mode !== 'galaxy') return;
    focusIdx = -1; fly = null;
    galaxy.updateMatrixWorld();
    const P = galaxy.localToWorld(localP.clone());
    const rOut = P.clone().setY(0).normalize();
    const th = new THREE.Vector3(-rOut.z, 0, rOut.x);
    // olha ao longo do braço, em direção ao centro: o bojo fica de lado, à vista
    const hF = rOut.clone().negate().addScaledVector(th, -0.55).normalize();
    const F = hF.clone().addScaledVector(UP, -0.05).normalize();
    const Q = P.clone().addScaledVector(UP, 0.2).addScaledVector(hF, -0.25);
    const S = Q.clone().addScaledVector(F, ARRIVE_D * SYS_SCALE);
    const Cn = Q.clone().addScaledVector(F, 0.12);
    placeNebula(Cn); setNebula(true);
    const curve = tripCurve(camera.position, Q, F);
    const L = curve.getLength();
    const a1 = sysHomePos(hF);
    const vArr = 3 * a1.distanceTo(F.clone().multiplyScalar(-ARRIVE_D)) * SYS_SCALE / T_ARR;   // velocidade inicial da chegada
    trip = {
      P, Q, F, hF, S, Cn, curve, L, a1, rKly: Math.round(Math.hypot(localP.x, localP.z) * LY),
      m1: clamp(vArr * T_IN / L, 0.04, 1.6),
      phase: 'in', t0: performance.now(), ms: reduce ? 1 : T_IN * 1000,
      T0: controls.target.clone(), q0: camera.quaternion.clone(), tilt: 0, R: new THREE.Vector3().crossVectors(hF, UP).normalize(), inNeb: false, sawNeb: false
    };
    controls.enabled = false; controls.autoRotate = false;
    setMode('travel');
    caption('arm', 'Viagem · braço espiral', 'Entrando no braço da galáxia', `a ${trip.rKly} mil anos-luz do centro`);
  }
  function sysHomePos(hF = trip.hF) {
    const d = clamp(40 / (Math.tan(THREE.MathUtils.degToRad(25)) * Math.min(W / H, 1.6)), 60, 150);
    return hF.clone().multiplyScalar(-Math.cos(0.45)).addScaledVector(UP, Math.sin(0.45)).multiplyScalar(d);
  }
  function startArrival() {
    view = 'system';
    trip.phase = 'arrive'; trip.t0 = performance.now(); trip.ms = reduce ? 1 : T_ARR * 1000;
    trip.a0 = trip.F.clone().multiplyScalar(-ARRIVE_D);
    trip.a1 = sysHomePos();
    trip.tilt = 0;
    sysCam.position.copy(trip.a0); sysCam.lookAt(ORIGIN);
    sysControls.target.set(0, 0, 0);
    sysControls.minDistance = 10;
    PLANETS.forEach(p => p.label.classList.remove('on'));
  }
  function backToGalaxy() {
    if (view !== 'system' || mode === 'travel' || mode === 'warp' || !trip) return;
    focusIdx = -1; fly = null;
    PLANETS.forEach(p => p.label.classList.remove('on'));
    sysControls.enabled = false; sysControls.autoRotate = false;
    trip.phase = 'leave'; trip.t0 = performance.now(); trip.ms = reduce ? 1 : T_LEAVE * 1000;
    trip.l0 = sysCam.position.clone(); trip.tilt0 = trip.tilt;
    trip.a0 = trip.F.clone().multiplyScalar(-ARRIVE_D);
    setMode('travel');
    $('#gx-bubble').innerHTML = 'Voltando: vamos <b>sair do sistema</b>, atravessar a nebulosa e ver a galáxia inteira de novo.';
    caption('leave', 'De volta', 'Saindo do sistema dos temas', 'pela nebulosa, até ver a galáxia inteira');
  }
  function startOut() {
    view = 'galaxy';
    const { Q, F } = trip;
    trip.curve = tripCurve(HOME_POS, Q, F);
    trip.L = trip.curve.getLength();
    const vLeave = 3 * trip.l0.distanceTo(trip.a0) * SYS_SCALE / T_LEAVE;
    trip.m1 = clamp(vLeave * T_OUT / trip.L, 0.04, 1.6);
    trip.phase = 'out'; trip.t0 = performance.now(); trip.ms = reduce ? 1 : T_OUT * 1000;
    camera.position.copy(Q); camera.lookAt(tmpT.copy(Q).addScaledVector(F, 3));
  }
  const tmpT = new THREE.Vector3(), tmpA = new THREE.Vector3(), qTilt = new THREE.Quaternion();
  const SYS_TILT = 0.44;
  function stepTrip() {
    const t = clamp((performance.now() - trip.t0) / trip.ms, 0, 1);
    if (trip.phase === 'in') {
      const u = clamp(hermite(t, trip.m1), 0, 1);
      trip.curve.getPointAt(u, camera.position);
      // olhar: do centro para o braço, depois para a frente, ao longo do braço
      const w1 = sstep(0, 0.32, t), w2 = sstep(0.42, 0.97, t);
      tmpT.lerpVectors(trip.T0, trip.P, w1).lerp(tmpA.copy(trip.Q).addScaledVector(trip.F, 3), w2);
      camera.lookAt(tmpT); controls.target.copy(tmpT);
      setStarView(1 - clamp((camera.position.distanceTo(trip.Q) - 0.6) / 9, 0, 1));
      if (t >= 1) { camera.position.copy(trip.Q); camera.lookAt(tmpT.copy(trip.Q).addScaledVector(trip.F, 3)); startArrival(); }
    } else if (trip.phase === 'arrive') {
      const k = 1 - Math.pow(1 - t, 3);
      sysCam.position.lerpVectors(trip.a0, trip.a1, k);
      sysCam.lookAt(ORIGIN);
      trip.tilt = SYS_TILT * ease(t);
      if (t > 0.42) caption('sys', 'Destino', 'Sistema dos temas', '8 planetas, um para cada tema da apresentação', 4200);
      if (t >= 1) {
        trip.phase = null;
        sysControls.enabled = true; sysControls.autoRotate = !reduce; sysControls.update();
        setMode('system');
      }
    } else if (trip.phase === 'leave') {
      const k = t * t * t;
      sysCam.position.lerpVectors(trip.l0, trip.a0, k);
      sysCam.lookAt(ORIGIN);
      trip.tilt = trip.tilt0 * (1 - ease(t));
      if (t >= 1) startOut();
    } else if (trip.phase === 'out') {
      // a câmera recua pelo mesmo caminho, olhando para trás, e termina vendo a galáxia inteira
      const u = clamp(hermite(1 - t, trip.m1), 0, 1);
      trip.curve.getPointAt(u, camera.position);
      const w = sstep(0.25, 1, t);
      tmpT.copy(trip.Q).addScaledVector(trip.F, 3 * (1 - sstep(0, 0.3, t))).lerp(ORIGIN, w);
      camera.lookAt(tmpT); controls.target.copy(tmpT);
      setStarView(1 - clamp((camera.position.distanceTo(trip.Q) - 0.6) / 9, 0, 1));
      if (t > 0.5) caption('gal', 'A galáxia', `${N.toLocaleString('pt-BR')} estrelas`, 'clique em outro braço para viajar de novo', 3000);
      if (t >= 1) {
        trip = null; setNebula(false); setStarView(0);
        camera.position.copy(HOME_POS);
        controls.target.set(0, 0, 0); controls.enabled = true; controls.autoRotate = !reduce; controls.update();
        setMode('galaxy');
      }
    }
  }

  /* ---------- Planetas: foco e volta ---------- */
  const planetPos = (p, out = new THREE.Vector3()) => out.set(Math.cos(p.phase) * p.r, 0, Math.sin(p.phase) * p.r);
  function focusPlanet(i) {
    if (view !== 'system' || mode === 'travel' || mode === 'warp') return;
    const p = PLANETS[i];
    focusIdx = i;
    const pp = planetPos(p);
    const out = pp.clone().normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const k = p.ring ? 8.2 : 6.6;
    const camPos = pp.clone().addScaledVector(out, p.size * k).addScaledVector(side, p.size * k * 0.45).addScaledVector(UP, p.size * k * 0.38);
    flyRig(sysCam, sysControls, camPos, pp, 1700, () => { sysControls.enabled = true; sysControls.minDistance = p.size * 2.2; }, o => planetPos(p, o));
    setMode('focus');
    hideCaption();
    const ico = $('#gxp-ico');
    ico.style.setProperty('--c1', p.cols[0]); ico.style.setProperty('--c2', p.cols[2]);
    ico.innerHTML = iconSvg(p.icon);
    $('#gxp-tag').textContent = p.tag;
    $('#gxp-title').textContent = p.name;
    $('#gxp-text').textContent = p.text;
    $('#gxp-facts').innerHTML = p.facts.map(([ic, t]) => `<span>${iconSvg(ic)}${t}</span>`).join('');
    PLANETS.forEach((q, k) => q.label.classList.toggle('on', k === i));
  }
  function backToSystem() {
    if (mode !== 'focus') return;
    focusIdx = -1;
    PLANETS.forEach(q => q.label.classList.remove('on'));
    sysControls.minDistance = 10;
    setMode('system');
    flyRig(sysCam, sysControls, sysHomePos(), ORIGIN, 1700, () => { sysControls.enabled = true; sysControls.autoRotate = !reduce; });
  }
  $('#gxp-close').addEventListener('click', backToSystem);
  $('#gxp-back').addEventListener('click', backToSystem);
  $('#gxs-back').addEventListener('click', backToGalaxy);
  $('#gxs-close').addEventListener('click', backToGalaxy);
  $('#gxp-go').addEventListener('click', e => {
    if (focusIdx < 0) return;
    window.dispatchEvent(new CustomEvent('galaxy:goto', { detail: { slide: PLANETS[focusIdx].slide, from: e.currentTarget } }));
  });

  /* ---------- Entrar e sair do buraco negro ---------- */
  const insideCam = { az: 0, el: 0.2, dist: 20 };
  const DIST_MIN = 1.9, DIST_MAX = 40;
  const distFromSlider = v => DIST_MIN * Math.pow(DIST_MAX / DIST_MIN, v / 1000);
  const sliderFromDist = d => Math.round(1000 * Math.log(d / DIST_MIN) / Math.log(DIST_MAX / DIST_MIN));
  function setDist(d) {
    insideCam.dist = clamp(d, DIST_MIN, DIST_MAX);
    $('#gxb-dist').value = sliderFromDist(insideCam.dist);
    depthText();
  }
  function depthText() {
    const d = insideCam.dist;
    $('#gxb-dist-v').textContent = `${d.toFixed(d < 10 ? 1 : 0).replace('.', ',')} rs`;
    const el = $('#gxb-depth');
    let t, calm = true;
    if (d > 12) t = 'Você está a uma distância segura. A luz das estrelas atrás do buraco negro chega até você, só que curvada.';
    else if (d > 3) { t = 'Você está dentro do disco de acreção: gás a milhões de graus girando em volta. A gravidade aqui já seria fatal.'; calm = false; }
    else if (d > 1.5) { t = 'Você passou da esfera de fótons: a luz pode dar voltas no buraco negro. Quase todo o céu virou sombra.'; calm = false; }
    else { t = 'Você está quase no horizonte de eventos. Daqui para dentro, nem a luz escapa.'; calm = false; }
    el.textContent = t; el.classList.toggle('calm', calm);
  }
  $('#gxb-dist').addEventListener('input', e => { stopDive(); setDist(distFromSlider(+e.target.value)); });
  let dive = 0;
  function stopDive() { dive = 0; $('#gxb-dive').classList.remove('on'); }
  $('#gxb-dive').addEventListener('click', () => {
    if (dive) { stopDive(); return; }
    dive = insideCam.dist <= DIST_MIN + 0.05 ? -1 : 1;
    $('#gxb-dive').classList.add('on');
  });

  const PARTS = {
    1: '<b>Horizonte de eventos.</b> A fronteira de onde nada volta, nem a luz. A sombra preta que você vê é cerca de 2,6 vezes maior que o horizonte, porque a luz que passa perto demais também é engolida.',
    2: '<b>Esfera de fótons.</b> A 1,5 vez o raio do horizonte, a luz consegue orbitar o buraco negro. É o anel fino e brilhante bem na borda da sombra.',
    3: '<b>Disco de acreção.</b> Gás e poeira girando a quase metade da velocidade da luz, aquecidos a milhões de graus. Eles brilham antes de cair.',
    4: '<b>Lente gravitacional.</b> A gravidade curva a luz. Por isso você enxerga a parte de trás do disco por cima e por baixo da sombra (em lilás), e as estrelas do fundo aparecem distorcidas.',
    5: '<b>Efeito Doppler.</b> O lado do disco que vem na sua direção fica mais claro e azulado; o lado que se afasta fica mais escuro e avermelhado.'
  };
  const partsBox = $('#gxb-parts');
  function setPart(k) {
    const cur = fullMat.uniforms.uHighlight.value;
    const v = cur === k ? 0 : k;
    fullMat.uniforms.uHighlight.value = v;
    [...partsBox.children].forEach(b => b.classList.toggle('on', +b.dataset.part === v));
    $('#gxb-text').innerHTML = v ? PARTS[v] : 'Cada pixel desta imagem é um raio de luz calculado de trás para frente. Escolha uma parte acima para destacá-la.';
  }
  partsBox.addEventListener('click', e => { const b = e.target.closest('[data-part]'); if (b) setPart(+b.dataset.part); });
  const bindToggle = (id, key) => $(id).addEventListener('change', e => { fullMat.uniforms[key].value = e.target.checked ? 1 : 0; bbMat.uniforms[key].value = e.target.checked ? 1 : 0; });
  bindToggle('#gxb-lens', 'uLens'); bindToggle('#gxb-disk', 'uDisk'); bindToggle('#gxb-doppler', 'uDoppler');

  function enterBH() {
    if (mode !== 'galaxy') return;
    setMode('warp');
    hideCaption();
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (Math.abs(dir.y) < 0.15) dir.y = 0.15;
    dir.normalize();
    const near = dir.clone().multiplyScalar(26 * BH_SCALE);
    flyRig(camera, controls, near, ORIGIN, 2200, () => {
      flash();
      setTimeout(() => {
        captureSky();
        const local = near.clone().divideScalar(BH_SCALE).applyMatrix3(TILT_INV);
        const d0 = W / H < 0.8 ? 34 : 22; // tela em pé: começa mais longe para caber o disco
        insideCam.dist = d0; setDist(d0);
        insideCam.az = Math.atan2(local.x, local.z);
        insideCam.el = clamp(Math.asin(clamp(local.y / local.length(), -1, 1)), 0.1, 0.22);
        setPart(0); fullMat.uniforms.uHighlight.value = 0;
        view = 'inside';
        setMode('inside');
        canvas.focus({ preventScroll: true });
      }, reduce ? 0 : 260);
    });
  }
  function exitBH() {
    if (mode !== 'inside') return;
    stopDive();
    flash();
    const local = new THREE.Vector3(Math.sin(insideCam.az) * Math.cos(insideCam.el), Math.sin(insideCam.el), Math.cos(insideCam.az) * Math.cos(insideCam.el)).multiplyScalar(Math.max(insideCam.dist, 14));
    const world = local.applyMatrix3(TILT).multiplyScalar(BH_SCALE);
    camera.position.copy(world); controls.target.set(0, 0, 0); camera.lookAt(ORIGIN);
    view = 'galaxy';
    setMode('galaxy');
    flyRig(camera, controls, HOME_POS, ORIGIN, 2200, () => { controls.enabled = true; controls.autoRotate = !reduce; });
  }
  $('#gx-enter').addEventListener('click', enterBH);
  $('#gxb-exit').addEventListener('click', exitBH);
  $('#gxb-close').addEventListener('click', exitBH);

  /* ---------- Salto para a apresentação (botão Iniciar) ---------- */
  let warpT = -1, warpResolve = null;
  function warp() {
    return new Promise(res => {
      if (!active || reduce || mode === 'travel' || view === 'inside') { res(); return; }
      setMode('warp');
      hideCaption();
      warpT = 0; warpResolve = res;
      if (view === 'system') flyRig(sysCam, sysControls, sysCam.position.clone().multiplyScalar(0.12), ORIGIN, 1100);
      else {
        const dir = camera.position.clone().sub(controls.target).normalize();
        flyRig(camera, controls, controls.target.clone().addScaledVector(dir, 2.5), controls.target.clone(), 1100);
      }
    });
  }
  function resetView() {
    fly = null; trip = null; warpT = -1; U.uWarp.value = 0;
    bloom.strength = BLOOM; bloomSys.strength = BLOOM_SYS;
    focusIdx = -1; PLANETS.forEach(q => q.label.classList.remove('on'));
    view = 'galaxy'; setNebula(false); setStarView(0); hideCaption();
    sysControls.enabled = false;
    camera.position.copy(HOME_POS); controls.target.set(0, 0, 0);
    controls.enabled = true; controls.autoRotate = !reduce; controls.minDistance = 3.2;
    stopDive();
    setMode('galaxy');
    controls.update();
  }

  /* =========================================================
     Loop principal
     ========================================================= */
  const clock = new THREE.Clock();
  let raf = 0, frames = 0, fpsT = 0, slowFrames = 0, lastFps = 0;
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), camRight = new THREE.Vector3();
  const basis = new THREE.Matrix4();

  function place(el, world, cam, dy) {
    tmp.copy(world).project(cam);
    const vis = tmp.z < 1 && Math.abs(tmp.x) < 1.08 && Math.abs(tmp.y) < 1.08;
    el.classList.toggle('off', !vis);
    if (vis) el.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp.y) / 2) * H}px)${dy}`;
    return vis;
  }
  function updateGalaxyLabels() {
    const g = mode === 'galaxy';
    PLANETS.forEach(p => p.label.classList.add('off'));
    tmp.set(0, 0, 0).project(camera);
    const bv = g && camera.position.length() > 5 && tmp.z < 1;
    bhLabel.classList.toggle('off', !bv);
    if (bv) {
      camRight.setFromMatrixColumn(camera.matrixWorld, 1);
      tmp2.copy(camRight).multiplyScalar(13 * BH_SCALE).project(camera);
      bhLabel.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp2.y) / 2) * H}px) translate(-50%, -150%)`;
    }
    if (g) place(pinLabel, galaxy.localToWorld(tmp2.copy(pinLocal)), camera, ' translate(-50%, -140%)');
    else pinLabel.classList.add('off');
    if (g && hoverArm) {
      const w = galaxy.localToWorld(hoverArm.clone());
      place(reticle, w, camera, '');
      place(armLabel, w, camera, ' translate(-50%, -175%)');
    } else { reticle.classList.add('off'); armLabel.classList.add('off'); }
  }
  function updateSystem(dt) {
    PLANETS.forEach((p, i) => {
      if (i !== focusIdx && !reduce) p.phase += p.speed * dt;
      planetPos(p, p.group.position);
      p.mesh.rotation.y += p.spin * dt;
      const h = (i === hoverIdx || i === focusIdx) ? 1 : 0;
      p.hover += (h - p.hover) * Math.min(1, dt * 8);
      p.mat.uniforms.uHover.value = p.hover;
      p.group.scale.setScalar(1 + p.hover * 0.12);
    });
    belt.rotation.y += dt * 0.01;
    sun.rotation.y += dt * 0.04;
    const showL = mode === 'system' || mode === 'focus' || (mode === 'travel' && trip && trip.phase === 'arrive' && (performance.now() - trip.t0) > trip.ms * 0.45);
    PLANETS.forEach(p => {
      if (!showL) { p.label.classList.add('off'); return; }
      tmp2.copy(p.group.position); tmp2.y += p.size * 1.3;
      place(p.label, tmp2, sysCam, ' translate(-50%, -140%)');
    });
    [bhLabel, pinLabel, reticle, armLabel].forEach(el => el.classList.add('off'));
  }
  // posição da câmera no espaço da galáxia (para a nebulosa, as legendas e os testes)
  const gPos = new THREE.Vector3(), gDir = new THREE.Vector3();
  function trackGalaxyCam() {
    const cam = view === 'system' ? bgCam : camera;
    cam.updateMatrixWorld();
    gPos.setFromMatrixPosition(cam.matrixWorld);
    cam.getWorldDirection(gDir);
    if (trip) {
      const inN = nebOn && gPos.distanceTo(trip.Cn) < NEB_R * 0.95;
      if (inN && !trip.inNeb && trip.phase !== 'leave' && trip.phase !== 'out') caption('neb', 'Nebulosa de emissão', 'Um berçário de estrelas', 'o hidrogênio brilha em rosa; o oxigênio, em verde-azulado', 3400);
      trip.inNeb = inN; trip.sawNeb = trip.sawNeb || inN;
    }
    if (rec) rec.push({ t: performance.now(), view, mode, phase: trip ? trip.phase : null, p: gPos.toArray(), d: gDir.toArray(), inNeb: !!(trip && trip.inNeb) });
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduce) U.uTime.value += dt;

    // FPS e qualidade adaptativa
    frames++; fpsT += dt;
    if (fpsT > 1) {
      const fps = Math.round(frames / fpsT);
      lastFps = fps;
      $('#gx-fps').textContent = `${fps} fps`;
      if (fps < 30) slowFrames++; else slowFrames = 0;
      if (slowFrames >= 2) {
        slowFrames = 0;
        if (view === 'inside' && insideScale > 0.4) { insideScale = Math.max(0.4, insideScale - 0.15); resize(); }
        else if (view !== 'inside' && pr > 0.75) { pr = Math.max(0.75, pr - 0.25); resize(); }
      }
      frames = 0; fpsT = 0;
    }

    if (fly) stepFly();
    if (trip && trip.phase) stepTrip();
    if (warpT >= 0) {
      warpT += dt;
      const k = Math.min(1, warpT / 1.0);
      U.uWarp.value = k * k;
      if (view === 'system') bloomSys.strength = BLOOM_SYS + k * 1.6; else bloom.strength = BLOOM + k * 1.6;
      if (warpT > 0.95 && warpResolve) { const r = warpResolve; warpResolve = null; r(); }
    }

    viewShift += (viewShiftTo - viewShift) * Math.min(1, dt * 3);
    viewShiftY += (viewShiftYTo - viewShiftY) * Math.min(1, dt * 3);
    if (view !== 'inside') applyView();
    galaxy.updateMatrixWorld();
    galInv.copy(galaxy.matrixWorld).invert();
    nebG.enabled = nebS.enabled = nebStarsG.enabled = nebStarsS.enabled = nebOn;

    if (view === 'inside') {
      if (dive) {
        setDist(insideCam.dist * Math.exp(-dive * dt * 0.35));
        if (insideCam.dist <= DIST_MIN + 0.001 || insideCam.dist >= DIST_MAX - 0.01) stopDive();
      }
      if (!down && !reduce) insideCam.az += dt * 0.04;
      const c = insideCam;
      const pos = new THREE.Vector3(Math.sin(c.az) * Math.cos(c.el), Math.sin(c.el), Math.cos(c.az) * Math.cos(c.el)).multiplyScalar(c.dist);
      const fwd = pos.clone().negate().normalize();
      const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
      const upv = new THREE.Vector3().crossVectors(right, fwd);
      basis.makeBasis(right, upv, fwd.clone().negate());
      fullMat.uniforms.uBasis.value.setFromMatrix4(basis);
      fullMat.uniforms.uCam.value.copy(pos);
      composerIn.render(dt);
      afterRender();
      return;
    }

    if (view === 'system') {
      if (sysControls.enabled) sysControls.update();
      updateHover();
      updateSystem(dt);
      // a galáxia de fundo é vista do ponto do braço onde o sistema está
      // o plano do sistema é inclinado em relação à galáxia: olhando o sistema
      // de cima, a câmera de fundo continua vendo o braço e o centro da galáxia
      if (trip) {
        qTilt.setFromAxisAngle(trip.R, trip.tilt);
        bgCam.position.copy(sysCam.position).applyQuaternion(qTilt).multiplyScalar(SYS_SCALE).add(trip.S);
        bgCam.quaternion.copy(qTilt).multiply(sysCam.quaternion);
      }
      trackGalaxyCam();
      composerSys.render(dt);
      afterRender();
      return;
    }

    if (mode === 'galaxy' && !reduce) galaxy.rotation.y -= dt * 0.022;
    if (controls.enabled) controls.update();
    updateHover();
    U.uMouse.value.lerp(mouseTarget.x > 900 ? U.uMouse.value : mouseTarget, Math.min(1, dt * 10));
    U.uMouseOn.value += ((pointerIn && mouseTarget.x < 900 && mode === 'galaxy' ? 1 : 0) - U.uMouseOn.value) * Math.min(1, dt * 5);

    // buraco negro e lente
    camera.updateMatrixWorld();
    trackGalaxyCam();
    bb.quaternion.copy(camera.quaternion);
    tmp.set(0, 0, 0).project(camera);
    lensPass.uniforms.uCenter.value.set((tmp.x + 1) / 2, (tmp.y + 1) / 2);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmp2.copy(camRight).multiplyScalar(5.2 * BH_SCALE).project(camera);
    const rE = Math.hypot((tmp2.x - tmp.x) / 2 * (W / H), (tmp2.y - tmp.y) / 2);
    // visto de dentro do disco, a poeira esconde o centro: o buraco negro some junto
    const camD = camera.position.length(), bhF = camD < 4 ? 1 : sstep(0.1, 0.26, Math.abs(camera.position.y) / camD);
    bbMat.uniforms.uFade.value = bhF; bb.visible = bhF > 0.01;
    lensPass.uniforms.uR.value = tmp.z < 1 ? rE * bhF : 0;

    updateGalaxyLabels();
    composer.render(dt);
    afterRender();
  }

  /* ---------- Ganchos de teste (só com ?teste no endereço) ---------- */
  let rec = null, statWait = null;
  function afterRender() {
    if (!statWait) return;
    const gl = renderer.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const cb = statWait; statWait = null;
    cb({ px, w, h });
  }
  function pixelStats({ px, w, h }, samplesWorld) {
    let sum = 0, n = 0, blue = 0, warm = 0, pink = 0, bright = 0;
    for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4, r = px[i], g = px[i + 1], b = px[i + 2], l = 0.3 * r + 0.55 * g + 0.15 * b;
      sum += l; n++;
      if (l > 40) { bright++; if (b > r * 1.05) blue++; else if (r > b * 1.12 && g > b) warm++; if (r > g * 1.35 && b > g) pink++; }
    }
    const at = v => {
      tmp.copy(v).project(camera);
      if (tmp.z > 1 || Math.abs(tmp.x) > 1 || Math.abs(tmp.y) > 1) return -1;
      const x = Math.round((tmp.x + 1) / 2 * (w - 1)), y = Math.round((tmp.y + 1) / 2 * (h - 1));
      let s = 0, c = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = clamp(x + dx, 0, w - 1), yy = clamp(y + dy, 0, h - 1), i = (yy * w + xx) * 4;
        s += 0.3 * px[i] + 0.55 * px[i + 1] + 0.15 * px[i + 2]; c++;
      }
      return s / c;
    };
    return { mean: sum / n, brightFrac: bright / n, blueFrac: blue / Math.max(1, bright), warmFrac: warm / Math.max(1, bright), pinkFrac: pink / Math.max(1, bright), samples: samplesWorld ? samplesWorld.map(at) : [] };
  }
  const testApi = {
    state: () => ({
      mode, view, phase: trip ? trip.phase : null, nebOn, inNeb: !!(trip && trip.inNeb), sawNeb: !!(trip && trip.sawNeb), fps: lastFps, stars: N,
      cam: gPos.toArray(), caption: cap && cap.classList.contains('on') ? cap.textContent : '',
      planetLabels: PLANETS.filter(p => !p.label.classList.contains('off')).length,
      hero: !$('#gx-hero').hidden, sysPanel: !$('#gx-sys').hidden, planetPanel: !$('#gx-planet').hidden, bhPanel: !$('#gx-bh').hidden,
      planetTitle: $('#gxp-title').textContent
    }),
    // ponto de um braço na tela (para o teste clicar como uma pessoa)
    armScreen(k, r) {
      const a = armAngle(r, k), w = galaxy.localToWorld(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)).project(camera);
      return { x: (w.x + 1) / 2 * W, y: (1 - w.y) / 2 * H, onScreen: Math.abs(w.x) < 1 && Math.abs(w.y) < 1 && w.z < 1 };
    },
    between(r) {   // ponto entre os dois braços
      const a = armAngle(r, 0) + Math.PI / 2, w = galaxy.localToWorld(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)).project(camera);
      return { x: (w.x + 1) / 2 * W, y: (1 - w.y) / 2 * H };
    },
    armAt: (x, z) => !!armAt(new THREE.Vector3(x, 0, z)),
    record(on) { if (on) { rec = []; return true; } const r = rec; rec = null; return r; },
    // estatísticas da imagem: brilho, cores e contraste ao longo de um anel (braços × entre braços)
    stats(ringR = 6) {
      return new Promise(res => {
        statWait = d => {
          const ring = [];
          for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; ring.push(galaxy.localToWorld(new THREE.Vector3(Math.cos(a) * ringR, 0, Math.sin(a) * ringR))); }
          const centre = [galaxy.localToWorld(new THREE.Vector3(0.6, 0, 0)), galaxy.localToWorld(new THREE.Vector3(-0.6, 0, 0))];
          const st = view === 'galaxy' ? pixelStats(d, ring.concat(centre)) : pixelStats(d);
          if (view === 'galaxy') { st.centre = (st.samples[96] + st.samples[97]) / 2; st.samples = st.samples.slice(0, 96); }
          res(st);
        };
      });
    }
  };

  function setActive(on) {
    active = on;
    cancelAnimationFrame(raf);
    if (on) { resetView(); resize(); clock.getDelta(); raf = requestAnimationFrame(frame); }
  }
  document.addEventListener('visibilitychange', () => {
    if (!active) return;
    if (document.hidden) cancelAnimationFrame(raf);
    else { clock.getDelta(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  });

  window.IAGalaxy = { warp, setActive };
  if (TEST) window.IAGalaxy.test = testApi;
  $('#gx-count').textContent = `${N.toLocaleString('pt-BR')} estrelas`;
  setMode('galaxy');
  setPart(0);
  depthText();
  resize();
  camera.position.copy(HOME_POS);
  controls.update();
  if (active) raf = requestAnimationFrame(frame);
}

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
