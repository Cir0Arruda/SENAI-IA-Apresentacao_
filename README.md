# IA na Prática · SENAI Iracemápolis

Apresentação interativa sobre Inteligência Artificial, feita em HTML para o GitHub Pages.

**Ver online:** https://cir0arruda.github.io/SENAI-IA-Apresentacao_/

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

## Publicar no GitHub Pages

Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta `/ (root)`.

---

Feito com [Claude Code](https://claude.com/claude-code).
