#!/usr/bin/env bash
#
# bot-ctl.sh — Control panel CLI for the PontoFinal IG bot.
#
# Quick controls without going to Supabase UI. Reads service_role key from
# ~/.config/credentials/supabase-content-machine.env.
#
# Usage:
#   ./bot-ctl.sh status                    # show current config + counts
#   ./bot-ctl.sh enable                    # master switch ON (still respects shadow)
#   ./bot-ctl.sh disable                   # master switch OFF
#   ./bot-ctl.sh shadow on|off             # toggle shadow mode
#   ./bot-ctl.sh allow <sender_id>         # add to allowlist
#   ./bot-ctl.sh deny <sender_id>          # add to blocklist
#   ./bot-ctl.sh clear-allow               # empty allowlist (= responde a todos não-bloqueados)
#   ./bot-ctl.sh cap <N>                   # daily message cap
#   ./bot-ctl.sh conversas                 # last 20 conversations dashboard
#   ./bot-ctl.sh ler <sender_id>           # dump full conversation
set -euo pipefail

source ~/.config/credentials/supabase-content-machine.env

API="$SUPABASE_URL/rest/v1"
HDR=(-H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
JSON=(-H "Content-Type: application/json" -H "Prefer: return=representation")

cmd=${1:-status}
shift || true

case "$cmd" in
  status)
    echo "=== Config ==="
    curl -s "${HDR[@]}" "$API/ig_bot_config?select=*" | python3 -m json.tool
    echo "=== Hoje ==="
    curl -s "${HDR[@]}" "$API/ig_bot_daily_count?day=eq.$(date +%F)" | python3 -m json.tool
    ;;
  enable)
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" -d '{"enabled":true}' | python3 -m json.tool
    ;;
  disable)
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" -d '{"enabled":false}' | python3 -m json.tool
    ;;
  shadow)
    [ "${1:-}" ] || { echo "usage: shadow on|off"; exit 1; }
    val=$([ "$1" = "on" ] && echo true || echo false)
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" -d "{\"shadow_mode\":$val}" | python3 -m json.tool
    ;;
  allow)
    [ "${1:-}" ] || { echo "usage: allow <sender_id>"; exit 1; }
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" \
      -d "{\"allowlist_senders\":[\"$1\"]}" | python3 -m json.tool
    echo "ℹ️  Allowlist substituída (não é append). Para múltiplos, edita no Supabase UI."
    ;;
  deny)
    [ "${1:-}" ] || { echo "usage: deny <sender_id>"; exit 1; }
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" \
      -d "{\"blocklist_senders\":[\"$1\"]}" | python3 -m json.tool
    ;;
  clear-allow)
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" -d '{"allowlist_senders":[]}' | python3 -m json.tool
    ;;
  cap)
    [ "${1:-}" ] || { echo "usage: cap <N>"; exit 1; }
    curl -s "${HDR[@]}" "${JSON[@]}" -X PATCH "$API/ig_bot_config?id=eq.1" -d "{\"daily_msg_cap\":$1}" | python3 -m json.tool
    ;;
  conversas)
    curl -s "${HDR[@]}" "$API/ig_dashboard?limit=20" | python3 -m json.tool
    ;;
  ler)
    [ "${1:-}" ] || { echo "usage: ler <sender_id>"; exit 1; }
    curl -s "${HDR[@]}" "$API/ig_messages?sender_id=eq.$1&order=created_at.asc&select=created_at,role,content" \
      | python3 -c "
import sys, json
for m in json.load(sys.stdin):
    role = '👤' if m['role']=='user' else ('🤖' if m['role']=='assistant' else '·')
    print(f\"{m['created_at'][:19]} {role}  {m['content']}\")"
    ;;
  *)
    echo "Comandos: status, enable, disable, shadow on|off, allow <id>, deny <id>, clear-allow, cap <N>, conversas, ler <id>"
    exit 1
    ;;
esac
