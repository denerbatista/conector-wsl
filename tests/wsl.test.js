import { Buffer } from "node:buffer";
import { describe, it, expect } from "vitest";
import {
  shellEscape,
  buildShellScript,
  buildWslArgs,
  safeSpawnCwd,
  executeBashScript,
} from "../src/wsl.js";
import { EventEmitter } from "node:events";
import { vi } from "vitest";

describe("safeSpawnCwd", () => {
  it("Linux: undefined (herda o cwd normalmente)", () => {
    expect(safeSpawnCwd({ platform: "linux", env: {} })).toBe(undefined);
  });

  it("Windows: USERPROFILE quando existe", () => {
    expect(
      safeSpawnCwd({
        platform: "win32",
        env: { USERPROFILE: "C:\\Users\\Joao" },
        exists: () => true,
      }),
    ).toBe("C:\\Users\\Joao");
  });

  it("Windows: cai para homedir/SystemRoot/C:\\ quando o anterior nao existe", () => {
    expect(
      safeSpawnCwd({
        platform: "win32",
        env: { USERPROFILE: "X:\\nao-existe", SystemRoot: "C:\\Windows" },
        homedir: () => "Y:\\tambem-nao",
        exists: (p) => p === "C:\\Windows",
      }),
    ).toBe("C:\\Windows");
  });

  it("Windows: exists lancando nao explode", () => {
    expect(
      safeSpawnCwd({
        platform: "win32",
        env: { USERPROFILE: "C:\\x" },
        homedir: () => "C:\\y",
        exists: () => {
          throw new Error("EIO");
        },
      }),
    ).toBe(undefined);
  });
});

describe("executeBashScript", () => {
  it("passa opcoes de spawn com cwd (undefined em Linux) e captura saida", async () => {
    const spawnImpl = vi.fn(() => {
      const child = new EventEmitter();
      child.stdout = new EventEmitter();
      child.stderr = new EventEmitter();
      child.kill = vi.fn();
      setTimeout(() => {
        child.stdout.emit("data", Buffer.from("oi\n"));
        child.emit("close", 0);
      }, 5);
      return child;
    });
    const r = await executeBashScript({
      script: "echo oi",
      timeoutMs: 1000,
      maxOutputChars: 100,
      distro: "",
      spawnImpl,
    });
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toBe("oi");
    const opts = spawnImpl.mock.calls[0][2];
    expect(opts).toHaveProperty("cwd");
    expect(opts.cwd).toBe(safeSpawnCwd());
  });
});

describe("buildWslArgs", () => {
  it("usa --exec para o script chegar intacto ao bash (sem expansao do shell do WSL)", () => {
    const script = 'for c in git gh; do $c --version; done; echo "$HOME"';
    expect(buildWslArgs(script, "Ubuntu-24.04")).toEqual([
      "-d",
      "Ubuntu-24.04",
      "--exec",
      "bash",
      "-lc",
      script,
    ]);
  });

  it("sem distro omite -d mas mantem --exec", () => {
    expect(buildWslArgs("ls", "")).toEqual(["--exec", "bash", "-lc", "ls"]);
  });

  it("nunca usa o separador -- (que passa pelo shell padrao)", () => {
    expect(buildWslArgs("ls", "Ubuntu")).not.toContain("--");
  });
});

describe("shellEscape", () => {
  it("envolve em aspas simples", () => {
    expect(shellEscape("foo")).toBe("'foo'");
  });

  it("escapa aspas simples internas", () => {
    expect(shellEscape("foo'bar")).toBe("'foo'\\''bar'");
  });

  it("preserva espacos", () => {
    expect(shellEscape("a b c")).toBe("'a b c'");
  });
});

describe("buildShellScript", () => {
  it("comeca com `set +e` e faz cd antes do body", () => {
    const s = buildShellScript({ cwd: "/home/joao", body: "ls" });
    expect(s.startsWith("set +e\n")).toBe(true);
    expect(s).toContain("cd '/home/joao'");
    expect(s.endsWith("ls")).toBe(true);
  });

  it("inclui prelude quando informado", () => {
    const s = buildShellScript({
      cwd: "/x",
      prelude: "export FOO=bar",
      body: "echo $FOO",
    });
    expect(s).toContain("export FOO=bar");
    expect(s.indexOf("export FOO=bar")).toBeLessThan(s.indexOf("cd "));
  });
});
