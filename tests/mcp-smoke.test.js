import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function withClient(clientName, fn, env = {}) {
  const transport = new StdioClientTransport({
    command: "node",
    args: ["./src/index.js"],
    stderr: "pipe",
    env: { ...process.env, ...env },
  });
  const client = new Client({ name: clientName, version: "1.0.0" });
  await client.connect(transport, { timeout: 10000 });
  try {
    return await fn(client);
  } finally {
    await client.close();
  }
}

describe("MCP stdio server", () => {
  it("cliente generico (Cowork/Desktop): modo full, lista tools WSL e responde status", async () => {
    await withClient("vitest-smoke", async (client) => {
      const tools = await client.listTools(undefined, { timeout: 10000 });
      expect(tools.tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining([
          "connector_status",
          "list_allowed_roots",
          "list_directory",
          "read_text_file",
          "write_text_file",
          "run_wsl_command",
          "start_wsl_session",
          "run_in_wsl_session",
          "close_wsl_session",
        ]),
      );

      const status = await client.callTool(
        { name: "connector_status", arguments: {} },
        undefined,
        { timeout: 10000 },
      );
      expect(status.content[0].type).toBe("text");
      const parsed = JSON.parse(status.content[0].text);
      expect(parsed.mode).toBe("full");
      expect(parsed.client).toBe("vitest-smoke");
      expect(parsed.defaultCwd).toBeTruthy();
    });
  });

  it("cliente claude-code: modo silent, so tools core", async () => {
    await withClient("claude-code", async (client) => {
      const tools = await client.listTools(undefined, { timeout: 10000 });
      const names = tools.tools.map((tool) => tool.name).sort();
      expect(names).toEqual(["connector_status", "list_allowed_roots"]);

      const status = await client.callTool(
        { name: "connector_status", arguments: {} },
        undefined,
        { timeout: 10000 },
      );
      const parsed = JSON.parse(status.content[0].text);
      expect(parsed.mode).toBe("silent");
      expect(parsed.hint).toMatch(/silent/i);
    });
  });

  it("WSL_CONNECTOR_MODE=full sobrepoe o silent do claude-code", async () => {
    await withClient(
      "claude-code",
      async (client) => {
        const tools = await client.listTools(undefined, { timeout: 10000 });
        expect(tools.tools.map((t) => t.name)).toContain("run_wsl_command");
      },
      { WSL_CONNECTOR_MODE: "full" },
    );
  });
});
