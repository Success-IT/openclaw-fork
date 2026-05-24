import { spawn } from "node:child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export async function runCommand(params: {
  command: string;
  args: string[];
  cwd?: string;
  input?: string;
  timeoutMs?: number;
}): Promise<CommandResult> {
  const timeoutMs = params.timeoutMs ?? 30000;
  return await new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${params.command} ${params.args.join(" ")}`));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      reject(
        new Error(
          `Command failed (${code}): ${params.command} ${params.args.join(" ")}\n${stderr || stdout}`,
        ),
      );
    });
    if (params.input !== undefined) {
      child.stdin.end(params.input);
    } else {
      child.stdin.end();
    }
  });
}

export function parseJsonOutput<T = unknown>(text: string): T {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Expected JSON output but command returned no stdout");
  }
  return JSON.parse(trimmed) as T;
}
