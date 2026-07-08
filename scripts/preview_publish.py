#!/usr/bin/env python3
"""
Preview Publish — mostra exactamente o que vai ser publicado ANTES de publicar.

Gera uma página HTML com:
  - Cada item agendado para hoje (ou data especificada)
  - Thumbnail do primeiro slide
  - Título, marca, hora agendada
  - Checkbox para seleccionar quais publicar
  - Botão "Copiar IDs" para usar no publish_only

Uso:
  python3 scripts/preview_publish.py                     # Mostra items due hoje
  python3 scripts/preview_publish.py --date 2026-07-09   # Mostra items de uma data
  python3 scripts/preview_publish.py --all               # Mostra todos os items pending
  python3 scripts/preview_publish.py --json              # Output JSON (para CI)
"""

import argparse
import json
import os
import sys
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import URLError

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://pontofinal.site"
TZ_NAME = "Europe/Lisbon"

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo(TZ_NAME)
except ImportError:
    TZ = None

# Supabase — read from env
SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"

DEPLOYS = {
    "cm-approval-tb-v1": "public/aprovacao-tb-202605",
    "cm-approval-luiz-v1": "public/aprovacao-luiz-202605",
}

BRAND_COLORS = {
    "techbody": "#e07a3a",
    "techbody_u": "#b06d35",
    "luiz_santana": "#F69E1E",
    "pontofinal_site": "#FF2A2A",
}

BRAND_IG = {
    "techbody": "@techbody",
    "techbody_u": "@techbody_u",
    "luiz_santana": "@luiz_santannaa",
}


def http_get(url, as_json=True):
    """Simple HTTP GET with browser UA."""
    req = Request(url, headers={"User-Agent": UA})
    try:
        with urlopen(req, timeout=15) as r:
            data = r.read()
            return json.loads(data) if as_json else data.decode()
    except (URLError, Exception) as e:
        print(f"  AVISO: HTTP GET falhou ({url[:60]}...): {e}", file=sys.stderr)
        return None


def sb_get(path):
    """Supabase GET."""
    if not SB_URL or not SB_KEY:
        return None
    url = f"{SB_URL}/rest/v1{path}"
    req = Request(url, headers={
        "apikey": SB_KEY,
        "Authorization": f"Bearer {SB_KEY}",
        "User-Agent": UA,
    })
    try:
        with urlopen(req, timeout=15) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"  AVISO: Supabase falhou: {e}", file=sys.stderr)
        return None


def note_text(raw):
    """Extract text from Supabase note field (JSON or plain string)."""
    if not raw:
        return ""
    if isinstance(raw, dict):
        return raw.get("t", "")
    if isinstance(raw, str):
        try:
            d = json.loads(raw)
            return d.get("t", raw)
        except (json.JSONDecodeError, TypeError):
            return raw
    return str(raw)


def load_items(deploy_path):
    """Load items.json from a deploy folder."""
    items_file = ROOT / deploy_path / "data" / "items.json"
    if not items_file.exists():
        return {}
    with open(items_file) as f:
        items_list = json.load(f)
    return {i["id"]: i for i in items_list}


def get_thumbnail_url(item):
    """Get the thumbnail URL for an item."""
    html_url = item.get("html_url", "")
    if not html_url:
        return ""

    fmt = item.get("format", "")
    brand = item.get("brand", "")
    month = item.get("month", "")

    if fmt == "carrossel":
        # e.g. ../brands/techbody/output/2026-07/carrosseis/c04-espaco-estudio.html
        base = html_url.replace(".html", "").replace("../", "")
        return f"{SITE}/{base}_shots/slide_01.jpg"
    elif fmt in ("reel", "story"):
        base = html_url.replace(".html", "").replace("../", "")
        return f"{SITE}/{base}.jpg"
    return ""


def get_items_for_date(deploy_key, deploy_path, target_date, supabase_state):
    """Get all items due on a specific date."""
    items = load_items(deploy_path)
    results = []

    for iid, item in items.items():
        # Get scheduled date from Supabase override or items.json
        sb_item = supabase_state.get(iid, {}) if supabase_state else {}
        date = note_text(sb_item.get("note", "")) if False else None  # placeholder

        # Check Supabase overrides for date/hour
        date_override = note_text(supabase_state.get(f"{iid}:date", {}).get("note")) if supabase_state else None
        hour_override = note_text(supabase_state.get(f"{iid}:hour", {}).get("note")) if supabase_state else None

        scheduled = date_override or item.get("scheduled_for", "")
        hour = hour_override or item.get("hour", "")

        if not scheduled:
            continue

        if target_date and scheduled != target_date:
            # For "all" mode, include everything
            if target_date != "all":
                continue

        status = sb_item.get("status", "pending") if sb_item else "pending"

        results.append({
            "id": iid,
            "brand": item.get("brand", ""),
            "format": item.get("format", ""),
            "title": item.get("title", ""),
            "scheduled": scheduled,
            "hour": hour,
            "status": status,
            "thumbnail": get_thumbnail_url(item),
            "slides": item.get("slides", 1),
            "html_url": item.get("html_url", ""),
            "publishable": status == "approved",
        })

    return sorted(results, key=lambda x: (x["brand"], x["id"]))


def generate_html(items, target_date):
    """Generate an HTML preview page."""
    now = datetime.now(TZ) if TZ else datetime.now()
    date_label = target_date if target_date != "all" else "TODOS"

    items_html = ""
    for item in items:
        status_color = "#22c55e" if item["status"] == "approved" else "#eab308" if item["status"] == "pending" else "#ef4444"
        status_label = {"approved": "APROVADO", "pending": "PENDENTE", "published": "PUBLICADO"}.get(item["status"], item["status"].upper())
        brand_color = BRAND_COLORS.get(item["brand"], "#666")
        ig_handle = BRAND_IG.get(item["brand"], "")
        publishable_class = "publishable" if item["publishable"] else "not-publishable"
        disabled = "" if item["publishable"] else "disabled"

        thumb_html = ""
        if item["thumbnail"]:
            thumb_html = f'<img src="{item["thumbnail"]}" alt="{item["title"]}" class="thumb" onerror="this.style.display=\'none\'" />'
        else:
            thumb_html = f'<div class="thumb-placeholder">Sem thumbnail</div>'

        items_html += f"""
        <div class="item {publishable_class}" data-id="{item['id']}">
            <div class="item-header">
                <label class="checkbox-label">
                    <input type="checkbox" class="item-check" value="{item['id']}" {"checked" if item["publishable"] else ""} {disabled} />
                    <span class="item-id">{item['id']}</span>
                </label>
                <span class="badge" style="background: {status_color}">{status_label}</span>
            </div>
            <div class="item-body">
                <div class="thumb-container">
                    {thumb_html}
                </div>
                <div class="item-info">
                    <div class="item-brand" style="color: {brand_color}">{item['brand'].upper()} → {ig_handle}</div>
                    <div class="item-title">{item['title']}</div>
                    <div class="item-meta">
                        <span>📅 {item['scheduled']}</span>
                        <span>🕐 {item['hour'] or 'N/A'}</span>
                        <span>🖼️ {item['slides']} slides</span>
                        <span>📄 {item['format']}</span>
                    </div>
                </div>
            </div>
        </div>"""

    approved_count = sum(1 for i in items if i["publishable"])

    html = f"""<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview de Publicação — {date_label}</title>
<style>
    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a0a0a; color: #fff; padding: 32px; }}
    h1 {{ font-size: 28px; margin-bottom: 8px; }}
    .subtitle {{ color: #888; margin-bottom: 24px; font-size: 14px; }}
    .summary {{ background: #1a1a1a; border: 1px solid #333; border-radius: 12px; padding: 16px 24px; margin-bottom: 24px; display: flex; gap: 32px; align-items: center; }}
    .summary-stat {{ text-align: center; }}
    .summary-stat .num {{ font-size: 32px; font-weight: 700; color: #22c55e; }}
    .summary-stat .label {{ font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }}
    .item {{ background: #1a1a1a; border: 1px solid #333; border-radius: 12px; margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s; }}
    .item.publishable {{ border-color: #22c55e44; }}
    .item.not-publishable {{ border-color: #ef444444; opacity: 0.6; }}
    .item.selected {{ border-color: #22c55e; box-shadow: 0 0 0 1px #22c55e; }}
    .item-header {{ padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; }}
    .checkbox-label {{ display: flex; align-items: center; gap: 10px; cursor: pointer; }}
    .checkbox-label input {{ width: 18px; height: 18px; accent-color: #22c55e; cursor: pointer; }}
    .item-id {{ font-family: monospace; font-size: 13px; color: #ccc; }}
    .badge {{ font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 100px; color: #fff; text-transform: uppercase; letter-spacing: 0.05em; }}
    .item-body {{ display: flex; gap: 16px; padding: 16px; }}
    .thumb-container {{ flex-shrink: 0; width: 160px; height: 200px; border-radius: 8px; overflow: hidden; background: #222; }}
    .thumb {{ width: 100%; height: 100%; object-fit: cover; }}
    .thumb-placeholder {{ width: 100%; height: 100%; display: grid; place-items: center; color: #666; font-size: 12px; }}
    .item-info {{ flex: 1; display: flex; flex-direction: column; gap: 8px; }}
    .item-brand {{ font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }}
    .item-title {{ font-size: 18px; font-weight: 600; line-height: 1.3; }}
    .item-meta {{ display: flex; gap: 16px; font-size: 12px; color: #888; margin-top: auto; }}
    .actions {{ position: sticky; bottom: 0; background: #0a0a0a; border-top: 1px solid #333; padding: 20px 0; display: flex; gap: 12px; align-items: center; }}
    .btn {{ padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; }}
    .btn-primary {{ background: #22c55e; color: #000; }}
    .btn-primary:hover {{ background: #16a34a; }}
    .btn-secondary {{ background: #333; color: #fff; }}
    .btn-secondary:hover {{ background: #444; }}
    .btn-danger {{ background: #ef4444; color: #fff; }}
    .btn-danger:hover {{ background: #dc2626; }}
    .ids-output {{ font-family: monospace; font-size: 13px; background: #1a1a1a; border: 1px solid #333; border-radius: 8px; padding: 12px; color: #22c55e; min-width: 300px; word-break: break-all; }}
    .warning {{ background: #78350f; border: 1px solid #f59e0b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; font-size: 13px; color: #fbbf24; }}
    .select-actions {{ display: flex; gap: 8px; margin-bottom: 16px; }}
    .select-actions button {{ padding: 6px 12px; border: 1px solid #444; border-radius: 6px; background: transparent; color: #ccc; font-size: 12px; cursor: pointer; }}
    .select-actions button:hover {{ border-color: #888; background: #222; }}
</style>
</head>
<body>

<h1>📤 Preview de Publicação</h1>
<p class="subtitle">Gerado em {now.strftime('%Y-%m-%d %H:%M')} — {date_label}</p>

<div class="warning">
    ⚠️ <strong>VERIFICA CADA ANTES DE CONFIRMAR.</strong> Publicar o post errado prejudica a confiança do cliente.
</div>

<div class="summary">
    <div class="summary-stat">
        <div class="num">{len(items)}</div>
        <div class="label">Items encontrados</div>
    </div>
    <div class="summary-stat">
        <div class="num" style="color: #22c55e">{approved_count}</div>
        <div class="label">Aprovados (publicáveis)</div>
    </div>
    <div class="summary-stat">
        <div class="num" style="color: #eab308">{len(items) - approved_count}</div>
        <div class="label">Não aprovados</div>
    </div>
</div>

<div class="select-actions">
    <button onclick="document.querySelectorAll('.item-check:not(:disabled)').forEach(c => c.checked = true)">Seleccionar todos aprovados</button>
    <button onclick="document.querySelectorAll('.item-check').forEach(c => c.checked = false)">Desseleccionar todos</button>
</div>

{items_html}

<div class="actions">
    <button class="btn btn-primary" onclick="copyIds()">📋 Copiar IDs seleccionados</button>
    <button class="btn btn-secondary" onclick="copyIdsWithPublish()">🚀 Copiar IDs para publicar</button>
    <div class="ids-output" id="idsOutput">Selecciona items acima</div>
</div>

<script>
document.querySelectorAll('.item-check').forEach(cb => {{
    cb.addEventListener('change', () => {{
        cb.closest('.item').classList.toggle('selected', cb.checked);
        updateIds();
    }});
}});

function getSelectedIds() {{
    return Array.from(document.querySelectorAll('.item-check:checked')).map(c => c.value);
}}

function updateIds() {{
    const ids = getSelectedIds();
    document.getElementById('idsOutput').textContent = ids.length ? ids.join(',') : 'Selecciona items acima';
}}

function copyIds() {{
    const ids = getSelectedIds();
    if (!ids.length) return alert('Nenhum item seleccionado');
    navigator.clipboard.writeText(ids.join(','));
    document.getElementById('idsOutput').textContent = '✓ Copiado! ' + ids.join(',');
}}

function copyIdsWithPublish() {{
    const ids = getSelectedIds();
    if (!ids.length) return alert('Nenhum item seleccionado');
    const cmd = `gh workflow run techbody-publish.yml --repo gontijolucca-prog/pontofinal.site -f dry_run=0 -f publish_only='${{ids.join(',')}}'`;
    navigator.clipboard.writeText(cmd);
    document.getElementById('idsOutput').textContent = '✓ Comando copiado! Cole no terminal.';
}}
</script>

</body>
</html>"""
    return html


def main():
    parser = argparse.ArgumentParser(description="Preview de publicação — mostra o que vai sair")
    parser.add_argument("--date", default=None, help="Data alvo (YYYY-MM-DD). Default: hoje")
    parser.add_argument("--all", action="store_true", help="Mostra todos os items pending")
    parser.add_argument("--json", action="store_true", help="Output JSON")
    args = parser.parse_args()

    now = datetime.now(TZ) if TZ else datetime.now()
    target = args.date or ("all" if args.all else now.strftime("%Y-%m-%d"))

    # Load Supabase state
    sb_state = {}
    for ns in DEPLOYS:
        rows = sb_get(f"/approvals?namespace=eq.{ns}&select=item_id,status,note")
        if rows:
            for r in rows:
                sb_state[r["item_id"]] = r

    # Collect items from all deploys
    all_items = []
    for ns, deploy in DEPLOYS.items():
        items = get_items_for_date(ns, deploy, target, sb_state)
        all_items.extend(items)

    if args.json:
        print(json.dumps(all_items, ensure_ascii=False, indent=2))
        return

    if not all_items:
        print(f"Nenhum item encontrado para {target}")
        return

    # Generate HTML preview
    html = generate_html(all_items, target)
    tmp = tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w")
    tmp.write(html)
    tmp.close()

    print(f"Preview gerado: {tmp.name}")
    print(f"Items: {len(all_items)} ({sum(1 for i in all_items if i['publishable'])} aprovados)")
    print()

    # Print summary table
    print(f"{'ID':<40} {'Marca':<15} {'Status':<12} {'Data':<12} {'Hora':<6}")
    print("─" * 90)
    for item in all_items:
        status_icon = "✅" if item["publishable"] else "⏳" if item["status"] == "pending" else "❌"
        print(f"{item['id']:<40} {item['brand']:<15} {status_icon} {item['status']:<10} {item['scheduled']:<12} {item['hour']:<6}")

    print()
    approved = [i["id"] for i in all_items if i["publishable"]]
    print(f"IDs publicáveis: {','.join(approved) if approved else 'NENHUM'}")
    print()

    # Open in browser
    try:
        subprocess.Popen(["open", tmp.name])
    except Exception:
        print(f"Abre manualmente: {tmp.name}")


if __name__ == "__main__":
    main()
