const IS_WINDOWS = process.platform === "win32";
const MNT_RE = /^\/mnt\/([a-z])(\/.*)?$/i;

/**
 * Converte um caminho Linux/WSL para o caminho host que o `fs` do Node entende.
 *
 * Linux nativo: retorna o caminho como esta.
 *
 * Windows:
 *  - Se for /mnt/<letra>/..., converte para <Letra>:\... (path Windows nativo).
 *    Isso evita o loop UNC -> WSL -> UNC que dava EPERM.
 *  - Caso contrario, usa \\wsl.localhost\<distro>\... (UNC).
 *
 * Lanca se Windows e nao houver distro setada (necessaria pro UNC).
 */
export function toHostPath(linuxPath, { distro } = {}) {
  if (!IS_WINDOWS) return linuxPath;

  const m = linuxPath.match(MNT_RE);
  if (m) {
    const letter = m[1].toUpperCase();
    const rest = (m[2] || "").replace(/\//g, "\\");
    return `${letter}:${rest || "\\"}`;
  }

  if (!distro) {
    throw new Error(
      "Distribuicao WSL nao detectada. Tools de filesystem precisam de uma distro.",
    );
  }

  const relative = linuxPath.replace(/^\/+/, "").replace(/\//g, "\\");
  return relative
    ? `\\\\wsl.localhost\\${distro}\\${relative}`
    : `\\\\wsl.localhost\\${distro}`;
}

export function detectEntryType(stats) {
  if (stats.isDirectory()) return "directory";
  if (stats.isFile()) return "file";
  if (stats.isSymbolicLink()) return "symlink";
  return "other";
}

export function compareDirectoryEntries(left, right) {
  if (left.type === right.type) {
    return left.name.localeCompare(right.name, "pt-BR");
  }
  if (left.type === "directory") return -1;
  if (right.type === "directory") return 1;
  return left.name.localeCompare(right.name, "pt-BR");
}

export function truncateText(value, maxChars) {
  if (value.length <= maxChars) {
    return { value: value.trimEnd(), truncated: false };
  }
  const suffix = `\n...[truncado em ${maxChars} caracteres]`;
  return {
    value: `${value.slice(0, maxChars)}${suffix}`.trimEnd(),
    truncated: true,
  };
}
