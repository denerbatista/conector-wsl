import { randomUUID } from "node:crypto";

import { isPathAllowed } from "./security.js";
import { executeBashScript, buildShellScript } from "./wsl.js";

export function createSessionStore() {
  return new Map();
}

export function makeSession({ cwd, label }) {
  return {
    id: randomUUID(),
    label: label || "default",
    cwd,
    exportedState: "",
    createdAt: new Date().toISOString(),
    lastCommandAt: null,
  };
}

/**
 * Executa comando em uma sessao, capturando o novo cwd e o estado exportado
 * apos a execucao via markers unicos.
 */
export async function runSessionCommand({
  session,
  command,
  timeoutMs,
  maxOutputChars,
  distro,
  allowedRoots,
}) {
  const marker = `__CLAUDE_WSL_CWD__${randomUUID()}`;
  const stateStart = `__CLAUDE_WSL_STATE_START__${randomUUID()}`;
  const stateEnd = `__CLAUDE_WSL_STATE_END__${randomUUID()}`;

  const body = [
    command,
    "exit_code=$?",
    `printf "\\n${marker}%s\\n" "$PWD"`,
    `printf "${stateStart}\\n"`,
    "export -p",
    `printf "${stateEnd}\\n"`,
    "exit $exit_code",
  ].join("\n");

  const result = await executeBashScript({
    script: buildShellScript({
      cwd: session.cwd,
      prelude: session.exportedState,
      body,
    }),
    timeoutMs,
    maxOutputChars,
    distro,
  });

  const parsed = extractSessionData(
    result.stdout,
    marker,
    stateStart,
    stateEnd,
    session.cwd,
    session.exportedState,
  );

  if (!isPathAllowed(parsed.cwd, allowedRoots)) {
    throw new Error(
      `A sessao tentou mudar para um diretorio fora do escopo permitido: ${parsed.cwd}`,
    );
  }

  session.cwd = parsed.cwd;
  session.exportedState = parsed.exportedState;
  session.lastCommandAt = new Date().toISOString();

  return {
    cwd: parsed.cwd,
    exitCode: result.exitCode,
    stdout: parsed.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
  };
}

export function extractSessionData(
  stdout,
  cwdMarker,
  startMarker,
  endMarker,
  fallbackCwd,
  fallbackState,
) {
  const lines = stdout.split(/\r?\n/);
  const cwdIdx = lines.findIndex((l) => l.startsWith(cwdMarker));
  const startIdx = lines.findIndex((l) => l === startMarker);
  const endIdx = lines.findIndex((l) => l === endMarker);

  const cwd =
    cwdIdx === -1
      ? fallbackCwd
      : lines[cwdIdx].slice(cwdMarker.length) || fallbackCwd;

  const exportedState =
    startIdx !== -1 && endIdx !== -1 && endIdx > startIdx
      ? lines
          .slice(startIdx + 1, endIdx)
          .join("\n")
          .trim()
      : fallbackState;

  const filtered = lines.filter((_line, idx) => {
    if (idx === cwdIdx) return false;
    if (startIdx !== -1 && endIdx !== -1 && idx >= startIdx && idx <= endIdx) {
      return false;
    }
    return true;
  });

  return {
    stdout: filtered.join("\n").trimEnd(),
    cwd,
    exportedState,
  };
}
