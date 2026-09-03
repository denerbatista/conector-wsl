import fs from "node:fs";
import os from "node:os";
import { spawn } from "node:child_process";

import { truncateText } from "./filesystem.js";

const IS_WINDOWS = process.platform === "win32";

export function shellEscape(value) {
  // Aspas simples em bash: envolve em '...' e escapa ' como '\''.
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function buildShellScript({ cwd, prelude = "", body }) {
  const parts = ["set +e"];
  if (prelude) parts.push(prelude);
  parts.push(`cd ${shellEscape(cwd)} || exit $?`);
  parts.push(body);
  return parts.join("\n");
}

/**
 * Args do wsl.exe. Usa `--exec` (nao `--`): com `--` o wsl.exe repassa a linha ao
 * shell padrao da distro, que expande `$var`, `$(...)` e re-tokeniza aspas ANTES do
 * `bash -lc` receber o script — `for c in a b; do $c; done` chegava com `$c` vazio.
 * `--exec` entrega os argumentos intactos ao bash.
 */
export function buildWslArgs(script, distro) {
  const args = [];
  if (distro) args.push("-d", distro);
  args.push("--exec", "bash", "-lc", script);
  return args;
}

/**
 * Diretorio a partir do qual os processos filhos sao iniciados.
 *
 * O wsl.exe herda o cwd do processo pai e tenta entrar nele dentro do Linux. No
 * Cowork o pai roda na pasta da sessao (ex.: ...\outputs), que nao existe do lado
 * Linux -> o wsl.exe loga "chdir failed" no stderr antes de cair na home. O script
 * ja faz o proprio `cd`, entao iniciamos sempre de um diretorio que existe.
 */
export function safeSpawnCwd({
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
  homedir = os.homedir,
} = {}) {
  if (platform !== "win32") return undefined;
  const candidates = [env.USERPROFILE, homedir(), env.SystemRoot, "C:\\"];
  for (const dir of candidates) {
    if (!dir) continue;
    try {
      if (exists(dir)) return dir;
    } catch {
      /* tenta o proximo */
    }
  }
  return undefined;
}

/**
 * Executa um script bash com timeout e captura stdout/stderr.
 * No Windows usa wsl.exe; em Linux nativo usa /bin/bash.
 */
export async function executeBashScript({
  script,
  timeoutMs,
  maxOutputChars,
  distro,
  spawnImpl = spawn,
}) {
  const command = IS_WINDOWS ? "wsl.exe" : "/bin/bash";
  const args = IS_WINDOWS ? buildWslArgs(script, distro) : ["-lc", script];

  const child = spawnImpl(command, args, {
    cwd: safeSpawnCwd(),
    env: { ...process.env, HOME: process.env.HOME || os.homedir() },
  });

  let stdout = "";
  let stderr = "";
  let killedByTimeout = false;

  const timeout = setTimeout(() => {
    killedByTimeout = true;
    child.kill("SIGTERM");
  }, timeoutMs);

  child.stdout.on("data", (chunk) => {
    stdout += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString("utf8");
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 0));
  });

  clearTimeout(timeout);

  if (killedByTimeout) {
    stderr =
      `${stderr}\nProcesso encerrado por timeout (${timeoutMs} ms).`.trim();
  }

  const truncStdout = truncateText(stdout, maxOutputChars);
  const truncStderr = truncateText(stderr, maxOutputChars);

  return {
    exitCode,
    stdout: truncStdout.value,
    stderr: truncStderr.value,
    truncated: truncStdout.truncated || truncStderr.truncated,
  };
}
