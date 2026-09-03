import { describe, it, expect } from "vitest";

import { decideMode, isCliClient, normalizeMode } from "../src/mode.js";
import {
  registerCoreTools,
  registerFullTools,
  registerAllTools,
} from "../src/tools/index.js";

function fakeServer() {
  const names = [];
  return { names, tool: (name) => names.push(name) };
}

function fakeCtx() {
  return {
    config: {
      distro: "Ubuntu",
      defaultCwd: "/home/joao",
      allowedRoots: ["/home/joao"],
      timeoutMs: 1000,
      maxOutputChars: 1000,
      maxFileChars: 1000,
    },
    sessions: new Map(),
    runtime: {
      mode: "pending",
      clientName: null,
      windows: { available: false, powershell: null },
    },
  };
}

describe("normalizeMode / isCliClient", () => {
  it("aceita auto|full|silent e cai em auto para o resto", () => {
    expect(normalizeMode("FULL")).toBe("full");
    expect(normalizeMode(" silent ")).toBe("silent");
    expect(normalizeMode(undefined)).toBe("auto");
    expect(normalizeMode("xpto")).toBe("auto");
  });

  it("reconhece o Claude Code pelo clientInfo.name", () => {
    expect(isCliClient("claude-code")).toBe(true);
    expect(isCliClient("Claude Code")).toBe(true);
    expect(isCliClient("claude-ai")).toBe(false);
    expect(isCliClient("vitest-smoke")).toBe(false);
    expect(isCliClient(null)).toBe(false);
  });
});

describe("decideMode", () => {
  it("auto: claude-code -> silent; outros -> full", () => {
    expect(decideMode({ env: {}, clientName: "claude-code" })).toBe("silent");
    expect(decideMode({ env: {}, clientName: "claude-ai" })).toBe("full");
    expect(decideMode({ env: {}, clientName: null })).toBe("full");
  });

  it("env forca o modo", () => {
    expect(
      decideMode({
        env: { WSL_CONNECTOR_MODE: "full" },
        clientName: "claude-code",
      }),
    ).toBe("full");
    expect(
      decideMode({
        env: { WSL_CONNECTOR_MODE: "silent" },
        clientName: "claude-ai",
      }),
    ).toBe("silent");
  });
});

describe("registro de tools por modo", () => {
  it("core registra so status", () => {
    const s = fakeServer();
    registerCoreTools(s, fakeCtx());
    expect(s.names).toEqual(["connector_status", "list_allowed_roots"]);
  });

  it("full sem PowerShell: WSL + filesystem, sem tools Windows", () => {
    const s = fakeServer();
    const ctx = fakeCtx();
    registerFullTools(s, ctx, { env: {} });
    expect(s.names).toContain("run_wsl_command");
    expect(s.names).toContain("read_text_file");
    expect(s.names).not.toContain("run_windows_command");
    expect(ctx.runtime.windows.available).toBe(false);
  });

  it("full com PowerShell (override): registra o lado Windows", () => {
    const s = fakeServer();
    const ctx = fakeCtx();
    registerFullTools(s, ctx, {
      env: { WSL_CONNECTOR_POWERSHELL: "C:\\ps.exe" },
    });
    expect(s.names).toEqual(
      expect.arrayContaining([
        "run_windows_command",
        "start_windows_session",
        "run_in_windows_session",
        "close_windows_session",
        "open_in_windows",
      ]),
    );
    expect(ctx.runtime.windows).toEqual({
      available: true,
      powershell: "C:\\ps.exe",
    });
  });

  it("registerAllTools = core + full", () => {
    const s = fakeServer();
    registerAllTools(s, fakeCtx(), { env: {} });
    expect(s.names[0]).toBe("connector_status");
    expect(s.names).toContain("close_wsl_session");
  });
});
