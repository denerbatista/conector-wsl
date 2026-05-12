#!/usr/bin/env bash
# Empacota o conector como .mcpb com node_modules apenas de prod deps.
# Estrategia:
#  1. Faz copia (hardlink) do node_modules em /tmp para preservar mcpb.
#  2. npm prune --omit=dev no projeto (node_modules fica enxuto).
#  3. Executa mcpb pack usando o cli copiado em /tmp (que ainda tem deps).
#  4. Restaura devDependencies com npm install.
#
# Funciona em Linux/macOS/WSL. Em Windows nativo, prefira rodar via WSL.

set -euo pipefail

PROJ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJ"

if [[ ! -d node_modules/@anthropic-ai/mcpb ]]; then
  echo "[pack] mcpb nao encontrado. Rode 'npm install' primeiro." >&2
  exit 1
fi

TMP="$(mktemp -d -t mcpb-pack-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "[pack] Snapshotting node_modules em $TMP ..."
# cp -al usa hardlinks (instantaneo). Fallback para cp -R se -al nao funciona.
cp -al node_modules "$TMP/node_modules" 2>/dev/null || cp -R node_modules "$TMP/node_modules"

echo "[pack] Removendo devDependencies do projeto..."
npm prune --omit=dev --no-audit --no-fund >/dev/null 2>&1

echo "[pack] Tamanho atual do node_modules de prod:"
du -sh node_modules

echo "[pack] Limpando .mcpb antigos..."
rm -f ./*.mcpb

echo "[pack] Empacotando..."
node "$TMP/node_modules/@anthropic-ai/mcpb/dist/cli/cli.js" pack

echo "[pack] Restaurando devDependencies..."
npm install --no-audit --no-fund >/dev/null 2>&1

echo "[pack] Pronto."
ls -lh ./*.mcpb
