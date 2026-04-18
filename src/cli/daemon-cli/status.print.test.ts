import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatCliCommand } from "../command-format.js";
import { printDaemonStatus } from "./status.print.js";

const runtime = vi.hoisted(() => ({
  log: vi.fn<(line: string) => void>(),
  error: vi.fn<(line: string) => void>(),
}));

vi.mock("../../runtime.js", () => ({
  defaultRuntime: runtime,
}));

vi.mock("../../terminal/theme.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../terminal/theme.js")>("../../terminal/theme.js");
  return {
    ...actual,
    colorize: (_rich: boolean, _theme: unknown, text: string) => text,
  };
});

vi.mock("../../gateway/control-ui-links.js", () => ({
  resolveControlUiLinks: () => ({ httpUrl: "http://127.0.0.1:18789" }),
}));

vi.mock("../../daemon/inspect.js", () => ({
  renderGatewayServiceCleanupHints: () => [],
}));

vi.mock("../../daemon/restart-logs.js", () => ({
  resolveGatewayLogPaths: () => ({
    logDir: "/tmp",
    stdoutPath: "/tmp/gateway.out.log",
    stderrPath: "/tmp/gateway.err.log",
  }),
  resolveGatewayRestartLogPath: () => "/tmp/gateway-restart.log",
}));

vi.mock("../../daemon/systemd-hints.js", () => ({
  isSystemdUnavailableDetail: () => false,
  renderSystemdUnavailableHints: () => [],
}));

vi.mock("../../infra/wsl.js", () => ({
  isWSLEnv: () => false,
}));

vi.mock("./shared.js", () => ({
  createCliStatusTextStyles: () => ({
    rich: false,
    label: (text: string) => text,
    accent: (text: string) => text,
    infoText: (text: string) => text,
    okText: (text: string) => text,
    warnText: (text: string) => text,
    errorText: (text: string) => text,
  }),
  filterDaemonEnv: () => ({}),
  formatRuntimeStatus: () => "running (pid 8000)",
  resolveRuntimeStatusColor: () => "",
  resolveDaemonContainerContext: () => null,
  renderRuntimeHints: () => [],
  safeDaemonEnv: () => [],
}));

vi.mock("./status.gather.js", () => ({
  renderPortDiagnosticsForCli: () => [],
  resolvePortListeningAddresses: () => ["127.0.0.1:18789"],
}));

describe("printDaemonStatus", () => {
  beforeEach(() => {
    runtime.log.mockReset();
    runtime.error.mockReset();
  });

  it("prints stale gateway pid guidance when runtime does not own the listener", () => {
    printDaemonStatus(
      {
        service: {
          label: "LaunchAgent",
          loaded: true,
          loadedText: "loaded",
          notLoadedText: "not loaded",
          runtime: { status: "running", pid: 8000 },
        },
        logFile: "/tmp/openclaw.log",
        gateway: {
          bindMode: "loopback",
          bindHost: "127.0.0.1",
          port: 18789,
          portSource: "env/config",
          probeUrl: "ws://127.0.0.1:18789",
        },
        port: {
          port: 18789,
          status: "busy",
          listeners: [{ pid: 9000, ppid: 8999, address: "127.0.0.1:18789" }],
          hints: [],
        },
        rpc: {
          ok: false,
          error: "gateway closed (1006 abnormal closure (no close frame))",
          url: "ws://127.0.0.1:18789",
        },
        health: {
          healthy: false,
          staleGatewayPids: [9000],
        },
        build: {
          disk: {
            version: "2026.4.15",
            commit: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
            builtAt: "2026-04-17T03:13:13.169Z",
            buildId: "build-disk",
          },
          service: {
            version: "2026.4.15",
            commit: "old-commit",
            builtAt: "2026-04-16T03:13:13.169Z",
            buildId: "build-old",
          },
          installRequired: true,
          restartRequired: true,
          restartReason: "runtime-started-before-disk-build",
          runtimeSource: "process-start-time",
        },
        extraServices: [],
      },
      { json: false },
    );

    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("Gateway runtime PID does not own the listening port"),
    );
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining(formatCliCommand("openclaw gateway restart")),
    );
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining("Service metadata does not match the current dist build"),
    );
    expect(runtime.error).toHaveBeenCalledWith(
      expect.stringContaining(formatCliCommand("openclaw gateway install --force")),
    );
  });

  it("prints probe kind and capability separately", () => {
    printDaemonStatus(
      {
        service: {
          label: "LaunchAgent",
          loaded: true,
          loadedText: "loaded",
          notLoadedText: "not loaded",
          runtime: { status: "running", pid: 8000 },
        },
        gateway: {
          bindMode: "loopback",
          bindHost: "127.0.0.1",
          port: 18789,
          portSource: "env/config",
          probeUrl: "ws://127.0.0.1:18789",
        },
        rpc: {
          ok: true,
          kind: "connect",
          capability: "write_capable",
          url: "ws://127.0.0.1:18789",
        },
        extraServices: [],
      },
      { json: false },
    );

    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("Connectivity probe: ok"));
    expect(runtime.log).toHaveBeenCalledWith(expect.stringContaining("Capability: write-capable"));
  });
});
