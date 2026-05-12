import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Buffer } from "node:buffer";

const ORIGINAL_PLATFORM = process.platform;
const ORIGINAL_ENV = { ...process.env };

describe("detect.buildDefaultRoots", () => {
  let buildDefaultRoots;
  beforeEach(async () => {
    vi.resetModules();
    ({ buildDefaultRoots } = await import("../src/detect.js"));
  });

  it("compoe /home/<user> e /mnt/c/Users/<windows>", () => {
    expect(
      buildDefaultRoots({ linuxUser: "joao", windowsUser: "Joao" }),
    ).toEqual(["/home/joao", "/mnt/c/Users/Joao"]);
  });

  it("ignora windowsUser quando null", () => {
    expect(buildDefaultRoots({ linuxUser: "joao", windowsUser: null })).toEqual(
      ["/home/joao"],
    );
  });

  it("fallback /home quando nada detectado", () => {
    expect(buildDefaultRoots({ linuxUser: "", windowsUser: null })).toEqual([
      "/home",
    ]);
  });
});

describe("detect.detectDistro", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM });
    process.env = { ...ORIGINAL_ENV };
    delete process.env.WSL_DISTRO_NAME;
  });
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM });
    process.env = { ...ORIGINAL_ENV };
  });

  it("override explicito vence tudo", async () => {
    const { detectDistro } = await import("../src/detect.js");
    expect(detectDistro("MinhaDistro")).toBe("MinhaDistro");
  });

  it("WSL_DISTRO_NAME quando setado", async () => {
    process.env.WSL_DISTRO_NAME = "Ubuntu-22.04";
    const { detectDistro } = await import("../src/detect.js");
    expect(detectDistro("")).toBe("Ubuntu-22.04");
  });

  it("Linux nativo retorna '' quando sem env", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const { detectDistro } = await import("../src/detect.js");
    expect(detectDistro(undefined)).toBe("");
  });
});

describe("detect.parseWslListVerbose", () => {
  it("detecta distro default marcada com asterisco", async () => {
    const { parseWslListVerbose } = await import("../src/detect.js");
    const output = [
      "  NAME                   STATE           VERSION",
      "* Ubuntu-24.04           Running         2",
      "  Debian                 Stopped         2",
    ].join("\r\n");

    expect(parseWslListVerbose(Buffer.from(output, "utf16le"))).toBe(
      "Ubuntu-24.04",
    );
  });

  it("usa a primeira distro quando nenhuma esta marcada como default", async () => {
    const { parseWslListVerbose } = await import("../src/detect.js");
    const output = [
      "  NAME                   STATE           VERSION",
      "  Ubuntu                 Stopped         2",
      "  Debian                 Stopped         2",
    ].join("\n");

    expect(parseWslListVerbose(output)).toBe("Ubuntu");
  });
});

describe("detect.detectWindowsUser", () => {
  beforeEach(() => {
    vi.resetModules();
    Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM });
    process.env = { ...ORIGINAL_ENV };
  });
  afterEach(() => {
    Object.defineProperty(process, "platform", { value: ORIGINAL_PLATFORM });
    process.env = { ...ORIGINAL_ENV };
  });

  it("retorna null fora do Windows", async () => {
    Object.defineProperty(process, "platform", { value: "linux" });
    const { detectWindowsUser } = await import("../src/detect.js");
    expect(detectWindowsUser()).toBe(null);
  });

  it("pega basename de USERPROFILE no Windows", async () => {
    Object.defineProperty(process, "platform", { value: "win32" });
    process.env.USERPROFILE = "C:\\Users\\Dener";
    const { detectWindowsUser } = await import("../src/detect.js");
    expect(detectWindowsUser()).toBe("Dener");
  });
});
