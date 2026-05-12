import path from "node:path";
import fs from "node:fs/promises";
import { Buffer } from "node:buffer";
import { z } from "zod";

import { isPathAllowed, resolveLinuxPath } from "../security.js";
import {
  toHostPath,
  detectEntryType,
  compareDirectoryEntries,
  truncateText,
} from "../filesystem.js";
import { textResult } from "../util.js";

function resolveFsPath(requestedPath, ctx) {
  const candidate = resolveLinuxPath(requestedPath, ctx.config.defaultCwd);
  if (!isPathAllowed(candidate, ctx.config.allowedRoots)) {
    throw new Error(
      `Caminho fora do escopo permitido: ${candidate}. Ajuste allowed_roots se quiser liberar outro caminho.`,
    );
  }
  return candidate;
}

async function pathExists(hostPath) {
  try {
    await fs.access(hostPath);
    return true;
  } catch {
    return false;
  }
}

export function registerFilesystemTools(server, ctx) {
  server.tool(
    "list_directory",
    "Lista arquivos e pastas dentro de um diretorio permitido do WSL.",
    { path: z.string().min(1).optional() },
    async ({ path: requested }) => {
      const resolved = resolveFsPath(requested || ctx.config.defaultCwd, ctx);
      const hostPath = toHostPath(resolved, { distro: ctx.config.distro });
      const dirEntries = await fs.readdir(hostPath, { withFileTypes: true });

      const entries = await Promise.all(
        dirEntries.map(async (entry) => {
          const entryPath = path.posix.join(resolved, entry.name);
          const stats = await fs.lstat(
            toHostPath(entryPath, { distro: ctx.config.distro }),
          );
          return {
            name: entry.name,
            path: entryPath,
            type: detectEntryType(stats),
            size: stats.isFile() ? stats.size : null,
            modifiedAt: stats.mtime.toISOString(),
          };
        }),
      );
      entries.sort(compareDirectoryEntries);

      return textResult(JSON.stringify({ path: resolved, entries }, null, 2));
    },
  );

  server.tool(
    "get_path_info",
    "Retorna tipo, tamanho e datas de um caminho permitido do WSL.",
    { path: z.string().min(1) },
    async ({ path: requested }) => {
      const resolved = resolveFsPath(requested, ctx);
      const stats = await fs.lstat(
        toHostPath(resolved, { distro: ctx.config.distro }),
      );
      return textResult(
        JSON.stringify(
          {
            path: resolved,
            type: detectEntryType(stats),
            size: stats.isFile() ? stats.size : null,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "read_text_file",
    "Le um arquivo de texto do WSL dentro das roots permitidas.",
    {
      path: z.string().min(1),
      maxChars: z.number().int().positive().max(500000).optional(),
    },
    async ({ path: requested, maxChars }) => {
      const resolved = resolveFsPath(requested, ctx);
      const hostPath = toHostPath(resolved, { distro: ctx.config.distro });
      const contents = await fs.readFile(hostPath, "utf8");
      const trunc = truncateText(contents, maxChars ?? ctx.config.maxFileChars);
      return textResult(
        JSON.stringify(
          { path: resolved, truncated: trunc.truncated, content: trunc.value },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "write_text_file",
    "Escreve um arquivo de texto no WSL dentro das roots permitidas.",
    {
      path: z.string().min(1),
      content: z.string(),
      overwrite: z.boolean().optional(),
      createParents: z.boolean().optional(),
    },
    async ({ path: requested, content, overwrite, createParents }) => {
      const resolved = resolveFsPath(requested, ctx);
      const hostPath = toHostPath(resolved, { distro: ctx.config.distro });

      if (createParents ?? true) {
        await fs.mkdir(path.dirname(hostPath), { recursive: true });
      }
      if (!(overwrite ?? false) && (await pathExists(hostPath))) {
        throw new Error(
          `Arquivo ja existe: ${resolved}. Use overwrite=true para sobrescrever.`,
        );
      }
      await fs.writeFile(hostPath, content, "utf8");
      return textResult(
        JSON.stringify(
          {
            path: resolved,
            written: true,
            bytes: Buffer.byteLength(content, "utf8"),
          },
          null,
          2,
        ),
      );
    },
  );

  server.tool(
    "create_directory",
    "Cria um diretorio dentro das roots permitidas do WSL.",
    {
      path: z.string().min(1),
      recursive: z.boolean().optional(),
    },
    async ({ path: requested, recursive }) => {
      const resolved = resolveFsPath(requested, ctx);
      const hostPath = toHostPath(resolved, { distro: ctx.config.distro });
      await fs.mkdir(hostPath, { recursive: recursive ?? true });
      return textResult(
        JSON.stringify({ path: resolved, created: true }, null, 2),
      );
    },
  );
}
