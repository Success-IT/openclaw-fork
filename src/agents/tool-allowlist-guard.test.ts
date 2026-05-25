import { describe, expect, it } from "vitest";
import {
  buildEmptyExplicitToolAllowlistError,
  collectExplicitToolAllowlistSources,
} from "./tool-allowlist-guard.js";

describe("tool allowlist guard", () => {
  it("does not block prompt submission when explicit allowlists resolve to no callable tools", () => {
    expect(
      buildEmptyExplicitToolAllowlistError({
        sources: [{ label: "tools.allow", entries: [" query_db "] }],
        callableToolNames: [],
        toolsEnabled: true,
      }),
    ).toBeNull();
  });

  it("allows text-only runs without explicit allowlists", () => {
    expect(
      buildEmptyExplicitToolAllowlistError({
        sources: [],
        callableToolNames: [],
        toolsEnabled: true,
      }),
    ).toBeNull();
  });

  it("allows explicit allowlists when at least one callable tool remains", () => {
    expect(
      buildEmptyExplicitToolAllowlistError({
        sources: [{ label: "tools.allow", entries: ["read", "missing_tool"] }],
        callableToolNames: ["read"],
        toolsEnabled: true,
      }),
    ).toBeNull();
  });

  it("keeps source labels for config and runtime allowlists", () => {
    const sources = collectExplicitToolAllowlistSources([
      { label: "tools.allow", allow: [" read ", ""] },
      { label: "runtime toolsAllow", allow: ["query_db"] },
      { label: "tools.byProvider.allow" },
    ]);

    expect(sources).toEqual([
      { label: "tools.allow", entries: ["read"] },
      { label: "runtime toolsAllow", entries: ["query_db"] },
    ]);
  });
});
