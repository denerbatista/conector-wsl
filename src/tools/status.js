import { textResult } from "../util.js";

const IS_WINDOWS = process.platform === "win32";

export function registerStatusTools(server, ctx) {
  server.tool(
    "connector_status",
    "Mostra como o conector foi inicializado, com terminal e filesystem do WSL.",
    {},
    { readOnlyHint: true },
    async () =>
      textResult(
        JSON.stringify(
          {
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
            sessionCount: ctx.sessions.size,
          },
          null,
          2,
        ),
      ),
  );

  server.tool(
    "list_allowed_roots",
    "Lista os diretorios do WSL liberados para terminal e filesystem.",
    {},
    { readOnlyHint: true },
    async () =>
      textResult(
        JSON.stringify({ allowedRoots: ctx.config.allowedRoots }, null, 2),
      ),
  );
}
