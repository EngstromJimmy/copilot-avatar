// Copilot Avatar extension — shows a 3D Copilot head in a native window
// and displays agent responses beneath it as floating text.
import { joinSession } from "@github/copilot-sdk/extension";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { CopilotWebview } from "./lib/copilot-webview.js";

const settingsPath = join(import.meta.dirname, ".tts-settings.json");

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
    title: "Copilot Avatar",
    width: 500,
    height: 600,
    callbacks: {
        log: (msg, opts) => session.log(msg, opts),
        loadSettings: () => loadSettings(),
        saveSettings: (settings) => saveSettings(settings),
    },
});

const session = await joinSession({
    tools: webview.tools,
    commands: [{
        name: "avatar",
        description: "Open the Copilot 3D avatar window.",
        handler: () => webview.show(),
    }],
    hooks: {
        onSessionEnd: webview.close,
    },
});

// Listen for agent responses and push them to the webview
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
