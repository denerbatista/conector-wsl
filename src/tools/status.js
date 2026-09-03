import { textResult } from "../util.js";

const IS_WINDOWS = process.platform === "win32";

export function registerStatusTools(server, ctx) {
  server.tool(
    "connector_status",
    "Mostra como o conector foi inicializado: modo (full/silent), cliente MCP, distro WSL, roots liberados e se o lado Windows (PowerShell) esta disponivel.",
    {},
    { readOnlyHint: true },
    async () =>
      textResult(
        JSON.stringify(
          {
            mode: ctx.runtime.mode,
            client: ctx.runtime.clientName,
            platform: process.platform,
            wslDistro: ctx.config.distro || null,
            linuxUser: ctx.config.linuxUser || null,
            windowsUser: ctx.config.windowsUser || null,
            defaultCwd: ctx.config.defaultCwd,
            allowedRoots: ctx.config.allowedRoots,
            timeoutMs: ctx.config.timeoutMs,
            maxOutputChars: ctx.config.maxOutputChars,
            maxFileChars: ctx.config.maxFileChars,
            filesystemMode: IS_WINDOWS ? "windows-mixed" : "native-linux",
            windowsTools: ctx.runtime.windows.available,
            powershell: ctx.runtime.windows.powershell,
            sessionCount: ctx.sessions.size,
            hint:
              ctx.runtime.mode === "silent"
                ? "Modo silent: cliente com terminal proprio (Claude Code). Tools de WSL/Windows nao registradas. Force com WSL_CONNECTOR_MODE=full se precisar."
                : undefined,
          },
          null,
          2,
        ),
      ),
  );

  server.tool(
    "list_allowed_roots",
    "Lista os diretorios liberados para terminal e filesystem (WSL e Windows).",
    {},
    { readOnlyHint: true },
    async () =>
      textResult(
        JSON.stringify({ allowedRoots: ctx.config.allowedRoots }, null, 2),
      ),
  );
}
