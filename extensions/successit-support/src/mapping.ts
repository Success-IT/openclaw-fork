import fs from "node:fs/promises";
import path from "node:path";

export type SupportGroupMapping = {
  channel: "whatsapp";
  accountId: "laylah";
  groupJid: string;
  groupName?: string;
  customerCode: string;
  traderCode: string;
  customerName: string;
  tenantCode?: string;
  products?: string[];
  platformStatus?: string;
  configuredBy?: string;
  configuredAt?: string;
  supportTeamSenders: string[];
};

export type SupportGroupMappings = Record<string, SupportGroupMapping>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const entries = value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
  return entries.length ? entries.map((entry) => entry.trim()) : undefined;
}

export function normalizeMappingEntry(
  groupJid: string,
  value: unknown,
): SupportGroupMapping | undefined {
  const raw = asRecord(value);
  const traderCode = readString(raw.traderCode) ?? readString(raw.companyCode);
  const customerName = readString(raw.customerName) ?? readString(raw.companyName);
  if (!traderCode || !customerName) {
    return undefined;
  }
  return {
    channel: "whatsapp",
    accountId: "laylah",
    groupJid: readString(raw.groupJid) ?? groupJid,
    ...(readString(raw.groupName) ? { groupName: readString(raw.groupName) } : {}),
    customerCode: traderCode,
    traderCode,
    customerName,
    ...(readString(raw.tenantCode) ? { tenantCode: readString(raw.tenantCode) } : {}),
    ...(readStringArray(raw.products) ? { products: readStringArray(raw.products) } : {}),
    ...(readString(raw.platformStatus) ? { platformStatus: readString(raw.platformStatus) } : {}),
    configuredBy: readString(raw.configuredBy) ?? readString(raw.permissionedBy),
    configuredAt: readString(raw.configuredAt) ?? readString(raw.permissionedAt),
    supportTeamSenders: readStringArray(raw.supportTeamSenders) ?? [],
  };
}

export async function readMappings(mappingPath: string): Promise<SupportGroupMappings> {
  try {
    const parsed = JSON.parse(await fs.readFile(mappingPath, "utf8")) as unknown;
    const raw = asRecord(parsed);
    const normalized: SupportGroupMappings = {};
    for (const [groupJid, value] of Object.entries(raw)) {
      const entry = normalizeMappingEntry(groupJid, value);
      if (entry) {
        normalized[entry.groupJid] = entry;
      }
    }
    return normalized;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function writeMappings(
  mappingPath: string,
  mappings: SupportGroupMappings,
): Promise<void> {
  await fs.mkdir(path.dirname(mappingPath), { recursive: true });
  const text = `${JSON.stringify(mappings, null, 2)}\n`;
  await fs.writeFile(mappingPath, text, "utf8");
}
