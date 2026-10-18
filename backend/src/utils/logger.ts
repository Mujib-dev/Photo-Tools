type Level = "debug" | "info" | "warn" | "error";

const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const LEVEL = (process.env.LOG_LEVEL ?? "info").toLowerCase() as Level;

function ts(): string {
  return new Date().toISOString();
}

function write(level: Level, message: string, meta?: unknown): void {
  if (ORDER[level] < ORDER[LEVEL]) return;
  const suffix = meta === undefined ? "" : " " + JSON.stringify(meta);
  const line = `${ts()} [${level.toUpperCase()}] ${message}${suffix}`;
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");
}

export const logger = {
  debug: (m: string, meta?: unknown) => write("debug", m, meta),
  info: (m: string, meta?: unknown) => write("info", m, meta),
  warn: (m: string, meta?: unknown) => write("warn", m, meta),
  error: (m: string, meta?: unknown) => write("error", m, meta),
};
