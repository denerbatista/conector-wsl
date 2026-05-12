import {
  detectDistro,
  detectLinuxUser,
  detectWindowsUser,
  buildDefaultRoots,
} from "./detect.js";
import { parseAllowedRoots, resolveLinuxPath } from "./security.js";
import { log } from "./log.js";

function parsePositiveInt(value, fallback) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Resolve config final do conector combinando env (vinda do user_config do MCPB)
 * com auto-deteccao. Toda variavel vazia/ausente cai pra deteccao.
 */
export function resolveConfig(env = process.env) {
  const distro = detectDistro(env.WSL_CONNECTOR_DISTRO);
  const linuxUser = detectLinuxUser(distro);
  const windowsUser = detectWindowsUser();

  const defaultRoots = buildDefaultRoots({ linuxUser, windowsUser });

  const defaultCwdRaw = (env.WSL_CONNECTOR_DEFAULT_CWD || "").trim();
  const defaultCwd = defaultCwdRaw
    ? resolveLinuxPath(defaultCwdRaw, defaultRoots[0])
    : defaultRoots[0];

  const allowedRoots = parseAllowedRoots(
    env.WSL_CONNECTOR_ALLOWED_ROOTS,
    defaultRoots,
  );

  const timeoutMs = parsePositiveInt(env.WSL_CONNECTOR_TIMEOUT_MS, 120000);
  const maxOutputChars = parsePositiveInt(
    env.WSL_CONNECTOR_MAX_OUTPUT_CHARS,
    16000,
  );
  const maxFileChars = parsePositiveInt(
    env.WSL_CONNECTOR_MAX_FILE_CHARS,
    100000,
  );

  const cfg = {
    distro,
    linuxUser,
    windowsUser,
    defaultCwd,
    allowedRoots,
    timeoutMs,
    maxOutputChars,
    maxFileChars,
  };

  log.info("config.resolved", {
    distro: cfg.distro || null,
    defaultCwd: cfg.defaultCwd,
    allowedRoots: cfg.allowedRoots,
    autoDetected: {
      distro: !env.WSL_CONNECTOR_DISTRO,
      defaultCwd: !defaultCwdRaw,
      allowedRoots: !env.WSL_CONNECTOR_ALLOWED_ROOTS,
    },
  });

  return cfg;
}
