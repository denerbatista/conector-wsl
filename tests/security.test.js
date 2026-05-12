import { describe, it, expect } from "vitest";
import {
  resolveLinuxPath,
  parseAllowedRoots,
  isPathAllowed,
} from "../src/security.js";

describe("resolveLinuxPath", () => {
  it("normaliza barras invertidas", () => {
    expect(resolveLinuxPath("\\home\\foo", "/home")).toBe("/home/foo");
  });

  it("preserva paths absolutos", () => {
    expect(resolveLinuxPath("/etc/hosts", "/home")).toBe("/etc/hosts");
  });

  it("resolve relativos contra basePath", () => {
    expect(resolveLinuxPath("projetos/x", "/home/joao")).toBe(
      "/home/joao/projetos/x",
    );
  });

  it("normaliza .. relativos", () => {
    expect(resolveLinuxPath("/home/joao/projetos/../x", "/")).toBe(
      "/home/joao/x",
    );
  });
});

describe("parseAllowedRoots", () => {
  it("split por : e normaliza", () => {
    expect(parseAllowedRoots("/home/a:/mnt/c/Users/b", ["/home"])).toEqual([
      "/home/a",
      "/mnt/c/Users/b",
    ]);
  });

  it("usa fallback quando vazio", () => {
    expect(parseAllowedRoots("", ["/home/x"])).toEqual(["/home/x"]);
    expect(parseAllowedRoots(undefined, ["/home/x"])).toEqual(["/home/x"]);
  });

  it("deduplica", () => {
    expect(parseAllowedRoots("/home/a:/home/a:/mnt/c", ["/fallback"])).toEqual([
      "/home/a",
      "/mnt/c",
    ]);
  });
});

describe("isPathAllowed", () => {
  const roots = ["/home/joao", "/mnt/c/Users/Joao"];

  it("aceita root exato", () => {
    expect(isPathAllowed("/home/joao", roots)).toBe(true);
  });

  it("aceita subpath", () => {
    expect(isPathAllowed("/home/joao/projetos/x", roots)).toBe(true);
  });

  it("rejeita fora de qualquer root", () => {
    expect(isPathAllowed("/etc/passwd", roots)).toBe(false);
    expect(isPathAllowed("/home/outro", roots)).toBe(false);
  });

  it("nao engana com prefix sem barra", () => {
    // /home/joaozinho NAO eh subpath de /home/joao
    expect(isPathAllowed("/home/joaozinho", roots)).toBe(false);
  });
});
