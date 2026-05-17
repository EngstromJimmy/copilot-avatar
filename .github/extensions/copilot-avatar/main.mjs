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
    samVoice: 'sam',
    showSpokenText: true,
    showAvatarBadges: true,
    showModelBadges: false,
});
const clippyDefaultVoxtralVoice = 'en_paul_excited';
const retroClippySampleText = "It looks like you're writing some code. Need a hand? I can help with that.";
const WEBVIEW_READY_POLL_MS = 100;
const WEBVIEW_READY_TIMEOUT_MS = 5000;
const FALLBACK_SUBAGENT_RETIRE_MS = 1200;
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
const toolAgentIdsByToolCallId = new Map();
const pendingModelsByToolCallId = new Map();
const pendingThinkingByToolCallId = new Set();
const subagentSpawnMetadataByToolCallId = new Map();
const subagentSpawnMetadataByAgentId = new Map();
const subagentSelectedHintsByAgentId = new Map();
const liveSubagentStatesByAgentId = new Map();
let pendingSubagentSelectionHint = null;

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

function shouldKeepAvatarAlwaysOnTop(settings) {
    return !!settings?.transparentWindow;
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
    webview.alwaysOnTop = shouldKeepAvatarAlwaysOnTop(settings);
}

async function saveSettings(settings) {
    const currentSettings = await loadSettings();
    const nextSettings = normalizeSettings({ ...currentSettings, ...settings });
    const transparencyChanged = webview.transparent !== nextSettings.transparentWindow;
    const alwaysOnTopChanged = webview.alwaysOnTop !== shouldKeepAvatarAlwaysOnTop(nextSettings);
    const windowStyleChanged = transparencyChanged || alwaysOnTopChanged;
    await writeFile(settingsPath, JSON.stringify(nextSettings), "utf-8");
    applySettingsToWebview(nextSettings);
    if (windowStyleChanged) {
        void reopenWebviewForWindowStyleChange();
    }
    return {
        windowWidth: nextSettings.windowWidth,
        windowHeight: nextSettings.windowHeight,
        transparentWindow: nextSettings.transparentWindow,
        reopenedWindow: windowStyleChanged && !!webview._handle,
    };
}

async function generateRetroClippyVoice() {
    // Remote SAPI4 generation via tetyys.com has been removed.
    // This seam is reserved for a browser-native implementation.
    throw new Error("Retro Clippy voice generation is not available: remote SAM server removed, browser-native path not yet implemented.");
}

const initialSettings = await loadSettings();

const webview = new CopilotWebview({
    extensionName: "copilot_avatar",
    contentDir: join(import.meta.dirname, "content"),
    title: formatTitle(),
    width: initialSettings.windowWidth,
    height: initialSettings.windowHeight,
    transparent: initialSettings.transparentWindow,
    alwaysOnTop: shouldKeepAvatarAlwaysOnTop(initialSettings),
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
    if (waitForReady) {
        await callWindowFunction("clearSubagents", { preserveRoot: true }, 3000);
        await resetSubagentRuntimeState();
        await hydrateSubagentRuntimeFromHistory({ replayToWebview: true });
    }
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
    const nextCwd = cwd || process.cwd();
    const cwdChanged = nextCwd !== currentSessionCwd;
    currentSessionCwd = nextCwd;
    folderName = basename(currentSessionCwd);

    if (cwdChanged) {
        await resetSubagentRuntimeState({ clearUi: true });
    }

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

function getTrackedToolKey(toolName = "", toolCallId = null) {
    return toolCallId || `anonymous:${toolName}`;
}

function ensureLiveSubagentState(agentId) {
    if (!agentId) {
        return null;
    }

    const existing = liveSubagentStatesByAgentId.get(agentId);
    if (existing) {
        return existing;
    }

    const nextState = {
        activeTools: new Map(),
        retireTimer: null,
        hadLiveTool: false,
    };
    liveSubagentStatesByAgentId.set(agentId, nextState);
    return nextState;
}

function cancelLiveSubagentRetire(agentId) {
    if (!agentId || !liveSubagentStatesByAgentId.has(agentId)) {
        return;
    }

    const state = liveSubagentStatesByAgentId.get(agentId);
    if (!state?.retireTimer) {
        return;
    }

    clearTimeout(state.retireTimer);
    state.retireTimer = null;
}

function noteLiveSubagentSignal(agentId, { idleGrace = false } = {}) {
    if (!agentId) {
        return;
    }

    const state = ensureLiveSubagentState(agentId);
    if (!state) {
        return;
    }

    if (idleGrace && state.hadLiveTool && state.activeTools.size === 0) {
        if (!state.retireTimer) {
            scheduleFallbackSubagentRetire(agentId);
        }
        return;
    }

    cancelLiveSubagentRetire(agentId);
}

function trackLiveSubagentTool(agentId, payload = {}) {
    if (!agentId || !payload.toolName || SUBAGENT_SPAWN_TOOLS.has(payload.toolName)) {
        return;
    }

    const state = ensureLiveSubagentState(agentId);
    if (!state) {
        return;
    }

    cancelLiveSubagentRetire(agentId);
    state.hadLiveTool = true;
    state.activeTools.set(getTrackedToolKey(payload.toolName, payload.toolCallId ?? null), {
        toolName: payload.toolName,
        toolCallId: payload.toolCallId ?? null,
    });
}

function clearLiveSubagentTool(agentId, payload = {}) {
    if (!agentId || !liveSubagentStatesByAgentId.has(agentId)) {
        return 0;
    }

    const state = liveSubagentStatesByAgentId.get(agentId);
    if (!state?.activeTools?.size) {
        return 0;
    }

    const trackedKey = getTrackedToolKey(payload.toolName ?? "", payload.toolCallId ?? null);
    if (payload.toolCallId && state.activeTools.has(trackedKey)) {
        state.activeTools.delete(trackedKey);
    } else {
        const toolName = String(payload.toolName || "").trim();
        const anonymousKey = toolName ? getTrackedToolKey(toolName, null) : "";
        for (const [key, value] of state.activeTools.entries()) {
            if ((toolName && value.toolName === toolName) || key === anonymousKey) {
                state.activeTools.delete(key);
            }
        }
    }

    return state.activeTools.size;
}

function scheduleFallbackSubagentRetire(agentId) {
    if (!agentId) {
        return;
    }

    const state = ensureLiveSubagentState(agentId);
    if (!state) {
        return;
    }

    cancelLiveSubagentRetire(agentId);
    state.retireTimer = setTimeout(() => {
        const currentState = liveSubagentStatesByAgentId.get(agentId);
        if (!currentState || currentState.activeTools.size > 0) {
            return;
        }

        currentState.retireTimer = null;
        liveSubagentStatesByAgentId.delete(agentId);
        void callWindowFunction("removeSubagent", { agentId }, 3000);
    }, FALLBACK_SUBAGENT_RETIRE_MS);
}

async function resetSubagentRuntimeState({ clearUi = false } = {}) {
    for (const state of liveSubagentStatesByAgentId.values()) {
        if (state?.retireTimer) {
            clearTimeout(state.retireTimer);
        }
    }

    liveSubagentStatesByAgentId.clear();
    subagentIdsByToolCallId.clear();
    toolAgentIdsByToolCallId.clear();
    pendingModelsByToolCallId.clear();
    pendingThinkingByToolCallId.clear();
    subagentSpawnMetadataByToolCallId.clear();
    subagentSpawnMetadataByAgentId.clear();
    subagentSelectedHintsByAgentId.clear();
    pendingSubagentSelectionHint = null;

    if (clearUi) {
        await callWindowFunction("clearSubagents", { preserveRoot: true }, 3000);
    }
}

function cloneEventData(data = {}) {
    return data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
}

function withResolvedAgentId(event, agentId) {
    return {
        ...event,
        agentId,
        data: cloneEventData(event?.data),
    };
}

function getEventToolCallId(event) {
    return event?.data?.toolCallId ?? null;
}

function getEventCorrelationToolCallId(event) {
    return event?.data?.parentToolCallId ?? event?.data?.toolCallId ?? null;
}

function resolveAgentIdFromEvent(event, state = null) {
    const toolAgentIds = state?.toolAgentIdsByToolCallId ?? toolAgentIdsByToolCallId;
    const subagentIds = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;

    if (event.agentId) {
        return event.agentId;
    }

    const toolCallId = getEventToolCallId(event);
    if (toolCallId && toolAgentIds.has(toolCallId)) {
        return toolAgentIds.get(toolCallId) ?? null;
    }

    const parentToolCallId = event.data?.parentToolCallId ?? null;
    if (!parentToolCallId) {
        return null;
    }

    if (toolAgentIds.has(parentToolCallId)) {
        return toolAgentIds.get(parentToolCallId) ?? null;
    }
    return subagentIds.get(parentToolCallId) ?? null;
}

function getIntentText(event) {
    return event.data?.intent || event.data?.content || "";
}

function getToolLabel(toolName) {
    return (toolName || "").replace(/[_-]+/g, " ").trim();
}

function shouldMirrorRootToolActivity(toolName) {
    const normalizedToolName = String(toolName || "").trim();
    if (!normalizedToolName) {
        return false;
    }
    return !SUBAGENT_SPAWN_TOOLS.has(normalizedToolName);
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

function resolveSubagentTaskSummary({ spawnMetadata, selectionHint, runtimeDescription, displayName, agentName, role }) {
    const labels = [
        displayName,
        agentName,
        role,
        spawnMetadata?.displayName,
        humanizeAgentName(spawnMetadata?.name),
        spawnMetadata?.name,
        selectionHint?.displayName,
        humanizeAgentName(selectionHint?.name),
        selectionHint?.name,
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

function getSubagentSpawnMetadata(toolCallId, agentId = null, state = null) {
    const byAgentId = state?.subagentSpawnMetadataByAgentId ?? subagentSpawnMetadataByAgentId;
    const byToolCallId = state?.subagentSpawnMetadataByToolCallId ?? subagentSpawnMetadataByToolCallId;

    if (agentId && byAgentId.has(agentId)) {
        return byAgentId.get(agentId);
    }

    if (toolCallId && byToolCallId.has(toolCallId)) {
        return byToolCallId.get(toolCallId);
    }

    return null;
}

function bindSubagentSpawnMetadata(agentId, toolCallId, metadata, state = null) {
    if (!metadata) {
        return;
    }

    const byToolCallId = state?.subagentSpawnMetadataByToolCallId ?? subagentSpawnMetadataByToolCallId;
    const byAgentId = state?.subagentSpawnMetadataByAgentId ?? subagentSpawnMetadataByAgentId;

    if (toolCallId) {
        byToolCallId.set(toolCallId, metadata);
    }

    if (agentId) {
        byAgentId.set(agentId, metadata);
    }
}

function releaseSubagentSpawnMetadata(agentId, toolCallId, state = null) {
    const byToolCallId = state?.subagentSpawnMetadataByToolCallId ?? subagentSpawnMetadataByToolCallId;
    const byAgentId = state?.subagentSpawnMetadataByAgentId ?? subagentSpawnMetadataByAgentId;

    if (toolCallId) {
        byToolCallId.delete(toolCallId);
    }

    if (agentId) {
        byAgentId.delete(agentId);
    }
}

function extractSubagentSelectionHint(data = {}) {
    const name = cleanAgentLabel(data.agentName);
    const displayName = pickPreferredAgentLabel([
        cleanAgentLabel(data.agentDisplayName),
        humanizeAgentName(name),
        name,
    ]);

    if (!name && !displayName) {
        return null;
    }

    return {
        name,
        displayName,
    };
}

function getPendingSubagentSelectionHint(state = null) {
    return state ? state.pendingSubagentSelectionHint : pendingSubagentSelectionHint;
}

function setPendingSubagentSelectionHint(hint, state = null) {
    if (state) {
        state.pendingSubagentSelectionHint = hint;
        return;
    }

    pendingSubagentSelectionHint = hint;
}

function getSubagentSelectionHint(agentId, state = null) {
    const hintsByAgentId = state?.subagentSelectedHintsByAgentId ?? subagentSelectedHintsByAgentId;
    if (!agentId || !hintsByAgentId.has(agentId)) {
        return null;
    }
    return hintsByAgentId.get(agentId);
}

function bindSubagentSelectionHint(agentId, hint, state = null) {
    if (!agentId || !hint) {
        return;
    }

    const hintsByAgentId = state?.subagentSelectedHintsByAgentId ?? subagentSelectedHintsByAgentId;
    hintsByAgentId.set(agentId, hint);
}

function shouldBindPendingSelectionHint({ agentId, runtimeAgentName, runtimeDisplayName, spawnMetadata, state = null }) {
    if (!agentId || spawnMetadata || getSubagentSelectionHint(agentId, state)) {
        return false;
    }

    const pendingHint = getPendingSubagentSelectionHint(state);
    if (!pendingHint) {
        return false;
    }

    const runtimeNameWeak = !runtimeAgentName || isLowConfidenceAgentLabel(runtimeAgentName, agentId);
    const runtimeDisplayWeak = !runtimeDisplayName || isLowConfidenceAgentLabel(runtimeDisplayName, agentId);
    return runtimeNameWeak && runtimeDisplayWeak;
}

function resolveSubagentDisplayFields({
    agentId = null,
    toolCallId = null,
    runtimeAgentName = "",
    runtimeDisplayName = "",
    runtimeDescription = "",
    spawnMetadata = null,
    selectionHint = null,
}) {
    const squadAgent = resolveSquadAgentMetadata(squadContext, {
        agentId,
        agentName: runtimeAgentName,
        agentDisplayName: runtimeDisplayName,
        spawnName: spawnMetadata?.name || selectionHint?.name,
        spawnDisplayName: spawnMetadata?.displayName || selectionHint?.displayName,
    });
    const displayName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        spawnMetadata?.displayName,
        selectionHint?.displayName,
        runtimeDisplayName,
        runtimeAgentName,
        humanizeAgentName(spawnMetadata?.name),
        humanizeAgentName(selectionHint?.name),
        selectionHint?.name,
    ], agentId) || runtimeDisplayName || runtimeAgentName || selectionHint?.displayName || selectionHint?.name || agentId || "";
    const agentName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        spawnMetadata?.displayName,
        selectionHint?.displayName,
        runtimeAgentName,
        humanizeAgentName(spawnMetadata?.name),
        spawnMetadata?.name,
        humanizeAgentName(selectionHint?.name),
        selectionHint?.name,
    ], agentId) || runtimeAgentName || cleanAgentLabel(spawnMetadata?.name) || cleanAgentLabel(selectionHint?.name) || "";
    const role = cleanAgentLabel(squadAgent?.role);
    const taskSummary = resolveSubagentTaskSummary({
        spawnMetadata,
        selectionHint,
        runtimeDescription,
        displayName,
        agentName,
        role,
    });
    const description = runtimeDescription || spawnMetadata?.description || squadAgent?.description || "";

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

function resolveSubagentDisplayData(event, state = null) {
    const agentId = event.agentId ?? null;
    const toolCallId = getEventCorrelationToolCallId(event);
    const runtimeAgentName = cleanAgentLabel(event.data?.agentName);
    const runtimeDisplayName = cleanAgentLabel(event.data?.agentDisplayName);
    const runtimeDescription = cleanAgentLabel(event.data?.agentDescription);
    const spawnMetadata = getSubagentSpawnMetadata(toolCallId, agentId, state);
    if (agentId && spawnMetadata) {
        bindSubagentSpawnMetadata(agentId, toolCallId, spawnMetadata, state);
    }
    if (shouldBindPendingSelectionHint({
        agentId,
        runtimeAgentName,
        runtimeDisplayName,
        spawnMetadata,
        state,
    })) {
        bindSubagentSelectionHint(agentId, getPendingSubagentSelectionHint(state), state);
        setPendingSubagentSelectionHint(null, state);
    }
    const selectionHint = getSubagentSelectionHint(agentId, state) ?? getPendingSubagentSelectionHint(state);
    return resolveSubagentDisplayFields({
        agentId,
        toolCallId,
        runtimeAgentName,
        runtimeDisplayName,
        runtimeDescription,
        spawnMetadata,
        selectionHint,
    });
}

function buildSubagentPayload(displayData, extra = {}) {
    return {
        agentId: displayData.agentId,
        agentName: displayData.agentName,
        displayName: displayData.displayName,
        description: displayData.description,
        workDescription: displayData.taskSummary,
        taskSummary: displayData.taskSummary,
        detailText: displayData.detailText,
        role: displayData.role,
        isDuck: displayData.isDuck,
        toolCallId: displayData.toolCallId,
        ...extra,
    };
}

function createHydratedSubagentRuntimeState() {
    return {
        subagentIdsByToolCallId: new Map(),
        toolAgentIdsByToolCallId: new Map(),
        subagentSpawnMetadataByToolCallId: new Map(),
        subagentSpawnMetadataByAgentId: new Map(),
        subagentSelectedHintsByAgentId: new Map(),
        pendingSubagentSelectionHint: null,
        activeSubagentsByAgentId: new Map(),
    };
}

function resetHydratedSubagentRuntimeState(state) {
    state.subagentIdsByToolCallId.clear();
    state.toolAgentIdsByToolCallId.clear();
    state.subagentSpawnMetadataByToolCallId.clear();
    state.subagentSpawnMetadataByAgentId.clear();
    state.subagentSelectedHintsByAgentId.clear();
    state.pendingSubagentSelectionHint = null;
    state.activeSubagentsByAgentId.clear();
}

function upsertHydratedSubagentState(activeSubagentsByAgentId, payload) {
    if (!payload?.agentId) {
        return null;
    }

    const existing = activeSubagentsByAgentId.get(payload.agentId);
    if (existing) {
        existing.payload = {
            ...existing.payload,
            ...payload,
        };
        return existing;
    }

    const nextState = {
        payload: { ...payload },
        model: "",
        intent: "",
        thinking: false,
        activeTools: new Map(),
        hadLiveTool: false,
        waitingForRetire: false,
    };
    activeSubagentsByAgentId.set(payload.agentId, nextState);
    return nextState;
}

function trackHydratedActiveTool(activeState, payload = {}) {
    if (!activeState || !payload.toolName) {
        return;
    }

    const key = payload.toolCallId || `anonymous:${payload.toolName}`;
    activeState.hadLiveTool = true;
    activeState.activeTools.set(key, {
        toolName: payload.toolName,
        toolCallId: payload.toolCallId ?? null,
    });
}

function clearHydratedActiveTool(activeState, payload = {}) {
    if (!activeState?.activeTools?.size) {
        return;
    }

    if (payload.toolCallId && activeState.activeTools.has(payload.toolCallId)) {
        activeState.activeTools.delete(payload.toolCallId);
        return;
    }

    const toolName = String(payload.toolName || "").trim();
    const anonymousKey = payload.toolName ? `anonymous:${payload.toolName}` : "";
    for (const [key, value] of activeState.activeTools.entries()) {
        if ((toolName && value.toolName === toolName) || key === anonymousKey) {
            activeState.activeTools.delete(key);
        }
    }
}

function markHydratedSubagentLive(activeState, { idleGrace = false } = {}) {
    if (!activeState) {
        return;
    }

    activeState.waitingForRetire = idleGrace && activeState.hadLiveTool && activeState.activeTools.size === 0;
}

function mergeHydratedSubagentRuntimeState(state) {
    for (const [toolCallId, agentId] of state.subagentIdsByToolCallId.entries()) {
        subagentIdsByToolCallId.set(toolCallId, agentId);
    }
    for (const [toolCallId, agentId] of state.toolAgentIdsByToolCallId.entries()) {
        toolAgentIdsByToolCallId.set(toolCallId, agentId);
    }
    for (const [toolCallId, metadata] of state.subagentSpawnMetadataByToolCallId.entries()) {
        subagentSpawnMetadataByToolCallId.set(toolCallId, metadata);
    }
    for (const [agentId, metadata] of state.subagentSpawnMetadataByAgentId.entries()) {
        subagentSpawnMetadataByAgentId.set(agentId, metadata);
    }
    for (const [agentId, hint] of state.subagentSelectedHintsByAgentId.entries()) {
        subagentSelectedHintsByAgentId.set(agentId, hint);
    }
    if (state.pendingSubagentSelectionHint) {
        pendingSubagentSelectionHint = state.pendingSubagentSelectionHint;
    }
}

async function replayHydratedSubagentsToWebview(activeSubagentsByAgentId) {
    if (!webview._handle || !(activeSubagentsByAgentId instanceof Map) || activeSubagentsByAgentId.size === 0) {
        return;
    }

    for (const activeState of activeSubagentsByAgentId.values()) {
        await callWindowFunction("addSubagent", activeState.payload, 3000);
        if (activeState.model) {
            await callWindowFunction("setAgentModel", {
                ...activeState.payload,
                model: activeState.model,
            }, 3000);
        }
        if (activeState.intent) {
            await callWindowFunction("setAgentIntent", {
                ...activeState.payload,
                intent: activeState.intent,
            }, 3000);
        }
        for (const activeTool of activeState.activeTools.values()) {
            await callWindowFunction("setAgentActivity", {
                ...activeState.payload,
                toolName: activeTool.toolName,
                toolCallId: activeTool.toolCallId,
            }, 3000);
        }
        if (!activeState.activeTools.size && activeState.thinking) {
            await callWindowFunction("setAgentThinking", activeState.payload, 3000);
        }
    }
}

async function hydrateSubagentRuntimeFromHistory({ replayToWebview = false } = {}) {
    const events = await session.getMessages().catch(() => []);
    if (!Array.isArray(events) || events.length === 0) {
        return null;
    }

    const historyState = createHydratedSubagentRuntimeState();
    for (const event of events) {
        switch (event?.type) {
            case "assistant.turn_start": {
                if (!event.agentId) {
                    resetHydratedSubagentRuntimeState(historyState);
                }
                break;
            }
            case "subagent.selected": {
                setPendingSubagentSelectionHint(extractSubagentSelectionHint(event.data), historyState);
                break;
            }
            case "subagent.deselected": {
                setPendingSubagentSelectionHint(null, historyState);
                break;
            }
            case "tool.execution_start": {
                const toolName = event.data?.toolName ?? "";
                const spawnMetadata = extractSubagentSpawnMetadata(toolName, event.data?.arguments);
                if (spawnMetadata && event.data?.toolCallId) {
                    bindSubagentSpawnMetadata(null, event.data.toolCallId, spawnMetadata, historyState);
                }

                const agentId = resolveAgentIdFromEvent(event, historyState);
                const toolCallId = getEventToolCallId(event);
                if (agentId && toolCallId) {
                    historyState.toolAgentIdsByToolCallId.set(toolCallId, agentId);
                }

                if (!agentId || !historyState.activeSubagentsByAgentId.has(agentId)) {
                    break;
                }

                const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId), historyState);
                const payload = buildSubagentPayload(displayData, {
                    toolName,
                });
                const activeState = upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, payload);
                markHydratedSubagentLive(activeState);
                trackHydratedActiveTool(activeState, payload);
                break;
            }
            case "subagent.started": {
                const displayData = resolveSubagentDisplayData(event, historyState);
                if (event.agentId && displayData.toolCallId) {
                    historyState.subagentIdsByToolCallId.set(displayData.toolCallId, event.agentId);
                }
                markHydratedSubagentLive(
                    upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, buildSubagentPayload(displayData))
                );
                break;
            }
            case "assistant.usage": {
                const model = event.data?.model ?? "";
                const agentId = resolveAgentIdFromEvent(event, historyState);
                if (!model || !agentId) {
                    break;
                }
                const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId), historyState);
                const activeState = upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, buildSubagentPayload(displayData, {
                    model,
                }));
                if (activeState) {
                    activeState.model = model;
                }
                markHydratedSubagentLive(activeState, { idleGrace: true });
                break;
            }
            case "assistant.intent": {
                const intent = getIntentText(event);
                const agentId = resolveAgentIdFromEvent(event, historyState);
                if (!intent || !agentId) {
                    break;
                }
                const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId), historyState);
                const activeState = upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, buildSubagentPayload(displayData, {
                    intent,
                }));
                if (activeState) {
                    activeState.intent = intent;
                }
                markHydratedSubagentLive(activeState, { idleGrace: true });
                break;
            }
            case "assistant.reasoning": {
                const agentId = resolveAgentIdFromEvent(event, historyState);
                if (!agentId || !historyState.activeSubagentsByAgentId.has(agentId)) {
                    break;
                }
                const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId), historyState);
                const activeState = upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, buildSubagentPayload(displayData));
                if (activeState) {
                    activeState.thinking = true;
                }
                markHydratedSubagentLive(activeState, { idleGrace: true });
                break;
            }
            case "tool.execution_complete": {
                const agentId = resolveAgentIdFromEvent(event, historyState);
                const toolCallId = getEventToolCallId(event);
                const activeState = agentId ? historyState.activeSubagentsByAgentId.get(agentId) : null;
                if (activeState) {
                    clearHydratedActiveTool(activeState, {
                        toolName: event.data?.toolName ?? "",
                        toolCallId,
                    });
                    if (!SUBAGENT_SPAWN_TOOLS.has(event.data?.toolName ?? "") && !activeState.activeTools.size) {
                        activeState.waitingForRetire = true;
                    }
                }
                if (toolCallId) {
                    historyState.toolAgentIdsByToolCallId.delete(toolCallId);
                }
                break;
            }
            case "subagent.completed":
            case "subagent.failed": {
                const displayData = resolveSubagentDisplayData(event, historyState);
                historyState.activeSubagentsByAgentId.delete(displayData.agentId);
                releaseSubagentSpawnMetadata(displayData.agentId, displayData.toolCallId, historyState);
                if (displayData.toolCallId) {
                    historyState.toolAgentIdsByToolCallId.delete(displayData.toolCallId);
                    historyState.subagentIdsByToolCallId.delete(displayData.toolCallId);
                }
                break;
            }
            default:
                break;
        }
    }

    for (const [agentId, activeState] of historyState.activeSubagentsByAgentId.entries()) {
        if (activeState.waitingForRetire && activeState.activeTools.size === 0) {
            historyState.activeSubagentsByAgentId.delete(agentId);
        }
    }

    mergeHydratedSubagentRuntimeState(historyState);
    if (replayToWebview) {
        await replayHydratedSubagentsToWebview(historyState.activeSubagentsByAgentId);
    }
    return historyState;
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
await hydrateSubagentRuntimeFromHistory();

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

session.on("subagent.selected", (event) => {
    setPendingSubagentSelectionHint(extractSubagentSelectionHint(event.data));
});

session.on("subagent.deselected", () => {
    setPendingSubagentSelectionHint(null);
});

session.on("subagent.started", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    const toolCallId = displayData.toolCallId;
    noteLiveSubagentSignal(displayData.agentId);
    if (event.agentId && toolCallId) {
        subagentIdsByToolCallId.set(toolCallId, event.agentId);
    }

    await callWindowFunction("addSubagent", buildSubagentPayload(displayData), 3000);

    await syncPendingModelForSubagent(event.agentId ?? null, toolCallId);
    await syncPendingThinkingForSubagent(event.agentId ?? null, toolCallId);
});

session.on("subagent.completed", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    cancelLiveSubagentRetire(displayData.agentId);
    liveSubagentStatesByAgentId.delete(displayData.agentId);
    await callWindowFunction("completeSubagent", buildSubagentPayload(displayData, {
        durationMs: event.data?.durationMs ?? null,
        totalToolCalls: event.data?.totalToolCalls ?? null,
    }), 3000);
    releaseSubagentSpawnMetadata(displayData.agentId, displayData.toolCallId);
    if (displayData.toolCallId) {
        subagentIdsByToolCallId.delete(displayData.toolCallId);
    }
});

session.on("subagent.failed", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    cancelLiveSubagentRetire(displayData.agentId);
    liveSubagentStatesByAgentId.delete(displayData.agentId);
    await callWindowFunction("failSubagent", buildSubagentPayload(displayData, {
        error: event.data?.error ?? "",
    }), 3000);
    releaseSubagentSpawnMetadata(displayData.agentId, displayData.toolCallId);
    if (displayData.toolCallId) {
        subagentIdsByToolCallId.delete(displayData.toolCallId);
    }
});

session.on("tool.execution_start", async (event) => {
    const toolName = event.data?.toolName ?? "";
    const spawnMetadata = extractSubagentSpawnMetadata(toolName, event.data?.arguments);
    if (spawnMetadata && event.data?.toolCallId) {
        bindSubagentSpawnMetadata(null, event.data.toolCallId, spawnMetadata);
    }

    const agentId = resolveAgentIdFromEvent(event);
    const runtimeToolCallId = getEventToolCallId(event);
    if (agentId && runtimeToolCallId) {
        toolAgentIdsByToolCallId.set(runtimeToolCallId, agentId);
    }
    trackLiveSubagentTool(agentId, {
        toolName,
        toolCallId: runtimeToolCallId,
    });

    if (agentId) {
        const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId));
        await callWindowFunction("setAgentActivity", buildSubagentPayload(displayData, {
            toolName,
        }));
    } else if (shouldMirrorRootToolActivity(toolName)) {
        await callWindowFunction("setAgentActivity", {
            agentId: null,
            toolName,
            toolCallId: event.data?.toolCallId ?? null,
        });
    }

    if (!agentId && shouldMirrorRootToolActivity(toolName)) {
        const toolLabel = getToolLabel(toolName);
        if (toolLabel) {
            await callWindowFunction("setSubtask", toolLabel);
        }
    }
});

session.on("tool.execution_complete", async (event) => {
    const agentId = resolveAgentIdFromEvent(event);
    if (!agentId && (event.data?.success === false || event.data?.error)) {
        rootTurnState.hadFailure = true;
    }

    const toolCallId = getEventToolCallId(event);
    await callWindowFunction("clearAgentActivity", {
        agentId,
        toolName: event.data?.toolName ?? "",
        toolCallId,
    });
    if (agentId && !SUBAGENT_SPAWN_TOOLS.has(event.data?.toolName ?? "")) {
        const remainingToolCount = clearLiveSubagentTool(agentId, {
            toolName: event.data?.toolName ?? "",
            toolCallId,
        });
        if (remainingToolCount === 0) {
            scheduleFallbackSubagentRetire(agentId);
        }
    }
    if (toolCallId) {
        toolAgentIdsByToolCallId.delete(toolCallId);
    }
    if (toolCallId && subagentIdsByToolCallId.has(toolCallId)) {
        releaseSubagentSpawnMetadata(subagentIdsByToolCallId.get(toolCallId) ?? null, toolCallId);
        subagentIdsByToolCallId.delete(toolCallId);
    }
});

session.on("assistant.reasoning", async (event) => {
    const agentId = resolveAgentIdFromEvent(event);
    if (agentId) {
        noteLiveSubagentSignal(agentId, { idleGrace: true });
        const displayData = resolveSubagentDisplayData({
            agentId,
            data: {
                parentToolCallId: event.data?.parentToolCallId ?? null,
            },
        });
        await callWindowFunction("setAgentThinking", buildSubagentPayload(displayData), 3000);
        return;
    }

    const pendingToolCallId = getEventCorrelationToolCallId(event);
    if (pendingToolCallId) {
        pendingThinkingByToolCallId.add(pendingToolCallId);
        return;
    }

    await callWindowFunction("setAgentThinking", null, 3000);
});

session.on("assistant.usage", async (event) => {
    const model = event.data?.model ?? "";
    if (!model) return;

    const agentId = resolveAgentIdFromEvent(event);
    if (agentId) {
        noteLiveSubagentSignal(agentId, { idleGrace: true });
        const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId));
        await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, { model }), 3000);
        return;
    }

    const pendingToolCallId = getEventCorrelationToolCallId(event);
    if (pendingToolCallId) {
        pendingModelsByToolCallId.set(pendingToolCallId, model);
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

    const agentId = resolveAgentIdFromEvent(event);
    if (agentId) {
        noteLiveSubagentSignal(agentId, { idleGrace: true });
        const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId));
        await callWindowFunction("setAgentIntent", buildSubagentPayload(displayData, { intent }));
    } else {
        await callWindowFunction("setAgentIntent", {
            agentId: null,
            intent,
        });
    }

    if (!agentId) {
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
    await resetSubagentRuntimeState({ clearUi: true });
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
