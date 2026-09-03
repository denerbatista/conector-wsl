import { registerStatusTools } from "./status.js";
import { registerFilesystemTools } from "./filesystem.js";
import { registerTerminalTools } from "./terminal.js";
import { registerSessionTools } from "./sessions.js";
import { registerWindowsTools } from "./windows.js";
import { resolvePowerShell } from "../windows.js";
import { log } from "../log.js";

/**
 * Tools que existem em QUALQUER modo. Registradas antes do connect para o
 * servidor anunciar a capability `tools` — em modo silent sao as unicas.
 */
export function registerCoreTools(server, ctx) {
  registerStatusTools(server, ctx);
}

/**
 * Tools completas (modo full): WSL, filesystem e, quando o PowerShell estiver
 * acessivel (Windows nativo ou WSL com interop), o lado Windows.
 */
export function registerFullTools(server, ctx, { env = process.env } = {}) {
  registerFilesystemTools(server, ctx);
  registerTerminalTools(server, ctx);
  registerSessionTools(server, ctx);

  const powershell = resolvePowerShell({ env });
  ctx.runtime.windows = { available: Boolean(powershell), powershell };
  if (powershell) {
    registerWindowsTools(server, ctx);
  } else {
    log.info("windows.tools.skipped", {
      reason: "powershell nao encontrado (nem Windows nativo nem WSL interop)",
    });
  }
}

/** Compat: registra tudo de uma vez (usado por testes e integracoes antigas). */
export function registerAllTools(server, ctx, opts) {
  registerCoreTools(server, ctx);
  registerFullTools(server, ctx, opts);
}
