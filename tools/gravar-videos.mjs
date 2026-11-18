/* =========================================================
   Grava as cenas 3D do site em vídeo (MP4 H.264), quadro a quadro.

   Por que vídeo: a rede do SENAI bloqueia muito JavaScript e os computadores
   da sala nem sempre aguentam o 3D ao vivo. O vídeo roda liso em qualquer lugar,
   até com o JavaScript desligado.

   Como funciona: o relógio do navegador (performance.now, requestAnimationFrame e
   as animações de CSS) é trocado por um relógio virtual. A cada passo o relógio
   anda exatamente 1/30 s e a página é fotografada, então o vídeo sai fluido mesmo
   num computador sem placa de vídeo, que leva segundos para desenhar cada quadro.

   Uso:
     node tools/gravar-videos.mjs galaxia            → assets/video/galaxia.mp4 (+ .jpg)
     node tools/gravar-videos.mjs bigbang            → assets/video/bigbang.mp4 (+ .jpg)
     node tools/gravar-videos.mjs estudio            → assets/video/estudio-3d.mp4 (+ .jpg)
     node tools/gravar-videos.mjs bigbang --de 0 --ate 20 --saida /tmp/parte1.mp4
   Opções: --largura 1280 --altura 720 --fps 30 --crf 20
   Precisa: Playwright (npm i playwright) com o Chromium e o ffmpeg no PATH.
   ========================================================= */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const req = createRequire(import.meta.url);
const { chromium } = req('playwright');

const argv = process.argv.slice(2), which = argv[0];
const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const W = +opt('largura', 1280), H = +opt('altura', 720), FPS = +opt('fps', 30), CRF = opt('crf', '23');
if (!['galaxia', 'bigbang', 'estudio'].includes(which)) { console.error('Use: galaxia | bigbang | estudio'); process.exit(2); }
const OUT = path.resolve(opt('saida', path.join(ROOT, 'assets/video', which === 'estudio' ? 'estudio-3d.mp4' : `${which}.mp4`)));
fs.mkdirSync(path.dirname(OUT), { recursive: true });

/* ---------- servidor local ---------- */
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.mp4': 'video/mp4' };
const srv = http.createServer((q, r) => {
  const u = decodeURIComponent(q.url.split('?')[0]);
  const f = path.join(ROOT, u === '/' ? 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  if (q.method === 'HEAD') return r.end();
  fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;

/* ---------- relógio virtual ---------- */
const CLOCK = `(() => {
  let now = 0, id = 0; const q = [];
  performance.now = () => now;
  const d0 = Date.now(); Date.now = () => d0 + now;
  window.requestAnimationFrame = cb => { q.push([++id, cb]); return id; };
  window.cancelAnimationFrame = i => { const k = q.findIndex(x => x[0] === i); if (k >= 0) q.splice(k, 1); };
  Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });   // qualidade cheia, mesmo num servidor de 4 núcleos
  window.__step = ms => {
    now += ms;
    // animações e transições de CSS andam junto com o relógio virtual
    for (const a of document.getAnimations()) { try { if (a.playState === 'running') a.pause(); if (a.playState !== 'finished') a.currentTime = (a.currentTime || 0) + ms; } catch {} }
    const run = q.splice(0); for (const [, cb] of run) { try { cb(now); } catch (e) { console.error(e); } }
  };
})();`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: which === 'estudio' ? 2 : 1 });   // a cena do estúdio é uma caixa pequena no slide: grava em 2×
page.on('pageerror', e => console.error('erro na página:', e.message));
page.on('console', m => { if (m.type() === 'warning' && /galáxia|cosmos|three/i.test(m.text())) console.error('aviso da página:', m.text()); });
await page.addInitScript(CLOCK);
const step = (n = 1) => page.evaluate(([k, ms]) => { for (let i = 0; i < k; i++) window.__step(ms); }, [n, 1000 / FPS]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

function encoder(file) {
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg saiu com ' + c))));
  return { write: buf => new Promise(r => ff.stdin.write(buf) ? r() : ff.stdin.once('drain', r)), end: () => { ff.stdin.end(); return done; } };
}
const ff = (...a) => new Promise((res, rej) => { const p = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' }); p.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg ' + c))); });
async function record(file, frames, before, clip) {
  const enc = encoder(file), t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    if (before) await before(i); else await step();
    await enc.write(await page.screenshot({ type: 'jpeg', quality: 95, clip, timeout: 0 }));
    if (i % 30 === 29) { const el = (Date.now() - t0) / 1000; console.log(`  ${which}: ${i + 1}/${frames} quadros (${(el / (i + 1)).toFixed(2)} s por quadro, faltam ~${Math.round(el / (i + 1) * (frames - i - 1) / 60)} min)`); }
  }
  await enc.end();
}
const HIDE = css => page.addStyleTag({ content: css });

if (which === 'galaxia') {
  // a galáxia da abertura girando devagar, sem os painéis; o fim emenda no começo (loop sem pulo)
  await page.goto(BASE + '?3d&gravar', { waitUntil: 'load' });
  await page.waitForFunction(() => window.IAGalaxy, null, { timeout: 120000, polling: 250 });
  await HIDE('.gx-bottom,.gx-toast,.gx-panel,.gx-top,.gx-cap,.gx-labels,.gx-hint,#gx-hint,.gx-made{visibility:hidden!important}');   // some da imagem, mas o enquadramento (galáxia à direita, espaço para o texto) fica igual ao do site
  for (let i = 0; i < +opt('aquecer', 12); i++) { await step(30); await sleep(300); }   // a câmera chega da abertura e tudo assenta (12 s)
  const LEN = +opt('segundos', 24), X = 2, tmp = OUT.replace(/\.mp4$/, '.bruto.mp4');
  await record(tmp, (LEN + X) * FPS);
  await ff('-i', tmp, '-filter_complex', `[0]trim=${X}:${LEN + X},setpts=PTS-STARTPTS[a];[0]trim=0:${X},setpts=PTS-STARTPTS[b];[a][b]xfade=transition=fade:duration=${X}:offset=${LEN - X},format=yuv420p`,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', CRF, '-movflags', '+faststart', '-an', OUT);
  fs.unlinkSync(tmp);
  await ff('-ss', '1', '-i', OUT, '-frames:v', '1', '-q:v', '3', OUT.replace(/\.mp4$/, '.jpg'));
}

if (which === 'bigbang') {
  // o final inteiro, com as legendas e o relógio cósmico gravados na imagem
  await page.goto(BASE + '?teste&gravar', { waitUntil: 'load' });
  const idx = await page.evaluate(() => [...document.querySelectorAll('.slide')].findIndex(s => s.dataset.id === 'cosmos'));   // o número do slide muda quando entram slides novos
  await page.goto(BASE + `?teste&gravar&slide=${idx + 1}#${idx + 1}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.IACosmos && window.IADemos?.cosmos, null, { timeout: 120000, polling: 250 });
  await page.evaluate(() => { if (!document.querySelector('.cos.cinema')) window.IADemos.cosmos.enter(); });
  await HIDE('.cos-ctrl,.cos-exit,.cos-fs,.cos-free-tip,.cos-end{display:none!important}.cos-label{transition:none}');
  // carrega tudo antes de gravar: Terra, satélite, escola em 3D (o download acontece em tempo real)
  for (const t of [44, 50, 56, 60, 63, 66, 70]) { await page.evaluate(x => window.IACosmos.seek(x), t); await step(2); await sleep(2500); }
  for (let k = 0; k < 60; k++) { const s = await page.evaluate(() => window.IACosmos.state()); if (s.site && s.tiles > 100) break; await step(); await sleep(1000); }
  console.log('  recursos:', JSON.stringify(await page.evaluate(() => window.IACosmos.state())));
  const total = await page.evaluate(() => window.IACosmos.total);
  const de = +opt('de', 0), ate = Math.min(+opt('ate', total), total), n = Math.round((ate - de) * FPS);
  const clip = await page.evaluate(() => { const r = document.querySelector('.cos-view').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  await page.evaluate(x => window.IACosmos.seek(x), de); await step(3);
  await record(OUT, n, async i => { await page.evaluate(x => { window.IACosmos.seek(x); }, de + i / FPS); await step(); }, clip);
  if (!argv.includes('--de')) await ff('-ss', '33', '-i', OUT, '-frames:v', '1', '-q:v', '3', OUT.replace(/\.mp4$/, '.jpg'));
}

if (which === 'estudio') {
  // o planeta do slide "Cenas 3D no vídeo": 6 s que se repetem igualzinho (o desenho é função do tempo)
  await page.goto(BASE + '?gravar', { waitUntil: 'load' });
  const idx = await page.evaluate(() => [...document.querySelectorAll('.slide')].findIndex(s => s.dataset.id === 'v3d'));
  await page.goto(BASE + `?gravar&slide=${idx + 1}#${idx + 1}`, { waitUntil: 'load' });   // endereço novo: recarrega de verdade (sem a abertura)
  await page.waitForFunction(() => window.IADemos?.v3d, null, { timeout: 60000, polling: 250 });
  await page.evaluate(() => window.IADemos.v3d.enter());
  await step(45);                                        // o slide termina de entrar (1,5 s)
  const clip = await page.evaluate(() => { const r = document.querySelector('.t3-view').getBoundingClientRect(); return { x: r.x, y: r.y, width: Math.floor(r.width / 2) * 2, height: Math.floor(r.height / 2) * 2 }; });
  // exatamente um ciclo (6 s = 180 quadros): o fim emenda no começo
  await record(OUT, 6 * FPS, null, clip);
  await ff('-ss', '2', '-i', OUT, '-frames:v', '1', '-q:v', '3', OUT.replace(/\.mp4$/, '.jpg'));
}

console.log('pronto:', path.relative(ROOT, OUT), (fs.statSync(OUT).size / 1e6).toFixed(1), 'MB');
await browser.close(); srv.close();
