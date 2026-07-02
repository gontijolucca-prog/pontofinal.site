#!/bin/bash
# publish_safe.sh — orquestra publicação segura com quality gate + confirmação humana.
#
# FLUXO:
#   1. Corre quality_gate.py (valida dimensões, estaleness, acessibilidade)
#   2. Corre dry-run do publisher (mostra o plano)
#   3. Pede confirmação humana (y/n)
#   4. Só se "y" → publica a sério
#
# NUNCA publica sem confirmação humana explícita.
# NUNCA publica se o quality_gate falhar.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"
GH_REPO="gontijolucca-prog/pontofinal.site"

echo "═══════════════════════════════════════════════════════════════"
echo "  PUBLICAÇÃO SEGURA — Quality Gate + Confirmação Humana"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# ── 1. QUALITY GATE ──────────────────────────────────────────────────────
echo "▶ Passo 1: Quality Gate (validar PNGs)..."
echo ""
python3 "$SCRIPTS/quality_gate.py"
QG_EXIT=$?
echo ""

if [ $QG_EXIT -ne 0 ]; then
    echo "✗ QUALITY GATE FALHOU"
    echo "  Corrigir os problemas acima antes de tentar publicar."
    echo "  Para ver detalhes em JSON: python3 scripts/quality_gate.py --json"
    exit 1
fi

echo "✓ Quality Gate passou."
echo ""

# ── 2. DRY-RUN ───────────────────────────────────────────────────────────
echo "▶ Passo 2: Dry-run (mostrar plano de publicação)..."
echo ""

# Verificar se gh CLI está disponível
if ! command -v gh &>/dev/null; then
    echo "✗ gh CLI não encontrado. Instalar: brew install gh"
    exit 1
fi

# Disparar workflow em dry-run
gh workflow run techbody-publish.yml \
    --repo "$GH_REPO" \
    -f dry_run=1

echo "  Workflow disparado em dry-run. Aguardando conclusão..."
echo ""

# Aguardar o run aparecer
sleep 5

# Obter o último run do workflow
RUN_ID=$(gh run list \
    --repo "$GH_REPO" \
    --workflow techbody-publish.yml \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId')

if [ -z "$RUN_ID" ]; then
    echo "⚠ Não foi possível obter o ID do run. Verifica manualmente:"
    echo "  https://github.com/$GH_REPO/actions/workflows/techbody-publish.yml"
    exit 1
fi

echo "  Run #$RUN_ID — a acompanhar..."
echo ""

# Acompanhar o run (mostra output em tempo real)
gh run watch "$RUN_ID" --repo "$GH_REPO" --exit-status || true

# Mostrar logs do passo de publicação
echo ""
echo "▶ Log do dry-run:"
echo "───────────────────────────────────────────────────────────────"
gh run view "$RUN_ID" --repo "$GH_REPO" --log 2>/dev/null | grep -E "(DUE|SKIP|OK|ERRO|ABORT|BLOCKED|quality_gate|fim:)" || echo "(sem output relevante)"
echo "───────────────────────────────────────────────────────────────"
echo ""

# ── 3. CONFIRMAÇÃO HUMANA ────────────────────────────────────────────────
echo "▶ Passo 3: Confirmação humana"
echo ""
echo "  ⚠ ATENÇÃO: Se confirmares, os items acima serão PUBLICADOS no Instagram."
echo "  Verifica o plano cuidadosamente."
echo ""

# Notificação no macOS
if command -v osascript &>/dev/null; then
    osascript -e 'display notification "Confirma na terminal: y/n" with title "📤 Publicação Instagram" sound name "Glass"' 2>/dev/null || true
fi

read -p "  Confirmar publicação? [y/N] " CONFIRM
echo ""

if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
    echo "✗ Publicação cancelada."
    exit 0
fi

# ── 4. PUBLICAR A SÉRIO ──────────────────────────────────────────────────
echo "▶ Passo 4: A publicar..."
echo ""

gh workflow run techbody-publish.yml \
    --repo "$GH_REPO" \
    -f dry_run=0

echo "  Workflow de publicação disparado."
sleep 5

PUB_RUN_ID=$(gh run list \
    --repo "$GH_REPO" \
    --workflow techbody-publish.yml \
    --limit 1 \
    --json databaseId \
    --jq '.[0].databaseId')

echo "  Run #$PUB_RUN_ID — a acompanhar publicação..."
echo ""

gh run watch "$PUB_RUN_ID" --repo "$GH_REPO" --exit-status || true

echo ""
echo "▶ Log de publicação:"
echo "───────────────────────────────────────────────────────────────"
gh run view "$PUB_RUN_ID" --repo "$GH_REPO" --log 2>/dev/null | grep -E "(DUE|SKIP|OK|ERRO|ABORT|BLOCKED|quality_gate|verificado|MISMATCH|fim:)" || echo "(sem output relevante)"
echo "───────────────────────────────────────────────────────────────"
echo ""
echo "✓ Publicação concluída. Verifica o Instagram para confirmar."