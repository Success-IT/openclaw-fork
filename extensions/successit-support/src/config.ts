import os from "node:os";
import path from "node:path";

export type SuccessItSupportConfig = {
  mappingPath: string;
  configPath: string;
  successCatalystCliDir: string;
  successGraphScript: string;
  priorityScript: string;
  jensenWhatsAppId: string;
  jensenSenderKeys: string[];
  defaultSupportTeamSenders: string[];
};

function expandHome(value: string): string {
  if (value === "~") {
    return os.homedir();
  }
  if (value.startsWith("~/")) {
    return path.join(os.homedir(), value.slice(2));
  }
  return value;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? expandHome(value.trim()) : fallback;
}

function readStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }
  const values = value.filter(
    (entry): entry is string => typeof entry === "string" && !!entry.trim(),
  );
  return values.length ? values.map((entry) => entry.trim()) : fallback;
}

export function resolveSuccessItSupportConfig(raw: unknown): SuccessItSupportConfig {
  const config = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    mappingPath: readString(
      config.mappingPath,
      path.join(os.homedir(), "zach", "memory", "group-permissions.json"),
    ),
    configPath: readString(
      config.configPath,
      path.join(os.homedir(), ".openclaw", "openclaw.json"),
    ),
    successCatalystCliDir: readString(
      config.successCatalystCliDir,
      path.join(os.homedir(), "Documents", "successcatalyst-cli"),
    ),
    successGraphScript: readString(
      config.successGraphScript,
      path.join(os.homedir(), "zach", "scripts", "successgraph.py"),
    ),
    priorityScript: readString(
      config.priorityScript,
      path.join(os.homedir(), "zach", "scripts", "infer_ticket_priority.py"),
    ),
    jensenWhatsAppId: readString(config.jensenWhatsAppId, "6591837772@c.us"),
    jensenSenderKeys: readStringArray(config.jensenSenderKeys, [
      "e164:+6591837772",
      "+6591837772",
      "6591837772",
      "6591837772@c.us",
    ]),
    defaultSupportTeamSenders: readStringArray(config.defaultSupportTeamSenders, [
      "e164:+6591837772",
      "+6591837772",
      "6591837772",
      "6591837772@c.us",
    ]),
  };
}
