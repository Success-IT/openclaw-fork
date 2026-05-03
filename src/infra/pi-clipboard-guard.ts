import { createRequire } from "node:module";

type NativeModuleLoader = {
  _load?: (request: string, parent?: unknown, isMain?: boolean) => unknown;
};

type ClipboardStub = {
  availableFormats: () => string[];
  getText: () => string;
  setText: () => void;
  hasText: () => boolean;
  getImageBinary: () => undefined;
  getImageBase64: () => undefined;
  setImageBinary: () => void;
  setImageBase64: () => void;
  hasImage: () => boolean;
  getHtml: () => string;
  setHtml: () => void;
  hasHtml: () => boolean;
  getRtf: () => string;
  setRtf: () => void;
  hasRtf: () => boolean;
  clear: () => void;
  watch: () => { close: () => void };
  callThreadsafeFunction: () => void;
};

const installKey = Symbol.for("openclaw.piClipboardGuardInstalled");

const clipboardStub: ClipboardStub = {
  availableFormats: () => [],
  getText: () => "",
  setText: () => undefined,
  hasText: () => false,
  getImageBinary: () => undefined,
  getImageBase64: () => undefined,
  setImageBinary: () => undefined,
  setImageBase64: () => undefined,
  hasImage: () => false,
  getHtml: () => "",
  setHtml: () => undefined,
  hasHtml: () => false,
  getRtf: () => "",
  setRtf: () => undefined,
  hasRtf: () => false,
  clear: () => undefined,
  watch: () => ({ close: () => undefined }),
  callThreadsafeFunction: () => undefined,
};

function isPiClipboardRequest(request: string): boolean {
  return request === "@mariozechner/clipboard" || request.startsWith("@mariozechner/clipboard-");
}

export function installPiClipboardGuard(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.OPENCLAW_DISABLE_PI_NATIVE_CLIPBOARD === "0") {
    return false;
  }
  if (process.platform !== "darwin") {
    return false;
  }

  const globalState = globalThis as typeof globalThis & { [installKey]?: boolean };
  if (globalState[installKey]) {
    return false;
  }

  const require = createRequire(import.meta.url);
  const moduleRuntime = require("node:module") as NativeModuleLoader;
  const originalLoad = moduleRuntime._load;
  if (typeof originalLoad !== "function") {
    return false;
  }

  moduleRuntime._load = function guardedNativeModuleLoad(
    request: string,
    parent?: unknown,
    isMain?: boolean,
  ): unknown {
    if (isPiClipboardRequest(request)) {
      return clipboardStub;
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  globalState[installKey] = true;
  return true;
}
