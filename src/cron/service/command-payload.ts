import { spawn } from "node:child_process";
import type { CronCommandPayload } from "../types.js";

export type CronCommandRunResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
  timedOut: boolean;
};

const SHELL_META_PATTERN = /[|&;<>()$`]/;
const INLINE_ENV_ASSIGNMENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*=/;

function normalizeCommandArg(value: string, index: number): string {
  const arg = value.trim();
  if (!arg) {
    throw new Error(`cron command argv[${index}] must be non-empty`);
  }
  if (
    SHELL_META_PATTERN.test(arg) ||
    arg.includes("\n") ||
    arg.includes("\r") ||
    arg === ">" ||
    arg === "<" ||
    arg.includes(">>") ||
    arg.includes("<<") ||
    INLINE_ENV_ASSIGNMENT_PATTERN.test(arg)
  ) {
    throw new Error(`cron command argv[${index}] contains shell-only syntax`);
  }
  return arg;
}

export function normalizeCronCommandArgv(argv: readonly string[]): [string, ...string[]] {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error("cron command payload requires non-empty argv");
  }
  return argv.map((arg, index) => normalizeCommandArg(arg, index)) as [string, ...string[]];
}

export function isQuietCronCommandStdout(payload: CronCommandPayload, stdout: string): boolean {
  const trimmed = stdout.trim();
  return Array.isArray(payload.quietStdout) && payload.quietStdout.includes(trimmed);
}

export async function runCronCommandPayload(
  payload: CronCommandPayload,
  abortSignal?: AbortSignal,
): Promise<CronCommandRunResult> {
  const argv = normalizeCronCommandArgv(payload.argv);
  const startedAt = Date.now();
  const timeoutMs =
    typeof payload.timeoutSeconds === "number" && Number.isFinite(payload.timeoutSeconds)
      ? Math.max(0, Math.floor(payload.timeoutSeconds * 1000))
      : undefined;

  return await new Promise<CronCommandRunResult>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    let timedOut = false;
    let timeoutId: NodeJS.Timeout | undefined;
    const child = spawn(argv[0], argv.slice(1), {
      cwd: payload.cwd,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      abortSignal?.removeEventListener("abort", onAbort);
    };
    const finish = (result: CronCommandRunResult) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(result);
    };
    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const killChild = () => {
      if (!child.killed) {
        child.kill("SIGTERM");
      }
    };
    const onAbort = () => {
      timedOut = true;
      killChild();
    };

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", fail);
    child.on("close", (exitCode, signal) => {
      finish({
        stdout,
        stderr,
        exitCode,
        signal,
        durationMs: Math.max(0, Date.now() - startedAt),
        timedOut,
      });
    });

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }
    abortSignal?.addEventListener("abort", onAbort, { once: true });
    if (timeoutMs !== undefined && timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        killChild();
      }, timeoutMs);
      timeoutId.unref?.();
    }
  });
}
