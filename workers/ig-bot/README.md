# PontoFinal IG Bot — Maria

Cloudflare Worker que mantém conversas DM no Instagram em nome da **Maria** (assistente humana da PontoFinal.site).

- LLM: `openrouter/free` (auto-router entre modelos free) com defesa em código (retry + quality check)
- Storage: Supabase (projecto `content-machine`, tabelas `ig_leads` + `ig_messages`)
- Webhook: `https://pontofinal.site/api/ig-webhook` (Cloudflare Worker + custom domain)
- Voz e regras: ver `src/manifesto.ts` — actualizar sempre que preços/serviços mudarem no site

## Setup (uma vez)

### 1. Aplicar migração Supabase

Abre https://supabase.com/dashboard/project/ojbigtskkhmnerrppdjq/sql/new e cola o conteúdo de `supabase/migrations/001_ig_bot_tables.sql`. Corre.

### 2. Configurar Meta Developer App

1. Vai a https://developers.facebook.com/apps/ → app PontoFinal (a que já gera o `META_ACCESS_TOKEN`)
2. **Settings → Basic → App Secret** → copia (vais precisar mais à frente)
3. **Webhooks → Instagram** → Add Subscription:
   - Callback URL: `https://pontofinal.site/api/ig-webhook`
   - Verify Token: inventa uma string aleatória (ex: `pf-maria-2026-xpto`) e guarda
   - Fields a subscrever: `messages`, `messaging_postbacks`, `message_reactions`, `message_reads`
4. **App Review → Permissions and Features** → garantir aprovado:
   - `instagram_manage_messages` (modo Standard ou superior — se ainda não tens, submete request)

### 3. Configurar Cloudflare Worker secrets

```bash
cd workers/ig-bot
npm install
wrangler login                                    # uma vez
wrangler secret put META_APP_SECRET               # cola o app secret
wrangler secret put META_VERIFY_TOKEN             # cola o verify token (mesmo que puseste na Meta)
wrangler secret put META_ACCESS_TOKEN             # cola o long-lived token
wrangler secret put META_IG_USER_ID               # 17841439350962641
wrangler secret put OPENROUTER_KEY                # conteúdo de ~/.config/credentials/openrouter-key
wrangler secret put SUPABASE_URL                  # https://ojbigtskkhmnerrppdjq.supabase.co
wrangler secret put SUPABASE_SERVICE_KEY          # service_role key (~/.config/credentials/supabase-content-machine.env)
```

### 4. Deploy

```bash
wrangler deploy
```

Worker fica em `https://pontofinal-ig-bot.<your-account>.workers.dev` e routado para `pontofinal.site/api/ig-webhook` graças ao `routes` em `wrangler.toml`.

### 5. Validar handshake Meta

Quando carregares "Verify and Save" no webhook config da Meta, vais ver o request `GET /api/ig-webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...` no `wrangler tail`. Se devolver o challenge, está OK.

## Operação

- **Ver logs em tempo real**: `wrangler tail` (mostra cada chamada, retries, fallbacks)
- **Dashboard de conversas**: query no Supabase `SELECT * FROM ig_dashboard;`
- **Take-over manual** de uma conversa: vai ao DM directamente na app IG e responde — o bot não interrompe respostas humanas (a próxima mensagem do user volta a entrar no bot, mas com o histórico todo)

## Actualizar manifesto

`src/manifesto.ts` é o "manifesto" que cada modelo do `openrouter/free` lê antes de responder. **Actualiza sempre que:**

- Preços de planos mudarem no site
- Surgir um novo plano ou serviço
- Detectares que o bot está a inventar algo (adiciona regra explícita)
- A voz da marca evoluir

Após mudar, faz `wrangler deploy` — não precisa de migration nem secret update.

## Custos

- Cloudflare Workers: free tier (100.000 requests/dia)
- Supabase: free tier (500 MB)
- OpenRouter: free tier (modelos com `:free` no nome — sem custo, com rate limits)
- **Total: 0€/mês**

Se atingirmos rate limits do OpenRouter free, fallback para Claude Haiku via Anthropic Max (~€25/mês a 100 conversas/dia).
