import type { CliDeps } from "../../cli/deps.js";
import type { OpenClawConfig } from "../../config/config.js";
import { logInfo, logWarn } from "../../logger.js";

/**
 * Result of verifying agent output against current external tool state.
 */
export type VerificationResult = {
  /** Verification status */
  status: "fresh" | "stale" | "unknown" | "error";
  /** Optional reason for the status */
  reason?: string;
  /** If stale, provide an updated summary reflecting current state */
  updatedSummary?: string;
};

/**
 * Function that verifies agent output by re-querying an external tool.
 */
export type VerificationFn = (params: {
  cfg: OpenClawConfig;
  agentId: string;
  originalSummary: string;
  executionStartMs: number;
  deps: CliDeps;
}) => Promise<VerificationResult>;

/**
 * Registry of verification functions keyed by tool name.
 */
const verifiers = new Map<string, VerificationFn>();

/**
 * Register a verification function for a specific tool.
 *
 * @param toolName - Tool identifier (e.g., "mgc", "himalaya")
 * @param fn - Verification function
 */
export function registerVerifier(toolName: string, fn: VerificationFn): void {
  verifiers.set(toolName, fn);
  logInfo(`[verification] Registered verifier for tool: ${toolName}`);
}

/**
 * Get the verification function for a specific tool.
 *
 * @param toolName - Tool identifier
 * @returns Verification function or undefined if not registered
 */
export function getVerifier(toolName: string): VerificationFn | undefined {
  return verifiers.get(toolName);
}

/**
 * Verify agent output by re-querying specified tools.
 *
 * @param params - Verification parameters
 * @returns Combined verification result
 */
export async function verifyAgentOutput(params: {
  cfg: OpenClawConfig;
  agentId: string;
  originalSummary: string;
  executionStartMs: number;
  deps: CliDeps;
  tools: string[];
  timeoutMs?: number;
}): Promise<VerificationResult> {
  const { tools, timeoutMs = 20_000, ...verifyParams } = params;

  if (tools.length === 0) {
    return { status: "unknown", reason: "No tools specified for verification" };
  }

  logInfo(
    `[verification] Verifying output for agent ${params.agentId} with tools: ${tools.join(", ")}`,
  );

  const results: VerificationResult[] = [];

  for (const toolName of tools) {
    const verifyFn = getVerifier(toolName);
    if (!verifyFn) {
      logWarn(`[verification] No verifier registered for tool: ${toolName}`);
      results.push({
        status: "unknown",
        reason: `No verifier for ${toolName}`,
      });
      continue;
    }

    try {
      // Run verification with timeout
      const timeoutPromise = new Promise<VerificationResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              status: "error",
              reason: `Verification timeout for ${toolName}`,
            }),
          timeoutMs,
        ),
      );

      const verifyPromise = verifyFn(verifyParams);
      const result = await Promise.race([verifyPromise, timeoutPromise]);
      results.push(result);

      if (result.status === "stale") {
        logWarn(`[verification] Stale data detected by ${toolName}: ${result.reason}`);
      }
    } catch (err) {
      logWarn(`[verification] Error during ${toolName} verification: ${String(err)}`);
      results.push({ status: "error", reason: String(err) });
    }
  }

  // Aggregate results: if any verifier found stale data, overall is stale
  const hasStale = results.some((r) => r.status === "stale");
  const hasError = results.some((r) => r.status === "error");

  if (hasStale) {
    // Find the first stale result with an updated summary
    const staleWithUpdate = results.find((r) => r.status === "stale" && r.updatedSummary);
    return {
      status: "stale",
      reason: results
        .filter((r) => r.status === "stale")
        .map((r) => r.reason)
        .join("; "),
      updatedSummary: staleWithUpdate?.updatedSummary,
    };
  }

  if (hasError) {
    return {
      status: "error",
      reason: results
        .filter((r) => r.status === "error")
        .map((r) => r.reason)
        .join("; "),
    };
  }

  const allFresh = results.every((r) => r.status === "fresh");
  if (allFresh) {
    return { status: "fresh", reason: "All verifiers confirmed fresh data" };
  }

  return { status: "unknown", reason: "Mixed or unknown verification results" };
}
