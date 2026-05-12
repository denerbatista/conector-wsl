#!/usr/bin/env node
/**
 * postinstall.js
 * Roda automaticamente apos: npm install -g claude-wsl-terminal-connector
 * Detecta o SO, localiza o claude_desktop_config.json e adiciona o conector.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { execFileSync } from "node:child_process";

const ENTRY_KEY = "wsl-connector";
const TAG = "[WSL Connector]";

function log(msg) { console.log(`${TAG} ${msg}`); }
function warn(msg) { console.warn(`${TAG} aviso: ${msg}`); }

// Nao roda durante desenvolvimento (apenas global install)
if (!process.env.npm_config_global) {
  process.exit(0);
}

// ------------------------------------------------------------------ helpers --

function detectWindowsUser() {
  // Tenta pegar via USERPROFILE dentro do WSL
  try {
    const raw = execFileSync("wsl.exe", ["-e", "bash", "-c", "echo $USERPROFILE"], {
      timeout: 5000,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    const match = raw.match(/Users[\\\/]([^\\\/\r\n]+)/);
    if (match) return match[1];
  } catch { /* ignora */ }

  // Fallback: unico usuario em /mnt/c/Users/ que nao e sistema
  try {
    const SYSTEM = new Set(["Public", "Default", "Default User", "All Users"]);
    const entries = readdirSync("/mnt/c/Users").filter((e) => !SYSTEM.has(e));
    if (entries.length === 1) return entries[0];
  } catch { /* ignora */ }

  return null;
}

function isWSL() {
  try {
    const version = readFileSync("/proc/version", "utf8").toLowerCase();
    return version.includes("microsoft") || version.includes("wsl");
  } catch {
    return false;
  }
}

function getConfigPath() {
  const plat = platform();

  if (plat === "linux" && isWSL()) {
    const winUser = detectWindowsUser();
    if (winUser) {
      return `/mnt/c/Users/${winUser}/AppData/Roaming/Claude/claude_desktop_config.json`;
    }
    warn("Nao foi possivel detectar o usuario Windows. Usando caminho Linux nativo.");
  }

  if (plat === "linux") {
    return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }

  if (plat === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "Claude", "claude_desktop_config.json");
  }

  if (plat === "darwin") {
    return join(homedir(), "Library", "Application Support", "Claude", "claude_desktop_config.json");
  }

  return null;
}

function readConfig(configPath) {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    warn(`Config existente com JSON invalido em ${configPath}. Criando do zero.`);
    return {};
  }
}

// -------------------------------------------------------------------  main  --

try {
  const configPath = getConfigPath();

  if (!configPath) {
    warn("Sistema nao suportado para auto-configuracao. Configure manualmente.");
    process.exit(0);
  }

  const config = readConfig(configPath);
  if (!config.mcpServers) config.mcpServers = {};

  if (config.mcpServers[ENTRY_KEY]) {
    log("Conector ja configurado no Claude Desktop. Nenhuma alteracao necessaria.");
    process.exit(0);
  }

  config.mcpServers[ENTRY_KEY] = {
    command: "claude-wsl-terminal-connector",
  };

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  log("Conector adicionado ao Claude Desktop com sucesso!");
  log(`Config: ${configPath}`);
  log("Reinicie o Claude Desktop para ativar o WSL Workspace Connector.");

} catch (err) {
  warn(`Auto-configuracao falhou: ${err.message}`);
  warn("Adicione manualmente ao claude_desktop_config.json:");
  warn(
    JSON.stringify(
      { mcpServers: { [ENTRY_KEY]: { command: "claude-wsl-terminal-connector" } } },
      null,
      2,
    ),
  );
}
