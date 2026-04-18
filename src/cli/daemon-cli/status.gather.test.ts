import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GatewayServiceRuntime } from "../../daemon/service-runtime.js";
import { createMockGatewayService } from "../../daemon/service.test-helpers.js";
import { captureEnv } from "../../test-utils/env.js";
import type { GatewayRestartSnapshot } from "./restart-health.js";
import { gatherDaemonStatus } from "./status.gather.js";

const callGatewayStatusProbe = vi.fn<
  (opts?: unknown) => Promise<{ ok: boolean; url?: string; error?: string | null }>
>(async (_opts?: unknown) => ({
  ok: true,
  url: "ws://127.0.0.1:19001",
  error: null,
}));
const loadGatewayTlsRuntime = vi.fn(async (_cfg?: unknown) => ({
  enabled: true,
  required: true,
  fingerprintSha256: "sha256:11:22:33:44",
}));
const findExtraGatewayServices = vi.fn(async (_env?: unknown, _opts?: unknown) => []);
const inspectPortUsage = vi.fn(async (port: number) => ({
  port,
  status: "free" as const,
  listeners: [],
  hints: [],
}));
const readLastGatewayErrorLine = vi.fn(async (_env?: NodeJS.ProcessEnv) => null);
const auditGatewayServiceConfig = vi.fn(async (_opts?: unknown) => undefined);
const serviceIsLoaded = vi.fn(async (_opts?: unknown) => true);
const serviceReadRuntime = vi.fn<(env?: NodeJS.ProcessEnv) => Promise<GatewayServiceRuntime>>(
  async (_env?: NodeJS.ProcessEnv) => ({ status: "running" }),
);
const inspectGatewayRestart = vi.fn<(opts?: unknown) => Promise<GatewayRestartSnapshot>>(
  async (_opts?: unknown) => ({
    runtime: { status: "running", pid: 1234 },
    portUsage: { port: 19001, status: "busy", listeners: [], hints: [] },
    healthy: true,
    staleGatewayPids: [],
  }),
);
const callGateway = vi.fn(
  async (_opts?: unknown) =>
    ({
      runtimeVersion: "2026.4.15",
      runtimeBuild: {
        version: "2026.4.15",
        commit: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
        builtAt: "2026-04-17T03:13:13.169Z",
        buildId: "build-disk",
      },
    }) satisfies { runtimeVersion: string; runtimeBuild: Record<string, string> },
);
const readBuildInfoForEntrypointPath = vi.fn<
  (entrypointPath: string) => {
    version?: string;
    commit?: string;
    builtAt?: string;
    buildId?: string;
  } | null
>((_entrypointPath: string) => null);
const readProcessStartedAt = vi.fn<(params?: unknown) => Promise<number | undefined>>(
  async (_params?: unknown) => undefined,
);
const serviceReadCommand = vi.fn<
  (env?: NodeJS.ProcessEnv) => Promise<{
    programArguments: string[];
    environment?: Record<string, string>;
  }>
>(async (_env?: NodeJS.ProcessEnv) => ({
  programArguments: ["/bin/node", "cli", "gateway", "--port", "19001"],
  environment: {
    OPENCLAW_STATE_DIR: "/tmp/openclaw-daemon",
    OPENCLAW_CONFIG_PATH: "/tmp/openclaw-daemon/openclaw.json",
  },
}));
const resolveGatewayBindHost = vi.fn(
  async (_bindMode?: string, _customBindHost?: string) => "0.0.0.0",
);
const pickPrimaryTailnetIPv4 = vi.fn(() => "100.64.0.9");
const resolveGatewayPort = vi.fn((_cfg?: unknown, _env?: unknown) => 18789);
const resolveStateDir = vi.fn(
  (env: NodeJS.ProcessEnv) => env.OPENCLAW_STATE_DIR ?? "/tmp/openclaw-cli",
);
const resolveConfigPath = vi.fn((env: NodeJS.ProcessEnv, stateDir: string) => {
  return env.OPENCLAW_CONFIG_PATH ?? `${stateDir}/openclaw.json`;
});
const readConfigFileSnapshotCalls = vi.fn((configPath: string) => configPath);
const loadConfigCalls = vi.fn((configPath: string) => configPath);
let daemonLoadedConfig: Record<string, unknown> = {
  gateway: {
    bind: "lan",
    tls: { enabled: true },
    auth: { token: "daemon-token" },
  },
};
let cliLoadedConfig: Record<string, unknown> = {
  gateway: {
    bind: "loopback",
  },
};

vi.mock("../../config/config.js", () => ({
  createConfigIO: ({ configPath }: { configPath: string }) => {
    const isDaemon = configPath.includes("/openclaw-daemon/");
    const runtimeConfig = isDaemon ? daemonLoadedConfig : cliLoadedConfig;
    return {
      readConfigFileSnapshot: async () => {
        readConfigFileSnapshotCalls(configPath);
        return {
          path: configPath,
          exists: true,
          valid: true,
          issues: [],
          runtimeConfig,
          config: runtimeConfig,
        };
      },
      loadConfig: () => {
        loadConfigCalls(configPath);
        return runtimeConfig;
      },
    };
  },
  loadConfig: () => cliLoadedConfig,
  resolveConfigPath: (env: NodeJS.ProcessEnv, stateDir: string) => resolveConfigPath(env, stateDir),
  resolveGatewayPort: (cfg?: unknown, env?: unknown) => resolveGatewayPort(cfg, env),
  resolveStateDir: (env: NodeJS.ProcessEnv) => resolveStateDir(env),
}));

vi.mock("../../daemon/diagnostics.js", () => ({
  readLastGatewayErrorLine: (env: NodeJS.ProcessEnv) => readLastGatewayErrorLine(env),
}));

vi.mock("../../daemon/inspect.js", () => ({
  findExtraGatewayServices: (env: unknown, opts?: unknown) => findExtraGatewayServices(env, opts),
}));

vi.mock("../../daemon/service-audit.js", () => ({
  auditGatewayServiceConfig: (opts: unknown) => auditGatewayServiceConfig(opts),
}));

vi.mock("../../daemon/service.js", () => ({
  resolveGatewayService: () =>
    createMockGatewayService({
      isLoaded: serviceIsLoaded,
      readCommand: serviceReadCommand,
      readRuntime: serviceReadRuntime,
    }),
}));

vi.mock("../../gateway/net.js", () => ({
  resolveGatewayBindHost: (bindMode: string, customBindHost?: string) =>
    resolveGatewayBindHost(bindMode, customBindHost),
}));

vi.mock("../../infra/ports.js", () => ({
  inspectPortUsage: (port: number) => inspectPortUsage(port),
  formatPortDiagnostics: () => [],
}));

vi.mock("../../infra/tailnet.js", () => ({
  pickPrimaryTailnetIPv4: () => pickPrimaryTailnetIPv4(),
}));

vi.mock("../../infra/tls/gateway.js", () => ({
  loadGatewayTlsRuntime: (cfg: unknown) => loadGatewayTlsRuntime(cfg),
}));

vi.mock("./probe.js", () => ({
  probeGatewayStatus: (opts: unknown) => callGatewayStatusProbe(opts),
}));

vi.mock("../../gateway/call.js", () => ({
  callGateway: (opts: unknown) => callGateway(opts),
}));

vi.mock("./restart-health.js", () => ({
  inspectGatewayRestart: (opts: unknown) => inspectGatewayRestart(opts),
}));

vi.mock("../../version.js", async () => {
  const actual = await vi.importActual<typeof import("../../version.js")>("../../version.js");
  return {
    ...actual,
    readBuildInfoForEntrypointPath: (entrypointPath: string) =>
      readBuildInfoForEntrypointPath(entrypointPath),
  };
});

vi.mock("../../daemon/process-start.js", () => ({
  readProcessStartedAt: (params: unknown) => readProcessStartedAt(params),
}));

describe("gatherDaemonStatus", () => {
  let envSnapshot: ReturnType<typeof captureEnv>;

  beforeEach(() => {
    envSnapshot = captureEnv([
      "OPENCLAW_STATE_DIR",
      "OPENCLAW_CONFIG_PATH",
      "OPENCLAW_GATEWAY_TOKEN",
      "OPENCLAW_GATEWAY_PASSWORD",
      "DAEMON_GATEWAY_TOKEN",
      "DAEMON_GATEWAY_PASSWORD",
    ]);
    process.env.OPENCLAW_STATE_DIR = "/tmp/openclaw-cli";
    process.env.OPENCLAW_CONFIG_PATH = "/tmp/openclaw-cli/openclaw.json";
    delete process.env.OPENCLAW_GATEWAY_TOKEN;
    delete process.env.OPENCLAW_GATEWAY_PASSWORD;
    delete process.env.DAEMON_GATEWAY_TOKEN;
    delete process.env.DAEMON_GATEWAY_PASSWORD;
    callGatewayStatusProbe.mockClear();
    callGateway.mockClear();
    loadGatewayTlsRuntime.mockClear();
    inspectGatewayRestart.mockClear();
    readBuildInfoForEntrypointPath.mockReset();
    readProcessStartedAt.mockReset();
    readConfigFileSnapshotCalls.mockClear();
    loadConfigCalls.mockClear();
    readBuildInfoForEntrypointPath.mockReturnValue(null);
    readProcessStartedAt.mockResolvedValue(undefined);
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: { token: "daemon-token" },
      },
    };
    cliLoadedConfig = {
      gateway: {
        bind: "loopback",
      },
    };
  });

  afterEach(() => {
    envSnapshot.restore();
  });

  it("uses wss probe URL and forwards TLS fingerprint when daemon TLS is enabled", async () => {
    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(loadGatewayTlsRuntime).toHaveBeenCalledTimes(1);
    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "wss://127.0.0.1:19001",
        tlsFingerprint: "sha256:11:22:33:44",
        token: "daemon-token",
      }),
    );
    expect(status.gateway?.probeUrl).toBe("wss://127.0.0.1:19001");
    expect(status.rpc?.url).toBe("wss://127.0.0.1:19001");
    expect(status.rpc?.ok).toBe(true);
    expect(inspectGatewayRestart).not.toHaveBeenCalled();
  });

  it("forwards requireRpc and configPath to the daemon probe", async () => {
    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      requireRpc: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        requireRpc: true,
        configPath: "/tmp/openclaw-daemon/openclaw.json",
      }),
    );
  });

  it("reuses the shared CLI config snapshot when the daemon uses the same config path", async () => {
    serviceReadCommand.mockResolvedValueOnce({
      programArguments: ["/bin/node", "cli", "gateway", "--port", "19001"],
    });

    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(readConfigFileSnapshotCalls).toHaveBeenCalledTimes(1);
    expect(readConfigFileSnapshotCalls).toHaveBeenCalledWith("/tmp/openclaw-cli/openclaw.json");
    expect(loadConfigCalls).not.toHaveBeenCalled();
  });

  it("defaults unset daemon bind mode to loopback for host-side status reporting", async () => {
    daemonLoadedConfig = {
      gateway: {
        tls: { enabled: true },
        auth: { token: "daemon-token" },
      },
    };

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(resolveGatewayBindHost).toHaveBeenCalledWith("loopback", undefined);
    expect(status.gateway?.bindMode).toBe("loopback");
  });

  it("does not force local TLS fingerprint when probe URL is explicitly overridden", async () => {
    const status = await gatherDaemonStatus({
      rpc: { url: "wss://override.example:18790" },
      probe: true,
      deep: false,
    });

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "wss://override.example:18790",
        tlsFingerprint: undefined,
      }),
    );
    expect(status.gateway?.probeUrl).toBe("wss://override.example:18790");
    expect(status.rpc?.url).toBe("wss://override.example:18790");
  });

  it("uses fallback network details when interface discovery throws during status inspection", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "tailnet",
        tls: { enabled: true },
        auth: { token: "daemon-token" },
      },
    };
    resolveGatewayBindHost.mockImplementationOnce(async () => {
      throw new Error("uv_interface_addresses failed");
    });
    pickPrimaryTailnetIPv4.mockImplementationOnce(() => {
      throw new Error("uv_interface_addresses failed");
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(status.gateway).toMatchObject({
      bindMode: "tailnet",
      bindHost: "127.0.0.1",
      probeUrl: "wss://127.0.0.1:19001",
    });
    expect(status.gateway?.probeNote).toContain("interface discovery failed");
    expect(status.gateway?.probeNote).toContain("tailnet addresses");
  });

  it("reuses command environment when reading runtime status", async () => {
    serviceReadCommand.mockResolvedValueOnce({
      programArguments: ["/bin/node", "cli", "gateway", "--port", "19001"],
      environment: {
        OPENCLAW_GATEWAY_PORT: "19001",
        OPENCLAW_CONFIG_PATH: "/tmp/openclaw-daemon/openclaw.json",
        OPENCLAW_STATE_DIR: "/tmp/openclaw-daemon",
      } as Record<string, string>,
    });
    serviceReadRuntime.mockImplementationOnce(async (env?: NodeJS.ProcessEnv) => ({
      status: env?.OPENCLAW_GATEWAY_PORT === "19001" ? "running" : "unknown",
      detail: env?.OPENCLAW_GATEWAY_PORT ?? "missing-port",
    }));

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: false,
      deep: false,
    });

    expect(serviceReadRuntime).toHaveBeenCalledWith(
      expect.objectContaining({
        OPENCLAW_GATEWAY_PORT: "19001",
      }),
    );
    expect(status.service.runtime).toMatchObject({
      status: "running",
      detail: "19001",
    });
  });

  it("resolves daemon gateway auth password SecretRef values before probing", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: {
          password: { source: "env", provider: "default", id: "DAEMON_GATEWAY_PASSWORD" },
        },
      },
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
    };
    process.env.DAEMON_GATEWAY_PASSWORD = "daemon-secretref-password"; // pragma: allowlist secret

    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        password: "daemon-secretref-password", // pragma: allowlist secret
      }),
    );
  });

  it("resolves daemon gateway auth token SecretRef values before probing", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: {
          mode: "token",
          token: "${DAEMON_GATEWAY_TOKEN}",
        },
      },
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
    };
    process.env.DAEMON_GATEWAY_TOKEN = "daemon-secretref-token";

    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "daemon-secretref-token",
      }),
    );
  });

  it("does not resolve daemon password SecretRef when token auth is configured", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: {
          mode: "token",
          token: "daemon-token",
          password: { source: "env", provider: "default", id: "MISSING_DAEMON_GATEWAY_PASSWORD" },
        },
      },
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
    };

    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "daemon-token",
        password: undefined,
      }),
    );
  });

  it("degrades safely when daemon probe auth SecretRef is unresolved", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: {
          mode: "token",
          token: { source: "env", provider: "default", id: "MISSING_DAEMON_GATEWAY_TOKEN" },
        },
      },
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
    };

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        token: undefined,
        password: undefined,
      }),
    );
    expect(status.rpc?.authWarning).toBeUndefined();
  });

  it("surfaces authWarning when daemon probe auth SecretRef is unresolved and probe fails", async () => {
    daemonLoadedConfig = {
      gateway: {
        bind: "lan",
        tls: { enabled: true },
        auth: {
          mode: "token",
          token: { source: "env", provider: "default", id: "MISSING_DAEMON_GATEWAY_TOKEN" },
        },
      },
      secrets: {
        providers: {
          default: { source: "env" },
        },
      },
    };
    callGatewayStatusProbe.mockResolvedValueOnce({
      ok: false,
      error: "gateway closed",
      url: "wss://127.0.0.1:19001",
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(status.rpc?.ok).toBe(false);
    expect(status.rpc?.authWarning).toContain(
      "gateway.auth.token SecretRef is unresolved in this command path",
    );
    expect(status.rpc?.authWarning).toContain("probing without configured auth credentials");
  });

  it("keeps remote probe auth strict when remote token is missing", async () => {
    daemonLoadedConfig = {
      gateway: {
        mode: "remote",
        remote: {
          url: "wss://gateway.example",
          password: "remote-password", // pragma: allowlist secret
        },
        auth: {
          mode: "token",
          token: "local-token",
          password: "local-password", // pragma: allowlist secret
        },
      },
    };
    process.env.OPENCLAW_GATEWAY_TOKEN = "env-token";
    process.env.OPENCLAW_GATEWAY_PASSWORD = "env-password"; // pragma: allowlist secret

    await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(callGatewayStatusProbe).toHaveBeenCalledWith(
      expect.objectContaining({
        token: undefined,
        password: "env-password", // pragma: allowlist secret
      }),
    );
  });

  it("skips TLS runtime loading when probe is disabled", async () => {
    const status = await gatherDaemonStatus({
      rpc: {},
      probe: false,
      deep: false,
    });

    expect(loadGatewayTlsRuntime).not.toHaveBeenCalled();
    expect(callGatewayStatusProbe).not.toHaveBeenCalled();
    expect(status.rpc).toBeUndefined();
  });

  it("surfaces stale gateway listener pids from restart health inspection when probe fails", async () => {
    callGatewayStatusProbe.mockResolvedValueOnce({
      ok: false,
      url: "ws://127.0.0.1:19001",
      error: "timeout",
    });
    inspectGatewayRestart.mockResolvedValueOnce({
      runtime: { status: "running", pid: 8000 },
      portUsage: {
        port: 19001,
        status: "busy",
        listeners: [{ pid: 9000, ppid: 8999, commandLine: "openclaw-gateway" }],
        hints: [],
      },
      healthy: false,
      staleGatewayPids: [9000],
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(inspectGatewayRestart).toHaveBeenCalledWith(
      expect.objectContaining({
        port: 19001,
      }),
    );
    expect(status.health).toEqual({
      healthy: false,
      staleGatewayPids: [9000],
    });
  });

  it("flags install-required when service metadata lags behind the current dist build", async () => {
    readBuildInfoForEntrypointPath.mockReturnValue({
      version: "2026.4.15",
      commit: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
      builtAt: "2026-04-17T03:13:13.169Z",
      buildId: "build-disk",
    });
    serviceReadCommand.mockResolvedValueOnce({
      programArguments: ["/bin/node", "/srv/openclaw/dist/index.js", "gateway", "--port", "19001"],
      environment: {
        OPENCLAW_STATE_DIR: "/tmp/openclaw-daemon",
        OPENCLAW_CONFIG_PATH: "/tmp/openclaw-daemon/openclaw.json",
        OPENCLAW_SERVICE_VERSION: "2026.4.15",
        OPENCLAW_SERVICE_COMMIT: "old-commit",
        OPENCLAW_SERVICE_BUILT_AT: "2026-04-16T00:00:00.000Z",
        OPENCLAW_SERVICE_BUILD_ID: "build-old",
      },
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(status.build).toMatchObject({
      installRequired: true,
      runtimeSource: "status-rpc",
      disk: {
        buildId: "build-disk",
      },
      service: {
        buildId: "build-old",
      },
      runtime: {
        buildId: "build-disk",
      },
    });
  });

  it("flags restart-required when the running gateway reports an older build", async () => {
    readBuildInfoForEntrypointPath.mockReturnValue({
      version: "2026.4.15",
      commit: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
      builtAt: "2026-04-17T03:13:13.169Z",
      buildId: "build-disk",
    });
    callGateway.mockResolvedValueOnce({
      runtimeVersion: "2026.4.15",
      runtimeBuild: {
        version: "2026.4.15",
        commit: "stale-commit",
        builtAt: "2026-04-16T03:13:13.169Z",
        buildId: "build-stale",
      },
    });
    serviceReadCommand.mockResolvedValueOnce({
      programArguments: ["/bin/node", "/srv/openclaw/dist/index.js", "gateway", "--port", "19001"],
      environment: {
        OPENCLAW_STATE_DIR: "/tmp/openclaw-daemon",
        OPENCLAW_CONFIG_PATH: "/tmp/openclaw-daemon/openclaw.json",
        OPENCLAW_SERVICE_VERSION: "2026.4.15",
        OPENCLAW_SERVICE_COMMIT: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
        OPENCLAW_SERVICE_BUILT_AT: "2026-04-17T03:13:13.169Z",
        OPENCLAW_SERVICE_BUILD_ID: "build-disk",
      },
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: true,
      deep: false,
    });

    expect(status.build).toMatchObject({
      restartRequired: true,
      restartReason: "runtime-build-mismatch",
      runtime: {
        buildId: "build-stale",
      },
    });
  });

  it("falls back to process start time when RPC build details are unavailable", async () => {
    readBuildInfoForEntrypointPath.mockReturnValue({
      version: "2026.4.15",
      commit: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
      builtAt: "2026-04-17T03:13:13.169Z",
      buildId: "build-disk",
    });
    readProcessStartedAt.mockResolvedValue(Date.parse("2026-04-17T03:10:00.000Z"));
    serviceReadCommand.mockResolvedValueOnce({
      programArguments: ["/bin/node", "/srv/openclaw/dist/index.js", "gateway", "--port", "19001"],
      environment: {
        OPENCLAW_STATE_DIR: "/tmp/openclaw-daemon",
        OPENCLAW_CONFIG_PATH: "/tmp/openclaw-daemon/openclaw.json",
        OPENCLAW_SERVICE_VERSION: "2026.4.15",
        OPENCLAW_SERVICE_COMMIT: "bf388cfc90dddf2dd00264dfdbb3a142f8b53f86",
        OPENCLAW_SERVICE_BUILT_AT: "2026-04-17T03:13:13.169Z",
        OPENCLAW_SERVICE_BUILD_ID: "build-disk",
      },
    });
    serviceReadRuntime.mockResolvedValueOnce({
      status: "running",
      pid: 4321,
    });

    const status = await gatherDaemonStatus({
      rpc: {},
      probe: false,
      deep: false,
    });

    expect(callGateway).not.toHaveBeenCalled();
    expect(readProcessStartedAt).toHaveBeenCalledWith({ pid: 4321 });
    expect(status.build).toMatchObject({
      runtimeSource: "process-start-time",
      restartRequired: true,
      restartReason: "runtime-started-before-disk-build",
    });
  });
});
