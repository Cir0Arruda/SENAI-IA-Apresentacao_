/* IA na Prática · Automação de dados (slides 17 e 18) e Estúdio de vídeo (19 a 23)
   Cada demo registra enter/leave em window.IADemos; o main.js chama ao trocar de slide.
   As animações são funções do tempo (como no HyperFrames): render(t) desenha o instante t. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const demos = (window.IADemos = window.IADemos || {});
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const ease = t => 1 - Math.pow(1 - clamp(t), 3);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (t, dec = false) => {
    const m = Math.floor(t / 60), s = t % 60;
    return `${String(m).padStart(2, '0')}:${dec ? s.toFixed(1).padStart(4, '0') : String(Math.floor(s)).padStart(2, '0')}`;
  };
  const br = n => n.toLocaleString('pt-BR');

  /* Tarefas canceláveis: trocar de slide (ou repetir) cancela a anterior */
  const runs = {};
  function run(key) { const id = (runs[key] = (runs[key] || 0) + 1); return () => runs[key] === id; }
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  async function typeText(el, text, alive, speed = 14) {
    if (reduce) { el.textContent = text; return true; }
    el.textContent = '';
    for (let i = 0; i < text.length; i++) {
      if (!alive()) return false;
      el.textContent += text[i];
      if (i % 2 === 0) await sleep(speed);
    }
    return alive();
  }
  // laço de animação por tempo (pausa sozinho quando o slide sai)
  function loop(draw) {
    let raf = 0, last = 0, on = false;
    const f = now => { if (!on) return; const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now; draw(dt); raf = requestAnimationFrame(f); };
    return { start() { if (on) return; on = true; last = 0; raf = requestAnimationFrame(f); }, stop() { on = false; cancelAnimationFrame(raf); } };
  }

  /* Copiar pedidos (com alternativa para navegadores sem a API de área de transferência) */
  async function copyText(text, btn) {
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      ta.remove();
    }
    if (!btn) return;
    const old = btn.innerHTML;
    btn.classList.add('on');
    btn.innerHTML = `<svg class="i sm"><use href="#i-check"/></svg>${ok ? 'Copiado!' : 'Selecione e copie'}`;
    setTimeout(() => { btn.classList.remove('on'); btn.innerHTML = old; }, 1600);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.copy-btn');
    if (!b) return;
    const src = b.id === 'lv-copy' ? $('#lv-prompt') : b.closest('.lab')?.querySelector('.lab-p');
    if (src) copyText(src.textContent.trim(), b);
  });

  /* =========================================================
     17 · O fluxo completo (computador simulado)
     ========================================================= */
  const VF_EXP = [
    '',
    '<b>1. Pedido.</b> Você descreve o vídeo em português: duração, formato, cores e o que deve aparecer. Quanto mais claro, menos ajustes depois.',
    '<b>2. Código.</b> O Claude cria a pasta do projeto e escreve cada cena como HTML. A animação é uma linha do tempo do GSAP, pausada.',
    '<b>3. Prévia.</b> O vídeo toca no navegador. Você assiste, arrasta a linha do tempo e pede mudanças no chat ("título maior", "mais lento").',
    '<b>4. Revisão.</b> O <code>check</code> procura erros antes de gravar: texto fora da tela, animação sem tempo, sorteio sem semente.',
    '<b>5. Render.</b> Um Chrome sem janela abre a página, vai para cada instante e tira uma foto. O FFmpeg junta as 150 fotos num MP4.',
    '<b>6. Pronto.</b> O MP4 fica em <code>renders/</code>. O projeto continua editável: mude o texto e renderize de novo.'
  ];
  const VF_CODE = `<div id="root" data-composition-id="abertura"
     data-width="1920" data-height="1080" data-duration="5">
  <h1 class="clip" data-start="0" data-duration="5">SENAI</h1>
  <p class="clip" data-start="0.6" data-duration="4.4">Iracemápolis</p>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from("h1", { y: 80, opacity: 0, duration: 0.8 }, 0)
    .from("p", { y: 30, opacity: 0, duration: 0.6 }, 0.6);
  window.__timelines["abertura"] = tl;
</script>`;
  const VF_CHECK = [
    ['', '$ npx hyperframes check'],
    ['t', '1 composição · 2 clipes · 5,0 s'],
    ['t', 'linha do tempo registrada: abertura'],
    ['t', 'sem Math.random() nem Date.now()'],
    ['t', 'texto dentro da área segura'],
    ['ok', '✓ 0 erros · 0 avisos']
  ];
  let vfStep = 0, vfT = 0, vfAuto = true;
  const vfLoop = loop(dt => {
    vfT += dt;
    if (vfStep === 3) {
      const t = vfT % 5, s = $('#vf-pv');
      const k1 = ease(t / 0.8), k2 = ease((t - 0.6) / 0.6);
      s.children[0].style.cssText = `transform:translateY(${(1 - k1) * 30}px);opacity:${k1}`;
      s.children[1].style.cssText = `transform:translateY(${(1 - k2) * 14}px);opacity:${k2}`;
      s.children[2].style.transform = `scaleX(${ease((t - 1) / 1.2)})`;
      $('#vf-tc').textContent = fmt(t, true);
      $('#vf-head').style.left = `${(t / 5) * 100}%`;
    }
    if (vfAuto && vfT > (vfStep === 1 || vfStep === 2 ? 4.6 : 3.6)) vfShow(vfStep % 6 + 1, true);
  });
  async function vfShow(s, auto = false) {
    vfStep = s; vfT = 0; vfAuto = auto;
    const alive = run('vf');
    $$('#vf-pc .pc-win').forEach(w => w.classList.toggle('on', +w.dataset.w === s));
    $$('#vf-task span').forEach(t => t.classList.toggle('on', +t.dataset.t === s));
    $$('#vf-steps button').forEach(b => {
      const n = +b.dataset.s;
      b.classList.toggle('on', n === s); b.classList.toggle('done', n < s);
    });
    $('#vf-exp').innerHTML = VF_EXP[s];
    if (s === 1) {
      $('#vf-plan').textContent = '';
      if (!(await typeText($('#vf-ask'), 'Crie um vídeo de 5 s, 1920×1080, com "SENAI" subindo e "Iracemápolis" logo depois, num fundo escuro com um traço laranja.', alive, 18))) return;
      await sleep(250);
      if (alive()) await typeText($('#vf-plan'), 'Vou criar o projeto com uma cena de abertura (5 s, 30 fps), animar o título com GSAP e abrir a prévia.', alive, 16);
    } else if (s === 2) {
      await typeText($('#vf-code'), VF_CODE, alive, 4);
    } else if (s === 4) {
      const box = $('#vf-check'); box.innerHTML = '';
      for (const [c, t] of VF_CHECK) {
        if (!alive()) return;
        const d = document.createElement('div'); d.className = c; d.textContent = t; box.appendChild(d);
        await sleep(380);
      }
    } else if (s === 5) {
      const fr = $('#vf-frames'); fr.innerHTML = '';
      for (let i = 0; i <= 30; i++) {
        if (!alive()) return;
        const n = Math.round(i / 30 * 150);
        $('#vf-fn').textContent = `quadro ${n} / 150`;
        $('#vf-prog').style.width = `${(i / 30) * 100}%`;
        if (i % 3 === 0 && i < 30) {
          const k = i / 30, th = document.createElement('i');
          th.style.setProperty('--k', k.toFixed(2));
          fr.appendChild(th);
        }
        await sleep(85);
      }
    } else if (s === 6) {
      $$('#vf-pc [data-w="6"] .file').forEach((f, k) => { f.classList.remove('in'); setTimeout(() => f.classList.add('in'), 120 + k * 160); });
    }
  }
  $('#vf-steps').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) vfShow(+b.dataset.s, false); });
  $('#vf-replay').addEventListener('click', () => vfShow(1, true));
  demos.vflow = { enter() { vfShow(1, true); vfLoop.start(); }, leave() { run('vf'); vfLoop.stop(); } };

  /* =========================================================
     18 · Cinco níveis, do simples ao complexo
     ========================================================= */
  const CAPS = [[0, 'Antes'], [0.35, 'de'], [0.55, 'ligar'], [0.9, 'a'], [1.05, 'máquina,'], [1.7, 'confira'], [2.1, 'os'], [2.3, 'seus'], [2.6, 'EPIs:'],
    [3.3, 'luvas,'], [3.8, 'óculos'], [4.2, 'e'], [4.4, 'protetor'], [4.9, 'auricular.']];
  const BARS = [['Elétrica', 312], ['Mecânica', 268], ['TI', 401], ['Logística', 155], ['Química', 112]];
  const SCENES = [['Abertura', 'Mecatrônica · SENAI', '#4b3f9e'], ['3 motivos', 'mercado · prática · salário', '#2b6a8f'], ['Depoimento', 'Ana, turma 2025', '#8a3f6b'], ['Chamada', 'inscreva-se no site', '#b4541c']];
  const LV = [
    {
      dur: 5, badges: ['5 s', '15 min de aula', 'Iniciante'], lvl: 1,
      prompt: 'Crie um vídeo de 5 segundos em 1920×1080 com as palavras "Inteligência Artificial" entrando uma de cada vez, de baixo para cima, e "na prática" em itálico logo depois. Fundo lilás claro.',
      code: `compositions/titulo.html
  <h1 class="clip" data-start="0" data-duration="5">
    <span>Inteligência</span> <span>Artificial</span>
  </h1>
  tl.from("h1 span", { y: 60, opacity: 0,
    stagger: 0.25, ease: "power3.out" }, 0.2);`,
      learn: '<b>Você aprende:</b> clipes com início e duração, e uma linha do tempo com atraso entre as palavras (stagger).'
    },
    {
      dur: 5.6, badges: ['20 s', '25 min de aula', 'Básico'], lvl: 2,
      prompt: 'Transcreva o áudio dica.mp3 e crie legendas palavra por palavra, em blocos de até 4 palavras. A palavra falada fica laranja. Formato vertical 9:16 para o Instagram.',
      code: `npx hyperframes transcribe assets/dica.mp3
# → transcript.json com o tempo de cada palavra
<audio id="voz" src="assets/dica.mp3"
       data-start="0" data-duration="20"></audio>
<div class="clip legenda" data-start="0" …>`,
      learn: '<b>Você aprende:</b> transcrição com o tempo de cada palavra, legendas sincronizadas e formato vertical.'
    },
    {
      dur: 6, badges: ['15 s', '40 min de aula', 'Intermediário'], lvl: 3,
      prompt: 'Crie um vídeo de 15 s: primeiro o total de 1.248 matrículas contando de 0 até o valor; depois um gráfico de barras por curso (TI 401, Elétrica 312, Mecânica 268, Logística 155, Química 112) que cresce uma barra por vez e destaca a maior. Fonte embaixo.',
      code: `const dados = { total: 1248, cursos: [
  { nome: "TI", valor: 401 }, … ] };
tl.to(contador, { valor: dados.total,
  duration: 1.4, onUpdate: mostrarNumero }, 0.6);
tl.from(".barra", { scaleY: 0, transformOrigin: "bottom",
  stagger: 0.28, ease: "power2.out" }, 2);`,
      learn: '<b>Você aprende:</b> número que conta, barras que entram em sequência (stagger) e destaque do maior valor, sempre com a fonte na tela.'
    },
    {
      dur: 6, badges: ['10 s', '60 min de aula', 'Avançado'], lvl: 4,
      prompt: 'Crie em three.js um planeta com anel e duas luas, com luz quente na frente e fria na borda. A câmera mergulha até o anel. Desenhe cada quadro a partir do tempo (evento hf-seek), sem Math.random solto.',
      code: `window.addEventListener("hf-seek", e => {
  const t = e.detail.time;
  planeta.rotation.y = t * 0.6;
  camera.position.lerpVectors(longe, perto, suave(t / 10));
  renderer.render(cena, camera);
});`,
      learn: '<b>Você aprende:</b> uma cena 3D desenhada pelo tempo, câmera com mergulho e luz de estúdio.'
    },
    {
      dur: 6, badges: ['30 s', '60 min de aula', 'Avançado'], lvl: 4,
      prompt: 'Monte um vídeo de 30 s do curso de Mecatrônica em 4 cenas: abertura com o nome, 3 motivos para fazer o curso, um depoimento com legenda e a chamada final com o site. Transição de deslize entre as cenas e música de fundo que abaixa quando alguém fala.',
      code: `index.html  ← junta as 4 cenas na ordem
<div data-composition-id="abertura"
     data-composition-src="compositions/abertura.html"
     data-start="0" data-duration="6"></div>
<div data-composition-id="motivos" … data-start="6">
<audio id="trilha" src="assets/trilha.mp3"
       data-volume="0.35" data-fade-out="2"></audio>`,
      learn: '<b>Você aprende:</b> um vídeo de verdade é feito de cenas: cada uma num arquivo, montadas em ordem, com transições e trilha sonora.'
    }
  ];
  let lv = 0, lvT = 0;
  const cap = $('#lv-cap'), bars = $('#lv-bars'), batch = $('#lv-batch');
  bars.innerHTML = BARS.map(([n, v]) => `<div class="k3-bar${v === 401 ? ' top' : ''}"><i></i><small>${n}</small><b>${v}</b></div>`).join('');
  batch.classList.add('scenes');
  batch.innerHTML = SCENES.map(([n, d, c], i) => `<div class="k5-card k5-scene" style="--bgc:${c}"><span class="k5-n">cena ${i + 1}</span><b>${n}</b><small>${d}</small><i class="k5-prog"><i></i></i></div>`).join('') +
    '<div class="k5-trans"><span>deslize →</span><span>deslize →</span><span>deslize →</span><span>trilha 35% · abaixa na fala</span></div>';
  const k1 = $$('#lv-stage .k1 > *');
  const cv = $('#lv-3d'), g = cv.getContext('2d');
  function draw3d(t) {
    const W = cv.width, H = cv.height;
    g.fillStyle = '#0b0b16'; g.fillRect(0, 0, W, H);
    // estrelas fixas (semente pelo índice: o mesmo quadro sempre igual)
    for (let i = 0; i < 90; i++) {
      const x = (Math.sin(i * 12.9898) * 43758.5453 % 1 + 1) % 1, y = (Math.sin(i * 78.233) * 12345.678 % 1 + 1) % 1;
      g.fillStyle = `rgba(255,255,255,${0.25 + (i % 5) * 0.12})`; g.fillRect(x * W, y * H, 1.4, 1.4);
    }
    const zoom = 1 + ease(t / 6) * 0.7, cx = W / 2, cy = H / 2 + 6, R = 70 * zoom, rot = t * 0.6, tilt = 0.38;
    const ring = (back) => {
      g.save(); g.translate(cx, cy); g.rotate(-0.25);
      for (let k = 0; k < 3; k++) {
        g.beginPath(); g.ellipse(0, 0, R * (1.55 + k * 0.17), R * (1.55 + k * 0.17) * tilt, 0, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
        g.strokeStyle = `rgba(255,200,150,${0.5 - k * 0.12})`; g.lineWidth = 6 * zoom - k * 1.2; g.stroke();
      }
      g.restore();
    };
    ring(true);
    const sg = g.createRadialGradient(cx - R * 0.45, cy - R * 0.45, R * 0.1, cx, cy, R);
    sg.addColorStop(0, '#ffd2a8'); sg.addColorStop(0.45, '#c26a3a'); sg.addColorStop(1, '#2a1230');
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fillStyle = sg; g.fill();
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    for (let b = -3; b <= 3; b++) {              // faixas que giram com o planeta
      g.beginPath(); g.ellipse(cx + Math.sin(rot + b) * 6, cy + b * R * 0.26, R * 1.05, R * 0.06, 0, 0, Math.PI * 2);
      g.fillStyle = `rgba(255,235,210,${0.06 + 0.05 * Math.cos(rot * 2 + b)})`; g.fill();
    }
    g.restore();
    g.beginPath(); g.arc(cx, cy, R + 3, -2.4, 0.6); g.strokeStyle = 'rgba(156,192,255,.55)'; g.lineWidth = 3; g.stroke();   // luz fria na borda
    ring(false);
    [[1.0, 0.0, 9], [1.7, 2.1, 6]].forEach(([sp, ph, r], k) => {   // duas luas
      const a = t * sp + ph, mx = cx + Math.cos(a) * R * (2.3 + k * 0.5), my = cy + Math.sin(a) * R * 0.5;
      g.beginPath(); g.arc(mx, my, r * zoom, 0, Math.PI * 2); g.fillStyle = Math.sin(a) < 0 ? '#9a96a8' : '#e6e1da'; g.fill();
    });
  }
  function lvRender(t) {
    const L = LV[lv];
    $('#lv-tc').textContent = fmt(t); $('#lv-dur').textContent = fmt(L.dur);
    $('#lv-head').style.left = `${(t / L.dur) * 100}%`;
    if (lv === 0) {
      k1.forEach((el, i) => { const k = ease((t - 0.2 - i * 0.3) / 0.7); el.style.transform = `translateY(${(1 - k) * 40}px)`; el.style.opacity = k; });
      $('#lv-stage .k1').style.setProperty('--line', ease((t - 1.3) / 1).toFixed(3));
    } else if (lv === 1) {
      let w = 0; while (w + 1 < CAPS.length && CAPS[w + 1][0] <= t) w++;
      const b0 = Math.floor(w / 4) * 4;
      cap.innerHTML = CAPS.slice(b0, b0 + 4).map(([, x], k) => `<span class="${b0 + k === w ? 'on' : b0 + k < w ? 'said' : ''}">${esc(x)}</span>`).join(' ');
      $('#lv-stage .k2-wave').style.setProperty('--a', (0.35 + 0.65 * Math.abs(Math.sin(t * 9) * Math.sin(t * 3.1))).toFixed(2));
    } else if (lv === 2) {
      const n = Math.round(1248 * ease((t - 0.4) / 1.4));
      $('#lv-num').textContent = br(n);
      $$('.k3-bar', bars).forEach((b, i) => { const k = ease((t - 2 - i * 0.28) / 0.8); b.style.setProperty('--h', (BARS[i][1] / 401 * k).toFixed(3)); b.classList.toggle('lit', t > 4.2 && BARS[i][1] === 401); });
    } else if (lv === 3) {
      draw3d(t);
    } else if (lv === 4) {
      // a agulha passa pelas 4 cenas, uma depois da outra (cada uma 1,4 s nesta prévia)
      $$('.k5-card', batch).forEach((c, i) => {
        const k = clamp((t - 0.2 - i * 1.4) / 1.4);
        c.style.setProperty('--p', k.toFixed(3)); c.classList.toggle('done', k >= 1); c.classList.toggle('busy', k > 0 && k < 1);
      });
      $$('.k5-trans span', batch).forEach((sp, i) => sp.classList.toggle('on', i < 3 ? Math.abs(t - 0.2 - (i + 1) * 1.4) < 0.3 : t > 0.2));
    }
  }
  function lvSet(i) {
    lv = i; lvT = 0;
    const L = LV[i];
    $$('#lv-tabs button').forEach(b => b.classList.toggle('on', +b.dataset.l === i));
    $$('#lv-stage .lv-scene').forEach(s => s.classList.toggle('on', +s.dataset.l === i));
    $('#lv-prompt').textContent = L.prompt;
    $('#lv-code').textContent = L.code;
    $('#lv-learn').innerHTML = L.learn;
    $('#lv-badges').innerHTML = `<span><svg class="i sm"><use href="#i-clock"/></svg>${L.badges[0]}</span><span><svg class="i sm"><use href="#i-users"/></svg>${L.badges[1]}</span><span class="lvl">${L.badges[2]}<i class="${L.lvl >= 1 ? 'on' : ''}"></i><i class="${L.lvl >= 2 ? 'on' : ''}"></i><i class="${L.lvl >= 3 ? 'on' : ''}"></i><i class="${L.lvl >= 4 ? 'on' : ''}"></i></span>`;
    lvRender(0);
  }
  const lvLoop = loop(dt => { lvT = (lvT + dt) % (LV[lv].dur + 1.2); lvRender(Math.min(lvT, LV[lv].dur)); });
  $('#lv-tabs').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) lvSet(+b.dataset.l); });
  lvSet(0);
  demos.vlevels = { enter() { lvT = 0; lvLoop.start(); }, leave() { lvLoop.stop(); } };

  /* =========================================================
     17 · Automação de dados: planilha → relatório (pandas + openpyxl)
     ========================================================= */
  // [região como está na planilha, fevereiro, março]; null = célula vazia
  const SV = [['Sul', 205, 231], ['Sudeste', 362, 398], ['Sudeste', 362, 398], ['centro-oeste ', 120, null], ['Nordeste', 171, 166], [' norte', 80, 88]];
  const SV_FIX = { 3: 'Centro-Oeste', 5: 'Norte' }, SV_DUP = 2, SV_GAP = 3;
  const SV_ABBR = { Sul: 'S', Sudeste: 'SE', 'Centro-Oeste': 'CO', Nordeste: 'NE', Norte: 'N' };
  const SV_CODE = [
    ['k', 'import pandas as pd'],
    ['k', 'from openpyxl import load_workbook'],
    ['k', 'from openpyxl.chart import BarChart, Reference'],
    ['', ''],
    ['c', '# 1. lê e limpa'],
    ['', 'df = pd.read_excel("vendas_marco.xlsx")', 'read'],
    ['', 'df["Região"] = df["Região"].str.strip().str.title()', 'fix'],
    ['', 'df = df.drop_duplicates()', 'dup'],
    ['', 'faltando = df[df["Mar"].isna()]   # não inventa: avisa', 'gap'],
    ['', ''],
    ['c', '# 2. calcula a variação'],
    ['', 'df["Var %"] = (df["Mar"] / df["Fev"] - 1) * 100', 'var'],
    ['', 'quedas = df[df["Var %"] < 0]'],
    ['', ''],
    ['c', '# 3. salva o relatório com gráfico'],
    ['', 'df.to_excel("relatorio_marco.xlsx", index=False)'],
    ['', 'wb = load_workbook("relatorio_marco.xlsx"); ws = wb.active'],
    ['', 'graf = BarChart(); graf.title = "Vendas de março"'],
    ['', 'graf.add_data(Reference(ws, min_col=3, min_row=1, max_row=ws.max_row),'],
    ['', '              titles_from_data=True)'],
    ['', 'ws.add_chart(graf, "F2"); wb.save("relatorio_marco.xlsx")', 'save']
  ];
  const svTable = $('#sv-table'), svOut = $('#sv-out'), svCode = $('#sv-code');
  const pct = (a, b) => (b / a - 1) * 100;
  const pctTxt = v => `${v > 0 ? '+' : '−'}${br(Math.abs(Math.round(v * 10) / 10))}%`;
  function svReset() {
    svTable.innerHTML = '<tr><th></th><th>A</th><th>B</th><th>C</th><th>D</th></tr><tr><th>1</th><td>Região</td><td>Fev</td><td>Mar</td><td>Var %</td></tr>' +
      SV.map((r, i) => `<tr data-r="${i}"><th>${i + 2}</th><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2] ?? ''}</td><td></td></tr>`).join('');
    const ok = SV.filter((r, i) => i !== SV_DUP && r[2] != null), max = Math.max(...ok.map(r => r[2]));
    svOut.innerHTML = `
      <div class="sv-art" data-a="0"><b><svg class="i sm"><use href="#i-check-circle"/></svg>Dados limpos</b><p>2 nomes corrigidos · 1 linha duplicada removida · 1 célula vazia marcada</p></div>
      <div class="sv-art" data-a="1"><b><svg class="i sm"><use href="#i-trend"/></svg>Variação fev → mar</b><ul>${ok.map(r => { const v = pct(r[1], r[2]); return `<li><span>${esc((SV_FIX[SV.indexOf(r)] || r[0]).trim())}</span><span class="${v < 0 ? 'down' : 'up'}">${pctTxt(v)}</span></li>`; }).join('')}</ul></div>
      <div class="sv-art" data-a="2"><b><svg class="i sm"><use href="#i-chart"/></svg>Gráfico de março</b><div class="sv-chart">${ok.map(r => `<i style="--h:${(r[2] / max).toFixed(3)}"><small>${SV_ABBR[(SV_FIX[SV.indexOf(r)] || r[0]).trim()]}</small></i>`).join('')}</div></div>
      <div class="sv-art" data-a="3"><b><svg class="i sm"><use href="#i-alert"/></svg>2 alertas</b><ul><li class="down"><span>Nordeste caiu</span><span>${pctTxt(pct(171, 166))}</span></li><li class="warn"><span>Centro-Oeste</span><span>sem março</span></li></ul></div>`;
  }
  const svRow = i => $(`tr[data-r="${i}"]`, svTable);
  const svArt = k => $(`.sv-art[data-a="${k}"]`, svOut).classList.add('done');
  async function runSheet() {
    const alive = run('sv');
    svCode.innerHTML = ''; svReset();
    for (const [c, line, act] of SV_CODE) {
      if (!alive()) return;
      const d = document.createElement('div'); d.className = c === 'k' ? 'kw' : c === 'c' ? 'cmt' : ''; svCode.appendChild(d);
      if (line) { if (!(await typeText(d, line, alive, 3))) return; } else d.textContent = ' ';
      if (act === 'read') {
        for (const r of $$('tr[data-r]', svTable)) { if (!alive()) return; r.classList.add('hl'); await sleep(140); }
        $$('tr[data-r]', svTable).forEach(r => r.classList.remove('hl'));
      } else if (act === 'fix') {
        for (const [i, n] of Object.entries(SV_FIX)) { const td = svRow(i).children[1]; td.textContent = n; td.classList.add('fix'); await sleep(260); }
      } else if (act === 'dup') {
        svRow(SV_DUP).classList.add('dup'); await sleep(500); svRow(SV_DUP).classList.add('gone');
      } else if (act === 'gap') {
        const td = svRow(SV_GAP).children[3]; td.textContent = '?'; td.classList.add('flag'); await sleep(300);
        svArt(0);
      } else if (act === 'var') {
        for (const [i, r] of SV.entries()) {
          if (!alive()) return;
          if (i === SV_DUP || r[2] == null) continue;
          const v = pct(r[1], r[2]), td = svRow(i).children[4];
          td.textContent = pctTxt(v); td.className = `new ${v < 0 ? 'down' : 'up'}`;
          await sleep(180);
        }
        svArt(1);
      } else if (act === 'save') {
        await sleep(200); svArt(2); await sleep(500); if (alive()) svArt(3);
      }
    }
    if (!alive()) return;
    const log = document.createElement('div'); log.className = 'ok'; log.textContent = '✓ relatorio_marco.xlsx salvo · 4 regiões · 2 alertas'; svCode.appendChild(log);
  }
  svReset();
  $('#sv-run').addEventListener('click', runSheet);
  demos.asheet = { enter: runSheet, leave() { run('sv'); } };

  /* =========================================================
     18 · Automação de dados: workflow com agente (modo sem janela)
     ========================================================= */
  const WF_LOG = [
    [0, 'p', '$ relatorio_semanal.bat'],
    [1, 'a', 'claude -p "Gere o relatório de março, confira os totais e escreva um resumo"'],
    [1, 't', 'Read entrada/vendas_marco.xlsx'],
    [1, 't', 'Bash python relatorio.py → relatorio_marco.xlsx'],
    [2, 't', 'Bash teste: soma do relatório = soma da planilha ✓'],
    [2, 'w', '2 alertas: Nordeste −2,9% · Centro-Oeste sem março'],
    [3, 't', 'Write saida/resumo.md (5 linhas)'],
    [3, 't', 'Write saida/email_rascunho.txt'],
    [4, 'a', 'Pronto · aguardando aprovação para enviar']
  ];
  const WF_OUT = { 'relatorio.py': [['relatorio_marco.xlsx', 'i-table', 'Resumo + gráfico'], ['grafico_vendas.png', 'i-chart', '1200×700']],
    'resumo.md': [['resumo.md', 'i-file-text', '5 linhas · 2 alertas']], 'email_rascunho': [['email_rascunho.txt', 'i-send', 'rascunho · não enviado']] };
  async function runWorkflow() {
    const alive = run('wf');
    const inBox = $('#wf-in'), outBox = $('#wf-out'), logBox = $('#wf-log'), nodes = $$('#wf-nodes li');
    inBox.innerHTML = '<div class="file"><svg class="i"><use href="#i-table"/></svg><b>vendas_fevereiro.xlsx</b><small>relatório enviado em 03/03</small></div>';
    outBox.innerHTML = ''; logBox.innerHTML = '';
    $('#wf-toast').classList.remove('show');
    nodes.forEach(n => n.classList.remove('on', 'done'));
    const setNode = k => nodes.forEach((n, j) => { n.classList.toggle('on', j === k); n.classList.toggle('done', j < k); });
    if (!(await sleep(500), alive())) return;
    setNode(0);
    const f = document.createElement('div'); f.className = 'file new';
    f.innerHTML = '<svg class="i"><use href="#i-table"/></svg><b>vendas_marco.xlsx</b><small>nova · agora</small>';
    inBox.prepend(f);
    await sleep(900);
    for (const [k, c, t] of WF_LOG) {
      if (!alive()) return;
      setNode(k);
      const d = document.createElement('div'); d.className = c; logBox.appendChild(d);
      if (c === 'p') await typeText(d, t, alive, 22); else { d.textContent = t; d.style.animation = 'rise .4s both'; }
      logBox.scrollTop = logBox.scrollHeight;
      await sleep(c === 't' ? 520 : 760);
      const made = Object.keys(WF_OUT).find(key => t.includes(key));
      if (made) {
        for (const [name, icon, info] of WF_OUT[made]) {
          if (!alive()) return;
          const o = document.createElement('div'); o.className = 'file new';
          o.innerHTML = `<svg class="i"><use href="#${icon}"/></svg><b>${name}</b><small>${info}</small>`;
          outBox.appendChild(o); await sleep(380);
        }
      }
    }
    if (!alive()) return;
    setNode(4);
    $('#wf-toast').classList.add('show');
  }
  $('#wf-run').addEventListener('click', runWorkflow);
  demos.aflow = { enter: runWorkflow, leave() { run('wf'); } };
})();
