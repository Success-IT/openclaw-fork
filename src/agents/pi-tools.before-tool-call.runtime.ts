import { getDiagnosticSessionState } from "../logging/diagnostic-session-state.js";
import { logToolLoopAction } from "../logging/diagnostic.js";
import {
  detectToolCallLoop,
  detectCronWrapperRepeatedCommand,
  rememberCronWrapperToolResult,
  recordToolCall,
  recordToolCallOutcome,
} from "./tool-loop-detection.js";

export const beforeToolCallRuntime = {
  getDiagnosticSessionState,
  logToolLoopAction,
  detectCronWrapperRepeatedCommand,
  detectToolCallLoop,
  rememberCronWrapperToolResult,
  recordToolCall,
  recordToolCallOutcome,
};
