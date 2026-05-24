import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { createSuccessItSupportTools } from "./src/tools.js";

export default definePluginEntry({
  id: "successit-support",
  name: "SuccessIT Support",
  description: "Restricted SuccessIT customer support ticket intake tools for Laylah.",
  register(api) {
    api.registerTool((ctx) => createSuccessItSupportTools({ api, ctx }), {
      names: [
        "successit_support_onboard_group",
        "successit_ticket_create",
        "successit_notify_jensen",
      ],
    });
  },
});
