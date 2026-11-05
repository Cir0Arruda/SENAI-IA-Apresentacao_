# IA na Prática · SENAI Iracemápolis

Apresentação interativa sobre Inteligência Artificial, feita em HTML para o GitHub Pages.

**Ver online:** https://cir0arruda.github.io/SENAI-IA-Apresentacao_/

## Abertura: a galáxia feita por IA

Ao abrir o site aparece uma galáxia 3D, escrita com o Claude Code, como exemplo do que a IA pode fazer:

- **Galáxia espiral barrada volumétrica**, vista inclinada, desenhada a partir de fotos reais do Hubble (M51, M74 e NGC 1300): um bojo oval dourado com uma barra curta, e dois braços que nascem nas pontas da barra, abraçam o centro e vão se abrindo para fora (o ângulo de abertura passa de ~10° para ~18°, como nas galáxias reais). Cada braço tem o perfil de uma onda de densidade: a faixa de poeira fica na borda de dentro, logo depois vêm as regiões HII rosadas e os aglomerados de estrelas azuis, e o brilho azul se espalha para fora, com esporas de poeira atravessando o braço. Entre os braços há a luz fraca das estrelas velhas, como numa foto de verdade.
  - Um mapa da galáxia vista de cima é calculado uma vez na placa de vídeo.
  - A cada quadro, cada raio de luz atravessa o disco (*raymarching*): soma o brilho do gás e perde luz na poeira.
  - **150 mil estrelas** são sorteadas a partir do mesmo mapa e ficam mais escuras quando há poeira entre elas e a câmera. As estrelas fogem do cursor.
- **Clique num braço da galáxia** (ou no marcador "Sistema dos temas"): um único voo de câmera, sem cortes, como nos documentários:
  1. sobrevoa o braço e mergulha no disco;
  2. atravessa uma **nebulosa volumétrica**, e cada viagem mostra um dos **7 tipos**, com cores das linhas de emissão reais (hidrogênio vermelho, oxigênio verde-azulado, enxofre laranja): emissão (como Órion, com a cavidade aberta pelas estrelas), reflexão (como as Plêiades), planetária (como a do Anel), pilares de poeira (como os Pilares da Criação), remanescente de supernova (como o Véu), nebulosa escura (como a Cabeça de Cavalo) e bipolar (como a Formiga);
  3. chega a um **sistema planetário** com o braço da galáxia ao fundo: estrelas, nebulosas e poeira, com o brilho do centro suavizado.
  - Legendas no estilo de documentário explicam cada trecho. A volta faz o caminho inverso até ver a galáxia inteira.
- **8 planetas**, um por tema da apresentação, girando em volta de um sol com coroa, com cinturão de asteroides, atmosferas, nuvens, anéis com divisões e luas. Clique num planeta (ou na lista do painel) para ver o resumo e ir direto para o slide dele.
- **Buraco negro no centro**, calculado raio por raio (cada pixel é um raio de luz curvado pela gravidade), com disco de acreção em faixas, cor pela temperatura e anel de fótons. Clique em **Entrar no buraco negro**: a câmera se aproxima e a imagem passa para a vista de dentro com uma transição suave, sem clarão:
  - horizonte de eventos, esfera de fótons, disco de acreção, lente gravitacional e efeito Doppler, cada um com destaque e explicação;
  - controles para ligar ou desligar a curvatura da luz, o disco e o Doppler, e um controle de distância;
  - o botão **Mergulhar** leva a câmera até perto do horizonte;
  - **rótulos no próprio desenho**: sombra, anel de fótons, parte de trás do disco curvada pela gravidade e qual lado do disco vem até você (calculado pela posição da câmera);
  - **painel da nave com física de Schwarzschild ao vivo**: distância (em rs e km), quanto vale 1 hora sua lá longe (dilatação do tempo), velocidade de uma órbita circular, velocidade de escape e a maré no seu corpo. Dá para trocar entre Sagitário A* (4,3 milhões de sóis) e um buraco negro estelar (10 sóis);
  - **sonda em queda livre**: o relógio dela anda cada vez mais devagar visto de longe, ela fica vermelha, "congela" no horizonte e, no buraco negro estelar, vira espaguete;
  - **6 missões com XP** (ficam salvas no navegador), do anel de fótons à espaguetificação.
- A entrada no buraco negro desce até a altura do disco durante o voo, então a imagem de fora e a de dentro coincidem na troca, e o brilho do bojo diminui de perto.
- Arraste para girar e use a roda do mouse para aproximar.
- O botão **Iniciar**, no canto inferior direito (ou `Enter`), abre a apresentação. O ícone de espiral no menu lateral volta para a galáxia.
- Endereços com slide (`…/#5`) pulam a abertura. Em computadores sem WebGL, a apresentação abre normalmente.
- A imagem volumétrica é suavizada para não ficar granulada, e a qualidade se ajusta sozinha ao computador para manter a animação fluida.
- **Exposição como numa câmera**: a luz forte é comprimida aos poucos pelo canal de cor mais forte, então nada estoura em branco, nem de perto, no mergulho no braço.
- Cada tipo de nebulosa é um shader separado, compilado em segundo plano enquanto a abertura está na tela: a viagem não trava no primeiro uso.

**Referências da galáxia e da nebulosa:** [M74 pelo Hubble (ESA/Hubble)](https://esahubble.org/news/heic0719/), [ondas de densidade (Beltoforion)](https://beltoforion.de/en/spiral_galaxy_renderer/), [galáxias procedurais do Gaia Sky](https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Procedural-galaxies.html), [nebulosas e auroras volumétricas (Toni Sagristà)](https://tonisagrista.com/blog/2024/rendering-aurorae-nebulae/), [Gaia Sky: nebulosas volumétricas](https://gaiasky.space/news/2024/2024-03-01-volumetric-nebulae/), [poeira cósmica volumétrica (Godot Shaders)](https://godotshaders.com/shader/volumetric-cosmic-dust/), [Volumetric Rendering (wallisc)](https://github.com/wallisc/VolumetricRendering), fotos da [M51 pelo Hubble (ESA/Hubble)](https://esahubble.org/images/heic0506a/) e as animações de aproximação do [ESO (Órion, Carina)](https://www.eso.org/public/videos/).

**Referências do buraco negro e das estrelas:** [javascript-blackhole](https://github.com/flightlesstux/javascript-blackhole), [Gargantua em three.js](https://discourse.threejs.org/t/gargantua-a-ray-traced-black-hole-in-my-portfolio-webgl-one-draw-call/94960), [oseiskar/black-hole](https://github.com/oseiskar/black-hole), [Galaxy Generator (Three.js Journey)](https://www.threejs-journey.com/lessons/galaxy-generator), [Particles Galaxy (Codrops)](https://tympanus.net/codrops/2022/06/21/creating-a-particles-galaxy-with-three-js).

## Conteúdo (28 slides)

| Tema | Exemplo interativo |
|---|---|
| O que é IA | Círculos IA → aprendizado de máquina → deep learning → IA generativa; regras × aprendizado |
| Como funciona hoje | Passo a passo de um LLM: tokens, vetores, atenção, probabilidades e próximo token |
| A matemática | Neurônio artificial com controles (pesos, bias e sigmoide) que decide se vai chover |
| Treinamento | Descida do gradiente animada, com taxa de aprendizado baixa, ideal e alta demais |
| 1.1 Tradução automática | Interface de tradutor mostrando tokens, vetores e alinhamento; aba "Sua frase" com Gemini |
| *Laboratórios* (1.1 a 1.6) | Um jogo rápido por tópico, com pontos, sequência de acertos, medalha e recorde: falsos amigos na tradução, adivinhe a intenção do assistente, confiar ou conferir a resposta do chatbot, ache o erro no resumo e qual prompt é melhor. No 1.4, um simulador de **temperatura** mostra as probabilidades da próxima palavra e sorteia 10 vezes |
| *Saiba mais* (1.1 a 1.6) | Painel com 4 abas animadas em cada tópico: linha do tempo, números com fonte, como funciona por dentro e uso no trabalho |
| 1.2 Assistentes virtuais | As 5 etapas de um comando de voz, com a intenção em JSON |
| 1.3 Chatbots | Bot de regras × bot com IA × **Gemini ao vivo** |
| 1.4 Geração de conteúdo | Imagem "nascendo" do ruído, como num modelo de difusão |
| 1.5 Resumo de texto | Resumo extrativo × abstrativo, e resumo real com o Gemini |
| 1.6 Elaboração de prompts | Montador de prompt com medidor de qualidade e teste real no Gemini |
| Extra: agentes | Ciclo pensar → agir → observar → repetir |
| Extra: Claude + Excel | Animação do Claude criando fórmulas, formatação e gráfico numa planilha |
| Extra: Claude Code e Codex | Terminal animado criando esta apresentação |
| Extra: skills | Exemplo de `SKILL.md` |
| Automação de dados · planilha → relatório | Script Python (pandas + openpyxl) limpa a planilha, marca o que falta sem inventar e salva o relatório com gráfico |
| Automação de dados · workflow | O Agendador do Windows chama o Claude Code (`claude -p`) toda segunda; relatório, resumo e e-mail em rascunho esperam a aprovação de uma pessoa |
| Estúdio de vídeo · início | Editor de vídeo simulado (HyperFrames) com edição por chat |
| Estúdio · fluxo completo | Um computador simulado mostra as 6 etapas: pedido no Claude Code, código, prévia, revisão (`check`), render e entrega |
| Estúdio · 5 níveis | Do simples ao complexo: título animado, legendas, gráfico animado, cena 3D e vídeo completo em 4 cenas, cada um com prévia, pedido e código |
| Estúdio · cena 3D | Planeta em three.js controlado pela linha do tempo: o mesmo instante gera sempre a mesma imagem, como no render |
| Estúdio · mão na massa | 4 desafios para fazer em aula, com o pedido pronto para copiar |
| Ética, Quiz e Fontes | Checklist, quiz de 6 perguntas e 41 referências |
| **Final: do Big Bang ao SENAI** | 1min37 de viagem em 10 capítulos (Big Bang, núcleos, primeira luz, primeiras estrelas, teia cósmica, Via Láctea, Sistema Solar, Terra, mergulho até Iracemápolis e a escola em 3D), com linha do tempo, capítulos clicáveis e câmera livre no fim |

## Final: do Big Bang ao SENAI Iracemápolis

Arquivo `assets/js/cosmos.js`. Tudo é three.js, sem vídeo pronto:

- **Universo**: partículas da expansão esfriando (branco → vermelho); prótons e nêutrons formando hélio (75% H / 25% He); o plasma clareando e mostrando o fundo de micro-ondas nas cores do mapa do Planck; estrelas acendendo e supernovas; filamentos da teia cósmica; a Via Láctea com o "você está aqui"; o disco do Sistema Solar abrindo lacunas onde nascem os planetas.
- **Terra**: começa como oceano de magma e esfria. Textura NASA Blue Marble com luzes das cidades no lado da noite, brilho do Sol nos oceanos, nuvens, atmosfera e Lua.
- **Mergulho**: a câmera desce de 15 mil km até 550 m em escala real (quilômetros). Por cima do globo entram imagens cada vez mais detalhadas: NASA GIBS (América do Sul) e Sentinel-2 cloudless 2023 da EOX (níveis 9 a 15; a resolução real do Sentinel-2 é de 10 m).
- **SENAI**: `assets/data/senai-iracemapolis.json` tem 65 ruas do OpenStreetMap e 42 prédios do Distrito Industrial II, medidos sobre imagem de satélite (resolução de ~0,55 m/pixel), com o galpão das oficinas, os dois blocos de salas com o pátio arborizado, a portaria na Rua Camilo Ferrari, o estacionamento, as fileiras de painéis e os ônibus na rua. **As alturas são estimadas** (não existe dado público de altura). No fim, a câmera fica livre: arraste para girar e clique num prédio para ver o que funciona nele.
- **Sobre o Google Maps**: as imagens e o 3D do Google não podem ser copiados para um site (termos de uso e chave de API), então não foram usados. Tudo aqui vem de fontes abertas, com crédito na tela.

## Ligar o Gemini ao vivo

A chave de API **não fica no código**: o repositório é público, e qualquer pessoa poderia copiá-la.

1. Crie ou copie sua chave em [Google AI Studio](https://aistudio.google.com/apikey).
2. No site, clique em **Gemini** (no topo), cole a chave e clique em **Salvar e testar**.
3. A chave fica salva só naquele navegador (`localStorage`). Para apagar, use **Remover chave**.

Com o Gemini ligado, funcionam: a aba "Sua frase" do tradutor, o modo "Gemini ao vivo" do chatbot, o resumo real, o teste do prompt e o botão **Pergunte ao Gemini** da barra de baixo, que conhece o conteúdo do slide atual.

**Recomendado:** no [Google Cloud Console](https://console.cloud.google.com/apis/credentials), restrinja a chave a *referenciadores HTTP* `https://cir0arruda.github.io/*` e à *Generative Language API*.

## Como apresentar

- `Enter` na galáxia: começa a apresentação
- `←` `→`, `Espaço` ou deslizar o dedo: troca de slide
- `F`: tela cheia
- `Home` / `End`: primeiro / último slide
- `S` nos tópicos 1.1 a 1.6: abre o *Saiba mais* (as setas trocam a aba)
- `Esc`: fecha o *Saiba mais* ou o painel do Gemini
- Cada slide tem endereço próprio: `…/#5` abre direto no slide 5

## Rodar no computador

Abra o `index.html` no navegador ou use um servidor simples:

```bash
npx http-server . -p 5173
```

## Testes automatizados

Os testes abrem o site num Chrome automático, clicam como uma pessoa e conferem, no computador e no celular:

- `galaxy.test.mjs` (49 verificações): nada estoura em branco na abertura nem no mergulho no braço; 7 tipos de nebulosa; centro brilhante, dois braços, contraste e cores medidos nos pixels; o voo atravessa um tipo diferente de nebulosa a cada viagem, sem cortes; o fundo do sistema mostra o braço sem a faixa estourada; o buraco negro entra com transição suave; planetas, botão Iniciar e volta pela barra lateral;
- `slides.test.mjs` (47 verificações): os 27 slides pelo teclado, nada saindo da tela, o *Saiba mais* dos tópicos 1.1 a 1.6 (abas, números, teclado, fechar), atalhos da barra lateral e da barra de baixo, a automação de dados separada do vídeo, todas as demos do estúdio (etapas, níveis, 3D, botões de copiar) e o console sem erros.

```bash
npm i -D puppeteer
node tests/galaxy.test.mjs
node tests/slides.test.mjs
```

Opções: `--so-desktop`, `--so-celular` e `--headful` (mostra o navegador).

Com o endereço terminando em `?teste`, o site expõe `IAGalaxy.test` para o teste ler o estado da cena.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.

---

Feito com [Claude Code](https://claude.com/claude-code).
