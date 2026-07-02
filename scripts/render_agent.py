#!/usr/bin/env python3
"""
render_agent.py — Render Agent local para gerar PNGs a partir de HTML + overrides.

Recebe um item_id, carrega o HTML, aplica overrides de texto, e renderiza
cada slide como PNG nas dimensões canónicas (1080×1350 carrosséis, 1080×1920
reels/stories). Valida as dimensões e marca o item como render_done no
Supabase.

Uso:
  python3 scripts/render_agent.py --item-id techbody-2026-07-c01 --format carrossel --slides 6
  python3 scripts/render_agent.py --item-id techbody-2026-07-c01 --json

Requer:
  - Playwright instalado (pip install playwright && playwright install chromium)
  - Variáveis de ambiente SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from zoneinfo import ZoneInfo
import urllib.request
import urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://pontofinal.site"
TZ = ZoneInfo("Europe/Lisbon")
GRAPH = "https://graph.instagram.com/v23.0"

EXPECTED_DIMS = {
    "carrossel": (1080, 1350),
    "story": (1080, 1920),
    "reel": (1080, 1920),
}

DEPLOYS = {
    "cm-approval-tb-v1": "public/aprovacao-tb-202605",
    "cm-approval-luiz-v1": "public/aprovacao-luiz-202605",
}


def sips_dims(path):
    try:
        out = subprocess.check_output(
            ["sips", "-g", "pixelWidth", "-g", "pixelHeight", path],
            stderr=subprocess.DEVNULL, timeout=10
        ).decode()
        w = h = None
        for line in out.strip().split("\n"):
            if "pixelWidth" in line:
                w = int(line.split(":")[-1].strip())
            elif "pixelHeight" in line:
                h = int(line.split(":")[-1].strip())
        return (w, h) if w and h else (None, None)
    except Exception:
        return (None, None)


def find_item(item_id):
    """Encontra um item nos items.json de todos os deploys."""
    for ns, deploy in DEPLOYS.items():
        items_path = os.path.join(ROOT, deploy, "data", "items.json")
        if not os.path.exists(items_path):
            continue
        items = json.load(open(items_path))
        for item in items:
            if item.get("id") == item_id:
                return item, ns, deploy
    return None, None, None


def get_overrides_from_supabase(item_id, namespace):
    """Busca overrides de texto do Supabase."""
    sb_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        return {}

    try:
        url = f"{sb_url}/rest/v1/approvals?namespace=eq.{namespace}&item_id=like.{item_id}*&select=item_id,note"
        req = urllib.request.Request(url, headers={
            "apikey": sb_key,
            "Authorization": f"Bearer {sb_key}",
        })
        with urllib.request.urlopen(req, timeout=15) as r:
            rows = json.loads(r.read().decode())

        overrides = {"slide_texts": {}, "caption": ""}
        for row in rows:
            iid = row.get("item_id", "")
            note = row.get("note", "")
            # Decodificar note JSON
            if note and note.strip().startswith("{"):
                try:
                    note = json.loads(note).get("t", note)
                except Exception:
                    pass

            # slide copy: item_id#slideN:copy
            if "#slide" in iid and ":copy" in iid:
                import re
                m = re.match(r".*#slide(\d+):copy$", iid)
                if m:
                    overrides["slide_texts"][int(m.group(1))] = note
            # caption copy: item_id:caption:copy
            elif iid.endswith(":caption:copy"):
                overrides["caption"] = note

        return overrides
    except Exception as e:
        print(f"  AVISO: não foi possível buscar overrides do Supabase: {e}")
        return {}


def mark_render_status(item_id, namespace, status, detail=""):
    """Marca o status de render no Supabase."""
    sb_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        print(f"  AVISO: não foi possível marcar render_status no Supabase (sem credenciais)")
        return

    try:
        row = {
            "namespace": namespace,
            "item_id": f"{item_id}:render_status",
            "status": "pending",
            "note": json.dumps({"render": status, "detail": detail,
                                "timestamp": datetime.now(TZ).isoformat()}),
            "updated_at": datetime.now(TZ).isoformat(),
        }
        data = json.dumps(row).encode()
        req = urllib.request.Request(
            f"{sb_url}/rest/v1/approvals?on_conflict=namespace,item_id",
            data=data,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": sb_key,
                "Authorization": f"Bearer {sb_key}",
                "Prefer": "resolution=merge-duplicates",
            }
        )
        urllib.request.urlopen(req, timeout=15)
    except Exception as e:
        print(f"  AVISO: não foi possível marcar render_status: {e}")


def render_with_playwright(html_path, output_dir, format, n_slides, overrides):
    """Renderiza PNGs usando Playwright."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  ERRO: Playwright não instalado. Instalar com:")
        print("    pip install playwright && playwright install chromium")
        return False

    expected = EXPECTED_DIMS.get(format, (1080, 1350))
    w, h = expected

    os.makedirs(output_dir, exist_ok=True)

    html_url = f"file://{os.path.abspath(html_path)}"

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport={"width": w, "height": h},
            device_scale_factor=1,
        )
        page = context.new_page()

        # Navegar para o HTML
        page.goto(html_url, wait_until="networkidle", timeout=30000)

        # Aplicar overrides de texto
        for slide_n, text in overrides.get("slide_texts", {}).items():
            try:
                # Tentar navegar para o slide
                page.evaluate(f"window.location.hash = '#slide-{slide_n}'")
                time.sleep(0.5)
                # Substituir o texto do h1
                page.evaluate(f"""
                    const h1 = document.querySelector('.slide:nth-child({slide_n}) h1, [data-slide="{slide_n}"] h1');
                    if (h1) h1.textContent = {json.dumps(text)};
                """)
                time.sleep(0.2)
            except Exception as e:
                print(f"  AVISO: não foi possível aplicar override ao slide {slide_n}: {e}")

        # Renderizar cada slide
        success = True
        for i in range(1, n_slides + 1):
            try:
                # Navegar para o slide
                page.evaluate(f"window.location.hash = '#slide-{i}'")
                time.sleep(0.3)

                output_path = os.path.join(output_dir, f"slide_{i:02d}.png")
                # Screenshot do viewport (não full page — queremos exactamente 1080×1350)
                page.screenshot(path=output_path, type="png", clip={"x": 0, "y": 0, "width": w, "height": h})

                # Validar dimensões
                actual = sips_dims(output_path)
                if actual[0] != w or actual[1] != h:
                    print(f"  ✗ slide_{i:02d}: dimensões erradas ({actual[0]}×{actual[1]} vs {w}×{h})")
                    success = False
                else:
                    print(f"  ✓ slide_{i:02d}: {w}×{h}px")

            except Exception as e:
                print(f"  ✗ slide_{i:02d}: erro no render ({e})")
                success = False

        browser.close()
        return success


def main():
    parser = argparse.ArgumentParser(description="Render Agent — gerar PNGs a partir de HTML + overrides")
    parser.add_argument("--item-id", required=True, help="ID do item a renderizar")
    parser.add_argument("--format", default=None, help="Formato (carrossel/story/reel)")
    parser.add_argument("--slides", type=int, default=None, help="Número de slides")
    parser.add_argument("--json", action="store_true", help="Output em JSON")
    args = parser.parse_args()

    # Encontrar o item
    item, namespace, deploy = find_item(args.item_id)
    if not item:
        msg = f"Item {args.item_id} não encontrado em nenhum deploy"
        if args.json:
            print(json.dumps({"status": "error", "detail": msg}))
        else:
            print(f"ERRO: {msg}")
        sys.exit(1)

    fmt = args.format or item.get("format", "carrossel")
    n_slides = args.slides or item.get("slides", 6 if fmt == "carrossel" else 1)

    # Determinar paths
    html_rel = (item.get("html_url") or "").replace("../", "")
    html_path = os.path.join(ROOT, deploy, html_rel)

    # Construir output dir
    base = html_rel.replace(".html", "").replace(".playback.html", "")
    if fmt == "carrossel":
        parts = base.rsplit("/", 1)
        output_dir = os.path.join(ROOT, deploy, "brands", parts[0], f"{parts[1]}_shots")
    else:
        output_dir = os.path.join(ROOT, deploy, "brands", base.rsplit("/", 1)[0])

    # Buscar overrides do Supabase
    overrides = get_overrides_from_supabase(args.item_id, namespace)

    # Marcar como pending_render
    mark_render_status(args.item_id, namespace, "pending", "render_agent iniciado")

    if not os.path.exists(html_path):
        msg = f"HTML não encontrado: {html_path}"
        mark_render_status(args.item_id, namespace, "error", msg)
        if args.json:
            print(json.dumps({"status": "render_error", "detail": msg}))
        else:
            print(f"ERRO: {msg}")
        sys.exit(1)

    print(f"== Render Agent: {args.item_id} [{fmt}]")
    print(f"  HTML: {html_path}")
    print(f"  Output: {output_dir}")
    print(f"  Slides: {n_slides}")
    print(f"  Overrides: {len(overrides.get('slide_texts', {}))} textos, caption={'sim' if overrides.get('caption') else 'não'}")
    print()

    # Renderizar
    success = render_with_playwright(html_path, output_dir, fmt, n_slides, overrides)

    if success:
        mark_render_status(args.item_id, namespace, "done", f"{n_slides} PNGs renderizados com sucesso")
        result = {"status": "render_done", "detail": f"{n_slides} PNGs renderizados", "output_dir": output_dir}
        print(f"\n✓ Render completo: {n_slides} PNGs em {output_dir}")
    else:
        mark_render_status(args.item_id, namespace, "error", "alguns slides falharam")
        result = {"status": "render_error", "detail": "alguns slides falharam a validação"}
        print(f"\n✗ Render com erros — verificar output acima")

    if args.json:
        print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()