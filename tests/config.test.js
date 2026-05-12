import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka detect pra ter resultados determinísticos
vi.mock("../src/detect.js", () => ({
  detectDistro: (v) => (v ? v : "Ubuntu-Mock"),
  detectLinuxUser: () => "joao",
  detectWindowsUser: () => "Joao",
  buildDefaultRoots: ({ linuxUser, windowsUser }) => {
    const r = [];
    if (linuxUser) r.push(`/home/${linuxUser}`);
    if (windowsUser) r.push(`/mnt/c/Users/${windowsUser}`);
    return r.length ? r : ["/home"];
  },
}));

describe("resolveConfig", () => {
  let resolveConfig;
  beforeEach(async () => {
    vi.resetModules();
    ({ resolveConfig } = await import("../src/config.js"));
  });

  it("zero-config: usa defaults auto-detectados", () => {
    const cfg = resolveConfig({});
    expect(cfg.distro).toBe("Ubuntu-Mock");
    expect(cfg.defaultCwd).toBe("/home/joao");
    expect(cfg.allowedRoots).toEqual(["/home/joao", "/mnt/c/Users/Joao"]);
    expect(cfg.timeoutMs).toBe(120000);
  });

  it("override de distro via env", () => {
    const cfg = resolveConfig({ WSL_CONNECTOR_DISTRO: "Debian" });
    expect(cfg.distro).toBe("Debian");
  });

  it("override de cwd via env", () => {
    const cfg = resolveConfig({
      WSL_CONNECTOR_DEFAULT_CWD: "/home/joao/projetos",
    });
    expect(cfg.defaultCwd).toBe("/home/joao/projetos");
  });

  it("override de roots via env", () => {
    const cfg = resolveConfig({
      WSL_CONNECTOR_ALLOWED_ROOTS: "/srv:/data",
    });
    expect(cfg.allowedRoots).toEqual(["/srv", "/data"]);
  });

  it("timeout invalido cai pra default 120000", () => {
    const cfg = resolveConfig({ WSL_CONNECTOR_TIMEOUT_MS: "abc" });
    expect(cfg.timeoutMs).toBe(120000);
  });

  it("strings vazias caem pra auto-deteccao", () => {
    const cfg = resolveConfig({
      WSL_CONNECTOR_DISTRO: "",
      WSL_CONNECTOR_DEFAULT_CWD: "",
      WSL_CONNECTOR_ALLOWED_ROOTS: "",
    });
    expect(cfg.distro).toBe("Ubuntu-Mock");
    expect(cfg.defaultCwd).toBe("/home/joao");
    expect(cfg.allowedRoots).toEqual(["/home/joao", "/mnt/c/Users/Joao"]);
  });
});
