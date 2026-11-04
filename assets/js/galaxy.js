/* =========================================================
   Abertura · Galáxia + buraco negro + sistema planetário
   (three.js r170 + GLSL)
   - galáxia espiral: bojo, dois braços, aglomerados, nebulosas
     rosadas, faixas de poeira e um disco difuso de estrelas
   - clique num braço: a câmera entra na galáxia, atravessa uma
     nebulosa e chega a um sistema planetário (um planeta por tema),
     com o braço da galáxia ao fundo
   - buraco negro com raytracing: a luz é curvada pela gravidade
     (aproximação de Schwarzschild, integrando cada raio no shader)
   ========================================================= */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const root = document.getElementById('gx');
const canvas = document.getElementById('gx-canvas');
const $ = s => root.querySelector(s);
const html = document.documentElement;
const TAU = Math.PI * 2;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const lowEnd = small || (navigator.hardwareConcurrency || 8) <= 4;

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
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x05040c, 1);
  const basePR = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.6);
  let pr = basePR;
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();      // galáxia
  const bhScene = new THREE.Scene();    // buraco negro (desenhado depois da lente)
  const sysScene = new THREE.Scene();   // sistema planetário
  const HOME_BASE = new THREE.Vector3(0, 10.6, 17.4), HOME_POS = HOME_BASE.clone(), ORIGIN = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);

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
  const armAngle = (r, k) => k * Math.PI + KS * Math.log(r / R0);
  const galaxy = new THREE.Group();
  scene.add(galaxy);

  const N = reduce ? 50000 : lowEnd ? 65000 : 150000;
  const C = hex => new THREE.Color(hex);
  const PAL = {
    bulge: [C('#fff0d8'), C('#ffe2bb'), C('#ffcf96'), C('#fff6ea')],
    inner: [C('#ffe8d2'), C('#fff1e4'), C('#ffdcbc')],
    arm: [C('#c9d3ff'), C('#b6c0ff'), C('#a7a4f4'), C('#dfe6ff'), C('#9fb8ff')],
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
  function buildStars() {
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    const c = new THREE.Color(), d3 = new THREE.Vector3();
    // aglomerados de estrelas jovens (azuis) e regiões HII (rosadas) ao longo dos braços
    const CL = [];
    for (let i = 0; i < 460; i++) {
      const k = i % 2, r = 2.1 + Math.pow(rand(), 0.9) * 10.2;
      const a = armAngle(r, k) + gauss() * (0.12 + 0.03 * r) / r;
      CL.push([Math.cos(a) * r, Math.sin(a) * r, rand() < 0.26]);
    }
    for (let i = 0; i < N; i++) {
      const u = rand();
      let x, y, z, s, b;
      if (u < 0.11) {                       // bojo central, levemente achatado
        let r = 0.5 * Math.pow(-Math.log(1 - rand() * 0.9995), 1.25);
        if (r > 3.4) r = rand() * 3.4;
        d3.set(gauss(), gauss(), gauss()).normalize();
        x = d3.x * r * 1.12; y = d3.y * r * 0.55; z = d3.z * r;
        c.copy(pick(PAL.bulge)).lerp(pick(PAL.inner), Math.min(1, r / 3.4));
        b = 0.5 + 0.3 * Math.min(1, r / 1.5); s = 0.5 + rand() * 0.7;
      } else if (u < 0.55) {                // braços espirais
        const k = rand() < 0.5 ? 0 : 1;
        let r = 1.7 - Math.log(1 - rand() * 0.985) * 4.2;
        if (r > R_MAX) r = 2.2 + rand() * (R_MAX - 2.2);
        let off = gauss() * (0.24 + 0.07 * r);
        if (rand() < 0.22) off *= 2.3;
        const a = armAngle(r, k) + off / r;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * (0.05 + 0.012 * r);
        const t = clamp((r - 1.6) / 9, 0, 1);
        c.copy(pick(PAL.inner)).lerp(pick(PAL.arm), Math.pow(t, 0.7));
        b = 0.85 * (1.1 - 0.35 * t) * (0.45 + 0.55 * THREE.MathUtils.smoothstep(r, 1.7, 3.6)); s = 0.5 + Math.pow(rand(), 3) * 1.4;
        if (rand() < 0.07) { c.copy(PAL.young); s *= 1.7; b = 1.45; }
      } else if (u < 0.70) {                // aglomerados
        const cl = CL[(rand() * CL.length) | 0], sp = 0.06 + rand() * 0.08;
        x = cl[0] + gauss() * sp; z = cl[1] + gauss() * sp; y = gauss() * 0.04;
        if (cl[2]) { c.copy(PAL.hii).lerp(PAL.white, rand() * 0.3); b = 1.2; }
        else { c.copy(PAL.young).lerp(pick(PAL.arm), rand() * 0.5); b = 1.15; }
        s = 0.55 + Math.pow(rand(), 2.5) * 1.6;
      } else if (u < 0.74) {                // esporões entre os braços
        const k = rand() < 0.5 ? 0 : 1, r = 3 + rand() * 8.5;
        const a = armAngle(r, k) + 1.25 + gauss() * (0.22 + 0.04 * r) / r;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * (0.06 + 0.01 * r);
        c.copy(pick(PAL.arm)); b = 0.55; s = 0.45 + rand() * 0.8;
      } else if (u < 0.97) {                // disco difuso entre os braços
        let r = 0.8 - Math.log(1 - rand() * 0.995) * 3.6;
        if (r > R_MAX + 1) r = 1 + rand() * R_MAX;
        const a = rand() * TAU;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * (0.09 + 0.012 * r);
        c.copy(pick(PAL.disk)).lerp(pick(PAL.arm), Math.min(1, r / 14) * 0.6);
        b = 0.5; s = 0.45 + rand() * 0.6;
      } else {                              // halo esparso
        d3.set(gauss(), gauss(), gauss()).normalize();
        const r = 3 + rand() * 13;
        x = d3.x * r; y = d3.y * r * 0.45; z = d3.z * r;
        c.copy(pick(PAL.disk)); b = 0.3; s = 0.5 + rand() * 0.5;
      }
      pos.set([x, y, z], i * 3);
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = s; seed[i] = rand();
    }
    return starGeometry(pos, col, size, seed);
  }
  const STAR_VS = /* glsl */`
    uniform float uTime, uPR, uMouseOn, uWarp, uCube, uScaleK, uAlpha, uMaxSize;
    uniform vec2 uNear;
    uniform vec3 uMouse;
    attribute vec3 aColor; attribute float aSize; attribute float aSeed;
    varying vec3 vColor;
    void main() {
      vec3 p = position;
      float wob = uTime * (0.15 + aSeed * 0.25) + aSeed * 60.0;
      p.xz += vec2(cos(wob), sin(wob)) * 0.012;
      vec2 d = p.xz - uMouse.xz;
      float dl = length(d);
      float infl = uMouseOn * smoothstep(2.2, 0.0, dl);
      p.xz += (d / max(dl, 0.001)) * infl * 1.0;
      p.y += infl * 0.4 * (aSeed - 0.5);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.75 + 0.25 * sin(uTime * (1.1 + aSeed * 3.0) + aSeed * 50.0);
      float z = max(-mv.z, 0.01);
      float s = aSize * uPR * (1.0 + infl * 1.4) * (1.0 + uWarp * 2.5) * mix(1.0, 0.35, uCube) * uScaleK / z;
      // estrelas menores que 1 pixel: mantém o tamanho e reduz o brilho (sem cintilar)
      float mn = 1.1 * uPR, e = 1.0;
      if (s < mn) { e = (s / mn) * (s / mn); s = mn; }
      gl_PointSize = min(s, uMaxSize * uPR);
      float nearCut = mix(1.0, 0.25 + 0.75 * smoothstep(1.4, 4.5, length(p)), uCube);
      float camFade = smoothstep(uNear.x, uNear.y, z);
      vColor = aColor * tw * (1.0 + infl * 1.3) * nearCut * camFade * uAlpha * e;
    }`;
  const STAR_FS = /* glsl */`
    varying vec3 vColor;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float d2 = dot(c, c);
      float a = exp(-d2 * 26.0) + 0.18 * exp(-d2 * 7.0);
      if (a < 0.015) discard;
      gl_FragColor = vec4(vColor * a, 1.0);
    }`;
  const starMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uScaleK: { value: 34 }, uAlpha: { value: 1 }, uMaxSize: { value: 10 }, uNear: { value: new THREE.Vector2(0.03, 0.6) } },
    vertexShader: STAR_VS, fragmentShader: STAR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(buildStars(), starMat);
  stars.frustumCulled = false;
  stars.renderOrder = 1;
  galaxy.add(stars);
  // perto (dentro da galáxia) as estrelas ficam menores, para não virarem bolas
  function setStarView(k) {
    starMat.uniforms.uScaleK.value = 34 + (10 - 34) * k * k;
    starMat.uniforms.uMaxSize.value = 10 + (3.5 - 10) * k;
  }

  /* Brilho do gás (névoa) e faixas de poeira: dois planos com o mesmo
     desenho de espiral calculado no shader */
  const NOISE2 = /* glsl */`
    float h2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(h2(i), h2(i + vec2(1,0)), f.x), mix(h2(i + vec2(0,1)), h2(i + vec2(1,1)), f.x), f.y); }
    float fb2(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < ${lowEnd ? 4 : 5}; i++){ s += a * n2(p); p = p * 2.03 + 1.7; a *= 0.5; } return s; }
    const float KS = ${KS.toFixed(3)};
    const float R0 = ${R0.toFixed(3)};
    const float PI = 3.14159265;
    float armField(vec2 p, float off, float wMul){
      float r = max(length(p), 0.05), th = atan(p.y, p.x), base = KS * log(r / R0), s = 0.0;
      for (int k = 0; k < 2; k++){
        float d = th - float(k) * PI - base - off / r;
        d = mod(d + PI, 6.2831853) - PI;
        float dist = d * r, w = (0.2 + 0.055 * r) * wMul;
        s += exp(-dist * dist / (w * w));
      }
      return s;
    }`;
  const DISK_VS = `varying vec2 vP; varying vec3 vW;
    void main(){ vP = vec2(position.x, -position.y); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
  const hazeMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 } },
    vertexShader: DISK_VS,
    fragmentShader: `${NOISE2}
      uniform float uAlpha; varying vec2 vP; varying vec3 vW;
      void main(){
        vec2 p = vP; float r = length(p);
        float n = fb2(p * 0.8 + 3.0), nb = fb2(p * 2.4 - 5.0);
        float bulge = exp(-r / 0.42) * 0.55 + exp(-r / 1.2) * 0.2;
        float disk = exp(-r / 3.8) * 0.42 * (0.6 + 0.8 * n) + armField(p, 0.0, 3.6) * exp(-r / 6.0) * smoothstep(1.4, 3.0, r) * 0.12;
        float arms = armField(p, 0.0, 2.1) * smoothstep(1.6, 3.4, r) * exp(-r / 8.0) * (0.45 + 0.9 * nb) * 1.6;
        float knots = smoothstep(0.6, 0.82, fb2(p * 3.2 + 7.0)) * armField(p, -0.12, 0.7) * smoothstep(2.2, 3.2, r) * exp(-r / 9.0);
        vec3 col = vec3(1.0, 0.8, 0.56) * bulge + vec3(1.0, 0.86, 0.72) * disk
                 + mix(vec3(0.5, 0.52, 1.0), vec3(0.62, 0.75, 1.0), n) * arms * 0.42
                 + vec3(1.0, 0.33, 0.6) * knots * 0.4;
        col *= smoothstep(15.0, 9.0, r);
        float nf = smoothstep(0.3, 2.2, distance(vW, cameraPosition));
        gl_FragColor = vec4(col * uAlpha * nf, 1.0);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 1 } },
    vertexShader: DISK_VS,
    fragmentShader: `${NOISE2}
      uniform float uAlpha; varying vec2 vP; varying vec3 vW;
      void main(){
        vec2 p = vP; float r = length(p);
        float lane = armField(p, 0.28, 0.5) * smoothstep(1.3, 2.6, r) * smoothstep(13.0, 7.0, r);
        lane *= smoothstep(0.32, 0.72, fb2(p * 1.6 + 11.0)) * 1.3;
        float fil = smoothstep(0.58, 0.8, fb2(p * 4.2 + 2.0)) * 0.3 * smoothstep(9.0, 2.0, r) * smoothstep(0.8, 2.0, r);
        float nf = smoothstep(0.3, 2.2, distance(vW, cameraPosition));
        float a = clamp(lane * 0.7 + fil, 0.0, 0.8) * nf * uAlpha;
        gl_FragColor = vec4(0.025, 0.018, 0.04, a);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.NormalBlending
  });
  const diskGeo = new THREE.PlaneGeometry(30, 30, 1, 1);
  const haze = new THREE.Mesh(diskGeo, hazeMat);
  const dust = new THREE.Mesh(diskGeo, dustMat);
  haze.rotation.x = dust.rotation.x = -Math.PI / 2;
  haze.renderOrder = 0; dust.renderOrder = 2;
  haze.frustumCulled = dust.frustumCulled = false;
  galaxy.add(haze, dust);

  /* Céu de fundo */
  {
    const n = 6000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(600);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = pick([C('#ffffff'), C('#d4d4fb'), C('#ffe3c8'), C('#c9d8ff')]).multiplyScalar(0.3 + Math.pow(rand(), 3) * 0.9);
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

  /* Texturas de nuvem (nebulosas) e de brilho, desenhadas num canvas */
  function cloudTex(seed) {
    const s = 256, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), R = mulberry32(seed);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const a = R() * TAU, d = Math.pow(R(), 0.8) * s * 0.3;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d * 0.8, rr = s * (0.05 + R() * 0.16);
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(255,255,255,${0.05 + R() * 0.08})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    g.globalCompositeOperation = 'destination-in';
    const m = g.createRadialGradient(s / 2, s / 2, s * 0.08, s / 2, s / 2, s / 2);
    m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = m; g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }
  function glowTex() {
    const s = 128, cv = document.createElement('canvas'); cv.width = cv.height = s;
    const g = cv.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,.45)'); gr.addColorStop(0.5, 'rgba(255,255,255,.1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    return new THREE.CanvasTexture(cv);
  }
  const CLOUDS = [cloudTex(11), cloudTex(23), cloudTex(37)];
  const GLOW = glowTex();
  const NEB_COLS = ['#ff5fa2', '#8f7cff', '#4fd6e8', '#ff8a3d', '#c77dff', '#ff7fb6'].map(C);
  function makeSprites(n, parent, intensity) {
    const arr = [];
    for (let i = 0; i < n; i++) {
      const col = NEB_COLS[i % NEB_COLS.length].clone().multiplyScalar(intensity * (0.6 + rand() * 0.6));
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: CLOUDS[i % 3], color: col, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, transparent: true }));
      sp.material.rotation = rand() * TAU;
      sp.userData.base = 0.55 + rand() * 0.45;
      sp.renderOrder = 3;
      parent.add(sp); arr.push(sp);
    }
    return arr;
  }

  /* Nebulosa atravessada na viagem (no espaço da galáxia) */
  const travelNeb = new THREE.Group();
  travelNeb.visible = false;
  scene.add(travelNeb);
  const nebSprites = makeSprites(lowEnd ? 30 : 46, travelNeb, 0.55);
  const NEB_STARS = lowEnd ? 900 : 1800;
  const nebStarGeo = (() => {
    const pos = new Float32Array(NEB_STARS * 3), col = new Float32Array(NEB_STARS * 3), size = new Float32Array(NEB_STARS), seed = new Float32Array(NEB_STARS);
    const c = new THREE.Color();
    for (let i = 0; i < NEB_STARS; i++) {
      c.copy(rand() < 0.3 ? PAL.hii : rand() < 0.5 ? PAL.young : PAL.white).multiplyScalar(0.9 + rand() * 0.8);
      col.set([c.r, c.g, c.b], i * 3); size[i] = 0.18 + Math.pow(rand(), 3) * 0.5; seed[i] = rand();
    }
    return starGeometry(pos, col, size, seed);
  })();
  const nebStars = new THREE.Points(nebStarGeo, starMat);
  nebStars.frustumCulled = false; nebStars.renderOrder = 3;
  travelNeb.add(nebStars);

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
      float diff = max(dot(n, L), 0.0);
      float fill = max(dot(n, V), 0.0) * 0.16;
      float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
      vec3 col = base * (0.06 + 0.95 * diff + fill) * 0.9 + uC1 * fres * (0.3 + uHover * 0.4) * (0.35 + 0.65 * diff);
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
  // Nuvens da nebulosa de onde a câmera sai ao chegar
  const wispGroup = new THREE.Group();
  sysScene.add(wispGroup);
  const wisps = makeSprites(lowEnd ? 18 : 28, wispGroup, 0.3);

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
      vec3 c = skyStars(dw) * 0.7;
      if (uHasEnv > 0.5) c += min(textureCube(uEnv, dw).rgb, vec3(1.2)) * 0.55;
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
    uniforms: { ...bhUniforms(), uScale: { value: BH_SCALE } },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `${BH_COMMON}
      uniform float uScale; varying vec3 vW;
      void main(){
        vec3 ro = uTiltInv * (cameraPosition / uScale);
        vec3 rd = normalize(uTiltInv * (vW - cameraPosition));
        vec4 c = trace(ro, rd, ${lowEnd ? 120 : 170}, false);
        gl_FragColor = vec4(c.rgb, c.a);
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

  // Céu capturado do centro da galáxia (é o que a lente distorce lá dentro)
  const cubeRT = new THREE.WebGLCubeRenderTarget(lowEnd ? 256 : 512, { type: THREE.HalfFloatType });
  const cubeCam = new THREE.CubeCamera(0.05, 1500, cubeRT);
  function captureSky() {
    const nv = travelNeb.visible; travelNeb.visible = false;
    starMat.uniforms.uCube.value = 1;
    const mo = U.uMouseOn.value; U.uMouseOn.value = 0;
    cubeCam.update(renderer, scene);
    U.uMouseOn.value = mo;
    starMat.uniforms.uCube.value = 0;
    travelNeb.visible = nv;
    fullMat.uniforms.uEnv.value = cubeRT.texture;
    fullMat.uniforms.uHasEnv.value = 1;
  }

  /* =========================================================
     Pós-processamento: lente gravitacional + brilho (bloom)
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
  const lensPass = new ShaderPass(LensShader);
  composer.addPass(lensPass);
  const bhPass = new RenderPass(bhScene, camera);
  bhPass.clear = false;
  composer.addPass(bhPass);
  const BLOOM = 0.62;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.5, 0.6);
  composer.addPass(bloom);

  const composerIn = new EffectComposer(renderer);
  composerIn.addPass(new RenderPass(insideScene, orthoCam));
  const bloomIn = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.55);
  composerIn.addPass(bloomIn);

  // sistema: primeiro a galáxia vista de dentro, depois os planetas por cima
  const composerSys = new EffectComposer(renderer);
  composerSys.addPass(new RenderPass(scene, bgCam));
  const sysPass = new RenderPass(sysScene, sysCam);
  sysPass.clear = false; sysPass.clearDepth = true;
  composerSys.addPass(sysPass);
  const BLOOM_SYS = 0.85;
  const bloomSys = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM_SYS, 0.55, 0.55);
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
    travel: 'Segura firme: estamos atravessando uma <b>nebulosa</b> cheia de estrelas novas.',
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
  root.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
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
  const bez = (a, b, c, d, t, out) => {
    const u = 1 - t;
    return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
  };
  function flash(kind) {
    const f = $('#gx-flash');
    f.classList.remove('go', 'neb'); void f.offsetWidth;
    if (kind) f.classList.add(kind);
    f.classList.add('go');
  }

  /* =========================================================
     Viagem: braço da galáxia → nebulosa → sistema planetário
     ========================================================= */
  const SYS_SCALE = 0.0035;              // 1 unidade do sistema = 0,0035 unidade da galáxia
  const ARRIVE_D = 175;                  // a câmera do sistema começa longe do sol
  let trip = null;
  function travelTo(localP) {
    if (mode !== 'galaxy') return;
    focusIdx = -1;
    const P = galaxy.localToWorld(localP.clone());
    const out = P.clone().setY(0).normalize();
    const V = P.clone().addScaledVector(out, 1.15); V.y = 0.42;      // um pouco fora do braço, acima do disco
    // olhando para perto do centro da galáxia, um pouco de lado (o centro não fica atrás do sol)
    const hF = new THREE.Vector3(-V.x, 0, -V.z).normalize().applyAxisAngle(UP, 0.42);
    const F = hF.clone().add(new THREE.Vector3(0, -0.1, 0)).normalize();
    const p0 = camera.position.clone();
    trip = {
      V, F, hF,
      S: V.clone().addScaledVector(F, ARRIVE_D * SYS_SCALE),
      phase: 'in', t0: performance.now(), ms: reduce ? 1 : 3800,
      path: [p0, p0.clone().lerp(V, 0.25).addScaledVector(UP, 2.0), V.clone().addScaledVector(F, -3.4).addScaledVector(UP, 1.1), V.clone()],
      T0: controls.target.clone(), T1: V.clone().addScaledVector(F, 6)
    };
    // nebulosa e estrelas novas no fim do caminho
    const [a, b, c, d] = trip.path, q = new THREE.Vector3();
    nebSprites.forEach(sp => {
      bez(a, b, c, d, 0.62 + Math.sqrt(rand()) * 0.37, sp.position);
      sp.position.add(q.set(gauss(), gauss() * 0.6, gauss()).multiplyScalar(0.26));
      sp.scale.setScalar(0.3 + rand() * 0.95);
    });
    const pa = nebStarGeo.attributes.position;
    for (let i = 0; i < NEB_STARS; i++) {
      bez(a, b, c, d, 0.55 + rand() * 0.43, q);
      pa.setXYZ(i, q.x + gauss() * 0.35, q.y + gauss() * 0.22, q.z + gauss() * 0.35);
    }
    pa.needsUpdate = true;
    travelNeb.visible = true;
    fly = null;
    controls.enabled = false; controls.autoRotate = false;
    setMode('travel');
  }
  function sysHomePos() {
    const d = clamp(40 / (Math.tan(THREE.MathUtils.degToRad(25)) * Math.min(W / H, 1.6)), 60, 150);
    return trip.hF.clone().multiplyScalar(-Math.cos(0.45)).addScaledVector(UP, Math.sin(0.45)).multiplyScalar(d);
  }
  function startArrival() {
    flash('neb');
    view = 'system';
    travelNeb.visible = false;
    trip.phase = 'arrive'; trip.t0 = performance.now(); trip.ms = reduce ? 1 : 3400;
    trip.a0 = trip.F.clone().multiplyScalar(-ARRIVE_D);
    trip.a1 = sysHomePos();
    trip.R = new THREE.Vector3().crossVectors(trip.hF, UP).normalize();
    trip.tilt = 0;
    sysCam.position.copy(trip.a0); sysCam.lookAt(ORIGIN);
    sysControls.target.set(0, 0, 0);
    sysControls.minDistance = 10;
    // nuvens da nebulosa em volta do caminho de chegada
    const side = new THREE.Vector3().crossVectors(trip.F, UP).normalize();
    wisps.forEach(sp => {
      sp.position.copy(trip.F).multiplyScalar(-(85 + rand() * 95))
        .addScaledVector(side, gauss() * 16).addScaledVector(UP, gauss() * 6);
      sp.scale.setScalar(16 + rand() * 34);
    });
    PLANETS.forEach(p => p.label.classList.remove('on'));
  }
  function backToGalaxy() {
    if (view !== 'system' || mode === 'travel' || mode === 'warp' || !trip) return;
    focusIdx = -1; fly = null;
    PLANETS.forEach(p => p.label.classList.remove('on'));
    sysControls.enabled = false;
    flash('neb');
    view = 'galaxy';
    travelNeb.visible = true;
    const { V, F } = trip;
    camera.position.copy(V);
    trip.phase = 'out'; trip.t0 = performance.now(); trip.ms = reduce ? 1 : 3200;
    trip.path = [V.clone(), V.clone().addScaledVector(F, -3.4).addScaledVector(UP, 1.1), HOME_POS.clone().lerp(V, 0.25).addScaledVector(UP, 2.0), HOME_POS.clone()];
    trip.T0 = V.clone().addScaledVector(F, 6); trip.T1 = ORIGIN.clone();
    setMode('travel');
  }
  const tmpT = new THREE.Vector3(), qTilt = new THREE.Quaternion();
  const SYS_TILT = 0.36;
  function stepTrip() {
    const t = clamp((performance.now() - trip.t0) / trip.ms, 0, 1);
    if (trip.phase === 'in' || trip.phase === 'out') {
      // ida: acelera até a nebulosa; volta: começa e termina devagar
      const k = trip.phase === 'in' ? t * t * (2 - t) : ease(t);
      const [a, b, c, d] = trip.path;
      bez(a, b, c, d, k, camera.position);
      tmpT.lerpVectors(trip.T0, trip.T1, ease(t));
      camera.lookAt(tmpT); controls.target.copy(tmpT);
      setStarView(trip.phase === 'in' ? k : 1 - k);
      if (t >= 1) {
        if (trip.phase === 'in') startArrival();
        else {
          trip = null; travelNeb.visible = false; setStarView(0);
          controls.target.set(0, 0, 0); controls.enabled = true; controls.autoRotate = !reduce; controls.update();
          setMode('galaxy');
        }
      }
    } else if (trip.phase === 'arrive') {
      const k = 1 - Math.pow(1 - t, 3);
      sysCam.position.lerpVectors(trip.a0, trip.a1, k);
      sysCam.lookAt(ORIGIN);
      trip.tilt = SYS_TILT * ease(t);
      if (t >= 1) {
        trip.phase = null;
        sysControls.enabled = true; sysControls.autoRotate = !reduce; sysControls.update();
        setMode('system');
      }
    }
  }
  const sOpacity = (sp, cam, near, far) => {
    const dd = sp.position.distanceTo(cam.position);
    sp.material.opacity = sp.userData.base * THREE.MathUtils.smoothstep(dd, near[0], near[1]) * (1 - 0.55 * THREE.MathUtils.smoothstep(dd, far * 0.3, far));
  };

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
    view = 'galaxy'; travelNeb.visible = false; setStarView(0);
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
  let raf = 0, frames = 0, fpsT = 0, slowFrames = 0;
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
    const showL = mode === 'system' || mode === 'focus' || (mode === 'travel' && trip && trip.phase === 'arrive');
    PLANETS.forEach(p => {
      if (!showL) { p.label.classList.add('off'); return; }
      tmp2.copy(p.group.position); tmp2.y += p.size * 1.3;
      place(p.label, tmp2, sysCam, ' translate(-50%, -140%)');
    });
    [bhLabel, pinLabel, reticle, armLabel].forEach(el => el.classList.add('off'));
    wisps.forEach(sp => sOpacity(sp, sysCam, [3, 26], 160));
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!reduce) U.uTime.value += dt;

    // FPS e qualidade adaptativa
    frames++; fpsT += dt;
    if (fpsT > 1) {
      const fps = Math.round(frames / fpsT);
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
      if (frames % 90 === 0) captureSky();
      composerIn.render(dt);
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
      bgCam.updateMatrixWorld();
      composerSys.render(dt);
      return;
    }

    if (mode === 'galaxy' && !reduce) galaxy.rotation.y -= dt * 0.022;
    if (controls.enabled) controls.update();
    updateHover();
    U.uMouse.value.lerp(mouseTarget.x > 900 ? U.uMouse.value : mouseTarget, Math.min(1, dt * 10));
    U.uMouseOn.value += ((pointerIn && mouseTarget.x < 900 && mode === 'galaxy' ? 1 : 0) - U.uMouseOn.value) * Math.min(1, dt * 5);
    if (travelNeb.visible) nebSprites.forEach(sp => sOpacity(sp, camera, [0.04, 0.32], 14));

    // buraco negro e lente
    camera.updateMatrixWorld();
    bb.quaternion.copy(camera.quaternion);
    tmp.set(0, 0, 0).project(camera);
    lensPass.uniforms.uCenter.value.set((tmp.x + 1) / 2, (tmp.y + 1) / 2);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmp2.copy(camRight).multiplyScalar(5.2 * BH_SCALE).project(camera);
    const rE = Math.hypot((tmp2.x - tmp.x) / 2 * (W / H), (tmp2.y - tmp.y) / 2);
    lensPass.uniforms.uR.value = tmp.z < 1 ? rE : 0;

    updateGalaxyLabels();
    composer.render(dt);
  }

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

  window.IAGalaxy = { warp, setActive };  $('#gx-count').textContent = `${N.toLocaleString('pt-BR')} estrelas`;
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
