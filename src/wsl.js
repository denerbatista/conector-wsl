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

function buildWslArgs(script, distro) {
  const args = [];
  if (distro) args.push("-d", distro, "--");
  args.push("bash", "-lc", script);
  return args;
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
}) {
  const command = IS_WINDOWS ? "wsl.exe" : "/bin/bash";
  const args = IS_WINDOWS ? buildWslArgs(script, distro) : ["-lc", script];

  const child = spawn(command, args, {
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
