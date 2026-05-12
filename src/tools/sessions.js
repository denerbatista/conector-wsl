import { z } from "zod";

import { isPathAllowed, resolveLinuxPath } from "../security.js";
import { makeSession, runSessionCommand } from "../sessions.js";
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

export function registerSessionTools(server, ctx) {
  server.tool(
    "start_wsl_session",
    "Abre uma sessao persistente de terminal WSL. A sessao preserva o diretorio atual e variaveis exportadas.",
    {
      cwd: z.string().min(1).optional(),
      label: z.string().min(1).max(80).optional(),
    },
    async ({ cwd, label }) => {
      const resolvedCwd = resolveCwd(cwd, ctx);
      const session = makeSession({ cwd: resolvedCwd, label });
      ctx.sessions.set(session.id, session);
      return textResult(
        JSON.stringify(
          {
            sessionId: session.id,
            cwd: session.cwd,
            note: "A sessao preserva cwd e variaveis exportadas. Alias, funcoes e variaveis nao exportadas nao persistem.",
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "run_in_wsl_session",
    "Executa um comando dentro de uma sessao persistente. Apos cada comando, o cwd e as variaveis exportadas sao atualizados.",
    {
      sessionId: z.string().uuid(),
      command: z.string().min(1),
      timeoutMs: z.number().int().positive().max(600000).optional(),
    },
    async ({ sessionId, command, timeoutMs }) => {
      const session = ctx.sessions.get(sessionId);
      if (!session) throw new Error(`Sessao nao encontrada: ${sessionId}`);

      const result = await runSessionCommand({
        session,
        command,
        timeoutMs: timeoutMs ?? ctx.config.timeoutMs,
        maxOutputChars: ctx.config.maxOutputChars,
        distro: ctx.config.distro,
        allowedRoots: ctx.config.allowedRoots,
      });
      return textResult(
        JSON.stringify(
          {
            sessionId,
            cwd: result.cwd,
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

  server.tool(
    "close_wsl_session",
    "Fecha uma sessao persistente e remove o estado salvo.",
    { sessionId: z.string().uuid() },
    async ({ sessionId }) => {
      const session = ctx.sessions.get(sessionId);
      if (!session) throw new Error(`Sessao nao encontrada: ${sessionId}`);
      ctx.sessions.delete(sessionId);
      return textResult(JSON.stringify({ sessionId, closed: true }, null, 2));
    },
  );
}
