import type { GroupHistoryEntry } from "./inbound-context.js";

export const DEFAULT_WHATSAPP_RECENT_CONTEXT_LIMIT = 50;
export const DEFAULT_WHATSAPP_RECENT_CONTEXT_MAX_AGE_HOURS = 24;

export type RecentGroupContextConfig = {
  limit: number;
  maxAgeHours: number;
};

export type RecentGroupContextMap = Map<string, GroupHistoryEntry[]>;

export function appendRecentGroupContextEntry(params: {
  histories: RecentGroupContextMap;
  key: string;
  entry: GroupHistoryEntry;
  config: RecentGroupContextConfig;
  now?: number;
}): GroupHistoryEntry[] {
  if (params.config.limit <= 0) {
    params.histories.set(params.key, []);
    return [];
  }
  const now = params.now ?? Date.now();
  const next = trimRecentGroupContextEntries({
    entries: [...(params.histories.get(params.key) ?? []), params.entry],
    config: params.config,
    now,
  });
  params.histories.set(params.key, next);
  return next;
}

export function trimRecentGroupContextEntries(params: {
  entries: GroupHistoryEntry[];
  config: RecentGroupContextConfig;
  now?: number;
}): GroupHistoryEntry[] {
  if (params.config.limit <= 0) {
    return [];
  }
  const now = params.now ?? Date.now();
  const maxAgeMs =
    params.config.maxAgeHours > 0 && Number.isFinite(params.config.maxAgeHours)
      ? params.config.maxAgeHours * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY;
  const freshEntries = params.entries.filter((entry) => {
    if (entry.timestamp === undefined || maxAgeMs === Number.POSITIVE_INFINITY) {
      return true;
    }
    return now - entry.timestamp <= maxAgeMs;
  });
  return freshEntries.slice(-params.config.limit);
}
