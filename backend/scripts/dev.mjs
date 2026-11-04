/**
 * Backend dev supervisor.
 *
 * `tsx watch` only respawns its child when a watched file changes: if the
 * server crashes (or is killed), it stays down and every proxied API request
 * fails with "The processing service is temporarily unavailable." until the
 * whole dev stack is restarted by hand.
 *
 * This wrapper runs the server directly and supervises it:
 *   - the server is restarted when it exits (crash or requested restart),
 *   - the server is restarted when a source file under `src/` changes,
 *   - a restart is requested over IPC so the server can close its stores and
 *     its in-flight jobs cleanly (Windows cannot deliver SIGTERM to a child),
 *   - a crash loop backs off instead of spinning.
 */
import { spawn } from "node:child_process";
import { watch } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const tsxCli = require.resolve("tsx/cli");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ENTRY = path.join(ROOT, "src/index.ts");
const WATCH_DIR = path.join(ROOT, "src");
const DEBOUNCE_MS = 120;
/** How long the server gets to shut down cleanly before it is killed. */
const GRACEFUL_TIMEOUT_MS = 5_000;
const MIN_RESTART_DELAY_MS = 300;
const MAX_RESTART_DELAY_MS = 5_000;
/** A start that dies faster than this counts as a crash loop. */
const CRASH_LOOP_WINDOW_MS = 3_000;

let child = null;
/** Requests a clean shutdown of the running server. */
let stopServer = null;
let stopping = false;
let restartTimer = null;
let debounceTimer = null;
let killTimer = null;
let restartDelayMs = MIN_RESTART_DELAY_MS;

function log(message) {
  console.log(`[backend] ${message}`);
}

function clearTimer(timer) {
  if (timer) clearTimeout(timer);
}

function start() {
  if (stopping) return;

  const proc = spawn(process.execPath, [tsxCli, ENTRY], {
    cwd: ROOT,
    // The "ipc" channel lets the supervisor ask for a clean shutdown.
    stdio: ["ignore", "inherit", "inherit", "ipc"],
    env: process.env,
  });
  child = proc;
  const startedAt = Date.now();

  stopServer = () => {
    if (child !== proc) return;
    try {
      proc.send({ type: "shutdown" });
    } catch {
      proc.kill("SIGKILL");
      return;
    }
    killTimer = setTimeout(() => {
      if (child === proc) {
        log("server did not shut down in time — killing it");
        proc.kill("SIGKILL");
      }
    }, GRACEFUL_TIMEOUT_MS);
  };

  proc.on("exit", (code, signal) => {
    if (child === proc) {
      child = null;
      stopServer = null;
    }
    clearTimer(killTimer);
    killTimer = null;

    if (stopping) {
      process.exit(0);
      return;
    }

    const alive = Date.now() - startedAt;
    if (alive < CRASH_LOOP_WINDOW_MS) {
      restartDelayMs = Math.min(restartDelayMs * 2, MAX_RESTART_DELAY_MS);
      log(`server exited quickly (code=${code}, signal=${signal ?? "none"}) — retrying in ${restartDelayMs}ms`);
    } else {
      restartDelayMs = MIN_RESTART_DELAY_MS;
      log(`server exited (code=${code}, signal=${signal ?? "none"}) — restarting in ${restartDelayMs}ms`);
    }
    clearTimer(restartTimer);
    restartTimer = setTimeout(start, restartDelayMs);
  });

  proc.on("error", (err) => {
    log(`could not start the server: ${err.message}`);
  });
}

/** Restarts the server after a source change (debounced). */
function scheduleRestart(reason) {
  if (stopping) return;
  clearTimer(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (!child) return;
    log(`${reason} — restarting`);
    if (stopServer) stopServer();
    else child.kill("SIGTERM");
  }, DEBOUNCE_MS);
}

try {
  watch(WATCH_DIR, { recursive: true }, (_event, filename) => {
    if (!filename) return;
    const name = String(filename);
    if (!name.endsWith(".ts") && !name.endsWith(".tsx") && !name.endsWith(".js")) return;
    if (name.includes(`${path.sep}node_modules${path.sep}`)) return;
    scheduleRestart(`changed ${name}`);
  });
} catch (err) {
  log(`could not watch ${WATCH_DIR}: ${err instanceof Error ? err.message : String(err)}`);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    stopping = true;
    clearTimer(restartTimer);
    clearTimer(debounceTimer);
    if (child && stopServer) {
      stopServer();
      return;
    }
    if (child) child.kill("SIGTERM");
    else process.exit(0);
  });
}

log("starting server (auto-restart on crash)");
start();
