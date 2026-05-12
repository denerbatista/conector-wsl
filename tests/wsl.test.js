import { describe, it, expect } from "vitest";
import { shellEscape, buildShellScript } from "../src/wsl.js";

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
