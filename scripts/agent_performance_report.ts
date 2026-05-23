import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

type Counter = Record<string, number>;

type Args = {
  logsDir: string;
  cronRunsDir?: string;
  fromMs: number;
  toMs: number;
  json: boolean;
};

const EVENT_PATTERNS = {
  agent_timeout: /\b(?:agent_timeout|timeout(?:Seconds)?|timed out|run timeout)\b/i,
  context_overflow: /\bcontext_overflow\b|context overflow/i,
  compaction: /\bcompaction\b|\bcompacted\b/i,
  stuck_session: /\bstuck_session\b|stuck session/i,
  tool_loop: /\btool\.loop\b|tool loop:/i,
  loop_warning: /\bloop warning\b|level=warning action=warn/i,
  node_heap_oom:
    /\bJavaScript heap out of memory\b|\bheap OOM\b|\bFATAL ERROR: Reached heap limit\b/i,
} as const;

type EventName = keyof typeof EVENT_PATTERNS;

function parseArgs(argv: string[]): Args {
  const raw: Record<string, string | boolean> = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i] ?? "";
    if (!arg.startsWith("--")) {
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      raw[key] = next;
      i += 1;
    } else {
      raw[key] = true;
    }
  }

  const hours = typeof raw.hours === "string" ? Number(raw.hours) : 24;
  const toMs = typeof raw.to === "string" ? Date.parse(raw.to) : Date.now();
  const fromMs =
    typeof raw.from === "string"
      ? Date.parse(raw.from)
      : toMs - Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    throw new Error("Invalid --from/--to timestamp");
  }

  return {
    logsDir:
      typeof raw.logsDir === "string" ? raw.logsDir : path.join(os.homedir(), ".openclaw", "logs"),
    cronRunsDir: typeof raw.cronRunsDir === "string" ? raw.cronRunsDir : undefined,
    fromMs,
    toMs,
    json: raw.json === true,
  };
}

async function listFiles(dir: string, predicate: (name: string) => boolean): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile() && predicate(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

function parseTimestamp(line: string): number | undefined {
  const iso = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+(?:Z|[+-]\d{2}:\d{2}))/u)?.[1];
  if (!iso) {
    return undefined;
  }
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : undefined;
}

function inWindow(ms: number | undefined, args: Args): boolean {
  return ms === undefined || (ms >= args.fromMs && ms <= args.toMs);
}

function increment(counter: Counter, key: string, amount = 1): void {
  counter[key] = (counter[key] ?? 0) + amount;
}

function top(counter: Counter, limit = 10) {
  return Object.entries(counter)
    .map(([key, count]) => ({ key, count }))
    .toSorted((a, b) => b.count - a.count || a.key.localeCompare(b.key))
    .slice(0, limit);
}

function extractSessionKeys(line: string): string[] {
  const keys = new Set<string>();
  for (const match of line.matchAll(/\bsessionKey=([^\s"]+)/gu)) {
    if (match[1]) {
      keys.add(match[1]);
    }
  }
  for (const match of line.matchAll(/"sessionKey"\s*:\s*"([^"]+)"/gu)) {
    if (match[1]) {
      keys.add(match[1]);
    }
  }
  return [...keys];
}

function extractCronJobIds(line: string): string[] {
  const ids = new Set<string>();
  for (const match of line.matchAll(/\bcron:([A-Za-z0-9_.:-]+)/gu)) {
    const id = match[1]?.split(":")[0]?.trim();
    if (id) {
      ids.add(id);
    }
  }
  for (const match of line.matchAll(/"jobId"\s*:\s*"([^"]+)"/gu)) {
    if (match[1]) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

async function scanLogFiles(args: Args) {
  const counts: Record<EventName, number> = {
    agent_timeout: 0,
    context_overflow: 0,
    compaction: 0,
    stuck_session: 0,
    tool_loop: 0,
    loop_warning: 0,
    node_heap_oom: 0,
  };
  const sessions: Counter = {};
  const cronJobs: Counter = {};
  const files = await listFiles(args.logsDir, (name) => /\.(?:log|jsonl)$/u.test(name));

  for (const file of files) {
    const text = await fs.readFile(file, "utf-8").catch(() => "");
    for (const line of text.split("\n")) {
      if (!line.trim() || !inWindow(parseTimestamp(line), args)) {
        continue;
      }
      let matched = false;
      for (const [name, pattern] of Object.entries(EVENT_PATTERNS) as [EventName, RegExp][]) {
        if (pattern.test(line)) {
          counts[name] += 1;
          matched = true;
        }
      }
      if (!matched) {
        continue;
      }
      for (const sessionKey of extractSessionKeys(line)) {
        increment(sessions, sessionKey);
      }
      for (const jobId of extractCronJobIds(line)) {
        increment(cronJobs, jobId);
      }
    }
  }

  return { counts, sessions, cronJobs, filesScanned: files.length };
}

async function scanCronRuns(args: Args, cronJobs: Counter) {
  if (!args.cronRunsDir) {
    return { filesScanned: 0 };
  }
  const files = await listFiles(args.cronRunsDir, (name) => name.endsWith(".jsonl"));
  for (const file of files) {
    const text = await fs.readFile(file, "utf-8").catch(() => "");
    for (const line of text.split("\n")) {
      if (!line.trim()) {
        continue;
      }
      try {
        const entry = JSON.parse(line) as { ts?: unknown; jobId?: unknown; status?: unknown };
        const ts = typeof entry.ts === "number" ? entry.ts : undefined;
        if (!inWindow(ts, args) || typeof entry.jobId !== "string") {
          continue;
        }
        if (entry.status === "error") {
          increment(cronJobs, entry.jobId);
        }
      } catch {
        // Ignore malformed run-log lines.
      }
    }
  }
  return { filesScanned: files.length };
}

function printReport(params: {
  args: Args;
  counts: Record<EventName, number>;
  sessions: Counter;
  cronJobs: Counter;
  filesScanned: number;
  cronRunFilesScanned: number;
}) {
  console.log("Agent performance report");
  console.log(`  logsDir: ${params.args.logsDir}`);
  console.log(
    `  window: ${new Date(params.args.fromMs).toISOString()} -> ${new Date(params.args.toMs).toISOString()}`,
  );
  console.log(`  files scanned: ${params.filesScanned}`);
  if (params.args.cronRunsDir) {
    console.log(`  cronRunsDir: ${params.args.cronRunsDir} (${params.cronRunFilesScanned} files)`);
  }
  console.log("");
  for (const key of Object.keys(EVENT_PATTERNS) as EventName[]) {
    console.log(`${key}: ${params.counts[key]}`);
  }
  console.log("");
  console.log("Top affected sessions:");
  for (const row of top(params.sessions)) {
    console.log(`  ${row.count}  ${row.key}`);
  }
  if (top(params.sessions).length === 0) {
    console.log("  none");
  }
  console.log("");
  console.log("Top affected cron jobs:");
  for (const row of top(params.cronJobs)) {
    console.log(`  ${row.count}  ${row.key}`);
  }
  if (top(params.cronJobs).length === 0) {
    console.log("  none");
  }
}

export async function main() {
  const args = parseArgs(process.argv);
  const scanned = await scanLogFiles(args);
  const cronRunScan = await scanCronRuns(args, scanned.cronJobs);
  const payload = {
    from: new Date(args.fromMs).toISOString(),
    to: new Date(args.toMs).toISOString(),
    logsDir: args.logsDir,
    cronRunsDir: args.cronRunsDir,
    filesScanned: scanned.filesScanned,
    cronRunFilesScanned: cronRunScan.filesScanned,
    counts: scanned.counts,
    topSessions: top(scanned.sessions),
    topCronJobs: top(scanned.cronJobs),
  };
  if (args.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  printReport({
    args,
    counts: scanned.counts,
    sessions: scanned.sessions,
    cronJobs: scanned.cronJobs,
    filesScanned: scanned.filesScanned,
    cronRunFilesScanned: cronRunScan.filesScanned,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
