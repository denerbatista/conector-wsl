import { describe, it, expect, vi } from "vitest";

import {
  parsePrewarmSpecs,
  runPrewarm,
  spawnPrewarm,
  defaultMarkerPath,
} from "../src/prewarm.js";

function memFs(initial = {}) {
  const files = { ...initial };
  return {
    files,
    readFileSync: (p) => {
      if (!(p in files)) throw new Error("ENOENT");
      return files[p];
    },
    writeFileSync: (p, data) => {
      files[p] = data;
    },
    mkdirSync: () => {},
  };
}

describe("parsePrewarmSpecs", () => {
  it("aceita espaco, virgula e ponto-e-virgula; ignora lixo", () => {
    expect(
      parsePrewarmSpecs(
        "chrome-devtools-mcp@1.8.0, @scope/pkg@2.0.0; outro  $(rm)",
      ),
    ).toEqual(["chrome-devtools-mcp@1.8.0", "@scope/pkg@2.0.0", "outro"]);
  });
  it("vazio -> []", () => {
    expect(parsePrewarmSpecs("")).toEqual([]);
    expect(parsePrewarmSpecs(undefined)).toEqual([]);
  });
});

describe("spawnPrewarm", () => {
  it("Windows: npx via shell com < nul, detached e unref", () => {
    const unref = vi.fn();
    const spawnImpl = vi.fn(() => ({ unref }));
    spawnPrewarm("pkg@1.0.0", { spawnImpl, platform: "win32" });
    const [cmd, opts] = spawnImpl.mock.calls[0];
    expect(cmd).toBe("npx -y pkg@1.0.0 --help < nul");
    expect(opts).toMatchObject({
      shell: true,
      detached: true,
      stdio: "ignore",
    });
    expect(unref).toHaveBeenCalled();
  });
  it("Linux: </dev/null", () => {
    const spawnImpl = vi.fn(() => ({ unref: vi.fn() }));
    spawnPrewarm("pkg@1.0.0", { spawnImpl, platform: "linux" });
    expect(spawnImpl.mock.calls[0][0]).toBe(
      "npx -y pkg@1.0.0 --help </dev/null",
    );
  });
});

describe("runPrewarm", () => {
  it("dispara so os specs nao marcados e grava o marker", () => {
    const fsImpl = memFs({
      "/m/prewarm.json": JSON.stringify({ "ja@1": "t" }),
    });
    const spawnImpl = vi.fn(() => ({ unref: vi.fn() }));
    const started = runPrewarm({
      env: { WSL_CONNECTOR_PREWARM: "ja@1 novo@2" },
      markerPath: "/m/prewarm.json",
      spawnImpl,
      fsImpl,
      platform: "linux",
      now: () => "T",
    });
    expect(started).toEqual(["novo@2"]);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fsImpl.files["/m/prewarm.json"])).toEqual({
      "ja@1": "t",
      "novo@2": "T",
    });
  });

  it("sem env -> nada", () => {
    const spawnImpl = vi.fn();
    expect(runPrewarm({ env: {}, spawnImpl, fsImpl: memFs() })).toEqual([]);
    expect(spawnImpl).not.toHaveBeenCalled();
  });

  it("segunda rodada com tudo marcado nao dispara", () => {
    const fsImpl = memFs();
    const spawnImpl = vi.fn(() => ({ unref: vi.fn() }));
    const opts = {
      env: { WSL_CONNECTOR_PREWARM: "a@1" },
      markerPath: "/m/p.json",
      spawnImpl,
      fsImpl,
      platform: "linux",
    };
    expect(runPrewarm(opts)).toEqual(["a@1"]);
    expect(runPrewarm(opts)).toEqual([]);
    expect(spawnImpl).toHaveBeenCalledTimes(1);
  });
});

describe("defaultMarkerPath", () => {
  it("fica na home do usuario", () => {
    expect(defaultMarkerPath({ homedir: () => "/home/x" })).toBe(
      "/home/x/.claude-wsl-connector/prewarm.json",
    );
  });
});
