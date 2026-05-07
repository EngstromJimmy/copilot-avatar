// Copilot Avatar extension — shows a 3D Copilot head in a native window
// and displays agent responses beneath it as floating text.
import { joinSession } from "@github/copilot-sdk/extension";
import { join } from "node:path";
import { CopilotWebview } from "./lib/copilot-webview.js";

const webview = new CopilotWebview({
    extensionName: "copilot_avatar",
    contentDir: join(import.meta.dirname, "content"),
    title: "Copilot Avatar",
    width: 500,
    height: 600,
    callbacks: {
        log: (msg, opts) => session.log(msg, opts),
    },
});

const session = await joinSession({
    tools: webview.tools,
    commands: [{
        name: "avatar",
        description: "Open the Copilot 3D avatar window.",
        handler: webview.show,
    }],
    hooks: {
        onSessionStart: async () => {
            // Auto-open the avatar window on session start
            await webview.show();
        },
        onSessionEnd: webview.close,
    },
});

// Listen for agent responses and push them to the webview
session.on("assistant.message", async (event) => {
    const text = event.data?.content;
    if (text && webview._handle) {
        const escaped = JSON.stringify(text);
        await webview.eval(`window.showMessage(${escaped})`, { timeoutMs: 5000 }).catch(() => {});
    }
});
