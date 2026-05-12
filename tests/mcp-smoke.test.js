import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

describe("MCP stdio server", () => {
  it("inicializa, lista ferramentas e responde status", async () => {
    const transport = new StdioClientTransport({
      command: "node",
      args: ["./src/index.js"],
      stderr: "pipe",
    });
    const client = new Client({ name: "vitest-smoke", version: "1.0.0" });

    await client.connect(transport, { timeout: 10000 });
    try {
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
      expect(status.content[0].text).toContain("defaultCwd");
    } finally {
      await client.close();
    }
  });
});
