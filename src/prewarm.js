import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

import { log } from "./log.js";

/**
 * Pre-aquecimento do cache do npx para OUTROS MCPs stdio do mesmo plugin.
 *
 * Contexto: no Cowork (Claude Desktop) um MCP `npx -y pacote@versao` em cache frio
 * estoura o timeout de 30 s e a falha fica cacheada por 15 min. Este conector sobe
 * instantaneo (vem embutido no plugin), entao ele aquece os demais em segundo plano:
 *
 *   WSL_CONNECTOR_PREWARM="chrome-devtools-mcp@1.8.0 outro-pacote@1.2.3"
 *
 * Roda `npx -y <spec> --help` desacoplado (detached, stdio ignorado), uma vez por spec,
 * marcando em ~/.claude-wsl-connector/prewarm.json. So em modo full (no CLI nao faz sentido).
 */

export function parsePrewarmSpecs(value) {
  return String(value || "")
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter((s) => /^[@a-z0-9][\w./@-]*$/i.test(s));
}

export function defaultMarkerPath({ homedir = os.homedir } = {}) {
  return path.join(homedir(), ".claude-wsl-connector", "prewarm.json");
}

export function readMarker(markerPath, { fsImpl = fs } = {}) {
  try {
    return JSON.parse(fsImpl.readFileSync(markerPath, "utf8"));
  } catch {
    return {};
  }
}

export function writeMarker(markerPath, data, { fsImpl = fs } = {}) {
  try {
    fsImpl.mkdirSync(path.dirname(markerPath), { recursive: true });
    fsImpl.writeFileSync(markerPath, JSON.stringify(data, null, 2) + "\n");
    return true;
  } catch (err) {
    log.warn("prewarm.marker.fail", { error: String(err?.message || err) });
    return false;
  }
}

/** Comando desacoplado; `shell: true` resolve npx.cmd no Windows e npx no Linux. */
export function spawnPrewarm(
  spec,
  { spawnImpl = spawn, platform = process.platform } = {},
) {
  const cmd =
    platform === "win32"
      ? `npx -y ${spec} --help < nul`
      : `npx -y ${spec} --help </dev/null`;
  const child = spawnImpl(cmd, {
    shell: true,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref?.();
  return child;
}

/**
 * Executa o pre-aquecimento para os specs ainda nao marcados. Retorna os que disparou.
 */
export function runPrewarm({
  env = process.env,
  markerPath = defaultMarkerPath(),
  spawnImpl = spawn,
  fsImpl = fs,
  platform = process.platform,
  now = () => new Date().toISOString(),
} = {}) {
  const specs = parsePrewarmSpecs(env.WSL_CONNECTOR_PREWARM);
  if (specs.length === 0) return [];

  const marker = readMarker(markerPath, { fsImpl });
  const started = [];
  for (const spec of specs) {
    if (marker[spec]) continue;
    try {
      spawnPrewarm(spec, { spawnImpl, platform });
      marker[spec] = now();
      started.push(spec);
    } catch (err) {
      log.warn("prewarm.spawn.fail", {
        spec,
        error: String(err?.message || err),
      });
    }
  }
  if (started.length) {
    writeMarker(markerPath, marker, { fsImpl });
    log.info("prewarm.started", { specs: started, marker: markerPath });
  }
  return started;
}
