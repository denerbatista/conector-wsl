#!/usr/bin/env node
// Copia name/version do package.json para src/version.js, manifest.json e .claude-plugin/plugin.json.
// Roda automaticamente no lifecycle `npm version` (ver package.json > scripts.version).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const versionJs = [
  "// Mantido em sincronia com package.json por scripts/sync-version.js (hook `npm version`).",
  "// Fica num modulo proprio para o bundle (esbuild) nao depender de package.json em runtime.",
  `export const PKG_NAME = ${JSON.stringify(pkg.name)};`,
  `export const PKG_VERSION = ${JSON.stringify(pkg.version)};`,
  "",
].join("\n");
writeFileSync(join(root, "src", "version.js"), versionJs);

const manifestPath = join(root, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
manifest.version = pkg.version;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

const pluginPath = join(root, ".claude-plugin", "plugin.json");
const plugin = JSON.parse(readFileSync(pluginPath, "utf8"));
plugin.version = pkg.version;
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + "\n");

console.warn(`[sync-version] src/version.js, manifest.json e plugin.json -> ${pkg.version}`);
