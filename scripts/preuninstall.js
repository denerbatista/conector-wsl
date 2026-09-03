#!/usr/bin/env node
/**
 * preuninstall.js
 *
 * Roda automaticamente antes de: npm uninstall -g claude-wsl-terminal-connector
 *
 * Remove a entrada "wsl-connector" do claude_desktop_config.json
 * preservando todas as outras entradas de mcpServers e demais chaves.
 *
 * Variaveis de ambiente:
 *  - CLAUDE_WSL_SKIP_REGISTER=1   pula a limpeza
 *  - CLAUDE_WSL_CONFIG_PATH=...   forca um caminho de config (testes/custom)
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { execFileSync } from "node:child_process";

const ENTRY_KEY = "wsl-connector";
const TAG = "[WSL Connector]";

function log(msg) {
  console.log(`${TAG} ${msg}`);
}
function warn(msg) {
  console.warn(`${TAG} aviso: ${msg}`);
}

if (!process.env.npm_config_global) {
  process.exit(0);
}

if (process.env.CLAUDE_WSL_SKIP_REGISTER === "1") {
  log("CLAUDE_WSL_SKIP_REGISTER=1 detectado. Limpeza pulada.");
  process.exit(0);
}

function isWSL() {
  if (platform() !== "linux") return false;
  try {
    const version = readFileSync("/proc/version", "utf8").toLowerCase();
    return version.includes("microsoft") || version.includes("wsl");
  } catch {
    return false;
  }
}

function detectWindowsUser() {
  try {
    const raw = execFileSync("cmd.exe", ["/c", "echo", "%USERPROFILE%"], {
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const match = raw.match(/Users[\\\/]([^\\\/\r\n]+)/);
    if (match) return match[1];
  } catch {
    /* ignora */
  }
  try {
    const SYSTEM = new Set([
      "Public",
      "Default",
      "Default User",
      "All Users",
      "WDAGUtilityAccount",
    ]);
    const entries = readdirSync("/mnt/c/Users").filter((e) => !SYSTEM.has(e));
    if (entries.length === 1) return entries[0];
  } catch {
    /* ignora */
  }
  return null;
}

function getConfigPath() {
  if (process.env.CLAUDE_WSL_CONFIG_PATH) {
    return process.env.CLAUDE_WSL_CONFIG_PATH;
  }
  const plat = platform();
  if (plat === "linux" && isWSL()) {
    const winUser = detectWindowsUser();
    if (winUser) {
      return `/mnt/c/Users/${winUser}/AppData/Roaming/Claude/claude_desktop_config.json`;
    }
  }
  if (plat === "linux") {
    return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }
  if (plat === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  if (plat === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  return null;
}

try {
  const configPath = getConfigPath();
  if (!configPath || !existsSync(configPath)) {
    process.exit(0);
  }

  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    warn("Config invalido; nada a fazer.");
    process.exit(0);
  }

  if (!config.mcpServers || !config.mcpServers[ENTRY_KEY]) {
    process.exit(0);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  try {
    copyFileSync(configPath, `${configPath}.bak-${stamp}`);
  } catch {
    /* segue mesmo sem backup */
  }

  delete config.mcpServers[ENTRY_KEY];
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  log("Conector removido do Claude Desktop.");
  log("Reinicie o Claude Desktop para aplicar.");
} catch (err) {
  warn(`Limpeza falhou: ${err.message}. Remova manualmente se necessario.`);
  process.exit(0);
}
