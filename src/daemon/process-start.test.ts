import { beforeEach, describe, expect, it, vi } from "vitest";

const execFileUtf8 = vi.hoisted(() => vi.fn());

vi.mock("./exec-file.js", () => ({
  execFileUtf8,
}));

const { parsePsElapsedTimeMs, readProcessStartedAt } = await import("./process-start.js");

describe("parsePsElapsedTimeMs", () => {
  it.each([
    ["00:05", 5_000],
    ["12:34", 754_000],
    ["01:02:03", 3_723_000],
    ["2-03:04:05", 183_845_000],
  ])("parses %s", (raw, expected) => {
    expect(parsePsElapsedTimeMs(raw)).toBe(expected);
  });

  it("returns undefined for unsupported ps elapsed formats", () => {
    expect(parsePsElapsedTimeMs("bad-value")).toBeUndefined();
    expect(parsePsElapsedTimeMs("1:2:3:4")).toBeUndefined();
  });
});

describe("readProcessStartedAt", () => {
  beforeEach(() => {
    execFileUtf8.mockReset();
  });

  it("derives the process start time from ps etime", async () => {
    execFileUtf8.mockResolvedValueOnce({
      code: 0,
      stdout: "01:30\n",
      stderr: "",
    });

    await expect(
      readProcessStartedAt({
        pid: 1234,
        nowMs: 200_000,
        platform: "darwin",
      }),
    ).resolves.toBe(110_000);
  });

  it("falls back to ps lstart when etime is unavailable", async () => {
    execFileUtf8
      .mockResolvedValueOnce({
        code: 1,
        stdout: "",
        stderr: "ps: etime unavailable",
      })
      .mockResolvedValueOnce({
        code: 0,
        stdout: "Sat Apr 18 00:11:47 2026\n",
        stderr: "",
      });

    await expect(
      readProcessStartedAt({
        pid: 1234,
        platform: "darwin",
      }),
    ).resolves.toBe(Date.parse("Sat Apr 18 00:11:47 2026"));
  });

  it("returns undefined for invalid pids and Windows", async () => {
    await expect(
      readProcessStartedAt({
        pid: 0,
        platform: "linux",
      }),
    ).resolves.toBeUndefined();
    await expect(
      readProcessStartedAt({
        pid: 1234,
        platform: "win32",
      }),
    ).resolves.toBeUndefined();
    expect(execFileUtf8).not.toHaveBeenCalled();
  });
});
