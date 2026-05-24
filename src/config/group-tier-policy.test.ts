import { describe, expect, it } from "vitest";
import { resolveGroupTierSystemPrompt, resolveGroupTierToolPolicy } from "./group-tier-policy.js";

describe("resolveGroupTierToolPolicy", () => {
  it("returns deny-all for public tier", () => {
    expect(resolveGroupTierToolPolicy("public")).toEqual({ deny: ["*"] });
  });

  it("treats undefined tier as public (deny-all)", () => {
    expect(resolveGroupTierToolPolicy(undefined)).toEqual({ deny: ["*"] });
  });

  it("returns limited allow list for trusted tier", () => {
    expect(resolveGroupTierToolPolicy("trusted")).toEqual({
      allow: ["web_search", "web_fetch", "browser", "calendar_availability"],
    });
  });

  it("returns same allow list for enterprise tier as trusted", () => {
    expect(resolveGroupTierToolPolicy("enterprise")).toEqual(resolveGroupTierToolPolicy("trusted"));
  });
});

describe("resolveGroupTierSystemPrompt", () => {
  it("returns hard constraint prompt for public tier", () => {
    expect(resolveGroupTierSystemPrompt("public")).toContain("HARD CONSTRAINT");
    expect(resolveGroupTierSystemPrompt("public")).toContain("CALENDAR PRIVACY");
  });

  it("treats undefined tier as public", () => {
    expect(resolveGroupTierSystemPrompt(undefined)).toBe(resolveGroupTierSystemPrompt("public"));
  });

  it("returns lighter prompt for trusted tier", () => {
    expect(resolveGroupTierSystemPrompt("trusted")).toContain(
      "GROUP CONSTRAINT — TRUSTED/ENTERPRISE",
    );
    expect(resolveGroupTierSystemPrompt("trusted")).toContain("CALENDAR PRIVACY");
  });
});
