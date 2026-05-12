import { describe, it, expect } from "vitest";
import { extractSessionData, makeSession } from "../src/sessions.js";

describe("makeSession", () => {
  it("cria sessao com id uuid, cwd, label default 'default'", () => {
    const s = makeSession({ cwd: "/home/joao" });
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(s.cwd).toBe("/home/joao");
    expect(s.label).toBe("default");
    expect(s.exportedState).toBe("");
    expect(s.lastCommandAt).toBe(null);
  });

  it("respeita label custom", () => {
    const s = makeSession({ cwd: "/x", label: "build" });
    expect(s.label).toBe("build");
  });
});

describe("extractSessionData", () => {
  const cwdMarker = "__CWD__abc";
  const startMarker = "__START__abc";
  const endMarker = "__END__abc";

  it("extrai cwd, state e remove markers do stdout", () => {
    const stdout = [
      "linha 1",
      "linha 2",
      `${cwdMarker}/home/joao/new`,
      startMarker,
      "declare -x FOO=bar",
      "declare -x BAR=baz",
      endMarker,
    ].join("\n");

    const r = extractSessionData(
      stdout,
      cwdMarker,
      startMarker,
      endMarker,
      "/home/joao",
      "",
    );
    expect(r.cwd).toBe("/home/joao/new");
    expect(r.exportedState).toBe("declare -x FOO=bar\ndeclare -x BAR=baz");
    expect(r.stdout).toBe("linha 1\nlinha 2");
  });

  it("sem markers cai pra fallbacks", () => {
    const stdout = "saida normal\nsem markers";
    const r = extractSessionData(
      stdout,
      cwdMarker,
      startMarker,
      endMarker,
      "/fallback",
      "fallback-state",
    );
    expect(r.cwd).toBe("/fallback");
    expect(r.exportedState).toBe("fallback-state");
    expect(r.stdout).toBe("saida normal\nsem markers");
  });
});
