import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createPeggiWorkflowTools } from "./src/tools.js";

const PEGGI_WORKFLOW_TOOL_NAMES = [
  "peggi_expense_entry",
  "peggi_duplicate_gate",
  "peggi_email_invoice_flow",
  "peggi_month_end_review",
  "peggi_books_status",
];

export default definePluginEntry({
  id: "peggi-workflows",
  name: "Peggi Workflows",
  description: "Deterministic LangGraph-backed workflow tools for Peggi bookkeeping.",
  register(api) {
    api.registerTool((ctx) => createPeggiWorkflowTools({ api, ctx }), {
      names: PEGGI_WORKFLOW_TOOL_NAMES,
    });
  },
});
