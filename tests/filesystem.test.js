import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("toHostPath", () => {
  const original = process.platform;
  let toHostPath;

  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    Object.defineProperty(process, "platform", { value: original });
  });

  it("Linux nativo: passa o path direto", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(toHostPath("/home/joao", {})).toBe("/home/joao");
  });

  it("Windows + /mnt/c/...: converte pra path Windows nativo (sem UNC)", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(toHostPath("/mnt/c/Users/Joao", { distro: "Ubuntu-24.04" })).toBe(
      "C:\\Users\\Joao",
    );
  });

  it("Windows + /mnt/d/...: usa letra D", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(toHostPath("/mnt/d/dados/x", { distro: "Ubuntu" })).toBe(
      "D:\\dados\\x",
    );
  });

  it("Windows + /home/...: usa UNC \\\\wsl.localhost\\<distro>", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(toHostPath("/home/joao", { distro: "Ubuntu" })).toBe(
      "\\\\wsl.localhost\\Ubuntu\\home\\joao",
    );
  });

  it("Windows sem distro lanca pra path nao-mnt", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(() => toHostPath("/home/joao", {})).toThrow(/distribuicao wsl/i);
  });

  it("Windows sem distro funciona pra /mnt/c (nao precisa de distro)", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    ({ toHostPath } = await import("../src/filesystem.js"));
    expect(toHostPath("/mnt/c/Users/x", {})).toBe("C:\\Users\\x");
  });
});
