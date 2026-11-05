/* =========================================================
   Testes automatizados dos slides (usabilidade e bugs)
   Passa por todos os slides como uma pessoa, no computador e no
   celular, e confere: navegação, nada saindo da tela, demos do
   estúdio de vídeo funcionando e console sem erros.

   Rodar:   node tests/slides.test.mjs
   Precisa do Puppeteer (npm i -D puppeteer) ou de PUPPETEER_PATH.
   Opções:  --headful  --so-desktop  --so-celular
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
if (!puppeteer) { console.error('Puppeteer não encontrado. Instale com "npm i -D puppeteer" ou defina PUPPETEER_PATH.'); process.exit(2); }

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
const server = http.createServer((rq, rs) => {
  const url = decodeURIComponent(rq.url.split('?')[0]);
  const file = path.join(ROOT, url === '/' ? 'index.html' : url);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { rs.writeHead(404); rs.end(); return; }
  rs.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(rs);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const results = [];
let group = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
function check(name, ok, detail = '') {
  results.push({ group, name, ok: !!ok, detail });
  console.log(`${ok ? '  ✔' : '  ✘'} ${name}${detail ? `  (${detail})` : ''}`);
}
async function waitFor(page, fn, timeout = 10000, arg) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    try { if (await page.evaluate(fn, arg)) return true; } catch { /* carregando */ }
    await sleep(120);
  }
  return false;
}
const active = page => page.evaluate(() => {
  const all = [...document.querySelectorAll('.slide')], on = all.filter(s => s.classList.contains('active'));
  const s = on[0];
  return { n: on.length, i: all.indexOf(s), total: all.length, id: s && (s.dataset.id || ''), h2: s && s.querySelector('h2, h1') ? s.querySelector('h2, h1').textContent.trim() : '' };
});
// clica como uma pessoa: no centro do elemento visível (funciona com o zoom do fit())
async function tap(page, sel) {
  const pt = await page.evaluate(q => {
    const el = [...document.querySelectorAll(q)].find(e => e.getClientRects().length);
    if (!el) return null;
    let r = el.getBoundingClientRect();
    if (r.top < 0 || r.bottom > innerHeight) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); r = el.getBoundingClientRect(); }
    const x = r.x + r.width / 2, y = r.y + r.height / 2, hit = document.elementFromPoint(x, y);
    return { x, y, hit: hit && (hit === el || el.contains(hit)) ? 'ok' : (hit ? hit.outerHTML.slice(0, 140) : 'nada') };
  }, sel);
  if (process.env.DEBUG_TAP && pt) console.log('    tap', sel, Math.round(pt.x), Math.round(pt.y), pt.hit);
  if (!pt) throw new Error(`Elemento não encontrado: ${sel}`);
  await page.mouse.click(pt.x, pt.y);
}
async function goto(page, i) {   // índice 0-based, pelos atalhos do próprio site
  await page.evaluate(n => { location.hash = `#${n + 1}`; }, i);
  await page.reload({ waitUntil: 'load' });
  await waitFor(page, n => document.querySelectorAll('.slide')[n]?.classList.contains('active'), 8000, i);
  await sleep(500);
}

async function openPage(browser, vp) {
  const page = await browser.newPage();
  await page.setViewport(vp);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|ERR_INTERNET_DISCONNECTED|fonts\.g/i.test(m.text())) errors.push(m.text()); });
  page.on('requestfailed', r => { if (r.url().startsWith(BASE)) errors.push(`falhou: ${r.url()}`); });
  return { page, errors };
}

// percorre todos os slides com a seta para a direita e confere cada um
async function tour(page, mobile) {
  await page.goto(`${BASE}#1`, { waitUntil: 'load' });
  await waitFor(page, () => document.querySelector('.slide.active'), 8000);
  await sleep(600);
  const first = await active(page);
  check('Abre direto no slide 1 pelo endereço #1', first.i === 0, `slide ${first.i + 1}`);
  check('A apresentação tem 27 slides', first.total === 27, `${first.total}`);
  const bad = [], seen = new Set(), over = [];
  for (let k = 0; k < first.total; k++) {
    const a = await active(page);
    seen.add(a.i);
    if (a.n !== 1) bad.push(`${k + 1}: ${a.n} ativos`);
    const m = await page.evaluate(() => {
      const s = document.querySelector('.slide.active');
      const wide = [...s.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed'; })
        .filter(e => !e.closest('pre, .code, .term-body, .lv-code, .sv-term, .wf-sh, .pc-body, .xl-sheet, table'));   // blocos de código rolam por dentro
      return { pageX: document.documentElement.scrollWidth - innerWidth, slideX: s.scrollWidth - s.clientWidth, wide: wide.slice(0, 3).map(e => e.className || e.tagName) };
    });
    if (m.pageX > 1 || m.slideX > 1 || m.wide.length) over.push(`${k + 1}(${a.id || 'slide'}): ${m.pageX}/${m.slideX} ${m.wide.join(',')}`);
    if (k < first.total - 1) {
      await page.keyboard.press('ArrowRight');
      await waitFor(page, n => document.querySelectorAll('.slide')[n]?.classList.contains('active'), 3000, a.i + 1);
      await sleep(mobile ? 250 : 350);
    }
  }
  check('Seta → passa por todos os slides, um ativo de cada vez', bad.length === 0 && seen.size === first.total, bad.join('; ') || `${seen.size} slides`);
  check('Nenhum slide sai da tela na horizontal', over.length === 0, over.join(' | ').slice(0, 300));
  const last = await active(page);
  check('Último slide: botão "próximo" desativado', last.i === first.total - 1 && await page.$eval('#btn-next', b => b.disabled));
}

async function desktop(browser) {
  group = 'Computador 1440×900'; console.log(`\n${group}`);
  const ctx = browser.defaultBrowserContext();
  await ctx.overridePermissions(BASE, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write']).catch(() => {});
  const { page, errors } = await openPage(browser, { width: 1440, height: 900 });
  await tour(page, false);

  // navegação pelos atalhos (barra lateral, chips e botões)
  await goto(page, 0);
  await tap(page, '.rail-btn[data-sec="fontes"]'); await sleep(500);
  let a = await active(page);
  check('Barra lateral → Fontes abre as referências', /Referências/.test(a.h2), a.h2);
  const nRefs = await page.$$eval('.slide.active .ref', r => r.length);
  check('Fontes com as novas referências do estúdio (27 no total)', nRefs === 27, `${nRefs}`);
  const refOk = await page.$$eval('.slide.active .ref', r => r.every(x => /^https:\/\//.test(x.href) && x.target === '_blank' && /noopener/.test(x.rel)));
  check('Todas as referências abrem em nova aba com https e noopener', refOk);
  await tap(page, '.dock-chips [data-goto="24"]'); await sleep(500);
  a = await active(page);
  check('Chip "Quiz" leva ao quiz', a.id === 'quiz', a.id);
  await tap(page, '.rail-btn[data-sec="video"]'); await sleep(500);
  a = await active(page);
  check('Barra lateral → Vídeo abre o início do estúdio', a.id === 'video', a.id);
  await tap(page, '.slide.active [data-goto="17"]'); await sleep(500);
  a = await active(page);
  const railOn = await page.$eval('.rail-btn[data-sec="video"]', b => b.classList.contains('on'));
  check('Botão "Ver o fluxo completo" leva ao slide 18 e a seção fica marcada', a.id === 'vflow' && railOn, `${a.id} · seção ${railOn}`);

  // 18 · fluxo completo
  const autoNext = await waitFor(page, () => document.querySelector('#vf-steps button.on')?.dataset.s === '2', 7000);
  check('Fluxo: as etapas avançam sozinhas', autoNext);
  await tap(page, '#vf-steps [data-s="5"]');
  const rendered = await waitFor(page, () => /150 \/ 150/.test(document.getElementById('vf-fn').textContent), 6000);
  const frames = await page.$$eval('#vf-frames i', f => f.length);
  check('Fluxo: etapa Render grava os 150 quadros', rendered && frames >= 8, `${frames} miniaturas`);
  const winOn = await page.$$eval('#vf-pc .pc-win.on', w => w.map(x => x.dataset.w));
  check('Fluxo: só a janela da etapa escolhida aparece', winOn.length === 1 && winOn[0] === '5', winOn.join(','));
  await tap(page, '#vf-steps [data-s="4"]');
  const checked = await waitFor(page, () => /0 erros/.test(document.getElementById('vf-check').textContent), 5000);
  check('Fluxo: etapa Revisão mostra o check sem erros', checked);

  // 19 · níveis
  await page.keyboard.press('ArrowRight'); await sleep(600);
  a = await active(page);
  check('Seta → vai para "5 níveis"', a.id === 'vlevels', a.id);
  const prompts = new Set();
  for (let l = 0; l < 5; l++) {
    await tap(page, `#lv-tabs [data-l="${l}"]`); await sleep(250);
    const st = await page.evaluate(n => ({ on: document.querySelector(`#lv-stage .lv-scene[data-l="${n}"]`).classList.contains('on'), p: document.getElementById('lv-prompt').textContent, code: document.getElementById('lv-code').textContent }), l);
    if (st.on && st.p.length > 40 && st.code.length > 30) prompts.add(st.p);
  }
  check('Níveis: as 5 abas trocam a prévia, o pedido e o código', prompts.size === 5, `${prompts.size} pedidos diferentes`);
  await tap(page, '#lv-tabs [data-l="2"]');
  const counted = await waitFor(page, () => document.getElementById('lv-num').textContent.replace(/\D/g, '') === '1248', 6000);
  check('Nível 3: o número conta até o valor da planilha (1.248)', counted, await page.$eval('#lv-num', e => e.textContent));
  await tap(page, '#lv-tabs [data-l="3"]'); await sleep(600);
  const px3d = await page.evaluate(() => { const c = document.getElementById('lv-3d'), d = c.getContext('2d').getImageData(c.width / 2 - 20, c.height / 2 - 20, 40, 40).data; let s = 0; for (let i = 0; i < d.length; i += 4) s += d[i] + d[i + 1] + d[i + 2]; return s / (d.length / 4) / 3; });
  check('Nível 4: o planeta é desenhado na prévia', px3d > 30, `brilho ${px3d.toFixed(0)}`);
  await tap(page, '#lv-tabs [data-l="4"]');
  const batchDone = await waitFor(page, () => document.querySelectorAll('#lv-batch .k5-card.done').length >= 4, 8000);
  check('Nível 5: os vídeos em lote terminam um por um', batchDone);
  await tap(page, '#lv-copy'); await sleep(300);
  const clip = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  const lvPrompt = await page.$eval('#lv-prompt', e => e.textContent.trim());
  check('Botão Copiar copia o pedido do nível', clip === lvPrompt, clip ? 'copiado' : 'área de transferência vazia');

  // 20 · 3D
  await page.keyboard.press('ArrowRight');
  const has3d = await waitFor(page, () => !!window.IAStudio3D, 8000);
  await sleep(800);
  check('3D: a cena three.js carregou', has3d);
  const det = await page.evaluate(() => { const c = document.getElementById('t3-canvas'); window.IAStudio3D.desenhar(2); const a = c.toDataURL(); window.IAStudio3D.desenhar(4); const b = c.toDataURL(); window.IAStudio3D.desenhar(2); const a2 = c.toDataURL(); return { same: a === a2, diff: a !== b, len: a.length }; });
  check('3D: o mesmo instante gera sempre a mesma imagem (determinístico)', det.same && det.diff && det.len > 20000, JSON.stringify(det));
  await page.evaluate(() => { const r = document.getElementById('t3-time'); r.value = 300; r.dispatchEvent(new Event('input')); });
  await sleep(200);
  const hud = await page.$eval('#t3-hud', e => e.textContent);
  check('3D: arrastar a linha do tempo leva ao instante escolhido', /3,00 s · quadro 90/.test(hud), hud);
  await tap(page, '#t3-snap'); await sleep(400);
  const thumbs = await page.$$eval('#t3-thumbs img', i => i.map(x => x.src.length));
  check('3D: "Gravar 3 quadros" mostra as 3 imagens', thumbs.length === 3 && thumbs.every(l => l > 5000), thumbs.join(','));
  await tap(page, '#t3-shot [data-c="dive"]'); await sleep(200);
  const shotOn = await page.$eval('#t3-shot .on', b => b.dataset.c);
  check('3D: troca de câmera (mergulho)', shotOn === 'dive');

  // 21 · planilha → vídeos
  await page.keyboard.press('ArrowRight');
  const svDone = await waitFor(page, () => document.querySelectorAll('#sv-out .sv-vid.done').length === 4, 30000);
  const svRows = await page.$$eval('#sv-table tr.hl', r => r.length);
  check('Planilha → vídeo: lê as 4 linhas e gera os 4 vídeos', svDone && svRows === 4, `${svRows} linhas lidas`);

  // 22 · workflow
  await page.keyboard.press('ArrowRight');
  const toast = await waitFor(page, () => document.getElementById('wf-toast').classList.contains('show'), 25000);
  const outs = await page.$$eval('#wf-out .file', f => f.length);
  const lastNode = await page.$eval('#wf-nodes li.on', l => l.dataset.n).catch(() => null);
  check('Workflow: o agente gera 4 vídeos e para na revisão humana', toast && outs === 4 && lastNode === '4', `${outs} vídeos · etapa ${lastNode}`);
  // trocar de slide no meio da animação não deixa nada rodando
  await tap(page, '#wf-run'); await sleep(600);
  await page.keyboard.press('ArrowLeft'); await sleep(1500);
  const leaked = await page.$$eval('#wf-out .file', f => f.length);
  check('Sair do slide cancela a animação (sem trabalho escondido)', leaked === 0, `${leaked} arquivos depois de sair`);
  await page.keyboard.press('ArrowRight'); await sleep(400);

  // 23 · mão na massa
  await page.keyboard.press('ArrowRight'); await sleep(600);
  a = await active(page);
  const labs = await page.$$eval('.slide.active .lab', l => l.length);
  await tap(page, '.slide.active .lab .copy-btn'); await sleep(300);
  const lab1 = await page.evaluate(() => navigator.clipboard.readText().catch(() => ''));
  check('Mão na massa: 4 desafios e o pedido é copiado', a.id === 'vlab' && labs === 4 && /vinheta|6 segundos/i.test(lab1), `${labs} desafios`);

  // teclado no slide: Home/End
  await page.keyboard.press('End'); await sleep(400);
  a = await active(page);
  check('Tecla End vai para o último slide', a.i === 26, `${a.i + 1}`);
  await page.keyboard.press('Home'); await sleep(400);
  a = await active(page);
  check('Tecla Home volta ao primeiro slide', a.i === 0);

  check('Console sem erros', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

async function mobile(browser) {
  group = 'Celular 375×812'; console.log(`\n${group}`);
  const { page, errors } = await openPage(browser, { width: 375, height: 812, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await tour(page, true);
  await goto(page, 17);
  const steps = await page.$$eval('#vf-steps button', b => b.filter(x => x.getBoundingClientRect().width > 100).length);
  check('Celular: etapas do fluxo visíveis e clicáveis', steps === 6, `${steps}`);
  await goto(page, 19);
  const t3 = await page.$eval('.t3-view', v => v.getBoundingClientRect().width);
  check('Celular: cena 3D cabe na largura', t3 > 250 && t3 <= 375, `${Math.round(t3)} px`);
  check('Console sem erros', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

const browser = await puppeteer.launch({ headless: args.has('--headful') ? false : 'new', args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
try {
  if (!args.has('--so-celular')) await desktop(browser);
  if (!args.has('--so-desktop')) await mobile(browser);
} catch (e) {
  check('O teste rodou até o fim', false, String(e).slice(0, 200));
} finally {
  await browser.close();
  server.close();
}
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length}/${results.length} verificações passaram.`);
if (fails.length) { console.log('Falharam:'); fails.forEach(f => console.log(`  - [${f.group}] ${f.name} ${f.detail}`)); }
process.exit(fails.length ? 1 : 0);
