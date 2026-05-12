import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Buffer } from "node:buffer";

import { log } from "./log.js";

const IS_WINDOWS = process.platform === "win32";

/**
 * Detecta a distro WSL ativa.
 * Ordem: override -> WSL_DISTRO_NAME (rodando dentro do WSL) -> wsl.exe --list -> fallback.
 */
export function detectDistro(override) {
  const explicit = (override || "").trim();
  if (explicit) return explicit;

  if (process.env.WSL_DISTRO_NAME) {
    return process.env.WSL_DISTRO_NAME.trim();
  }

  if (!IS_WINDOWS) {
    return "";
  }

  try {
    const buf = execFileSync("wsl.exe", ["--list", "--verbose"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    const detected = parseWslListVerbose(buf);
    if (detected) return detected;
  } catch (err) {
    log.warn("detect.distro.fail", { error: String(err?.message || err) });
  }

  return "Ubuntu";
}

export function parseWslListVerbose(bufferOrText) {
  const text = Buffer.isBuffer(bufferOrText)
    ? bufferOrText.toString("utf16le")
    : String(bufferOrText || "");

  const lines = text
    .replace(/\0/g, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = lines.filter((line) => !/^NAME\s+STATE\s+VERSION$/i.test(line));
  const parseName = (line) => line.replace(/^\*\s*/, "").trim().split(/\s+/)[0];

  const defaultLine = entries.find((line) => line.startsWith("*"));
  const defaultName = defaultLine ? parseName(defaultLine) : "";
  if (defaultName) return defaultName;

  for (const line of entries) {
    const name = parseName(line);
    if (name && name.toUpperCase() !== "NAME") return name;
  }

  return "";
}

/**
 * Detecta o usuario Linux dentro do WSL.
 * Ordem: $USER -> os.userInfo() -> wsl.exe -d <distro> -- whoami.
 */
export function detectLinuxUser(distro) {
  if (!IS_WINDOWS) {
    if (process.env.USER) return process.env.USER.trim();
    try {
      return os.userInfo().username;
    } catch {
      return "";
    }
  }

  if (!distro) return "";

  try {
    const buf = execFileSync("wsl.exe", ["-d", distro, "--", "whoami"], {
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 10000,
    });
    return buf.toString("utf8").trim().replace(/\r/g, "");
  } catch (err) {
    log.warn("detect.linuxUser.fail", { error: String(err?.message || err) });
    return "";
  }
}

/**
 * Detecta o usuario Windows ativo. Retorna null se nao for Windows.
 * Usa `path.win32.basename` para entender o separador `\` mesmo se o
 * processo Node estiver rodando em Linux (util para testes).
 */
export function detectWindowsUser() {
  if (!IS_WINDOWS) return null;
  if (process.env.USERPROFILE) {
    return path.win32.basename(process.env.USERPROFILE);
  }
  if (process.env.USERNAME) return process.env.USERNAME;
  return null;
}

/**
 * Monta lista de roots permitidos default (auto-detectada).
 */
export function buildDefaultRoots({ linuxUser, windowsUser }) {
  const roots = [];
  if (linuxUser) roots.push(`/home/${linuxUser}`);
  if (windowsUser) roots.push(`/mnt/c/Users/${windowsUser}`);
  if (roots.length === 0) roots.push("/home");
  return roots;
}
