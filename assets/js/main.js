/* IA na Prática · navegação dos slides e demos animadas */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Controle de animações ----------
     Cada demo pede um "job". Ele deixa de valer quando o slide muda
     ou quando a mesma demo é reiniciada. */
  let epoch = 0;
  const jobs = {};
  function job(key) {
    const id = (jobs[key] = (jobs[key] || 0) + 1);
    const e = epoch;
    return () => jobs[key] === id && epoch === e;
  }
  async function type(el, text, alive, speed = 18) {
    if (reduce || speed === 0) { el.textContent = text; return; }
    el.textContent = '';
    el.classList.add('typing');
    for (let i = 0; i < text.length; i++) {
      if (!alive()) return;
      el.textContent += text[i];
      await sleep(speed);
    }
    el.classList.remove('typing');
  }
  const wait = async (ms, alive) => { await sleep(reduce ? 0 : ms); return alive(); };
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Mascote (SVG) ---------- */
  const ROBOT = `
  <svg class="bot" viewBox="0 0 120 150" aria-hidden="true">
    <defs>
      <linearGradient id="rbH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe1f2"/></linearGradient>
      <linearGradient id="rbB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d3d6ec"/></linearGradient>
      <radialGradient id="rbV" cx="40%" cy="30%" r="80%"><stop offset="0" stop-color="#2a3150"/><stop offset="1" stop-color="#0d1020"/></radialGradient>
    </defs>
    <ellipse cx="60" cy="143" rx="30" ry="5" fill="rgba(54,52,130,.18)"/>
    <g class="arm-l"><rect x="20" y="92" width="12" height="30" rx="6" fill="url(#rbB)" stroke="#c9cce4" transform="rotate(18 26 96)"/></g>
    <g class="arm-r"><rect x="88" y="92" width="12" height="30" rx="6" fill="url(#rbB)" stroke="#c9cce4" transform="rotate(-18 94 96)"/></g>
    <path d="M32 100c0-14 12-22 28-22s28 8 28 22v12c0 14-12 24-28 24s-28-10-28-24z" fill="url(#rbB)" stroke="#cdd0e6"/>
    <rect x="46" y="98" width="28" height="4" rx="2" fill="#c9cce4"/>
    <circle class="core" cx="60" cy="114" r="4.5" fill="#ff8a3d"/>
    <rect x="10" y="34" width="12" height="26" rx="6" fill="url(#rbB)" stroke="#cdd0e6"/>
    <rect x="98" y="34" width="12" height="26" rx="6" fill="url(#rbB)" stroke="#cdd0e6"/>
    <rect x="16" y="10" width="88" height="70" rx="32" fill="url(#rbH)" stroke="#cdd0e6"/>
    <rect x="26" y="22" width="68" height="46" rx="22" fill="url(#rbV)"/>
    <path d="M34 28c8-4 20-5 30-3" stroke="rgba(255,255,255,.25)" stroke-width="3" stroke-linecap="round" fill="none"/>
    <g class="eyes" fill="none" stroke="#4fe3ff" stroke-width="4.5" stroke-linecap="round">
      <path d="M42 48q6-9 12 0"/><path d="M66 48q6-9 12 0"/>
    </g>
    <path d="M53 55q7 7 14 0z" fill="#4fe3ff"/>
  </svg>`;
  $$('.bot-slot').forEach(s => (s.innerHTML = ROBOT));

  /* ---------- Navegação ---------- */
  const slides = $$('.slide');
  const total = slides.length;
  let cur = -1;
  const pad = n => String(n).padStart(2, '0');

  slides.forEach(s => $$('[data-anim]', s).forEach((el, i) => el.style.setProperty('--i', i)));

  const secOf = i => (i >= 15 ? 'fontes' : i >= 12 && i <= 12 ? 'video' : i >= 9 && i <= 11 ? 'agentes' : i === 8 ? 'prompt' : i >= 3 && i <= 7 ? 'ferr' : null);

  let titleJob = 0, bubTimer = 0;
  async function typeTitle(text) {
    const my = ++titleJob;
    const el = $('#dock-title');
    if (reduce) { el.textContent = text; return; }
    el.textContent = '';
    for (const ch of text) {
      if (my !== titleJob) return;
      el.textContent += ch;
      await sleep(14);
    }
  }

  function go(i) {
    i = Math.max(0, Math.min(total - 1, i));
    if (i === cur) return;
    epoch++;
    const prev = slides[cur];
    if (prev) { prev.classList.remove('active'); demos[prev.dataset.id]?.leave?.(); }
    cur = i;
    const s = slides[i];
    s.classList.add('active');
    s.scrollTop = 0;

    $('#progress').style.width = `${((i + 1) / total) * 100}%`;
    $('#dock-label').textContent = `Slide ${pad(i + 1)} de ${total}`;
    typeTitle(s.dataset.title || '');
    $('#btn-prev').disabled = i === 0;
    $('#btn-next').disabled = i === total - 1;

    const sec = secOf(i);
    $$('.rail-btn[data-sec]').forEach(b => b.classList.toggle('on', b.dataset.sec === sec));

    const bub = $('#mascot-bubble');
    clearTimeout(bubTimer);
    bub.classList.remove('show');
    if (i > 0) {
      bubTimer = setTimeout(() => {
        bub.textContent = s.dataset.bubble || '';
        bub.classList.add('show');
        bubTimer = setTimeout(() => bub.classList.remove('show'), 4200);
      }, 450);
    }

    if (location.hash !== `#${i + 1}`) history.replaceState(null, '', `#${i + 1}`);
    demos[s.dataset.id]?.enter?.();
    // demos que não têm id específico mas têm contadores
    if (i === 2) demoWhat();
  }

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-goto]');
    if (t) { e.preventDefault(); go(+t.dataset.goto); }
  });
  $('#btn-prev').addEventListener('click', () => go(cur - 1));
  $('#btn-next').addEventListener('click', () => go(cur + 1));
  $('#btn-fs').addEventListener('click', () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.();
  });

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    if (['input', 'textarea', 'select'].includes(tag)) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(cur + 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(cur - 1); }
    else if (e.key === ' ' && tag !== 'button') { e.preventDefault(); go(cur + (e.shiftKey ? -1 : 1)); }
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(total - 1);
    else if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey) $('#btn-fs').click();
  });

  let tx = 0, ty = 0;
  $('#slides').addEventListener('touchstart', e => { tx = e.touches[0].clientX; ty = e.touches[0].clientY; }, { passive: true });
  $('#slides').addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= total) go(n - 1);
  });

  /* =========================================================
     DEMOS
     ========================================================= */
  const demos = {};

  /* --- O que é IA: barras de probabilidade + contador --- */
  async function demoWhat() {
    const alive = job('what');
    const bars = $('#nt-bars'), blank = $('#nt-blank');
    bars.classList.remove('go'); blank.textContent = '____';
    const num = $('[data-count]');
    num.textContent = '0';
    if (!(await wait(500, alive))) return;
    bars.classList.add('go');
    for (let k = 1; k <= 7; k++) { if (!(await wait(90, alive))) return; num.textContent = k; }
    if (!(await wait(900, alive))) return;
    await type(blank, 'indústria', alive, 60);
  }

  /* --- 1.1 Tradução --- */
  const PHRASES = [
    {
      pt: 'Bom dia, turma! Hoje vamos aprender sobre IA.',
      en: "Good morning, class! Today we're going to learn about AI.",
      es: '¡Buenos días, clase! Hoy vamos a aprender sobre IA.',
      ja: 'おはようございます、みなさん！今日はAIについて学びます。',
      back: 'Bom dia, turma! Hoje vamos aprender sobre IA.',
      note: '✅ Frase simples e direta: os tradutores acertam quase sempre.'
    },
    {
      pt: 'Cansei, vou chutar o balde.',
      en: "I'm fed up, I'm going to give up on everything.",
      es: 'Estoy harto, voy a mandarlo todo al diablo.',
      ja: 'もううんざりだ、全部投げ出すよ。',
      back: 'Estou farto, vou desistir de tudo.',
      literal: "I'm tired, I'm going to kick the bucket.",
      note: '⚠️ Expressão idiomática! Traduzida palavra por palavra vira "kick the bucket", que em inglês quer dizer MORRER. A IA moderna entende pelo contexto, mas sempre confira.',
      warn: true
    },
    {
      pt: 'O motor está superaquecendo: desligue a máquina e chame a manutenção.',
      en: 'The motor is overheating: shut down the machine and call maintenance.',
      es: 'El motor se está sobrecalentando: apague la máquina y llame a mantenimiento.',
      ja: 'モーターが過熱しています。機械を停止して、保守担当者を呼んでください。',
      back: 'O motor está superaquecendo: desligue a máquina e chame a manutenção.',
      note: '🔧 Texto técnico: em manuais e avisos de segurança, peça para alguém da área revisar os termos.'
    }
  ];
  let trIdx = 0;
  async function runTranslate() {
    const alive = job('tr');
    const p = PHRASES[trIdx];
    $$('#tr-phrases button').forEach(b => b.classList.toggle('on', +b.dataset.p === trIdx));
    const note = $('#tr-note');
    note.textContent = ''; note.classList.remove('warn');
    $('#tr-backout').innerHTML = '';
    $('#tr-literal').hidden = !p.literal;
    ['#tr-en', '#tr-es', '#tr-ja'].forEach(s => ($(s).textContent = ''));
    await type($('#tr-src'), p.pt, alive, 22);
    if (!(await wait(250, alive))) return;
    await Promise.all([
      type($('#tr-en'), p.en, alive, 20),
      type($('#tr-es'), p.es, alive, 20),
      type($('#tr-ja'), p.ja, alive, 45)
    ]);
    if (!alive()) return;
    note.textContent = p.note;
    note.classList.toggle('warn', !!p.warn);
  }
  $('#tr-phrases').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    trIdx = +b.dataset.p; runTranslate();
  });
  $('#tr-back').addEventListener('click', async () => {
    const alive = job('trback');
    const out = $('#tr-backout');
    out.innerHTML = 'EN → PT: <span></span>';
    await type($('span', out), PHRASES[trIdx].back, alive, 22);
  });
  $('#tr-literal').addEventListener('click', async () => {
    const alive = job('trback');
    const out = $('#tr-backout');
    out.innerHTML = 'Palavra por palavra: <span class="bad"></span>';
    await type($('span', out), PHRASES[trIdx].literal + '  → "Cansei, vou morrer." 😱', alive, 22);
  });
  demos.translate = { enter() { trIdx = 0; runTranslate(); } };

  /* --- 1.2 Assistentes --- */
  const CMDS = [
    { json: { intencao: 'criar_lembrete', tarefa: 'levar o EPI', quando: 'amanhã, 07:00' }, reply: '⏰ Pronto! Amanhã às 7h eu te lembro de levar o EPI.' },
    { json: { intencao: 'calcular', expressao: '240 × 0,15' }, reply: '🧮 15% de 240 é 36.' },
    { json: { intencao: 'tocar_musica', estilo: 'instrumental para estudar' }, reply: '🎧 Tocando uma playlist instrumental para estudar.' },
    { json: { intencao: 'rota', destino: 'SENAI Iracemápolis', modo: 'ônibus' }, reply: '🗺️ Abrindo o mapa com a rota de ônibus até o SENAI.' }
  ];
  const wave = $('#as-wave');
  wave.innerHTML = Array.from({ length: 18 }, () => '<i></i>').join('');
  let waveRaf = 0;
  function waveOn(on) {
    cancelAnimationFrame(waveRaf);
    const bars = $$('i', wave);
    if (!on) { bars.forEach(b => (b.style.height = '8px')); return; }
    const loop = t => {
      bars.forEach((b, k) => (b.style.height = `${10 + Math.abs(Math.sin(t / 120 + k * .7)) * 50 * (0.4 + Math.random() * .6)}px`));
      waveRaf = requestAnimationFrame(loop);
    };
    waveRaf = requestAnimationFrame(loop);
  }
  async function runAssistant(i) {
    const alive = job('as');
    const c = CMDS[i];
    $$('#as-cmds button').forEach((b, k) => b.classList.toggle('on', k === i));
    const steps = $$('.as-step');
    steps.forEach(s => s.classList.remove('on', 'done'));
    $('#as-json').textContent = '{ }';
    $('#as-reply').textContent = '';
    const mark = n => steps.forEach((s, k) => { s.classList.toggle('on', k === n); s.classList.toggle('done', k < n); });

    mark(0); waveOn(true);
    if (!(await wait(1300, alive))) return waveOn(false);
    waveOn(false); mark(1);
    if (!(await wait(800, alive))) return;
    mark(2);
    await type($('#as-json'), JSON.stringify(c.json, null, 2), alive, 12);
    if (!(await wait(400, alive))) return;
    mark(3);
    if (!(await wait(900, alive))) return;
    mark(4);
    await type($('#as-reply'), c.reply, alive, 22);
    if (!alive()) return;
    steps.forEach(s => { s.classList.remove('on'); s.classList.add('done'); });
  }
  $('#as-cmds').addEventListener('click', e => {
    const b = e.target.closest('button'); if (b) runAssistant(+b.dataset.c);
  });
  demos.assistant = { enter() { runAssistant(0); }, leave() { waveOn(false); } };

  /* --- 1.3 Chatbots --- */
  let cbMode = 'rules';
  const chat = $('#cb-chat');
  function addMsg(text, cls) {
    const m = document.createElement('div');
    m.className = `msg ${cls}`;
    m.textContent = text;
    chat.appendChild(m);
    chat.scrollTop = chat.scrollHeight;
    return m;
  }
  async function typingDots(alive, ms) {
    const d = document.createElement('div');
    d.className = 'msg bot dots'; d.innerHTML = '<i></i><i></i><i></i>';
    chat.appendChild(d); chat.scrollTop = chat.scrollHeight;
    const ok = await wait(ms, alive);
    d.remove();
    return ok;
  }
  async function runChat() {
    const alive = job('cb');
    chat.innerHTML = '';
    $$('#cb-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === cbMode));
    addMsg(cbMode === 'rules' ? 'Bot de regras: só entende as opções do menu' : 'Bot com IA: entende linguagem natural (exemplo simulado)', 'sys');
    if (!(await wait(500, alive))) return;
    addMsg($('#cb-q').textContent, 'user');
    if (cbMode === 'rules') {
      if (!(await typingDots(alive, 700))) return;
      addMsg('Olá! Escolha uma opção:\n1️⃣ Matrícula\n2️⃣ Horários\n3️⃣ Boletos\n4️⃣ Falar com atendente', 'bot');
      if (!(await wait(1300, alive))) return;
      addMsg('perdi a aula 😕', 'user');
      if (!(await typingDots(alive, 600))) return;
      addMsg('Opção inválida. Digite 1, 2, 3 ou 4.', 'bot');
      if (!(await wait(1000, alive))) return;
      addMsg('😩', 'user');
    } else {
      if (!(await typingDots(alive, 1300))) return;
      addMsg('Oi! Sem problemas 😊 Ontem, em Fundamentos, a aula foi sobre tradução automática e assistentes virtuais.\n\n📌 Atividade: testar 3 frases no tradutor e anotar os erros. Entrega até sexta.\n\nQuer que eu te mande um resumo da aula?', 'bot ai');
      if (!(await wait(1500, alive))) return;
      addMsg('Quero sim, valeu!', 'user');
      if (!(await typingDots(alive, 900))) return;
      addMsg('Enviado! Se tiver dúvida na atividade, é só me chamar. 🚀', 'bot ai');
    }
  }
  $('#cb-mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    cbMode = b.dataset.m; runChat();
  });
  $('#cb-send').addEventListener('click', runChat);
  demos.chatbot = { enter() { runChat(); } };

  /* --- 1.4 Geração (difusão) --- */
  const cv = $('#gen-canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const W = cv.width, H = cv.height;
  const SCENES = [
    { prompt: '"Esfera laranja sobre pedras brancas, luz suave de estúdio, estilo 3D minimalista"', draw: drawSphere },
    { prompt: '"Lua lilás de vidro flutuando sobre um mar calmo ao amanhecer, estilo 3D"', draw: drawMoon }
  ];
  let scene = 0;
  function ball(g, x, y, r, c0, c1, c2) {
    const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
    gr.addColorStop(0, c0); gr.addColorStop(.55, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  function rock(g, x, y, rx, ry) {
    const gr = g.createLinearGradient(x, y - ry, x, y + ry);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#d9cfc5');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  function drawSphere(g) {
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#f4e7db'); gr.addColorStop(1, '#e7d3c2');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(30, 0, 40, H * .7); g.fillRect(250, 0, 26, H * .6);
    g.fillStyle = 'rgba(150,110,80,.18)'; g.beginPath(); g.ellipse(190, 170, 90, 14, 0, 0, Math.PI * 2); g.fill();
    rock(g, 120, 168, 46, 20); rock(g, 250, 172, 40, 16); rock(g, 175, 178, 30, 12);
    ball(g, 190, 108, 58, '#ffe0c2', '#ff8a3d', '#e04800');
    ball(g, 88, 150, 26, '#ffffff', '#ece6e0', '#c9bdb2');
  }
  function drawMoon(g) {
    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#d9dcff'); gr.addColorStop(.6, '#f6e3d6'); gr.addColorStop(.61, '#b9bdf0'); gr.addColorStop(1, '#8f93d9');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 6; k++) g.fillRect(40 + k * 40, 130 + k * 9, 120 - k * 12, 2);
    ball(g, 160, 72, 46, '#ffffff', '#b8b5ff', '#6c67e0');
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(145, 55, 12, 7, -.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(184,181,255,.35)'; g.beginPath(); g.ellipse(160, 150, 40, 6, 0, 0, Math.PI * 2); g.fill();
  }
  const off = document.createElement('canvas'); off.width = W; off.height = H;
  const octx = off.getContext('2d', { willReadFrequently: true });
  function noiseFrame() {
    const img = ctx.createImageData(W, H);
    for (let p = 0; p < img.data.length; p += 4) {
      const v = Math.random() * 255;
      img.data[p] = v * .9 + Math.random() * 25; img.data[p + 1] = v * .9; img.data[p + 2] = v; img.data[p + 3] = 255;
    }
    return img;
  }
  async function runGenerate() {
    const alive = job('gen');
    $('#gen-prompt').textContent = SCENES[scene].prompt;
    SCENES[scene].draw(octx);
    const target = octx.getImageData(0, 0, W, H).data;
    const noise = noiseFrame();
    const n = noise.data;
    const out = ctx.createImageData(W, H);
    const o = out.data;
    const steps = 40;
    const labels = ['ruído puro', 'formas aparecem', 'cores surgem', 'detalhes', 'pronto ✨'];
    for (let k = 0; k <= steps; k++) {
      if (!alive()) return;
      const t = k / steps;
      const a = t * t * (3 - 2 * t);
      for (let p = 0; p < o.length; p += 4) {
        const jitter = (Math.random() - .5) * 120 * (1 - a);
        o[p] = target[p] * a + n[p] * (1 - a) + jitter;
        o[p + 1] = target[p + 1] * a + n[p + 1] * (1 - a) + jitter;
        o[p + 2] = target[p + 2] * a + n[p + 2] * (1 - a) + jitter;
        o[p + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
      $('#gen-step').textContent = `passo ${k}/${steps}`;
      $('#gen-label').textContent = labels[Math.min(4, Math.floor(t * 4.01))];
      $('#gen-bar').style.width = `${t * 100}%`;
      await sleep(reduce ? 0 : 80);
    }
  }
  $('#gen-go').addEventListener('click', runGenerate);
  $('#gen-swap').addEventListener('click', () => { scene = (scene + 1) % SCENES.length; runGenerate(); });
  ctx.putImageData(noiseFrame(), 0, 0);
  demos.generate = { enter() { runGenerate(); } };

  /* --- 1.5 Resumo --- */
  const SUM_SRC = [
    'A manutenção preventiva é o conjunto de ações planejadas para evitar que máquinas e equipamentos quebrem durante a produção.',
    'Em vez de esperar a falha acontecer, a equipe segue um cronograma de inspeções, lubrificação, limpeza e troca de peças com desgaste.',
    'Essa prática reduz paradas inesperadas, que costumam custar caro e atrasar entregas.',
    'Além disso, máquinas bem cuidadas trabalham com mais segurança, o que diminui o risco de acidentes com os operadores.',
    'Para funcionar, a manutenção preventiva depende de registros organizados: cada intervenção precisa ser anotada, com data, responsável e o que foi feito.',
    'Com esses dados, a empresa consegue prever quando um componente vai falhar e agir antes.',
    'Hoje, sensores e softwares com inteligência artificial ajudam nessa tarefa, analisando vibração, temperatura e ruído para avisar sobre problemas que o olho humano não percebe.'
  ];
  const EXT_KEEP = [[0, 1, 2, 3, 4, 5, 6], [0, 2, 3, 6], [0, 6], [0]];
  const EXT_LBL = ['Completo', 'Médio', 'Curto', 'Uma frase'];
  const ABS = [
    null,
    'Manutenção preventiva é cuidar das máquinas antes que elas quebrem, seguindo um cronograma de inspeções e troca de peças. Isso evita paradas caras, deixa o trabalho mais seguro e, com registros bem feitos e sensores com IA, permite prever falhas.',
    'Cuidar das máquinas antes da falha evita paradas, aumenta a segurança e, com ajuda da IA, permite prever problemas.',
    '• O que é: ações planejadas para evitar quebras\n• Por quê: menos paradas e mais segurança\n• Como: cronograma + registros organizados\n• Futuro: sensores e IA preveem falhas'
  ];
  const ABS_LBL = ['Completo', 'Médio', 'Curto', 'Tópicos'];
  let sumMode = 'ext';
  const words = s => s.trim().split(/\s+/).filter(w => w !== '•').length;
  function renderSummary(animate) {
    const lvl = +$('#sum-range').value;
    const box = $('#sum-text');
    $$('#sum-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === sumMode));
    $('#sum-label').textContent = (sumMode === 'ext' ? EXT_LBL : ABS_LBL)[lvl];
    const full = SUM_SRC.join(' ');
    if (sumMode === 'ext' || lvl === 0) {
      box.classList.remove('abs');
      if (!box.querySelector('.s')) box.innerHTML = SUM_SRC.map((s, k) => `<span class="s" data-k="${k}">${esc(s)}</span>`).join(' ');
      const keep = EXT_KEEP[lvl];
      $$('.s', box).forEach(el => {
        const k = +el.dataset.k;
        el.classList.toggle('keep', lvl > 0 && keep.includes(k));
        el.classList.toggle('drop', lvl > 0 && !keep.includes(k));
      });
      const n = keep.reduce((a, k) => a + words(SUM_SRC[k]), 0);
      $('#sum-count').textContent = `${n} de ${words(full)} palavras`;
    } else {
      box.classList.remove('abs'); void box.offsetWidth; box.classList.add('abs');
      box.textContent = ABS[lvl];
      $('#sum-count').textContent = `${words(ABS[lvl])} de ${words(full)} palavras`;
    }
  }
  $('#sum-range').addEventListener('input', () => renderSummary(true));
  $('#sum-mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    sumMode = b.dataset.m; $('#sum-text').innerHTML = ''; renderSummary(true);
  });
  async function autoSummary() {
    const alive = job('sum');
    sumMode = 'ext'; $('#sum-range').value = 0; $('#sum-text').innerHTML = ''; renderSummary();
    for (const v of [1, 2]) {
      if (!(await wait(1600, alive))) return;
      $('#sum-range').value = v; renderSummary(true);
    }
  }
  demos.summary = { enter: autoSummary };

  /* --- 1.6 Prompt builder --- */
  const ING = {
    papel: ['Papel', 'Você é um professor do SENAI, paciente e didático.'],
    contexto: ['Contexto', 'Sou aluno do 1º ano do técnico, estudo à noite e tenho prova de Eletricidade Básica daqui a 2 semanas.'],
    formato: ['Formato', 'Entregue em uma tabela com: dia, tema, tempo e exercício.'],
    exemplo: ['Exemplo', 'Exemplo de linha: Dia 1 | Lei de Ohm | 40 min | 5 cálculos de corrente.'],
    restricoes: ['Restrições', 'No máximo 1 hora por dia, folga aos domingos. Linguagem simples.'],
    pensar: ['Passo a passo', 'Antes de montar, pense em quais temas dependem de outros e ordene do mais básico ao mais avançado.']
  };
  const ORDER = ['papel', 'contexto', 'formato', 'exemplo', 'restricoes', 'pensar'];
  const on = new Set();
  const ANS = [
    `<p>Claro! Aqui vai um plano de estudos:</p><p>1. Estude todos os dias.<br>2. Faça resumos.<br>3. Revise antes da prova.</p><p class="muted">😐 Genérico: a IA não sabe quem você é, o que vai estudar nem para quando.</p>`,
    `<p>Plano de estudos para curso técnico:</p><p><b>Semana 1:</b> revisar os conceitos básicos da matéria.<br><b>Semana 2:</b> fazer exercícios e simulados.</p><p class="muted">🙂 Melhorou, mas ainda está vago.</p>`,
    `<p>Plano de 14 dias para Eletricidade Básica:</p><table><tr><th>Dia</th><th>Tema</th><th>Tempo</th><th>Exercício</th></tr><tr><td>1</td><td>Tensão e corrente</td><td>50 min</td><td>Questões do livro</td></tr><tr><td>2</td><td>Lei de Ohm</td><td>50 min</td><td>Cálculos simples</td></tr><tr><td>…</td><td>…</td><td>…</td><td>…</td></tr></table><p class="muted">😀 Bom! Já está organizado e no formato certo.</p>`,
    `<p>Ordenei do básico ao avançado: sem corrente e tensão não dá para entender a Lei de Ohm; sem ela, não dá para entender potência.</p><table><tr><th>Dia</th><th>Tema</th><th>Tempo</th><th>Exercício</th></tr><tr><td>1</td><td>Tensão, corrente e resistência</td><td>40 min</td><td>Mapa mental dos conceitos</td></tr><tr><td>2</td><td>Lei de Ohm</td><td>40 min</td><td>5 cálculos de corrente</td></tr><tr><td>3</td><td>Potência elétrica</td><td>45 min</td><td>4 problemas P = V × I</td></tr><tr><td>7</td><td colspan="3"><i>Domingo: folga</i> 😴</td></tr><tr><td>14</td><td>Simulado final</td><td>60 min</td><td>Prova antiga cronometrada</td></tr></table><p class="muted">🤩 Excelente: personalizado, no formato pedido e respeitando suas regras.</p>`
  ];
  function renderPrompt() {
    $$('#pb-toggles button').forEach(b => b.classList.toggle('on', on.has(b.dataset.k)));
    const lines = ORDER.filter(k => on.has(k)).map(k => `<span><span class="k">[${ING[k][0]}]</span> ${esc(ING[k][1])}</span>`);
    const base = `<span class="base"><span class="k">[Tarefa]</span> Crie um plano de estudos${on.has('contexto') ? ' de 14 dias para essa prova' : ''}.</span>`;
    const pIdx = lines.findIndex(l => l.includes('[Papel]'));
    if (pIdx === 0) lines.splice(1, 0, base); else lines.unshift(base);
    $('#pb-prompt').innerHTML = lines.join('');
    const n = on.size;
    $('#pb-meter').style.width = `${8 + (n / 6) * 92}%`;
    $('#pb-score').textContent = ['Vago 😐', 'Vago 😐', 'Melhorando 🙂', 'Bom 😀', 'Bom 😀', 'Ótimo 🤩', 'Excelente 🤩'][n];
    const ai = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3;
    const box = $('#pb-answer');
    if (box.dataset.lvl !== String(ai)) {
      box.dataset.lvl = ai;
      box.style.animation = 'none'; void box.offsetWidth; box.style.animation = '';
      box.innerHTML = ANS[ai];
    }
  }
  $('#pb-toggles').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    job('pb');
    const k = b.dataset.k;
    on.has(k) ? on.delete(k) : on.add(k);
    renderPrompt();
  });
  async function autoPrompt() {
    const alive = job('pb');
    on.clear(); renderPrompt();
    for (const k of ['papel', 'contexto', 'formato']) {
      if (!(await wait(1400, alive))) return;
      on.add(k); renderPrompt();
    }
  }
  demos.prompt = { enter: autoPrompt };

  /* --- Extra: ciclo do agente --- */
  const AG_STEPS = [
    [0, 'Pensar', 'Primeiro preciso ver quais fotos existem.'],
    [1, 'Agir', 'Rodo <code>ls fotos/</code>'],
    [2, 'Observar', '152 arquivos. A data está no nome: <code>2026-10-03_oficina.jpg</code>'],
    [0, 'Pensar', 'Vou criar uma pasta para cada mês e mover as fotos.'],
    [1, 'Agir', 'Crio <code>2026-09/</code>, <code>2026-10/</code> e movo os arquivos'],
    [2, 'Observar', '3 fotos sem data no nome. Preciso tratar esse caso.'],
    [3, 'Repetir', 'Leio a data de criação dessas 3 fotos e movo também.'],
    [2, 'Observar', 'Conferido: 152 de 152 fotos organizadas, 0 erros.'],
    [-1, 'Entregar', '✅ Pronto! Criei 3 pastas e um relatório <code>resumo.md</code>.']
  ];
  async function runAgent() {
    const alive = job('ag');
    const log = $('#ag-log'); log.innerHTML = '';
    const nodes = $$('.loop-node');
    const prog = $('#ag-prog');
    const C = 678.6;
    for (let k = 0; k < AG_STEPS.length; k++) {
      if (!alive()) return;
      const [n, label, text] = AG_STEPS[k];
      nodes.forEach((el, j) => el.classList.toggle('on', j === n));
      prog.style.strokeDashoffset = n < 0 ? 0 : C - C * ((n + 1) / 4);
      const li = document.createElement('li');
      li.className = n < 0 ? 'final t3' : `t${n}`;
      li.innerHTML = `<em>${label}</em><span>${text}</span>`;
      log.appendChild(li); log.scrollTop = log.scrollHeight;
      if (!(await wait(1500, alive))) return;
    }
    nodes.forEach(el => el.classList.remove('on'));
    if (!(await wait(3500, alive))) return;
    runAgent();
  }
  demos.agent = { enter: runAgent };

  /* --- Extra: terminal --- */
  const TERM = [
    ['p', 'crie uma apresentação em HTML sobre IA na prática, com glassmorphism e exemplos animados'],
    ['a', 'Vou ler o repositório primeiro.'],
    ['t', 'Read README.md'],
    ['a', 'Pesquisando fontes confiáveis…'],
    ['t', 'Web Search "TIC Educação 2024 Cetic.br"'],
    ['t', 'Web Search "UNESCO guidance generative AI education"'],
    ['a', 'Criando os arquivos da apresentação'],
    ['t', 'Write index.html'],
    ['t', 'Write assets/css/style.css'],
    ['t', 'Write assets/js/main.js'],
    ['a', 'Testando no navegador, no desktop e no celular… <span class="ok">✓ tudo certo</span>'],
    ['a', '<span class="cm">git commit</span> -m "Apresentação de IA na prática"'],
    ['a', '<span class="cm">gh pr create</span> <span class="ok">✓ pull request aberto</span>'],
    ['p', 'deixa o título da capa maior']
  ];
  async function runTerm() {
    const alive = job('term');
    const body = $('#term-body'); body.innerHTML = '';
    for (const [cls, text] of TERM) {
      if (!alive()) return;
      const line = document.createElement('div');
      line.className = cls;
      body.appendChild(line);
      if (cls === 'p') {
        const plain = text;
        await type(line, plain, alive, 28);
        if (!(await wait(500, alive))) return;
      } else {
        line.innerHTML = text;
        line.style.animation = 'rise .4s both';
        if (!(await wait(cls === 't' ? 380 : 700, alive))) return;
      }
      body.scrollTop = body.scrollHeight;
    }
  }
  $('#term-replay').addEventListener('click', runTerm);
  demos.terminal = { enter: runTerm };

  /* --- Extra: skill --- */
  const SKILL_MD = [
    ['fm', '---'],
    ['kv', 'name', 'slides-senai'],
    ['kv', 'description', 'Cria slides HTML no estilo da turma (vidro, laranja e lilás). Use quando pedirem uma apresentação ou slides.'],
    ['fm', '---'],
    ['', ''],
    ['h', '# Slides SENAI'],
    ['', ''],
    ['li', '1.', 'Pergunte o tema e quantos slides.'],
    ['li', '2.', 'Comece a partir de modelo.html.'],
    ['li', '3.', 'Use as cores de paleta.css.'],
    ['li', '4.', 'Coloque um exemplo prático em cada slide.'],
    ['li', '5.', 'Termine com um slide de fontes.']
  ];
  async function runSkill() {
    const alive = job('sk');
    const box = $('#sk-md'); box.innerHTML = '';
    for (const row of SKILL_MD) {
      if (!alive()) return;
      const line = document.createElement('div');
      box.appendChild(line);
      if (row[0] === 'kv') {
        line.innerHTML = `<span class="key">${row[1]}:</span> <span class="v"></span>`;
        await type($('.v', line), row[2], alive, 12);
      } else if (row[0] === 'li') {
        line.innerHTML = `<span class="n">${row[1]}</span> <span class="v"></span>`;
        await type($('.v', line), row[2], alive, 14);
      } else {
        line.className = row[0];
        line.textContent = row[1] || ' ';
        if (!(await wait(120, alive))) return;
      }
    }
  }
  demos.skill = { enter: runSkill };

  /* --- Bônus: editor de vídeo --- */
  const prev = $('#ed-preview');
  const scenesEl = $$('.ed-scene', prev);
  let edRaf = 0, edT = 0, edLast = 0, edSpeed = 1;
  const DUR = 20;
  function edFrame(now) {
    const dt = Math.min(.1, (now - (edLast || now)) / 1000);
    edLast = now;
    edT = (edT + dt * edSpeed) % DUR;
    const sc = edT < 5 ? 0 : edT < 12 ? 1 : 2;
    scenesEl.forEach((s, k) => s.classList.toggle('on', k === sc));
    const sec = Math.floor(edT);
    $('#ed-tc').textContent = `00:${pad(sec)}`;
    const tracks = $('#ed-tracks');
    const lane = $('.lane', tracks);
    const x = lane.offsetLeft + (edT / DUR) * lane.offsetWidth;
    $('#ed-playhead').style.left = `${x}px`;
    edRaf = requestAnimationFrame(edFrame);
  }
  $$('.ed-edits button').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.e;
    if (e === 'color') prev.classList.toggle('orange');
    if (e === 'vertical') prev.classList.toggle('vertical');
    if (e === 'speed') edSpeed = edSpeed === 1 ? 2 : 1;
    const active = e === 'color' ? prev.classList.contains('orange') : e === 'vertical' ? prev.classList.contains('vertical') : edSpeed === 2;
    b.classList.toggle('on', active);
  }));
  demos.video = {
    enter() { cancelAnimationFrame(edRaf); edLast = 0; edT = 0; edRaf = requestAnimationFrame(edFrame); },
    leave() { cancelAnimationFrame(edRaf); }
  };

  /* --- Ética: checklist --- */
  const checks = $$('#eth-checks input');
  function renderEthics() {
    const n = checks.filter(c => c.checked).length;
    $('#eth-num').textContent = `${n}/5`;
    $('#eth-ring').style.strokeDashoffset = 314.16 * (1 - n / 5);
    $('#eth-ok').classList.toggle('show', n === 5);
  }
  checks.forEach(c => c.addEventListener('change', renderEthics));

  /* --- Quiz --- */
  const QUIZ = [
    { q: 'Qual destes prompts tende a dar a melhor resposta?', o: ['Faz um resumo', 'Resuma este texto em 3 tópicos, para alunos do 1º ano', 'resumo pfv'], a: 1, e: 'Quanto mais claro o pedido (tarefa, formato e público), melhor a resposta.' },
    { q: 'Traduzir "chutar o balde" palavra por palavra dá "kick the bucket". Em inglês, isso significa…', o: ['Desistir de tudo', 'Morrer', 'Jogar futebol'], a: 1, e: 'Expressões idiomáticas são armadilhas clássicas. Traduza de volta para conferir.' },
    { q: 'Qual a principal diferença entre um chatbot e um agente de IA?', o: ['O agente usa ferramentas e executa ações até cumprir o objetivo', 'O chatbot é sempre mais inteligente', 'Não existe diferença'], a: 0, e: 'O agente segue o ciclo pensar → agir → observar → repetir.' },
    { q: 'A IA te passou uma data histórica para o trabalho. O que você faz?', o: ['Copio direto, IA não erra', 'Pergunto de novo até mudar', 'Confiro em uma fonte confiável'], a: 2, e: 'A IA pode "alucinar". Confirmar em fontes confiáveis é obrigatório.' },
    { q: 'Em um resumo abstrativo, a IA…', o: ['Copia as frases mais importantes', 'Reescreve as ideias com palavras novas', 'Traduz o texto para o inglês'], a: 1, e: 'O extrativo copia frases; o abstrativo reescreve, como os chatbots fazem.' }
  ];
  let qi = 0, qs = 0;
  function renderQuiz() {
    const it = QUIZ[qi];
    $('#qz-n').textContent = `Pergunta ${qi + 1} de ${QUIZ.length}`;
    $('#qz-score').textContent = `${qs} acerto${qs === 1 ? '' : 's'}`;
    $('#qz-bar').style.width = `${(qi / QUIZ.length) * 100}%`;
    $('#qz-q').textContent = it.q;
    $('#qz-exp').textContent = '';
    $('#qz-next').disabled = true;
    $('#qz-next').textContent = qi === QUIZ.length - 1 ? 'Ver resultado' : 'Próxima →';
    const opts = $('#qz-opts'); opts.innerHTML = '';
    it.o.forEach((t, k) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.addEventListener('click', () => {
        $$('button', opts).forEach((x, j) => { x.disabled = true; if (j === it.a) x.classList.add('right'); });
        if (k === it.a) { qs++; $('#qz-exp').textContent = '✅ Isso! ' + it.e; }
        else { b.classList.add('wrong'); $('#qz-exp').textContent = '❌ Quase. ' + it.e; }
        $('#qz-score').textContent = `${qs} acerto${qs === 1 ? '' : 's'}`;
        $('#qz-next').disabled = false;
      });
      opts.appendChild(b);
    });
  }
  let qDone = false;
  $('#qz-next').addEventListener('click', () => {
    if (qDone) { qDone = false; qi = 0; qs = 0; renderQuiz(); return; }
    if (qi < QUIZ.length - 1) { qi++; renderQuiz(); return; }
    qDone = true;
    $('#qz-bar').style.width = '100%';
    $('#qz-n').textContent = 'Resultado';
    $('#qz-q').textContent = `Você acertou ${qs} de ${QUIZ.length}! ${qs === QUIZ.length ? '🏆 Perfeito!' : qs >= 3 ? '👏 Mandou bem!' : '📚 Vale revisar os slides.'}`;
    $('#qz-opts').innerHTML = '';
    $('#qz-exp').textContent = '';
    $('#qz-next').textContent = '↺ Jogar de novo';
  });
  demos.quiz = { enter() { if (qi === 0) renderQuiz(); } };
  renderQuiz();

  /* ---------- Início ---------- */
  const start = parseInt(location.hash.slice(1), 10);
  go(start >= 1 && start <= total ? start - 1 : 0);
})();
