#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const IS_WINDOWS = process.platform === "win32";
const DEFAULT_HOME = IS_WINDOWS ? "/home" : os.homedir();
const DEFAULT_TIMEOUT_MS = parsePositiveInt(
  process.env.WSL_CONNECTOR_TIMEOUT_MS,
  120000,
);
const MAX_OUTPUT_CHARS = parsePositiveInt(
  process.env.WSL_CONNECTOR_MAX_OUTPUT_CHARS,
  16000,
);
const MAX_FILE_CHARS = parsePositiveInt(
  process.env.WSL_CONNECTOR_MAX_FILE_CHARS,
  100000,
);
const DEFAULT_CWD = resolveLinuxPath(
  process.env.WSL_CONNECTOR_DEFAULT_CWD || DEFAULT_HOME,
  DEFAULT_HOME,
);
const WSL_DISTRO = process.env.WSL_CONNECTOR_DISTRO?.trim() || "";

const allowedRoots = parseAllowedRoots(
  process.env.WSL_CONNECTOR_ALLOWED_ROOTS,
  DEFAULT_CWD,
);
const sessions = new Map();

const server = new McpServer({
  name: "claude-wsl-terminal-connector",
  version: "0.2.0",
});

server.tool(
  "connector_status",
  "Mostra como o conector foi inicializado, com terminal e filesystem do WSL.",
  {},
  async () => textResult(JSON.stringify(getStatus(), null, 2)),
);

server.tool(
  "list_allowed_roots",
  "Lista os diretorios do WSL liberados para terminal e filesystem.",
  {},
  async () =>
    textResult(
      JSON.stringify(
        {
          allowedRoots,
        },
        null,
        2,
      ),
    ),
);

server.tool(
  "list_directory",
  "Lista arquivos e pastas dentro de um diretorio permitido do WSL.",
  {
    path: z.string().min(1).optional(),
  },
  async ({ path: requestedPath }) => {
    const resolvedPath = resolveFsPath(requestedPath || DEFAULT_CWD);
    const hostPath = toHostPath(resolvedPath);
    const dirEntries = await fs.readdir(hostPath, {
      withFileTypes: true,
    });

    const entries = await Promise.all(
      dirEntries.map(async (entry) => {
        const entryPath = path.posix.join(resolvedPath, entry.name);
        const stats = await fs.lstat(toHostPath(entryPath));

        return {
          name: entry.name,
          path: entryPath,
          type: detectEntryType(stats),
          size: stats.isFile() ? stats.size : null,
          modifiedAt: stats.mtime.toISOString(),
        };
      }),
    );

    entries.sort(compareDirectoryEntries);

    return textResult(
      JSON.stringify(
        {
          path: resolvedPath,
          entries,
        },
        null,
        2,
      ),
    );
  },
);

server.tool(
  "get_path_info",
  "Retorna tipo, tamanho e datas de um caminho permitido do WSL.",
  {
    path: z.string().min(1),
  },
  async ({ path: requestedPath }) => {
    const resolvedPath = resolveFsPath(requestedPath);
    const stats = await fs.lstat(toHostPath(resolvedPath));

    return textResult(
      JSON.stringify(
        {
          path: resolvedPath,
          type: detectEntryType(stats),
          size: stats.isFile() ? stats.size : null,
          createdAt: stats.birthtime.toISOString(),
          modifiedAt: stats.mtime.toISOString(),
        },
        null,
        2,
      ),
    );
  },
);

server.tool(
  "read_text_file",
  "Le um arquivo de texto do WSL dentro das roots permitidas.",
  {
    path: z.string().min(1),
    maxChars: z.number().int().positive().max(500000).optional(),
  },
  async ({ path: requestedPath, maxChars }) => {
    const resolvedPath = resolveFsPath(requestedPath);
    const hostPath = toHostPath(resolvedPath);
    const contents = await fs.readFile(hostPath, "utf8");
    const truncated = truncateText(contents, maxChars ?? MAX_FILE_CHARS);

    return textResult(
      JSON.stringify(
        {
          path: resolvedPath,
          truncated: truncated.truncated,
          content: truncated.value,
        },
        null,
        2,
      ),
    );
  },
);

server.tool(
  "write_text_file",
  "Escreve um arquivo de texto no WSL dentro das roots permitidas.",
  {
    path: z.string().min(1),
    content: z.string(),
    overwrite: z.boolean().optional(),
    createParents: z.boolean().optional(),
  },
  async ({ path: requestedPath, content, overwrite, createParents }) => {
    const resolvedPath = resolveFsPath(requestedPath);
    const hostPath = toHostPath(resolvedPath);

    if (createParents ?? true) {
      await fs.mkdir(path.dirname(hostPath), {
        recursive: true,
      });
    }

    if (!(overwrite ?? false) && (await pathExists(hostPath))) {
      throw new Error(
        `Arquivo ja existe: ${resolvedPath}. Use overwrite=true para sobrescrever.`,
      );
    }

    await fs.writeFile(hostPath, content, "utf8");

    return textResult(
      JSON.stringify(
        {
          path: resolvedPath,
          written: true,
          bytes: Buffer.byteLength(content, "utf8"),
        },
        null,
        2,
      ),
    );
  },
);

server.tool(
  "create_directory",
  "Cria um diretorio dentro das roots permitidas do WSL.",
  {
    path: z.string().min(1),
    recursive: z.boolean().optional(),
  },
  async ({ path: requestedPath, recursive }) => {
    const resolvedPath = resolveFsPath(requestedPath);
    const hostPath = toHostPath(resolvedPath);

    await fs.mkdir(hostPath, {
      recursive: recursive ?? true,
    });

    return textResult(
      JSON.stringify(
        {
          path: resolvedPath,
          created: true,
        },
        null,
        2,
      ),
    );
  },
);

server.tool(
  "run_wsl_command",
  [
    "Executa um comando no terminal WSL em uma shell nova.",
    "Use quando nao precisar preservar estado entre chamadas.",
  ].join(" "),
  {
    command: z.string().min(1),
    cwd: z.string().min(1).optional(),
    timeoutMs: z.number().int().positive().max(600000).optional(),
  },
  async ({ command, cwd, timeoutMs }) => {
    const resolvedCwd = resolveCwd(cwd);
    const result = await runShellCommand({
      command,
      cwd: resolvedCwd,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    return textResult(renderCommandResult(result));
  },
);

server.tool(
  "start_wsl_session",
  [
    "Abre uma sessao persistente de terminal WSL.",
    "A sessao preserva o diretorio atual e variaveis exportadas.",
  ].join(" "),
  {
    cwd: z.string().min(1).optional(),
    label: z.string().min(1).max(80).optional(),
  },
  async ({ cwd, label }) => {
    const resolvedCwd = resolveCwd(cwd);
    const sessionId = randomUUID();

    sessions.set(sessionId, {
      id: sessionId,
      label: label ?? "default",
      cwd: resolvedCwd,
      exportedState: "",
      createdAt: new Date().toISOString(),
      lastCommandAt: null,
    });

    return textResult(
      JSON.stringify(
        {
          sessionId,
          cwd: resolvedCwd,
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
  [
    "Executa um comando dentro de uma sessao persistente.",
    "Apos cada comando, o cwd e as variaveis exportadas sao atualizados.",
  ].join(" "),
  {
    sessionId: z.string().uuid(),
    command: z.string().min(1),
    timeoutMs: z.number().int().positive().max(600000).optional(),
  },
  async ({ sessionId, command, timeoutMs }) => {
    const session = sessions.get(sessionId);

    if (!session) {
      throw new Error(`Sessao nao encontrada: ${sessionId}`);
    }

    const result = await runSessionCommand({
      session,
      command,
      timeoutMs: timeoutMs ?? DEFAULT_TIMEOUT_MS,
    });

    session.cwd = result.cwd;
    session.lastCommandAt = new Date().toISOString();

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
  {
    sessionId: z.string().uuid(),
  },
  async ({ sessionId }) => {
    const session = sessions.get(sessionId);

    if (!session) {
      throw new Error(`Sessao nao encontrada: ${sessionId}`);
    }

    sessions.delete(sessionId);

    return textResult(
      JSON.stringify(
        {
          sessionId,
          closed: true,
        },
        null,
        2,
      ),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizeLinuxPath(value) {
  if (!value) {
    return DEFAULT_CWD;
  }

  return value.replace(/\\/g, "/");
}

function resolveLinuxPath(value, basePath = DEFAULT_CWD) {
  const normalized = normalizeLinuxPath(value || basePath);

  if (normalized.startsWith("/")) {
    return path.posix.normalize(normalized);
  }

  return path.posix.normalize(path.posix.join(basePath, normalized));
}

function parseAllowedRoots(value, fallbackRoot) {
  const roots = (value ?? fallbackRoot)
    .split(":")
    .map((entry) => resolveLinuxPath(entry.trim(), fallbackRoot))
    .filter(Boolean);

  if (roots.length === 0) {
    return [fallbackRoot];
  }

  return Array.from(new Set(roots));
}

function resolveCwd(requestedCwd) {
  const candidate = resolveLinuxPath(requestedCwd || DEFAULT_CWD, DEFAULT_CWD);

  if (!isPathAllowed(candidate)) {
    throw new Error(
      `Diretorio fora do escopo permitido: ${candidate}. Ajuste WSL_CONNECTOR_ALLOWED_ROOTS se quiser liberar outro caminho.`,
    );
  }

  return candidate;
}

function resolveFsPath(requestedPath) {
  const candidate = resolveLinuxPath(requestedPath, DEFAULT_CWD);

  if (!isPathAllowed(candidate)) {
    throw new Error(
      `Caminho fora do escopo permitido: ${candidate}. Ajuste WSL_CONNECTOR_ALLOWED_ROOTS se quiser liberar outro caminho.`,
    );
  }

  return candidate;
}

function isPathAllowed(candidate) {
  return allowedRoots.some((root) => {
    if (candidate === root) {
      return true;
    }

    return candidate.startsWith(`${root}/`);
  });
}

function getStatus() {
  return {
    platform: process.platform,
    wslDistro: WSL_DISTRO || null,
    defaultCwd: DEFAULT_CWD,
    allowedRoots,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxOutputChars: MAX_OUTPUT_CHARS,
    maxFileChars: MAX_FILE_CHARS,
    filesystemMode: IS_WINDOWS ? "windows-unc-into-wsl" : "native-linux",
    sessionCount: sessions.size,
  };
}

function textResult(text) {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}

function renderCommandResult(result) {
  return JSON.stringify(
    {
      cwd: result.cwd,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      truncated: result.truncated,
    },
    null,
    2,
  );
}

async function runShellCommand({ command, cwd, timeoutMs }) {
  const result = await executeBashScript({
    script: buildShellScript({
      cwd,
      body: command,
    }),
    timeoutMs,
  });

  return {
    cwd,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    truncated: result.truncated,
  };
}

async function runSessionCommand({ session, command, timeoutMs }) {
  const marker = `__CLAUDE_WSL_CWD__${randomUUID()}`;
  const stateStartMarker = `__CLAUDE_WSL_STATE_START__${randomUUID()}`;
  const stateEndMarker = `__CLAUDE_WSL_STATE_END__${randomUUID()}`;

  const result = await executeBashScript({
    script: buildShellScript({
      cwd: session.cwd,
      prelude: session.exportedState,
      body: [
        command,
        "exit_code=$?",
        `printf "\\n${marker}%s\\n" "$PWD"`,
        `printf "${stateStartMarker}\\n"`,
        "export -p",
        `printf "${stateEndMarker}\\n"`,
        "exit $exit_code",
      ].join("\n"),
    }),
    timeoutMs,
  });

  const { stdout, cwd, exportedState } = extractSessionData(
    result.stdout,
    marker,
    stateStartMarker,
    stateEndMarker,
    session.cwd,
    session.exportedState,
  );

  if (!isPathAllowed(cwd)) {
    throw new Error(
      `A sessao tentou mudar para um diretorio fora do escopo permitido: ${cwd}`,
    );
  }

  session.exportedState = exportedState;

  return {
    cwd,
    exitCode: result.exitCode,
    stdout,
    stderr: result.stderr,
    truncated: result.truncated,
  };
}

function extractSessionData(
  stdout,
  cwdMarker,
  stateStartMarker,
  stateEndMarker,
  fallbackCwd,
  fallbackState,
) {
  const lines = stdout.split(/\r?\n/);
  const cwdMarkerIndex = lines.findIndex((line) => line.startsWith(cwdMarker));
  const stateStartIndex = lines.findIndex((line) => line === stateStartMarker);
  const stateEndIndex = lines.findIndex((line) => line === stateEndMarker);

  const cwd =
    cwdMarkerIndex === -1
      ? fallbackCwd
      : lines[cwdMarkerIndex].slice(cwdMarker.length) || fallbackCwd;
  const exportedState =
    stateStartIndex !== -1 && stateEndIndex !== -1 && stateEndIndex > stateStartIndex
      ? lines.slice(stateStartIndex + 1, stateEndIndex).join("\n").trim()
      : fallbackState;

  const filteredLines = lines.filter((line, index) => {
    if (index === cwdMarkerIndex) {
      return false;
    }

    if (
      stateStartIndex !== -1 &&
      stateEndIndex !== -1 &&
      index >= stateStartIndex &&
      index <= stateEndIndex
    ) {
      return false;
    }

    return true;
  });

  return {
    stdout: filteredLines.join("\n").trimEnd(),
    cwd,
    exportedState,
  };
}

function buildShellScript({ cwd, prelude = "", body }) {
  const parts = ["set +e"];

  if (prelude) {
    parts.push(prelude);
  }

  parts.push(`cd ${shellEscape(cwd)} || exit $?`);
  parts.push(body);

  return parts.join("\n");
}

async function executeBashScript({ script, timeoutMs }) {
  const command = IS_WINDOWS ? "wsl.exe" : "/bin/bash";
  const args = IS_WINDOWS ? buildWslArgs(script) : ["-lc", script];

  const child = spawn(command, args, {
    env: {
      ...process.env,
      HOME: process.env.HOME || os.homedir(),
    },
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
    stderr = `${stderr}\nProcesso encerrado por timeout (${timeoutMs} ms).`.trim();
  }

  const truncatedStdout = truncateText(stdout, MAX_OUTPUT_CHARS);
  const truncatedStderr = truncateText(stderr, MAX_OUTPUT_CHARS);

  return {
    exitCode,
    stdout: truncatedStdout.value,
    stderr: truncatedStderr.value,
    truncated: truncatedStdout.truncated || truncatedStderr.truncated,
  };
}

function buildWslArgs(script) {
  const args = [];

  if (WSL_DISTRO) {
    args.push("-d", WSL_DISTRO, "--");
  }

  args.push("bash", "-lc", script);
  return args;
}

function truncateText(value, maxChars) {
  if (value.length <= maxChars) {
    return {
      value: value.trimEnd(),
      truncated: false,
    };
  }

  const suffix = `\n...[truncado em ${maxChars} caracteres]`;
  return {
    value: `${value.slice(0, maxChars)}${suffix}`.trimEnd(),
    truncated: true,
  };
}

function shellEscape(value) {
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function toHostPath(linuxPath) {
  if (!IS_WINDOWS) {
    return linuxPath;
  }

  if (!WSL_DISTRO) {
    throw new Error(
      "WSL_CONNECTOR_DISTRO e obrigatoria para tools de filesystem quando o conector roda no Windows.",
    );
  }

  const relativePath = linuxPath.replace(/^\/+/, "").replace(/\//g, "\\");
  return relativePath
    ? `\\\\wsl.localhost\\${WSL_DISTRO}\\${relativePath}`
    : `\\\\wsl.localhost\\${WSL_DISTRO}`;
}

function detectEntryType(stats) {
  if (stats.isDirectory()) {
    return "directory";
  }

  if (stats.isFile()) {
    return "file";
  }

  if (stats.isSymbolicLink()) {
    return "symlink";
  }

  return "other";
}

function compareDirectoryEntries(left, right) {
  if (left.type === right.type) {
    return left.name.localeCompare(right.name, "pt-BR");
  }

  if (left.type === "directory") {
    return -1;
  }

  if (right.type === "directory") {
    return 1;
  }

  return left.name.localeCompare(right.name, "pt-BR");
}

async function pathExists(hostPath) {
  try {
    await fs.access(hostPath);
    return true;
  } catch {
    return false;
  }
}
