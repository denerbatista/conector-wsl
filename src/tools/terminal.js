import { z } from "zod";

import { isPathAllowed, resolveLinuxPath } from "../security.js";
import { buildShellScript, executeBashScript } from "../wsl.js";
import { textResult } from "../util.js";

function resolveCwd(requested, ctx) {
  const candidate = resolveLinuxPath(
    requested || ctx.config.defaultCwd,
    ctx.config.defaultCwd,
  );
  if (!isPathAllowed(candidate, ctx.config.allowedRoots)) {
    throw new Error(
      `Diretorio fora do escopo permitido: ${candidate}. Ajuste allowed_roots se quiser liberar outro caminho.`,
    );
  }
  return candidate;
}

export function registerTerminalTools(server, ctx) {
  server.tool(
    "run_wsl_command",
    "Executa um comando no terminal WSL em uma shell nova. Use quando nao precisar preservar estado entre chamadas.",
    {
      command: z.string().min(1),
      cwd: z.string().min(1).optional(),
      timeoutMs: z.number().int().positive().max(600000).optional(),
    },
    async ({ command, cwd, timeoutMs }) => {
      const resolvedCwd = resolveCwd(cwd, ctx);
      const result = await executeBashScript({
        script: buildShellScript({ cwd: resolvedCwd, body: command }),
        timeoutMs: timeoutMs ?? ctx.config.timeoutMs,
        maxOutputChars: ctx.config.maxOutputChars,
        distro: ctx.config.distro,
      });
      return textResult(
        JSON.stringify(
          {
            cwd: resolvedCwd,
            exitCode: result.exitCode,
            stdout: result.stdout,
            stderr: result.stderr,
            truncated: result.truncated,
          },
          null,
          2,
        ),
      );
    },
  );
}
