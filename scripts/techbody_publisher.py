#!/usr/bin/env python3
"""
TechBody / TechBody U Instagram publisher.

Corre em GitHub Actions (cron) ou localmente. Para cada item aprovado na
página de aprovação (Supabase `approvals`) cuja data/hora agendada já passou
e que ainda não foi publicado (ledger `publish_queue`), publica no Instagram
via Graph API (Instagram Login, tokens IGAA de 60 dias).

Regras críticas:
  - Tokens SEPARADOS por marca — techbody NUNCA publica com token da techbody_u.
  - Caption final = override do cliente (`{id}:caption:copy`) se existir,
    senão captions.json; hashtags sempre anexadas no fim.
  - Data/hora = overrides `{id}:date` / `{id}:hour` se existirem.
  - Verifica cada asset com HEAD 200 antes de criar containers.
  - Máx PUBLISH_CAP publicações por execução.

Env obrigatório:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  IG_TOKEN_TECHBODY,   IG_USER_ID_TECHBODY
  IG_TOKEN_TECHBODY_U, IG_USER_ID_TECHBODY_U
Opcional:
  IG_TOKEN_LUIZ_SANTANA, IG_USER_ID_LUIZ_SANTANA
  DRY_RUN=1  → não publica, só mostra o plano.
"""

import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GRAPH = "https://graph.instagram.com/v23.0"
SITE = "https://pontofinal.site"
TZ = ZoneInfo("Europe/Lisbon")
PUBLISH_CAP = int(os.environ.get("PUBLISH_CAP", "3"))
DRY = os.environ.get("DRY_RUN") == "1"

# ── PUBLISH_ONLY: lista de item IDs separados por vírgula ─────────────
# Quando definido, o publisher SÓ publica esses items (ignora todos os
# outros aprovados/due). Útil para publicações manuais e direccionadas.
PUBLISH_ONLY = set(
    s.strip() for s in os.environ.get("PUBLISH_ONLY", "").split(",") if s.strip()
)

# ── QUALITY GATE ────────────────────────────────────────────────────────
# Antes de publicar, validar que os PNGs têm dimensões correctas e não
# estão stale. Se o quality_gate falhar, abortar (mesmo em modo não-dry).
QUALITY_GATE = os.environ.get("SKIP_QUALITY_GATE") != "1"


def run_quality_gate():
    """Corre quality_gate.py como subprocess. Retorna True se passou."""
    if not QUALITY_GATE:
        print("  (quality gate desativado via SKIP_QUALITY_GATE)")
        return True
    qg_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quality_gate.py")
    if not os.path.exists(qg_path):
        print("  AVISO: quality_gate.py não encontrado — a saltar verificação")
        return True
    print("  a correr quality_gate...")
    try:
        result = subprocess.run(
            [sys.executable, qg_path, "--json"],
            capture_output=True, text=True, timeout=120
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            s = data.get("summary", {})
            print(f"  quality_gate: {s.get('pass',0)} pass, {s.get('fail',0)} fail")
            return True
        else:
            try:
                data = json.loads(result.stdout)
            except Exception:
                data = {"items": [], "summary": {"fail": 1, "pass": 0}}
            s = data.get("summary", {})
            print(f"  quality_gate FAIL: {s.get('fail',0)} items com problemas")
            for item in data.get("items", []):
                if item.get("status") == "fail":
                    print(f"    ✗ {item['item_id']}: {'; '.join(item.get('errors',[]))}")
            for ns, st in data.get("staleness", {}).items():
                if st.get("status") == "fail":
                    print(f"    ✗ STALENESS [{ns}]: {st.get('detail','')}")
            return False
    except subprocess.TimeoutExpired:
        print("  quality_gate: TIMEOUT — a abortar")
        return False
    except Exception as e:
        print(f"  quality_gate: erro ({e}) — a abortar por segurança")
        return False

# namespace de aprovação → deploy folder; marca → conta IG
DEPLOYS = {
    "cm-approval-tb-v1": "public/aprovacao-tb-202605",
    "cm-approval-luiz-v1": "public/aprovacao-luiz-202605",
}
BRAND_ENV = {
    "techbody": ("IG_TOKEN_TECHBODY", "IG_USER_ID_TECHBODY"),
    "techbody_u": ("IG_TOKEN_TECHBODY_U", "IG_USER_ID_TECHBODY_U"),
    "luiz_santana": ("IG_TOKEN_LUIZ_SANTANA", "IG_USER_ID_LUIZ_SANTANA"),
}

SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Fallback local para eventos que o Supabase não aceitou (publish_history
# INSERT falhou, network down, etc). JSONL append-only — pode ser re-importado
# depois com `psql -c "\\copy publish_history ... FROM 'fallback.jsonl'"`.
HISTORY_FALLBACK_PATH = os.environ.get(
    "PUBLISH_HISTORY_FALLBACK",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "publish_history_fallback.jsonl"),
)

_TOKENS_CACHE = None


def log_history(item_id, *, status, brand=None, kind=None, ig_post_id=None,
                caption=None, error_detail=None, scheduled_for=None,
                item_scheduled_for=None, dry_run=None, namespace=None):
    """Regista um evento no log imutável publish_history.

    status ∈ {published, error, skipped_no_token, stuck_claim, uncertain, dry_run_planned}
    Nunca levanta excepção: se Supabase falhar, escreve em HISTORY_FALLBACK_PATH.
    """
    if dry_run is None:
        dry_run = DRY
    row = {
        "item_id": item_id,
        "namespace": namespace,
        "brand": brand,
        "kind": kind,
        "status": status,
        "ig_post_id": ig_post_id,
        "error_detail": (error_detail or "")[:500] if error_detail else None,
        "scheduled_for": scheduled_for,
        "item_scheduled_for": item_scheduled_for,
        "dry_run": bool(dry_run),
    }
    row = {k: v for k, v in row.items() if v is not None}
    # NOTE: 'caption' column removed from publish_history — causes PGRST204 schema error
    try:
        sb("POST", "/publish_history", row)
    except Exception as e:
        # Fallback: append em ficheiro local JSONL para re-import posterior
        try:
            row.setdefault("fallback_ts", datetime.now(TZ).isoformat())
            row.setdefault("fallback_err", str(e)[:200])
            with open(HISTORY_FALLBACK_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
            print(f"  (history fallback → {HISTORY_FALLBACK_PATH}: {e})")
        except Exception as e2:
            print(f"  AVISO: nem Supabase nem fallback local aceitaram log: {e2}")


def brand_tokens():
    """Tokens por marca: Supabase `ig_tokens` (renovados pelo token-refresh.yml)
    com fallback para env vars durante a transição. Cache por execução."""
    global _TOKENS_CACHE
    if _TOKENS_CACHE is None:
        _TOKENS_CACHE = {}
        try:
            for r in sb("GET", "/ig_tokens?select=brand,token,ig_user_id,status"):
                if r.get("status") == "active" and r.get("token") and r.get("ig_user_id"):
                    _TOKENS_CACHE[r["brand"]] = (r["token"], r["ig_user_id"])
            if _TOKENS_CACHE:
                print(f"tokens via Supabase: {', '.join(sorted(_TOKENS_CACHE))}")
        except Exception as e:
            print(f"AVISO: ig_tokens ilegível ({e}) — fallback para env vars")
    return _TOKENS_CACHE


def get_token(brand):
    tok = brand_tokens().get(brand)
    if tok:
        return tok
    env_tok, env_uid = BRAND_ENV[brand]
    return os.environ.get(env_tok, ""), os.environ.get(env_uid, "")


def http(method, url, data=None, headers=None, as_json=True, ok_codes=(200, 201)):
    body = None
    if data is not None:
        body = urllib.parse.urlencode(data).encode() if not as_json else json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    if data is not None and as_json:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            raw = r.read().decode()
            return r.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except Exception:
            return e.code, {"raw": raw}


def sb(method, path, body=None, prefer=None):
    headers = {
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
    }
    if prefer:
        headers["Prefer"] = prefer
    code, resp = http(method, f"{SB_URL}/rest/v1{path}", body, headers)
    if code not in (200, 201, 204):
        raise RuntimeError(f"Supabase {method} {path} → {code}: {resp}")
    return resp


# Cloudflare bloqueia o UA "Python-urllib" (403) — usar UA de browser.
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def head_ok(url):
    """GET range 0-0 com UA de browser + validação de content-type.

    Dois modos de falha silenciosa sem isto:
      - Cloudflare devolve 403 a HEAD e ao UA urllib → falhava TUDO;
      - Cloudflare Pages serve o fallback SPA (200 text/html) para paths
        inexistentes → paths errados passavam o check e rebentavam na Meta.
    """
    try:
        req = urllib.request.Request(url, headers={"Range": "bytes=0-0", "User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            if r.status not in (200, 206):
                return False
            ctype = (r.headers.get("Content-Type") or "").lower()
            return not ctype.startswith("text/html")
    except Exception:
        return False


def note_text(raw):
    """approvals.note é JSON {"a": autor, "t": texto} ou string simples."""
    if not raw:
        return ""
    if isinstance(raw, str) and raw.strip().startswith("{"):
        try:
            return json.loads(raw).get("t", "") or ""
        except Exception:
            return raw
    return raw if isinstance(raw, str) else ""


def parse_hour(h):
    """'09h' / '09:00' / '18h30' → (H, M)"""
    h = (h or "12h").strip().lower().replace("h", ":").rstrip(":")
    parts = h.split(":")
    try:
        return int(parts[0]), int(parts[1]) if len(parts) > 1 and parts[1] else 0
    except ValueError:
        return 12, 0


def asset_base(item):
    """html_url '../brands/x/output/m/f/slug.html' → base URL pública sem extensão."""
    rel = (item.get("html_url") or "").replace("../brands/", "/brands/")
    rel = rel.replace(".playback.html", "").replace(".html", "")
    return SITE + rel


def build_assets(item):
    base = asset_base(item)
    fmt = item.get("format")
    if fmt == "carrossel":
        n = int(item.get("slides") or 6)
        # base .../carrosseis/c01-slug → shots em c01-slug_shots/slide_NN.png
        # slides animados (loops julho+) vivem ao lado: slide_NN.mp4
        folder = base.rsplit("/", 1)
        shots = f"{folder[0]}/{folder[1]}_shots"
        return {
            "photos": [f"{shots}/slide_{i:02d}.png" for i in range(1, n + 1)],
            "videos": [f"{shots}/slide_{i:02d}.mp4" for i in range(1, n + 1)],
        }
    if fmt == "story":
        return {"photos": [base + ".png"], "video": base + ".mp4"}
    if fmt == "reel":
        return {"video": base + ".mp4"}
    raise ValueError(f"formato desconhecido: {fmt}")


def ig_create(ig_user, token, payload):
    payload = dict(payload, access_token=token)
    code, resp = http("POST", f"{GRAPH}/{ig_user}/media", payload, as_json=False)
    if code != 200 or "id" not in resp:
        raise RuntimeError(f"container falhou: {code} {resp}")
    return resp["id"]


def ig_wait(container, token, tries=40, delay=15):
    for _ in range(tries):
        code, resp = http(
            "GET",
            f"{GRAPH}/{container}?fields=status_code&access_token={urllib.parse.quote(token)}",
        )
        st = resp.get("status_code")
        if st == "FINISHED":
            return
        if st in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"container {container} status {st}: {resp}")
        time.sleep(delay)
    raise RuntimeError(f"container {container} não ficou pronto a tempo")


class UncertainPublish(RuntimeError):
    """Falha no media_publish final — o post PODE ter saído do lado da Meta.

    Nunca converter em 'error' retryável: re-tentar às cegas foi a causa dos
    5 reels duplicados de maio. O claim fica em 'publishing' até verificação
    manual no Instagram.
    """


def ig_publish(ig_user, token, container):
    try:
        code, resp = http(
            "POST", f"{GRAPH}/{ig_user}/media_publish",
            {"creation_id": container, "access_token": token}, as_json=False,
        )
    except Exception as e:
        raise UncertainPublish(f"media_publish sem resposta ({e}) — post pode ter saído") from e
    if code != 200 or "id" not in resp:
        raise RuntimeError(f"publish falhou: {code} {resp}")
    return resp["id"]


def publish_item(item, caption, ig_user, token):
    assets = build_assets(item)
    fmt = item["format"]

    if fmt == "carrossel":
        # decisão Lucca 2026-06-11: carrosséis SEMPRE imagens estáticas
        # (os slide_NN.mp4 existem mas são ignorados aqui)
        slides = []
        for photo in assets["photos"]:
            if head_ok(photo):
                slides.append(("image", photo))
            else:
                raise RuntimeError(f"asset em falta: {photo}")
        children = []
        try:
            for kind, url in slides:
                if kind == "video":
                    cid = ig_create(ig_user, token, {
                        "media_type": "VIDEO", "video_url": url, "is_carousel_item": "true",
                    })
                    ig_wait(cid, token)  # children de vídeo têm de chegar a FINISHED
                else:
                    cid = ig_create(ig_user, token, {"image_url": url, "is_carousel_item": "true"})
                children.append(cid)
                time.sleep(2)
            parent = ig_create(ig_user, token, {
                "media_type": "CAROUSEL", "children": ",".join(children), "caption": caption,
            })
            ig_wait(parent, token)
            return ig_publish(ig_user, token, parent)
        except UncertainPublish:
            raise
        except Exception as e:
            # containers órfãos expiram sozinhos na Meta; IDs ficam no erro p/ diagnóstico
            raise RuntimeError(f"{e} [children criados: {','.join(children) or 'nenhum'}]") from e

    if fmt == "story":
        # decisão Lucca 2026-06-11: só REELS são vídeo — stories saem estáticas
        url = assets["photos"][0]
        if head_ok(url):
            c = ig_create(ig_user, token, {"media_type": "STORIES", "image_url": url})
        else:
            video = assets.get("video")
            if not (video and head_ok(video)):
                raise RuntimeError(f"asset em falta: {url}")
            c = ig_create(ig_user, token, {"media_type": "STORIES", "video_url": video})
        ig_wait(c, token)
        return ig_publish(ig_user, token, c)

    if fmt == "reel":
        url = assets["video"]
        if not head_ok(url):
            raise RuntimeError(f"asset em falta (mp4 por renderizar?): {url}")
        payload = {"media_type": "REELS", "video_url": url, "caption": caption}
        cover = url[:-4] + ".jpg"  # cover com texto-hook, se existir
        if head_ok(cover):
            payload["cover_url"] = cover
        c = ig_create(ig_user, token, payload)
        ig_wait(c, token)
        return ig_publish(ig_user, token, c)


# ── PASSO 7: Verificação pós-publicação ──────────────────────────────────
def verify_post(ig_user, token, media_id, retries=3, delay=10):
    """Verifica que o post existe no IG e tenta validar dimensões.
    Retorna dict com status: verified / mismatch / error."""
    for attempt in range(retries):
        try:
            code, resp = http("GET",
                f"{GRAPH}/{media_id}?fields=id,media_type,media_url,permalink,timestamp"
                f"&access_token={urllib.parse.quote(token)}")
            if code != 200:
                if attempt < retries - 1:
                    time.sleep(delay)
                    continue
                return {"status": "error", "error": f"Graph API {code}: {resp}"}
            permalink = resp.get("permalink", "")
            media_url = resp.get("media_url", "")
            dims = None
            if media_url:
                try:
                    req = urllib.request.Request(media_url,
                        headers={"User-Agent": UA, "Range": "bytes=0-4096"})
                    with urllib.request.urlopen(req, timeout=30) as r:
                        header = r.read(4096)
                        if header[:8] == b'\x89PNG\r\n\x1a\n' and len(header) >= 24:
                            import struct
                            w = struct.unpack('>I', header[16:20])[0]
                            h = struct.unpack('>I', header[20:24])[0]
                            dims = f"{w}x{h}"
                except Exception:
                    pass
            result = {"status": "verified", "permalink": permalink,
                      "media_url": media_url}
            if dims:
                result["dimensions"] = dims
            return result
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(delay)
                continue
            return {"status": "error", "error": str(e)[:200]}
    return {"status": "error", "error": "max retries exceeded"}


# ── PASSO 8: Info de assets para log de auditoria ────────────────────────
def get_assets_info(item):
    """Recolhe info de assets (URLs, acessibilidade) para auditoria."""
    assets = build_assets(item)
    fmt = item.get("format")
    info = {"format": fmt, "slides": []}
    urls = assets.get("photos") or [assets.get("video")] or []
    for url in (urls or []):
        if not url:
            continue
        info["slides"].append({"url": url, "accessible": head_ok(url)})
    return info


def main():
    # ── KILL SWITCH ──────────────────────────────────────────────────────
    # PUBLISH_ENABLED tem de ser "true" (string) nos GitHub Secrets.
    # Default: ausente / "false" → publisher recusa correr.
    # Isto previne 100% das publicações acidentais, mesmo que o cron seja
    # reativado por engano.
    publish_enabled = os.environ.get("PUBLISH_ENABLED", "").strip().lower()
    if publish_enabled != "true":
        print("BLOCKED: PUBLISH_ENABLED != true — a interromper sem publicar.")
        print("  Para publicar: definir PUBLISH_ENABLED=true nos GitHub Secrets")
        print("  e correr gh workflow run techbody-publish.yml -f dry_run=1 primeiro.")
        sys.exit(0)

    if not SB_URL or not SB_KEY:
        print("FATAL: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY em falta")
        sys.exit(1)

    now = datetime.now(TZ)
    print(f"== techbody_publisher {now.isoformat()} (cap={PUBLISH_CAP}, dry={DRY})")

    # ledger: items já publicados, em erro permanente ou com claim pendente
    try:
        ledger = {r["item_id"]: r for r in sb("GET", "/publish_queue?select=item_id,status,created_at")}
    except RuntimeError:
        ledger = {r["item_id"]: r for r in sb("GET", "/publish_queue?select=item_id,status")}

    print(f"  ledger: {len(ledger)} items — {sum(1 for r in ledger.values() if r.get('status')=='published')} published, {sum(1 for r in ledger.values() if r.get('status')=='publishing')} publishing, {sum(1 for r in ledger.values() if r.get('status')=='error')} error")

    # SAFEGUARD: se o ledger estiver vazio, NUNCA publicar (pode causar duplicados)
    if not ledger and not DRY:
        print("ABORT: publish_queue vazio — risco de duplicados. A interromper.")
        print("  Para a primeira execução, usar DRY_RUN=1 para verificar o plano.")
        sys.exit(1)

    # ── QUALITY GATE ──────────────────────────────────────────────────────
    # Validar PNGs antes de qualquer publicação. Em DRY_RUN, reporta mas não
    # aborta (para o user ver o plano + os problemas ao mesmo tempo).
    if not DRY:
        if not run_quality_gate():
            print("ABORT: quality_gate falhou — corrigir antes de publicar.")
            sys.exit(1)
    else:
        run_quality_gate()  # reporta mas não aborta em dry-run

    # claims 'publishing' antigos = run anterior morreu a meio; nunca republicar
    # às cegas — alertar para verificação manual no Instagram
    alerts = []
    for lid, row in ledger.items():
        if row.get("status") != "publishing":
            continue
        try:
            created = datetime.fromisoformat((row.get("created_at") or "").replace("Z", "+00:00"))
            age_h = (now - created.astimezone(TZ)).total_seconds() / 3600
        except ValueError:
            age_h = 999.0
        if age_h > 1:
            print(f"STUCK {lid}: claim 'publishing' há {age_h:.1f}h — verificar no Instagram e marcar published/error no Supabase")
            alerts.append({"type": "stuck_publishing", "item_id": lid,
                           "detail": f"claim 'publishing' há {age_h:.1f}h; confirmar no Instagram se o post saiu e corrigir o publish_queue"})
            log_history(lid, status="stuck_claim",
                        error_detail=f"claim 'publishing' há {age_h:.1f}h")

    published = 0
    for ns, deploy in DEPLOYS.items():
        items_path = os.path.join(ROOT, deploy, "data", "items.json")
        captions_path = os.path.join(ROOT, deploy, "data", "captions.json")
        if not os.path.exists(items_path):
            continue
        items = {i["id"]: i for i in json.load(open(items_path))}
        captions = json.load(open(captions_path)) if os.path.exists(captions_path) else {}

        rows = sb("GET", f"/approvals?namespace=eq.{ns}&select=item_id,status,note")
        state = {r["item_id"]: r for r in rows}

        for iid, item in sorted(items.items(), key=lambda kv: (kv[1].get("scheduled_for") or "", kv[0])):
            if published >= PUBLISH_CAP:
                break
            # Filtro PUBLISH_ONLY: se definido, ignorar tudo o que não estiver na lista
            if PUBLISH_ONLY and iid not in PUBLISH_ONLY:
                continue
            # peças só-preview vivem na página de aprovação mas NUNCA publicam,
            # mesmo aprovadas (ex.: stories do Luiz, decisão 2026-06-10)
            if item.get("preview_only"):
                continue
            base = state.get(iid, {})
            if base.get("status") != "approved":
                continue
            lstatus = ledger.get(iid, {}).get("status")
            if lstatus in ("published", "error_permanent"):
                continue
            if lstatus == "publishing":
                print(f"SKIP {iid}: claim 'publishing' pendente — não republico sem verificação manual")
                continue

            date = note_text(state.get(f"{iid}:date", {}).get("note")) or item.get("scheduled_for")
            hh, mm = parse_hour(note_text(state.get(f"{iid}:hour", {}).get("note")) or item.get("hour"))
            try:
                when = datetime.strptime(date, "%Y-%m-%d").replace(hour=hh, minute=mm, tzinfo=TZ)
            except (ValueError, TypeError):
                print(f"SKIP {iid}: data inválida {date!r}")
                continue
            if when > now:
                continue

            brand = item["brand"]
            token, ig_user = get_token(brand)
            if not token or not ig_user:
                print(f"SKIP {iid}: sem token/user para {brand}")
                # item DUE sem token não pode falhar em silêncio: fica no ledger
                # (1.ª vez) e gera alerta; quando o token chegar, volta a ser elegível
                if lstatus != "skipped_no_token" and not DRY:
                    alerts.append({"type": "skipped_no_token", "item_id": iid,
                                   "detail": f"item due ({when:%Y-%m-%d %H:%M}) sem token/user para {brand}"})
                    try:
                        sb("POST", "/publish_queue?on_conflict=item_id", {
                            "item_id": iid, "namespace": ns, "brand": brand,
                            "kind": item["format"], "status": "skipped_no_token",
                            "status": "skipped_no_token",
                            "scheduled_for": when.isoformat(),
                        }, prefer="resolution=merge-duplicates")
                    except Exception as e:
                        print(f"  (ledger do skip falhou: {e})")
                    log_history(iid, status="skipped_no_token", brand=brand,
                                kind=item["format"], namespace=ns,
                                error_detail=f"sem token/user para {brand} (due {when:%Y-%m-%d %H:%M})",
                                scheduled_for=when.isoformat(),
                                item_scheduled_for=item.get("scheduled_for"))
                continue

            cap_copy = note_text(state.get(f"{iid}:caption:copy", {}).get("note"))
            cap = (cap_copy or captions.get(iid, {}).get("caption") or item.get("title", "")).strip()
            hashtags = captions.get(iid, {}).get("hashtags", "").strip()
            # caption editada/original pode já trazer bloco de hashtags — não duplicar
            caption = cap if ("#" in cap or not hashtags) else cap + "\n" + hashtags

            print(f"DUE {iid} [{brand}/{item['format']}] agendado {when:%Y-%m-%d %H:%M}")
            if DRY:
                log_history(iid, status="dry_run_planned", brand=brand,
                            kind=item["format"], namespace=ns,
                            caption=caption[:500],
                            scheduled_for=when.isoformat(),
                            item_scheduled_for=item.get("scheduled_for"))
                published += 1
                continue

            # claim ANTES de publicar: crash entre o Instagram e o ledger nunca
            # pode resultar em post duplicado no cron seguinte
            try:
                sb("POST", "/publish_queue?on_conflict=item_id", {
                    "item_id": iid, "namespace": ns, "brand": brand,
                    "kind": item["format"], "status": "publishing",
                    "scheduled_for": when.isoformat(),
                }, prefer="resolution=merge-duplicates")
            except Exception as e:
                print(f"SKIP {iid}: claim falhou ({e}) — sem claim não publico")
                continue

            try:
                media_id = publish_item(item, caption, ig_user, token)
            except UncertainPublish as e:
                # post PODE ter saído — claim fica em 'publishing' (bloqueia retry)
                print(f"INCERTO {iid}: {e}")
                alerts.append({"type": "uncertain_publish", "item_id": iid, "brand": brand,
                               "detail": f"{str(e)[:300]} — verificar no Instagram; marcar published/error no Supabase"})
                log_history(iid, status="uncertain", brand=brand,
                            kind=item["format"], namespace=ns,
                            error_detail=str(e)[:500],
                            scheduled_for=when.isoformat(),
                            item_scheduled_for=item.get("scheduled_for"))
                continue
            except Exception as e:
                print(f"ERRO {iid}: {e}")
                alerts.append({"type": "publish_error", "item_id": iid, "brand": brand,
                               "detail": str(e)[:300]})
                try:
                    sb("POST", "/publish_queue?on_conflict=item_id", {
                        "item_id": iid, "namespace": ns, "brand": brand,
                        "kind": item["format"], "status": "error",
                        "scheduled_for": when.isoformat(),
                    }, prefer="resolution=merge-duplicates")
                except Exception as e2:
                    print(f"  (ledger também falhou: {e2} — fica 'publishing'; alerta de stuck no próximo run)")
                log_history(iid, status="error", brand=brand,
                            kind=item["format"], namespace=ns,
                            error_detail=str(e)[:500],
                            scheduled_for=when.isoformat(),
                            item_scheduled_for=item.get("scheduled_for"))
                continue

            # publicado com sucesso — se o update do ledger falhar, NUNCA marcar
            # 'error' (tornaria o item retryável = duplicado garantido)
            try:
                sb("POST", "/publish_queue?on_conflict=item_id", {
                    "item_id": iid, "namespace": ns, "brand": brand,
                    "kind": item["format"], "status": "published",
                    "scheduled_for": when.isoformat(),
                }, prefer="resolution=merge-duplicates")
                print(f"OK {iid} → media {media_id}")
            except Exception as e:
                print(f"AVISO {iid}: PUBLICADO (media {media_id}) mas ledger não atualizou: {e}")
                alerts.append({"type": "ledger_update_failed", "item_id": iid, "brand": brand,
                               "detail": f"post SAIU (media_id={media_id}) mas ficou 'publishing' no ledger — marcar 'published' no Supabase"})
            # Marcar como published na tabela approvals (para a UI mostrar)
            try:
                sb("POST", "/approvals?on_conflict=namespace,item_id", {
                    "namespace": ns,
                    "item_id": iid,
                    "status": "published",
                    "updated_at": datetime.now(TZ).isoformat(),
                }, prefer="resolution=merge-duplicates")
            except Exception as e:
                print(f"  AVISO: approvals não atualizado para published: {e}")
            # ── VERIFICAÇÃO PÓS-PUBLICAÇÃO (passo 7) ────────────────────
            # Confirmar que o post existe no Instagram e validar dimensões
            post_verification = verify_post(ig_user, token, media_id)
            if post_verification.get("status") == "verified":
                print(f"  ✓ verificado no IG: {post_verification.get('permalink','')}")
                ig_dims = post_verification.get("dimensions", "")
                if ig_dims:
                    print(f"    dimensões IG: {ig_dims}")
            elif post_verification.get("status") == "mismatch":
                ig_dims = post_verification.get("dimensions", "")
                print(f"  ⚠ MISMATCH: IG devolveu dimensões diferentes: {ig_dims}")
                alerts.append({"type": "dimension_mismatch", "item_id": iid, "brand": brand,
                               "detail": f"Post publicado mas dimensões no IG diferem do original: {ig_dims}"})
            else:
                print(f"  ⚠ verificação pós-publicação falhou: {post_verification.get('error','')}")

            # ── LOG EXPANDIDO (passo 8) ─────────────────────────────────────
            # Log imutável com auditoria completa: asset md5, dimensões,
            # verificação pós-publicação
            assets_info = get_assets_info(item)
            log_history(iid, status="published", brand=brand,
                        kind=item["format"], namespace=ns,
                        ig_post_id=media_id,
                        caption=caption[:500],
                        scheduled_for=when.isoformat(),
                        item_scheduled_for=item.get("scheduled_for"))
            # Log adicional de verificação em ficheiro local (publish_history
            # do Supabase tem schema fixo — info extra vai para fallback JSONL)
            try:
                verification_row = {
                    "item_id": iid, "namespace": ns, "brand": brand,
                    "ig_post_id": media_id,
                    "post_verification": post_verification,
                    "assets": assets_info,
                    "published_at": datetime.now(TZ).isoformat(),
                }
                with open(HISTORY_FALLBACK_PATH.replace(".jsonl", "_verification.jsonl"), "a", encoding="utf-8") as f:
                    f.write(json.dumps(verification_row, ensure_ascii=False) + "\n")
            except Exception:
                pass
            published += 1

    if alerts and not DRY:
        alerts_path = os.path.join(ROOT, "publish_alerts.json")
        with open(alerts_path, "w", encoding="utf-8") as f:
            json.dump(alerts, f, ensure_ascii=False, indent=1)
        print(f"== {len(alerts)} alerta(s) → {alerts_path}")

    print(f"== fim: {published} publicados/planeados")


if __name__ == "__main__":
    main()
