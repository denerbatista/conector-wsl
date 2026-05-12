// Logging estruturado em stderr (NUNCA stdout - stdout e canal MCP).
// JSON one-line por linha pra parser-friendly.

function emit(level, msg, extra = {}) {
  try {
    const payload = {
      ts: new Date().toISOString(),
      level,
      msg,
      ...extra,
    };
    process.stderr.write(`${JSON.stringify(payload)}\n`);
  } catch {
    // never throw from logger
  }
}

export const log = {
  debug: (msg, extra) => emit("debug", msg, extra),
  info: (msg, extra) => emit("info", msg, extra),
  warn: (msg, extra) => emit("warn", msg, extra),
  error: (msg, extra) => emit("error", msg, extra),
};
