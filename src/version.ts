import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { normalizeOptionalString } from "./shared/string-coerce.js";

declare const __OPENCLAW_VERSION__: string | undefined;
const CORE_PACKAGE_NAME = "openclaw";

const PACKAGE_JSON_CANDIDATES = [
  "../package.json",
  "../../package.json",
  "../../../package.json",
  "./package.json",
] as const;

const BUILD_INFO_CANDIDATES = [
  "../build-info.json",
  "../../build-info.json",
  "./build-info.json",
] as const;

export type RuntimeBuildInfo = {
  version?: string;
  commit?: string;
  builtAt?: string;
  buildId?: string;
};

function deriveBuildId(input: {
  version?: string;
  commit?: string;
  builtAt?: string;
}): string | undefined {
  if (!input.commit && !input.builtAt) {
    return undefined;
  }
  return createHash("sha1")
    .update(`${input.version ?? ""}\0${input.commit ?? ""}\0${input.builtAt ?? ""}`)
    .digest("hex")
    .slice(0, 12);
}

function readVersionFromJsonCandidates(
  moduleUrl: string,
  candidates: readonly string[],
  opts: { requirePackageName?: boolean } = {},
): string | null {
  try {
    const require = createRequire(moduleUrl);
    for (const candidate of candidates) {
      try {
        const parsed = require(candidate) as { name?: string; version?: string };
        const version = normalizeOptionalString(parsed.version);
        if (!version) {
          continue;
        }
        if (opts.requirePackageName && parsed.name !== CORE_PACKAGE_NAME) {
          continue;
        }
        return version;
      } catch {
        // ignore missing or unreadable candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeBuildInfo(input: unknown): RuntimeBuildInfo | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const record = input as {
    version?: unknown;
    commit?: unknown;
    builtAt?: unknown;
    buildId?: unknown;
  };
  const version = normalizeOptionalString(
    typeof record.version === "string" ? record.version : undefined,
  );
  const commit = normalizeOptionalString(
    typeof record.commit === "string" ? record.commit : undefined,
  );
  const builtAt = normalizeOptionalString(
    typeof record.builtAt === "string" ? record.builtAt : undefined,
  );
  const explicitBuildId = normalizeOptionalString(
    typeof record.buildId === "string" ? record.buildId : undefined,
  );
  const buildId = explicitBuildId ?? deriveBuildId({ version, commit, builtAt });
  if (!version && !commit && !builtAt && !buildId) {
    return null;
  }
  return {
    ...(version ? { version } : {}),
    ...(commit ? { commit } : {}),
    ...(builtAt ? { builtAt } : {}),
    ...(buildId ? { buildId } : {}),
  };
}

function readBuildInfoFromJsonCandidates(
  moduleUrl: string,
  candidates: readonly string[],
): RuntimeBuildInfo | null {
  try {
    const require = createRequire(moduleUrl);
    for (const candidate of candidates) {
      try {
        const parsed = require(candidate) as unknown;
        const info = normalizeBuildInfo(parsed);
        if (info) {
          return info;
        }
      } catch {
        // ignore missing or unreadable candidate
      }
    }
    return null;
  } catch {
    return null;
  }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = normalizeOptionalString(value);
    if (trimmed) {
      return trimmed;
    }
  }
  return undefined;
}

export function readVersionFromPackageJsonForModuleUrl(moduleUrl: string): string | null {
  return readVersionFromJsonCandidates(moduleUrl, PACKAGE_JSON_CANDIDATES, {
    requirePackageName: true,
  });
}

export function readVersionFromBuildInfoForModuleUrl(moduleUrl: string): string | null {
  return readBuildInfoForModuleUrl(moduleUrl)?.version ?? null;
}

export function readBuildInfoForModuleUrl(moduleUrl: string): RuntimeBuildInfo | null {
  return readBuildInfoFromJsonCandidates(moduleUrl, BUILD_INFO_CANDIDATES);
}

export function readBuildInfoForEntrypointPath(entrypointPath: string): RuntimeBuildInfo | null {
  try {
    return readBuildInfoForModuleUrl(pathToFileURL(entrypointPath).href);
  } catch {
    return null;
  }
}

function readAdjacentDistBuildInfoForModuleUrl(moduleUrl: string): RuntimeBuildInfo | null {
  const candidates = ["../dist/index.js", "../dist/entry.js"] as const;
  for (const candidate of candidates) {
    try {
      const info = readBuildInfoForModuleUrl(new URL(candidate, moduleUrl).href);
      if (info) {
        return info;
      }
    } catch {
      // ignore malformed or missing adjacent dist paths
    }
  }
  return null;
}

export function resolveComparableBuildIdentity(
  info: RuntimeBuildInfo | null | undefined,
): string | null {
  const normalized = normalizeBuildInfo(info);
  if (!normalized) {
    return null;
  }
  if (normalized.buildId) {
    return `build:${normalized.buildId}`;
  }
  if (!normalized.commit && !normalized.builtAt) {
    return null;
  }
  return JSON.stringify([
    normalized.version ?? "",
    normalized.commit ?? "",
    normalized.builtAt ?? "",
  ]);
}

export function resolveVersionFromModuleUrl(moduleUrl: string): string | null {
  return (
    readVersionFromPackageJsonForModuleUrl(moduleUrl) ||
    readVersionFromBuildInfoForModuleUrl(moduleUrl)
  );
}

export function resolveBinaryVersion(params: {
  moduleUrl: string;
  injectedVersion?: string;
  bundledVersion?: string;
  fallback?: string;
}): string {
  return (
    firstNonEmpty(params.injectedVersion) ||
    resolveVersionFromModuleUrl(params.moduleUrl) ||
    firstNonEmpty(params.bundledVersion) ||
    params.fallback ||
    "0.0.0"
  );
}

export type RuntimeVersionEnv = {
  [key: string]: string | undefined;
};

export const RUNTIME_SERVICE_VERSION_FALLBACK = "unknown";
type RuntimeVersionPreference = "env-first" | "runtime-first";

export function resolveUsableRuntimeVersion(version: string | undefined): string | undefined {
  const trimmed = normalizeOptionalString(version);
  // "0.0.0" is the resolver's hard fallback when module metadata cannot be read.
  // Prefer explicit service/package markers in that edge case.
  if (!trimmed || trimmed === "0.0.0") {
    return undefined;
  }
  return trimmed;
}

function resolveVersionFromRuntimeSources(params: {
  env: RuntimeVersionEnv;
  runtimeVersion: string | undefined;
  fallback: string;
  preference: RuntimeVersionPreference;
}): string {
  const preferredCandidates =
    params.preference === "env-first"
      ? [params.env["OPENCLAW_VERSION"], params.runtimeVersion]
      : [params.runtimeVersion, params.env["OPENCLAW_VERSION"]];
  return (
    firstNonEmpty(
      ...preferredCandidates,
      params.env["OPENCLAW_SERVICE_VERSION"],
      params.env["npm_package_version"],
    ) ?? params.fallback
  );
}

export function resolveRuntimeServiceVersion(
  env: RuntimeVersionEnv = process.env as RuntimeVersionEnv,
  fallback = RUNTIME_SERVICE_VERSION_FALLBACK,
): string {
  return resolveVersionFromRuntimeSources({
    env,
    runtimeVersion: resolveUsableRuntimeVersion(VERSION),
    fallback,
    preference: "env-first",
  });
}

export function resolveCompatibilityHostVersion(
  env: RuntimeVersionEnv = process.env as RuntimeVersionEnv,
  fallback = RUNTIME_SERVICE_VERSION_FALLBACK,
): string {
  const explicitCompatibilityVersion = firstNonEmpty(env.OPENCLAW_COMPATIBILITY_HOST_VERSION);
  if (explicitCompatibilityVersion) {
    return explicitCompatibilityVersion;
  }
  return resolveVersionFromRuntimeSources({
    env,
    runtimeVersion: resolveUsableRuntimeVersion(VERSION),
    fallback,
    preference: env === (process.env as RuntimeVersionEnv) ? "runtime-first" : "env-first",
  });
}

// Single source of truth for the current OpenClaw version.
// - Embedded/bundled builds: injected define or env var.
// - Dev/npm builds: package.json.
export const VERSION = resolveBinaryVersion({
  moduleUrl: import.meta.url,
  injectedVersion: typeof __OPENCLAW_VERSION__ === "string" ? __OPENCLAW_VERSION__ : undefined,
  bundledVersion: process.env.OPENCLAW_BUNDLED_VERSION,
});

const staticBuildInfo =
  readBuildInfoForModuleUrl(import.meta.url) ??
  readAdjacentDistBuildInfoForModuleUrl(import.meta.url);

// Capture the current build identity once at module load so a long-lived gateway
// process keeps reporting the build it actually booted with, even if dist/ changes later.
export const CURRENT_BUILD_INFO = Object.freeze({
  version: staticBuildInfo?.version ?? VERSION,
  ...(staticBuildInfo?.commit ? { commit: staticBuildInfo.commit } : {}),
  ...(staticBuildInfo?.builtAt ? { builtAt: staticBuildInfo.builtAt } : {}),
  ...(staticBuildInfo?.buildId ? { buildId: staticBuildInfo.buildId } : {}),
}) satisfies RuntimeBuildInfo;
