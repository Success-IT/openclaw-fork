export function extractGroupJidFromSessionKey(sessionKey?: string): string | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const parts = sessionKey.split(":");
  const groupIndex = parts.indexOf("group");
  if (groupIndex < 0) {
    return undefined;
  }
  const groupId = parts
    .slice(groupIndex + 1)
    .join(":")
    .trim();
  return groupId || undefined;
}

export function isRequesterJensen(params: {
  requesterSenderId?: string;
  senderIsOwner?: boolean;
  jensenSenderKeys: readonly string[];
}): boolean {
  if (params.senderIsOwner === true) {
    return true;
  }
  const requester = params.requesterSenderId?.trim();
  if (!requester) {
    return false;
  }
  return params.jensenSenderKeys.includes(requester);
}

export function isSupportTeamSender(params: {
  requesterSenderId?: string;
  senderIsOwner?: boolean;
  supportTeamSenders?: readonly string[];
  jensenSenderKeys: readonly string[];
}): boolean {
  if (isRequesterJensen(params)) {
    return true;
  }
  const requester = params.requesterSenderId?.trim();
  if (!requester) {
    return false;
  }
  return Boolean(params.supportTeamSenders?.includes(requester));
}
