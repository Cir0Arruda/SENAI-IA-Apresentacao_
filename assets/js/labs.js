/* =========================================================
   IA na Prática · Laboratórios dos tópicos 1.1 a 1.6
   Um mini jogo por tópico, com pontos, sequência de acertos e explicação
   de cada resposta. O 1.4 tem um simulador de "temperatura" do modelo.
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k) { try { return +localStorage.getItem('ia-lab-' + k) || 0; } catch { return 0; } },
    set(k, v) { try { localStorage.setItem('ia-lab-' + k, v); } catch { /* sem armazenamento */ } }
  };

  const LABS = {
    translate: {
      title: 'Desafio dos falsos amigos', ic: 'languages',
      intro: 'Palavras parecidas com o português, mas com outro sentido. É aqui que a tradução palavra por palavra erra.',
      items: [
        { q: 'Em inglês, <b>"pretend"</b> quer dizer…', o: ['fingir', 'pretender', 'prender'], a: 0, why: '"Pretender" em inglês é <b>to intend</b>. "Pretend" é fingir: <i>He pretended to be sick</i>.' },
        { q: 'Na porta está escrito <b>"PUSH"</b>. Você deve…', o: ['puxar', 'empurrar'], a: 1, why: '<b>Push</b> = empurrar. <b>Pull</b> = puxar. Um clássico de placa mal entendida.' },
        { q: '<b>"Actually"</b> significa…', o: ['atualmente', 'na verdade'], a: 1, why: '"Atualmente" é <b>currently</b> ou <b>nowadays</b>. "Actually" é "na verdade".' },
        { q: 'Em espanhol, uma comida <b>"exquisita"</b> é…', o: ['esquisita, estranha', 'deliciosa, requintada'], a: 1, why: 'Em espanhol, <b>exquisito</b> é elogio. "Esquisito" seria <b>raro</b> ou <b>extraño</b>.' },
        { q: 'No manual da oficina aparece <b>"lathe"</b>. É um…', o: ['torno mecânico', 'tipo de lata', 'laço'], a: 0, why: '<b>Lathe</b> = torno. Termos técnicos assim confundem tradutores genéricos: peça "inglês técnico de usinagem" no prompt.' },
        { q: 'Em espanhol, <b>"estoy embarazada"</b> quer dizer…', o: ['estou envergonhada', 'estou grávida'], a: 1, why: '<b>Embarazada</b> = grávida. Envergonhada é <b>avergonzada</b>. Por isso, revise com quem fala a língua.' }
      ]
    },
    assistant: {
      title: 'Adivinhe a intenção', ic: 'mic',
      intro: 'O assistente precisa descobrir <b>o que você quer</b> (a intenção) e <b>os detalhes</b> (os "slots"). Faça o papel dele.',
      opts: ['Alarme ou lembrete', 'Cálculo', 'Música', 'Rota', 'Clima'],
      items: [
        { q: '"Me acorda às seis e meia"', a: 0, why: 'intenção: <span class="lab-k">criar_alarme</span> · horário: <span class="lab-k">06:30</span>' },
        { q: '"Vai chover em Iracemápolis amanhã?"', a: 4, why: 'intenção: <span class="lab-k">previsão_do_tempo</span> · cidade: <span class="lab-k">Iracemápolis</span> · dia: <span class="lab-k">amanhã</span>' },
        { q: '"Quanto dá 3 vezes 220?"', a: 1, why: 'intenção: <span class="lab-k">calcular</span> · expressão: <span class="lab-k">3 × 220 = 660</span>' },
        { q: '"Bota aquela playlist de lo-fi pra estudar"', a: 2, why: 'intenção: <span class="lab-k">tocar_música</span> · gênero: <span class="lab-k">lo-fi</span>. Note a gíria "bota": o modelo entende mesmo assim.' },
        { q: '"Qual o caminho mais rápido até Limeira?"', a: 3, why: 'intenção: <span class="lab-k">rota</span> · destino: <span class="lab-k">Limeira</span> · critério: <span class="lab-k">mais rápido</span>' },
        { q: '"Não me deixa esquecer de devolver a chave do laboratório"', a: 0, why: 'intenção: <span class="lab-k">criar_lembrete</span> · o quê: <span class="lab-k">devolver a chave</span> · quando: <span class="lab-k">não informado</span>, então o assistente pergunta "Para quando?"' }
      ]
    },
    chatbot: {
      title: 'Confiar ou conferir?', ic: 'message',
      intro: 'Leia a resposta do bot e decida. Chatbots com IA escrevem bem até quando estão errados.',
      opts: ['Pode confiar', 'Confira antes', 'Provavelmente inventou'],
      items: [
        { q: 'Bot: "Pela Lei de Ohm, V = R × I. Com 10 Ω e 2 A, a tensão é 20 V."', a: 0, why: 'Conhecimento geral, bem estabelecido, e a conta está certa. Mesmo assim, refaça contas importantes.' },
        { q: 'Bot genérico, sem acesso ao sistema da escola: "Sua prova de Elétrica é dia 12, às 14h, na sala 4."', a: 2, why: 'O bot <b>não tem</b> os dados da sua turma, então inventou datas convincentes. Isso é <b>alucinação</b>. Confira no calendário oficial.' },
        { q: 'Bot: "Segundo um estudo de Silva (2019), 87% dos torneiros preferem…" (sem link)', a: 2, why: 'Citação sem fonte verificável é um sinal clássico. Peça o link e procure o estudo. Muitas vezes ele não existe.' },
        { q: 'Bot da escola: "Não encontrei isso nos documentos do SENAI. Quer falar com a secretaria?"', a: 0, why: 'Ótimo comportamento: ele <b>admitiu</b> que não sabe e ofereceu uma pessoa. É isso que um bot com RAG bem feito faz.' },
        { q: 'Bot: "O torque de aperto desse parafuso M10 é 49 N·m."', a: 1, why: 'Pode estar certo, mas depende da classe do parafuso e do fabricante. Em segurança e manutenção, <b>vale o manual</b>.' }
      ]
    },
    summary: {
      title: 'Ache o erro no resumo', ic: 'search', spot: true,
      intro: 'O resumo abstrativo reescreve o texto e às vezes troca um número ou um nome. Clique na palavra errada.',
      items: [
        { src: 'A manutenção preventiva da prensa deve ser feita a cada 250 horas de uso, sempre com a máquina desligada e travada.', sum: 'Faça a manutenção da prensa a cada 500 horas, com ela desligada e travada.', bad: ['500'], why: 'O original diz <b>250 horas</b>. Um número trocado num resumo de manutenção pode quebrar a máquina.' },
        { src: 'Na reunião de segunda, ficou decidido que Ana cuida do estoque e Bruno cuida das compras.', sum: 'Na reunião, Bruno ficou com o estoque e Ana com as compras.', bad: ['Bruno', 'Ana'], why: 'Os nomes foram <b>invertidos</b>. Em atas, confira sempre quem ficou responsável pelo quê.' },
        { src: 'O curso tem 800 horas, e as aulas práticas ocupam metade da carga horária.', sum: 'O curso de 800 horas é todo prático, na oficina.', bad: ['todo'], why: 'Só <b>metade</b> é prática. O resumo exagerou: isso também é um erro.' },
        { src: 'O uso de protetor auricular é obrigatório acima de 85 dB, conforme a NR-15.', sum: 'Acima de 85 dB o protetor auricular é recomendado, segundo a NR-15.', bad: ['recomendado'], why: '"Obrigatório" virou "recomendado". Uma palavra muda a regra de segurança.' }
      ]
    },
    prompt: {
      title: 'Qual prompt é melhor?', ic: 'sparkles',
      intro: 'Escolha o pedido que dá a melhor resposta. Veja qual ingrediente fez a diferença.',
      items: [
        { q: 'Você quer entender corrente elétrica.', o: ['Explica eletricidade', 'Explique o que é corrente elétrica para um aluno do 1º ano, em 5 linhas, com um exemplo da oficina.'], a: 1, why: 'Ingredientes: <span class="lab-k">público</span> <span class="lab-k">formato</span> <span class="lab-k">exemplo</span>. O primeiro é amplo demais.' },
        { q: 'Seu programa deu erro.', o: ['Corrige meu código', 'Este código Python dá "IndexError" na linha 3 (código abaixo). Explique a causa e mostre a correção.'], a: 1, why: 'Ingrediente: <span class="lab-k">contexto</span>. Sem o erro e o código, a IA só pode chutar.' },
        { q: 'Você quer comparar duas máquinas.', o: ['Faça uma tabela comparando torno e fresadora com 4 linhas: uso, peça típica, cuidados e EPI.', 'Fala sobre torno e fresadora'], a: 0, why: 'Ingrediente: <span class="lab-k">formato</span>. Dizer as colunas e linhas organiza a resposta.' },
        { q: 'Semana de prova da NR-12.', o: ['Me dá as respostas da prova', 'Me faça 5 perguntas sobre a NR-12, uma por vez, e corrija cada resposta minha.'], a: 1, why: 'A IA vira <span class="lab-k">tutor</span>: você aprende de verdade, e não só copia.' },
        { q: 'Um aviso para o mural.', o: ['Escreva um aviso de até 3 linhas sobre óculos de proteção. Tom amigável, sem palavras difíceis.', 'Escreva sobre segurança'], a: 0, why: 'Ingredientes: <span class="lab-k">tamanho</span> <span class="lab-k">tom</span> <span class="lab-k">restrição</span>.' }
      ]
    }
  };

  const medal = p => p >= 1 ? ['Ouro', 'gold'] : p >= 0.7 ? ['Prata', 'silver'] : ['Bronze', 'bronze'];

  function mount(id, cfg) {
    const slide = $(`.slide[data-id="${id}"] .wrap`); if (!slide) return;
    const box = document.createElement('div');
    box.className = 'glass card lab'; box.setAttribute('data-anim', ''); box.dataset.lab = id;
    box.innerHTML = `<div class="lab-head"><span class="lab-ico"><svg class="i"><use href="#i-${cfg.ic}"/></svg></span>
      <div class="lab-tt"><span class="card-k nomb">Laboratório · jogo rápido</span><b>${cfg.title}</b></div>
      <div class="lab-score"><span class="lab-dots"></span><span class="lab-pts">0 pts</span><span class="lab-best"></span></div></div>
      <p class="lab-intro">${cfg.intro}</p><div class="lab-body" aria-live="polite"></div>`;
    const tpl = slide.querySelector('template.deep-tpl');
    slide.insertBefore(box, tpl);
    const body = $('.lab-body', box), dots = $('.lab-dots', box), pts = $('.lab-pts', box), best = $('.lab-best', box);
    let i = 0, score = 0, streak = 0, hits = 0, locked = false;
    const N = cfg.items.length;
    const showBest = () => { const b = store.get(id); best.textContent = b ? `recorde ${b}` : ''; };
    dots.innerHTML = cfg.items.map(() => '<i></i>').join('');
    showBest();
    function award(ok) {
      const d = dots.children[i];
      d.className = ok ? 'ok' : 'no';
      if (ok) { streak++; hits++; const g = 100 + (streak - 1) * 25; score += g; pop(`+${g}${streak > 1 ? ` · ${streak} seguidas!` : ''}`); }
      else streak = 0;
      pts.textContent = `${score} pts`;
    }
    function pop(t) { const s = document.createElement('span'); s.className = 'lab-pop'; s.textContent = t; box.append(s); setTimeout(() => s.remove(), 1200); }
    function feedback(ok, why) {
      const f = document.createElement('div'); f.className = 'lab-fb ' + (ok ? 'ok' : 'no');
      f.innerHTML = `<svg class="i sm"><use href="#i-${ok ? 'check-circle' : 'x-circle'}"/></svg><div><b>${ok ? 'Acertou!' : 'Quase!'}</b> ${why}</div>
        <button class="pill dark sm lab-next">${i < N - 1 ? 'Próxima' : 'Ver resultado'}<svg class="i sm"><use href="#i-arrow-right"/></svg></button>`;
      body.append(f);
      $('.lab-next', f).addEventListener('click', () => { i++; i < N ? render() : finish(); });
    }
    function render() {
      locked = false;
      const it = cfg.items[i];
      [...dots.children].forEach((d, k) => d.classList.toggle('cur', k === i));
      if (cfg.spot) {
        const words = it.sum.split(/(\s+)/);
        body.innerHTML = `<div class="lab-q"><small>Original</small><p class="lab-src">${esc(it.src)}</p><small>Resumo da IA</small><p class="lab-sum">${words.map(w => /\s/.test(w) ? w : `<button class="lab-w">${esc(w)}</button>`).join('')}</p></div>`;
        body.querySelectorAll('.lab-w').forEach(b => b.addEventListener('click', () => {
          if (locked) return; locked = true;
          const w = b.textContent.replace(/[.,;:!?]/g, ''), ok = it.bad.includes(w);
          body.querySelectorAll('.lab-w').forEach(x => { if (it.bad.includes(x.textContent.replace(/[.,;:!?]/g, ''))) x.classList.add('bad'); });
          if (!ok) b.classList.add('miss');
          award(ok); feedback(ok, it.why);
        }));
      } else {
        const opts = it.o || cfg.opts;
        body.innerHTML = `<p class="lab-q">${it.q}</p><div class="lab-opts${it.o && it.o[0].length > 40 ? ' long' : ''}">${opts.map((o, k) => `<button class="lab-o" data-k="${k}">${esc(o)}</button>`).join('')}</div>`;
        body.querySelectorAll('.lab-o').forEach(b => b.addEventListener('click', () => {
          if (locked) return; locked = true;
          const k = +b.dataset.k, ok = k === it.a;
          body.querySelectorAll('.lab-o').forEach(x => { x.disabled = true; if (+x.dataset.k === it.a) x.classList.add('right'); });
          if (!ok) b.classList.add('wrong');
          award(ok); feedback(ok, it.why);
        }));
      }
    }
    function finish() {
      const [m, cls] = medal(hits / N);
      if (score > store.get(id)) store.set(id, score);
      showBest();
      body.innerHTML = `<div class="lab-end"><span class="lab-medal ${cls}"><svg class="i"><use href="#i-trophy"/></svg></span>
        <div><b>${hits} de ${N} · ${score} pontos</b><span>Medalha de ${m}. ${hits === N ? 'Perfeito!' : 'Jogue de novo para tentar o ouro.'}</span></div>
        <button class="pill ghost sm lab-again"><svg class="i sm"><use href="#i-refresh"/></svg>Jogar de novo</button></div>`;
      $('.lab-again', body).addEventListener('click', () => { i = score = streak = hits = 0; pts.textContent = '0 pts'; [...dots.children].forEach(d => (d.className = '')); render(); });
    }
    render();
  }
  Object.entries(LABS).forEach(([id, cfg]) => mount(id, cfg));

  /* ---------- 1.4 · Temperatura: como a IA escolhe a próxima palavra ---------- */
  (() => {
    const slide = $('.slide[data-id="generate"] .wrap'); if (!slide) return;
    const BASE = [['indústria', 0.46], ['vida', 0.15], ['tecnologia', 0.12], ['mecânica', 0.09], ['sociedade', 0.07], ['automação', 0.05], ['Copa do Mundo', 0.015], ['Lua', 0.005]];
    const box = document.createElement('div');
    box.className = 'glass card lab temp'; box.setAttribute('data-anim', '');
    box.innerHTML = `<div class="lab-head"><span class="lab-ico"><svg class="i"><use href="#i-settings"/></svg></span>
      <div class="lab-tt"><span class="card-k nomb">Laboratório · simulador</span><b>A "temperatura" da IA</b></div></div>
      <p class="lab-intro">Para gerar texto, o modelo dá uma <b>probabilidade</b> para cada próxima palavra e sorteia uma. A <b>temperatura</b> muda esse sorteio: baixa = previsível, alta = criativa (e às vezes sem sentido).</p>
      <div class="tp-grid"><div><p class="tp-sent">"O SENAI forma profissionais para a <span class="tp-next" id="tp-next">___</span>"</p>
        <label class="range tp-range"><span>Temperatura: <b id="tp-val">1,0</b> <small id="tp-mood">equilibrada</small></span><input type="range" id="tp-t" min="0.1" max="2" step="0.1" value="1" aria-label="Temperatura"></label>
        <div class="row"><button class="pill dark sm" id="tp-go"><svg class="i sm"><use href="#i-sparkles"/></svg>Sortear 10 vezes</button><span class="tp-hist" id="tp-hist"></span></div></div>
        <div class="tp-bars" id="tp-bars">${BASE.map(([w]) => `<div class="tp-bar"><span>${w}</span><i><b></b></i><em>0%</em></div>`).join('')}</div></div>`;
    const tpl = slide.querySelector('template.deep-tpl'); slide.insertBefore(box, tpl);
    const range = $('#tp-t', box), bars = [...box.querySelectorAll('.tp-bar')];
    let probs = [];
    function calc() {
      const T = +range.value, l = BASE.map(([, p]) => Math.log(p) / T), m = Math.max(...l), e = l.map(x => Math.exp(x - m)), s = e.reduce((a, b) => a + b, 0);
      probs = e.map(x => x / s);
      bars.forEach((b, k) => { b.querySelector('b').style.transform = `scaleX(${probs[k]})`; b.querySelector('em').textContent = `${(probs[k] * 100).toFixed(probs[k] < 0.1 ? 1 : 0).replace('.', ',')}%`; });
      $('#tp-val', box).textContent = T.toFixed(1).replace('.', ',');
      $('#tp-mood', box).textContent = T < 0.5 ? 'quase sempre a mesma palavra' : T <= 1.2 ? 'equilibrada' : 'criativa demais: aparecem absurdos';
    }
    function sample() { let r = Math.random(), k = 0; while (k < probs.length - 1 && (r -= probs[k]) > 0) k++; return k; }
    range.addEventListener('input', calc);
    $('#tp-go', box).addEventListener('click', () => {
      const hist = $('#tp-hist', box), next = $('#tp-next', box); hist.innerHTML = ''; let n = 0;
      const tick = () => {
        const k = sample(); next.textContent = BASE[k][0]; next.classList.remove('pulse'); void next.offsetWidth; next.classList.add('pulse');
        bars.forEach((b, j) => b.classList.toggle('hit', j === k));
        const c = document.createElement('span'); c.textContent = BASE[k][0]; if (k >= 6) c.className = 'odd'; hist.append(c);
        if (++n < 10) setTimeout(tick, 260);
      };
      tick();
    });
    calc();
  })();
})();
