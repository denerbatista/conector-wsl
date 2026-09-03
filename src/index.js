#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { resolveConfig } from "./config.js";
import { createSessionStore } from "./sessions.js";
import { registerCoreTools, registerFullTools } from "./tools/index.js";
import { decideMode } from "./mode.js";
import { runPrewarm } from "./prewarm.js";
import { log } from "./log.js";
import { PKG_NAME, PKG_VERSION } from "./version.js";

export { PKG_NAME, PKG_VERSION };

export function createRuntime() {
  return {
    mode: "pending",
    clientName: null,
    windows: { available: false, powershell: null },
  };
}

/**
 * Sobe o servidor MCP.
 *
 * Fluxo em duas etapas:
 *  1. Antes do connect: registra as tools "core" (connector_status, list_allowed_roots).
 *     Isso anuncia a capability `tools` no handshake.
 *  2. No `initialized` (apos o cliente se identificar): decide o modo pelo
 *     clientInfo.name e, em modo full, registra o resto. O `tools/list` do cliente
 *     chega depois desse ponto, entao ja ve a lista final.
 */
export async function bootServer({ env = process.env } = {}) {
  const config = resolveConfig(env);
  const sessions = createSessionStore();
  const ctx = { config, sessions, runtime: createRuntime() };

  const server = new McpServer({ name: PKG_NAME, version: PKG_VERSION });
  registerCoreTools(server, ctx);

  server.server.oninitialized = () => {
    const client = server.server.getClientVersion();
    ctx.runtime.clientName = client?.name ?? null;
    ctx.runtime.mode = decideMode({
      env,
      clientName: ctx.runtime.clientName,
      platform: process.platform,
    });

    if (ctx.runtime.mode === "full") {
      registerFullTools(server, ctx, { env });
      // Aquece o cache do npx de outros MCPs do plugin (ex.: chrome-devtools-mcp),
      // em segundo plano, uma vez por spec. Ver src/prewarm.js.
      try {
        runPrewarm({ env });
      } catch (err) {
        log.warn("prewarm.fail", { error: String(err?.message || err) });
      }
    }

    log.info("server.initialized", {
      client: ctx.runtime.clientName,
      clientVersion: client?.version ?? null,
      mode: ctx.runtime.mode,
      windowsTools: ctx.runtime.windows.available,
    });
  };

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("server.connected", { name: PKG_NAME, version: PKG_VERSION });
  return { server, ctx };
}

function normalizeEntryPath(value) {
  return path
    .resolve(value || "")
    .replace(/\\/g, "/")
    .toLowerCase();
}

// Auto-boot quando executado direto (entry MCP), independente de / vs \.
const currentModulePath = normalizeEntryPath(fileURLToPath(import.meta.url));
const invokedPath = normalizeEntryPath(process.argv[1]);
const isMainModule =
  currentModulePath === invokedPath ||
  invokedPath.endsWith("/src/index.js") ||
  invokedPath.endsWith("/server/index.js") ||
  invokedPath.endsWith("/claude-wsl-terminal-connector") ||
  invokedPath.endsWith("/wsl-connector.mjs") ||
  invokedPath.endsWith("/wsl-connector.js");

const cliArgs = process.argv.slice(2);
if (isMainModule && (cliArgs.includes("--version") || cliArgs.includes("-v"))) {
  process.stdout.write(`${PKG_VERSION}\n`);
  process.exit(0);
}
if (isMainModule && (cliArgs.includes("--help") || cliArgs.includes("-h"))) {
  process.stdout.write(
    `${PKG_NAME} ${PKG_VERSION} — servidor MCP (stdio). Sem argumentos: inicia o servidor.\n` +
      `  --version   imprime a versao e sai\n  --help      esta ajuda\n` +
      `Env: WSL_CONNECTOR_MODE=auto|full|silent, WSL_CONNECTOR_PREWARM="pkg@ver ...",\n` +
      `     WSL_CONNECTOR_DISTRO, WSL_CONNECTOR_DEFAULT_CWD, WSL_CONNECTOR_ALLOWED_ROOTS,\n` +
      `     WSL_CONNECTOR_TIMEOUT_MS, WSL_CONNECTOR_POWERSHELL\n`,
  );
  process.exit(0);
}

if (isMainModule) {
  bootServer().catch((err) => {
    log.error("server.boot.fail", { error: String(err?.stack || err) });
    process.exit(1);
  });
}
