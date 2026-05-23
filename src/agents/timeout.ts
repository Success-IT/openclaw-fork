import type { OpenClawConfig } from "../config/types.openclaw.js";
import { normalizeAgentId } from "../routing/session-key.js";

const DEFAULT_AGENT_TIMEOUT_SECONDS = 48 * 60 * 60;
const MAX_SAFE_TIMEOUT_MS = 2_147_000_000;

const normalizeNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : undefined;

function resolvePerAgentTimeoutSeconds(
  cfg: OpenClawConfig | undefined,
  agentId: string | undefined,
): number | undefined {
  const id = typeof agentId === "string" && agentId.trim() ? normalizeAgentId(agentId) : "";
  if (!id || !Array.isArray(cfg?.agents?.list)) {
    return undefined;
  }
  const entry = cfg.agents.list.find((candidate) => normalizeAgentId(candidate.id) === id);
  return normalizeNumber(entry?.timeoutSeconds);
}

export function resolveAgentTimeoutSeconds(cfg?: OpenClawConfig, agentId?: string): number {
  const raw =
    resolvePerAgentTimeoutSeconds(cfg, agentId) ??
    normalizeNumber(cfg?.agents?.defaults?.timeoutSeconds);
  const seconds = raw ?? DEFAULT_AGENT_TIMEOUT_SECONDS;
  return Math.max(seconds, 1);
}

export function resolveAgentTimeoutMs(opts: {
  cfg?: OpenClawConfig;
  overrideMs?: number | null;
  overrideSeconds?: number | null;
  agentId?: string;
  minMs?: number;
}): number {
  const minMs = Math.max(normalizeNumber(opts.minMs) ?? 1, 1);
  const clampTimeoutMs = (valueMs: number) =>
    Math.min(Math.max(valueMs, minMs), MAX_SAFE_TIMEOUT_MS);
  const defaultMs = clampTimeoutMs(resolveAgentTimeoutSeconds(opts.cfg, opts.agentId) * 1000);
  // Use the maximum timer-safe timeout to represent "no timeout" when explicitly set to 0.
  const NO_TIMEOUT_MS = MAX_SAFE_TIMEOUT_MS;
  const overrideMs = normalizeNumber(opts.overrideMs);
  if (overrideMs !== undefined) {
    if (overrideMs === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideMs < 0) {
      return defaultMs;
    }
    return clampTimeoutMs(overrideMs);
  }
  const overrideSeconds = normalizeNumber(opts.overrideSeconds);
  if (overrideSeconds !== undefined) {
    if (overrideSeconds === 0) {
      return NO_TIMEOUT_MS;
    }
    if (overrideSeconds < 0) {
      return defaultMs;
    }
    return clampTimeoutMs(overrideSeconds * 1000);
  }
  return defaultMs;
}
