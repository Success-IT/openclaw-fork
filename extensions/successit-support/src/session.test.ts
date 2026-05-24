import { describe, expect, it } from "vitest";
import {
  extractGroupJidFromSessionKey,
  isRequesterJensen,
  isSupportTeamSender,
} from "./session.js";

describe("successit support session policy", () => {
  it("extracts WhatsApp group JIDs from agent session keys", () => {
    expect(
      extractGroupJidFromSessionKey(
        "agent:laylah-successit-support:whatsapp:laylah:group:120@g.us",
      ),
    ).toBe("120@g.us");
  });

  it("treats only Jensen sender keys or owner context as Jensen", () => {
    const jensenSenderKeys = ["e164:+6591837772"];
    expect(
      isRequesterJensen({
        requesterSenderId: "e164:+6591837772",
        senderIsOwner: false,
        jensenSenderKeys,
      }),
    ).toBe(true);
    expect(
      isRequesterJensen({
        requesterSenderId: "e164:+6511111111",
        senderIsOwner: false,
        jensenSenderKeys,
      }),
    ).toBe(false);
    expect(isRequesterJensen({ senderIsOwner: true, jensenSenderKeys })).toBe(true);
  });

  it("allows configured support team senders to create tickets", () => {
    expect(
      isSupportTeamSender({
        requesterSenderId: "e164:+6522222222",
        senderIsOwner: false,
        supportTeamSenders: ["e164:+6522222222"],
        jensenSenderKeys: ["e164:+6591837772"],
      }),
    ).toBe(true);
  });
});
