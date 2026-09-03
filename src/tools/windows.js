import { z } from "zod";

import { isPathAllowed, resolveLinuxPath } from "../security.js";
import {
  buildPowerShellScript,
  executePowerShell,
  extractWindowsSessionData,
  isUrl,
  makeWindowsSession,
  newCwdMarker,
  psQuote,
  toLinuxPath,
  toWindowsPath,
} from "../windows.js";
import { textResult } from "../util.js";

/**
 * Resolve um cwd (Linux ou Windows) para caminho Windows, validando contra
 * allowed_roots pela forma Linux equivalente — mesma sandbox das tools WSL.
 */
function resolveWindowsCwd(requested, ctx) {
  const raw = (requested || "").trim() || ctx.config.defaultCwd;
  const linux = raw.startsWith("/")
    ? resolveLinuxPath(raw, ctx.config.defaultCwd)
    : toLinuxPath(raw);
  if (!linux || !isPathAllowed(linux, ctx.config.allowedRoots)) {
    throw new Error(
      `Diretorio fora do escopo permitido: ${raw}. Ajuste allowed_roots se quiser liberar outro caminho.`,
    );
  }
  return {
    linux,
    windows: toWindowsPath(linux, { distro: ctx.config.distro }),
  };
}

function assertCwdStillAllowed(windowsCwd, ctx) {
  const linux = toLinuxPath(windowsCwd);
  if (!linux || !isPathAllowed(linux, ctx.config.allowedRoots)) {
    throw new Error(
      `A sessao tentou mudar para um diretorio fora do escopo permitido: ${windowsCwd}`,
    );
  }
}

async function runPs(ctx, { cwd, body, cwdMarker, timeoutMs }) {
  return executePowerShell({
    script: buildPowerShellScript({ cwd, body, cwdMarker }),
    timeoutMs: timeoutMs ?? ctx.config.timeoutMs,
    maxOutputChars: ctx.config.maxOutputChars,
    powershell: ctx.runtime.windows.powershell,
  });
}

export function registerWindowsTools(server, ctx) {
  server.tool(
    "run_windows_command",
    "Executa um comando PowerShell no Windows (host) em uma shell nova. Use para abrir programas, mexer em arquivos do Windows ou rodar utilitarios .exe. cwd aceita caminho Windows (C:\\...) ou Linux/WSL (/mnt/c/..., /home/...).",
    {
      command: z.string().min(1),
      cwd: z.string().min(1).optional(),
      timeoutMs: z.number().int().positive().max(600000).optional(),
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ command, cwd, timeoutMs }) => {
      const resolved = resolveWindowsCwd(cwd, ctx);
      const result = await runPs(ctx, {
        cwd: resolved.windows,
        body: command,
        timeoutMs,
      });
      return textResult(
        JSON.stringify(
          {
            shell: "powershell",
            cwd: resolved.windows,
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
    "start_windows_session",
    "Abre uma sessao persistente de PowerShell no Windows. A sessao preserva o diretorio atual (cwd) entre comandos; variaveis nao persistem.",
    {
      cwd: z.string().min(1).optional(),
      label: z.string().min(1).max(80).optional(),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ cwd, label }) => {
      const resolved = resolveWindowsCwd(cwd, ctx);
      const session = makeWindowsSession({ cwd: resolved.windows, label });
      ctx.sessions.set(session.id, session);
      return textResult(
        JSON.stringify(
          {
            sessionId: session.id,
            shell: "powershell",
            cwd: session.cwd,
            note: "A sessao preserva o cwd entre comandos. Variaveis, funcoes e aliases nao persistem.",
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "run_in_windows_session",
    "Executa um comando PowerShell dentro de uma sessao persistente do Windows. Apos cada comando o cwd e atualizado.",
    {
      sessionId: z.string().uuid(),
      command: z.string().min(1),
      timeoutMs: z.number().int().positive().max(600000).optional(),
    },
    { readOnlyHint: false, destructiveHint: true },
    async ({ sessionId, command, timeoutMs }) => {
      const session = ctx.sessions.get(sessionId);
      if (!session) throw new Error(`Sessao nao encontrada: ${sessionId}`);
      if (session.kind !== "windows") {
        throw new Error(
          `Sessao ${sessionId} e do WSL — use run_in_wsl_session para ela.`,
        );
      }
      const cwdMarker = newCwdMarker();
      const result = await runPs(ctx, {
        cwd: session.cwd,
        body: command,
        cwdMarker,
        timeoutMs,
      });
      const parsed = extractWindowsSessionData(
        result.stdout,
        cwdMarker,
        session.cwd,
      );
      assertCwdStillAllowed(parsed.cwd, ctx);
      session.cwd = parsed.cwd;
      session.lastCommandAt = new Date().toISOString();
      return textResult(
        JSON.stringify(
          {
            sessionId,
            shell: "powershell",
            cwd: parsed.cwd,
            exitCode: result.exitCode,
            stdout: parsed.stdout,
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
    "close_windows_session",
    "Fecha uma sessao persistente do Windows e remove o estado salvo.",
    { sessionId: z.string().uuid() },
    { readOnlyHint: false, destructiveHint: false },
    async ({ sessionId }) => {
      const session = ctx.sessions.get(sessionId);
      if (!session) throw new Error(`Sessao nao encontrada: ${sessionId}`);
      ctx.sessions.delete(sessionId);
      return textResult(JSON.stringify({ sessionId, closed: true }, null, 2));
    },
  );

  server.tool(
    "open_in_windows",
    "Abre um arquivo, pasta ou URL no Windows com o aplicativo padrao (Explorer, navegador, editor). Opcionalmente informe `app` (ex.: caminho do phpstorm64.exe) para abrir com um programa especifico. Caminhos podem ser Windows ou Linux/WSL.",
    {
      target: z.string().min(1),
      app: z.string().min(1).optional(),
    },
    { readOnlyHint: false, destructiveHint: false },
    async ({ target, app }) => {
      let windowsTarget;
      if (isUrl(target)) {
        windowsTarget = target.trim();
      } else {
        const linux = target.trim().startsWith("/")
          ? resolveLinuxPath(target.trim(), ctx.config.defaultCwd)
          : toLinuxPath(target);
        if (!linux || !isPathAllowed(linux, ctx.config.allowedRoots)) {
          throw new Error(
            `Caminho fora do escopo permitido: ${target}. Ajuste allowed_roots se quiser liberar outro caminho.`,
          );
        }
        windowsTarget = toWindowsPath(linux, { distro: ctx.config.distro });
      }

      const body = app
        ? `Start-Process -FilePath ${psQuote(toWindowsPath(app, { distro: ctx.config.distro }))} -ArgumentList ${psQuote(windowsTarget)}`
        : `Start-Process -FilePath ${psQuote(windowsTarget)}`;

      const cwd = resolveWindowsCwd(undefined, ctx);
      const result = await runPs(ctx, { cwd: cwd.windows, body });
      return textResult(
        JSON.stringify(
          {
            opened: windowsTarget,
            app: app || "default",
            exitCode: result.exitCode,
            stderr: result.stderr,
          },
          null,
          2,
        ),
      );
    },
  );
}
