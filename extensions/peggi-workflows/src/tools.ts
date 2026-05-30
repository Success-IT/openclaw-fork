import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import {
  type AnyAgentTool,
  type OpenClawPluginApi,
  type OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/core";
import { runCommand, type CommandResult } from "./cli.js";
import { resolvePeggiWorkflowConfig, type PeggiWorkflowConfig } from "./config.js";

const JsonArgs = Type.Record(Type.String(), Type.Any());

const ExpenseEntrySchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("draft"),
      Type.Literal("dry-run"),
      Type.Literal("create-approved"),
      Type.Literal("attach"),
      Type.Literal("verify"),
    ]),
    approved: Type.Optional(Type.Boolean()),
    args: JsonArgs,
  },
  { additionalProperties: false },
);

const DuplicateGateSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("claim-doc"),
      Type.Literal("check-gl"),
      Type.Literal("mark-doc"),
      Type.Literal("sync-state"),
    ]),
    approved: Type.Optional(Type.Boolean()),
    args: JsonArgs,
  },
  { additionalProperties: false },
);

const EmailInvoiceFlowSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("list"),
      Type.Literal("read"),
      Type.Literal("download"),
      Type.Literal("draft-entry"),
      Type.Literal("move-after-complete"),
    ]),
    approved: Type.Optional(Type.Boolean()),
    args: JsonArgs,
  },
  { additionalProperties: false },
);

const MonthEndReviewSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("pending"),
      Type.Literal("recurring"),
      Type.Literal("date-boundary"),
      Type.Literal("unresolved-items"),
    ]),
    approved: Type.Optional(Type.Boolean()),
    args: Type.Optional(JsonArgs),
  },
  { additionalProperties: false },
);

const BooksStatusSchema = Type.Object(
  {
    operation: Type.Union([
      Type.Literal("auth-probe"),
      Type.Literal("pending-state"),
      Type.Literal("recent-entries"),
      Type.Literal("audit-tail"),
    ]),
    approved: Type.Optional(Type.Boolean()),
    args: Type.Optional(JsonArgs),
  },
  { additionalProperties: false },
);

type WorkflowResult = {
  toolName: string;
  workflow: string;
  operation: string;
  approved: boolean;
  status: string;
  returncode: number | null;
  stdout: string;
  stderr: string;
  threadId: string;
  checkpointDb: string;
  command?: string[];
  graph?: unknown;
  metadata?: Record<string, unknown>;
};

type RunWorkflowParams = {
  config: PeggiWorkflowConfig;
  toolCallId: string;
  toolName: string;
  workflow: string;
  operation: string;
  approved?: boolean;
  args?: Record<string, unknown>;
};

function jsonResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
    details: payload,
  };
}

function safeToolCallId(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]+/g, "-").slice(0, 80) || "call";
}

function parseGraphOutput(output: CommandResult): unknown {
  const trimmed = output.stdout.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
}

function graphStatus(graph: unknown, output: CommandResult): string {
  if (graph && typeof graph === "object" && "status" in graph) {
    const status = (graph as { status?: unknown }).status;
    if (typeof status === "string" && status) {
      return status;
    }
  }
  return output.returncode === 0 ? "ok" : "failed";
}

function graphCommand(graph: unknown): string[] | undefined {
  if (!graph || typeof graph !== "object" || !("command" in graph)) {
    return undefined;
  }
  const command = (graph as { command?: unknown }).command;
  return Array.isArray(command) && command.every((part) => typeof part === "string")
    ? command
    : undefined;
}

function graphMetadata(graph: unknown): Record<string, unknown> | undefined {
  if (!graph || typeof graph !== "object" || !("metadata" in graph)) {
    return undefined;
  }
  const metadata = (graph as { metadata?: unknown }).metadata;
  return metadata && typeof metadata === "object" && !Array.isArray(metadata)
    ? (metadata as Record<string, unknown>)
    : undefined;
}

async function writeJsonInput(payload: unknown): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "peggi-workflow-"));
  const inputPath = path.join(dir, "input.json");
  await fs.writeFile(inputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return inputPath;
}

function scalar(value: unknown): string | number | boolean | null | undefined {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  return undefined;
}

function referenceMetadata(args: Record<string, unknown> | undefined): Record<string, unknown> {
  const source = args ?? {};
  return {
    vendor: scalar(source.vendor),
    refNo: scalar(source.refNo),
    reference: scalar(source.reference),
    invoiceNo: scalar(source.invoiceNo),
    amount: scalar(source.amount),
    date: scalar(source.date),
    entryType: scalar(source.entryType),
    file: scalar(source.file),
    emailId: scalar(source.emailId),
    account: scalar(source.account),
    creditAccount: scalar(source.creditAccount),
    paymentMode: scalar(source.paymentMode),
  };
}

async function appendAudit(config: PeggiWorkflowConfig, result: WorkflowResult): Promise<void> {
  const entry = {
    timestamp: new Date().toISOString(),
    toolName: result.toolName,
    workflow: result.workflow,
    operation: result.operation,
    approved: result.approved,
    status: result.status,
    returncode: result.returncode,
    threadId: result.threadId,
    checkpointDb: result.checkpointDb,
    command: result.command,
    metadata: result.metadata,
  };
  await fs.mkdir(path.dirname(config.auditLogPath), { recursive: true });
  await fs.appendFile(config.auditLogPath, `${JSON.stringify(entry)}\n`, "utf8");
}

async function runWorkflow(params: RunWorkflowParams): Promise<WorkflowResult> {
  const approved = params.approved ?? false;
  const threadId = `peggi-workflow:${params.workflow}:${params.operation}:${safeToolCallId(
    params.toolCallId,
  )}`;
  const inputPath = await writeJsonInput({
    workflow: params.workflow,
    operation: params.operation,
    approved,
    args: params.args ?? {},
  });
  let output: CommandResult;
  try {
    output = await runCommand({
      command: "python3",
      args: [
        params.config.taskChainGraphScript,
        "--input-json",
        inputPath,
        "--checkpoint-db",
        params.config.checkpointDb,
        "--thread-id",
        threadId,
        "--workspace",
        params.config.peggiWorkspace,
        "--successbooks-cli",
        params.config.successbooksCli,
      ],
      timeoutMs: 180000,
    });
  } catch (error) {
    output = {
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      returncode: null,
    };
  }
  const graph = parseGraphOutput(output);
  const result: WorkflowResult = {
    toolName: params.toolName,
    workflow: params.workflow,
    operation: params.operation,
    approved,
    status: graphStatus(graph, output),
    returncode: output.returncode,
    stdout: output.stdout,
    stderr: output.stderr,
    threadId,
    checkpointDb: params.config.checkpointDb,
    command: graphCommand(graph),
    graph,
    metadata: {
      ...referenceMetadata(params.args),
      ...(graphMetadata(graph) ?? {}),
    },
  };
  await appendAudit(params.config, result);
  return result;
}

export function createPeggiWorkflowTools(params: {
  api: Pick<OpenClawPluginApi, "pluginConfig">;
  ctx: OpenClawPluginToolContext;
}): AnyAgentTool[] {
  const config = resolvePeggiWorkflowConfig(params.api.pluginConfig);

  return [
    {
      name: "peggi_expense_entry",
      label: "Peggi Expense Entry",
      description:
        "Draft, dry-run, create, attach, or verify Peggi's MP-with-GST expense/payment workflow through LangGraph checkpoints.",
      parameters: ExpenseEntrySchema,
      execute: async (toolCallId, rawParams) => {
        const input = rawParams as {
          operation: "draft" | "dry-run" | "create-approved" | "attach" | "verify";
          approved?: boolean;
          args: Record<string, unknown>;
        };
        return jsonResult(
          await runWorkflow({
            config,
            toolCallId,
            toolName: "peggi_expense_entry",
            workflow: "expense_entry",
            operation: input.operation,
            approved: input.approved,
            args: input.args,
          }),
        );
      },
    },
    {
      name: "peggi_duplicate_gate",
      label: "Peggi Duplicate Gate",
      description:
        "Run Peggi's SQLite claim, GL duplicate gate, mark-doc, and active state sync through an audited workflow.",
      parameters: DuplicateGateSchema,
      execute: async (toolCallId, rawParams) => {
        const input = rawParams as {
          operation: "claim-doc" | "check-gl" | "mark-doc" | "sync-state";
          approved?: boolean;
          args: Record<string, unknown>;
        };
        return jsonResult(
          await runWorkflow({
            config,
            toolCallId,
            toolName: "peggi_duplicate_gate",
            workflow: "duplicate_gate",
            operation: input.operation,
            approved: input.approved,
            args: input.args,
          }),
        );
      },
    },
    {
      name: "peggi_email_invoice_flow",
      label: "Peggi Email Invoice Flow",
      description:
        "List, read, download, draft, or move Peggi invoice emails after deterministic completion checks.",
      parameters: EmailInvoiceFlowSchema,
      execute: async (toolCallId, rawParams) => {
        const input = rawParams as {
          operation: "list" | "read" | "download" | "draft-entry" | "move-after-complete";
          approved?: boolean;
          args: Record<string, unknown>;
        };
        return jsonResult(
          await runWorkflow({
            config,
            toolCallId,
            toolName: "peggi_email_invoice_flow",
            workflow: "email_invoice_flow",
            operation: input.operation,
            approved: input.approved,
            args: input.args,
          }),
        );
      },
    },
    {
      name: "peggi_month_end_review",
      label: "Peggi Month End Review",
      description:
        "Run Peggi's pending, recurring, date-boundary, and unresolved month-end checks with checkpointed output.",
      parameters: MonthEndReviewSchema,
      execute: async (toolCallId, rawParams) => {
        const input = rawParams as {
          operation: "pending" | "recurring" | "date-boundary" | "unresolved-items";
          approved?: boolean;
          args?: Record<string, unknown>;
        };
        return jsonResult(
          await runWorkflow({
            config,
            toolCallId,
            toolName: "peggi_month_end_review",
            workflow: "month_end_review",
            operation: input.operation,
            approved: input.approved,
            args: input.args,
          }),
        );
      },
    },
    {
      name: "peggi_books_status",
      label: "Peggi Books Status",
      description: "Run Peggi auth, pending-state, recent-entry, or workflow audit status checks.",
      parameters: BooksStatusSchema,
      execute: async (toolCallId, rawParams) => {
        const input = rawParams as {
          operation: "auth-probe" | "pending-state" | "recent-entries" | "audit-tail";
          approved?: boolean;
          args?: Record<string, unknown>;
        };
        return jsonResult(
          await runWorkflow({
            config,
            toolCallId,
            toolName: "peggi_books_status",
            workflow: "books_status",
            operation: input.operation,
            approved: input.approved,
            args: input.args,
          }),
        );
      },
    },
  ];
}
