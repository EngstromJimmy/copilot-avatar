// Copilot Avatar extension — shows a 3D Copilot head in a native window
// and displays agent responses beneath it as floating text.
import { joinSession } from "@github/copilot-sdk/extension";
import { join, basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { CopilotWebview } from "./lib/copilot-webview.js";

const settingsPath = join(import.meta.dirname, ".tts-settings.json");

let folderName = basename(process.cwd());
let sessionTitle = null;

async function loadSettings() {
    try {
        return JSON.parse(await readFile(settingsPath, "utf-8"));
    } catch {
        return { enabled: false, rate: 1.1, voice: null };
    }
}

async function saveSettings(settings) {
    await writeFile(settingsPath, JSON.stringify(settings), "utf-8");
}

const webview = new CopilotWebview({
    extensionName: "copilot_avatar",
    contentDir: join(import.meta.dirname, "content"),
    title: `Copilot Avatar · ${folderName}`,
    width: 500,
    height: 600,
    callbacks: {
        log: (msg, opts) => session.log(msg, opts),
        loadSettings: () => loadSettings(),
        saveSettings: (settings) => saveSettings(settings),
        getContext: () => ({ folder: folderName, sessionTitle }),
    },
});

// Push context to the page with retry until the WebSocket connects
async function pushContext() {
    if (!webview._handle) return;
    const payload = JSON.stringify({ folder: folderName, sessionTitle });
    for (let i = 0; i < 15; i++) {
        try {
            await webview.eval(`window.setContext(${payload})`);
            return;
        } catch {
            if (i < 14) await new Promise(r => setTimeout(r, 200));
        }
    }
}

const session = await joinSession({
    tools: [
        // Override the built-in show tool to push context after opening
        {
            name: "copilot_avatar_show",
            description: "Open the Copilot avatar window. If already open, pass reload=true to refresh.",
            parameters: {
                type: "object",
                properties: {
                    reload: { type: "boolean", description: "If the window is already open, reload the page. Default false." },
                },
            },
            handler: async ({ reload = false } = {}) => {
                try {
                    await webview.show({ reload });
                    pushContext();
                    return "Avatar window opened.";
                } catch (e) {
                    return `Error: ${e.message}`;
                }
            },
        },
        ...webview.tools.filter(t => t.name !== "copilot_avatar_show"),
    ],
    commands: [{
        name: "avatar",
        description: "Open the Copilot 3D avatar window.",
        handler: async () => { await webview.show(); pushContext(); },
    }],
    hooks: {
        onSessionEnd: webview.close,
    },
});

session.on("session.start", (event) => {
    if (event.data?.context?.cwd) folderName = basename(event.data.context.cwd);
    pushContext();
});

session.on("session.resume", (event) => {
    if (event.data?.context?.cwd) folderName = basename(event.data.context.cwd);
    pushContext();
});

session.on("session.context_changed", (event) => {
    if (event.data?.cwd) { folderName = basename(event.data.cwd); pushContext(); }
});

session.on("session.title_changed", (event) => {
    if (event.data?.title) { sessionTitle = event.data.title; pushContext(); }
});

session.on("assistant.message", async (event) => {
    const text = event.data?.content;
    if (text && webview._handle) {
        const escaped = JSON.stringify(text);
        await webview.eval(`window.setWorking(false)`, { timeoutMs: 2000 }).catch(() => {});
        await webview.eval(`window.showMessage(${escaped})`, { timeoutMs: 5000 }).catch(() => {});
    }
});

// Show working indicator when agent starts processing
session.on("assistant.thinking", async () => {
    if (webview._handle) {
        await webview.eval(`window.setWorking(true)`, { timeoutMs: 2000 }).catch(() => {});
    }
});

// Show subtasks (tool calls, intent changes)
session.on("tool.start", async (event) => {
    const name = event.data?.name || event.data?.tool;
    if (name && webview._handle) {
        const label = name.replace(/_/g, ' ').replace(/-/g, ' ');
        const escaped = JSON.stringify(label);
        await webview.eval(`window.setSubtask(${escaped})`, { timeoutMs: 2000 }).catch(() => {});
    }
});

session.on("intent", async (event) => {
    const intent = event.data?.intent || event.data?.content;
    if (intent && webview._handle) {
        const escaped = JSON.stringify(intent);
        await webview.eval(`window.setSubtask(${escaped})`, { timeoutMs: 2000 }).catch(() => {});
    }
});
