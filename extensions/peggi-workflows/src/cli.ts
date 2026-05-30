import { spawn } from "node:child_process";

export type CommandResult = {
  stdout: string;
  stderr: string;
  returncode: number | null;
};

export async function runCommand(params: {
  command: string;
  args: string[];
  cwd?: string;
  timeoutMs?: number;
}): Promise<CommandResult> {
  const timeoutMs = params.timeoutMs ?? 120000;
  return await new Promise((resolve, reject) => {
    const child = spawn(params.command, params.args, {
      cwd: params.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      resolve({
        stdout,
        stderr: stderr || `Command timed out: ${params.command} ${params.args.join(" ")}`,
        returncode: null,
      });
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
      resolve({ stdout, stderr, returncode: code });
    });
  });
}
