/**
 * Modo de operacao do conector.
 *
 *  - "full":   registra todas as tools (WSL + filesystem + Windows quando disponivel).
 *  - "silent": registra so `connector_status`/`list_allowed_roots`. Usado quando o cliente
 *              ja tem terminal proprio (Claude Code CLI roda dentro do WSL e tem Bash) —
 *              evita gastar contexto quando o conector e carregado por um plugin.
 *
 * Decisao (em ordem):
 *  1. WSL_CONNECTOR_MODE=full|silent forca o modo.
 *  2. auto (default):
 *     a) processo rodando no Windows (win32) -> full. E o caso do Claude Desktop/Cowork
 *        subindo o conector via npx no Windows. O Cowork se identifica como "claude-code"
 *        no handshake, entao o nome do cliente NAO serve para separar Cowork de CLI —
 *        a plataforma serve: o CLI nunca roda no Windows nativo.
 *     b) Linux + clientInfo.name "claude-code" -> silent (Claude Code CLI no WSL).
 *     c) qualquer outro -> full.
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

export function decideMode({
  env = {},
  clientName = null,
  platform = process.platform,
} = {}) {
  const requested = normalizeMode(env.WSL_CONNECTOR_MODE);
  if (requested !== "auto") return requested;
  if (platform === "win32") return "full";
  return isCliClient(clientName) ? "silent" : "full";
}
