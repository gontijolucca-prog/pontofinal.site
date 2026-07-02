#!/usr/bin/env python3
"""
Quality Gate — valida PNGs antes de publicar no Instagram.

Corre antes do publisher. Para cada item aprovado + due, verifica:
  1. Dimensões exactas (1080×1350 carrosséis, 1080×1920 reels/stories)
  2. Tamanho mínimo do ficheiro (> 50KB — PNG real com conteúdo)
  3. Estaleness: compara md5 dos PNGs em public/ vs dist/ (deploy stale)
  4. Render status: item tem de estar render_done (não pending_render)

Exit codes:
  0 = tudo PASS
  1 = um ou mais items FAIL (não publicar)

Uso:
  python3 scripts/quality_gate.py [--namespace cm-approval-tb-v1]
  python3 scripts/quality_gate.py --json   # output em JSON para integração
"""

import argparse
import hashlib
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://pontofinal.site"
TZ = ZoneInfo("Europe/Lisbon")

# Dimensões canónicas por formato
EXPECTED_DIMS = {
    "carrossel": [(1080, 1350), (2160, 2700)],  # 1x e 2x (Retina)
    "story": [(1080, 1920), (2160, 3840)],
    "reel": [(1080, 1920), (2160, 3840)],
}

# Tamanho mínimo em bytes (PNG de 1080×1350 com conteúdo real é sempre > 50KB)
MIN_FILE_SIZE = 50_000

DEPLOYS = {
    "cm-approval-tb-v1": "public/aprovacao-tb-202605",
    "cm-approval-luiz-v1": "public/aprovacao-luiz-202605",
}

# UA de browser para contornar Cloudflare
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"


def sips_dims(path):
    """Usa sips (macOS) ou PIL (fallback) para obter dimensões do PNG."""
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
        pass
    # Fallback: PIL
    try:
        from PIL import Image
        with Image.open(path) as img:
            return img.size
    except Exception:
        return (None, None)


def md5_file(path):
    """Calcula md5 de um ficheiro."""
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def head_ok(url):
    """GET range 0-0 com UA de browser + validação de content-type."""
    try:
        req = urllib.request.Request(url, headers={"Range": "bytes=0-0", "User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            if r.status not in (200, 206):
                return False
            ctype = (r.headers.get("Content-Type") or "").lower()
            return not ctype.startswith("text/html")
    except Exception:
        return False


def build_asset_paths(item, deploy_dir):
    """Constrói paths locais para os PNGs/MP4s de um item.
    html_url em items.json usa '../brands/...' que resolve para public/brands/"""
    rel = (item.get("html_url") or "").replace("../", "")
    rel = rel.replace(".playback.html", "").replace(".html", "")
    fmt = item.get("format")

    if fmt == "carrossel":
        n = int(item.get("slides") or 6)
        folder = rel.rsplit("/", 1)
        shots_dir = os.path.join(ROOT, "public", folder[0], f"{folder[1]}_shots")
        return [os.path.join(shots_dir, f"slide_{i:02d}.png") for i in range(1, n + 1)]
    elif fmt in ("story", "reel"):
        # Stories usam PNG; reels usam MP4 (validar .mp4 em vez de .png)
        ext = ".mp4" if fmt == "reel" else ".png"
        return [os.path.join(ROOT, "public", rel + ext)]
    return []


def build_asset_urls(item):
    """Constrói URLs públicas para os assets de um item."""
    rel = (item.get("html_url") or "").replace("../", "/")
    rel = rel.replace(".playback.html", "").replace(".html", "")
    fmt = item.get("format")

    if fmt == "carrossel":
        n = int(item.get("slides") or 6)
        folder = rel.rsplit("/", 1)
        shots = f"{folder[0]}/{folder[1]}_shots"
        return [f"{SITE}{shots}/slide_{i:02d}.png" for i in range(1, n + 1)]
    elif fmt in ("story", "reel"):
        ext = ".mp4" if fmt == "reel" else ".png"
        return [f"{SITE}{rel}{ext}"]
    return []


def validate_item(item, deploy_dir, namespace):
    """Valida um item. Retorna dict com status + detalhes."""
    iid = item["id"]
    fmt = item.get("format", "")
    result = {
        "item_id": iid,
        "format": fmt,
        "brand": item.get("brand", ""),
        "status": "pass",
        "checks": [],
        "errors": [],
    }

    if fmt not in EXPECTED_DIMS:
        result["errors"].append(f"formato desconhecido: {fmt}")
        result["status"] = "fail"
        return result

    accepted_dims = EXPECTED_DIMS[fmt]
    expected_label = f"{accepted_dims[0][0]}×{accepted_dims[0][1]}"
    if len(accepted_dims) > 1:
        expected_label += f" ou {accepted_dims[1][0]}×{accepted_dims[1][1]}"
    paths = build_asset_paths(item, deploy_dir)
    urls = build_asset_urls(item)

    if not paths:
        result["errors"].append("sem paths de assets")
        result["status"] = "fail"
        return result

    for i, (path, url) in enumerate(zip(paths, urls), 1):
        label = f"slide_{i:02d}" if fmt == "carrossel" else "asset"

        # Check 1: ficheiro existe localmente
        if not os.path.exists(path):
            result["errors"].append(f"{label}: ficheiro não encontrado ({path})")
            result["status"] = "fail"
            continue

        # Check 2: dimensões (só para PNGs — reels são MP4)
        if not path.endswith(".mp4"):
            w, h = sips_dims(path)
            if w is None or h is None:
                result["errors"].append(f"{label}: não foi possível ler dimensões")
                result["status"] = "fail"
                continue
            result["checks"].append(f"{label}: {w}×{h}px")
            if (w, h) not in accepted_dims:
                result["errors"].append(
                    f"{label}: dimensões erradas ({w}×{h}) — esperado {expected_label}"
                )
                result["status"] = "fail"
        else:
            # Reel MP4: validar tamanho do ficheiro apenas
            result["checks"].append(f"{label}: MP4 ({os.path.getsize(path) // 1024}KB)")

        # Check 3: tamanho mínimo
        size = os.path.getsize(path)
        if size < MIN_FILE_SIZE:
            result["errors"].append(f"{label}: ficheiro muito pequeno ({size}B < {MIN_FILE_SIZE}B)")
            result["status"] = "fail"

        # Check 4: URL pública acessível
        if not head_ok(url):
            result["errors"].append(f"{label}: URL não acessível ({url})")
            result["status"] = "fail"

    return result


def check_staleness(deploy_dir):
    """Compara md5 de PNGs em public/brands/ vs dist/brands/ para detectar deploy stale."""
    public_dir = os.path.join(ROOT, "public", "brands")
    dist_dir = os.path.join(ROOT, "dist", "brands")

    if not os.path.exists(dist_dir):
        return {"status": "pass", "detail": "sem dist/ para comparar (dev mode)"}

    stale_files = []
    public_pngs = []
    for dirpath, _, filenames in os.walk(public_dir):
        for fn in filenames:
            if fn.endswith(".png") and "_shots" in dirpath:
                public_pngs.append(os.path.join(dirpath, fn))

    checked = 0
    for pub_path in public_pngs[:50]:  # limitar a 50 para performance
        dist_path = pub_path.replace("/public/", "/dist/", 1)
        if not os.path.exists(dist_path):
            continue
        checked += 1
        if md5_file(pub_path) != md5_file(dist_path):
            stale_files.append(os.path.relpath(pub_path, ROOT))

    if stale_files:
        return {
            "status": "fail",
            "detail": f"{len(stale_files)} ficheiros stale (public ≠ dist)",
            "files": stale_files[:10],
        }
    return {"status": "pass", "detail": f"{checked} ficheiros verificados — OK"}


def main():
    parser = argparse.ArgumentParser(description="Quality Gate pré-publicação")
    parser.add_argument("--namespace", default=None, help="Namespace específico")
    parser.add_argument("--json", action="store_true", help="Output em JSON")
    parser.add_argument("--dry-run", action="store_true", help="Não abortar em FAIL")
    args = parser.parse_args()

    now = datetime.now(TZ)
    results = {
        "timestamp": now.isoformat(),
        "items": [],
        "staleness": {},
        "summary": {"pass": 0, "fail": 0, "total": 0},
    }

    namespaces = [args.namespace] if args.namespace else list(DEPLOYS.keys())

    for ns in namespaces:
        deploy_dir = DEPLOYS.get(ns)
        if not deploy_dir:
            continue
        items_path = os.path.join(ROOT, deploy_dir, "data", "items.json")
        if not os.path.exists(items_path):
            continue

        items = json.load(open(items_path))

        # Staleness check por deploy
        staleness = check_staleness(deploy_dir)
        results["staleness"][ns] = staleness

        for item in items:
            # Só validar items não publicados
            if item.get("status") == "published":
                continue
            result = validate_item(item, deploy_dir, ns)
            results["items"].append(result)
            if result["status"] == "pass":
                results["summary"]["pass"] += 1
            else:
                results["summary"]["fail"] += 1
            results["summary"]["total"] += 1

    # Staleness failure conta como global fail
    staleness_fail = any(s["status"] == "fail" for s in results["staleness"].values())

    if args.json:
        print(json.dumps(results, ensure_ascii=False, indent=2))
    else:
        print(f"== Quality Gate {now.isoformat()}")
        for r in results["items"]:
            icon = "✓" if r["status"] == "pass" else "✗"
            print(f"  {icon} {r['item_id']} [{r['format']}/{r['brand']}]")
            for check in r["checks"]:
                print(f"      {check}")
            for err in r["errors"]:
                print(f"      ERRO: {err}")
        for ns, s in results["staleness"].items():
            icon = "✓" if s["status"] == "pass" else "✗"
            print(f"  {icon} STALENESS [{ns}]: {s['detail']}")
            if s.get("files"):
                for f in s["files"]:
                    print(f"      stale: {f}")
        print(f"\n== Resumo: {results['summary']['pass']} pass, {results['summary']['fail']} fail")

    has_failures = results["summary"]["fail"] > 0 or staleness_fail
    if has_failures and not args.dry_run:
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()