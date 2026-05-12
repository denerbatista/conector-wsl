#!/usr/bin/env node
import path from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { resolveConfig } from "./config.js";
import { createSessionStore } from "./sessions.js";
import { registerAllTools } from "./tools/index.js";
import { log } from "./log.js";

const PKG_NAME = "claude-wsl-terminal-connector";
const PKG_VERSION = "0.3.0";

export async function bootServer({ env = process.env } = {}) {
  const config = resolveConfig(env);
  const sessions = createSessionStore();
  const ctx = { config, sessions };

  const server = new McpServer({ name: PKG_NAME, version: PKG_VERSION });
  registerAllTools(server, ctx);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info("server.connected", { name: PKG_NAME, version: PKG_VERSION });
  return { server, ctx };
}

function normalizeEntryPath(value) {
  return path.resolve(value || "").replace(/\\/g, "/").toLowerCase();
}

// Auto-boot quando executado direto (entry MCP), independente de / vs \.
const currentModulePath = normalizeEntryPath(fileURLToPath(import.meta.url));
const invokedPath = normalizeEntryPath(process.argv[1]);
const isMainModule =
  currentModulePath === invokedPath ||
  invokedPath.endsWith("/src/index.js") ||
  invokedPath.endsWith("/server/index.js");

if (isMainModule) {
  bootServer().catch((err) => {
    log.error("server.boot.fail", { error: String(err?.stack || err) });
    process.exit(1);
  });
}
