# IA na Prática · SENAI Iracemápolis

Apresentação interativa sobre Inteligência Artificial, feita em HTML para o GitHub Pages.

**Ver online:** https://cir0arruda.github.io/SENAI-IA-Apresentacao_/

## Abertura: a galáxia feita por IA

Ao abrir o site aparece uma galáxia 3D, escrita com o Claude Code, como exemplo do que a IA pode fazer:

- **Galáxia espiral volumétrica**, inspirada nas fotos do Hubble (como a M51): bojo dourado, dois braços azulados, regiões de gás rosadas (HII) e faixas escuras de poeira na borda interna dos braços.
  - Um mapa da galáxia vista de cima é calculado uma vez na placa de vídeo.
  - A cada quadro, cada raio de luz atravessa o disco (*raymarching*): soma o brilho do gás e perde luz na poeira.
  - **150 mil estrelas** são sorteadas a partir do mesmo mapa e ficam mais escuras quando há poeira entre elas e a câmera. As estrelas fogem do cursor.
- **Clique num braço da galáxia** (ou no marcador "Sistema dos temas"): um único voo de câmera, sem cortes, como nos documentários:
  1. sobrevoa o braço e mergulha no disco;
  2. atravessa uma **nebulosa volumétrica** (hidrogênio rosa, oxigênio verde-azulado, poeira e estrelas novas);
  3. chega a um **sistema planetário**, com a faixa da galáxia e o brilho do centro ao fundo.
  - Legendas no estilo de documentário explicam cada trecho. A volta faz o caminho inverso até ver a galáxia inteira.
- **8 planetas**, um por tema da apresentação, girando em volta de um sol, com cinturão de asteroides. Clique num planeta (ou na lista do painel) para ver o resumo e ir direto para o slide dele.
- **Buraco negro no centro**, calculado raio por raio (cada pixel é um raio de luz curvado pela gravidade). Clique em **Entrar no buraco negro** para ver por dentro:
  - horizonte de eventos, esfera de fótons, disco de acreção, lente gravitacional e efeito Doppler, cada um com destaque e explicação;
  - controles para ligar ou desligar a curvatura da luz, o disco e o Doppler, e um controle de distância;
  - o botão **Mergulhar** leva a câmera até perto do horizonte.
- Arraste para girar e use a roda do mouse para aproximar.
- O botão **Iniciar**, no canto inferior direito (ou `Enter`), abre a apresentação. O ícone de espiral no menu lateral volta para a galáxia.
- Endereços com slide (`…/#5`) pulam a abertura. Em computadores sem WebGL, a apresentação abre normalmente.

**Referências da galáxia e da nebulosa:** [ondas de densidade (Beltoforion)](https://beltoforion.de/en/spiral_galaxy_renderer/), [Gaia Sky: nebulosas volumétricas](https://gaiasky.space/news/2024/2024-03-01-volumetric-nebulae/), [poeira cósmica volumétrica (Godot Shaders)](https://godotshaders.com/shader/volumetric-cosmic-dust/), [Volumetric Rendering (wallisc)](https://github.com/wallisc/VolumetricRendering), fotos da [M51 pelo Hubble (ESA/Hubble)](https://esahubble.org/images/heic0506a/) e as animações de aproximação do [ESO (Órion, Carina)](https://www.eso.org/public/videos/).

**Referências do buraco negro e das estrelas:** [javascript-blackhole](https://github.com/flightlesstux/javascript-blackhole), [Gargantua em three.js](https://discourse.threejs.org/t/gargantua-a-ray-traced-black-hole-in-my-portfolio-webgl-one-draw-call/94960), [oseiskar/black-hole](https://github.com/oseiskar/black-hole), [Galaxy Generator (Three.js Journey)](https://www.threejs-journey.com/lessons/galaxy-generator), [Particles Galaxy (Codrops)](https://tympanus.net/codrops/2022/06/21/creating-a-particles-galaxy-with-three-js).

## Conteúdo (21 slides)

| Tema | Exemplo interativo |
|---|---|
| O que é IA | Círculos IA → aprendizado de máquina → deep learning → IA generativa; regras × aprendizado |
| Como funciona hoje | Passo a passo de um LLM: tokens, vetores, atenção, probabilidades e próximo token |
| A matemática | Neurônio artificial com controles (pesos, bias e sigmoide) que decide se vai chover |
| Treinamento | Descida do gradiente animada, com taxa de aprendizado baixa, ideal e alta demais |
| 1.1 Tradução automática | Interface de tradutor mostrando tokens, vetores e alinhamento; aba "Sua frase" com Gemini |
| 1.2 Assistentes virtuais | As 5 etapas de um comando de voz, com a intenção em JSON |
| 1.3 Chatbots | Bot de regras × bot com IA × **Gemini ao vivo** |
| 1.4 Geração de conteúdo | Imagem "nascendo" do ruído, como num modelo de difusão |
| 1.5 Resumo de texto | Resumo extrativo × abstrativo, e resumo real com o Gemini |
| 1.6 Elaboração de prompts | Montador de prompt com medidor de qualidade e teste real no Gemini |
| Extra: agentes | Ciclo pensar → agir → observar → repetir |
| Extra: Claude + Excel | Animação do Claude criando fórmulas, formatação e gráfico numa planilha |
| Extra: Claude Code e Codex | Terminal animado criando esta apresentação |
| Extra: skills | Exemplo de `SKILL.md` |
| Bônus: vídeos | Editor de vídeo simulado (HyperFrames) com edição por chat |
| Ética, Quiz e Fontes | Checklist, quiz de 6 perguntas e 20 referências |

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
- `Esc`: fecha o painel do Gemini
- Cada slide tem endereço próprio: `…/#5` abre direto no slide 5

## Rodar no computador

Abra o `index.html` no navegador ou use um servidor simples:

```bash
npx http-server . -p 5173
```

## Testes automatizados

O teste abre o site num Chrome automático, clica como uma pessoa e confere:

- a imagem: centro brilhante, dois braços, contraste e cores medidos nos pixels;
- o voo: atravessa a nebulosa, não tem cortes nem saltos de câmera, e chega ao sistema;
- planetas, buraco negro, botão Iniciar e volta pela barra lateral;
- a versão de celular e o console sem erros.

```bash
npm i -D puppeteer
node tests/galaxy.test.mjs
```

Com o endereço terminando em `?teste`, o site expõe `IAGalaxy.test` para o teste ler o estado da cena.

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.

---

Feito com [Claude Code](https://claude.com/claude-code).
