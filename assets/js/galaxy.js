/* =========================================================
   Abertura · Galáxia + buraco negro (three.js r170 + GLSL)
   - estrelas em partículas com braços espirais e rotação diferencial
   - o mouse afasta as estrelas
   - planetas clicáveis: cada um leva a um tema da apresentação
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
  /* ---------- Renderizador ---------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x06050f, 1);
  const basePR = Math.min(window.devicePixelRatio || 1, lowEnd ? 1.25 : 1.6);
  let pr = basePR;
  renderer.setPixelRatio(pr);

  const scene = new THREE.Scene();      // galáxia + planetas
  const bhScene = new THREE.Scene();    // buraco negro (desenhado depois da lente)
  const camera = new THREE.PerspectiveCamera(50, 1, 0.02, 2000);
  camera.position.set(0, 7.2, 17.5);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.enablePan = false;
  controls.minDistance = 3.2;
  controls.maxDistance = 34;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.7;
  controls.autoRotate = !reduce;
  controls.autoRotateSpeed = 0.28;

  const rand = mulberry32(20261103);
  const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

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
     Estrelas da galáxia
     ========================================================= */
  const N = reduce ? 30000 : lowEnd ? 42000 : 90000;
  const ARMS = 2, R_MAX = 12.5;
  const C = hex => new THREE.Color(hex);
  const PAL = {
    core: [C('#fff4e6'), C('#ffd9b5'), C('#ffb27a')],
    inner: [C('#ffc79f'), C('#ff9a4d'), C('#ffd2b0')],
    outer: [C('#b8b5ff'), C('#a7a4f4'), C('#d4d4fb'), C('#9cc0ff')],
    young: C('#dfe6ff'), hii: C('#ff8ab8'), dim: C('#6e6aa8')
  };
  const pick = arr => arr[(rand() * arr.length) | 0];
  function buildStars() {
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N), seed = new Float32Array(N);
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) {
      const u = rand();
      let x, y, z, s, b = 1;
      if (u < 0.15) {                       // bojo central (deixa um vazio para o buraco negro)
        const r = 0.95 + Math.abs(gauss()) * 1.25, a = rand() * TAU;
        x = Math.cos(a) * r; z = Math.sin(a) * r * 0.9;
        y = gauss() * 0.42 * Math.exp(-r * 0.32);
        c.copy(pick(PAL.core)); s = 0.6 + rand() * 1.1; b = 1.25;
      } else if (u < 0.91) {                // braços espirais
        const arm = (rand() * ARMS) | 0;
        let r = 1.3 - Math.log(1 - rand() * 0.985) * 3.3;
        if (r > R_MAX) r = 1.3 + rand() * (R_MAX - 1.3);
        const a = arm * Math.PI + Math.log(r) * 2.1;
        const spread = (0.1 + r * 0.04) * Math.pow(rand(), 2.4) * (rand() < 0.5 ? -1 : 1);
        const sa = a + spread / Math.max(r, 1) * 3.2;
        x = Math.cos(sa) * r + gauss() * 0.05; z = Math.sin(sa) * r + gauss() * 0.05;
        y = gauss() * 0.075 * (1 + r * 0.05);
        const t = Math.min(1, Math.max(0, (r - 1.3) / 8));
        c.copy(pick(PAL.inner)).lerp(pick(PAL.outer), t);
        s = 0.45 + Math.pow(rand(), 3) * 1.7;
        const k = rand();
        if (k < 0.05) { c.copy(PAL.young); s *= 1.9; b = 1.5; }
        else if (k < 0.07 && r > 2.5) { c.copy(PAL.hii); s *= 1.6; b = 1.3; }
        b *= 0.75 + 0.4 * (1 - t);
      } else {                              // disco difuso
        const r = 1 + Math.abs(gauss()) * 5.2, a = rand() * TAU;
        x = Math.cos(a) * r; z = Math.sin(a) * r; y = gauss() * 0.16;
        c.copy(PAL.dim).lerp(pick(PAL.inner), rand() * 0.4); s = 0.4 + rand() * 0.6; b = 0.38;
      }
      pos.set([x, y, z], i * 3);
      col.set([c.r * b, c.g * b, c.b * b], i * 3);
      size[i] = s; seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }
  const STAR_VS = /* glsl */`
    uniform float uTime, uPR, uMouseOn, uWarp, uCube, uScaleK, uAlpha, uMaxSize;
    uniform vec3 uMouse;
    attribute vec3 aColor; attribute float aSize; attribute float aSeed;
    varying vec3 vColor;
    void main() {
      vec3 p = position;
      float r = length(p.xz);
      float ang = atan(p.z, p.x) - uTime * (0.03 + 0.1 / (1.0 + r * 0.55));
      p.x = cos(ang) * r; p.z = sin(ang) * r;
      vec2 d = p.xz - uMouse.xz;
      float dl = length(d);
      float infl = uMouseOn * smoothstep(2.4, 0.0, dl);
      p.xz += (d / max(dl, 0.001)) * infl * 1.15;
      p.y += infl * 0.45 * (aSeed - 0.5);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.72 + 0.28 * sin(uTime * (1.3 + aSeed * 3.0) + aSeed * 50.0);
      float s = aSize * uPR * (1.0 + infl * 1.6) * (1.0 + uWarp * 2.5) * mix(1.0, 0.35, uCube);
      float z = max(-mv.z, 0.05);
      gl_PointSize = clamp(s * uScaleK / z, 0.0, uMaxSize * uPR);
      float nearCut = mix(1.0, 0.25 + 0.75 * smoothstep(1.4, 4.5, length(p)), uCube);
      float camFade = smoothstep(0.15, 1.8, z);
      vColor = aColor * tw * (1.0 + infl * 1.3) * nearCut * camFade * uAlpha;
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
    uniforms: { ...U, uScaleK: { value: 34 }, uAlpha: { value: 1 }, uMaxSize: { value: 10 } },
    vertexShader: STAR_VS, fragmentShader: STAR_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(buildStars(), starMat);
  stars.frustumCulled = false;
  scene.add(stars);

  /* Gás brilhante (nebulosas) e poeira escura ao longo dos braços */
  function buildClouds(n, dark) {
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const arm = i % ARMS;
      let r = 1.6 - Math.log(1 - rand() * 0.97) * 3.0; if (r > 11.5) r = 2 + rand() * 9;
      const a = arm * Math.PI + Math.log(r) * 2.1 + (dark ? -0.22 : (rand() - 0.5) * 0.3);
      pos.set([Math.cos(a) * r + gauss() * 0.25, gauss() * 0.05, Math.sin(a) * r + gauss() * 0.25], i * 3);
      if (dark) { c.set('#000000'); size[i] = 4 + rand() * 7; }
      else {
        const t = Math.min(1, r / 9);
        c.copy(rand() < 0.15 ? PAL.hii : pick(PAL.inner)).lerp(pick(PAL.outer), t).multiplyScalar(0.07 + rand() * 0.05);
        size[i] = 10 + rand() * 18 + r;
      }
      col.set([c.r, c.g, c.b], i * 3); seed[i] = rand();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }
  const CLOUD_FS = /* glsl */`
    varying vec3 vColor;
    uniform float uDark;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float a = smoothstep(0.25, 0.0, dot(c, c));
      if (uDark > 0.5) gl_FragColor = vec4(0.02, 0.015, 0.05, a * 0.32);
      else gl_FragColor = vec4(vColor * a, 1.0);
    }`;
  const glowMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uScaleK: { value: 34 }, uAlpha: { value: 1 }, uDark: { value: 0 }, uMaxSize: { value: 70 } },
    vertexShader: STAR_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  });
  const dustMat = new THREE.ShaderMaterial({
    uniforms: { ...U, uScaleK: { value: 34 }, uAlpha: { value: 1 }, uDark: { value: 1 }, uMaxSize: { value: 70 } },
    vertexShader: STAR_VS, fragmentShader: CLOUD_FS, transparent: true, depthWrite: false, blending: THREE.NormalBlending
  });
  const glow = new THREE.Points(buildClouds(lowEnd ? 360 : 700, false), glowMat);
  const dust = new THREE.Points(buildClouds(lowEnd ? 700 : 1500, true), dustMat);
  glow.frustumCulled = dust.frustumCulled = false;
  glow.renderOrder = 0; stars.renderOrder = 1; dust.renderOrder = 2;
  scene.add(glow, dust);

  /* Céu de fundo */
  {
    const n = 5000, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(600);
      pos.set([v.x, v.y, v.z], i * 3);
      const c = pick([C('#ffffff'), C('#d4d4fb'), C('#ffe3c8'), C('#c9d8ff')]).multiplyScalar(0.35 + Math.pow(rand(), 3) * 0.9);
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

  /* =========================================================
     Planetas (cada um é um tema da apresentação)
     ========================================================= */
  const PLANETS = [
    { name: 'Fundamentos', slide: 2, icon: 'brain', tag: 'Fundamentos · 4 slides', r: 4.3, size: 0.44, cols: ['#a7a4f4', '#e4e3ff', '#2c2a6b'], type: 0, ring: false,
      text: 'O que é IA, como um modelo de linguagem escreve, a matemática de um neurônio e como a IA é treinada.', facts: [['brain', 'Neurônio interativo'], ['trend', 'Descida do gradiente'], ['layers', 'Tokens e atenção']] },
    { name: 'Tradução', slide: 6, icon: 'languages', tag: '1.1 Ferramenta', r: 5.5, size: 0.33, cols: ['#ffc79f', '#fff0e2', '#8a3a14'], type: 1,
      text: 'Um tradutor por dentro: tokens, vetores e atenção ligando cada palavra à tradução, e a armadilha das expressões.', facts: [['languages', 'Inglês, espanhol e japonês'], ['gem', 'Sua frase com Gemini']] },
    { name: 'Assistentes', slide: 7, icon: 'mic', tag: '1.2 Ferramenta', r: 6.6, size: 0.3, cols: ['#9cc0ff', '#f1f6ff', '#2f4f8f'], type: 2,
      text: 'Do som da voz até a resposta: as 5 etapas de um assistente virtual, com a intenção em JSON.', facts: [['mic', 'Voz para texto'], ['code', 'Intenção em JSON']] },
    { name: 'Chatbots', slide: 8, icon: 'message', tag: '1.3 Ferramenta', r: 7.7, size: 0.4, cols: ['#ff9a4d', '#ffe2c8', '#8a3010'], type: 0, ring: true,
      text: 'Bot de regras, bot com IA e o Gemini respondendo ao vivo, com memória da conversa.', facts: [['message', '3 modos'], ['gem', 'Gemini ao vivo']] },
    { name: 'Geração', slide: 9, icon: 'image', tag: '1.4 Ferramenta', r: 8.8, size: 0.32, cols: ['#ff8ab8', '#ffe0ec', '#6e1f47'], type: 1,
      text: 'Como uma imagem nasce do ruído, passo a passo, num modelo de difusão.', facts: [['image', 'Difusão em 40 passos'], ['palette', 'Prompt de imagem']] },
    { name: 'Prompts', slide: 11, icon: 'sparkles', tag: '1.6 Ferramenta', r: 9.9, size: 0.48, cols: ['#d4d4fb', '#ffffff', '#4a46b8'], type: 0, ring: true,
      text: 'Monte um prompt com papel, contexto, formato e exemplo, e veja a resposta melhorar.', facts: [['sparkles', '6 ingredientes'], ['gem', 'Teste real no Gemini']] },
    { name: 'Agentes e Excel', slide: 12, icon: 'bot', tag: 'Extra', r: 11.0, size: 0.37, cols: ['#4fe3ff', '#d8fbff', '#0f4c5c'], type: 2,
      text: 'Agentes que pensam, agem e conferem. Inclui o Claude automatizando uma planilha inteira do Excel.', facts: [['repeat', 'Ciclo do agente'], ['table', 'Claude + Excel']] },
    { name: 'Vídeo', slide: 16, icon: 'film', tag: 'Bônus', r: 12.2, size: 0.31, cols: ['#ffb36b', '#fff3e3', '#7a3e0a'], type: 1,
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
      float fill = max(dot(n, V), 0.0) * 0.22;
      float fres = pow(1.0 - max(dot(n, V), 0.0), 2.6);
      vec3 col = base * (0.1 + 0.85 * diff + fill) * 0.9 + uC1 * fres * (0.4 + uHover * 0.35);
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
  const sphereGeo = new THREE.SphereGeometry(1, 64, 40);
  const ringGeo = new THREE.RingGeometry(1.45, 2.3, 128, 1);
  const planetMeshes = [];
  const planetGroup = new THREE.Group();
  scene.add(planetGroup);
  PLANETS.forEach((p, i) => {
    p.phase = i * 2.39996 + 0.6;
    p.y = Math.sin(i * 1.7) * 0.25;
    p.speed = 0.05 / Math.sqrt(p.r);
    p.spin = 0.15 + rand() * 0.2;
    p.hover = 0;
    const g = new THREE.Group();
    const mat = new THREE.ShaderMaterial({
      uniforms: { uC1: { value: C(p.cols[0]) }, uC2: { value: C(p.cols[1]) }, uC3: { value: C(p.cols[2]) }, uType: { value: p.type }, uTime: U.uTime, uHover: { value: 0 }, uSeed: { value: i * 3.7 } },
      vertexShader: PLANET_VS, fragmentShader: PLANET_FS
    });
    const m = new THREE.Mesh(sphereGeo, mat);
    p.size *= 0.82;
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
    planetGroup.add(g);
    planetMeshes.push(m);
  });

  /* Rótulos em HTML acompanhando cada planeta */
  const labelsBox = $('#gx-labels');
  const iconSvg = n => `<svg class="i"><use href="#i-${n}"/></svg>`;
  PLANETS.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'gx-label';
    b.innerHTML = `${iconSvg(p.icon)}<span>${p.name}</span>`;
    b.addEventListener('click', () => focusPlanet(i));
    b.addEventListener('pointerenter', () => (hoverIdx = i));
    b.addEventListener('pointerleave', () => (hoverIdx = -1));
    labelsBox.appendChild(b);
    p.label = b;
  });
  const bhLabel = document.createElement('button');
  bhLabel.className = 'gx-label bh';
  bhLabel.innerHTML = `${iconSvg('target')}<span>Buraco negro · clique para entrar</span>`;
  bhLabel.addEventListener('click', () => enterBH());
  labelsBox.appendChild(bhLabel);

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
    planetGroup.visible = true;
    [starMat, glowMat, dustMat].forEach(m => (m.uniforms.uCube.value = 1));
    const mo = U.uMouseOn.value; U.uMouseOn.value = 0;
    cubeCam.update(renderer, scene);
    U.uMouseOn.value = mo;
    [starMat, glowMat, dustMat].forEach(m => (m.uniforms.uCube.value = 0));
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
  const BLOOM = 0.8;
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), BLOOM, 0.5, 0.42);
  composer.addPass(bloom);

  const composerIn = new EffectComposer(renderer);
  composerIn.addPass(new RenderPass(insideScene, orthoCam));
  const bloomIn = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.45, 0.55);
  composerIn.addPass(bloomIn);

  /* ---------- Tamanho ---------- */
  let W = 1, H = 1, viewShift = 0, viewShiftTo = 0;
  function applyView() {
    if (Math.abs(viewShift) > 0.001) camera.setViewOffset(W, H, -viewShift * W, 0, W, H);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }
  function resize() {
    W = Math.max(1, innerWidth); H = Math.max(1, innerHeight);
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H, false);
    composer.setPixelRatio(pr); composer.setSize(W, H);
    const ipr = pr * insideScale;
    composerIn.setPixelRatio(ipr); composerIn.setSize(W, H);
    camera.aspect = W / H;
    applyView();
    U.uPR.value = pr;
    lensPass.uniforms.uAspect.value = W / H;
    fullMat.uniforms.uAspect.value = W / H;
    // desloca o buraco negro para longe do painel: à direita no desktop, para cima no celular
    fullMat.uniforms.uShift.value.set(W > 1100 ? 0.22 : 0, W <= 760 ? 0.42 : 0);
    viewShiftTo = targetShift();
  }
  const targetShift = () => (mode === 'galaxy' && W > 1100 ? 0.12 : mode === 'focus' && W > 760 ? -0.1 : 0);
  let insideScale = lowEnd ? 0.55 : 0.8;
  addEventListener('resize', resize);

  /* =========================================================
     Interação
     ========================================================= */
  let mode = 'galaxy';                   // galaxy | focus | inside | warp
  let active = html.classList.contains('intro-on');
  let hoverIdx = -1, hoverBH = false, focusIdx = -1;
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2(9, 9);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  const mouseTarget = new THREE.Vector3(999, 0, 999);
  let pointerIn = false, down = null, dragged = false;

  function setMode(m) {
    mode = m;
    root.classList.remove('mode-galaxy', 'mode-focus', 'mode-inside', 'mode-warp');
    root.classList.add(`mode-${m}`);
    viewShiftTo = targetShift();
    $('#gx-hero').hidden = m !== 'galaxy';
    $('#gx-planet').hidden = m !== 'focus';
    $('#gx-bh').hidden = m !== 'inside';
    const bub = $('#gx-bubble');
    bub.innerHTML = m === 'focus' ? 'Este planeta guarda um tema. Clique em <b>Ir para este tema</b> para pular direto para ele.'
      : m === 'inside' ? '<b>Arraste</b> para dar a volta no buraco negro e clique nas partes para entender cada uma.'
      : 'Oi! <b>Clique em um planeta</b> para ver um tema ou entre no buraco negro do centro.';
  }

  canvas.addEventListener('pointermove', e => {
    pointerIn = true;
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) dragged = true;
    if (mode === 'inside' && down) {
      insideCam.az -= (e.clientX - down.lx) * 0.006;
      insideCam.el = THREE.MathUtils.clamp(insideCam.el + (e.clientY - down.ly) * 0.005, -1.45, 1.45);
      down.lx = e.clientX; down.ly = e.clientY;
    }
  });
  canvas.addEventListener('pointerleave', () => { pointerIn = false; hoverIdx = -1; hoverBH = false; });
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY }; dragged = false;
    canvas.classList.add('drag');
    if (mode === 'inside') canvas.setPointerCapture(e.pointerId);
  });
  const up = () => {
    canvas.classList.remove('drag');
    if (down && !dragged) {
      if (mode === 'galaxy' || mode === 'focus') {
        if (hoverIdx >= 0) focusPlanet(hoverIdx);
        else if (hoverBH) enterBH();
      }
    }
    down = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; canvas.classList.remove('drag'); });
  canvas.addEventListener('wheel', e => {
    if (mode !== 'inside') return;
    e.preventDefault();
    setDist(insideCam.dist * Math.exp(e.deltaY * 0.0012));
  }, { passive: false });
  root.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (mode === 'focus') backToGalaxy();
    else if (mode === 'inside') exitBH();
  });

  /* ---------- Voo da câmera ---------- */
  let fly = null;
  function flyTo(pos, target, ms = 1600, done) {
    fly = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), ms: reduce ? 1 : ms, done };
    controls.enabled = false;
    controls.autoRotate = false;
  }
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const planetPos = (p, out = new THREE.Vector3()) => out.set(Math.cos(p.phase) * p.r, p.y, Math.sin(p.phase) * p.r);
  const HOME_POS = new THREE.Vector3(0, 7.2, 17.5), ORIGIN = new THREE.Vector3();

  function focusPlanet(i) {
    if (mode === 'inside' || mode === 'warp') return;
    const p = PLANETS[i];
    focusIdx = i;
    const pp = planetPos(p);
    const out = pp.clone().setY(0).normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x);
    const camPos = pp.clone().addScaledVector(out, p.size * 5.2).addScaledVector(side, p.size * 2.2).add(new THREE.Vector3(0, p.size * 1.9, 0));
    flyTo(camPos, pp, 1700, () => { controls.enabled = true; controls.minDistance = p.size * 2.4; });
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
  function backToGalaxy() {
    focusIdx = -1;
    PLANETS.forEach(q => q.label.classList.remove('on'));
    controls.minDistance = 3.2;
    setMode('galaxy');
    flyTo(HOME_POS, ORIGIN, 1700, () => { controls.enabled = true; controls.autoRotate = !reduce; });
  }
  $('#gxp-close').addEventListener('click', backToGalaxy);
  $('#gxp-back').addEventListener('click', backToGalaxy);
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
    insideCam.dist = THREE.MathUtils.clamp(d, DIST_MIN, DIST_MAX);
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

  function flash() { const f = $('#gx-flash'); f.classList.remove('go'); void f.offsetWidth; f.classList.add('go'); }
  function enterBH() {
    if (mode === 'inside' || mode === 'warp') return;
    focusIdx = -1; PLANETS.forEach(q => q.label.classList.remove('on'));
    setMode('warp');
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (Math.abs(dir.y) < 0.15) dir.y = 0.15;
    dir.normalize();
    const near = dir.clone().multiplyScalar(26 * BH_SCALE);
    flyTo(near, ORIGIN, 2200, () => {
      flash();
      setTimeout(() => {
        captureSky();
        const local = near.clone().divideScalar(BH_SCALE).applyMatrix3(TILT_INV);
        const d0 = W / H < 0.8 ? 34 : 22; // tela em pé: começa mais longe para caber o disco
        insideCam.dist = d0; setDist(d0);
        insideCam.az = Math.atan2(local.x, local.z);
        insideCam.el = THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(local.y / local.length(), -1, 1)), 0.1, 0.22);
        setPart(0); fullMat.uniforms.uHighlight.value = 0;
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
    camera.position.copy(world); controls.target.set(0, 0, 0); controls.update();
    setMode('galaxy');
    flyTo(HOME_POS, ORIGIN, 2200, () => { controls.enabled = true; controls.autoRotate = !reduce; });
  }
  $('#gx-enter').addEventListener('click', enterBH);
  $('#gxb-exit').addEventListener('click', exitBH);
  $('#gxb-close').addEventListener('click', exitBH);

  /* ---------- Salto para a apresentação (botão Iniciar) ---------- */
  let warpT = -1, warpResolve = null;
  function warp() {
    return new Promise(res => {
      if (!active || reduce) { res(); return; }
      setMode('warp');
      warpT = 0; warpResolve = res;
      const dir = camera.position.clone().sub(controls.target).normalize();
      flyTo(controls.target.clone().addScaledVector(dir, 2.5), controls.target.clone(), 1100);
    });
  }
  function resetView() {
    fly = null; warpT = -1; U.uWarp.value = 0; bloom.strength = BLOOM;
    focusIdx = -1; PLANETS.forEach(q => q.label.classList.remove('on'));
    camera.position.copy(HOME_POS); controls.target.set(0, 0, 0);
    controls.enabled = true; controls.autoRotate = !reduce; controls.minDistance = 3.2;
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

  function updatePlanets(dt) {
    PLANETS.forEach((p, i) => {
      if (i !== focusIdx && mode !== 'inside') p.phase += p.speed * dt * (reduce ? 0 : 1);
      planetPos(p, p.group.position);
      p.mesh.rotation.y += p.spin * dt;
      const h = (i === hoverIdx || i === focusIdx) ? 1 : 0;
      p.hover += (h - p.hover) * Math.min(1, dt * 8);
      p.mat.uniforms.uHover.value = p.hover;
      p.group.scale.setScalar(1 + p.hover * 0.12);
    });
  }
  function updateLabels() {
    const show = mode === 'galaxy' || mode === 'focus';
    PLANETS.forEach(p => {
      tmp.copy(p.group.position); tmp.y += p.size * 1.25;
      tmp.project(camera);
      const vis = show && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
      p.label.classList.toggle('off', !vis);
      if (vis) p.label.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp.y) / 2) * H}px) translate(-50%, -140%)`;
    });
    tmp.set(0, 0, 0).project(camera);
    const d = camera.position.length();
    const bv = mode === 'galaxy' && d > 5 && tmp.z < 1;
    bhLabel.classList.toggle('off', !bv);
    if (bv) {
      camRight.setFromMatrixColumn(camera.matrixWorld, 1);
      tmp2.copy(camRight).multiplyScalar(13 * BH_SCALE).project(camera);
      bhLabel.style.transform = `translate(${((tmp.x + 1) / 2) * W}px, ${((1 - tmp2.y) / 2) * H}px) translate(-50%, -150%)`;
    }
  }
  function updateHover() {
    if (!pointerIn || mode === 'inside' || mode === 'warp') { hoverBH = false; return; }
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(planetMeshes, false);
    if (hits.length) hoverIdx = hits[0].object.userData.i;
    else if (!labelsBox.querySelector('.gx-label:hover')) hoverIdx = -1;
    hoverBH = hoverIdx < 0 && ray.ray.distanceSqToPoint(ORIGIN) < (7 * BH_SCALE) ** 2;
    canvas.classList.toggle('point', hoverIdx >= 0 || hoverBH);
    if (ray.ray.intersectPlane(plane, hit) && mode === 'galaxy') mouseTarget.copy(hit);
    else mouseTarget.set(999, 0, 999);
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
        if (mode === 'inside' && insideScale > 0.4) { insideScale = Math.max(0.4, insideScale - 0.15); resize(); }
        else if (mode !== 'inside' && pr > 0.75) { pr = Math.max(0.75, pr - 0.25); resize(); }
      }
      frames = 0; fpsT = 0;
    }

    // voo da câmera
    if (fly) {
      const t = Math.min(1, (performance.now() - fly.start) / fly.ms), k = ease(t);
      camera.position.lerpVectors(fly.p0, fly.p1, k);
      controls.target.lerpVectors(fly.t0, fly.t1, k);
      if (focusIdx >= 0) { planetPos(PLANETS[focusIdx], tmp); controls.target.lerpVectors(fly.t0, tmp, k); }
      if (t >= 1) { const d = fly.done; fly = null; d && d(); }
    }
    if (warpT >= 0) {
      warpT += dt;
      const k = Math.min(1, warpT / 1.0);
      U.uWarp.value = k * k;
      bloom.strength = BLOOM + k * 1.6;
      if (warpT > 0.95 && warpResolve) { const r = warpResolve; warpResolve = null; r(); }
    }

    viewShift += (viewShiftTo - viewShift) * Math.min(1, dt * 3);
    if (mode !== 'inside') applyView();

    if (mode === 'inside') {
      if (dive) {
        setDist(insideCam.dist * Math.exp(-dive * dt * 0.35));
        if (insideCam.dist <= DIST_MIN + 0.001 || insideCam.dist >= DIST_MAX - 0.01) stopDive();
      }
      if (!down && !reduce) insideCam.az += dt * 0.04;
      const c = insideCam;
      const pos = new THREE.Vector3(Math.sin(c.az) * Math.cos(c.el), Math.sin(c.el), Math.cos(c.az) * Math.cos(c.el)).multiplyScalar(c.dist);
      const fwd = pos.clone().negate().normalize();
      const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
      const upv = new THREE.Vector3().crossVectors(right, fwd);
      basis.makeBasis(right, upv, fwd.clone().negate());
      fullMat.uniforms.uBasis.value.setFromMatrix4(basis);
      fullMat.uniforms.uCam.value.copy(pos);
      if (frames % 90 === 0) captureSky();
      composerIn.render(dt);
      return;
    }

    if (controls.enabled) controls.update();
    updatePlanets(dt);
    updateHover();
    U.uMouse.value.lerp(mouseTarget.x > 900 ? U.uMouse.value : mouseTarget, Math.min(1, dt * 10));
    U.uMouseOn.value += ((pointerIn && mouseTarget.x < 900 && mode === 'galaxy' ? 1 : 0) - U.uMouseOn.value) * Math.min(1, dt * 5);

    // buraco negro e lente
    camera.updateMatrixWorld();
    bb.quaternion.copy(camera.quaternion);
    tmp.set(0, 0, 0).project(camera);
    lensPass.uniforms.uCenter.value.set((tmp.x + 1) / 2, (tmp.y + 1) / 2);
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    tmp2.copy(camRight).multiplyScalar(5.2 * BH_SCALE).project(camera);
    const rE = Math.hypot((tmp2.x - tmp.x) / 2 * (W / H), (tmp2.y - tmp.y) / 2);
    lensPass.uniforms.uR.value = tmp.z < 1 ? rE : 0;
    bbMat.uniforms.uBright.value = 1;

    updateLabels();
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

  window.IAGalaxy = { warp, setActive };
  $('#gx-count').textContent = `${N.toLocaleString('pt-BR')} estrelas`;
  setMode('galaxy');
  setPart(0);
  depthText();
  resize();
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
