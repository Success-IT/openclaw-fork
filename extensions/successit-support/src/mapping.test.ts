import { describe, expect, it } from "vitest";
import { normalizeMappingEntry } from "./mapping.js";

describe("successit support mapping", () => {
  it("normalizes Zach legacy group permission fields", () => {
    expect(
      normalizeMappingEntry("120@g.us", {
        companyCode: "S049",
        companyName: "SUCCESS IT",
        permissionedBy: "+6591837772",
        permissionedAt: "2026-03-08T05:47:56+0000",
      }),
    ).toMatchObject({
      channel: "whatsapp",
      accountId: "laylah",
      groupJid: "120@g.us",
      customerCode: "S049",
      traderCode: "S049",
      customerName: "SUCCESS IT",
      configuredBy: "+6591837772",
      configuredAt: "2026-03-08T05:47:56+0000",
    });
  });

  it("rejects incomplete mappings", () => {
    expect(normalizeMappingEntry("120@g.us", { companyName: "Missing code" })).toBeUndefined();
  });
});
