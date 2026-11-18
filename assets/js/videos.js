/* =========================================================
   IA na Prática · vídeos das cenas 3D
   Por padrão a galáxia da abertura e o final "Do Big Bang ao SENAI" passam como
   vídeo (gravados do próprio site com tools/gravar-videos.mjs): rodam lisos em
   qualquer computador, mesmo quando a rede bloqueia scripts.
   O botão "Explorar em 3D" troca para a versão ao vivo (galaxy.js e cosmos.js).
   Sem JavaScript, os vídeos continuam tocando (veja o <noscript> do index.html).
   ========================================================= */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const html = document.documentElement;
  const demos = (window.IADemos = window.IADemos || {});

  /* ---------- troca para o 3D ao vivo ---------- */
  function goLive(then) {
    if (html.classList.contains('live3d')) { then?.(); return; }
    const was = demos.cosmos;
    was?.leave?.();
    html.classList.replace('vid', 'live3d');
    window.__live3d = true;
    $('.gx-video')?.pause();
    (window.IALoad3D ? window.IALoad3D() : Promise.reject(new Error('sem módulos')))
      .then(() => then?.())
      .catch(e => { console.error(e); html.classList.replace('live3d', 'vid'); $('.gx-video')?.play().catch(() => {}); alert('O 3D ao vivo não carregou nesta rede ou neste navegador. Os vídeos continuam funcionando.'); });
  }
  window.IAGoLive = goLive;

  /* ---------- abertura: galáxia em vídeo ---------- */
  const gxv = $('.gx-video');
  if (gxv) {
    gxv.addEventListener('error', () => $('#gx')?.classList.add('nogl'));      // sem o vídeo: o céu feito só com CSS
    $('#gx-live')?.addEventListener('click', () => goLive());
  }

  /* ---------- final: Big Bang em vídeo, em tela cheia com faixas de cinema ---------- */
  const root = $('.cos'), v = $('.cos-video');
  if (root && v) {
    const home = document.createComment('cos-video');
    let weFS = false;
    const cinema = on => {
      if (on && root.parentNode !== document.body) { root.before(home); document.body.append(root); }
      if (!on && home.parentNode) home.replaceWith(root);
      root.classList.toggle('cinema', on);
      if (on && !document.fullscreenElement && !/[?&]teste\b/.test(location.search)) document.documentElement.requestFullscreen?.().then(() => { weFS = true; }).catch(() => {});
      if (!on && weFS && document.fullscreenElement) { weFS = false; document.exitFullscreen().catch(() => {}); }
    };
    const videoDemo = {
      enter() {
        if (html.classList.contains('live3d')) return;
        root.classList.remove('ended'); cinema(true);
        try { v.currentTime = 0; } catch { /* ainda carregando */ }
        v.play().catch(() => {});                                               // sem permissão para tocar: os controles do vídeo ficam à mostra
      },
      leave() { v.pause(); cinema(false); root.classList.remove('ended'); }
    };
    if (!html.classList.contains('live3d')) demos.cosmos = videoDemo;
    v.addEventListener('ended', () => root.classList.add('ended'));
    v.addEventListener('play', () => root.classList.remove('ended'));
    $('#cos-replay')?.addEventListener('click', () => { if (html.classList.contains('live3d')) return; root.classList.remove('ended'); v.currentTime = 0; v.play().catch(() => {}); });
    $('#cos-exit')?.addEventListener('click', () => { if (!html.classList.contains('live3d')) cinema(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !html.classList.contains('live3d') && root.classList.contains('cinema')) cinema(false); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && weFS) { weFS = false; if (!html.classList.contains('live3d')) cinema(false); } });
    // "Explorar a escola em 3D": abre a versão ao vivo já no fim, com a câmera livre em volta do SENAI
    $('#cos-live')?.addEventListener('click', () => {
      v.pause(); cinema(false); root.classList.remove('ended');
      goLive(() => {
        const wait = () => window.IADemos.cosmos !== videoDemo ? (window.IADemos.cosmos.enter(), window.IACosmosEnd?.()) : setTimeout(wait, 50);
        wait();
      });
    });
  }

  /* ---------- estúdio: se o 3D não rodar, entra o vídeo da cena ---------- */
  const t3 = $('.t3-view');
  if (t3) {
    const fix = () => { if (t3.classList.contains('nogl')) { const tv = $('.t3-video', t3); tv.preload = 'auto'; tv.play().catch(() => {}); } };
    new MutationObserver(fix).observe(t3, { attributes: true, attributeFilter: ['class'] }); fix();
  }
})();
