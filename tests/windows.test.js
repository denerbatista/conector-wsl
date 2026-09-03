import { describe, it, expect, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Buffer } from "node:buffer";

import {
  buildPowerShellScript,
  encodePowerShell,
  executePowerShell,
  extractWindowsSessionData,
  isUrl,
  isWindowsPath,
  makeWindowsSession,
  psQuote,
  resolvePowerShell,
  toLinuxPath,
  toWindowsPath,
} from "../src/windows.js";

describe("psQuote", () => {
  it("envolve em aspas simples e dobra aspas internas", () => {
    expect(psQuote("abc")).toBe("'abc'");
    expect(psQuote("it's")).toBe("'it''s'");
  });
});

describe("toWindowsPath", () => {
  it("/mnt/c/... vira C:\\...", () => {
    expect(toWindowsPath("/mnt/c/Users/Joao/Docs")).toBe(
      "C:\\Users\\Joao\\Docs",
    );
    expect(toWindowsPath("/mnt/d")).toBe("D:\\");
  });

  it("/home/... vira UNC do WSL usando a distro", () => {
    expect(toWindowsPath("/home/joao/x", { distro: "Ubuntu-24.04" })).toBe(
      "\\\\wsl.localhost\\Ubuntu-24.04\\home\\joao\\x",
    );
  });

  it("/home sem distro lanca", () => {
    expect(() => toWindowsPath("/home/joao")).toThrow(/distro/i);
  });

  it("caminho Windows passa direto", () => {
    expect(toWindowsPath("C:\\Temp")).toBe("C:\\Temp");
    expect(toWindowsPath("\\\\srv\\share")).toBe("\\\\srv\\share");
  });
});

describe("toLinuxPath", () => {
  it("C:\\Users\\X vira /mnt/c/Users/X", () => {
    expect(toLinuxPath("C:\\Users\\Joao")).toBe("/mnt/c/Users/Joao");
    expect(toLinuxPath("D:\\")).toBe("/mnt/d");
  });

  it("UNC do WSL vira caminho Linux", () => {
    expect(toLinuxPath("\\\\wsl.localhost\\Ubuntu-24.04\\home\\joao")).toBe(
      "/home/joao",
    );
    expect(toLinuxPath("\\\\wsl$\\Ubuntu\\home\\joao\\a")).toBe("/home/joao/a");
  });

  it("Linux passa direto e normaliza", () => {
    expect(toLinuxPath("/home/joao/../joao/x")).toBe("/home/joao/x");
  });

  it("UNC fora do WSL retorna null", () => {
    expect(toLinuxPath("\\\\servidor\\share")).toBe(null);
  });
});

describe("isWindowsPath / isUrl", () => {
  it("reconhece drive e UNC", () => {
    expect(isWindowsPath("C:\\x")).toBe(true);
    expect(isWindowsPath("\\\\wsl.localhost\\U")).toBe(true);
    expect(isWindowsPath("/home")).toBe(false);
  });
  it("reconhece URLs", () => {
    expect(isUrl("https://example.com")).toBe(true);
    expect(isUrl("C:\\x")).toBe(false);
  });
});

describe("buildPowerShellScript", () => {
  it("forca UTF-8, entra no cwd, roda body e imprime marker", () => {
    const s = buildPowerShellScript({
      cwd: "C:\\Users\\Joao",
      body: "Get-ChildItem",
      cwdMarker: "__M__",
    });
    expect(s).toContain("[Console]::OutputEncoding");
    expect(s).toContain("Set-Location -LiteralPath 'C:\\Users\\Joao'");
    expect(s.indexOf("Set-Location")).toBeLessThan(s.indexOf("Get-ChildItem"));
    expect(s).toContain('Write-Output ("__M__" + (Get-Location).Path)');
    expect(s.trim().endsWith("exit $__ec")).toBe(true);
  });

  it("sem marker nao imprime cwd", () => {
    const s = buildPowerShellScript({ cwd: "C:\\", body: "dir" });
    expect(s).not.toContain("Write-Output (");
  });
});

describe("encodePowerShell", () => {
  it("codifica em base64 UTF-16LE (formato do -EncodedCommand)", () => {
    const enc = encodePowerShell("Write-Output 1");
    expect(Buffer.from(enc, "base64").toString("utf16le")).toBe(
      "Write-Output 1",
    );
  });
});

describe("extractWindowsSessionData", () => {
  it("extrai cwd e remove a linha do marker", () => {
    const r = extractWindowsSessionData(
      "a\nb\n__M__C:\\Temp\\x\n",
      "__M__",
      "C:\\",
    );
    expect(r.cwd).toBe("C:\\Temp\\x");
    expect(r.stdout).toBe("a\nb");
  });
  it("sem marker usa fallback", () => {
    const r = extractWindowsSessionData("so saida", "__M__", "C:\\fb");
    expect(r.cwd).toBe("C:\\fb");
    expect(r.stdout).toBe("so saida");
  });
});

describe("makeWindowsSession", () => {
  it("cria sessao kind=windows com cwd e label", () => {
    const s = makeWindowsSession({ cwd: "C:\\x" });
    expect(s.kind).toBe("windows");
    expect(s.label).toBe("default");
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});

describe("resolvePowerShell", () => {
  it("override por env vence", () => {
    expect(
      resolvePowerShell({ env: { WSL_CONNECTOR_POWERSHELL: "X:\\ps.exe" } }),
    ).toBe("X:\\ps.exe");
  });

  it("win32: usa SystemRoot quando o arquivo existe, senao PATH", () => {
    expect(
      resolvePowerShell({
        env: { SystemRoot: "C:\\Windows" },
        platform: "win32",
        exists: () => true,
      }),
    ).toBe("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe");
    expect(
      resolvePowerShell({ env: {}, platform: "win32", exists: () => false }),
    ).toBe("powershell.exe");
  });

  it("linux sem WSL: null", () => {
    expect(
      resolvePowerShell({ env: {}, platform: "linux", exists: () => true }),
    ).toBe(null);
  });

  it("WSL: acha o powershell.exe pelo interop em /mnt/c", () => {
    const seen = [];
    const ps = resolvePowerShell({
      env: { WSL_DISTRO_NAME: "Ubuntu" },
      platform: "linux",
      exists: (p) => {
        seen.push(p);
        return p.startsWith("/mnt/c/");
      },
    });
    expect(ps).toBe(
      "/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe",
    );
    expect(seen[0]).toMatch(/^\/mnt\/c\//);
  });

  it("WSL com mount quebrado (exists lanca): null, sem explodir", () => {
    expect(
      resolvePowerShell({
        env: { WSL_DISTRO_NAME: "Ubuntu" },
        platform: "linux",
        exists: () => {
          throw new Error("EIO");
        },
      }),
    ).toBe(null);
  });
});

describe("executePowerShell", () => {
  function fakeSpawn({ stdout = "", stderr = "", code = 0 } = {}) {
    return vi.fn(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      setTimeout(() => {
        if (stdout) child.stdout.emit("data", Buffer.from(stdout, "utf8"));
        if (stderr) child.stderr.emit("data", Buffer.from(stderr, "utf8"));
        child.emit("close", code);
      }, 5);
      return child;
    });
  }

  it("lanca quando nao ha powershell", async () => {
    await expect(
      executePowerShell({
        script: "x",
        timeoutMs: 1000,
        maxOutputChars: 100,
        powershell: null,
      }),
    ).rejects.toThrow(/PowerShell nao disponivel/);
  });

  it("passa -EncodedCommand, remove \\r e devolve exitCode", async () => {
    const spawnImpl = fakeSpawn({ stdout: "ok\r\nlinha2\r\n", code: 3 });
    const r = await executePowerShell({
      script: "Write-Output ok",
      timeoutMs: 1000,
      maxOutputChars: 1000,
      powershell: "powershell.exe",
      spawnImpl,
    });
    expect(r.exitCode).toBe(3);
    expect(r.stdout).toBe("ok\nlinha2");
    const [bin, args] = spawnImpl.mock.calls[0];
    expect(bin).toBe("powershell.exe");
    expect(args).toContain("-EncodedCommand");
    expect(args).toContain("-NoProfile");
    const enc = args[args.indexOf("-EncodedCommand") + 1];
    expect(Buffer.from(enc, "base64").toString("utf16le")).toBe(
      "Write-Output ok",
    );
  });

  it("trunca saida grande", async () => {
    const spawnImpl = fakeSpawn({ stdout: "x".repeat(500) });
    const r = await executePowerShell({
      script: "x",
      timeoutMs: 1000,
      maxOutputChars: 100,
      powershell: "powershell.exe",
      spawnImpl,
    });
    expect(r.truncated).toBe(true);
  });
});
