#!/usr/bin/env python3
"""Generate a PontoFinal reel from scratch.

Pipeline: theme → OpenRouter (concept + copy + caption) → HTML (filled template)
→ Playwright render → ffmpeg encode with music → caption file → ready to publish.

Designed to run inside GH Actions but works locally for prototyping.
"""
from __future__ import annotations
import hashlib, json, os, random, re, subprocess, sys, tempfile, urllib.parse, urllib.request, asyncio
from datetime import datetime
from pathlib import Path

# ────────── Config ──────────
OPENROUTER_KEY = os.environ.get("OPENROUTER_KEY") or (
    Path.home() / ".config/credentials/openrouter-key"
).read_text().strip()
# Pool of free models that respond reliably to JSON-mode + PT-PT. Tried in order.
MODEL_POOL = [
    "nvidia/nemotron-3-super-120b-a12b:free",
    "openai/gpt-oss-120b:free",
    "openai/gpt-oss-20b:free",
    "nousresearch/hermes-3-llama-3.1-405b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "qwen/qwen3-next-80b-a3b-instruct:free",
]

# Paths can be overridden by env. Defaults match the in-repo layout (works in GH Actions).
ROOT_DIR = Path(os.environ.get("ROOT_DIR", "."))
OUT_DIR = Path(os.environ.get("OUT_DIR", str(ROOT_DIR / "public/brands/pontofinal_site/output/2026-05/static-reels")))
MUSIC_DIR = Path(os.environ.get("MUSIC_DIR", str(ROOT_DIR / "assets/audio/library/clips")))
CAPTIONS_DIR = Path(os.environ.get("CAPTIONS_DIR", str(ROOT_DIR / "data/captions")))
HISTORY_PATH = Path(os.environ.get("HISTORY_PATH", str(ROOT_DIR / "data/publish-history.json")))
QUEUE_THRESHOLD = int(os.environ.get("QUEUE_THRESHOLD", "3"))
W, H, DUR = 1080, 1920, 15.0

THEMES = [
    "Aparecer no Google Maps quando alguém procura perto",
    "Site para advogado: confiança antes de feature",
    "Anatomia de uma página que vende: decompor por secções",
    "Formulários curtos pedem só o que vais usar",
    "Sinais de confiança no site (testemunhos, números, cara do dono)",
    "Como a velocidade do site afeta as vendas",
    "Porque o teu menu de restaurante online importa",
    "Sites para freelancers que mostram trabalho, não currículo",
    "O que escrever no rodapé do teu site",
    "O alt-text das tuas imagens (Google lê)",
    "404 personalizado é uma oportunidade",
    "Loja online: 3 erros que matam vendas",
]

# ────────── System prompt ──────────
SYSTEM_PROMPT = """És copywriter sénior da PontoFinal.site, agência portuguesa de sites e gestão de redes sociais para pequenos negócios.

Tarefa: dado um TEMA, geras o conteúdo de UM reel estático no Instagram (1 slide).

REGRAS DE OUTPUT (estritas):
1. Devolves APENAS JSON válido, sem texto antes ou depois, sem markdown fences.
2. Schema: {"hero": str, "accent": str, "body": str, "cta_label": str, "caption": str}
3. `hero`: frase impactante, MÁX 8 palavras. Linguagem visual, concreta, surpreendente. Evita verbos reflexivos no início.
4. `accent`: 1-3 palavras EXACTAS que aparecem em `hero` (vão a vermelho).
5. `body`: 1-2 frases que explicam o hero. MÁX 25 palavras total. Frases curtas, sem floreados.
6. `cta_label`: 2-4 palavras. APENAS uma destas formas: "marca reunião", "fala conosco", "quero ajuda", "fala comigo", "fica visível", "vê como", "quero saber". NUNCA mandes o utilizador FAZER o trabalho sozinho (proibido: "regista", "configura", "implementa", "instala").
7. `caption`: legenda completa para o post IG. 3-5 parágrafos curtos. Termina SEMPRE com: "Marca já a tua reunião em pontofinal.site. Link na bio." seguido de "—" e bloco de hashtags.

REGRAS DE COPY (não-negociáveis — qualquer violação = output rejeitado):
A. Português de Portugal estrito.
   - Ênclise por defeito: "envia-me", "ajuda-te", "explica-me", "diz-te". NUNCA "me envia", "te ajuda".
   - Próclise SÓ com atractor: não/já/que/quando/se/porque/quem/como antes do verbo.
B. NUNCA escrevas estas palavras (brasileirismos / formas erradas):
   você, vocês, celular, tela, arquivo, ônibus, banheiro, gerenciamento, usuário, café da manhã, sorvete, time (= equipa), legal (= fixe), bacana, valeu, blz, vc, tô, tá, "vou estar fazendo", "está sendo".
C. NUNCA uses estas palavras (siglas / anglicismos):
   PME (escreve "pequenos negócios"), SEO ("aparecer no Google"), KPI, UX, ROI, ICP, GDPR, CTA, AI, IA, engagement, feedback, share, check, lead, brief, deadline, manager, mindset.
D. NUNCA menciones inteligência artificial, bots, modelos, automação.
E. NUNCA inventes números/casos/resultados/percentagens específicas (ex: "aumenta 40%", "100 clientes"). Diz apenas o que é VERDADE GERAL.
F. NUNCA mandes o utilizador fazer o trabalho técnico sozinho — sempre redirige para nós.
G. Acordo Ortográfico 1990: escreve "ação" (NÃO "acção"), "ato", "ator", "direto", "fator", "exato", "atual", "objetivo", "ótimo", "diretor", "adoção".
H. Tratamento TU sempre.

REGRAS DE GRAMÁTICA PT-PT (armadilhas comuns):
- "passar à porta" / "passar pela porta" / "vai à porta" (NUNCA "passa a porta", "passa a tuas portas")
- "no Google" (NUNCA "ali no Google" como sufixo solto)
- "encontrar" (não "encontra-te" como hero — soa estranho)
- "ser encontrado" / "aparecer" (formas naturais para SEO)
- "à frente" (não "na frente")
- "à hora" (não "no horário")

ESTRUTURAS DE HERO QUE FUNCIONAM (escolhe um padrão):
- Estatística-shock: "X em 10 portugueses procura no Google."
- Pergunta-cortante: "Tens website ou cartão-de-visita?"
- Verdade-incómoda: "Sites bonitos não vendem."
- Antes/depois: "Trocaste o teu cartão. Mantiveste o site de 2015."
- Comando claro: "Mostra preços. Atrai clientes."

EXEMPLO de output válido (formato exacto):
{"hero": "Sites bonitos não vendem sozinhos.", "accent": "não vendem", "body": "Uma página que vende tem ordem: gancho, prova, ação. Sem isso, o visitante sai em 5 segundos.", "cta_label": "fala conosco", "caption": "Sites bonitos não vendem sozinhos.\\n\\nUma página bem desenhada chama atenção. Uma página que vende leva o visitante pela mão: primeiro o gancho, depois a prova, no fim a ação.\\n\\nQuando estes três blocos faltam, o visitante sai em cinco segundos. E nunca mais volta.\\n\\nMarca já a tua reunião em pontofinal.site. Link na bio.\\n\\n—\\n\\n#pontofinal #website #pequenosnegocios #portugal #digitalpt"}
"""

# ────────── Quality checks ──────────
PT_BR_MARKERS = [
    r"\bvocê\b", r"\bvocês\b", r"\bcelular\b", r"\btela\b", r"\bengagement\b", r"\bfeedback\b",
    r"\bbacana\b", r"\btô\b", r"\bvaleu\b", r"\bblz\b", r"\bgerenciar\b", r"\busuário\b",
    r"\bvou estar (?:vendo|mandando|fazendo|enviando)\b", r"\bestá sendo\b", r"\bvou tá\b",
    r"\bônibus\b", r"\bbanheiro\b", r"\bsorvete\b",
]
# Anglicismos e siglas proibidas (lista do brand)
BANNED_TERMS = [
    r"\bAI\b", r"\bIA\b", r"\bbot\b", r"\bbots\b", r"\bmodelos? de linguagem\b",
    r"intelig[êe]ncia artificial",
    r"\bPME\b", r"\bPMEs\b",      # → "pequenos negócios"
    r"\bSEO\b", r"\bKPI\b", r"\bKPIs\b", r"\bUX\b", r"\bROI\b", r"\bICP\b",
    r"\bGDPR\b", r"\bCTA\b", r"\bCTAs\b",
    r"\bengagement\b", r"\bfeedback\b", r"\bshare\b", r"\blead\b", r"\bleads\b",
    r"\bbrief\b", r"\bdeadline\b", r"\bmanager\b", r"\bmindset\b", r"\bworkflow\b",
    r"\blucca\b", r"\bgontijo\b", r"\brodrigues\b",
    r"guia pdf", r"guia em pdf", r"\b12 erros\b", r"auditoria gr[áa]tis",
]
PROCLISE_TRAPS = [
    r"\b(pode|podes|posso|podem)\s+(me|te|se|lhe|nos)\s+\w+r",
    r"\b(vou|vais|vai|vamos|vão)\s+(me|te|se|lhe|nos)\s+\w+r",
    r"\b(quero|queres|quer|queremos)\s+(me|te|se|lhe|nos)\s+\w+r",
    r"\b(consegue|consegues|consigo)\s+(me|te|se|lhe|nos)\s+\w+r",
]
# Erros de gramática PT-PT comuns que LLMs produzem
PT_GRAMMAR_TRAPS = [
    r"\bpassam? a (?:tuas?|sua?s?|minhas?) portas?\b",   # "passa a tuas portas" → "passa pela tua porta"
    r"\bna frente do\b",                                  # → "à frente do"
    r"\bno horário\b",                                    # → "à hora"
    r"\bencontra-te no Google\b",                         # awkward as hero
    r"\baté você\b",
]
AO90_TRAPS = [
    ("acção","ação"),("actor","ator"),("acto","ato"),("aspecto","aspeto"),
    ("director","diretor"),("factor","fator"),("objectivo","objetivo"),("óptimo","ótimo"),
    ("respectivo","respetivo"),("adoptar","adotar"),("adopção","adoção"),
    ("activo","ativo"),("colectivo","coletivo"),("perfeição","perfeição"),
    ("efectivo","efetivo"),("electrónico","eletrónico"),
    ("connosco","conosco"),  # preferência Lucca 2026-05-23
]
# CTA whitelist — labels permitidos (lowercase)
ALLOWED_CTAS = {
    "marca reunião","marca já","fala conosco","fala comigo","quero ajuda","quero saber",
    "fica visível","vê como","quero ver","ajuda-me","ensina-me","mostra-me",
    "como fazer","contacta-nos","quero falar","fala com a equipa",
}
# CTA verbs PROHIBIDOS (que mandam user fazer trabalho sozinho)
CTA_FORBIDDEN_VERBS = [
    r"\bregist(?:a|ar|e)\b", r"\bconfigur(?:a|ar|e)\b", r"\bimplement(?:a|ar|e)\b",
    r"\binstal(?:a|ar|e)\b", r"\bconstr[óo]i(?:r|s)?\b", r"\bcri(?:a|ar)\b(?! site)",
]


def validate(d: dict) -> list[str]:
    errs = []
    needed = ["hero","accent","body","cta_label","caption"]
    for k in needed:
        if not d.get(k) or not isinstance(d[k], str): errs.append(f"missing/empty {k}")
    if errs: return errs

    blob = " ".join([d["hero"], d["body"], d["caption"]])
    blob_low = blob.lower()

    for m in PT_BR_MARKERS:
        if re.search(m, blob, re.I): errs.append(f"PT-BR: /{m}/")
    for t in BANNED_TERMS:
        if re.search(t, blob, re.I): errs.append(f"banned: /{t}/")
    for pat in PROCLISE_TRAPS:
        if re.search(pat, blob, re.I): errs.append(f"próclise: /{pat}/")
    for pat in PT_GRAMMAR_TRAPS:
        if re.search(pat, blob, re.I): errs.append(f"PT grammar: /{pat}/")
    for bad, good in AO90_TRAPS:
        if re.search(rf"\b{bad}\b", blob, re.I): errs.append(f"AO90: {bad!r} → {good!r}")

    # accent must be inside hero (substring)
    if d["accent"].lower().replace("‑","-") not in d["hero"].lower().replace("‑","-"):
        errs.append(f"accent {d['accent']!r} not in hero")

    # CTA whitelist + no work-yourself verbs
    cta_low = d["cta_label"].lower().strip()
    if cta_low not in ALLOWED_CTAS:
        errs.append(f"CTA {d['cta_label']!r} not in whitelist")
    for pat in CTA_FORBIDDEN_VERBS:
        if re.search(pat, cta_low): errs.append(f"CTA verb mandates user-work: /{pat}/")

    # Caption requirements
    if "pontofinal.site" not in blob_low:
        errs.append("missing 'pontofinal.site'")
    if "link na bio" not in blob_low:
        errs.append("missing 'link na bio'")
    if "#pontofinal" not in blob_low:
        errs.append("missing hashtags block")

    # Length
    if len(d["hero"].split()) > 10:
        errs.append(f"hero too long ({len(d['hero'].split())}w)")
    if len(d["body"].split()) > 35:
        errs.append(f"body too long ({len(d['body'].split())}w)")

    # Hero shouldn't START with reflexive verb form (encontra-te, regista-te, etc)
    if re.match(r"^(encontra|regista|inscreve|junta)-te\b", d["hero"].lower()):
        errs.append("hero starts with awkward reflexive imperative")

    return errs


# ────────── OpenRouter call ──────────
def call_llm(theme: str, model: str) -> dict:
    body = json.dumps({
        "model": model,
        "messages": [
            {"role":"system","content":SYSTEM_PROMPT},
            {"role":"user","content":f"TEMA: {theme}\n\nGera o JSON."},
        ],
        "temperature": 0.75,
        "max_tokens": 900,
        "response_format": {"type":"json_object"},
    }).encode()
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body, method="POST",
        headers={"Authorization": f"Bearer {OPENROUTER_KEY}",
                 "Content-Type":"application/json",
                 "HTTP-Referer":"https://pontofinal.site",
                 "X-Title":"PontoFinal Generator"},
    )
    r = json.load(urllib.request.urlopen(req, timeout=60))
    if "error" in r:
        raise RuntimeError(f"OR {r['error'].get('code')}: {r['error'].get('message','')[:80]}")
    msg = r.get("choices",[{}])[0].get("message",{})
    text = (msg.get("content") or "").strip()
    if not text:
        raise RuntimeError("empty content")
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def generate(theme: str) -> dict:
    """Try each model in the pool; on each, up to 2 attempts before moving on."""
    last_errs = []
    for model in MODEL_POOL:
        for attempt in range(1, 3):
            try:
                d = call_llm(theme, model)
                errs = validate(d)
                if not errs:
                    print(f"  [llm] {model} attempt {attempt} OK", flush=True)
                    return d
                print(f"  [llm] {model} attempt {attempt} failed: {errs[:3]}", flush=True)
                last_errs = errs
            except Exception as e:
                print(f"  [llm] {model} attempt {attempt} exception: {e}", flush=True)
                break  # move to next model
    raise SystemExit(f"[fatal] all models exhausted. last_errs={last_errs}")


# ────────── HTML template ──────────
_BASE_HEAD = """<!DOCTYPE html>
<html lang="pt-PT">
<head>
<meta charset="UTF-8">
<title>PontoFinal — {slug}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;700;900&family=Archivo+Black&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
"""

# Template A — clássico vermelho com dots (o original)
TEMPLATE_A = _BASE_HEAD + """<style>
  :root {{ --bg:#FFFFFF;--text:#050505;--primary:#FF2A2A;
    --font-display:'Archivo Black',Impact,sans-serif; --font-body:'Archivo',sans-serif; }}
  *{{margin:0;padding:0;box-sizing:border-box;}}
  html,body{{width:1080px;height:1920px;font-family:var(--font-body);background:var(--bg);color:var(--text);overflow:hidden;position:relative;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;}}
  .dots-bg{{position:absolute;inset:-60px;background-image:radial-gradient(circle,#050505 1.3px,transparent 1.3px);background-size:32px 32px;opacity:.42;pointer-events:none;z-index:1;animation:dots-drift 18s linear infinite;}}
  @keyframes dots-drift{{0%{{background-position:0 0;}}100%{{background-position:64px 64px;}}}}
  .container{{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:130px 110px;z-index:2;}}
  .brand-header{{font-weight:800;font-size:34px;letter-spacing:-.02em;text-align:center;}}
  .brand-header .dot{{color:var(--primary);}}
  .main{{flex:1;display:flex;flex-direction:column;justify-content:center;}}
  .hero{{font-family:var(--font-display);font-size:124px;font-weight:900;line-height:.93;letter-spacing:-.04em;text-wrap:balance;margin-bottom:56px;text-align:center;}}
  .hero .red{{color:var(--primary);}}
  .body{{font-size:44px;font-weight:500;line-height:1.28;letter-spacing:-.012em;text-wrap:pretty;max-width:820px;margin:0 auto 80px;text-align:center;}}
  .cta-box{{background:var(--primary);color:#FFFFFF;padding:28px 56px;border:5px solid var(--text);box-shadow:12px 12px 0 0 var(--text);font-family:var(--font-display);font-size:48px;font-weight:900;line-height:1;letter-spacing:-.02em;text-transform:uppercase;align-self:center;transform:rotate(-1.2deg);}}
  .footer{{font-size:24px;font-weight:600;letter-spacing:.02em;text-align:center;opacity:.65;}}
</style></head><body>
<div class="dots-bg"></div>
<div class="container">
  <div class="brand-header">Ponto Final<span class="dot">.</span></div>
  <div class="main">
    <h1 class="hero">{hero_html}</h1>
    <p class="body">{body}</p>
    <div class="cta-box">{cta_label}</div>
  </div>
  <div class="footer">pontofinal.site · link na bio</div>
</div></body></html>"""

# Template B — negativo: preto + amarelo, asterisks decorativos, hero alinhado à esquerda
TEMPLATE_B = _BASE_HEAD + """<style>
  :root {{ --bg:#0A0A0A;--text:#FFFFFF;--accent:#FFD400;--muted:#a0a0a0;
    --font-display:'Archivo Black',Impact,sans-serif; --font-body:'Archivo',sans-serif; --font-mono:'Space Mono',monospace; }}
  *{{margin:0;padding:0;box-sizing:border-box;}}
  html,body{{width:1080px;height:1920px;font-family:var(--font-body);background:var(--bg);color:var(--text);overflow:hidden;position:relative;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;}}
  .grid-bg{{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);background-size:80px 80px;pointer-events:none;z-index:1;animation:grid-pan 22s linear infinite;}}
  @keyframes grid-pan{{0%{{background-position:0 0;}}100%{{background-position:80px 80px;}}}}
  .stamp{{position:absolute;top:60px;right:80px;font-family:var(--font-mono);font-size:22px;font-weight:700;color:var(--accent);border:2px solid var(--accent);padding:8px 16px;letter-spacing:.1em;z-index:5;transform:rotate(3deg);}}
  .asterisk{{position:absolute;color:var(--accent);font-family:var(--font-display);font-size:200px;line-height:1;pointer-events:none;z-index:1;}}
  .asterisk.a1{{top:380px;right:-40px;transform:rotate(-15deg);opacity:.85;}}
  .asterisk.a2{{bottom:140px;left:-30px;font-size:140px;transform:rotate(20deg);opacity:.6;}}
  .container{{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:160px 100px 130px;z-index:2;}}
  .brand-header{{font-weight:800;font-size:34px;letter-spacing:-.02em;color:var(--accent);}}
  .main{{flex:1;display:flex;flex-direction:column;justify-content:center;}}
  .eyebrow{{font-family:var(--font-mono);font-size:24px;font-weight:700;color:var(--accent);letter-spacing:.15em;text-transform:uppercase;margin-bottom:32px;}}
  .hero{{font-family:var(--font-display);font-size:128px;font-weight:900;line-height:.92;letter-spacing:-.04em;text-wrap:balance;margin-bottom:56px;}}
  .hero .red{{color:var(--accent);background:linear-gradient(transparent 65%,rgba(255,212,0,.25) 65%);}}
  .body{{font-size:42px;font-weight:500;line-height:1.3;letter-spacing:-.012em;text-wrap:pretty;max-width:820px;margin-bottom:80px;color:#e0e0e0;}}
  .cta-arrow{{display:inline-flex;align-items:center;gap:24px;font-family:var(--font-display);font-size:54px;font-weight:900;color:var(--bg);background:var(--accent);padding:24px 48px;text-transform:uppercase;letter-spacing:-.02em;align-self:flex-start;}}
  .cta-arrow::after{{content:"→";font-size:64px;}}
  .footer{{font-family:var(--font-mono);font-size:22px;font-weight:700;letter-spacing:.05em;color:var(--accent);margin-top:auto;}}
</style></head><body>
<div class="grid-bg"></div>
<div class="asterisk a1">✱</div>
<div class="asterisk a2">✱</div>
<div class="stamp">PT · 2026</div>
<div class="container">
  <div class="brand-header">Ponto Final<span style="color:#fff">.</span></div>
  <div class="main">
    <h1 class="hero">{hero_html}</h1>
    <p class="body">{body}</p>
    <div class="cta-arrow">{cta_label}</div>
  </div>
  <div class="footer">pontofinal.site // link na bio</div>
</div></body></html>"""

# Template C — geométrico: branco + grandes formas vermelhas (círculo, triângulo, barras)
TEMPLATE_C = _BASE_HEAD + """<style>
  :root {{ --bg:#F5F2EA;--text:#0A0A0A;--primary:#FF2A2A;--accent:#1A4DFF;
    --font-display:'Archivo Black',Impact,sans-serif; --font-body:'Archivo',sans-serif; --font-mono:'Space Mono',monospace; }}
  *{{margin:0;padding:0;box-sizing:border-box;}}
  html,body{{width:1080px;height:1920px;font-family:var(--font-body);background:var(--bg);color:var(--text);overflow:hidden;position:relative;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;}}
  .circle{{position:absolute;width:600px;height:600px;border-radius:50%;background:var(--primary);top:-200px;right:-150px;z-index:1;}}
  .triangle{{position:absolute;width:0;height:0;border-left:280px solid transparent;border-right:280px solid transparent;border-bottom:480px solid var(--accent);bottom:-150px;left:-100px;z-index:1;opacity:.85;transform:rotate(-12deg);}}
  .bar{{position:absolute;height:24px;background:var(--text);z-index:1;}}
  .bar.b1{{width:180px;top:230px;left:0;}}
  .bar.b2{{width:120px;bottom:240px;left:0;background:var(--primary);}}
  .number{{position:absolute;font-family:var(--font-display);font-size:380px;font-weight:900;line-height:1;color:var(--primary);opacity:.12;z-index:1;}}
  .number.n1{{top:260px;right:80px;}}
  .container{{position:relative;width:100%;height:100%;display:flex;flex-direction:column;padding:130px 100px;z-index:3;}}
  .brand-header{{font-family:var(--font-mono);font-weight:700;font-size:30px;letter-spacing:.05em;text-transform:uppercase;}}
  .brand-header .dot{{color:var(--primary);}}
  .main{{flex:1;display:flex;flex-direction:column;justify-content:center;}}
  .hero{{font-family:var(--font-display);font-size:130px;font-weight:900;line-height:.9;letter-spacing:-.045em;text-wrap:balance;margin-bottom:64px;}}
  .hero .red{{color:var(--primary);position:relative;display:inline-block;}}
  .hero .red::after{{content:"";position:absolute;left:-4px;right:-4px;bottom:-2px;height:10px;background:var(--accent);z-index:-1;opacity:.55;}}
  .body{{font-size:44px;font-weight:500;line-height:1.28;letter-spacing:-.012em;text-wrap:pretty;max-width:820px;margin-bottom:90px;}}
  .cta-row{{display:flex;align-items:center;gap:32px;}}
  .cta-pill{{background:var(--text);color:var(--bg);padding:30px 56px;border-radius:80px;font-family:var(--font-display);font-size:46px;font-weight:900;line-height:1;letter-spacing:-.02em;text-transform:uppercase;}}
  .cta-mark{{font-family:var(--font-display);font-size:72px;color:var(--primary);line-height:1;}}
  .footer{{font-family:var(--font-mono);font-size:22px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.7;}}
</style></head><body>
<div class="circle"></div>
<div class="triangle"></div>
<div class="bar b1"></div>
<div class="bar b2"></div>
<div class="number n1">01</div>
<div class="container">
  <div class="brand-header">Ponto Final<span class="dot">.</span></div>
  <div class="main">
    <h1 class="hero">{hero_html}</h1>
    <p class="body">{body}</p>
    <div class="cta-row">
      <div class="cta-mark">→</div>
      <div class="cta-pill">{cta_label}</div>
    </div>
  </div>
  <div class="footer">pontofinal.site · link na bio</div>
</div></body></html>"""

TEMPLATES = [TEMPLATE_A, TEMPLATE_B, TEMPLATE_C]


def _pick_template_idx(slug: str) -> int:
    """Deterministic template choice by slug hash — same slug always picks same template."""
    h = int(hashlib.sha256(slug.encode("utf-8")).hexdigest(), 16)
    return h % len(TEMPLATES)


def build_html(d: dict, slug: str) -> str:
    accent = d["accent"]
    hero = d["hero"]
    # Replace accent in hero with red span (case-insensitive, first occurrence)
    idx = hero.lower().find(accent.lower())
    if idx >= 0:
        end = idx + len(accent)
        hero_html = f"{hero[:idx]}<span class='red'>{hero[idx:end]}</span>{hero[end:]}"
    else:
        hero_html = hero
    tpl_idx = _pick_template_idx(slug)
    tpl_name = chr(ord("A") + tpl_idx)
    print(f"  template: {tpl_name}")
    return TEMPLATES[tpl_idx].format(slug=slug, hero_html=hero_html, body=d["body"], cta_label=d["cta_label"])


# ────────── Render ──────────
def pick_music(slug: str) -> Path:
    pool = sorted(MUSIC_DIR.glob("*.mp3"))
    h = int(hashlib.sha256(slug.encode()).hexdigest(), 16)
    return pool[h % len(pool)]


def encode(webm: Path, out: Path, audio: Path):
    # h264_videotoolbox is Apple Silicon HW; libx264 works everywhere (slower on Linux but fine).
    is_mac = sys.platform == "darwin"
    vcodec = ["-c:v", "h264_videotoolbox", "-b:v", "6M"] if is_mac else \
             ["-c:v", "libx264", "-preset", "fast", "-crf", "21"]
    cmd = ["ffmpeg","-y","-hide_banner","-loglevel","error","-i",str(webm),
           "-stream_loop","-1","-i",str(audio),"-t",f"{DUR:.3f}",
           "-vf",f"scale={W}:{H}:flags=lanczos,fps=30",
           *vcodec, "-profile:v","high","-pix_fmt","yuv420p",
           "-c:a","aac","-b:a","192k","-ar","48000","-shortest",
           "-movflags","+faststart",str(out)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0: raise RuntimeError(r.stderr[-400:])


async def render(html_path: Path, slug: str) -> tuple[Path, Path]:
    from playwright.async_api import async_playwright
    music = pick_music(slug)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cover = OUT_DIR / f"{slug}-cover.jpg"
    mp4 = OUT_DIR / f"{slug}.mp4"
    tmp = Path(tempfile.mkdtemp())

    async with async_playwright() as pw:
        br = await pw.chromium.launch(args=["--autoplay-policy=no-user-gesture-required"])
        try:
            ctx = await br.new_context(viewport={"width":W,"height":H})
            p = await ctx.new_page()
            await p.goto(f"file://{html_path.resolve()}", wait_until="load", timeout=20000)
            try: await p.evaluate("document.fonts.ready")
            except: pass
            await p.wait_for_timeout(800)
            await p.screenshot(path=str(cover), type="jpeg", quality=95)
            await ctx.close()

            vid = tmp / slug; vid.mkdir()
            rec = await br.new_context(viewport={"width":W,"height":H},
                record_video_dir=str(vid), record_video_size={"width":W,"height":H})
            rp = await rec.new_page()
            await rp.goto(f"file://{html_path.resolve()}", wait_until="load", timeout=20000)
            try: await rp.evaluate("document.fonts.ready")
            except: pass
            await rp.wait_for_timeout(int(DUR*1000)+400)
            await rec.close()
            webm = list(vid.glob("*.webm"))[0]
            encode(webm, mp4, music)
        finally:
            await br.close()
    print(f"  ✓ rendered: {mp4.name} + cover ← {music.name}", flush=True)
    return mp4, cover


# ────────── Slug + CLI ──────────
def make_slug(d: dict) -> str:
    ts = datetime.now().strftime("%Y%m%d%H%M")
    # 3-5 word slug from hero
    words = re.findall(r"\w+", d["hero"].lower())
    short = "-".join(words[:4])[:40]
    return f"auto-{ts}-{short}"


def _queue_low() -> bool:
    """True if the publish queue is at/below the threshold and we should generate."""
    if not HISTORY_PATH.exists():
        return True
    h = json.loads(HISTORY_PATH.read_text("utf-8"))
    return len(h.get("queue", [])) < QUEUE_THRESHOLD


def _append_to_queue_and_commit_repo(slug: str, mp4: Path, cover: Path, caption: Path, html: Path):
    """When running inside GH Actions, commit all 4 artefacts + add slug to queue via Contents API.

    No-op when GITHUB_TOKEN/REPOSITORY are missing (local dev).
    """
    gh_token = os.environ.get("GITHUB_TOKEN")
    gh_repo = os.environ.get("GITHUB_REPOSITORY")
    if not (gh_token and gh_repo):
        print("[commit] no GH env — skipping (local dev mode)")
        return

    import base64

    def gh(method, path, body=None, raw=False):
        url = f"https://api.github.com/repos/{gh_repo}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method,
            headers={"Authorization": f"Bearer {gh_token}", "Accept": "application/vnd.github+json", "Content-Type": "application/json"})
        r = urllib.request.urlopen(req, timeout=30)
        return r.read() if raw else json.load(r)

    def put_blob(content_bytes: bytes) -> str:
        return gh("POST", "/git/blobs", {
            "content": base64.b64encode(content_bytes).decode("ascii"), "encoding": "base64",
        })["sha"]

    # 1. Re-read latest history.json (don't trust local copy)
    h_resp = gh("GET", "/contents/data/publish-history.json?ref=main")
    cur_history = json.loads(base64.b64decode(h_resp["content"]))
    cur_history.setdefault("queue", []).insert(0, slug)
    history_bytes = (json.dumps(cur_history, indent=2, ensure_ascii=False) + "\n").encode()

    # 2. Upload 5 blobs (html, mp4, cover, caption, history)
    rel_html = f"public/brands/pontofinal_site/output/2026-05/static-reels/{slug}.html"
    rel_mp4 = f"public/brands/pontofinal_site/output/2026-05/static-reels/{slug}.mp4"
    rel_cover = f"public/brands/pontofinal_site/output/2026-05/static-reels/{slug}-cover.jpg"
    rel_caption = f"data/captions/{slug}.txt"
    rel_history = "data/publish-history.json"

    blobs = [
        (rel_html, put_blob(html.read_bytes())),
        (rel_mp4, put_blob(mp4.read_bytes())),
        (rel_cover, put_blob(cover.read_bytes())),
        (rel_caption, put_blob(caption.read_bytes())),
        (rel_history, put_blob(history_bytes)),
    ]
    for p, s in blobs:
        print(f"  blob {s[:7]} ← {p}")

    # 3. Build new tree
    ref = gh("GET", "/git/refs/heads/main")
    parent = ref["object"]["sha"]
    base_tree = gh("GET", f"/git/commits/{parent}")["tree"]["sha"]
    tree = gh("POST", "/git/trees", {
        "base_tree": base_tree,
        "tree": [{"path": p, "mode": "100644", "type": "blob", "sha": s} for p, s in blobs],
    })

    # 4. Create commit + update ref
    commit = gh("POST", "/git/commits", {
        "message": f"auto-generate: {slug}",
        "tree": tree["sha"],
        "parents": [parent],
        "author": {"name": "pontofinal-bot", "email": "bot@pontofinal.site"},
        "committer": {"name": "pontofinal-bot", "email": "bot@pontofinal.site"},
    })
    gh("PATCH", "/git/refs/heads/main", {"sha": commit["sha"]})
    print(f"  ✓ committed {commit['sha'][:7]} (prepended '{slug}' to queue head — publishes next)")

    # 5. Purge jsdelivr cache so publish_next.py sees fresh MP4
    for ext in [".mp4", "-cover.jpg"]:
        url = f"https://purge.jsdelivr.net/gh/{gh_repo}@main/public/brands/pontofinal_site/output/2026-05/static-reels/{slug}{ext}"
        try: urllib.request.urlopen(url, timeout=15).read()
        except Exception as e: print(f"  purge warn: {e}")


def main():
    # Mode 1: explicit theme arg → always generate (manual)
    # Mode 2: no arg → only generate if queue is below threshold
    if len(sys.argv) < 2:
        if not _queue_low():
            with HISTORY_PATH.open() as f:
                qlen = len(json.load(f).get("queue", []))
            print(f"[skip] queue has {qlen} reels (>= {QUEUE_THRESHOLD}). No generation needed.")
            return
        theme = random.choice(THEMES)
    else:
        theme = sys.argv[1]
    print(f"→ theme: {theme}")

    print("→ calling LLM…")
    d = generate(theme)
    print(f"  hero: {d['hero']!r}")
    print(f"  accent: {d['accent']!r}")
    print(f"  body: {d['body']!r}")
    print(f"  cta: {d['cta_label']!r}")

    slug = make_slug(d)
    print(f"→ slug: {slug}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    CAPTIONS_DIR.mkdir(parents=True, exist_ok=True)
    html_path = OUT_DIR / f"{slug}.html"
    html_path.write_text(build_html(d, slug), encoding="utf-8")
    print(f"  ✓ html: {html_path.name}")
    caption_path = CAPTIONS_DIR / f"{slug}.txt"
    caption_path.write_text(d["caption"], encoding="utf-8")
    print(f"  ✓ caption: {caption_path.name}")

    print("→ rendering…")
    mp4, cover = asyncio.run(render(html_path, slug))

    print("→ committing to repo + queueing…")
    _append_to_queue_and_commit_repo(slug, mp4, cover, caption_path, html_path)

    print(f"\n✓ DONE — slug={slug}")


if __name__ == "__main__":
    main()
