import fs from "node:fs/promises";
import {
  jsonResult,
  type AnyAgentTool,
  type OpenClawConfig,
  type OpenClawPluginApi,
  type OpenClawPluginToolContext,
} from "openclaw/plugin-sdk/core";
import { Type } from "typebox";
import { runCommand, parseJsonOutput } from "./cli.js";
import { resolveSuccessItSupportConfig } from "./config.js";
import {
  readMappings,
  writeMappings,
  type SupportGroupMapping,
  type SupportGroupMappings,
} from "./mapping.js";
import {
  extractGroupJidFromSessionKey,
  isRequesterJensen,
  isSupportTeamSender,
} from "./session.js";

const OnboardSchema = Type.Object(
  {
    groupJid: Type.String({ minLength: 1 }),
    customerQuery: Type.String({ minLength: 1 }),
    groupName: Type.Optional(Type.String()),
    confirm: Type.Boolean(),
    supportTeamSenders: Type.Optional(Type.Array(Type.String())),
  },
  { additionalProperties: false },
);

const TicketCreateSchema = Type.Object(
  {
    summary: Type.String({ minLength: 1 }),
    description: Type.String({ minLength: 1 }),
    requestBy: Type.Optional(Type.String()),
    groupJid: Type.Optional(Type.String()),
    hasAttachment: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

const NotifySchema = Type.Object(
  {
    groupJid: Type.Optional(Type.String()),
    groupName: Type.Optional(Type.String()),
    customer: Type.Optional(Type.String()),
    tenant: Type.Optional(Type.String()),
    sender: Type.Optional(Type.String()),
    originalMessage: Type.String({ minLength: 1 }),
    intent: Type.String({ minLength: 1 }),
    ticketKey: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

type CustomerSearchResult = {
  customers?: Array<{
    TraderCode?: string;
    TraderName?: string;
    Group?: string;
    Email?: string;
    HandPhone?: string;
    Tel?: string;
  }>;
  customer?: {
    TraderCode?: string;
    TraderName?: string;
  };
};

type SuccessGraphResult = {
  status?: string;
  client?: {
    name?: string;
    traderCode?: string;
    platformStatus?: string;
  };
  tenant?: {
    compCode?: string;
    subscriptionStatus?: string;
  };
  products?: string[];
  summary?: string;
};

type PriorityResult = {
  priority?: string;
};

type TicketCreateResult = {
  success?: boolean;
  ticket?: {
    Issuekey?: string;
    Summary?: string;
    Status?: string;
    Priority?: string;
  };
};

async function sendJensenWhatsAppDm(params: { to: string; text: string; cfg: OpenClawConfig }) {
  const modulePath = "../../whatsapp/src/send.js";
  const loaded = (await import(modulePath)) as {
    sendMessageWhatsApp: (
      to: string,
      body: string,
      options: { verbose: boolean; cfg: OpenClawConfig; accountId?: string },
    ) => Promise<{ messageId: string; toJid: string }>;
  };
  return await loaded.sendMessageWhatsApp(params.to, params.text, {
    verbose: false,
    cfg: params.cfg,
    accountId: "laylah",
  });
}

function readRuntimeConfig(ctx: OpenClawPluginToolContext, api: OpenClawPluginApi): OpenClawConfig {
  return ctx.runtimeConfig ?? ctx.config ?? api.config;
}

function normalizeSenderList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry): entry is string => typeof entry === "string" && !!entry.trim())
    .map((entry) => entry.trim());
}

function selectSingleCustomer(result: CustomerSearchResult) {
  const customers = result.customers ?? (result.customer ? [result.customer] : []);
  const valid = customers.filter((customer) => customer.TraderCode && customer.TraderName);
  if (valid.length !== 1) {
    return { customers: valid };
  }
  return { customer: valid[0], customers: valid };
}

async function searchCustomer(params: {
  cliDir: string;
  query: string;
}): Promise<CustomerSearchResult> {
  const output = await runCommand({
    command: "node",
    args: ["dist/index.js", "customer", "search", params.query, "--output", "json", "--no-color"],
    cwd: params.cliDir,
    timeoutMs: 30000,
  });
  return parseJsonOutput<CustomerSearchResult>(output.stdout);
}

async function lookupSuccessGraph(params: {
  script: string;
  traderCode?: string;
  query?: string;
}): Promise<SuccessGraphResult | undefined> {
  const args = params.traderCode
    ? [params.script, "lookup", "--trader-code", params.traderCode]
    : [params.script, "search", "--query", params.query ?? ""];
  try {
    const output = await runCommand({
      command: "python3",
      args,
      timeoutMs: 7000,
    });
    const parsed = parseJsonOutput<SuccessGraphResult>(output.stdout);
    return parsed.status === "error" ? undefined : parsed;
  } catch {
    return undefined;
  }
}

async function inferPriority(params: {
  script: string;
  summary: string;
  description: string;
  context?: SuccessGraphResult;
  hasAttachment?: boolean;
}): Promise<string> {
  const args = [params.script, "--summary", params.summary, "--description", params.description];
  const product = params.context?.products?.[0];
  if (product) {
    args.push("--product", product);
  }
  if (params.context?.tenant?.compCode) {
    args.push("--tenant", params.context.tenant.compCode);
  }
  if (params.context?.tenant?.subscriptionStatus) {
    args.push("--subscription", params.context.tenant.subscriptionStatus);
  }
  if (params.hasAttachment) {
    args.push("--has-attachment");
  }
  try {
    const output = await runCommand({ command: "python3", args, timeoutMs: 7000 });
    const parsed = parseJsonOutput<PriorityResult>(output.stdout);
    return parsed.priority || "Medium";
  } catch {
    return "Medium";
  }
}

function buildTicketDescription(params: {
  description: string;
  groupJid: string;
  mapping: SupportGroupMapping;
  context?: SuccessGraphResult;
}): string {
  const context = params.context;
  const lines = [
    params.description,
    "",
    "[WHATSAPP CONTEXT]",
    `Group: ${params.mapping.groupName || params.groupJid}`,
    `Group JID: ${params.groupJid}`,
    "",
    "[CUSTOMER CONTEXT]",
    `Customer: ${params.mapping.customerName} (${params.mapping.traderCode})`,
  ];
  const tenant = context?.tenant?.compCode ?? params.mapping.tenantCode;
  if (tenant) {
    lines.push(`Tenant: ${tenant}`);
  }
  const products = context?.products ?? params.mapping.products;
  if (products?.length) {
    lines.push(`Products: ${products.join(", ")}`);
  }
  const platformStatus = context?.client?.platformStatus ?? params.mapping.platformStatus;
  if (platformStatus) {
    lines.push(`Platform status: ${platformStatus}`);
  }
  if (context?.summary) {
    lines.push(`SuccessGraph: ${context.summary}`);
  }
  return lines.join("\n");
}

async function createTicket(params: {
  cliDir: string;
  summary: string;
  description: string;
  priority: string;
  traderCode: string;
  requestBy?: string;
}): Promise<TicketCreateResult> {
  const payload = {
    summary: params.summary,
    description: params.description,
    priority: params.priority,
    project: "SIH",
    type: "Support",
    assignee: "iris.ooi@successit.com.sg",
    customer: params.traderCode,
    requestBy: params.requestBy || "-",
  };
  const output = await runCommand({
    command: "node",
    args: ["dist/index.js", "ticket", "create", "--stdin", "--output", "json", "--no-color"],
    cwd: params.cliDir,
    input: JSON.stringify(payload),
    timeoutMs: 60000,
  });
  return parseJsonOutput<TicketCreateResult>(output.stdout);
}

async function updateOpenClawBinding(params: {
  configPath: string;
  groupJid: string;
  comment: string;
}): Promise<void> {
  const cfg = JSON.parse(await fs.readFile(params.configPath, "utf8")) as Record<string, unknown>;
  const bindings = Array.isArray(cfg.bindings) ? cfg.bindings : [];
  const exists = bindings.some((binding) => {
    const raw = binding as {
      agentId?: string;
      match?: { channel?: string; accountId?: string; peer?: { kind?: string; id?: string } };
    };
    return (
      raw.agentId === "laylah-successit-support" &&
      raw.match?.channel === "whatsapp" &&
      raw.match?.accountId === "laylah" &&
      raw.match?.peer?.kind === "group" &&
      raw.match?.peer?.id === params.groupJid
    );
  });
  if (!exists) {
    bindings.unshift({
      agentId: "laylah-successit-support",
      match: {
        channel: "whatsapp",
        accountId: "laylah",
        peer: { kind: "group", id: params.groupJid },
      },
      comment: params.comment,
    });
  }
  cfg.bindings = bindings;
  await fs.writeFile(params.configPath, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

export function createSuccessItSupportTools(params: {
  api: OpenClawPluginApi;
  ctx: OpenClawPluginToolContext;
}): AnyAgentTool[] {
  const config = resolveSuccessItSupportConfig(params.api.pluginConfig);
  const runtimeConfig = () => readRuntimeConfig(params.ctx, params.api);

  return [
    {
      name: "successit_support_onboard_group",
      label: "SuccessIT Support Onboard Group",
      description:
        "Jensen-only: map a WhatsApp group to a SuccessCatalyst customer and SuccessGraph tenant, then add the exact Laylah support route.",
      parameters: OnboardSchema,
      execute: async (_toolCallId, rawParams) => {
        if (
          !isRequesterJensen({
            requesterSenderId: params.ctx.requesterSenderId,
            senderIsOwner: params.ctx.senderIsOwner,
            jensenSenderKeys: config.jensenSenderKeys,
          })
        ) {
          throw new Error("Only Jensen can onboard SuccessIT support groups.");
        }
        const input = rawParams as {
          groupJid: string;
          customerQuery: string;
          groupName?: string;
          confirm: boolean;
          supportTeamSenders?: string[];
        };
        const search = await searchCustomer({
          cliDir: config.successCatalystCliDir,
          query: input.customerQuery,
        });
        const selected = selectSingleCustomer(search);
        if (!selected.customer) {
          return jsonResult({
            status: "needs_confirmation",
            message: "Customer search did not return exactly one match.",
            matches: selected.customers.map((customer) => ({
              traderCode: customer.TraderCode,
              customerName: customer.TraderName,
            })),
          });
        }
        const traderCode = selected.customer.TraderCode ?? "";
        const customerName = selected.customer.TraderName ?? "";
        const graph = await lookupSuccessGraph({
          script: config.successGraphScript,
          traderCode,
          query: customerName,
        });
        const preview = {
          groupJid: input.groupJid,
          groupName: input.groupName,
          traderCode,
          customerName,
          tenantCode: graph?.tenant?.compCode,
          products: graph?.products ?? [],
          platformStatus: graph?.client?.platformStatus,
          supportTeamSenders: [
            ...new Set([
              ...config.defaultSupportTeamSenders,
              ...normalizeSenderList(input.supportTeamSenders),
            ]),
          ],
        };
        if (!input.confirm) {
          return jsonResult({
            status: "preview",
            message: "Re-run with confirm=true to save this mapping and add the route.",
            mapping: preview,
          });
        }
        const mappings = await readMappings(config.mappingPath);
        const mapping: SupportGroupMapping = {
          channel: "whatsapp",
          accountId: "laylah",
          groupJid: input.groupJid,
          ...(input.groupName ? { groupName: input.groupName } : {}),
          customerCode: traderCode,
          traderCode,
          customerName,
          ...(graph?.tenant?.compCode ? { tenantCode: graph.tenant.compCode } : {}),
          ...(graph?.products?.length ? { products: graph.products } : {}),
          ...(graph?.client?.platformStatus ? { platformStatus: graph.client.platformStatus } : {}),
          configuredBy: params.ctx.requesterSenderId,
          configuredAt: new Date().toISOString(),
          supportTeamSenders: preview.supportTeamSenders,
        };
        mappings[input.groupJid] = mapping;
        await writeMappings(config.mappingPath, mappings);
        await updateOpenClawBinding({
          configPath: config.configPath,
          groupJid: input.groupJid,
          comment: `SuccessIT support: ${customerName} (${traderCode})`,
        });
        return jsonResult({
          status: "saved",
          mapping,
          route: {
            agentId: "laylah-successit-support",
            channel: "whatsapp",
            accountId: "laylah",
            groupJid: input.groupJid,
          },
        });
      },
    },
    {
      name: "successit_ticket_create",
      label: "SuccessIT Ticket Create",
      description:
        "Create a new SuccessCatalyst support ticket for the mapped WhatsApp group. Does not read, list, update, or disclose existing ticket status.",
      parameters: TicketCreateSchema,
      execute: async (_toolCallId, rawParams) => {
        const input = rawParams as {
          summary: string;
          description: string;
          requestBy?: string;
          groupJid?: string;
          hasAttachment?: boolean;
        };
        const groupJid = input.groupJid || extractGroupJidFromSessionKey(params.ctx.sessionKey);
        if (!groupJid) {
          throw new Error("WhatsApp group JID required for ticket creation.");
        }
        const mappings = await readMappings(config.mappingPath);
        const mapping = mappings[groupJid];
        if (!mapping) {
          throw new Error("This WhatsApp group is not onboarded for Laylah SuccessIT Support.");
        }
        if (
          !isSupportTeamSender({
            requesterSenderId: params.ctx.requesterSenderId,
            senderIsOwner: params.ctx.senderIsOwner,
            supportTeamSenders: mapping.supportTeamSenders,
            jensenSenderKeys: config.jensenSenderKeys,
          })
        ) {
          throw new Error("Only configured SuccessIT team senders can create support tickets.");
        }
        const graph = await lookupSuccessGraph({
          script: config.successGraphScript,
          traderCode: mapping.traderCode,
          query: mapping.customerName,
        });
        const priority = await inferPriority({
          script: config.priorityScript,
          summary: input.summary,
          description: input.description,
          context: graph,
          hasAttachment: input.hasAttachment,
        });
        const description = buildTicketDescription({
          description: input.description,
          groupJid,
          mapping,
          context: graph,
        });
        const created = await createTicket({
          cliDir: config.successCatalystCliDir,
          summary: input.summary,
          description,
          priority,
          traderCode: mapping.traderCode,
          requestBy: input.requestBy,
        });
        const issueKey = created.ticket?.Issuekey;
        if (!issueKey) {
          throw new Error("SuccessCatalyst did not return a ticket key.");
        }
        return jsonResult({
          status: "created",
          ticketKey: issueKey,
          customer: `${mapping.customerName} (${mapping.traderCode})`,
          priority,
          groupJid,
          publicReply: `Logged ${issueKey}.`,
        });
      },
    },
    {
      name: "successit_notify_jensen",
      label: "SuccessIT Notify Jensen",
      description:
        "Send Jensen a private WhatsApp DM for sensitive customer support requests. The destination is fixed to Jensen.",
      parameters: NotifySchema,
      execute: async (_toolCallId, rawParams) => {
        const input = rawParams as {
          groupJid?: string;
          groupName?: string;
          customer?: string;
          tenant?: string;
          sender?: string;
          originalMessage: string;
          intent: string;
          ticketKey?: string;
        };
        const groupJid = input.groupJid || extractGroupJidFromSessionKey(params.ctx.sessionKey);
        let mapping: SupportGroupMapping | undefined;
        if (groupJid) {
          mapping = (await readMappings(config.mappingPath))[groupJid];
        }
        const text = [
          "Laylah SuccessIT support escalation",
          `Intent: ${input.intent}`,
          `Group: ${input.groupName || mapping?.groupName || groupJid || "-"}`,
          `Customer: ${input.customer || (mapping ? `${mapping.customerName} (${mapping.traderCode})` : "-")}`,
          `Tenant: ${input.tenant || mapping?.tenantCode || "-"}`,
          `Sender: ${input.sender || params.ctx.requesterSenderId || "-"}`,
          ...(input.ticketKey ? [`Ticket: ${input.ticketKey}`] : []),
          "",
          input.originalMessage,
        ].join("\n");
        const sent = await sendJensenWhatsAppDm({
          to: config.jensenWhatsAppId,
          text,
          cfg: runtimeConfig(),
        });
        return jsonResult({
          status: "sent",
          to: "Jensen",
          messageId: sent.messageId,
        });
      },
    },
  ];
}
