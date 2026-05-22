-- ── PontoFinal IG Bot — schema inicial ──────────────────────────────────
-- Aplica em https://supabase.com/dashboard/project/ojbigtskkhmnerrppdjq/sql/new

-- Leads (uma linha por seguidor que falou com a Maria)
create table if not exists public.ig_leads (
  sender_id        text primary key,
  ig_username      text,
  first_msg_at     timestamptz not null default now(),
  last_msg_at      timestamptz not null default now(),
  email            text,
  email_captured_at timestamptz,
  intent           text,                  -- 'site' / 'conteudo' / 'curioso' / 'concorrente' / 'frustrado' / null
  qualification    text,                  -- 'frio' / 'morno' / 'quente' / null
  pipeline_state   text default 'novo',   -- 'novo' / 'qualificado' / 'email_capturado' / 'reuniao_marcada' / 'cliente' / 'fechado_perdido'
  escalated_at     timestamptz,
  notes            jsonb default '[]'::jsonb
);

-- Histórico de mensagens (ordem cronológica)
create table if not exists public.ig_messages (
  id          bigserial primary key,
  sender_id   text not null references public.ig_leads(sender_id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists ig_messages_sender_idx on public.ig_messages (sender_id, created_at desc);

-- Quando chega 1ª mensagem de um sender novo, cria lead automaticamente
create or replace function public.ig_messages_create_lead() returns trigger as $$
begin
  insert into public.ig_leads (sender_id, last_msg_at)
  values (new.sender_id, now())
  on conflict (sender_id) do update set last_msg_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists ig_messages_lead_trigger on public.ig_messages;
create trigger ig_messages_lead_trigger
  before insert on public.ig_messages
  for each row execute function public.ig_messages_create_lead();

-- View útil para o dashboard manual
create or replace view public.ig_dashboard as
select
  l.sender_id,
  l.ig_username,
  l.intent,
  l.qualification,
  l.pipeline_state,
  l.email,
  l.first_msg_at,
  l.last_msg_at,
  (select count(*) from public.ig_messages m where m.sender_id = l.sender_id) as msg_count,
  (select content from public.ig_messages m where m.sender_id = l.sender_id and m.role = 'user' order by m.created_at desc limit 1) as last_user_msg
from public.ig_leads l
order by l.last_msg_at desc;

-- ── CONTROLO DO BOT ─────────────────────────────────────────────────────
-- Tabela singleton (1 linha) com os switches operacionais
create table if not exists public.ig_bot_config (
  id                 int primary key default 1,
  enabled            boolean not null default false,    -- master switch
  shadow_mode        boolean not null default true,     -- true = regista mas não responde
  allowlist_senders  text[] default '{}',               -- se não vazio, só responde a estes IDs
  blocklist_senders  text[] default '{}',               -- nunca responde a estes IDs
  trigger_keywords   text[] default '{}',               -- se não vazio, msg tem que conter uma destas palavras
  daily_msg_cap      int default 200,                   -- corte de segurança diário
  updated_at         timestamptz not null default now(),
  constraint singleton check (id = 1)
);

insert into public.ig_bot_config (id, enabled, shadow_mode)
values (1, false, true)
on conflict (id) do nothing;

-- Contador diário para o cap
create table if not exists public.ig_bot_daily_count (
  day        date primary key default current_date,
  count      int not null default 0
);

-- Helper: incrementa daily count atomicamente (chamado antes de cada resposta)
create or replace function public.ig_bot_can_respond(p_sender_id text)
returns boolean as $$
declare
  cfg record;
  today_count int;
begin
  select * into cfg from public.ig_bot_config where id = 1;
  if not cfg.enabled then return false; end if;
  if cfg.shadow_mode then return false; end if;
  if cfg.blocklist_senders @> array[p_sender_id] then return false; end if;
  if array_length(cfg.allowlist_senders, 1) is not null
     and not (cfg.allowlist_senders @> array[p_sender_id]) then
    return false;
  end if;
  insert into public.ig_bot_daily_count (day, count) values (current_date, 1)
    on conflict (day) do update set count = ig_bot_daily_count.count + 1
    returning count into today_count;
  if today_count > cfg.daily_msg_cap then return false; end if;
  return true;
end;
$$ language plpgsql;

-- RLS: tudo só acessível com service_role (que é o que o Worker usa)
alter table public.ig_leads enable row level security;
alter table public.ig_messages enable row level security;
alter table public.ig_bot_config enable row level security;
alter table public.ig_bot_daily_count enable row level security;
-- Nenhuma policy = só service_role pode aceder (default Supabase).
