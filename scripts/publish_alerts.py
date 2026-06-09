#!/usr/bin/env python3
"""
Entrega os alertas do techbody_publisher.py (publish_alerts.json).

Para cada alerta: GitHub issue deduplicada (1 issue aberta por item+tipo).
Para o run: 1 email digest via Resend.

Best-effort: falha na entrega imprime aviso mas sai 0 — o alerta principal
fica sempre nos logs do publisher e no publish_queue.

Env: GH_TOKEN, GITHUB_REPOSITORY, RESEND_API_KEY (opcional), ALERT_EMAIL_TO (opcional)
"""

import json
import os
import subprocess
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALERTS_PATH = os.path.join(ROOT, "publish_alerts.json")

GH_TOKEN = os.environ.get("GH_TOKEN", "")
REPO = os.environ.get("GITHUB_REPOSITORY", "")
RESEND_KEY = os.environ.get("RESEND_API_KEY", "")
EMAIL_TO = os.environ.get("ALERT_EMAIL_TO", "pontofinalsite@gmail.com")

TYPE_LABEL = {
    "publish_error": "falha de publicação",
    "uncertain_publish": "publicação INCERTA (verificar IG)",
    "stuck_publishing": "claim preso em 'publishing'",
    "skipped_no_token": "saltado por falta de token",
    "ledger_update_failed": "publicado mas ledger desatualizado",
}


def gh_api(path, body=None):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        data=json.dumps(body).encode() if body else None,
        method="POST" if body else "GET",
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())


def open_issue_deduped(title, body, existing_titles):
    if title in existing_titles:
        print(f"issue já aberta, não duplico: {title}")
        return
    resp = gh_api(f"/repos/{REPO}/issues", {"title": title, "body": body, "labels": ["publisher-alert"]})
    print(f"issue criada: {resp.get('html_url')}")


def send_email_digest(alerts):
    if not RESEND_KEY:
        print("RESEND_API_KEY ausente — email saltado")
        return
    lines = [f"- [{TYPE_LABEL.get(a['type'], a['type'])}] {a.get('item_id', '?')}: {a.get('detail', '')}" for a in alerts]
    payload = {
        "from": "Publisher PontoFinal <onboarding@resend.dev>",
        "to": [EMAIL_TO],
        "subject": f"⚠️ Publisher TechBody: {len(alerts)} alerta(s)",
        "text": "Alertas do último run do publisher:\n\n" + "\n".join(lines)
        + f"\n\nLedger: Supabase publish_queue · Logs: github.com/{REPO}/actions",
    }
    # api.resend.com está atrás de Cloudflare — urllib leva 1010; usar curl
    r = subprocess.run(
        ["curl", "-sS", "-X", "POST", "https://api.resend.com/emails",
         "-H", f"Authorization: Bearer {RESEND_KEY}",
         "-H", "Content-Type: application/json",
         "-d", json.dumps(payload)],
        capture_output=True, text=True, timeout=30,
    )
    print(f"email: {r.stdout.strip() or r.stderr.strip()}")


def main():
    if not os.path.exists(ALERTS_PATH):
        print("sem alertas")
        return
    alerts = json.load(open(ALERTS_PATH))
    if not alerts:
        print("sem alertas")
        return

    print(f"{len(alerts)} alerta(s) para entregar")

    existing_titles = set()
    if GH_TOKEN and REPO:
        try:
            issues = gh_api(f"/repos/{REPO}/issues?state=open&per_page=100")
            existing_titles = {i["title"] for i in issues}
        except Exception as e:
            print(f"AVISO: não consegui listar issues ({e})")
        for a in alerts:
            title = f"⚠️ Publisher: {TYPE_LABEL.get(a['type'], a['type'])} — {a.get('item_id', '?')}"
            body = (f"**Tipo:** {a['type']}\n**Item:** `{a.get('item_id', '?')}`"
                    f"\n**Marca:** {a.get('brand', '—')}\n\n{a.get('detail', '')}"
                    f"\n\n_Aberto automaticamente pelo publisher. Fechar depois de resolver no Supabase/Instagram._")
            try:
                open_issue_deduped(title, body, existing_titles)
            except Exception as e:
                print(f"AVISO: issue falhou ({e})")
    else:
        print("GH_TOKEN/GITHUB_REPOSITORY ausentes — issues saltadas")

    try:
        send_email_digest(alerts)
    except Exception as e:
        print(f"AVISO: email falhou ({e})")


if __name__ == "__main__":
    main()
