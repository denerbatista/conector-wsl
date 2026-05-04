#!/usr/bin/env bash
# Garante Node.js >= 20 dentro do WSL e instala dependencias do projeto.
# Funciona em Ubuntu, Debian, Fedora, Alpine, Arch, openSUSE.
set -euo pipefail

REQUIRED=20
NVM_VERSION="v0.40.1"

say() { printf '[setup] %s\n' "$*"; }
die() { printf '[fail] %s\n' "$*" >&2; exit 1; }

PROJECT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ -f "$PROJECT/package.json" ]] || die "package.json nao encontrado em $PROJECT"

sudo_run() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then "$@"
  elif command -v sudo >/dev/null; then sudo "$@"
  else die "precisa de sudo para: $*"; fi
}

login_node_major() {
  local v; v="$(bash -lc 'node -v 2>/dev/null || true')"
  [[ -n "$v" ]] || { echo 0; return; }
  echo "$v" | sed -E 's/^v?([0-9]+).*/\1/'
}

has_node20() { (( $(login_node_major) >= REQUIRED )); }

# Carrega nvm/fnm se ja existirem
[[ -s "$HOME/.nvm/nvm.sh" ]] && . "$HOME/.nvm/nvm.sh"
command -v fnm >/dev/null && eval "$(fnm env --use-on-cd 2>/dev/null || true)"

if has_node20; then
  say "Node $(bash -lc 'node -v') ja ok."
else
  say "Instalando Node $REQUIRED..."
  if   command -v apt-get >/dev/null; then
    sudo_run apt-get update -y
    sudo_run apt-get install -y curl ca-certificates
    curl -fsSL "https://deb.nodesource.com/setup_${REQUIRED}.x" | sudo_run -E bash - && sudo_run apt-get install -y nodejs || true
  elif command -v dnf >/dev/null; then
    sudo_run dnf install -y curl ca-certificates
    curl -fsSL "https://rpm.nodesource.com/setup_${REQUIRED}.x" | sudo_run bash - && sudo_run dnf install -y nodejs || true
  elif command -v zypper >/dev/null; then sudo_run zypper -n install -y "nodejs${REQUIRED}" "npm${REQUIRED}" || true
  elif command -v pacman >/dev/null; then sudo_run pacman -Sy --noconfirm nodejs npm || true
  elif command -v apk    >/dev/null; then sudo_run apk add --no-cache nodejs npm || true
  fi

  if ! has_node20; then
    say "Fallback: instalando nvm + Node $REQUIRED..."
    command -v curl >/dev/null || die "curl ausente. Instale curl e rode de novo."
    curl -fsSL "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" | bash
    . "$HOME/.nvm/nvm.sh"
    nvm install "$REQUIRED" && nvm alias default "$REQUIRED"
    grep -q NVM_DIR "$HOME/.profile" 2>/dev/null || cat >> "$HOME/.profile" <<'EOF'
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
EOF
  fi
fi

# Garante que login shell veja node (symlink se necessario)
if ! has_node20; then
  NODE_BIN="$(bash -ic 'command -v node' 2>/dev/null || command -v node || true)"
  [[ -n "$NODE_BIN" ]] && sudo_run ln -sf "$NODE_BIN" /usr/local/bin/node
  command -v npm >/dev/null && sudo_run ln -sf "$(command -v npm)" /usr/local/bin/npm || true
fi

has_node20 || die "Node $REQUIRED nao ficou disponivel em login shell."

say "Instalando dependencias..."
bash -lc "cd '$PROJECT' && npm install --no-audit --no-fund"

bash -lc "node --check '$PROJECT/server/index.js'" && say "OK: $(bash -lc 'node -v') em $(bash -lc 'command -v node')"
