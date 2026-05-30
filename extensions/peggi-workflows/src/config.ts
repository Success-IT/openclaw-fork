import os from "node:os";
import path from "node:path";

export type PeggiWorkflowConfig = {
  peggiWorkspace: string;
  successbooksCli: string;
  taskChainGraphScript: string;
  checkpointDb: string;
  auditLogPath: string;
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

export function resolvePeggiWorkflowConfig(raw: unknown): PeggiWorkflowConfig {
  const config = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const peggiWorkspace = readString(config.peggiWorkspace, path.join(os.homedir(), "peggi"));
  return {
    peggiWorkspace,
    successbooksCli: readString(
      config.successbooksCli,
      path.join(os.homedir(), "Documents", "successbooks-cli"),
    ),
    taskChainGraphScript: readString(
      config.taskChainGraphScript,
      path.join(peggiWorkspace, "workflows", "peggi_task_chains", "task_chain_graph.py"),
    ),
    checkpointDb: readString(
      config.checkpointDb,
      path.join(peggiWorkspace, "memory", "peggi-workflows.sqlite"),
    ),
    auditLogPath: readString(
      config.auditLogPath,
      path.join(peggiWorkspace, "memory", "peggi-workflow-runs.jsonl"),
    ),
  };
}
