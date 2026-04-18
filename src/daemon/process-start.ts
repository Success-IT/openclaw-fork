import { execFileUtf8 } from "./exec-file.js";

function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0;
}

export function parsePsElapsedTimeMs(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  const [dayPart, clockPart] = trimmed.includes("-") ? trimmed.split("-", 2) : [undefined, trimmed];
  const clock = clockPart.split(":").map((value) => Number.parseInt(value, 10));
  if (clock.some((value) => !Number.isFinite(value) || value < 0)) {
    return undefined;
  }

  const parsedDays = dayPart === undefined ? 0 : Number.parseInt(dayPart, 10);
  const days = Number.isFinite(parsedDays) ? parsedDays : NaN;
  if (!Number.isFinite(days) || days < 0) {
    return undefined;
  }

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (clock.length === 2) {
    [minutes, seconds] = clock;
  } else if (clock.length === 3) {
    [hours, minutes, seconds] = clock;
  } else {
    return undefined;
  }

  return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
}

export async function readProcessStartedAt(params: {
  pid: number;
  nowMs?: number;
  platform?: NodeJS.Platform;
}): Promise<number | undefined> {
  if (!isValidPid(params.pid)) {
    return undefined;
  }
  if ((params.platform ?? process.platform) === "win32") {
    return undefined;
  }

  const nowMs = params.nowMs ?? Date.now();
  const elapsed = await execFileUtf8("ps", ["-p", String(params.pid), "-o", "etime="]);
  if (elapsed.code === 0) {
    const elapsedMs = parsePsElapsedTimeMs(elapsed.stdout || elapsed.stderr);
    if (typeof elapsedMs === "number") {
      return Math.max(0, nowMs - elapsedMs);
    }
  }

  const started = await execFileUtf8("ps", ["-p", String(params.pid), "-o", "lstart="]);
  if (started.code !== 0) {
    return undefined;
  }
  const parsed = Date.parse((started.stdout || started.stderr).trim());
  return Number.isFinite(parsed) ? parsed : undefined;
}
