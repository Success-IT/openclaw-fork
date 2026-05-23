import { getSenderIdentity } from "../../identity.js";
import type { WebInboundMsg } from "../types.js";

export const GROUP_FOLLOWUP_WINDOW_MS = 10 * 60 * 1000;

export type PendingGroupFollowup = {
  senderKey: string;
  expiresAt: number;
};

export type PendingGroupFollowupMap = Map<string, PendingGroupFollowup>;

function normalizeSenderKey(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : null;
}

export function resolveGroupFollowupSenderKey(msg: WebInboundMsg): string | null {
  const sender = getSenderIdentity(msg);
  return (
    normalizeSenderKey(sender.e164) ??
    normalizeSenderKey(sender.jid) ??
    normalizeSenderKey(msg.senderJid) ??
    normalizeSenderKey(msg.senderE164) ??
    null
  );
}

export function shouldOpenGroupFollowupWindow(text: string | undefined): boolean {
  const normalized = text?.trim();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("?") ||
    /\b(reply|confirm|approve|approval|which|what|when|where|who|how)\b/i.test(normalized) ||
    /approval required/i.test(normalized)
  );
}

export function armGroupFollowup(params: {
  followups: PendingGroupFollowupMap;
  groupHistoryKey: string;
  msg: WebInboundMsg;
  now?: number;
  text?: string;
}): boolean {
  if (params.msg.chatType !== "group") {
    return false;
  }
  if (!shouldOpenGroupFollowupWindow(params.text)) {
    return false;
  }
  const senderKey = resolveGroupFollowupSenderKey(params.msg);
  if (!senderKey) {
    return false;
  }
  params.followups.set(params.groupHistoryKey, {
    senderKey,
    expiresAt: (params.now ?? Date.now()) + GROUP_FOLLOWUP_WINDOW_MS,
  });
  return true;
}

export function consumeGroupFollowup(params: {
  followups: PendingGroupFollowupMap;
  groupHistoryKey: string;
  msg: WebInboundMsg;
  now?: number;
}): boolean {
  const followup = params.followups.get(params.groupHistoryKey);
  if (!followup) {
    return false;
  }
  if (followup.expiresAt <= (params.now ?? Date.now())) {
    params.followups.delete(params.groupHistoryKey);
    return false;
  }
  const senderKey = resolveGroupFollowupSenderKey(params.msg);
  if (!senderKey || senderKey !== followup.senderKey) {
    return false;
  }
  params.followups.delete(params.groupHistoryKey);
  return true;
}
