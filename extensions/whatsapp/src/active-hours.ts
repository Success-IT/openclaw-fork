const ACTIVE_HOURS_TIME_PATTERN = /^([01]\d|2[0-3]|24):([0-5]\d)$/;

function parseActiveHoursTime(opts: { allow24: boolean }, raw?: string): number | null {
  if (!raw || !ACTIVE_HOURS_TIME_PATTERN.test(raw)) {
    return null;
  }
  const [hourStr, minuteStr] = raw.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }
  if (hour === 24) {
    if (!opts.allow24 || minute !== 0) {
      return null;
    }
    return 24 * 60;
  }
  return hour * 60 + minute;
}

function resolveMinutesInTimeZone(nowMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(nowMs));
    const map: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") {
        map[part.type] = part.value;
      }
    }
    const hour = Number(map.hour);
    const minute = Number(map.minute);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      return null;
    }
    return hour * 60 + minute;
  } catch {
    return null;
  }
}

function resolveDayOfWeekInTimeZone(nowMs: number, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
    }).formatToParts(new Date(nowMs));
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    if (!weekday) {
      return null;
    }
    const map: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return map[weekday] ?? null;
  } catch {
    return null;
  }
}

function isWithinTimeWindow(startMin: number, endMin: number, currentMin: number): boolean {
  if (endMin > startMin) {
    return currentMin >= startMin && currentMin < endMin;
  }
  return currentMin >= startMin || currentMin < endMin;
}

export type WeeklyActiveHoursConfig = {
  weekday?: { start?: string; end?: string };
  weekend?: { start?: string; end?: string };
};

export function isWithinWeeklyActiveHours(
  config: WeeklyActiveHoursConfig | undefined,
  timezone: string,
  nowMs?: number,
): boolean {
  if (!config) {
    return true;
  }
  const now = nowMs ?? Date.now();
  const dow = resolveDayOfWeekInTimeZone(now, timezone);
  if (dow === null) {
    return true;
  }

  const isWeekend = dow === 0 || dow === 6;
  const window = isWeekend ? config.weekend : config.weekday;
  if (!window) {
    return true;
  }

  const startMin = parseActiveHoursTime({ allow24: false }, window.start);
  const endMin = parseActiveHoursTime({ allow24: true }, window.end);
  if (startMin === null || endMin === null || startMin === endMin) {
    return true;
  }

  const currentMin = resolveMinutesInTimeZone(now, timezone);
  if (currentMin === null) {
    return true;
  }

  return isWithinTimeWindow(startMin, endMin, currentMin);
}
