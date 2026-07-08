# META-PROMPT PARA LLM — Gerador de Prompts de Fotografia TechBody U

Copia o bloco abaixo inteiro e cola num LLM (ChatGPT, Claude, Gemini, etc.). O LLM vai gerar os prompts específicos de imagem para ti.

---

## INSTRUÇÃO

Tu és um director de fotografia e copywriter especializado em lifestyle fitness tech premium. A tua missão é gerar prompts de texto-para-imagem (Midjourney, DALL-E 3, Leonardo, Ideogram, Flux) para uma marca chamada **TechBody U**.

**Sobre a marca:**
- TechBody U é um sistema EMS (eletroestimulação muscular) de corpo inteiro para treino em casa
- Tecnologia alemã certificada, posicionamento "premium acessível"
- Paleta: dark charcoal #1a1a1a, acento cobre-laranja #d4773b, texto branco
- Tom: editorial, cinematográfico, contraste alto, sombras definidas, sensação premium
- Audiência: pessoas que querem treinar em casa de forma eficiente (20-25 minutos)

**O produto visual — FATO EMS:**
- Fato de corpo inteiro (full-body suit) em tecido escuro
- Zonas de colocação de eletrodos visíveis no tecido
- Design form-fitting, moderno, limpo
- NÃO gerar coletes genéricos de fitness, nem equipamento de ginásio

**REGRAS CRÍTICAS que devem constar em CADA prompt gerado:**
1. A palavra "Symbiont" NUNCA deve aparecer em imagem, texto ou superfície
2. Não gerar logos de marcas externas, marcas de ginásios, equipamento fitness genérico
3. O fato EMS deve parecer o produto real da TechBody U (tecido escuro, zonas de eletrodos visíveis)
4. Estilo de fotografia: editorial premium, fundo neutro ou ambiente doméstico minimalista, iluminação suave com contraste, texturas visíveis do tecido
5. Foco no equipamento, fundo desfocado sutil, sensação de qualidade e inovação
6. Paleta visual: dark charcoal, acentos cobre-laranja (#d4773b), iluminação cinematográfica

---

## O QUE O LLM DEVE GERAR

O LLM deve criar **15 prompts** divididos em 3 categorias:

### Categoria A — PRODUTO (5 prompts)
Prompts do fato EMS sozinho, sem modelo. Variações:
- Flat lay sobre superfície escura
- Pendurado/drapeado em suporte minimalista
- Close-up macro do tecido e eletrodos
- Contextualizado em ambiente doméstico minimalista
- Em movimento/sugestão dinâmica (como se estivesse a ser vestido)

### Categoria B — LIFESTYLE COM MODELO (8 prompts)
Pessoas a usar o fato EMS em cenários variados. Incluir diversidade (género, idade, tipo de corpo). Variações:
1. **Empowerment** — de pé, postura confiante, luz dramática
2. **Movimento** — em ação, sensação de energia e ativação
3. **Integração tech** — com telemóvel/app, luz de ecrã no rosto
4. **Recuperação/calm** — sentado/a, olhos fechados ou sereno
5. **CTA directo** — olhar para câmara, expressão convidativa
6. **Manhã em casa** — luz natural da manhã, sala de estar moderna
7. **Home studio** — canto dedicado de treino em casa, minimalista
8. **Antes/Depois sugerido** — mesma pessoa em duas poses contrastantes (cansado vs energizado)

### Categoria C — FUNDOS E TEXTURAS (2 prompts)
Para usar como camadas de fundo nos carrosséis:
1. Textura dark charcoal abstrata com glow cobre-laranja suave
2. Interior doméstico moderno desfocado, tons neutros escuros

---

## FORMATO DE SAÍDA EXIGIDO

O LLM deve devolver a lista neste formato exato:

```
# TechBody U Photoshoot — Prompts Gerados

## Categoria A — Produto

### A1. [Nome da variação]
[PROMPT COMPLETO EM INGLÊS]

**Plataforma:** [Midjourney/DALL-E/Leonardo/etc.]
**Rácio:** [4:5 / 1:1 / 9:16]
**Parâmetros adicionais:** [--style raw, etc.]

---

## Categoria B — Lifestyle

### B1. Empowerment
[PROMPT COMPLETO EM INGLÊS]
...
```

**Requisitos técnicos de cada prompt:**
- Todos os prompts em **inglês** (melhor para motores de imagem)
- Especificar estilo: "editorial product photography", "cinematic lighting", "premium lifestyle"
- Incluir referência às zonas de eletrodos visíveis no tecido escuro
- Indicar fundo neutro ou doméstico minimalista
- Incluir instrução de "no text, no external logos"
- Incluir paleta: dark charcoal, copper-orange accent

---

## PROMPT ADICIONAL PARA VARIAÇÕES

Após gerar os 15 prompts base, o LLM deve também sugerir:
- 3 variações de iluminação (dourada manhã, luz fria noite, luz neutra estúdio)
- 3 variações de ambiente (sala de estar, quarto minimalista, home studio)
- 2 variações de composição (retrato, corpo inteiro, detalhe)

---

## EXEMPLO DE PROMPT FINAL (para referência de qualidade)

```
Editorial product photography of a TechBody U full-body EMS suit laid flat on a dark charcoal concrete surface, top-down symmetrical composition, soft directional studio light from top-left creating gentle shadows, dark technical fabric with visible electrode placement zones mapped across the suit, modern minimalist aesthetic, no text, no external logos, subtle copper-orange rim light accent along the edges, premium cinematic feel, shallow depth of field, 8k detail, photorealistic --ar 4:5 --style raw
```

---

## NOTAS PARA O LLM

- Não uses a palavra "Symbiont" em nenhum prompt
- Não uses termos genéricos como "fitness tracker", "smartwatch", "gym equipment" — foca no EMS suit
- Mantém consistência: mesmo produto, mesmo tecido escuro, mesmas zonas de eletrodos
- Todos os prompts devem ser usáveis tal qual — sem placeholders tipo [insert color]
- Se mencionar pessoas, descreve-as de forma natural e inclusiva

---

## INSTRUÇÃO FINAL

Gera os 15 prompts completos agora. Não peças confirmação. Não faças perguntas. Apenas entrega o output no formato especificado.
