-- publish_history: log imutável de TUDO o que o publisher fez.
-- Cada tentativa (success/error/skipped/stuck) regista uma linha.
-- INSERT ONLY (RLS bloqueia UPDATE/DELETE) — não sobrescreve.
-- Mantém histórico mesmo se publish_queue for limpo.

CREATE TABLE IF NOT EXISTS publish_history (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id         text NOT NULL,
    namespace       text,
    brand           text,
    kind            text,                          -- carrossel | story | reel
    status          text NOT NULL,                 -- published | error | skipped | stuck_claim | uncertain
    ig_post_id      text,                          -- media id devolvido pela Meta (se success)
    caption         text,
    error_detail    text,
    scheduled_for   timestamptz,
    published_at    timestamptz DEFAULT now(),     -- quando o publisher registou
    item_scheduled_for text,                       -- valor original de items.json (proteção contra override)
    dry_run         boolean DEFAULT false,
    CONSTRAINT publish_history_status_check
        CHECK (status IN ('published','error','skipped_no_token','stuck_claim','uncertain','dry_run_planned'))
);

CREATE INDEX IF NOT EXISTS publish_history_item_id_idx ON publish_history (item_id);
CREATE INDEX IF NOT EXISTS publish_history_brand_idx ON publish_history (brand);
CREATE INDEX IF NOT EXISTS publish_history_published_at_idx ON publish_history (published_at DESC);
CREATE INDEX IF NOT EXISTS publish_history_ig_post_id_idx ON publish_history (ig_post_id) WHERE ig_post_id IS NOT NULL;

-- RLS: INSERT permitido com service_role; UPDATE/DELETE bloqueados.
ALTER TABLE publish_history ENABLE ROW LEVEL SECURITY;

-- Política: service_role pode fazer tudo (o publisher corre com service key)
DROP POLICY IF EXISTS "service_role_all" ON publish_history;
CREATE POLICY "service_role_all" ON publish_history
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- Forçar INSERT ONLY via trigger: bloquear UPDATE e DELETE para todos,
-- mesmo service_role (a não ser que seja super_admin via BypassRLS)
CREATE OR REPLACE FUNCTION publish_history_immutable()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'publish_history é append-only — UPDATE/DELETE proibidos';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS publish_history_no_update ON publish_history;
CREATE TRIGGER publish_history_no_update
    BEFORE UPDATE ON publish_history
    FOR EACH ROW EXECUTE FUNCTION publish_history_immutable();

DROP TRIGGER IF EXISTS publish_history_no_delete ON publish_history;
CREATE TRIGGER publish_history_no_delete
    BEFORE DELETE ON publish_history
    FOR EACH ROW EXECUTE FUNCTION publish_history_immutable();

-- Comentário para futuros devs
COMMENT ON TABLE publish_history IS
    'Log imutável de publicações. Cada execução do publisher regista 1 row por evento (success/error/skipped). Não sobrescreve, não apaga. Para investigar histórico: SELECT * FROM publish_history WHERE item_id = ... ORDER BY published_at DESC';
