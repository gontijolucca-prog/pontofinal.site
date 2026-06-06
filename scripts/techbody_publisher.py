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
        folder = base.rsplit("/", 1)
        shots = f"{folder[0]}/{folder[1]}_shots"
        return {"photos": [f"{shots}/slide_{i:02d}.png" for i in range(1, n + 1)]}
    if fmt == "story":
        return {"photos": [base + ".png"]}
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


def ig_publish(ig_user, token, container):
    code, resp = http(
        "POST", f"{GRAPH}/{ig_user}/media_publish",
        {"creation_id": container, "access_token": token}, as_json=False,
    )
    if code != 200 or "id" not in resp:
        raise RuntimeError(f"publish falhou: {code} {resp}")
    return resp["id"]


def publish_item(item, caption, ig_user, token):
    assets = build_assets(item)
    fmt = item["format"]

    if fmt == "carrossel":
        for url in assets["photos"]:
            if not head_ok(url):
                raise RuntimeError(f"asset em falta: {url}")
        children = []
        for url in assets["photos"]:
            children.append(ig_create(ig_user, token, {"image_url": url, "is_carousel_item": "true"}))
            time.sleep(2)
        parent = ig_create(ig_user, token, {
            "media_type": "CAROUSEL", "children": ",".join(children), "caption": caption,
        })
        ig_wait(parent, token)
        return ig_publish(ig_user, token, parent)

    if fmt == "story":
        url = assets["photos"][0]
        if not head_ok(url):
            raise RuntimeError(f"asset em falta: {url}")
        c = ig_create(ig_user, token, {"media_type": "STORIES", "image_url": url})
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


def main():
    if not SB_URL or not SB_KEY:
        print("FATAL: SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY em falta")
        sys.exit(1)

    now = datetime.now(TZ)
    print(f"== techbody_publisher {now.isoformat()} (cap={PUBLISH_CAP}, dry={DRY})")

    # ledger: items já publicados ou em erro permanente
    ledger = {r["item_id"]: r for r in sb("GET", "/publish_queue?select=item_id,status")}

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
            base = state.get(iid, {})
            if base.get("status") != "approved":
                continue
            if iid in ledger and ledger[iid].get("status") in ("published", "error_permanent"):
                continue

            brand = item["brand"]
            env_tok, env_uid = BRAND_ENV[brand]
            token, ig_user = os.environ.get(env_tok, ""), os.environ.get(env_uid, "")
            if not token or not ig_user:
                print(f"SKIP {iid}: sem token/user para {brand}")
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

            cap_copy = note_text(state.get(f"{iid}:caption:copy", {}).get("note"))
            cap = (cap_copy or captions.get(iid, {}).get("caption") or item.get("title", "")).strip()
            hashtags = captions.get(iid, {}).get("hashtags", "").strip()
            # caption editada/original pode já trazer bloco de hashtags — não duplicar
            caption = cap if ("#" in cap or not hashtags) else cap + "\n" + hashtags

            print(f"DUE {iid} [{brand}/{item['format']}] agendado {when:%Y-%m-%d %H:%M}")
            if DRY:
                published += 1
                continue

            try:
                media_id = publish_item(item, caption, ig_user, token)
                sb("POST", "/publish_queue", {
                    "item_id": iid, "namespace": ns, "brand": brand,
                    "kind": item["format"], "status": "published",
                    "caption": caption[:500],
                    "assets": build_assets(item),
                    "scheduled_for": when.isoformat(),
                }, prefer="resolution=merge-duplicates")
                print(f"OK {iid} → media {media_id}")
                published += 1
            except Exception as e:
                print(f"ERRO {iid}: {e}")
                try:
                    sb("POST", "/publish_queue", {
                        "item_id": iid, "namespace": ns, "brand": brand,
                        "kind": item["format"], "status": "error",
                        "caption": str(e)[:500],
                        "scheduled_for": when.isoformat(),
                    }, prefer="resolution=merge-duplicates")
                except Exception as e2:
                    print(f"  (ledger também falhou: {e2})")

    print(f"== fim: {published} publicados/planeados")


if __name__ == "__main__":
    main()
