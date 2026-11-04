/* IA na Prática · navegação, demos animadas e Gemini ao vivo */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ic = (name, cls = 'i sm') => `<svg class="${cls}"><use href="#i-${name}"/></svg>`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const br = n => n.toFixed(1).replace('.', ',');
  const pad = n => String(n).padStart(2, '0');

  /* ---------- Controle de animações ---------- */
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
      if (!alive()) { el.classList.remove('typing'); return; }
      el.textContent += text[i];
      await sleep(speed);
    }
    el.classList.remove('typing');
  }
  const wait = async (ms, alive) => { await sleep(reduce ? 0 : ms); return alive(); };

  /* Markdown simples e seguro (o texto é escapado antes) */
  function md(src) {
    const lines = esc(src).replace(/\r/g, '').split('\n');
    let html = '', list = null;
    const inline = s => s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>').replace(/(^|\W)\*(?!\s)(.+?)\*(?=\W|$)/g, '$1<i>$2</i>');
    const close = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const l = raw.trim();
      let m;
      if (!l) { close(); continue; }
      if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); html += `<h4>${inline(m[1])}</h4>`; }
      else { close(); html += `<p>${inline(l)}</p>`; }
    }
    close();
    return html;
  }

  /* =========================================================
     GEMINI — a chave fica só no navegador de quem apresenta
     ========================================================= */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* sem armazenamento */ } }
  };
  const GM = { key: store.get('gm.key') || '', model: store.get('gm.model') || 'gemini-flash-latest' };
  const SYSTEM = 'Você é um assistente de IA ajudando numa apresentação escolar sobre Inteligência Artificial para alunos de um curso técnico do SENAI Iracemápolis (Brasil). Responda sempre em português do Brasil, de forma didática, curta (no máximo 120 palavras, salvo pedido contrário) e com exemplos do dia a dia. Use markdown simples: negrito e listas.';

  function gmDot() { $('#gm-dot').classList.toggle('on', !!GM.key); }
  gmDot();

  async function gemini(contents, { system = SYSTEM, json = false, temperature = 0.7 } = {}) {
    if (!GM.key) { openGm('Cole a chave de API para usar o Gemini ao vivo.'); throw new Error('Configure a chave do Gemini no botão "Gemini", no topo.'); }
    if (typeof contents === 'string') contents = [{ role: 'user', parts: [{ text: contents }] }];
    const body = { contents, generationConfig: { temperature, maxOutputTokens: 4096 } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    if (json) body.generationConfig.responseMimeType = 'application/json';
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GM.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GM.key },
        body: JSON.stringify(body)
      });
    } catch { throw new Error('Sem conexão com o Gemini. Verifique a internet.'); }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = data?.error?.message || `Erro ${r.status}`;
      if (r.status === 400 || r.status === 401 || r.status === 403) throw new Error(`O Gemini recusou a chave ou o pedido: ${msg}`);
      if (r.status === 404) throw new Error(`Modelo "${GM.model}" não encontrado. Troque o modelo no botão "Gemini".`);
      if (r.status === 429) throw new Error('Limite de uso do Gemini atingido. Espere um pouco e tente de novo.');
      throw new Error(msg);
    }
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
    if (!text) throw new Error('O Gemini não devolveu texto para este pedido.');
    return text;
  }
  function parseJSON(t) {
    try { return JSON.parse(t); } catch { /* tenta extrair */ }
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { /* falhou */ } }
    return null;
  }

  /* Modal de configuração */
  const modal = $('#gm-modal');
  function openGm(msg = '') {
    $('#gm-key').value = GM.key;
    $('#gm-model').value = GM.model;
    const st = $('#gm-status');
    st.className = 'modal-status'; st.textContent = msg;
    modal.hidden = false;
    setTimeout(() => $('#gm-key').focus(), 50);
  }
  const closeGm = () => { modal.hidden = true; };
  $('#gm-open').addEventListener('click', () => openGm());
  $('#gm-close').addEventListener('click', closeGm);
  modal.addEventListener('click', e => { if (e.target === modal) closeGm(); });
  $('#gm-save').addEventListener('click', async () => {
    const st = $('#gm-status');
    const key = $('#gm-key').value.trim();
    if (!key) { st.className = 'modal-status err'; st.textContent = 'Cole a chave antes de salvar.'; return; }
    GM.key = key; GM.model = $('#gm-model').value;
    if ($('#gm-remember').checked) { store.set('gm.key', key); store.set('gm.model', GM.model); }
    else { store.del('gm.key'); store.set('gm.model', GM.model); }
    gmDot();
    st.className = 'modal-status'; st.textContent = 'Testando a conexão…';
    try {
      const t = await gemini('Responda apenas com a frase: Gemini conectado!', { system: '', temperature: 0 });
      st.className = 'modal-status ok'; st.textContent = `Funcionou! Resposta: "${t.slice(0, 60)}"`;
      setTimeout(closeGm, 1400);
    } catch (err) { st.className = 'modal-status err'; st.textContent = err.message; }
  });
  $('#gm-clear').addEventListener('click', () => {
    GM.key = ''; store.del('gm.key'); $('#gm-key').value = ''; gmDot();
    const st = $('#gm-status'); st.className = 'modal-status ok'; st.textContent = 'Chave removida deste navegador.';
  });

  /* Painel "Pergunte ao Gemini" */
  const ask = $('#ask');
  const askMsgs = $('#ask-msgs');
  function slideContext() {
    const s = slides[cur];
    const title = $('h2', s)?.innerText.replace(/\s+/g, ' ').trim() || s.dataset.title;
    const text = s.innerText.replace(/\s+\n/g, '\n').replace(/\n{2,}/g, '\n').trim().slice(0, 2500);
    return { title, text };
  }
  function openAsk() {
    ask.hidden = false;
    $('#ask-ctx').textContent = `sobre: ${slideContext().title}`;
    $('#ask-input').focus();
  }
  function bubble(box, cls, html) {
    const m = document.createElement('div');
    m.className = `msg ${cls}`;
    m.innerHTML = html;
    box.appendChild(m);
    box.scrollTop = box.scrollHeight;
    return m;
  }
  function thinking(box) {
    const d = document.createElement('div');
    d.className = 'msg bot dots'; d.innerHTML = '<i></i><i></i><i></i>';
    box.appendChild(d); box.scrollTop = box.scrollHeight;
    return d;
  }
  async function askGemini(q) {
    if (!ask.hidden || true) { if (ask.hidden) openAsk(); }
    const { title, text } = slideContext();
    bubble(askMsgs, 'user', esc(q));
    const d = thinking(askMsgs);
    try {
      const prompt = `Slide atual da apresentação: "${title}".\nConteúdo do slide:\n${text}\n\nPedido do apresentador: ${q}`;
      const ans = await gemini(prompt);
      d.remove();
      bubble(askMsgs, 'gm md', `<span class="gm-badge">${ic('gem')}Gemini</span>${md(ans)}`);
    } catch (err) { d.remove(); bubble(askMsgs, 'err', esc(err.message)); }
  }
  $('#ask-open').addEventListener('click', () => (ask.hidden ? openAsk() : (ask.hidden = true)));
  $('#ask-close').addEventListener('click', () => (ask.hidden = true));
  $('#ask-quick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) askGemini(b.dataset.q); });
  $('#ask-form').addEventListener('submit', e => {
    e.preventDefault();
    const v = $('#ask-input').value.trim(); if (!v) return;
    $('#ask-input').value = ''; askGemini(v);
  });
  document.addEventListener('click', e => { const b = e.target.closest('[data-ask]'); if (b) { openAsk(); askGemini(b.dataset.ask); } });

  /* ---------- Mascote ---------- */
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

  /* =========================================================
     NAVEGAÇÃO
     ========================================================= */
  const slides = $$('.slide');
  const total = slides.length;
  let cur = -1;
  slides.forEach(s => $$('[data-anim]', s).forEach((el, i) => el.style.setProperty('--i', i)));

  const secOf = i => (i >= 19 ? 'fontes' : i === 16 ? 'video' : i >= 12 && i <= 15 ? 'agentes' : i === 11 ? 'prompt' : i >= 6 && i <= 10 ? 'ferr' : i >= 2 && i <= 5 ? 'fund' : null);

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

  /* Encaixa o slide na altura da tela (só diminui, até 74%) */
  const zoomOf = el => el.currentCSSZoom || 1;
  let fitTimers = [];
  function fitStep(s) {
    const w = $('.wrap', s);
    if (!w || innerWidth <= 960) { if (w) w.style.zoom = ''; return; }
    const over = s.scrollHeight - s.clientHeight;
    if (over <= 2) return;
    const cs = getComputedStyle(s);
    const avail = s.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const z = +(w.style.zoom || 1);
    w.style.zoom = Math.max(.74, z * avail / (avail + over)).toFixed(3);
  }
  function fit(s, reset) {
    fitTimers.forEach(clearTimeout);
    const w = $('.wrap', s);
    if (reset && w) w.style.zoom = '';
    fitStep(s); fitStep(s);
    fitTimers = [1200, 4000].map(ms => setTimeout(() => { if (slides[cur] === s) { fitStep(s); fitStep(s); } }, ms));
  }
  window.addEventListener('resize', () => { if (slides[cur]) fit(slides[cur], true); });

  const demos = {};
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
    if (!ask.hidden) $('#ask-ctx').textContent = `sobre: ${slideContext().title}`;

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
    const keepUrl = document.documentElement.classList.contains('intro-on') && !location.hash;
    if (!keepUrl && location.hash !== `#${i + 1}`) history.replaceState(null, '', `#${i + 1}`);
    fit(s, true);
    demos[s.dataset.id]?.enter?.();
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
    if (introOn()) {
      const t = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Enter' && !['input', 'textarea', 'select', 'button'].includes(t)) { e.preventDefault(); closeIntro(0); }
      return;
    }
    if (e.key === 'Escape') { if (!modal.hidden) closeGm(); else if (!ask.hidden) ask.hidden = true; return; }
    if (!modal.hidden) return;
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
    if (e.target.closest('input, textarea, .xl-sheet, .tr-app')) return;
    const dx = e.changedTouches[0].clientX - tx, dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(cur + (dx < 0 ? 1 : -1));
  }, { passive: true });
  /* ---------- Abertura: galáxia (o 3D fica em galaxy.js) ---------- */
  const html = document.documentElement;
  const gxEl = $('#gx');
  function introOn() { return html.classList.contains('intro-on'); }
  let gxBusy = false;
  async function closeIntro(slide = 0, from = $('#gx-start')) {
    if (!introOn() || gxBusy) return;
    gxBusy = true;
    const r = from && from.getBoundingClientRect();
    gxEl.style.setProperty('--cx', r && r.width ? `${r.left + r.width / 2}px` : '50%');
    gxEl.style.setProperty('--cy', r && r.width ? `${r.top + r.height / 2}px` : '50%');
    gxEl.classList.add('mode-warp');
    try { await Promise.race([Promise.resolve(window.IAGalaxy?.warp?.()), sleep(1500)]); } catch { /* segue sem o salto */ }
    if (slide !== cur) go(slide); else demos[slides[cur].dataset.id]?.enter?.();
    html.classList.add('gx-closing');
    await sleep(reduce ? 60 : 1000);
    html.classList.remove('intro-on', 'gx-closing');
    gxEl.classList.remove('mode-warp');
    window.IAGalaxy?.setActive?.(false);
    gxBusy = false;
  }
  function openIntro() {
    if (introOn() || gxBusy) return;
    epoch++;
    demos[slides[cur]?.dataset.id]?.leave?.();
    html.classList.add('intro-on');
    gxEl.classList.remove('opening'); void gxEl.offsetWidth; gxEl.classList.add('opening');
    window.IAGalaxy?.setActive?.(true);
    $('#gx-canvas').focus({ preventScroll: true });
  }
  $('#gx-start').addEventListener('click', e => closeIntro(0, e.currentTarget));
  $('#gx-open').addEventListener('click', openIntro);
  $('#gx-fs').addEventListener('click', () => $('#btn-fs').click());
  window.addEventListener('galaxy:goto', e => closeIntro(e.detail?.slide ?? 0, e.detail?.from));
  setTimeout(() => { if (!window.IAGalaxy) { gxEl.classList.add('nogl'); $('#gx-count').textContent = 'modo simples'; } }, 8000);

  window.addEventListener('hashchange', () => {
    const n = parseInt(location.hash.slice(1), 10);
    if (n >= 1 && n <= total) go(n - 1);
  });

  const vecColors = (seed, n = 8) => Array.from({ length: n }, (_, k) => {
    const v = Math.abs(Math.sin(seed * 12.9898 + k * 78.233)) % 1;
    return v > .5 ? `rgba(255,${Math.round(90 + v * 80)},31,${.35 + v * .6})` : `rgba(123,119,240,${.3 + v * 1.2})`;
  });

  /* =========================================================
     FUNDAMENTOS 1 · O que é IA
     ========================================================= */
  const NEST = [
    '<b>Inteligência Artificial</b>: qualquer técnica que faz o computador realizar tarefas "inteligentes". Vai de regras escritas à mão, como num jogo de xadrez antigo, até os chatbots atuais.',
    '<b>Aprendizado de máquina</b>: em vez de regras, o sistema aprende com exemplos. Exemplos: o filtro de spam do e-mail e as recomendações do YouTube.',
    '<b>Deep learning</b>: aprendizado de máquina com redes neurais de muitas camadas. Exemplos: o desbloqueio facial do celular e a tradução automática.',
    '<b>IA generativa</b>: modelos de deep learning que criam conteúdo novo, como texto, imagem, áudio e vídeo. Exemplos: ChatGPT, Gemini, Claude e Midjourney.'
  ];
  function setNest(k) {
    $$('#nest .ring').forEach(r => r.classList.toggle('on', +r.dataset.k === k));
    $('#nest-desc').innerHTML = NEST[k];
  }
  $('#nest').addEventListener('click', e => {
    const r = e.target.closest('.ring'); if (!r) return;
    job('nest'); setNest(+r.dataset.k);
  });
  demos.whatis = {
    async enter() {
      const alive = job('nest');
      setNest(0);
      const num = $('[data-count]'); num.textContent = '0';
      for (let k = 1; k <= 7; k++) { if (!(await wait(110, alive))) return; num.textContent = k; }
      for (const k of [1, 2, 3]) { if (!(await wait(2300, alive))) return; setNest(k); }
      const fl = $('#flow-ml'); fl.classList.remove('pulse'); void fl.offsetWidth; fl.classList.add('pulse');
    }
  };

  /* =========================================================
     FUNDAMENTOS 2 · Pipeline do LLM
     ========================================================= */
  const TOKS = [
    { t: 'O', id: 46 }, { t: ' SEN', id: 20871 }, { t: 'AI', id: 15836 }, { t: ' forma', id: 9412 },
    { t: ' profission', id: 31877 }, { t: 'ais', id: 1771 }, { t: ' para', id: 3714 }, { t: ' a', id: 264 }
  ];
  const ATT = [0.04, 0.2, 0.16, 0.24, 0.14, 0.06, 0.1, 0.06];
  const PP_TXT = [
    '<b>1. Tokens.</b> O texto é quebrado em pedaços chamados tokens. Palavras comuns viram um token; palavras raras são divididas ("SEN" + "AI"). Cada token recebe um número.',
    '<b>2. Vetores.</b> Cada número vira um vetor: uma lista com milhares de números que representa o significado. Palavras parecidas, como "escola" e "colégio", ficam com vetores parecidos.',
    '<b>3. Atenção.</b> Cada token "olha" para os outros e decide quais importam mais. Aqui, o último token (" a") presta mais atenção em "forma" e "SENAI".',
    '<b>4. Probabilidades.</b> A rede dá uma pontuação para cada token do vocabulário (dezenas de milhares) e o softmax transforma tudo em probabilidades.',
    '<b>5. Escolhe e repete.</b> O modelo escolhe um token provável ("indústria"), cola no fim do texto e recomeça o processo inteiro para o próximo token.'
  ];
  let ppStep = 0;
  function ppRender(step, animateTokens) {
    ppStep = step;
    const stage = $('#pp-stage'), box = $('#pp-tokens'), svg = $('#pp-att');
    $$('#pp-steps button').forEach((b, k) => { b.classList.toggle('on', k === step); b.classList.toggle('done', k < step); });
    $('#pp-exp').innerHTML = PP_TXT[step];
    if (animateTokens || !box.children.length) {
      box.innerHTML = TOKS.map((t, k) => `<div class="tok${k === TOKS.length - 1 ? ' last' : ''}" style="animation-delay:${k * 90}ms"><b>${esc(t.t)}</b><small>${t.id}</small><span class="vec">${vecColors(t.id).map(c => `<i style="background:${c}"></i>`).join('')}</span></div>`).join('');
    }
    $('.tok.new', box)?.remove();
    stage.classList.toggle('vec', step >= 1);
    stage.classList.toggle('probs', step >= 3);
    const probs = $('#pp-probs');
    probs.classList.remove('go');
    if (step >= 3) requestAnimationFrame(() => requestAnimationFrame(() => probs.classList.add('go')));
    svg.innerHTML = '';
    if (step >= 2) {
      requestAnimationFrame(() => {
        const sr = stage.getBoundingClientRect(), z = zoomOf(svg);
        const chips = $$('.tok', box);
        const last = chips[TOKS.length - 1].getBoundingClientRect();
        const x1 = (last.left + last.width / 2 - sr.left) / z, y1 = (last.top - sr.top) / z;
        svg.innerHTML = chips.slice(0, TOKS.length - 1).map((c, k) => {
          const r = c.getBoundingClientRect();
          const x2 = (r.left + r.width / 2 - sr.left) / z, y2 = (r.top - sr.top) / z;
          const h = Math.min(66, 18 + Math.abs(x1 - x2) / 4);
          return `<path d="M${x1} ${y1} C ${x1} ${y1 - h}, ${x2} ${y2 - h}, ${x2} ${y2}" style="stroke-width:${1 + ATT[k] * 16};opacity:${.25 + ATT[k] * 3};animation-delay:${k * 60}ms"/>`;
        }).join('');
      });
    }
    if (step >= 4) {
      const n = document.createElement('div');
      n.className = 'tok new';
      n.innerHTML = `<b> indústria</b><small>62%</small>`;
      box.appendChild(n);
    }
    if (slides[cur]?.dataset.id === 'pipeline') fitStep(slides[cur]);
  }
  $('#pp-steps').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { job('pp'); ppRender(+b.dataset.s); } });
  $('#pp-next').addEventListener('click', () => { job('pp'); ppRender(Math.min(4, ppStep + 1)); });
  $('#pp-prev').addEventListener('click', () => { job('pp'); ppRender(Math.max(0, ppStep - 1)); });
  demos.pipeline = {
    async enter() {
      const alive = job('pp');
      ppRender(0, true);
      for (let s = 1; s <= 4; s++) { if (!(await wait(4200, alive))) return; ppRender(s); }
    }
  };
  window.addEventListener('resize', () => { if (slides[cur]?.dataset.id === 'pipeline' && ppStep >= 2) ppRender(ppStep); });

  /* =========================================================
     FUNDAMENTOS 3 · Neurônio
     ========================================================= */
  const W = [2.0, 1.5, 3.0], B = -3.0, IN_Y = [45, 115, 185];
  const sigm = z => 1 / (1 + Math.exp(-z));
  const sx = z => 10 + ((Math.max(-6, Math.min(6, z)) + 6) / 12) * 220;
  const sy = v => 80 - v * 70;
  $('#sig-path').setAttribute('d', Array.from({ length: 61 }, (_, k) => { const z = -6 + k * .2; return `${k ? 'L' : 'M'}${sx(z).toFixed(1)} ${sy(sigm(z)).toFixed(1)}`; }).join(' '));
  function neuron() {
    const xs = $$('.nn-ctrl input').map(i => +i.value);
    const z = xs.reduce((a, x, k) => a + x * W[k], 0) + B;
    const y = sigm(z);
    $('#nn-lines').innerHTML = xs.map((x, k) => `<path d="M94 ${IN_Y[k]} C 180 ${IN_Y[k]}, 200 115, 266 115" style="stroke-width:${Math.max(1, x * W[k] * 3)};opacity:${.25 + x * .75}"/>`).join('');
    xs.forEach((x, k) => { $(`#nn-v${k}`).textContent = br(x); $(`#nn-l${k}`).textContent = x.toFixed(2).replace('.', ','); });
    $('#nn-z').textContent = `z = ${z.toFixed(2).replace('.', ',')}`;
    $('#nn-y').textContent = `${Math.round(y * 100)}%`;
    $('#nn-out').classList.toggle('low', y < .5);
    $('#nn-calc').textContent = `z = 2,0·${xs[0].toFixed(2).replace('.', ',')} + 1,5·${xs[1].toFixed(2).replace('.', ',')} + 3,0·${xs[2].toFixed(2).replace('.', ',')} − 3,0 = ${z.toFixed(2).replace('.', ',')}  →  σ(z) = ${Math.round(y * 100)}%`;
    const dot = $('#sig-dot'); dot.setAttribute('cx', sx(z)); dot.setAttribute('cy', sy(y));
    const v = $('#nn-verdict');
    v.classList.toggle('low', y < .5);
    v.innerHTML = y >= .5 ? `${ic('umbrella', 'i')}<span>${Math.round(y * 100)}% de chance de chuva: leve o guarda-chuva</span>` : `${ic('sun', 'i')}<span>${Math.round(y * 100)}% de chance de chuva: pode deixar o guarda-chuva em casa</span>`;
  }
  $$('.nn-ctrl input').forEach(i => i.addEventListener('input', neuron));
  neuron();

  /* =========================================================
     FUNDAMENTOS 4 · Descida do gradiente
     ========================================================= */
  const Lf = w => .35 * (w - 3) ** 2 + .2;
  const GX = w => 40 + ((w + 1) / 8) * 470;
  const GY = L => 200 - (L / 6) * 185;
  $('#gd-curve').setAttribute('d', Array.from({ length: 81 }, (_, k) => { const w = -1 + k * .1; return `${k ? 'L' : 'M'}${GX(w).toFixed(1)} ${GY(Lf(w)).toFixed(1)}`; }).join(' '));
  let gdLr = 1;
  const guess = L => (L > 3 ? 'banana' : L > 1.5 ? 'verde' : L > .5 ? 'cinza' : 'azul');
  const GD_NOTE = { 0.15: 'Taxa baixa: aprende, mas devagar. Precisaria de muito mais épocas.', 1: 'Taxa ideal: o erro cai rápido e o modelo acerta.', 2.95: 'Taxa alta demais: os passos são tão grandes que o modelo pula o ponto certo e o erro aumenta.' };
  function gdReset() {
    const w = -0.5;
    const ball = $('#gd-ball');
    ball.style.transition = 'none';
    ball.setAttribute('cx', GX(w)); ball.setAttribute('cy', GY(Lf(w)));
    void ball.getBoundingClientRect(); ball.style.transition = '';
    $('#gd-trail').innerHTML = '';
    $('#gd-ep').textContent = '0';
    $('#gd-err').textContent = br(Lf(w));
    $('#gd-guess').textContent = guess(Lf(w));
    $('#gd-note').textContent = GD_NOTE[gdLr] || '';
  }
  async function gdRun() {
    const alive = job('gd');
    gdReset();
    let w = -0.5;
    for (let ep = 1; ep <= 30; ep++) {
      if (!(await wait(ep === 1 ? 200 : 420, alive))) return;
      const nw = w - gdLr * 0.7 * (w - 3);
      const out = nw < -1 || nw > 7;
      const cw = Math.max(-1, Math.min(7, nw));
      $('#gd-trail').insertAdjacentHTML('beforeend', `<line x1="${GX(w)}" y1="${GY(Lf(w))}" x2="${GX(cw)}" y2="${GY(Lf(cw))}"/><circle cx="${GX(w)}" cy="${GY(Lf(w))}" r="4"/>`);
      w = cw;
      $('#gd-ball').setAttribute('cx', GX(w)); $('#gd-ball').setAttribute('cy', GY(Lf(w)));
      $('#gd-ep').textContent = ep;
      $('#gd-err').textContent = br(Lf(w));
      $('#gd-guess').textContent = guess(Lf(w));
      if (out) { $('#gd-note').textContent = 'O erro explodiu! Com passos grandes demais, o modelo nunca aprende. Por isso a taxa de aprendizado é tão importante.'; return; }
      if (Math.abs(w - 3) < 0.02) { $('#gd-note').textContent = `Aprendeu em ${ep} épocas: o erro chegou ao mínimo e a resposta ficou certa.`; return; }
    }
  }
  $('#gd-lr').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('#gd-lr button').forEach(x => x.classList.toggle('on', x === b));
    gdLr = +b.dataset.lr === 3 ? 2.95 : +b.dataset.lr;
    job('gd'); gdReset();
  });
  $('#gd-go').addEventListener('click', gdRun);
  demos.train = { async enter() { const alive = job('gd'); gdReset(); if (await wait(1200, alive)) gdRun(); } };

  /* =========================================================
     1.1 · Tradutor
     ========================================================= */
  const PHRASES = [
    {
      pt: 'Bom dia, turma!', src: ['Bom', 'dia', ',', 'turma', '!'],
      out: {
        en: { text: 'Good morning, class!', tk: ['Good', 'morning', ',', 'class', '!'], al: [[0], [1], [2], [3], [4]] },
        es: { text: '¡Buenos días, clase!', tk: ['¡Buenos', 'días', ',', 'clase', '!'], al: [[0], [1], [2], [3], [4]] },
        ja: { text: 'おはようございます、みなさん！', tk: ['おはよう', 'ございます', '、', 'みなさん', '！'], al: [[0, 1], [0, 1], [2], [3], [4]] }
      },
      back: 'Bom dia, turma!',
      note: 'Frase simples e direta: os tradutores acertam quase sempre.'
    },
    {
      pt: 'Cansei, vou chutar o balde.', src: ['Cansei', ',', 'vou', 'chutar', 'o', 'balde', '.'],
      out: {
        en: { text: "I'm fed up, I'm going to give up on everything.", tk: ["I'm", 'fed up', ',', "I'm going to", 'give up', 'on everything', '.'], al: [[0], [0], [1], [2], [3, 4, 5], [3, 4, 5], [6]] },
        es: { text: 'Estoy harto, voy a mandarlo todo al diablo.', tk: ['Estoy', 'harto', ',', 'voy a', 'mandarlo todo', 'al diablo', '.'], al: [[0], [0], [1], [2], [3, 4, 5], [3, 4, 5], [6]] },
        ja: { text: 'もううんざりだ、全部投げ出すよ。', tk: ['もう', 'うんざりだ', '、', '全部', '投げ出す', 'よ', '。'], al: [[0], [0], [1], [3, 4, 5], [3, 4, 5], [2], [6]] }
      },
      back: 'Estou farto, vou desistir de tudo.',
      literal: "I'm tired, I'm going to kick the bucket.",
      note: 'Expressão idiomática! Repare que "give up" olha para "chutar o balde" inteiro, e não palavra por palavra. A tradução literal seria "kick the bucket", que em inglês quer dizer MORRER.',
      warn: true
    },
    {
      pt: 'Desligue a máquina e chame a manutenção.', src: ['Desligue', 'a', 'máquina', 'e', 'chame', 'a', 'manutenção', '.'],
      out: {
        en: { text: 'Shut down the machine and call maintenance.', tk: ['Shut down', 'the', 'machine', 'and', 'call', 'maintenance', '.'], al: [[0], [1], [2], [3], [4], [5, 6], [7]] },
        es: { text: 'Apague la máquina y llame a mantenimiento.', tk: ['Apague', 'la', 'máquina', 'y', 'llame', 'a', 'mantenimiento', '.'], al: [[0], [1], [2], [3], [4], [5], [6], [7]] },
        ja: { text: '機械を停止して、保守担当者を呼んでください。', tk: ['機械', 'を', '停止して', '、', '保守担当者', 'を', '呼んでください', '。'], al: [[2], [1], [0], [3], [6], [5], [4], [7]] }
      },
      back: 'Desligue a máquina e chame a manutenção.',
      note: 'Texto técnico: no japonês, o verbo vai para o fim da frase. A atenção reordena as palavras sozinha. Mesmo assim, avisos de segurança precisam de revisão humana.'
    }
  ];
  let trIdx = 0, trLang = 'en', trLive = null;
  const trViz = $('#tr-viz');
  function trStage(n) { $$('#tr-stages span').forEach((s, k) => { s.classList.toggle('on', k === n); s.classList.toggle('done', k < n); }); }
  function trChip(t, seed) {
    const d = document.createElement('span');
    d.className = 'tk';
    d.innerHTML = `${esc(t)}<span class="vec">${vecColors(seed, 6).map(c => `<i style="background:${c}"></i>`).join('')}</span>`;
    return d;
  }
  function trLine(srcEl, outEl, fresh) {
    const vr = trViz.getBoundingClientRect(), a = srcEl.getBoundingClientRect(), b = outEl.getBoundingClientRect(), z = zoomOf(trViz);
    const x1 = (a.left + a.width / 2 - vr.left) / z, y1 = (a.bottom - vr.top) / z, x2 = (b.left + b.width / 2 - vr.left) / z, y2 = (b.top - vr.top) / z;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', `M${x1} ${y1} C ${x1} ${y1 + 26}, ${x2} ${y2 - 26}, ${x2} ${y2}`);
    if (!fresh) p.style.opacity = .18;
    $('#tr-lines').appendChild(p);
    return p;
  }
  function trSetTabs() {
    $$('#tr-phrases button').forEach(b => b.classList.toggle('on', b.dataset.p === String(trIdx)));
    $$('#tr-targets button').forEach(b => b.classList.toggle('on', b.dataset.l === trLang));
    const live = trIdx === 'live';
    $('#tr-src').hidden = live; $('#tr-input').hidden = !live; $('#tr-live-go').hidden = !live;
    $('#tr-out').setAttribute('lang', trLang);
  }
  function trClear() {
    $('#tr-out').textContent = ''; $('#tr-out').classList.remove('loading');
    $('#tr-row-src').innerHTML = ''; $('#tr-row-out').innerHTML = ''; $('#tr-lines').innerHTML = '';
    trViz.classList.remove('vec'); trStage(-1);
    const n = $('#tr-note'); n.innerHTML = ''; n.classList.remove('warn');
    $('#tr-literal').hidden = true;
  }
  async function runTranslate() {
    const alive = job('tr');
    trSetTabs(); trClear();
    if (trIdx === 'live') {
      if (trLive) showLive(); else $('#tr-note').innerHTML = `${ic('gem')}<span>Digite uma frase e clique em <b>Traduzir com Gemini</b>. A tradução é feita ao vivo.</span>`;
      return;
    }
    const p = PHRASES[trIdx], o = p.out[trLang];
    $('#tr-detect').textContent = 'detectando…';
    await type($('#tr-src'), p.pt, alive, 26);
    $('#tr-count').textContent = `${p.pt.length} / 300`;
    if (!alive()) return;
    $('#tr-detect').textContent = 'detectado';
    trStage(0);
    const srcEls = [];
    for (let k = 0; k < p.src.length; k++) {
      if (!(await wait(110, alive))) return;
      const c = trChip(p.src[k], k * 7 + trIdx * 31 + 3); $('#tr-row-src').appendChild(c); srcEls.push(c);
    }
    if (!(await wait(700, alive))) return;
    trStage(1); trViz.classList.add('vec');
    if (!(await wait(1200, alive))) return;
    trStage(2); $('#tr-out').classList.add('loading');
    if (!(await wait(700, alive))) return;
    $('#tr-out').classList.remove('loading');
    const lines = [];
    for (let k = 0; k < o.tk.length; k++) {
      if (!(await wait(k ? 650 : 200, alive))) return;
      if (k === 0) trStage(3);
      srcEls.forEach(s => s.classList.remove('hot'));
      lines.forEach(l => (l.style.opacity = .16));
      const oc = trChip(o.tk[k], 0); $('#tr-row-out').appendChild(oc);
      o.al[k].forEach(j => { srcEls[j].classList.add('hot'); lines.push(trLine(srcEls[j], oc, true)); });
      $('#tr-out').textContent = o.text.slice(0, Math.round(o.text.length * (k + 1) / o.tk.length));
    }
    if (!(await wait(500, alive))) return;
    srcEls.forEach(s => s.classList.remove('hot'));
    trStage(4);
    const n = $('#tr-note');
    n.classList.toggle('warn', !!p.warn);
    n.innerHTML = `${ic(p.warn ? 'alert' : 'check-circle')}<span>${esc(p.note)}</span>`;
    $('#tr-literal').hidden = !p.literal;
  }
  function showLive() {
    const d = trLive; if (!d) return;
    $('#tr-out').textContent = d[trLang] || '';
    $('#tr-row-src').innerHTML = ''; $('#tr-row-out').innerHTML = '';
    (d.tokens || []).slice(0, 14).forEach((t, k) => $('#tr-row-src').appendChild(trChip(t, k * 11 + 5)));
    String(d[trLang] || '').split(/\s+/).filter(Boolean).slice(0, 14).forEach(t => $('#tr-row-out').appendChild(trChip(t, 0)));
    trViz.classList.add('vec'); trStage(4);
    $('#tr-note').innerHTML = `${ic('gem')}<span><b>Gemini:</b> ${esc(d.nota || 'Tradução feita ao vivo.')}</span>`;
  }
  $('#tr-phrases').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    trIdx = b.dataset.p === 'live' ? 'live' : +b.dataset.p;
    runTranslate();
    if (trIdx === 'live') setTimeout(() => $('#tr-input').focus(), 50);
  });
  $('#tr-targets').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    trLang = b.dataset.l; runTranslate();
  });
  $('#tr-input').addEventListener('input', e => ($('#tr-count').textContent = `${e.target.value.length} / 300`));
  $('#tr-live-go').addEventListener('click', async () => {
    const txt = $('#tr-input').value.trim();
    if (!txt) { $('#tr-input').focus(); return; }
    const alive = job('tr');
    trClear(); trStage(2); $('#tr-out').classList.add('loading');
    try {
      const raw = await gemini(`Traduza a frase em português abaixo para inglês, espanhol e japonês. Responda só com JSON neste formato: {"en": "...", "es": "...", "ja": "...", "tokens": ["lista", "das", "palavras", "da", "frase", "original"], "nota": "uma frase curta em português explicando algum cuidado ou curiosidade desta tradução"}.\n\nFrase: ${txt}`, { system: '', json: true, temperature: 0.3 });
      if (!alive()) return;
      const d = parseJSON(raw);
      if (!d || !d.en) throw new Error('O Gemini respondeu num formato inesperado. Tente de novo.');
      trLive = d; $('#tr-out').classList.remove('loading'); showLive();
    } catch (err) {
      if (!alive()) return;
      $('#tr-out').classList.remove('loading');
      const n = $('#tr-note'); n.classList.add('warn'); n.innerHTML = `${ic('alert')}<span>${esc(err.message)}</span>`;
    }
  });
  $('#tr-back').addEventListener('click', async () => {
    const alive = job('trback');
    const n = $('#tr-note'); n.classList.remove('warn');
    const back = trIdx === 'live' ? (trLive ? 'Use o Gemini: peça "traduza de volta" no painel ' : '') : PHRASES[trIdx].back;
    n.innerHTML = `${ic('refresh')}<span>De volta para o português: <b class="bk"></b></span>`;
    await type($('.bk', n), back || '—', alive, 24);
  });
  $('#tr-literal').addEventListener('click', async () => {
    const alive = job('trback');
    const n = $('#tr-note'); n.classList.add('warn');
    n.innerHTML = `${ic('alert')}<span>Palavra por palavra: <span class="bad"></span></span>`;
    await type($('.bad', n), `${PHRASES[1].literal}  →  "Cansei, vou morrer."`, alive, 22);
  });
  demos.translate = { enter() { trIdx = 0; trLang = 'en'; runTranslate(); } };

  /* =========================================================
     1.2 · Assistentes
     ========================================================= */
  const CMDS = [
    { json: { intencao: 'criar_lembrete', tarefa: 'levar o EPI', quando: 'amanhã, 07:00' }, reply: 'Pronto! Amanhã às 7h eu te lembro de levar o EPI.', icon: 'clock' },
    { json: { intencao: 'calcular', expressao: '240 × 0,15' }, reply: '15% de 240 é 36.', icon: 'calc' },
    { json: { intencao: 'tocar_musica', estilo: 'instrumental para estudar' }, reply: 'Tocando uma playlist instrumental para estudar.', icon: 'music' },
    { json: { intencao: 'rota', destino: 'SENAI Iracemápolis', modo: 'ônibus' }, reply: 'Abrindo o mapa com a rota de ônibus até o SENAI.', icon: 'map' }
  ];
  const wave = $('#as-wave');
  wave.innerHTML = Array.from({ length: 18 }, () => '<i></i>').join('');
  let waveRaf = 0;
  function waveOn(on) {
    cancelAnimationFrame(waveRaf);
    const bars = $$('i', wave);
    if (!on) { bars.forEach(b => (b.style.height = '8px')); return; }
    const loop = t => {
      bars.forEach((b, k) => (b.style.height = `${10 + Math.abs(Math.sin(t / 120 + k * .7)) * 50 * (.4 + Math.random() * .6)}px`));
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
    const reply = $('#as-reply'); reply.innerHTML = '';
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
    reply.innerHTML = `${ic(c.icon, 'i')}<span></span>`;
    reply.style.gap = '10px';
    await type($('span', reply), c.reply, alive, 22);
    if (!alive()) return;
    steps.forEach(s => { s.classList.remove('on'); s.classList.add('done'); });
  }
  $('#as-cmds').addEventListener('click', e => { const b = e.target.closest('button'); if (b) runAssistant(+b.dataset.c); });
  demos.assistant = { enter() { runAssistant(0); }, leave() { waveOn(false); } };

  /* =========================================================
     1.3 · Chatbots (regras, IA simulada e Gemini ao vivo)
     ========================================================= */
  let cbMode = 'rules';
  const chat = $('#cb-chat');
  let cbHist = [];
  const addMsg = (text, cls) => bubble(chat, cls, esc(text));
  async function typingDots(alive, ms) { const d = thinking(chat); const ok = await wait(ms, alive); d.remove(); return ok; }
  function cbModeUI() {
    $$('#cb-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === cbMode));
    const live = cbMode === 'live';
    $('#cb-q').hidden = live; $('#cb-input').hidden = !live;
  }
  async function runChat() {
    const alive = job('cb');
    chat.innerHTML = '';
    cbModeUI();
    if (cbMode === 'live') {
      cbHist = [];
      bubble(chat, 'sys', GM.key ? 'Gemini ao vivo: pergunte qualquer coisa à IA.' : 'Para conversar ao vivo, configure a chave no botão "Gemini", no topo.');
      setTimeout(() => $('#cb-input').focus(), 50);
      return;
    }
    addMsg(cbMode === 'rules' ? 'Bot de regras: só entende as opções do menu' : 'Bot com IA: entende linguagem natural (exemplo simulado)', 'sys');
    if (!(await wait(500, alive))) return;
    addMsg($('#cb-q').textContent, 'user');
    if (cbMode === 'rules') {
      if (!(await typingDots(alive, 700))) return;
      addMsg('Olá! Escolha uma opção:\n1 · Matrícula\n2 · Horários\n3 · Boletos\n4 · Falar com atendente', 'bot');
      if (!(await wait(1300, alive))) return;
      addMsg('perdi a aula :(', 'user');
      if (!(await typingDots(alive, 600))) return;
      addMsg('Opção inválida. Digite 1, 2, 3 ou 4.', 'bot');
      if (!(await wait(1000, alive))) return;
      addMsg('...', 'user');
    } else {
      if (!(await typingDots(alive, 1300))) return;
      addMsg('Oi! Sem problemas. Ontem, em Fundamentos, a aula foi sobre tradução automática e assistentes virtuais.\n\nAtividade: testar 3 frases no tradutor e anotar os erros. Entrega até sexta.\n\nQuer que eu te mande um resumo da aula?', 'bot ai');
      if (!(await wait(1500, alive))) return;
      addMsg('Quero sim, valeu!', 'user');
      if (!(await typingDots(alive, 900))) return;
      addMsg('Enviado! Se tiver dúvida na atividade, é só me chamar.', 'bot ai');
    }
  }
  async function sendLive() {
    const inp = $('#cb-input');
    const q = inp.value.trim(); if (!q) return;
    inp.value = '';
    addMsg(q, 'user');
    cbHist.push({ role: 'user', parts: [{ text: q }] });
    const d = thinking(chat);
    try {
      const ans = await gemini(cbHist.slice(-12), { system: `${SYSTEM} Você está fazendo o papel do chatbot da turma. Se perguntarem algo específico da escola (horários, notas, atividades), diga que não tem acesso a esses dados e explique que um chatbot real precisaria ser conectado ao sistema da escola.` });
      d.remove();
      cbHist.push({ role: 'model', parts: [{ text: ans }] });
      bubble(chat, 'gm md', `<span class="gm-badge">${ic('gem')}Gemini</span>${md(ans)}`);
    } catch (err) { d.remove(); cbHist.pop(); bubble(chat, 'err', esc(err.message)); }
  }
  $('#cb-mode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; cbMode = b.dataset.m; runChat(); });
  $('#cb-form').addEventListener('submit', e => { e.preventDefault(); if (cbMode === 'live') sendLive(); else runChat(); });
  demos.chatbot = { enter() { if (cbMode !== 'live') runChat(); else cbModeUI(); } };

  /* =========================================================
     1.4 · Geração (difusão)
     ========================================================= */
  const cv = $('#gen-canvas');
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  const CW = cv.width, CH = cv.height;
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
    const gr = g.createLinearGradient(0, 0, 0, CH);
    gr.addColorStop(0, '#f4e7db'); gr.addColorStop(1, '#e7d3c2');
    g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(30, 0, 40, CH * .7); g.fillRect(250, 0, 26, CH * .6);
    g.fillStyle = 'rgba(150,110,80,.18)'; g.beginPath(); g.ellipse(190, 170, 90, 14, 0, 0, Math.PI * 2); g.fill();
    rock(g, 120, 168, 46, 20); rock(g, 250, 172, 40, 16); rock(g, 175, 178, 30, 12);
    ball(g, 190, 108, 58, '#ffe0c2', '#ff8a3d', '#e04800');
    ball(g, 88, 150, 26, '#ffffff', '#ece6e0', '#c9bdb2');
  }
  function drawMoon(g) {
    const gr = g.createLinearGradient(0, 0, 0, CH);
    gr.addColorStop(0, '#d9dcff'); gr.addColorStop(.6, '#f6e3d6'); gr.addColorStop(.61, '#b9bdf0'); gr.addColorStop(1, '#8f93d9');
    g.fillStyle = gr; g.fillRect(0, 0, CW, CH);
    g.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 6; k++) g.fillRect(40 + k * 40, 130 + k * 9, 120 - k * 12, 2);
    ball(g, 160, 72, 46, '#ffffff', '#b8b5ff', '#6c67e0');
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.ellipse(145, 55, 12, 7, -.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(184,181,255,.35)'; g.beginPath(); g.ellipse(160, 150, 40, 6, 0, 0, Math.PI * 2); g.fill();
  }
  const off = document.createElement('canvas'); off.width = CW; off.height = CH;
  const octx = off.getContext('2d', { willReadFrequently: true });
  function noiseFrame() {
    const img = ctx.createImageData(CW, CH);
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
    const target = octx.getImageData(0, 0, CW, CH).data;
    const n = noiseFrame().data;
    const out = ctx.createImageData(CW, CH);
    const o = out.data;
    const steps = 40;
    const labels = ['ruído puro', 'formas aparecem', 'cores surgem', 'detalhes', 'pronto'];
    for (let k = 0; k <= steps; k++) {
      if (!alive()) return;
      const t = k / steps, a = t * t * (3 - 2 * t);
      for (let p = 0; p < o.length; p += 4) {
        const j = (Math.random() - .5) * 120 * (1 - a);
        o[p] = target[p] * a + n[p] * (1 - a) + j;
        o[p + 1] = target[p + 1] * a + n[p + 1] * (1 - a) + j;
        o[p + 2] = target[p + 2] * a + n[p + 2] * (1 - a) + j;
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
  $('#gen-prompt').textContent = SCENES[0].prompt;
  demos.generate = { enter() { runGenerate(); } };

  /* =========================================================
     1.5 · Resumo
     ========================================================= */
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
  const ABS = [null,
    'Manutenção preventiva é cuidar das máquinas antes que elas quebrem, seguindo um cronograma de inspeções e troca de peças. Isso evita paradas caras, deixa o trabalho mais seguro e, com registros bem feitos e sensores com IA, permite prever falhas.',
    'Cuidar das máquinas antes da falha evita paradas, aumenta a segurança e, com ajuda da IA, permite prever problemas.',
    '• O que é: ações planejadas para evitar quebras\n• Por quê: menos paradas e mais segurança\n• Como: cronograma + registros organizados\n• Futuro: sensores e IA preveem falhas'];
  const ABS_LBL = ['Completo', 'Médio', 'Curto', 'Tópicos'];
  let sumMode = 'ext';
  const words = s => s.trim().split(/\s+/).filter(w => w !== '•').length;
  const FULL = SUM_SRC.join(' ');
  function renderSummary() {
    const lvl = +$('#sum-range').value;
    const box = $('#sum-text');
    $$('#sum-mode button').forEach(b => b.classList.toggle('on', b.dataset.m === sumMode));
    $('#sum-label').textContent = (sumMode === 'ext' ? EXT_LBL : ABS_LBL)[lvl];
    if (sumMode === 'ext' || lvl === 0) {
      box.classList.remove('abs', 'md');
      if (!box.querySelector('.s')) box.innerHTML = SUM_SRC.map((s, k) => `<span class="s" data-k="${k}">${esc(s)}</span>`).join(' ');
      const keep = EXT_KEEP[lvl];
      $$('.s', box).forEach(el => {
        const k = +el.dataset.k;
        el.classList.toggle('keep', lvl > 0 && keep.includes(k));
        el.classList.toggle('drop', lvl > 0 && !keep.includes(k));
      });
      $('#sum-count').textContent = `${keep.reduce((a, k) => a + words(SUM_SRC[k]), 0)} de ${words(FULL)} palavras`;
    } else {
      box.classList.remove('abs', 'md'); void box.offsetWidth; box.classList.add('abs');
      box.textContent = ABS[lvl];
      $('#sum-count').textContent = `${words(ABS[lvl])} de ${words(FULL)} palavras`;
    }
  }
  $('#sum-range').addEventListener('input', () => { job('sum'); renderSummary(); });
  $('#sum-mode').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    job('sum'); sumMode = b.dataset.m; $('#sum-text').innerHTML = ''; renderSummary();
  });
  $('#sum-live').addEventListener('click', async () => {
    const alive = job('sum');
    const box = $('#sum-text');
    box.classList.remove('abs'); box.classList.add('md');
    box.innerHTML = `<span class="gm-badge">${ic('gem')}Gemini resumindo…</span>`;
    try {
      const ans = await gemini(`Resuma o texto abaixo em no máximo 2 frases simples, para um aluno do 1º ano do curso técnico.\n\nTexto: ${FULL}`, { temperature: 0.4 });
      if (!alive()) return;
      box.innerHTML = `<span class="gm-badge">${ic('gem')}Resumo real do Gemini</span>${md(ans)}`;
      $('#sum-label').textContent = 'Gemini';
      $('#sum-count').textContent = `${words(ans)} de ${words(FULL)} palavras`;
    } catch (err) { if (alive()) box.innerHTML = `<span class="tr-note warn">${ic('alert')}<span>${esc(err.message)}</span></span>`; }
  });
  demos.summary = {
    async enter() {
      const alive = job('sum');
      sumMode = 'ext'; $('#sum-range').value = 0; $('#sum-text').innerHTML = ''; renderSummary();
      for (const v of [1, 2]) { if (!(await wait(1600, alive))) return; $('#sum-range').value = v; renderSummary(); }
    }
  };

  /* =========================================================
     1.6 · Montador de prompts
     ========================================================= */
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
    `<p>Claro! Aqui vai um plano de estudos:</p><p>1. Estude todos os dias.<br>2. Faça resumos.<br>3. Revise antes da prova.</p><p class="muted">Genérico: a IA não sabe quem você é, o que vai estudar nem para quando.</p>`,
    `<p>Plano de estudos para curso técnico:</p><p><b>Semana 1:</b> revisar os conceitos básicos da matéria.<br><b>Semana 2:</b> fazer exercícios e simulados.</p><p class="muted">Melhorou, mas ainda está vago.</p>`,
    `<p>Plano de 14 dias para Eletricidade Básica:</p><table><tr><th>Dia</th><th>Tema</th><th>Tempo</th><th>Exercício</th></tr><tr><td>1</td><td>Tensão e corrente</td><td>50 min</td><td>Questões do livro</td></tr><tr><td>2</td><td>Lei de Ohm</td><td>50 min</td><td>Cálculos simples</td></tr><tr><td>…</td><td>…</td><td>…</td><td>…</td></tr></table><p class="muted">Bom! Já está organizado e no formato certo.</p>`,
    `<p>Ordenei do básico ao avançado: sem corrente e tensão não dá para entender a Lei de Ohm; sem ela, não dá para entender potência.</p><table><tr><th>Dia</th><th>Tema</th><th>Tempo</th><th>Exercício</th></tr><tr><td>1</td><td>Tensão, corrente e resistência</td><td>40 min</td><td>Mapa mental dos conceitos</td></tr><tr><td>2</td><td>Lei de Ohm</td><td>40 min</td><td>5 cálculos de corrente</td></tr><tr><td>3</td><td>Potência elétrica</td><td>45 min</td><td>4 problemas P = V × I</td></tr><tr><td>7</td><td colspan="3"><i>Domingo: folga</i></td></tr><tr><td>14</td><td>Simulado final</td><td>60 min</td><td>Prova antiga cronometrada</td></tr></table><p class="muted">Excelente: personalizado, no formato pedido e respeitando suas regras.</p>`
  ];
  const promptText = () => {
    const parts = [];
    if (on.has('papel')) parts.push(ING.papel[1]);
    parts.push(`Crie um plano de estudos${on.has('contexto') ? ' de 14 dias para essa prova' : ''}.`);
    ORDER.slice(1).forEach(k => on.has(k) && parts.push(ING[k][1]));
    if (on.has('contexto')) { const c = parts.splice(parts.indexOf(ING.contexto[1]), 1)[0]; parts.splice(on.has('papel') ? 1 : 0, 0, c); }
    return parts.join('\n');
  };
  function renderPrompt() {
    $$('#pb-toggles button').forEach(b => b.classList.toggle('on', on.has(b.dataset.k)));
    const lines = ORDER.filter(k => on.has(k)).map(k => `<span><span class="k">[${ING[k][0]}]</span> ${esc(ING[k][1])}</span>`);
    const base = `<span class="base"><span class="k">[Tarefa]</span> Crie um plano de estudos${on.has('contexto') ? ' de 14 dias para essa prova' : ''}.</span>`;
    if (lines[0]?.includes('[Papel]')) lines.splice(1, 0, base); else lines.unshift(base);
    $('#pb-prompt').innerHTML = lines.join('');
    const n = on.size;
    $('#pb-meter').style.width = `${8 + (n / 6) * 92}%`;
    $('#pb-score').textContent = ['Vago', 'Vago', 'Melhorando', 'Bom', 'Bom', 'Ótimo', 'Excelente'][n];
    const ai = n === 0 ? 0 : n <= 2 ? 1 : n <= 4 ? 2 : 3;
    const box = $('#pb-answer');
    $('#pb-ans-k').textContent = 'Resposta da IA (simulada)';
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
  $('#pb-live').addEventListener('click', async () => {
    const alive = job('pb');
    const box = $('#pb-answer');
    box.dataset.lvl = 'live';
    $('#pb-ans-k').textContent = 'Resposta real do Gemini';
    box.innerHTML = '<div class="dots"><i></i><i></i><i></i></div>';
    try {
      const ans = await gemini(promptText(), { system: 'Responda em português do Brasil. Seja objetivo: no máximo 180 palavras. Se pedirem tabela, use uma tabela em markdown simples com no máximo 8 linhas.' });
      if (!alive()) return;
      box.innerHTML = `<div class="md">${mdTable(ans)}</div><p class="muted">Compare: quanto mais ingredientes, mais útil a resposta.</p>`;
    } catch (err) { if (alive()) box.innerHTML = `<p class="muted">${esc(err.message)}</p>`; }
  });
  /* tabela markdown → HTML (o resto vai para md) */
  function mdTable(src) {
    const rows = src.split('\n');
    let html = '', buf = [], tbl = [];
    const flush = () => { if (buf.length) { html += md(buf.join('\n')); buf = []; } };
    const flushT = () => {
      if (!tbl.length) return;
      const cells = tbl.filter(r => !/^\s*\|?\s*:?-{2,}/.test(r)).map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => esc(c.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')));
      html += `<table>${cells.map((r, i) => `<tr>${r.map(c => (i ? `<td>${c}</td>` : `<th>${c}</th>`)).join('')}</tr>`).join('')}</table>`;
      tbl = [];
    };
    rows.forEach(r => { if (/^\s*\|.*\|\s*$/.test(r)) { flush(); tbl.push(r); } else { flushT(); buf.push(r); } });
    flushT(); flush();
    return html;
  }
  demos.prompt = {
    async enter() {
      const alive = job('pb');
      on.clear(); renderPrompt();
      for (const k of ['papel', 'contexto', 'formato']) { if (!(await wait(1400, alive))) return; on.add(k); renderPrompt(); }
    }
  };

  /* =========================================================
     Extra · Ciclo do agente
     ========================================================= */
  const AG_STEPS = [
    [0, 'Pensar', 'Primeiro preciso ver quais fotos existem.'],
    [1, 'Agir', 'Rodo <code>ls fotos/</code>'],
    [2, 'Observar', '152 arquivos. A data está no nome: <code>2026-10-03_oficina.jpg</code>'],
    [0, 'Pensar', 'Vou criar uma pasta para cada mês e mover as fotos.'],
    [1, 'Agir', 'Crio <code>2026-09/</code>, <code>2026-10/</code> e movo os arquivos'],
    [2, 'Observar', '3 fotos sem data no nome. Preciso tratar esse caso.'],
    [3, 'Repetir', 'Leio a data de criação dessas 3 fotos e movo também.'],
    [2, 'Observar', 'Conferido: 152 de 152 fotos organizadas, 0 erros.'],
    [-1, 'Entregar', 'Pronto! Criei 3 pastas e um relatório <code>resumo.md</code>.']
  ];
  async function runAgent() {
    const alive = job('ag');
    const log = $('#ag-log'); log.innerHTML = '';
    const nodes = $$('.loop-node');
    const prog = $('#ag-prog');
    const C = 678.6;
    for (const [n, label, text] of AG_STEPS) {
      if (!alive()) return;
      nodes.forEach((el, j) => el.classList.toggle('on', j === n));
      prog.style.strokeDashoffset = n < 0 ? 0 : C - C * ((n + 1) / 4);
      const li = document.createElement('li');
      li.className = n < 0 ? 'final t3' : `t${n}`;
      li.innerHTML = `<em>${label}</em><span>${n < 0 ? ic('check-circle') + ' ' : ''}${text}</span>`;
      log.appendChild(li); log.scrollTop = log.scrollHeight;
      if (!(await wait(1500, alive))) return;
    }
    nodes.forEach(el => el.classList.remove('on'));
    if (!(await wait(3500, alive))) return;
    runAgent();
  }
  demos.agent = { enter: runAgent };

  /* =========================================================
     Extra · Claude automatizando o Excel
     ========================================================= */
  const XL = [['Ana', 8.5, 7, 9], ['Bruno', 5, 6, 4.5], ['Carla', 9.5, 8.5, 10], ['Diego', 6, 5.5, 7], ['Elisa', 4, 5, 6], ['Felipe', 7.5, 8, 6.5], ['Gabi', 10, 9, 9.5]];
  const avg = r => (r[1] + r[2] + r[3]) / 3;
  const COLS = 'ABCDEFGHI';
  const sheet = $('#xl-sheet'), table = $('#xl-table');
  let xlDone = false;
  function xlBuild() {
    const head = ['Aluno', 'Prova 1', 'Prova 2', 'Trabalho', '', '', '', '', ''];
    table.innerHTML =
      `<colgroup><col style="width:34px"><col style="width:96px"><col style="width:70px"><col style="width:70px"><col style="width:76px"><col style="width:66px"><col style="width:104px"><col><col><col></colgroup>` +
      `<thead><tr><th class="rh"></th>${[...COLS].map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody>` +
      `<tr class="hdr" data-row="1"><th class="rh">1</th>${head.map((h, c) => `<td data-c="${c}">${h}</td>`).join('')}</tr>` +
      XL.map((r, i) => `<tr data-row="${i + 2}" data-name="${r[0]}"><th class="rh">${i + 2}</th>${[...COLS].map((_, c) => `<td data-c="${c}" class="${c >= 1 && c <= 5 ? 'num' : ''}">${c === 0 ? r[0] : c <= 3 ? br(r[c]) : ''}</td>`).join('')}</tr>`).join('') +
      `</tbody>`;
    $('#xl-chart').classList.remove('show');
    $('#xl-bars').innerHTML = XL.map(r => `<div class="xl-bar${avg(r) < 6 ? ' bad' : ''}" data-name="${r[0]}"><i></i><small>${r[0].slice(0, 3)}</small></div>`).join('');
    $('#xl-sel').classList.remove('show');
    $('#xl-cursor').classList.remove('show');
    $('#xl-ref').textContent = 'A1'; $('#xl-formula').textContent = 'Aluno';
    xlStatus('Aberto');
  }
  const cellEl = (row, c) => $(`tr[data-row="${row}"] td[data-c="${c}"]`, table);
  function rel(el) {
    const s = sheet.getBoundingClientRect(), r = el.getBoundingClientRect(), z = zoomOf(sheet);
    return { x: (r.left - s.left) / z + sheet.scrollLeft, y: (r.top - s.top) / z + sheet.scrollTop, w: r.width / z, h: r.height / z };
  }
  function xlSel(r1, c1, r2 = r1, c2 = c1) {
    const a = rel(cellEl(r1, c1)), b = rel(cellEl(r2, c2));
    Object.assign($('#xl-sel').style, { left: `${a.x - 1}px`, top: `${a.y - 1}px`, width: `${b.x + b.w - a.x + 1}px`, height: `${b.y + b.h - a.y + 1}px` });
    $('#xl-sel').classList.add('show');
    $('#xl-ref').textContent = r1 === r2 && c1 === c2 ? `${COLS[c1]}${r1}` : `${COLS[c1]}${r1}`;
  }
  function xlCursor(row, c) {
    const a = rel(cellEl(row, c));
    if (a.x + a.w > sheet.scrollLeft + sheet.clientWidth || a.x < sheet.scrollLeft) sheet.scrollTo({ left: Math.max(0, a.x - 60), behavior: reduce ? 'auto' : 'smooth' });
    const cur = $('#xl-cursor');
    cur.classList.add('show');
    cur.style.transform = `translate(${a.x + a.w * .65}px, ${a.y + a.h * .55}px)`;
  }
  function xlStatus(t, busy) { const s = $('#xl-status'); s.textContent = t; s.classList.toggle('busy', !!busy); }
  const xlChat = $('#xl-chat');
  function xlTool(html) {
    const d = document.createElement('div');
    d.className = 'xl-tool';
    d.innerHTML = `<svg class="i spin-i"><use href="#i-loader"/></svg><span>${html}</span>`;
    xlChat.appendChild(d); xlChat.scrollTop = xlChat.scrollHeight;
    return () => { d.classList.add('ok'); d.querySelector('svg').innerHTML = '<use href="#i-check-circle"/>'; d.querySelector('svg').classList.remove('spin-i'); };
  }
  async function xlType(el, txt, alive, sp = 40) { await type(el, txt, alive, sp); }
  async function runExcel() {
    const alive = job('xl');
    xlDone = false; $('#xl-sort').disabled = true;
    xlBuild(); xlChat.innerHTML = '';
    if (!(await wait(500, alive))) return;
    const u = bubble(xlChat, 'user', '');
    await type(u, 'Calcule a média de cada aluno, marque quem ficou abaixo de 6 e crie um gráfico.', alive, 22);
    if (!(await wait(500, alive))) return;
    const d = thinking(xlChat);
    if (!(await wait(900, alive))) return;
    d.remove();
    bubble(xlChat, 'bot', 'Certo! Vou fazer isso em 5 etapas.');
    xlStatus('Claude editando…', true);

    let ok = xlTool('Lendo a planilha <code>A1:D8</code>');
    xlCursor(1, 0); xlSel(1, 0);
    if (!(await wait(500, alive))) return;
    xlSel(1, 0, 8, 3);
    if (!(await wait(1100, alive))) return;
    ok();

    ok = xlTool('Criando a coluna <code>Média</code> com <code>=MÉDIA(B2:D2)</code>');
    xlCursor(1, 4); xlSel(1, 4);
    if (!(await wait(600, alive))) return;
    const h1 = cellEl(1, 4); h1.classList.add('fill'); await xlType(h1, 'Média', alive, 60);
    xlCursor(2, 4); xlSel(2, 4);
    if (!(await wait(500, alive))) return;
    await xlType($('#xl-formula'), '=MÉDIA(B2:D2)', alive, 55);
    if (!(await wait(300, alive))) return;
    const e2 = cellEl(2, 4); e2.textContent = br(avg(XL[0])); e2.classList.add('fill');
    ok();

    ok = xlTool('Copiando a fórmula para <code>E3:E8</code>');
    for (let r = 3; r <= 8; r++) {
      if (!(await wait(230, alive))) return;
      xlSel(2, 4, r, 4); xlCursor(r, 4);
      const c = cellEl(r, 4); c.textContent = br(avg(XL[r - 2])); c.classList.add('fill');
      $('#xl-formula').textContent = `=MÉDIA(B${r}:D${r})`;
    }
    if (!(await wait(400, alive))) return;
    ok();

    ok = xlTool('Escrevendo a situação em <code>F2:F8</code>');
    xlCursor(1, 5); xlSel(1, 5);
    if (!(await wait(500, alive))) return;
    const f1 = cellEl(1, 5); f1.classList.add('fill'); await xlType(f1, 'Situação', alive, 55);
    xlCursor(2, 5); xlSel(2, 5);
    await xlType($('#xl-formula'), '=SE(E2>=6;"Aprovado";"Recuperação")', alive, 30);
    for (let r = 2; r <= 8; r++) {
      if (!(await wait(200, alive))) return;
      xlSel(2, 5, r, 5); xlCursor(r, 5);
      const c = cellEl(r, 5); c.textContent = avg(XL[r - 2]) >= 6 ? 'Aprovado' : 'Recuperação'; c.classList.add('fill');
    }
    if (!(await wait(400, alive))) return;
    ok();

    ok = xlTool('Formatação condicional: média abaixo de 6 em vermelho');
    xlSel(2, 4, 8, 5);
    $('#xl-formula').textContent = 'Regra: valor da célula < 6';
    for (let r = 2; r <= 8; r++) {
      if (!(await wait(150, alive))) return;
      const bad = avg(XL[r - 2]) < 6;
      [4, 5].forEach(c => cellEl(r, c).classList.add(bad ? 'bad' : 'good'));
    }
    if (!(await wait(500, alive))) return;
    ok();

    ok = xlTool('Inserindo um gráfico de colunas');
    $('#xl-sel').classList.remove('show');
    xlCursor(3, 7);
    if (!(await wait(500, alive))) return;
    $('#xl-chart').classList.add('show');
    if (!(await wait(350, alive))) return;
    $$('#xl-bars .xl-bar').forEach((b, k) => setTimeout(() => ($('i', b).style.height = `${avg(XL[k]) * 10}%`), k * 90));
    if (!(await wait(1100, alive))) return;
    ok();

    $('#xl-cursor').classList.remove('show');
    xlStatus('Salvo');
    const ms = XL.map(avg);
    const rec = XL.filter(r => avg(r) < 6).map(r => r[0]);
    bubble(xlChat, 'bot ai', `Pronto! ${XL.length - rec.length} alunos aprovados e ${rec.length} em recuperação (${rec.join(' e ')}). A média da turma é ${br(ms.reduce((a, b) => a + b, 0) / ms.length)}.`);
    xlDone = true; $('#xl-sort').disabled = false;
  }
  async function sortExcel() {
    if (!xlDone) return;
    const alive = job('xl');
    $('#xl-sort').disabled = true;
    const u = bubble(xlChat, 'user', '');
    await type(u, 'Agora ordene pela média, da maior para a menor.', alive, 22);
    if (!(await wait(500, alive))) return;
    xlStatus('Claude editando…', true);
    const ok = xlTool('Classificando <code>A2:F8</code> por <code>Média</code> (decrescente)');
    xlSel(2, 0, 8, 5);
    $('#xl-formula').textContent = 'Dados › Classificar › Média › Maior para menor';
    if (!(await wait(900, alive))) return;
    const body = $('tbody', table);
    const rows = $$('tr[data-name]', body);
    const first = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
    const sorted = [...rows].sort((a, b) => avg(XL.find(x => x[0] === b.dataset.name)) - avg(XL.find(x => x[0] === a.dataset.name)));
    sorted.forEach(r => body.appendChild(r));
    sorted.forEach((r, i) => {
      const dy = first.get(r) - r.getBoundingClientRect().top;
      r.style.transition = 'none'; r.style.transform = `translateY(${dy}px)`;
      $('th', r).textContent = i + 2;
      r.dataset.row = i + 2;
    });
    void body.offsetWidth;
    sorted.forEach(r => { r.style.transition = ''; r.style.transform = ''; });
    const bars = $('#xl-bars');
    sorted.forEach(r => bars.appendChild($(`.xl-bar[data-name="${r.dataset.name}"]`, bars)));
    if (!(await wait(900, alive))) return;
    ok();
    $('#xl-sel').classList.remove('show');
    xlStatus('Salvo');
    const top = XL.reduce((a, b) => (avg(b) > avg(a) ? b : a));
    bubble(xlChat, 'bot ai', `Ordenado! ${top[0]} está em 1º lugar, com média ${br(avg(top))}. O gráfico também foi atualizado.`);
  }
  $('#xl-play').addEventListener('click', runExcel);
  $('#xl-sort').addEventListener('click', sortExcel);
  demos.excel = { enter: runExcel };

  /* =========================================================
     Extra · Terminal
     ========================================================= */
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
    ['a', 'Testando no navegador, no desktop e no celular… <span class="ok">tudo certo</span>'],
    ['a', '<span class="cm">git commit</span> -m "Apresentação de IA na prática"'],
    ['a', '<span class="cm">gh pr create</span> <span class="ok">pull request aberto</span>'],
    ['p', 'troque os emojis por ícones e adicione o Gemini ao vivo'],
    ['a', 'Criando 80 ícones SVG no estilo do site e conectando a API do Gemini…']
  ];
  async function runTerm() {
    const alive = job('term');
    const body = $('#term-body'); body.innerHTML = '';
    for (const [cls, text] of TERM) {
      if (!alive()) return;
      const line = document.createElement('div');
      line.className = cls;
      body.appendChild(line);
      if (cls === 'p') { await type(line, text, alive, 26); if (!(await wait(500, alive))) return; }
      else { line.innerHTML = text; line.style.animation = 'rise .4s both'; if (!(await wait(cls === 't' ? 380 : 700, alive))) return; }
      body.scrollTop = body.scrollHeight;
    }
  }
  $('#term-replay').addEventListener('click', runTerm);
  demos.terminal = { enter: runTerm };

  /* =========================================================
     Extra · Skill
     ========================================================= */
  const SKILL_MD = [
    ['fm', '---'], ['kv', 'name', 'slides-senai'],
    ['kv', 'description', 'Cria slides HTML no estilo da turma (vidro, laranja e lilás). Use quando pedirem uma apresentação ou slides.'],
    ['fm', '---'], ['', ''], ['h', '# Slides SENAI'], ['', ''],
    ['li', '1.', 'Pergunte o tema e quantos slides.'], ['li', '2.', 'Comece a partir de modelo.html.'],
    ['li', '3.', 'Use as cores de paleta.css.'], ['li', '4.', 'Coloque um exemplo prático em cada slide.'],
    ['li', '5.', 'Termine com um slide de fontes.']
  ];
  async function runSkill() {
    const alive = job('sk');
    const box = $('#sk-md'); box.innerHTML = '';
    for (const row of SKILL_MD) {
      if (!alive()) return;
      const line = document.createElement('div');
      box.appendChild(line);
      if (row[0] === 'kv') { line.innerHTML = `<span class="key">${row[1]}:</span> <span class="v"></span>`; await type($('.v', line), row[2], alive, 12); }
      else if (row[0] === 'li') { line.innerHTML = `<span class="n">${row[1]}</span> <span class="v"></span>`; await type($('.v', line), row[2], alive, 14); }
      else { line.className = row[0]; line.textContent = row[1] || ' '; if (!(await wait(120, alive))) return; }
    }
  }
  demos.skill = { enter: runSkill };

  /* =========================================================
     Bônus · Editor de vídeo
     ========================================================= */
  const prev = $('#ed-preview');
  const scenesEl = $$('.ed-scene', prev);
  let edRaf = 0, edT = 0, edLast = 0, edSpeed = 1;
  function edFrame(now) {
    const dt = Math.min(.1, (now - (edLast || now)) / 1000);
    edLast = now;
    edT = (edT + dt * edSpeed) % 20;
    const sc = edT < 5 ? 0 : edT < 12 ? 1 : 2;
    scenesEl.forEach((s, k) => s.classList.toggle('on', k === sc));
    $('#ed-tc').textContent = `00:${pad(Math.floor(edT))}`;
    const lane = $('#ed-tracks .lane');
    $('#ed-playhead').style.left = `${lane.offsetLeft + (edT / 20) * lane.offsetWidth}px`;
    edRaf = requestAnimationFrame(edFrame);
  }
  $$('.ed-edits button').forEach(b => b.addEventListener('click', () => {
    const e = b.dataset.e;
    if (e === 'color') prev.classList.toggle('orange');
    if (e === 'vertical') prev.classList.toggle('vertical');
    if (e === 'speed') edSpeed = edSpeed === 1 ? 2 : 1;
    b.classList.toggle('on', e === 'color' ? prev.classList.contains('orange') : e === 'vertical' ? prev.classList.contains('vertical') : edSpeed === 2);
  }));
  demos.video = {
    enter() { cancelAnimationFrame(edRaf); edLast = 0; edT = 0; edRaf = requestAnimationFrame(edFrame); },
    leave() { cancelAnimationFrame(edRaf); }
  };

  /* =========================================================
     Ética · checklist
     ========================================================= */
  const checks = $$('#eth-checks input');
  function renderEthics() {
    const n = checks.filter(c => c.checked).length;
    $('#eth-num').textContent = `${n}/5`;
    $('#eth-ring').style.strokeDashoffset = 314.16 * (1 - n / 5);
    $('#eth-ok').classList.toggle('show', n === 5);
  }
  checks.forEach(c => c.addEventListener('change', renderEthics));

  /* =========================================================
     Quiz
     ========================================================= */
  const QUIZ = [
    { q: 'Como um chatbot como o Gemini ou o ChatGPT gera um texto?', o: ['Copia respostas prontas da internet', 'Calcula o próximo token mais provável, várias vezes seguidas', 'Uma pessoa escreve as respostas em tempo real'], a: 1, e: 'Ele prevê um token de cada vez e repete o processo até completar a resposta.' },
    { q: 'O que acontece durante o treinamento de uma rede neural?', o: ['Os pesos são ajustados para diminuir o erro', 'O programador escreve todas as regras', 'O computador decora o texto inteiro da internet'], a: 0, e: 'A descida do gradiente ajusta cada peso um pouco na direção que reduz o erro.' },
    { q: 'Qual destes prompts tende a dar a melhor resposta?', o: ['Faz um resumo', 'Resuma este texto em 3 tópicos, para alunos do 1º ano', 'resumo pfv'], a: 1, e: 'Quanto mais claro o pedido (tarefa, formato e público), melhor a resposta.' },
    { q: 'Traduzir "chutar o balde" palavra por palavra dá "kick the bucket". Em inglês, isso significa…', o: ['Desistir de tudo', 'Morrer', 'Jogar futebol'], a: 1, e: 'Expressões idiomáticas são armadilhas clássicas. Traduza de volta para conferir.' },
    { q: 'Qual a principal diferença entre um chatbot e um agente de IA?', o: ['O agente usa ferramentas e executa ações até cumprir o objetivo', 'O chatbot é sempre mais inteligente', 'Não existe diferença'], a: 0, e: 'O agente segue o ciclo pensar, agir, observar e repetir.' },
    { q: 'A IA te passou uma data histórica para o trabalho. O que você faz?', o: ['Copio direto, IA não erra', 'Pergunto de novo até mudar', 'Confiro em uma fonte confiável'], a: 2, e: 'A IA pode "alucinar". Confirmar em fontes confiáveis é obrigatório.' }
  ];
  let qi = 0, qs = 0, qDone = false;
  function renderQuiz() {
    const it = QUIZ[qi];
    $('#qz-n').textContent = `Pergunta ${qi + 1} de ${QUIZ.length}`;
    $('#qz-score').textContent = `${qs} acerto${qs === 1 ? '' : 's'}`;
    $('#qz-bar').style.width = `${(qi / QUIZ.length) * 100}%`;
    $('#qz-q').textContent = it.q;
    $('#qz-exp').innerHTML = '';
    $('#qz-next').disabled = true;
    $('#qz-next').textContent = qi === QUIZ.length - 1 ? 'Ver resultado' : 'Próxima';
    const opts = $('#qz-opts'); opts.innerHTML = '';
    it.o.forEach((t, k) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.addEventListener('click', () => {
        $$('button', opts).forEach((x, j) => { x.disabled = true; if (j === it.a) x.classList.add('right'); });
        if (k === it.a) { qs++; $('#qz-exp').innerHTML = `${ic('check-circle', 'i sm yes')} <b>Isso!</b> ${esc(it.e)}`; }
        else { b.classList.add('wrong'); $('#qz-exp').innerHTML = `${ic('x-circle', 'i sm no')} <b>Quase.</b> ${esc(it.e)}`; }
        $('#qz-score').textContent = `${qs} acerto${qs === 1 ? '' : 's'}`;
        $('#qz-next').disabled = false;
      });
      opts.appendChild(b);
    });
  }
  $('#qz-next').addEventListener('click', () => {
    if (qDone) { qDone = false; qi = 0; qs = 0; renderQuiz(); return; }
    if (qi < QUIZ.length - 1) { qi++; renderQuiz(); return; }
    qDone = true;
    $('#qz-bar').style.width = '100%';
    $('#qz-n').textContent = 'Resultado';
    $('#qz-q').textContent = `Você acertou ${qs} de ${QUIZ.length}! ${qs === QUIZ.length ? 'Perfeito!' : qs >= 4 ? 'Mandou bem!' : 'Vale revisar os slides.'}`;
    $('#qz-opts').innerHTML = '';
    $('#qz-exp').innerHTML = qs >= 4 ? `${ic('trophy', 'i sm')} Parabéns!` : '';
    $('#qz-next').textContent = 'Jogar de novo';
  });
  renderQuiz();

  /* ---------- Início ---------- */
  const start = parseInt(location.hash.slice(1), 10);
  go(start >= 1 && start <= total ? start - 1 : 0);
})();
