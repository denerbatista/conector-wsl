/**
 * Modo de operacao do conector.
 *
 *  - "full":   registra todas as tools (WSL + filesystem + Windows quando disponivel).
 *  - "silent": registra so `connector_status`. Usado quando o cliente ja tem terminal
 *              proprio (Claude Code roda dentro do WSL e tem Bash nativo) — evita gastar
 *              contexto com tools redundantes quando o conector e carregado por um plugin.
 *
 * Decisao (em ordem):
 *  1. WSL_CONNECTOR_MODE=full|silent forca o modo.
 *  2. WSL_CONNECTOR_MODE=auto (default): clientInfo.name do handshake MCP.
 *     "claude-code" -> silent; qualquer outro (Claude Desktop/Cowork, testes) -> full.
 */

export const MODES = Object.freeze(["auto", "full", "silent"]);

const CLI_CLIENT_RE = /^claude[-_ ]?code\b/i;

export function normalizeMode(value) {
  const v = String(value || "auto")
    .trim()
    .toLowerCase();
  return MODES.includes(v) ? v : "auto";
}

export function isCliClient(clientName) {
  return CLI_CLIENT_RE.test(String(clientName || "").trim());
}

export function decideMode({ env = {}, clientName = null } = {}) {
  const requested = normalizeMode(env.WSL_CONNECTOR_MODE);
  if (requested !== "auto") return requested;
  return isCliClient(clientName) ? "silent" : "full";
}
