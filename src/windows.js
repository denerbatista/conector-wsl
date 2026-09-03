import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { truncateText } from "./filesystem.js";
import { safeSpawnCwd } from "./wsl.js";

const MNT_RE = /^\/mnt\/([a-z])(\/.*)?$/i;
const DRIVE_RE = /^([a-zA-Z]):(\\.*)?$/;
const UNC_WSL_RE = /^\\\\wsl(?:\.localhost|\$)\\([^\\]+)(\\.*)?$/i;
const URL_RE = /^(https?|mailto|file):/i;

/**
 * Onde o PowerShell pode estar.
 *  - Windows nativo: %SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe (ou PATH).
 *  - Dentro do WSL (interop): /mnt/<letra>/Windows/System32/WindowsPowerShell/v1.0/powershell.exe
 *    — o PATH do WSL nem sempre inclui o System32, por isso o caminho absoluto.
 */
export function resolvePowerShell({
  env = process.env,
  platform = process.platform,
  exists = fs.existsSync,
} = {}) {
  const override = (env.WSL_CONNECTOR_POWERSHELL || "").trim();
  if (override) return override;

  if (platform === "win32") {
    const root = env.SystemRoot || env.windir || "C:\\Windows";
    const candidate = path.win32.join(
      root,
      "System32",
      "WindowsPowerShell",
      "v1.0",
      "powershell.exe",
    );
    return safeExists(exists, candidate) ? candidate : "powershell.exe";
  }

  // Linux: so faz sentido dentro do WSL (interop com o Windows).
  if (!env.WSL_DISTRO_NAME && !env.WSL_INTEROP) return null;

  const letters = ["c", "d", "e"];
  for (const letter of letters) {
    const candidate = `/mnt/${letter}/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`;
    if (safeExists(exists, candidate)) return candidate;
  }
  return null;
}

function safeExists(exists, candidate) {
  try {
    return Boolean(exists(candidate));
  } catch {
    return false;
  }
}

/** Escapa para string PowerShell entre aspas simples ('' = literal '). */
export function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function isWindowsPath(value) {
  return DRIVE_RE.test(value) || value.startsWith("\\\\");
}

export function isUrl(value) {
  return URL_RE.test(String(value || "").trim());
}

/**
 * Linux/WSL -> caminho Windows. Independente da plataforma do processo
 * (ao contrario de toHostPath, que so converte quando roda em win32).
 *  - /mnt/c/Users/X  -> C:\Users\X
 *  - /home/x         -> \\wsl.localhost\<distro>\home\x
 *  - C:\...  ou \\...-> passa direto
 */
export function toWindowsPath(value, { distro } = {}) {
  const raw = String(value || "").trim();
  if (!raw) throw new Error("Caminho vazio.");
  if (isWindowsPath(raw)) return raw;

  const linux = raw.replace(/\\/g, "/");
  const m = linux.match(MNT_RE);
  if (m) {
    const letter = m[1].toUpperCase();
    const rest = (m[2] || "").replace(/\//g, "\\");
    return `${letter}:${rest || "\\"}`;
  }
  if (!distro) {
    throw new Error(
      "Distribuicao WSL nao detectada. Converter caminho Linux para Windows exige a distro.",
    );
  }
  const relative = linux.replace(/^\/+/, "").replace(/\//g, "\\");
  return relative
    ? `\\\\wsl.localhost\\${distro}\\${relative}`
    : `\\\\wsl.localhost\\${distro}`;
}

/**
 * Windows -> Linux/WSL (para validar contra allowed_roots).
 *  - C:\Users\X                    -> /mnt/c/Users/X
 *  - \\wsl.localhost\<d>\home\x    -> /home/x
 *  - /home/x                       -> passa direto
 * Retorna null para UNC que nao seja do WSL (nao ha equivalente Linux).
 */
export function toLinuxPath(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("/")) return path.posix.normalize(raw.replace(/\\/g, "/"));

  const drive = raw.match(DRIVE_RE);
  if (drive) {
    const rest = (drive[2] || "\\").replace(/\\/g, "/");
    return stripTrailingSlash(
      path.posix.normalize(`/mnt/${drive[1].toLowerCase()}${rest}`),
    );
  }
  const unc = raw.match(UNC_WSL_RE);
  if (unc) {
    const rest = (unc[2] || "\\").replace(/\\/g, "/");
    return stripTrailingSlash(path.posix.normalize(rest || "/"));
  }
  return null;
}

function stripTrailingSlash(value) {
  return value.length > 1 ? value.replace(/\/+$/, "") : value;
}

/**
 * Monta o script PowerShell: forca UTF-8 na saida, entra no cwd, roda o body e
 * imprime o cwd final atras de um marker (para sessoes persistentes).
 */
export function buildPowerShellScript({ cwd, body, cwdMarker }) {
  const lines = [
    "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
    "$ErrorActionPreference = 'Continue'",
    `try { Set-Location -LiteralPath ${psQuote(cwd)} } catch { Write-Error $_; exit 1 }`,
    "$global:LASTEXITCODE = 0",
    body,
    "$__ok = $?",
    "$__ec = $LASTEXITCODE",
    "if ($null -eq $__ec) { $__ec = 0 }",
    "if ($__ec -eq 0 -and -not $__ok) { $__ec = 1 }",
  ];
  if (cwdMarker) {
    lines.push(`Write-Output ("${cwdMarker}" + (Get-Location).Path)`);
  }
  lines.push("exit $__ec");
  return lines.join("\n");
}

export function encodePowerShell(script) {
  return Buffer.from(script, "utf16le").toString("base64");
}

/**
 * Executa um script PowerShell com timeout, via -EncodedCommand (sem problemas
 * de escape/quebra de linha no argv). Funciona no Windows e via interop no WSL.
 */
export async function executePowerShell({
  script,
  timeoutMs,
  maxOutputChars,
  powershell,
  spawnImpl = spawn,
}) {
  if (!powershell) {
    throw new Error(
      "PowerShell nao disponivel neste ambiente (precisa de Windows ou WSL com interop).",
    );
  }
  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-EncodedCommand",
    encodePowerShell(script),
  ];

  const child = spawnImpl(powershell, args, {
    cwd: safeSpawnCwd(),
    env: { ...process.env, HOME: process.env.HOME || os.homedir() },
    windowsHide: true,
  });

  let stdout = "";
  let stderr = "";
  let killedByTimeout = false;

  const timeout = setTimeout(() => {
    killedByTimeout = true;
    child.kill();
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

  stdout = stdout.replace(/\r/g, "");
  stderr = stderr.replace(/\r/g, "");
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

/** Sessao Windows: preserva apenas o cwd entre comandos. */
export function makeWindowsSession({ cwd, label }) {
  return {
    id: randomUUID(),
    kind: "windows",
    label: label || "default",
    cwd,
    createdAt: new Date().toISOString(),
    lastCommandAt: null,
  };
}

/** Separa o cwd final (marker) do stdout do usuario. */
export function extractWindowsSessionData(stdout, cwdMarker, fallbackCwd) {
  const lines = stdout.split(/\r?\n/);
  const idx = lines.findIndex((l) => l.startsWith(cwdMarker));
  const cwd =
    idx === -1
      ? fallbackCwd
      : lines[idx].slice(cwdMarker.length) || fallbackCwd;
  const filtered = lines.filter((_l, i) => i !== idx);
  return { cwd, stdout: filtered.join("\n").trimEnd() };
}

export function newCwdMarker() {
  return `__CLAUDE_WIN_CWD__${randomUUID()}`;
}
