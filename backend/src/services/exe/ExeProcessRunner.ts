import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { config } from "../../config.js";
import { logger } from "../../utils/logger.js";

const MAX_CAPTURE_BYTES = 256 * 1024;

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface ExeProcessOptions {
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  timeoutMs?: number;
  /** Called with each complete stdout line as it is produced (for progress). */
  onStdoutLine?: (line: string) => void;
}

/**
 * Safely runs one of the pre-registered Windows executables.
 *
 * - Arguments are always passed as an array (no shell string interpolation).
 * - The executable path must come from the server-side registry below, never
 *   from user input.
 * - A hard timeout kills the whole process tree (taskkill /T /F).
 * - stdout/stderr are captured with a size cap.
 */
export class ExeProcessRunner {
  /** Server-side registry of the only executables that may be executed. */
  private readonly allowedExecutables: Readonly<Record<string, string | null | undefined>>;

  constructor(registry: Record<string, string | null | undefined>) {
    this.allowedExecutables = { ...registry };
  }

  run(operation: string, opts: ExeProcessOptions): Promise<RunResult> {
    const exePath = this.allowedExecutables[operation];
    if (!exePath) {
      return Promise.reject(new Error(`Refusing to execute unknown operation "${operation}".`));
    }
    const isWindows = process.platform === "win32";
    if (!existsSync(exePath) || (isWindows && !exePath.toLowerCase().endsWith(".exe"))) {
      return Promise.reject(new Error(`Executable for "${operation}" is not a valid executable path.`));
    }

    return new Promise<RunResult>((resolve) => {
      const timeoutMs = opts.timeoutMs ?? config.processTimeoutMs;
      const started = Date.now();

      let stdout = "";
      let stderr = "";
      let stdoutRemainder = "";
      let timedOut = false;
      let settled = false;

      const child = spawn(exePath, opts.args, {
        cwd: opts.cwd,
        env: { ...process.env, ...(opts.env ?? {}) },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const killTree = (): void => {
        if (isWindows) {
          // On Windows, kill the entire child process tree (PyInstaller onefile
          // spawns a grandchild process that must not be orphaned).
          const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
            windowsHide: true,
            stdio: "ignore",
          });
          killer.unref();
        } else {
          try {
            process.kill(-child.pid!, "SIGKILL");
          } catch {
            child.kill("SIGKILL");
          }
        }
      };

      const timeout = setTimeout(() => {
        timedOut = true;
        killTree();
      }, timeoutMs);

      child.stdout?.on("data", (chunk: Buffer) => {
        const text = chunk.toString("utf8");
        if (stdout.length < MAX_CAPTURE_BYTES) stdout += text.slice(0, MAX_CAPTURE_BYTES);
        if (opts.onStdoutLine) {
          stdoutRemainder += text;
          const lines = stdoutRemainder.split(/\r?\n/);
          stdoutRemainder = lines.pop() ?? "";
          for (const line of lines) opts.onStdoutLine(line);
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderr.length < MAX_CAPTURE_BYTES) stderr += chunk.toString("utf8").slice(0, MAX_CAPTURE_BYTES);
      });

      child.on("error", (err) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        logger.error(`Failed to spawn ${operation}`, { exePath, error: err.message });
        resolve({ exitCode: null, stdout, stderr: `${stderr}\n${err.message}`.trim(), timedOut });
      });

      child.on("close", (code) => {
        clearTimeout(timeout);
        if (settled) return;
        settled = true;
        if (opts.onStdoutLine && stdoutRemainder) {
          opts.onStdoutLine(stdoutRemainder);
          stdoutRemainder = "";
        }
        const elapsedMs = Date.now() - started;
        logger.info(`EXE ${operation} finished`, {
          exitCode: code,
          elapsedMs,
          timedOut,
          args: opts.args,
        });
        resolve({ exitCode: code, stdout, stderr, timedOut });
      });
    });
  }
}

/** Windows-only helper to kill a process tree by numeric PID. */
export function safeKillProcessTree(pid: number): void {
  try {
    const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], {
      windowsHide: true,
      stdio: "ignore",
    });
    killer.unref();
  } catch {
    // ignore
  }
}

export function joinWindowsPath(...parts: string[]): string {
  return path.join(...parts);
}
