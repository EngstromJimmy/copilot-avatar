// Copilot Avatar extension — shows a 3D Copilot head in a native window
// and displays agent responses beneath it as floating text.
import { joinSession } from "@github/copilot-sdk/extension";
import { join, basename } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { CopilotWebview } from "./lib/copilot-webview.js";
import { getSquadTitleSuffix, getSquadWindowContext, loadSquadContext, resolveSquadAgentMetadata } from "./lib/squad-context.mjs";

const settingsPath = join(import.meta.dirname, ".tts-settings.json");
const DEFAULT_SETTINGS = Object.freeze({
    enabled: false,
    rate: 1.1,
    pitch: 1.0,
    voice: null,
    windowWidth: 600,
    windowHeight: 800,
    transparentWindow: true,
    avatarStyle: 'copilot',
    engine: 'webspeech',
    voxtralBackend: 'cloud',
    voxtralUrl: 'http://localhost:18000',
    voxtralApiKey: '',
    voxtralVoice: 'en_paul_neutral',
    voxtralVoiceSource: 'preset',
    voxtralRefAudio: null,
    clippyVoxtralVoice: 'en_paul_excited',
    elevenlabsApiKey: '',
    elevenlabsVoice: '',
    elevenlabsClonedVoiceId: '',
    elevenlabsClonedVoiceName: '',
    elevenlabsCloneSourceHash: '',
    clippyElevenlabsVoiceId: '',
    clippyElevenlabsVoiceName: '',
    clippyElevenlabsCloneSourceHash: '',
    clippyRefAudio: null,
    showSpokenText: true,
    showAvatarBadges: true,
    showModelBadges: false,
});
const clippyDefaultVoxtralVoice = 'en_paul_excited';
const retroClippySampleText = "It looks like you're writing some code. Need a hand? I can help with that.";
const WEBVIEW_READY_POLL_MS = 100;
const WEBVIEW_READY_TIMEOUT_MS = 5000;
const SUBAGENT_SPAWN_TOOLS = new Set(["task", "runSubagent", "agent"]);
const GENERIC_AGENT_LABELS = new Set([
    "agent",
    "assistant",
    "coding agent",
    "general purpose",
    "general purpose agent",
    "general-purpose",
    "general-purpose agent",
    "subagent",
    "task agent",
]);
let folderName = basename(process.cwd());
let currentSessionCwd = process.cwd();
let squadContext = {
    active: false,
    teamName: "",
    coordinatorName: "",
    idleStatusText: "",
    idleSubtaskText: "",
    agentsByKey: new Map(),
    error: "",
    squadPath: "",
    clientName: "",
};
let lastSquadLogKey = "";
let contextRefreshId = 0;
const subagentIdsByToolCallId = new Map();
const pendingModelsByToolCallId = new Map();
const pendingThinkingByToolCallId = new Set();
const subagentSpawnMetadataByToolCallId = new Map();
const subagentSpawnMetadataByAgentId = new Map();

function normalizeSettings(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        return { ...DEFAULT_SETTINGS, windowSizeUnits: "physical" };
    }

    const nextSettings = { ...DEFAULT_SETTINGS, ...settings };
    nextSettings.windowWidth = normalizeWindowDimension(nextSettings.windowWidth, DEFAULT_SETTINGS.windowWidth, 320, 4096);
    nextSettings.windowHeight = normalizeWindowDimension(nextSettings.windowHeight, DEFAULT_SETTINGS.windowHeight, 360, 3072);
    nextSettings.windowSizeUnits = settings.windowSizeUnits === "physical" ? "physical" : "";
    return nextSettings;
}

function normalizeWindowDimension(value, fallback, min, max) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(numericValue)));
}

function formatTitle() {
    const squadTitleSuffix = getSquadTitleSuffix(squadContext);
    return `Copilot Avatar · ${folderName}${squadTitleSuffix ? ` · ${squadTitleSuffix}` : ""}`;
}

async function loadSettings() {
    try {
        return normalizeSettings(JSON.parse(await readFile(settingsPath, "utf-8")));
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function applySettingsToWebview(settings) {
    webview.width = settings.windowWidth;
    webview.height = settings.windowHeight;
    webview.transparent = settings.transparentWindow;
}

async function saveSettings(settings) {
    const currentSettings = await loadSettings();
    const nextSettings = normalizeSettings({ ...currentSettings, ...settings });
    const transparencyChanged = webview.transparent !== nextSettings.transparentWindow;
    await writeFile(settingsPath, JSON.stringify(nextSettings), "utf-8");
    applySettingsToWebview(nextSettings);
    if (transparencyChanged) {
        void reopenWebviewForWindowStyleChange();
    }
    return {
        windowWidth: nextSettings.windowWidth,
        windowHeight: nextSettings.windowHeight,
        transparentWindow: nextSettings.transparentWindow,
        reopenedWindow: transparencyChanged && !!webview._handle,
    };
}

async function generateRetroClippyVoice() {
    const params = new URLSearchParams({
        text: retroClippySampleText,
        voice: "Sam",
        pitch: "160",
        speed: "165",
    });
    const response = await fetch(`https://www.tetyys.com/SAPI4/SAPI4?${params}`);
    if (!response.ok) {
        throw new Error(`SAPI4 voice generation failed (${response.status})`);
    }
    const contentType = response.headers.get("content-type") || "audio/wav";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
}

const initialSettings = await loadSettings();

const webview = new CopilotWebview({
    extensionName: "copilot_avatar",
    contentDir: join(import.meta.dirname, "content"),
    title: formatTitle(),
    width: initialSettings.windowWidth,
    height: initialSettings.windowHeight,
    transparent: initialSettings.transparentWindow,
    alwaysOnTop: true,
    callbacks: {
        log: (msg, opts) => session.log(msg, opts),
        loadSettings: () => loadSettings(),
        saveSettings: (settings) => saveSettings(settings),
        generateRetroClippyVoice: () => generateRetroClippyVoice(),
    },
});
applySettingsToWebview(initialSettings);

async function syncTitle() {
    const title = formatTitle();
    webview.title = title;
    if (webview._handle) {
        await webview.eval(`document.title = ${JSON.stringify(title)}`, { timeoutMs: 2000 }).catch(() => {});
    }
}

async function evalWebview(expression, timeoutMs = 2000) {
    if (!webview._handle) return;
    await webview.eval(expression, { timeoutMs }).catch(() => {});
}

async function waitForWebviewReady(timeoutMs = WEBVIEW_READY_TIMEOUT_MS) {
    if (!webview._handle) {
        return false;
    }

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        const remainingMs = deadline - Date.now();
        if (remainingMs <= 0) {
            break;
        }

        try {
            const ready = await webview.eval("window.__copilotAvatarReady === true", {
                timeoutMs: Math.max(250, Math.min(1000, remainingMs)),
            });
            if (ready === true) {
                return true;
            }
        } catch {}

        await new Promise((resolve) => setTimeout(resolve, WEBVIEW_READY_POLL_MS));
    }

    return false;
}

async function callWindowFunction(name, value, timeoutMs = 2000) {
    await evalWebview(`window.${name}(${JSON.stringify(value)})`, timeoutMs);
}

async function syncVisibleWindowState({ waitForReady = false } = {}) {
    if (!webview._handle) {
        return;
    }

    if (waitForReady) {
        await waitForWebviewReady();
    }

    await syncTitle();
    await syncSquadContext();
}

let pendingWebviewReopen = null;

async function reopenWebviewForWindowStyleChange() {
    if (pendingWebviewReopen) {
        return pendingWebviewReopen;
    }

    pendingWebviewReopen = (async () => {
        if (!webview._handle) {
            return;
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
        webview.close();
        await webview.show();
        await syncVisibleWindowState({ waitForReady: true });
    })().finally(() => {
        pendingWebviewReopen = null;
    });

    return pendingWebviewReopen;
}

function getSquadLogKey(context) {
    if (context?.error) {
        return `error:${context.error}`;
    }
    if (!context?.active) {
        return "";
    }
    return `active:${context.squadPath}:${context.teamName}:${context.clientName}`;
}

async function maybeLogSquadContext(context) {
    const nextLogKey = getSquadLogKey(context);
    if (!nextLogKey || nextLogKey === lastSquadLogKey) {
        lastSquadLogKey = nextLogKey;
        return;
    }

    lastSquadLogKey = nextLogKey;

    if (context.error) {
        await session.log(`[squad] Unable to load Squad metadata: ${context.error}`);
        return;
    }

    const squadName = getSquadTitleSuffix(context);
    const clientSuffix = context.clientName ? ` via ${context.clientName}` : "";
    await session.log(`[squad] Linked ${squadName || "Squad"} metadata from ${context.squadPath}${clientSuffix}.`);
}

async function syncSquadContext() {
    if (!webview._handle) {
        return;
    }
    const ready = await waitForWebviewReady();
    if (!ready) {
        return;
    }
    await callWindowFunction("setSquadContext", getSquadWindowContext(squadContext), 3000);
}

async function refreshSessionContext(cwd = process.cwd()) {
    currentSessionCwd = cwd || process.cwd();
    folderName = basename(currentSessionCwd);

    const refreshId = ++contextRefreshId;
    const nextSquadContext = await loadSquadContext(currentSessionCwd);
    if (refreshId !== contextRefreshId) {
        return;
    }
    squadContext = nextSquadContext;
    await syncVisibleWindowState();
    await maybeLogSquadContext(nextSquadContext);
}

async function syncPendingModelForSubagent(agentId, toolCallId) {
    if (!agentId || !toolCallId || !pendingModelsByToolCallId.has(toolCallId)) {
        return;
    }

    const model = pendingModelsByToolCallId.get(toolCallId);
    pendingModelsByToolCallId.delete(toolCallId);
    const displayData = resolveSubagentDisplayData({
        agentId,
        data: { toolCallId },
    });
    await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, { model }), 3000);
}

async function syncPendingThinkingForSubagent(agentId, toolCallId) {
    if (!agentId || !toolCallId || !pendingThinkingByToolCallId.has(toolCallId)) {
        return;
    }

    pendingThinkingByToolCallId.delete(toolCallId);
    const displayData = resolveSubagentDisplayData({
        agentId,
        data: { toolCallId },
    });
    await callWindowFunction("setAgentThinking", buildSubagentPayload(displayData), 3000);
}

function resolveAgentIdFromEvent(event) {
    if (event.agentId) {
        return event.agentId;
    }

    const parentToolCallId = event.data?.parentToolCallId ?? null;
    if (!parentToolCallId) {
        return null;
    }

    return subagentIdsByToolCallId.get(parentToolCallId) ?? null;
}

function getIntentText(event) {
    return event.data?.intent || event.data?.content || "";
}

function getToolLabel(toolName) {
    return (toolName || "").replace(/[_-]+/g, " ").trim();
}

function cleanAgentLabel(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeAgentLabel(value) {
    return cleanAgentLabel(value)
        .replace(/[_-]+/g, " ")
        .toLowerCase();
}

function isLowConfidenceAgentLabel(value, agentId = "") {
    const normalized = normalizeAgentLabel(value);
    if (!normalized) {
        return false;
    }

    if (GENERIC_AGENT_LABELS.has(normalized)) {
        return true;
    }

    const normalizedAgentId = normalizeAgentLabel(agentId);
    return !!normalizedAgentId && normalized === normalizedAgentId;
}

function humanizeAgentName(value) {
    const cleaned = cleanAgentLabel(value).replace(/^@+/, "");
    if (!cleaned) {
        return "";
    }

    return cleaned
        .split(/[-_]+/g)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function pickPreferredAgentLabel(candidates, agentId = "") {
    const normalizedCandidates = candidates
        .map((candidate) => cleanAgentLabel(candidate))
        .filter(Boolean);

    for (const candidate of normalizedCandidates) {
        if (!isLowConfidenceAgentLabel(candidate, agentId)) {
            return candidate;
        }
    }

    return normalizedCandidates[0] || "";
}

function extractSpawnDisplayName(description) {
    const cleaned = cleanAgentLabel(description).replace(/^[^\p{L}\p{N}@]+/u, "");
    if (!cleaned) {
        return "";
    }

    const colonMatch = cleaned.match(/^(.+?)\s*:\s+.+$/u);
    if (colonMatch?.[1]) {
        return cleanAgentLabel(colonMatch[1]);
    }

    const dashMatch = cleaned.match(/^(.+?)\s+[—–-]\s+.+$/u);
    if (dashMatch?.[1]) {
        return cleanAgentLabel(dashMatch[1]);
    }

    return "";
}

function escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripLeadingAgentLabel(text, labels = []) {
    const cleanedText = cleanAgentLabel(text);
    if (!cleanedText) {
        return "";
    }

    for (const label of labels.map((value) => cleanAgentLabel(value)).filter(Boolean)) {
        const pattern = new RegExp(`^${escapeRegExp(label)}\\s*[:—–-]\\s+`, "iu");
        if (pattern.test(cleanedText)) {
            return cleanAgentLabel(cleanedText.replace(pattern, ""));
        }
    }

    return cleanedText;
}

function resolveSubagentTaskSummary({ spawnMetadata, runtimeDescription, displayName, agentName, role }) {
    const labels = [
        displayName,
        agentName,
        role,
        spawnMetadata?.displayName,
        humanizeAgentName(spawnMetadata?.name),
        spawnMetadata?.name,
    ]
        .map((value) => cleanAgentLabel(value))
        .filter(Boolean);

    for (const candidate of [spawnMetadata?.description, runtimeDescription]) {
        const summary = stripLeadingAgentLabel(candidate, labels);
        if (!summary) {
            continue;
        }

        const normalizedSummary = normalizeAgentLabel(summary);
        if (!normalizedSummary || labels.some((label) => normalizeAgentLabel(label) === normalizedSummary)) {
            continue;
        }

        return summary;
    }

    return "";
}

function parseToolArguments(rawArguments) {
    if (!rawArguments) {
        return null;
    }

    if (typeof rawArguments === "string") {
        try {
            const parsed = JSON.parse(rawArguments);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    return typeof rawArguments === "object" && !Array.isArray(rawArguments) ? rawArguments : null;
}

function extractSubagentSpawnMetadata(toolName, rawArguments) {
    if (!SUBAGENT_SPAWN_TOOLS.has(toolName)) {
        return null;
    }

    const argumentsObject = parseToolArguments(rawArguments);
    if (!argumentsObject) {
        return null;
    }

    const name = cleanAgentLabel(argumentsObject.name);
    const description = cleanAgentLabel(argumentsObject.description);
    const displayName = pickPreferredAgentLabel([
        extractSpawnDisplayName(description),
        cleanAgentLabel(argumentsObject.displayName),
        humanizeAgentName(name),
        name,
    ]);

    if (!name && !displayName) {
        return null;
    }

    return {
        name,
        displayName,
        description,
    };
}

function getSubagentSpawnMetadata(toolCallId, agentId = null) {
    if (agentId && subagentSpawnMetadataByAgentId.has(agentId)) {
        return subagentSpawnMetadataByAgentId.get(agentId);
    }

    if (toolCallId && subagentSpawnMetadataByToolCallId.has(toolCallId)) {
        return subagentSpawnMetadataByToolCallId.get(toolCallId);
    }

    return null;
}

function bindSubagentSpawnMetadata(agentId, toolCallId, metadata) {
    if (!metadata) {
        return;
    }

    if (toolCallId) {
        subagentSpawnMetadataByToolCallId.set(toolCallId, metadata);
    }

    if (agentId) {
        subagentSpawnMetadataByAgentId.set(agentId, metadata);
    }
}

function releaseSubagentSpawnMetadata(agentId, toolCallId) {
    if (toolCallId) {
        subagentSpawnMetadataByToolCallId.delete(toolCallId);
    }

    if (agentId) {
        subagentSpawnMetadataByAgentId.delete(agentId);
    }
}

function resolveSubagentDisplayData(event) {
    const agentId = event.agentId ?? null;
    const toolCallId = event.data?.toolCallId ?? event.data?.parentToolCallId ?? null;
    const spawnMetadata = getSubagentSpawnMetadata(toolCallId, agentId);
    if (agentId && spawnMetadata) {
        bindSubagentSpawnMetadata(agentId, toolCallId, spawnMetadata);
    }

    const runtimeAgentName = cleanAgentLabel(event.data?.agentName);
    const runtimeDisplayName = cleanAgentLabel(event.data?.agentDisplayName);
    const runtimeDescription = cleanAgentLabel(event.data?.agentDescription);
    const squadAgent = resolveSquadAgentMetadata(squadContext, {
        agentId,
        agentName: runtimeAgentName,
        agentDisplayName: runtimeDisplayName,
        spawnName: spawnMetadata?.name,
        spawnDisplayName: spawnMetadata?.displayName,
    });
    const displayName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        spawnMetadata?.displayName,
        runtimeDisplayName,
        runtimeAgentName,
        humanizeAgentName(spawnMetadata?.name),
    ], agentId) || runtimeDisplayName || runtimeAgentName || agentId || "";
    const agentName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        spawnMetadata?.displayName,
        runtimeAgentName,
        humanizeAgentName(spawnMetadata?.name),
        spawnMetadata?.name,
    ], agentId) || runtimeAgentName || cleanAgentLabel(spawnMetadata?.name) || "";
    const role = cleanAgentLabel(squadAgent?.role);
    const taskSummary = resolveSubagentTaskSummary({
        spawnMetadata,
        runtimeDescription,
        displayName,
        agentName,
        role,
    });
    const description = runtimeDescription || squadAgent?.description || "";

    return {
        agentId,
        agentName,
        displayName,
        description,
        taskSummary,
        detailText: taskSummary,
        role,
        isDuck: isDuckAgent({
            agentId,
            agentName,
            agentDisplayName: displayName,
            agentDescription: description,
        }),
        toolCallId,
    };
}

function buildSubagentPayload(displayData, extra = {}) {
    return {
        agentId: displayData.agentId,
        agentName: displayData.agentName,
        displayName: displayData.displayName,
        description: displayData.description,
        taskSummary: displayData.taskSummary,
        detailText: displayData.detailText,
        role: displayData.role,
        isDuck: displayData.isDuck,
        toolCallId: displayData.toolCallId,
        ...extra,
    };
}

function isDuckAgent(agentData = {}) {
    const text = [
        agentData.agentId,
        agentData.agentName,
        agentData.agentDisplayName,
        agentData.agentDescription,
    ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return text.includes("rubber-duck")
        || text.includes("rubber duck")
        || text.includes("rubberducky")
        || text.includes("duck");
}

function normalizeTurnText(text) {
    return String(text || "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/[*_~>#-]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function messageLooksSuccessful(text) {
    const normalized = normalizeTurnText(text);
    if (!normalized) return false;
    return /\b(done|completed|fixed|implemented|updated|added|created|pushed|refactored|resolved|finished|ready|working now)\b/.test(normalized);
}

function messageLooksFailed(text) {
    const normalized = normalizeTurnText(text);
    if (!normalized) return false;
    return /\b(failed|error|unable|cannot|can't|couldn't|blocked|not working|won't|problem|issue)\b/.test(normalized);
}

const rootTurnState = {
    hadFailure: false,
    sawMessage: false,
    lastMessage: "",
};

const session = await joinSession({
    tools: [
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
                    applySettingsToWebview(await loadSettings());
                    await webview.show({ reload });
                    await syncVisibleWindowState({ waitForReady: true });
                    return reload ? "Avatar window refreshed." : "Avatar window opened.";
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
        handler: async () => {
            applySettingsToWebview(await loadSettings());
            await webview.show();
            await syncVisibleWindowState({ waitForReady: true });
        },
    }],
    hooks: {
        onSessionEnd: webview.close,
    },
});

await refreshSessionContext(currentSessionCwd);

session.on("session.start", (event) => {
    if (event.data?.context?.cwd) {
        void refreshSessionContext(event.data.context.cwd);
    }
    if (event.data?.selectedModel) {
        void callWindowFunction("setAgentModel", { agentId: null, model: event.data.selectedModel }, 3000);
    }
});

session.on("session.resume", (event) => {
    if (event.data?.context?.cwd) {
        void refreshSessionContext(event.data.context.cwd);
    }
});

session.on("session.context_changed", (event) => {
    if (event.data?.cwd) {
        void refreshSessionContext(event.data.cwd);
    }
});

session.on("subagent.started", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    const toolCallId = displayData.toolCallId;
    if (event.agentId && toolCallId) {
        subagentIdsByToolCallId.set(toolCallId, event.agentId);
    }

    await callWindowFunction("addSubagent", buildSubagentPayload(displayData), 3000);

    await syncPendingModelForSubagent(event.agentId ?? null, toolCallId);
    await syncPendingThinkingForSubagent(event.agentId ?? null, toolCallId);
});

session.on("subagent.completed", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    await callWindowFunction("completeSubagent", buildSubagentPayload(displayData, {
        durationMs: event.data?.durationMs ?? null,
        totalToolCalls: event.data?.totalToolCalls ?? null,
    }), 3000);
    releaseSubagentSpawnMetadata(displayData.agentId, displayData.toolCallId);
});

session.on("subagent.failed", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    await callWindowFunction("failSubagent", buildSubagentPayload(displayData, {
        error: event.data?.error ?? "",
    }), 3000);
    releaseSubagentSpawnMetadata(displayData.agentId, displayData.toolCallId);
});

session.on("tool.execution_start", async (event) => {
    const toolName = event.data?.toolName ?? "";
    const spawnMetadata = extractSubagentSpawnMetadata(toolName, event.data?.arguments);
    if (spawnMetadata && event.data?.toolCallId) {
        bindSubagentSpawnMetadata(null, event.data.toolCallId, spawnMetadata);
    }

    if (event.agentId) {
        const displayData = resolveSubagentDisplayData(event);
        await callWindowFunction("setAgentActivity", buildSubagentPayload(displayData, {
            toolName,
        }));
    } else {
        await callWindowFunction("setAgentActivity", {
            agentId: null,
            toolName,
            toolCallId: event.data?.toolCallId ?? null,
        });
    }

    if (!event.agentId && toolName) {
        await callWindowFunction("setSubtask", getToolLabel(toolName));
    }
});

session.on("tool.execution_complete", async (event) => {
    if (!event.agentId && (event.data?.success === false || event.data?.error)) {
        rootTurnState.hadFailure = true;
    }

    const toolCallId = event.data?.toolCallId ?? null;
    await callWindowFunction("clearAgentActivity", {
        agentId: event.agentId ?? null,
        toolName: event.data?.toolName ?? "",
        toolCallId,
    });
    releaseSubagentSpawnMetadata(subagentIdsByToolCallId.get(toolCallId) ?? null, toolCallId);
});

session.on("assistant.reasoning", async (event) => {
    const agentId = resolveAgentIdFromEvent(event);
    if (agentId) {
        const displayData = resolveSubagentDisplayData({
            agentId,
            data: {
                parentToolCallId: event.data?.parentToolCallId ?? null,
            },
        });
        await callWindowFunction("setAgentThinking", buildSubagentPayload(displayData), 3000);
        return;
    }

    const parentToolCallId = event.data?.parentToolCallId ?? null;
    if (parentToolCallId) {
        pendingThinkingByToolCallId.add(parentToolCallId);
        return;
    }

    await callWindowFunction("setAgentThinking", null, 3000);
});

session.on("assistant.usage", async (event) => {
    const model = event.data?.model ?? "";
    if (!model) return;

    if (event.agentId) {
        const displayData = resolveSubagentDisplayData(event);
        await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, { model }), 3000);
        return;
    }

    const parentToolCallId = event.data?.parentToolCallId ?? null;
    if (parentToolCallId) {
        const agentId = subagentIdsByToolCallId.get(parentToolCallId);
        if (agentId) {
            const displayData = resolveSubagentDisplayData({
                agentId,
                data: { parentToolCallId },
            });
            await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, { model }), 3000);
        } else {
            pendingModelsByToolCallId.set(parentToolCallId, model);
        }
        return;
    }

    await callWindowFunction("setAgentModel", { agentId: null, model }, 3000);
});

session.on("session.model_change", async (event) => {
    if (!event.data?.newModel) return;
    if (event.agentId) {
        const displayData = resolveSubagentDisplayData(event);
        await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, {
            model: event.data.newModel,
        }), 3000);
        return;
    }

    await callWindowFunction("setAgentModel", {
        agentId: null,
        model: event.data.newModel,
    }, 3000);
});

session.on("assistant.intent", async (event) => {
    const intent = getIntentText(event);
    if (!intent) return;

    if (event.agentId) {
        const displayData = resolveSubagentDisplayData(event);
        await callWindowFunction("setAgentIntent", buildSubagentPayload(displayData, { intent }));
    } else {
        await callWindowFunction("setAgentIntent", {
            agentId: null,
            intent,
        });
    }

    if (!event.agentId) {
        await callWindowFunction("setSubtask", intent);
    }
});

session.on("assistant.message", async (event) => {
    if (event.agentId) return;

    const text = event.data?.content;
    if (!text) return;
    rootTurnState.sawMessage = true;
    rootTurnState.lastMessage = text;
    await callWindowFunction("showMessage", text, 5000);
});

session.on("assistant.turn_start", async (event) => {
    if (event.agentId) return;
    rootTurnState.hadFailure = false;
    rootTurnState.sawMessage = false;
    rootTurnState.lastMessage = "";
    await syncSquadContext();
    await evalWebview("window.setWorking(true)");
});

session.on("assistant.turn_end", async (event) => {
    if (event.agentId) return;
    await evalWebview("window.setWorking(false)");
    if (rootTurnState.sawMessage && rootTurnState.lastMessage) {
        await callWindowFunction("flushClippySummary", rootTurnState.lastMessage);
    }

    if (rootTurnState.hadFailure || messageLooksFailed(rootTurnState.lastMessage)) {
        await callWindowFunction("setAgentExpression", {
            agentId: null,
            expression: "failed",
            durationMs: 2200,
        });
        return;
    }

    if (rootTurnState.sawMessage && messageLooksSuccessful(rootTurnState.lastMessage)) {
        await callWindowFunction("setAgentExpression", {
            agentId: null,
            expression: "success",
            durationMs: 1700,
        });
    }
});
