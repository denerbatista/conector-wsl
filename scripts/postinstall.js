#!/usr/bin/env node
/**
 * postinstall.js
 *
 * Roda automaticamente apos: npm install -g claude-wsl-terminal-connector
 *
 * Detecta o ambiente (Windows nativo, WSL, Linux puro, macOS),
 * localiza o claude_desktop_config.json correto e adiciona/atualiza
 * a entrada do conector com o COMANDO ABSOLUTO certo pro Cowork
 * Desktop conseguir spawnar mesmo sem PATH herdado.
 *
 * Cenarios suportados:
 *  - npm i -g rodado no PowerShell do Windows -> Cowork Windows
 *  - npm i -g rodado dentro do WSL          -> Cowork Windows (via wsl.exe)
 *  - npm i -g rodado no Linux nativo        -> Cowork Linux
 *  - npm i -g rodado no macOS               -> Cowork macOS
 *
 * Variaveis de ambiente:
 *  - CLAUDE_WSL_SKIP_REGISTER=1   pula o auto-registro
 *  - CLAUDE_WSL_CONFIG_PATH=...   forca um caminho de config (testes/custom)
 */

import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  copyFileSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { homedir, platform } from "node:os";
import { execFileSync } from "node:child_process";

const ENTRY_KEY = "wsl-connector";
const BIN_NAME = "claude-wsl-terminal-connector";
const TAG = "[WSL Connector]";

function log(msg) {
  console.log(`${TAG} ${msg}`);
}
function warn(msg) {
  console.warn(`${TAG} aviso: ${msg}`);
}

// Nao roda durante desenvolvimento local (apenas global install)
if (!process.env.npm_config_global) {
  process.exit(0);
}

// Opt-out explicito
if (process.env.CLAUDE_WSL_SKIP_REGISTER === "1") {
  log("CLAUDE_WSL_SKIP_REGISTER=1 detectado. Auto-registro pulado.");
  process.exit(0);
}

// ---------------------------------------------------------------- helpers ----

function isWSL() {
  if (platform() !== "linux") return false;
  try {
    const version = readFileSync("/proc/version", "utf8").toLowerCase();
    return version.includes("microsoft") || version.includes("wsl");
  } catch {
    return false;
  }
}

function detectWslDistro() {
  // WSL_DISTRO_NAME e setada automaticamente dentro do WSL
  return process.env.WSL_DISTRO_NAME || null;
}

function detectWindowsUser() {
  // 1. Tenta via USERPROFILE do Windows (acessivel de dentro do WSL via cmd.exe)
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

  // 2. Fallback: unico usuario em /mnt/c/Users/ que nao e do sistema
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
  // Override explicito (util pra testes e setups customizados)
  if (process.env.CLAUDE_WSL_CONFIG_PATH) {
    return process.env.CLAUDE_WSL_CONFIG_PATH;
  }

  const plat = platform();

  if (plat === "linux" && isWSL()) {
    const winUser = detectWindowsUser();
    if (winUser) {
      return `/mnt/c/Users/${winUser}/AppData/Roaming/Claude/claude_desktop_config.json`;
    }
    warn(
      "Nao foi possivel detectar o usuario Windows. Usando caminho Linux nativo (fallback).",
    );
  }

  if (plat === "linux") {
    return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
  }

  if (plat === "win32") {
    const appData =
      process.env.APPDATA || join(homedir(), "AppData", "Roaming");
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

/**
 * Resolve o "command" e "args" que o Cowork Desktop deve usar pra
 * spawnar o conector. Esse e o ponto mais critico: o Cowork nao
 * passa por shell, entao PATH do .bashrc/perfil NAO vale.
 *
 * Cenarios:
 *  - Windows nativo: usa o .cmd shim absoluto que o npm cria.
 *  - WSL (Cowork rodando no Windows): usa wsl.exe -d <distro> -- <bin>.
 *  - Linux puro: caminho absoluto do bin.
 *  - macOS: caminho absoluto do bin.
 */
function resolveCommandEntry() {
  const plat = platform();

  // npm exporta o prefix global; npm_config_prefix tambem fica disponivel.
  const npmPrefix =
    process.env.npm_config_prefix ||
    (() => {
      try {
        return execFileSync("npm", ["prefix", "-g"], {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
      } catch {
        return null;
      }
    })();

  // -------- Windows nativo
  if (plat === "win32") {
    if (npmPrefix) {
      const cmd = join(npmPrefix, `${BIN_NAME}.cmd`);
      if (existsSync(cmd)) return { command: cmd };
    }
    // Fallback: PATH (pode falhar no Cowork, mas deixamos como ultimo recurso)
    return { command: `${BIN_NAME}.cmd` };
  }

  // -------- WSL: precisa rodar via wsl.exe pro Cowork (Windows) achar
  if (plat === "linux" && isWSL()) {
    const distro = detectWslDistro();

    // Caminho absoluto do bin DENTRO do WSL
    let binPath = null;
    if (npmPrefix) {
      const candidate = join(npmPrefix, "bin", BIN_NAME);
      if (existsSync(candidate)) binPath = candidate;
    }
    if (!binPath) {
      try {
        binPath = execFileSync("which", [BIN_NAME], {
          stdio: ["ignore", "pipe", "ignore"],
        })
          .toString()
          .trim();
      } catch {
        /* ignora */
      }
    }

    if (!binPath) {
      warn(
        "Nao consegui resolver caminho absoluto do bin no WSL. Usando nome simples (pode falhar no Cowork).",
      );
      binPath = BIN_NAME;
    }

    const args = [];
    if (distro) args.push("-d", distro);
    args.push("--", binPath);

    return {
      command: "wsl.exe",
      args,
    };
  }

  // -------- Linux puro ou macOS
  if (npmPrefix) {
    const candidate = join(npmPrefix, "bin", BIN_NAME);
    if (existsSync(candidate)) return { command: candidate };
  }
  try {
    const binPath = execFileSync("which", [BIN_NAME], {
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
    if (binPath) return { command: binPath };
  } catch {
    /* ignora */
  }

  return { command: BIN_NAME };
}

function readConfig(configPath) {
  if (!existsSync(configPath)) return {};
  try {
    return JSON.parse(readFileSync(configPath, "utf8"));
  } catch {
    warn(
      `Config existente com JSON invalido em ${configPath}. Criando do zero (com backup).`,
    );
    return {};
  }
}

function backupConfig(configPath) {
  if (!existsSync(configPath)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const bakPath = `${configPath}.bak-${stamp}`;
  try {
    copyFileSync(configPath, bakPath);
    return bakPath;
  } catch (err) {
    warn(`Falha ao criar backup: ${err.message}`);
    return null;
  }
}

function entriesEqual(a, b) {
  if (!a || !b) return false;
  if (a.command !== b.command) return false;
  const aArgs = JSON.stringify(a.args || []);
  const bArgs = JSON.stringify(b.args || []);
  if (aArgs !== bArgs) return false;
  return JSON.stringify(a.env || {}) === JSON.stringify(b.env || {});
}

// ------------------------------------------------------------------- main ---

try {
  const configPath = getConfigPath();

  if (!configPath) {
    warn(
      "Sistema nao suportado para auto-configuracao. Configure manualmente.",
    );
    process.exit(0);
  }

  // Instalacao global = Claude Desktop/Cowork: sempre modo full (todas as tools).
  // A autodeteccao ja cobre o Windows; o env garante o caso "bin dentro do WSL via wsl.exe".
  const desiredEntry = {
    ...resolveCommandEntry(),
    env: { WSL_CONNECTOR_MODE: "full" },
  };
  const config = readConfig(configPath);
  if (!config.mcpServers) config.mcpServers = {};

  const existing = config.mcpServers[ENTRY_KEY];
  if (existing && entriesEqual(existing, desiredEntry)) {
    log("Conector ja configurado e atualizado. Nenhuma alteracao necessaria.");
    log(`Config: ${configPath}`);
    process.exit(0);
  }

  // Backup so se vamos modificar
  const bak = backupConfig(configPath);
  if (bak) log(`Backup criado: ${bak}`);

  config.mcpServers[ENTRY_KEY] = desiredEntry;

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf8");

  const action = existing ? "atualizado" : "adicionado";
  log(`Conector ${action} no Claude Desktop com sucesso!`);
  log(`Config: ${configPath}`);
  log(
    `Comando registrado: ${desiredEntry.command}${
      desiredEntry.args ? " " + desiredEntry.args.join(" ") : ""
    }`,
  );
  log("Reinicie o Claude Desktop para ativar o WSL Workspace Connector.");
} catch (err) {
  warn(`Auto-configuracao falhou: ${err.message}`);
  warn("Adicione manualmente ao claude_desktop_config.json:");
  warn(
    JSON.stringify(
      {
        mcpServers: {
          [ENTRY_KEY]: { command: BIN_NAME },
        },
      },
      null,
      2,
    ),
  );
  // Importante: nao falhar o install por causa do registro
  process.exit(0);
}
