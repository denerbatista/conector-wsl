import path from "node:path";

/**
 * Normaliza um caminho Linux: corrige `\` -> `/`, resolve `..` relativos.
 * Caminhos relativos sao resolvidos contra basePath.
 */
export function resolveLinuxPath(value, basePath) {
  const raw = (value || basePath || "/").replace(/\\/g, "/");
  if (raw.startsWith("/")) {
    return path.posix.normalize(raw);
  }
  return path.posix.normalize(path.posix.join(basePath, raw));
}

/**
 * Parseia "/home/a:/mnt/c/Users/b" em array, normalizando cada item.
 */
export function parseAllowedRoots(value, fallbackRoots) {
  if (!value || typeof value !== "string" || !value.trim()) {
    return Array.from(new Set(fallbackRoots));
  }
  const roots = value
    .split(":")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => resolveLinuxPath(entry, entry));
  return Array.from(new Set(roots.length ? roots : fallbackRoots));
}

/**
 * Decide se candidate cai dentro de algum root permitido.
 * Apos `path.posix.normalize` o `..` ja foi resolvido, eliminando traversal.
 */
export function isPathAllowed(candidate, allowedRoots) {
  const norm = path.posix.normalize(candidate);
  return allowedRoots.some(
    (root) => norm === root || norm.startsWith(`${root}/`),
  );
}

export class PathNotAllowedError extends Error {
  constructor(candidate) {
    super(
      `Caminho fora do escopo permitido: ${candidate}. Ajuste allowed_roots se quiser liberar outro caminho.`,
    );
    this.name = "PathNotAllowedError";
    this.candidate = candidate;
  }
}
