#!/usr/bin/env python3
"""
Deteta meses 100% aprovados e pede geração do mês seguinte.

Para cada deploy de aprovação (TB+TBU, Luiz):
  - se TODOS os items do mês corrente estão 'approved' no Supabase
  - e o mês seguinte ainda não tem items
  → escreve uma linha em $GITHUB_OUTPUT (gen_needed=1, gen_summary=...)
    para o workflow abrir uma Issue a pedir a geração.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""

import json
import os
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TZ = ZoneInfo("Europe/Lisbon")

DEPLOYS = {
    "cm-approval-tb-v1": ("public/aprovacao-tb-202605", "TechBody + TechBody U"),
    "cm-approval-luiz-v1": ("public/aprovacao-luiz-202605", "Luiz Santana"),
}

SB_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SB_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


def sb_get(path):
    req = urllib.request.Request(
        f"{SB_URL}/rest/v1{path}",
        headers={"apikey": SB_KEY, "Authorization": f"Bearer {SB_KEY}"},
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read())


def next_month(yyyymm):
    y, m = int(yyyymm[:4]), int(yyyymm[5:7])
    m += 1
    if m > 12:
        y, m = y + 1, 1
    return f"{y}-{m:02d}"


def main():
    now = datetime.now(TZ)
    cur = f"{now.year}-{now.month:02d}"
    needs = []

    for ns, (deploy, label) in DEPLOYS.items():
        items_path = os.path.join(ROOT, deploy, "data", "items.json")
        if not os.path.exists(items_path):
            continue
        items = json.load(open(items_path))
        cur_items = [i for i in items if i.get("month") == cur]
        nxt = next_month(cur)
        nxt_items = [i for i in items if i.get("month") == nxt]
        if not cur_items or nxt_items:
            print(f"{ns}: {len(cur_items)} items em {cur}, {len(nxt_items)} em {nxt} — nada a fazer")
            continue

        rows = sb_get(f"/approvals?namespace=eq.{ns}&select=item_id,status")
        state = {r["item_id"]: r["status"] for r in rows if ":" not in r["item_id"]}
        approved = [i for i in cur_items if state.get(i["id"]) == "approved"]
        print(f"{ns}: {len(approved)}/{len(cur_items)} aprovados em {cur}")
        if len(approved) == len(cur_items):
            brands = sorted({i["brand"] for i in cur_items})
            needs.append(f"{label} ({', '.join(brands)}): {cur} 100% aprovado → gerar {nxt}")

    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a") as f:
            f.write(f"gen_needed={'1' if needs else '0'}\n")
            f.write(f"gen_summary={' | '.join(needs)}\n")
    if needs:
        print("GERAÇÃO NECESSÁRIA:\n" + "\n".join(needs))
    else:
        print("Nenhum mês completo pendente de geração.")


if __name__ == "__main__":
    main()
