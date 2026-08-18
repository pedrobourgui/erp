#!/usr/bin/env bash
#
# Barreira de dívida visível (lote 10.5).
#
# `// TODO: integrate with API` e `MOCK_` não são anotações inofensivas: eram a
# tela de Configurações dizendo "Salvar Alterações" sem disparar requisição
# nenhuma (FN-07) e três usuários inventados respondendo "quem tem acesso a
# este sistema?" (FN-08). Uma tela que mente é pior que uma que falta.
#
# Falha o build se qualquer um dos dois reaparecer em código de tela.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGETS=("$ROOT/apps/web/app" "$ROOT/apps/web/components")

status=0

report() {
  local label="$1"
  local pattern="$2"
  local hits

  # `|| true`: grep sai com 1 quando não acha nada, que é o caso feliz aqui.
  hits="$(grep -rnE "$pattern" "${TARGETS[@]}" \
    --include='*.ts' --include='*.tsx' \
    2>/dev/null || true)"

  if [ -n "$hits" ]; then
    echo "✗ $label encontrado em código de tela:"
    echo "$hits" | sed 's/^/    /'
    status=1
  else
    echo "✓ nenhum $label em código de tela"
  fi
}

report "TODO: integrate with API" 'TODO: ?integrate'
report "dado mock (MOCK_)" '\bMOCK_[A-Z_]+'

exit "$status"
