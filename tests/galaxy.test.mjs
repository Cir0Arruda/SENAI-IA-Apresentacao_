/* =========================================================
   Testes automatizados da abertura (galáxia)
   Abre o site num Chrome automático, clica como uma pessoa e
   confere o que aparece na tela e o estado da cena.

   Rodar:   node tests/galaxy.test.mjs
   Precisa do Puppeteer (npm i -D puppeteer) ou de PUPPETEER_PATH
   apontando para uma pasta com o Puppeteer instalado.
   Opções:  --headful (mostra o navegador)  --so-desktop  --so-celular
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const req = createRequire(import.meta.url);
const tryReq = p => { try { return req(p); } catch { return null; } };
const puppeteer = tryReq('puppeteer') || (process.env.PUPPETEER_PATH && tryReq(process.env.PUPPETEER_PATH));
if (!puppeteer) {
  console.error('Puppeteer não encontrado. Instale com "npm i -D puppeteer" ou defina PUPPETEER_PATH.');
  process.exit(2);
}

/* ---------- servidor local simples ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const server = http.createServer((rq, rs) => {
  const url = decodeURIComponent(rq.url.split('?')[0]);
  let file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rs.writeHead(404); rs.end(); return; }
  rs.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(rs);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

/* ---------- utilitários ---------- */
const results = [];
let current = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function check(name, ok, detail = '') {
  results.push({ group: current, name, ok: !!ok, detail });
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? `  (${detail})` : ''}`);
}
async function waitFor(page, fn, timeout = 15000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await page.evaluate(fn, arg)) return true; } catch { /* página ainda carregando */ }
    await sleep(120);
  }
  return false;
}
const state = page => page.evaluate(() => window.IAGalaxy.test.state());
const ang = (a, b) => {
  const d = Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
  return Math.acos(d) * 180 / Math.PI;
};
// confere se a câmera não "pula" quando a cena troca (galáxia ↔ sistema)
function continuity(rec, fromView, toView) {
  const i = rec.findIndex((r, k) => k > 0 && rec[k - 1].view === fromView && r.view === toView);
  if (i < 2) return { found: false };
  const sp = k => Math.hypot(...rec[k].p.map((v, j) => v - rec[k - 1].p[j])) / Math.max(1, rec[k].t - rec[k - 1].t);
  const av = k => ang(rec[k].d, rec[k - 1].d) / Math.max(1, rec[k].t - rec[k - 1].t) * 1000;
  const before = Math.max(sp(i - 1), 1e-6), at = sp(i);
  return { found: true, speedRatio: at / before, turnAt: av(i), turnBefore: av(i - 1), jump: Math.hypot(...rec[i].p.map((v, j) => v - rec[i - 1].p[j])) };
}
function armsOnRing(samples) {
  const s = samples.filter(v => v >= 0);
  if (s.length < 40) return { n: s.length, peaks: 0, contrast: 0 };
  const sm = s.map((_, i) => { let a = 0; for (let k = -3; k <= 3; k++) a += s[(i + k + s.length) % s.length]; return a / 7; });
  const sorted = [...sm].sort((a, b) => a - b), p10 = sorted[Math.floor(sm.length * 0.1)], p90 = sorted[Math.floor(sm.length * 0.9)];
  const mid = (p10 + p90) / 2;
  let peaks = 0;
  for (let i = 0; i < sm.length; i++) if (sm[i] >= mid && sm[(i - 1 + sm.length) % sm.length] < mid) peaks++;
  return { n: s.length, peaks, contrast: p90 / Math.max(1, p10) };
}

/* As medidas "sem corte" comparam a velocidade da câmera de um quadro para o seguinte. Num computador sem placa
   de vídeo a cena roda a 1–20 quadros/s e um único quadro pode durar meio segundo: a medida vira sorteio.
   Nesse caso a mesma viagem é refeita com o relógio da página trocado por um relógio virtual (cada quadro anda
   1/60 s, como num PC com placa de vídeo) — o mesmo método de tests/viagem-60fps.test.mjs. */
const CLOCK60 = `(() => {
  let now = 0, id = 0; const q = [];
  performance.now = () => now; const d0 = Date.now(); Date.now = () => d0 + now;
  window.requestAnimationFrame = cb => { q.push([++id, cb]); return id; };
  window.cancelAnimationFrame = i => { const k = q.findIndex(x => x[0] === i); if (k >= 0) q.splice(k, 1); };
  window.__step = ms => {
    now += ms;
    for (const a of document.getAnimations()) { try { if (a.playState === 'running') a.pause(); if (a.playState !== 'finished') a.currentTime = (a.currentTime || 0) + ms; } catch {} }
    const run = q.splice(0); for (const [, cb] of run) { try { cb(now); } catch (e) { console.error(e); } }
  };
})();`;
let trip60 = null;
async function viagem60(browser) {
  if (trip60) return trip60;
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 0.5 });   // só a câmera importa aqui
    await page.evaluateOnNewDocument(CLOCK60);
    await page.goto(`${BASE}?teste`, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.IAGalaxy && window.IAGalaxy.test, { timeout: 120000, polling: 500 });
    const step = n => page.evaluate(k => { for (let i = 0; i < k; i++) window.__step(1000 / 60); }, n);
    const st = () => page.evaluate(() => window.IAGalaxy.test.state());
    for (let i = 0; i < 10; i++) await step(30);
    await page.evaluate(() => window.IAGalaxy.test.record(true));
    const t = await page.evaluate(() => window.IAGalaxy.test.armScreen(1, 7));
    await page.mouse.move(t.x, t.y); await step(2); await page.mouse.click(t.x, t.y);
    for (let k = 0, ok = false; k < 400 && !ok; k++) { await step(5); const s = await st(); ok = s.mode === 'system' && s.view === 'system'; }
    await step(60);
    const c1 = continuity(await page.evaluate(() => window.IAGalaxy.test.record(false)), 'galaxy', 'system');
    await step(60);
    await page.evaluate(() => window.IAGalaxy.test.record(true));
    await page.evaluate(() => document.querySelector('#gxs-back')?.click());
    for (let k = 0, ok = false; k < 160 && !ok; k++) { await step(15); const s = await st(); ok = s.mode === 'galaxy' && s.view === 'galaxy' && !s.phase; }
    await step(60);
    const c2 = continuity(await page.evaluate(() => window.IAGalaxy.test.record(false)), 'system', 'galaxy');
    trip60 = { c1, c2 };
  } finally { await page.close(); }
  return trip60;
}
// usa a medida em tempo real se a cena rodou a 30 quadros/s ou mais; senão, a da viagem a 60 quadros/s virtuais
async function trocaMedida(browser, rec, which, fromView, toView) {
  const frameMs = rec.length > 1 ? (rec[rec.length - 1].t - rec[0].t) / (rec.length - 1) : 1e9;
  if (frameMs <= 1000 / 30) return { c: continuity(rec, fromView, toView), how: '' };
  const v = await viagem60(browser);
  return { c: v[which], how: `medido a 60 quadros/s virtuais; aqui a cena roda a ${(1000 / frameMs).toFixed(0)} quadros/s` };
}

async function openPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  const errors = [];
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}?teste`, { waitUntil: 'load', timeout: 60000 });
  return { page, errors };
}

/* =========================================================
   Desktop 1440×900
   ========================================================= */
async function desktop(browser) {
  current = 'Desktop 1440×900';
  console.log(`\n${current}`);
  const { page, errors } = await openPage(browser, { width: 1440, height: 900, deviceScaleFactor: 1 });

  const ready = await waitFor(page, () => window.IAGalaxy && window.IAGalaxy.test, 30000);
  check('A galáxia carregou (WebGL2 e shaders sem erro)', ready && !(await page.$eval('#gx', el => el.classList.contains('nogl'))));
  if (!ready) return;
  await sleep(2500);
  let s = await state(page);
  check('Abertura visível com o painel inicial', s.hero && s.mode === 'galaxy' && (await page.evaluate(() => document.documentElement.classList.contains('intro-on'))));
  // 150 mil no computador; em máquinas fracas (até 4 núcleos, como muitas das salas) o site usa 65 mil de propósito
  check('150 mil estrelas (65 mil em máquina de até 4 núcleos)', s.stars === s.starsTarget && s.stars >= 50000, `${s.stars} de ${s.starsTarget}`);

  // aparência de galáxia espiral, medida nos pixels da imagem
  const st = await page.evaluate(() => window.IAGalaxy.test.stats(6));
  const ring = armsOnRing(st.samples);
  check('Centro brilhante (bojo)', st.centre > st.mean * 4, `centro ${st.centre.toFixed(0)} × média ${st.mean.toFixed(1)}`);
  check('Dois braços espirais num anel de raio 6', ring.peaks >= 2 && ring.peaks <= 4, `${ring.peaks} trechos claros`);
  // a foto real (NGC 1232) vista deste ângulo tem contraste ~1,8 quando é um plano; com a espessura do disco em 3D,
  // a luz das estrelas velhas sobe e desce do plano e cobre um pouco o espaço entre os braços (~1,7), como numa galáxia de verdade
  const minC = s.photo ? 1.55 : 1.8;
  check('Contraste entre braços e espaço entre eles', ring.contrast > minC, `p90/p10 = ${ring.contrast.toFixed(2)} (mínimo ${minC})`);
  // com a foto real (NGC 1232, VLT/ESO) a foto é a referência: os filtros do VLT quase não mostram o rosa do hidrogênio,
  // então o rosa só é exigido na galáxia desenhada com código
  check('Cores de foto real: braços azulados, centro dourado e regiões rosadas', st.blueFrac > 0.12 && st.warmFrac > 0.08 && (s.photo || st.pinkFrac > 0.003),
    `azul ${(st.blueFrac * 100).toFixed(0)}% · dourado ${(st.warmFrac * 100).toFixed(0)}% · rosa ${(st.pinkFrac * 100).toFixed(1)}%`);
  // como numa foto real: nada estoura em branco (os braços continuam azuis mesmo onde são mais claros)
  // fotorrealismo: de longe, a luz da galáxia na tela vem da fotografia real (NGC 1232, VLT/ESO), não de um desenho
  if (s.photo) {
    const ps = await page.evaluate(() => window.IAGalaxy.test.photoShare());
    check('De longe, a galáxia é a fotografia real (NGC 1232, ESO)', ps.k > 0.99 && ps.share > 0.8, `${(ps.share * 100).toFixed(0)}% da luz vem da foto`);
    const pf = await page.evaluate(() => window.IAGalaxy.test.photoFidelity());
    check('A imagem na tela confere com a foto, ponto a ponto', pf.r > 0.85 && pf.n > 500, `correlação ${pf.r.toFixed(3)} em ${pf.n} pontos`);
  }
  check('Sem brilho estourado na abertura', st.satFrac < 0.004, `${(st.satFrac * 100).toFixed(2)}% dos pixels em branco puro`);
  check('7 tipos de nebulosa para atravessar', s.nebKinds >= 7, `${s.nebKinds} tipos`);

  // clique no braço: só funciona em cima de um braço
  const armHit = await page.evaluate(() => {
    const t = window.IAGalaxy.test, r = 8, a = t.armAngle(r, 0), b = a + Math.PI / 2;
    return { on: t.armAt(Math.cos(a) * r, Math.sin(a) * r), off: t.armAt(Math.cos(b) * r, Math.sin(b) * r), core: t.armAt(0.5, 0.2) };
  });
  check('Detecção de braço: em cima do braço sim, entre braços e no centro não', armHit.on && !armHit.off && !armHit.core, JSON.stringify(armHit));

  // um ponto de braço que esteja livre na tela (sem painel ou rótulo por cima), como uma pessoa escolheria
  // a galáxia gira devagar: se o ponto saiu do braço, mira de novo (como uma pessoa faria)
  let target, hover;
  for (let tries = 0; tries < 3; tries++) {
    target = await page.evaluate(() => {
      const t = window.IAGalaxy.test, cv = document.getElementById('gx-canvas');
      for (const r of [7, 8, 6, 9, 5.5, 10]) for (const k of [1, 0]) {
        const p = t.armScreen(k, r);
        if (p.onScreen && document.elementFromPoint(p.x, p.y) === cv) return p;
      }
      return t.armScreen(1, 7);
    });
    await page.mouse.move(target.x + (tries ? 3 : 0), target.y, { steps: 4 });
    // no Chrome automático a cena roda a poucos quadros por segundo: espera o rótulo aparecer
    await waitFor(page, () => !document.querySelector('.gx-reticle').classList.contains('off'), 3000);
    hover = await page.evaluate(() => ({ ret: !document.querySelector('.gx-reticle').classList.contains('off'), lab: !document.querySelector('.gx-label.arm').classList.contains('off'), cur: document.getElementById('gx-canvas').classList.contains('point') }));
    if (hover.ret && hover.lab && hover.cur) break;
  }
  check('Passar o mouse num braço mostra a mira e o rótulo', hover.ret && hover.lab && hover.cur, hover.ret && hover.lab && hover.cur ? '' : JSON.stringify({ ...hover, x: Math.round(target.x), y: Math.round(target.y), on: target.onScreen }));

  // viagem completa
  await page.evaluate(() => window.IAGalaxy.test.record(true));
  target = await page.evaluate(() => window.IAGalaxy.test.armScreen(1, 7));
  await page.mouse.click(target.x, target.y);
  await sleep(300);
  s = await state(page);
  check('Clique no braço inicia a viagem', s.mode === 'travel' && s.nebOn, `modo ${s.mode}`);
  check('Legenda de documentário no início', /braço/i.test(s.caption), s.caption.slice(0, 60));
  const tTravel = Date.now();
  // no meio do mergulho no braço: a imagem não pode virar uma faixa de luz estourada
  await waitFor(page, () => { const s = window.IAGalaxy.test.state(); return s.phase !== 'in' || s.cam[1] < 8; }, 12000);
  const mid = await page.evaluate(() => window.IAGalaxy.test.stats());
  check('Mergulho no braço sem faixa de luz estourada', mid.satFrac < 0.02 && mid.brightFrac < 0.7,
    `branco puro ${(mid.satFrac * 100).toFixed(2)}% · claros ${(mid.brightFrac * 100).toFixed(0)}%`);
  const arrived = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'system', 25000);
  const tripMs = Date.now() - tTravel;
  const rec = await page.evaluate(() => window.IAGalaxy.test.record(false));
  s = await state(page);
  check('Chega ao sistema planetário', arrived, `${(tripMs / 1000).toFixed(1)} s`);
  check('A câmera atravessa a nebulosa no caminho', s.sawNeb && rec.some(r => r.inNeb));
  const phases = [...new Set(rec.map(r => r.phase).filter(Boolean))];
  check('Fases na ordem: entrada no braço → chegada', phases.join('>') === 'in>arrive', phases.join(' > '));
  const { c: c1, how: how1 } = await trocaMedida(browser, rec, 'c1', 'galaxy', 'system');
  const w1 = how1 ? ` · ${how1}` : '';
  check('Sem corte: posição contínua na troca galáxia → sistema', c1.found && c1.speedRatio > 0.3 && c1.speedRatio < 3.5, (c1.found ? `velocidade ×${c1.speedRatio.toFixed(2)}` : 'troca não encontrada') + w1);
  check('Sem corte: direção contínua na troca', c1.found && c1.turnAt < Math.max(40, c1.turnBefore * 4), (c1.found ? `${c1.turnAt.toFixed(1)}°/s` : '') + w1);
  // velocidade quadro a quadro: um corte apareceria como um pico isolado
  const spd = rec.slice(1).map((r, k) => Math.hypot(...r.p.map((v, j) => v - rec[k].p[j])) / Math.max(1, r.t - rec[k].t));
  let spike = 0;
  spd.forEach((v, k) => {
    const win = spd.slice(Math.max(0, k - 4), k).concat(spd.slice(k + 1, k + 5)).sort((a, b) => a - b);
    if (win.length >= 4) spike = Math.max(spike, v / Math.max(win[win.length >> 1], 1e-6));
  });
  const frameMs = (rec[rec.length - 1].t - rec[0].t) / Math.max(1, rec.length - 1);
  check('Nenhum salto de câmera durante a viagem', spike < 3, `maior pico ×${spike.toFixed(2)} · ${rec.length} quadros (${(1000 / frameMs).toFixed(0)} fps)`);
  const nanCam = rec.some(r => r.p.some(v => !Number.isFinite(v)) || r.d.some(v => !Number.isFinite(v)));
  check('Câmera sem valores inválidos (NaN)', !nanCam);
  check('Sistema: 8 planetas com rótulo e painel aberto', s.planetLabels === 8 && s.sysPanel && !s.hero, `${s.planetLabels} rótulos`);
  const ss = await page.evaluate(() => window.IAGalaxy.test.stats());
  check('Galáxia visível ao fundo do sistema', ss.mean > 5, `brilho médio ${ss.mean.toFixed(1)}`);
  // o fundo é um braço de estrelas (céu do braço ligado), sem a faixa estourada do centro
  check('Fundo do sistema: braço de estrelas e centro suavizado', s.armSky > 0.95 && ss.brightFrac < 0.35, `céu ${s.armSky.toFixed(2)} · claros ${(ss.brightFrac * 100).toFixed(0)}%`);
  const kind1 = s.nebKind;

  // planeta
  await page.click('#gxs-list [data-i="3"]');
  await sleep(1900);
  s = await state(page);
  check('Clique na lista abre o planeta', s.mode === 'focus' && s.planetPanel && s.planetTitle === 'Chatbots', s.planetTitle);
  await page.click('#gxp-back');
  await sleep(1900);
  s = await state(page);
  check('Voltar ao sistema', s.mode === 'system' && s.sysPanel);
  // clique num planeta pelo rótulo
  await page.evaluate(() => [...document.querySelectorAll('.gx-label')].find(b => b.textContent.includes('Prompts')).click());
  await sleep(1900);
  s = await state(page);
  check('Clique no rótulo do planeta abre o tema', s.mode === 'focus' && s.planetTitle === 'Prompts', s.planetTitle);
  await page.keyboard.press('Escape');
  await sleep(1900);
  s = await state(page);
  check('Esc volta ao sistema', s.mode === 'system');

  // volta para a galáxia, também sem corte
  await page.evaluate(() => window.IAGalaxy.test.record(true));
  await page.click('#gxs-back');
  const back = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'galaxy', 20000);
  const rec2 = await page.evaluate(() => window.IAGalaxy.test.record(false));
  s = await state(page);
  check('Volta para a galáxia', back && s.hero && !s.nebOn);
  const { c: c2, how: how2 } = await trocaMedida(browser, rec2, 'c2', 'system', 'galaxy');
  check('Sem corte na volta (sistema → galáxia)', c2.found && c2.speedRatio > 0.3 && c2.speedRatio < 3.5 && c2.turnAt < Math.max(40, c2.turnBefore * 4),
    (c2.found ? `velocidade ×${c2.speedRatio.toFixed(2)} · ${c2.turnAt.toFixed(1)}°/s` : 'troca não encontrada') + (how2 ? ` · ${how2}` : ''));

  // marcador fixo também leva ao sistema
  await sleep(600);
  const pinOk = await page.evaluate(() => { const p = document.querySelector('.gx-label.pin'); if (!p || p.classList.contains('off')) return false; p.click(); return true; });
  await sleep(300);
  s = await state(page);
  check('Marcador "Sistema dos temas" inicia a viagem', pinOk && s.mode === 'travel');
  check('Cada viagem atravessa um tipo diferente de nebulosa', s.nebKind !== kind1 && s.nebKind >= 0, `1ª: ${kind1} · 2ª: ${s.nebKind}`);
  await waitFor(page, () => window.IAGalaxy.test.state().mode === 'system', 25000);
  await page.keyboard.press('Escape');
  await waitFor(page, () => window.IAGalaxy.test.state().mode === 'galaxy', 20000);

  // buraco negro
  await page.click('#gx-enter');
  const inBH = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'inside', 8000);
  s = await state(page);
  check('Entrar no buraco negro', inBH && s.bhPanel);
  // transição suave: a última imagem some aos poucos (sem clarão branco)
  // a imagem antiga começa a sumir dois quadros depois da troca (no Chrome automático, poucos quadros por segundo)
  await waitFor(page, () => document.querySelector('.gx-xfade')?.classList.contains('out'), 3000);
  const xf = await page.evaluate(() => { const x = document.querySelector('.gx-xfade'); return { has: !!x, out: x && x.classList.contains('out'), flash: getComputedStyle(document.getElementById('gx-flash')).opacity }; });
  check('Entrada no buraco negro com transição suave (sem clarão)', xf.has && xf.out && +xf.flash < 0.05, JSON.stringify(xf));
  await page.click('#gxb-parts [data-part="2"]');
  const partTxt = await page.$eval('#gxb-text', el => el.textContent);
  check('Partes do buraco negro explicadas', /fótons/i.test(partTxt));
  await page.click('#gxb-exit');
  const outBH = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'galaxy', 5000);
  check('Sair do buraco negro', outBH);
  await sleep(2400);

  // botão Iniciar → apresentação e volta pela barra lateral
  await page.click('#gx-start');
  const started = await waitFor(page, () => !document.documentElement.classList.contains('intro-on'), 6000);
  check('Iniciar abre a apresentação', started);
  const slideOk = await page.evaluate(() => !!document.querySelector('.slide.active, .slide.is-active, [data-slide].active') || location.hash !== '');
  check('Um slide está ativo', slideOk);
  await page.click('#gx-open');
  const reopened = await waitFor(page, () => document.documentElement.classList.contains('intro-on') && window.IAGalaxy.test.state().mode === 'galaxy', 6000);
  check('Volta para a galáxia pela barra lateral', reopened);

  s = await state(page);
  console.log(`    fps medido: ${s.fps} (só informativo; no Chrome automático pode ser mais baixo)`);
  check('Console sem erros', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

/* =========================================================
   Celular 375×812
   ========================================================= */
async function mobile(browser) {
  current = 'Celular 375×812';
  console.log(`\n${current}`);
  const { page, errors } = await openPage(browser, { width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const ready = await waitFor(page, () => window.IAGalaxy && window.IAGalaxy.test, 30000);
  check('A galáxia carregou no celular', ready);
  if (!ready) return;
  await sleep(2000);
  const ov = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
  check('Sem rolagem horizontal', ov);
  let s = await state(page);
  check('Painel inicial visível', s.hero);
  const st = await page.evaluate(() => window.IAGalaxy.test.stats(6));
  check('Galáxia aparece na tela do celular', st.mean > 4 && st.centre > st.mean * 3, `média ${st.mean.toFixed(1)}`);
  const pin = await page.evaluate(() => { const p = document.querySelector('.gx-label.pin'); if (!p || p.classList.contains('off')) return null; const r = p.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  if (pin) await page.touchscreen.tap(pin.x, pin.y);
  await sleep(300);
  s = await state(page);
  check('Toque no marcador inicia a viagem', !!pin && s.mode === 'travel');
  const arrived = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'system', 25000);
  s = await state(page);
  check('Chega ao sistema no celular', arrived && s.sysPanel && s.sawNeb);
  const panelFits = await page.evaluate(() => { const r = document.getElementById('gx-sys').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
  check('Painel do sistema cabe na tela', panelFits);
  await page.click('#gxs-back');
  const back = await waitFor(page, () => window.IAGalaxy.test.state().mode === 'galaxy', 20000);
  check('Volta para a galáxia no celular', back);
  check('Console sem erros', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

/* ---------- execução ---------- */
const browser = await puppeteer.launch({
  headless: !args.has('--headful'),
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--enable-webgl', '--use-angle=default', '--autoplay-policy=no-user-gesture-required', '--window-size=1440,900']
});
try {
  if (!args.has('--so-celular')) await desktop(browser);
  if (!args.has('--so-desktop')) await mobile(browser);
} catch (e) {
  check('Execução sem exceções', false, e.message);
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} verificações passaram.`);
if (failed.length) { console.log('Falharam:'); failed.forEach(f => console.log(`  - [${f.group}] ${f.name} ${f.detail}`)); }
process.exit(failed.length ? 1 : 0);
