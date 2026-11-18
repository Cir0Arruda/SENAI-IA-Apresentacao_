/* =========================================================
   Viagem galáxia → sistema → galáxia a 60 quadros por segundo exatos
   Troca o relógio da página por um relógio virtual: cada quadro anda 1/60 s,
   por mais lento que o computador seja. Assim as medidas de "sem corte" valem
   igual num PC com placa de vídeo e num servidor sem placa (onde o teste
   normal roda a 1–20 quadros/s e essas duas medidas ficam instáveis).

   Rodar:   node tests/viagem-60fps.test.mjs
   Precisa do Puppeteer (npm i -D puppeteer) ou de PUPPETEER_PATH.
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const tryReq = p => { try { return req(p); } catch { return null; } };
const puppeteer = tryReq('puppeteer') || (process.env.PUPPETEER_PATH && tryReq(process.env.PUPPETEER_PATH));
if (!puppeteer) { console.error('Puppeteer não encontrado. Instale com "npm i -D puppeteer" ou defina PUPPETEER_PATH.'); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = http.createServer((rq, rs) => {
  const url = decodeURIComponent(rq.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rs.writeHead(404); rs.end(); return; }
  rs.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(rs);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

// relógio virtual (o mesmo de tools/gravar-videos.mjs)
const CLOCK = `(() => {
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

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok: !!ok, detail }); console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? `  (${detail})` : ''}`); };
const ang = (a, b) => Math.acos(Math.min(1, Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180 / Math.PI;
// a mesma medida de tests/galaxy.test.mjs
function continuity(rec, fromView, toView) {
  const i = rec.findIndex((r, k) => k > 0 && rec[k - 1].view === fromView && r.view === toView);
  if (i < 2) return { found: false };
  const sp = k => Math.hypot(...rec[k].p.map((v, j) => v - rec[k - 1].p[j])) / Math.max(1, rec[k].t - rec[k - 1].t);
  const av = k => ang(rec[k].d, rec[k - 1].d) / Math.max(1, rec[k].t - rec[k - 1].t) * 1000;
  return { found: true, speedRatio: sp(i) / Math.max(sp(i - 1), 1e-6), turnAt: av(i), turnBefore: av(i - 1) };
}

const browser = await puppeteer.launch({ headless: true, args: ['--ignore-gpu-blocklist', '--enable-webgl', '--window-size=960,600'] });
const errors = [];
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 960, height: 600, deviceScaleFactor: 0.5 });   // a imagem não importa aqui, só a câmera
  page.on('pageerror', e => errors.push(String(e)));
  await page.evaluateOnNewDocument(CLOCK);
  await page.goto(`${BASE}?teste`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.IAGalaxy && window.IAGalaxy.test, { timeout: 120000, polling: 500 });
  const step = n => page.evaluate(k => { for (let i = 0; i < k; i++) window.__step(1000 / 60); }, n);
  const st = () => page.evaluate(() => window.IAGalaxy.test.state());
  for (let i = 0; i < 10; i++) await step(30);                                       // 5 s assentando

  console.log('\nViagem a 60 quadros/s (relógio virtual)');
  await page.evaluate(() => window.IAGalaxy.test.record(true));
  const t = await page.evaluate(() => window.IAGalaxy.test.armScreen(1, 7));
  await page.mouse.move(t.x, t.y); await step(2); await page.mouse.click(t.x, t.y);
  let ok = false, mid = null;
  for (let k = 0; k < 400 && !ok; k++) {
    await step(5); const s = await st(); ok = s.mode === 'system' && s.view === 'system';
    const d = Math.hypot(...s.cam);
    if (!mid && s.view === 'galaxy' && d < 12 && d > 6) { await page.evaluate(() => window.IAGalaxy.test.record(false)); await page.evaluate(() => { window.__ps = null; window.IAGalaxy.test.photoShare().then(v => (window.__ps = v)); }); for (let j = 0; j < 20 && !(await page.evaluate(() => window.__ps)); j++) await step(1); mid = { d, ...(await page.evaluate(() => window.__ps)) }; await page.evaluate(() => window.IAGalaxy.test.record(true)); }
  }
  // no meio do mergulho, perto do braço, o que se vê ainda é a fotografia (não um desenho)
  check('No meio do mergulho a galáxia ainda é a fotografia', mid && mid.share > 0.8, mid ? `a ${mid.d.toFixed(1)} unidades do centro: ${(mid.share * 100).toFixed(0)}% da luz vem da foto` : 'não medido');
  await step(60);
  let rec = await page.evaluate(() => window.IAGalaxy.test.record(false));
  check('Chega ao sistema planetário', ok);
  const c1 = continuity(rec, 'galaxy', 'system');
  check('Sem corte: posição contínua na troca galáxia → sistema', c1.found && c1.speedRatio > 0.3 && c1.speedRatio < 3.5, c1.found ? `velocidade ×${c1.speedRatio.toFixed(2)}` : 'troca não encontrada');
  check('Sem corte: direção contínua na troca galáxia → sistema', c1.found && c1.turnAt < 40, c1.found ? `${c1.turnAt.toFixed(1)}°/s` : '');

  await step(60);
  await page.evaluate(() => window.IAGalaxy.test.record(true));
  await page.evaluate(() => document.querySelector('#gxs-close')?.click());
  ok = false;
  for (let k = 0; k < 160 && !ok; k++) { await step(15); const s = await st(); ok = s.mode === 'galaxy' && s.view === 'galaxy' && !s.phase; }
  await step(60);
  rec = await page.evaluate(() => window.IAGalaxy.test.record(false));
  check('Volta para a galáxia', ok);
  const c2 = continuity(rec, 'system', 'galaxy');
  check('Sem corte na volta (sistema → galáxia)', c2.found && c2.speedRatio > 0.3 && c2.speedRatio < 3.5 && c2.turnAt < Math.max(40, c2.turnBefore * 4),
    c2.found ? `velocidade ×${c2.speedRatio.toFixed(2)} · ${c2.turnAt.toFixed(1)}°/s` : 'troca não encontrada');
  check('Sem erros de JavaScript', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('Execução sem exceções', false, e.message);
} finally {
  await browser.close(); server.close();
}
const passed = results.filter(r => r.ok).length;
console.log(`\n${passed}/${results.length} verificações passaram.`);
process.exit(passed === results.length ? 0 : 1);
