import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCommand } from "./cli.js";
import { createPeggiWorkflowTools } from "./tools.js";

vi.mock("./cli.js", () => ({
  runCommand: vi.fn(),
}));

const mockedRunCommand = vi.mocked(runCommand);

async function createHarness() {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "peggi-workflows-test-"));
  const tools = createPeggiWorkflowTools({
    api: {
      pluginConfig: {
        peggiWorkspace: path.join(tmp, "peggi"),
        successbooksCli: path.join(tmp, "successbooks-cli"),
        taskChainGraphScript: path.join(tmp, "task_chain_graph.py"),
        checkpointDb: path.join(tmp, "checkpoint.sqlite"),
        auditLogPath: path.join(tmp, "audit.jsonl"),
      },
    } as Parameters<typeof createPeggiWorkflowTools>[0]["api"],
    ctx: {} as Parameters<typeof createPeggiWorkflowTools>[0]["ctx"],
  });
  return { tmp, tools };
}

function toolByName(tools: Awaited<ReturnType<typeof createHarness>>["tools"], name: string) {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`${name} tool missing`);
  }
  return tool;
}

async function readJsonInputFromCall(index = 0): Promise<Record<string, unknown>> {
  const call = mockedRunCommand.mock.calls[index]?.[0];
  if (!call) {
    throw new Error("runCommand was not called");
  }
  const inputIndex = call.args.indexOf("--input-json");
  expect(inputIndex).toBeGreaterThan(-1);
  return JSON.parse(await fs.readFile(call.args[inputIndex + 1]!, "utf8")) as Record<
    string,
    unknown
  >;
}

describe("peggi workflow tools", () => {
  beforeEach(() => {
    mockedRunCommand.mockReset();
    mockedRunCommand.mockResolvedValue({
      stdout: JSON.stringify({
        status: "ok",
        command: ["node", "dist/index.js", "gl", "create", "--dry-run"],
        metadata: {
          vendor: "CRAYON PTE LTD",
          reference: "2803018969",
          entryType: "MP",
          refNo: "MP0903185",
        },
      }),
      stderr: "",
      returncode: 0,
    });
  });

  it("registers the five Peggi workflow tools", async () => {
    const { tools } = await createHarness();

    expect(tools.map((tool) => tool.name).toSorted()).toEqual([
      "peggi_books_status",
      "peggi_duplicate_gate",
      "peggi_email_invoice_flow",
      "peggi_expense_entry",
      "peggi_month_end_review",
    ]);
  });

  it("maps expense dry-run to the Peggi graph with checkpoint identity", async () => {
    const { tmp, tools } = await createHarness();

    const result = await toolByName(tools, "peggi_expense_entry").execute("mp dry run", {
      operation: "dry-run",
      args: {
        vendor: "CRAYON PTE LTD",
        reference: "2803018969",
        amount: 3895.35,
        baseAmount: 3573.72,
        gstAmount: 321.63,
        account: "C0009",
      },
    });

    expect(mockedRunCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "python3",
        args: [
          path.join(tmp, "task_chain_graph.py"),
          "--input-json",
          expect.any(String),
          "--checkpoint-db",
          path.join(tmp, "checkpoint.sqlite"),
          "--thread-id",
          "peggi-workflow:expense_entry:dry-run:mp-dry-run",
          "--workspace",
          path.join(tmp, "peggi"),
          "--successbooks-cli",
          path.join(tmp, "successbooks-cli"),
        ],
      }),
    );
    expect(await readJsonInputFromCall()).toEqual({
      workflow: "expense_entry",
      operation: "dry-run",
      approved: false,
      args: {
        vendor: "CRAYON PTE LTD",
        reference: "2803018969",
        amount: 3895.35,
        baseAmount: 3573.72,
        gstAmount: 321.63,
        account: "C0009",
      },
    });
    expect(result.details).toMatchObject({
      toolName: "peggi_expense_entry",
      workflow: "expense_entry",
      operation: "dry-run",
      approved: false,
      status: "ok",
      threadId: "peggi-workflow:expense_entry:dry-run:mp-dry-run",
      metadata: {
        vendor: "CRAYON PTE LTD",
        reference: "2803018969",
        entryType: "MP",
        refNo: "MP0903185",
      },
    });
  });

  it("maps workflow operations and propagates approval", async () => {
    const { tools } = await createHarness();

    await toolByName(tools, "peggi_duplicate_gate").execute("dup", {
      operation: "check-gl",
      args: { vendor: "CRAYON PTE LTD", reference: "2803018969" },
    });
    await toolByName(tools, "peggi_email_invoice_flow").execute("mail", {
      operation: "move-after-complete",
      approved: true,
      args: { emailId: "42" },
    });
    await toolByName(tools, "peggi_month_end_review").execute("month", {
      operation: "date-boundary",
      args: { date: "2026-05-31" },
    });
    await toolByName(tools, "peggi_books_status").execute("status", {
      operation: "auth-probe",
    });

    const payloads = await Promise.all(
      mockedRunCommand.mock.calls.map(async (call) => {
        const args = call[0].args;
        return JSON.parse(await fs.readFile(args[args.indexOf("--input-json") + 1]!, "utf8"));
      }),
    );
    expect(payloads).toMatchObject([
      {
        workflow: "duplicate_gate",
        operation: "check-gl",
        approved: false,
      },
      {
        workflow: "email_invoice_flow",
        operation: "move-after-complete",
        approved: true,
      },
      {
        workflow: "month_end_review",
        operation: "date-boundary",
        approved: false,
      },
      {
        workflow: "books_status",
        operation: "auth-probe",
        approved: false,
      },
    ]);
  });

  it("writes audit records with references but without sensitive payload content", async () => {
    const { tmp, tools } = await createHarness();

    await toolByName(tools, "peggi_expense_entry").execute("sensitive", {
      operation: "draft",
      args: {
        vendor: "Private Vendor",
        reference: "INV-1",
        body: "Private invoice body text",
        emailBody: "Private email body text",
      },
    });

    const audit = await fs.readFile(path.join(tmp, "audit.jsonl"), "utf8");
    const entry = JSON.parse(audit.trim()) as Record<string, unknown>;
    expect(entry).toMatchObject({
      toolName: "peggi_expense_entry",
      workflow: "expense_entry",
      operation: "draft",
      approved: false,
      status: "ok",
      threadId: "peggi-workflow:expense_entry:draft:sensitive",
      metadata: {
        vendor: "CRAYON PTE LTD",
        reference: "2803018969",
      },
    });
    expect(audit).not.toContain("Private invoice body text");
    expect(audit).not.toContain("Private email body text");
  });
});
