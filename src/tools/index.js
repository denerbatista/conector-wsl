import { registerStatusTools } from "./status.js";
import { registerFilesystemTools } from "./filesystem.js";
import { registerTerminalTools } from "./terminal.js";
import { registerSessionTools } from "./sessions.js";

export function registerAllTools(server, ctx) {
  registerStatusTools(server, ctx);
  registerFilesystemTools(server, ctx);
  registerTerminalTools(server, ctx);
  registerSessionTools(server, ctx);
}
