import { describe, expect, it } from "vitest";
import { normalizeCronCommandArgv, runCronCommandPayload } from "./command-payload.js";

describe("cron command payload runner", () => {
  it("accepts argv payloads and captures stdout/stderr", async () => {
    const result = await runCronCommandPayload({
      kind: "command",
      argv: [process.execPath, "--version"],
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout.trim()).toBe(process.version);
    expect(result.stderr.trim()).toBe("");
    expect(result.timedOut).toBe(false);
  });

  it("rejects empty commands and shell-only syntax", () => {
    expect(() => normalizeCronCommandArgv([])).toThrow("requires non-empty argv");
    expect(() => normalizeCronCommandArgv(["FOO=bar", process.execPath])).toThrow(
      "shell-only syntax",
    );
    expect(() => normalizeCronCommandArgv(["echo", "$(pwd)"])).toThrow("shell-only syntax");
    expect(() => normalizeCronCommandArgv(["echo", "ok | mail"])).toThrow("shell-only syntax");
    expect(() => normalizeCronCommandArgv(["echo", "ok > /tmp/out"])).toThrow("shell-only syntax");
  });

  it("marks timeouts in the command result", async () => {
    const result = await runCronCommandPayload({
      kind: "command",
      argv: ["sleep", "5"],
      timeoutSeconds: 0.01,
    });

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBeNull();
  });
});
