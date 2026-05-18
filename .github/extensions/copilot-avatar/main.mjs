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
    c64Voice: 'sam',
    c64Speed: 72,
    c64Pitch: 64,
    c64Throat: 128,
    c64Mouth: 128,
    showSpokenText: true,
    showAvatarBadges: true,
    showModelBadges: false,
});
const clippyDefaultVoxtralVoice = 'en_paul_excited';
const retroClippySampleText = "It looks like you're writing some code. Need a hand? I can help with that.";
const WEBVIEW_READY_POLL_MS = 100;
const WEBVIEW_READY_TIMEOUT_MS = 5000;
const FALLBACK_SUBAGENT_RETIRE_MS = 5000;
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
const SUPPRESSED_ROOT_CHROME_TEXT = new Set([
    "agent",
    "runsubagent",
    "run subagent",
    "squad ready",
    "task",
]);
const SUPPRESSED_ROOT_RUNTIME_TOOLS = new Set([
    "report_intent",
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
const backgroundAgentMetadataByAgentId = new Map();
const liveBackgroundAgentIds = new Set();
const liveSubagentStatesByAgentId = new Map();
const runtimeSubagentVisibilityIdsByAgentId = new Map();
const pendingStartedSubagentsByToolCallId = new Map();
let pendingSubagentSelectionHint = null;
let activeSettings = { ...DEFAULT_SETTINGS };
const rootRuntimeState = createHydratedRootRuntimeState();

function normalizeSettings(settings) {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        return { ...DEFAULT_SETTINGS, windowSizeUnits: "physical" };
    }

    const nextSettings = { ...DEFAULT_SETTINGS, ...settings };
    if (settings.engine === 'sam') {
        nextSettings.engine = 'c64';
    } else if (settings.engine === 'ms_sam') {
        nextSettings.engine = 'webspeech';
    }
    if (!settings.c64Voice && settings.samVoice) {
        nextSettings.c64Voice = settings.samVoice;
    }
    if (!settings.voice && settings.msSamVoice && settings.msSamVoice !== '__auto__') {
        nextSettings.voice = settings.msSamVoice;
    }
    delete nextSettings.msSamVoice;
    delete nextSettings.samVoice;
    nextSettings.c64Voice = typeof nextSettings.c64Voice === "string" && nextSettings.c64Voice.trim()
        ? nextSettings.c64Voice.trim()
        : DEFAULT_SETTINGS.c64Voice;
    nextSettings.c64Speed = normalizeIntegerSetting(nextSettings.c64Speed, DEFAULT_SETTINGS.c64Speed, 20, 255);
    nextSettings.c64Pitch = normalizeIntegerSetting(nextSettings.c64Pitch, DEFAULT_SETTINGS.c64Pitch, 0, 255);
    nextSettings.c64Throat = normalizeIntegerSetting(nextSettings.c64Throat, DEFAULT_SETTINGS.c64Throat, 0, 255);
    nextSettings.c64Mouth = normalizeIntegerSetting(nextSettings.c64Mouth, DEFAULT_SETTINGS.c64Mouth, 0, 255);
    nextSettings.windowWidth = normalizeWindowDimension(nextSettings.windowWidth, DEFAULT_SETTINGS.windowWidth, 320, 4096);
    nextSettings.windowHeight = normalizeWindowDimension(nextSettings.windowHeight, DEFAULT_SETTINGS.windowHeight, 360, 3072);
    nextSettings.windowSizeUnits = settings.windowSizeUnits === "physical" ? "physical" : "";
    return nextSettings;
}

function normalizeIntegerSetting(value, fallback, min, max) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
        return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(numericValue)));
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
        activeSettings = normalizeSettings(JSON.parse(await readFile(settingsPath, "utf-8")));
    } catch {
        activeSettings = { ...DEFAULT_SETTINGS };
    }
    return { ...activeSettings };
}

function applySettingsToWebview(settings) {
    webview.width = settings.windowWidth;
    webview.height = settings.windowHeight;
    webview.transparent = settings.transparentWindow;
    webview.alwaysOnTop = shouldKeepAvatarAlwaysOnTop(settings);
}

function shouldUseClippySummaryFeedback(settings = activeSettings) {
    return settings?.avatarStyle === "clippy";
}

async function saveSettings(settings) {
    const currentSettings = await loadSettings();
    const nextSettings = normalizeSettings({ ...currentSettings, ...settings });
    activeSettings = nextSettings;
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
        const events = await session.getMessages().catch(() => []);
        const liveSubagentSnapshot = captureLiveSubagentRuntimeState();
        await syncRootRuntimeState(events);
        await callWindowFunction("clearSubagents", { preserveRoot: true }, 3000);
        await resetSubagentRuntimeState();
        const historyState = await hydrateSubagentRuntimeFromHistory({ replayToWebview: false, events });
        const mergedSubagentState = mergeSubagentRuntimeSnapshots(historyState, liveSubagentSnapshot);
        mergeHydratedSubagentRuntimeState(mergedSubagentState);
        await replayHydratedSubagentsToWebview(mergedSubagentState.activeSubagentsByAgentId);
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

    const refreshId = ++contextRefreshId;
    const nextSquadContext = await loadSquadContext(currentSessionCwd);
    if (refreshId !== contextRefreshId) {
        return;
    }
    squadContext = nextSquadContext;
    await syncVisibleWindowState({ waitForReady: cwdChanged && !!webview._handle });
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
    const liveState = upsertLiveSubagentPayload(agentId, buildSubagentPayload(displayData));
    if (liveState) {
        liveState.model = cleanAgentLabel(model);
    }
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
    const liveState = upsertLiveSubagentPayload(agentId, buildSubagentPayload(displayData));
    if (liveState) {
        liveState.thinking = true;
    }
    await callWindowFunction("setAgentThinking", buildSubagentPayload(displayData), 3000);
}

function getTrackedToolKey(toolName = "", toolCallId = null) {
    return toolCallId || `anonymous:${toolName}`;
}

function getPendingSubagentVisibilityId(toolCallId) {
    return toolCallId ? `pending:${toolCallId}` : null;
}

function isPendingSubagentVisibilityId(agentId) {
    return /^pending:/.test(String(agentId || ""));
}

function getPendingStartedToolCallIdFromVisibilityId(agentId) {
    return isPendingSubagentVisibilityId(agentId) ? String(agentId).slice("pending:".length) : null;
}

function getSubagentVisibilityId({ agentId = null, toolCallId = null, state = null } = {}) {
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const visibleIdsByToolCallId = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;

    if (agentId && runtimeVisibilityIds.has(agentId)) {
        return runtimeVisibilityIds.get(agentId) ?? null;
    }

    if (toolCallId && visibleIdsByToolCallId.has(toolCallId)) {
        return visibleIdsByToolCallId.get(toolCallId) ?? null;
    }

    if (agentId) {
        return agentId;
    }

    return getPendingSubagentVisibilityId(toolCallId);
}

function bindRuntimeSubagentVisibilityId(agentId, toolCallId, state = null) {
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const visibleIdsByToolCallId = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;
    const visibilityId = getSubagentVisibilityId({ agentId, toolCallId, state });

    if (!visibilityId) {
        return null;
    }

    if (toolCallId) {
        visibleIdsByToolCallId.set(toolCallId, visibilityId);
    }

    if (agentId) {
        runtimeVisibilityIds.set(agentId, visibilityId);
    }

    return visibilityId;
}

function releaseRuntimeSubagentVisibilityId(agentId, toolCallId, state = null) {
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const visibleIdsByToolCallId = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;
    let visibilityId = null;

    if (toolCallId && visibleIdsByToolCallId.has(toolCallId)) {
        visibilityId = visibleIdsByToolCallId.get(toolCallId) ?? null;
        visibleIdsByToolCallId.delete(toolCallId);
    }

    if (agentId && runtimeVisibilityIds.has(agentId)) {
        visibilityId = visibilityId || (runtimeVisibilityIds.get(agentId) ?? null);
        runtimeVisibilityIds.delete(agentId);
    }

    if (!visibilityId) {
        return;
    }

    for (const [runtimeAgentId, mappedVisibilityId] of [...runtimeVisibilityIds.entries()]) {
        if (mappedVisibilityId === visibilityId) {
            runtimeVisibilityIds.delete(runtimeAgentId);
        }
    }
}

function collectSubagentToolCallIds(agentId, state = null) {
    const visibleIdsByToolCallId = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;
    const pendingStarted = state?.pendingStartedSubagentsByToolCallId ?? pendingStartedSubagentsByToolCallId;
    const toolCallIds = new Set();

    const pendingStartedToolCallId = getPendingStartedToolCallIdFromVisibilityId(agentId);
    if (pendingStartedToolCallId) {
        toolCallIds.add(pendingStartedToolCallId);
    }

    for (const [toolCallId, visibilityId] of visibleIdsByToolCallId.entries()) {
        if (visibilityId === agentId) {
            toolCallIds.add(toolCallId);
        }
    }

    for (const [toolCallId, pendingStartedEntry] of pendingStarted.entries()) {
        if (pendingStartedEntry?.visibilityId === agentId) {
            toolCallIds.add(toolCallId);
        }
    }

    return toolCallIds;
}

function releaseSubagentIdentityState(agentId, state = null) {
    if (!agentId) {
        return;
    }

    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const visibleIdsByToolCallId = state?.subagentIdsByToolCallId ?? subagentIdsByToolCallId;
    const toolAgentIds = state?.toolAgentIdsByToolCallId ?? toolAgentIdsByToolCallId;
    const backgroundMetadata = state?.backgroundAgentMetadataByAgentId ?? backgroundAgentMetadataByAgentId;
    const spawnMetadataByToolCallId = state?.subagentSpawnMetadataByToolCallId ?? subagentSpawnMetadataByToolCallId;
    const spawnMetadataByAgentId = state?.subagentSpawnMetadataByAgentId ?? subagentSpawnMetadataByAgentId;
    const pendingStarted = state?.pendingStartedSubagentsByToolCallId ?? pendingStartedSubagentsByToolCallId;
    const runtimeAgentIds = new Set([agentId]);
    const toolCallIds = collectSubagentToolCallIds(agentId, state);

    for (const [runtimeAgentId, visibilityId] of [...runtimeVisibilityIds.entries()]) {
        if (runtimeAgentId === agentId || visibilityId === agentId) {
            runtimeAgentIds.add(runtimeAgentId);
            runtimeVisibilityIds.delete(runtimeAgentId);
        }
    }

    for (const [toolCallId, resolvedAgentId] of [...toolAgentIds.entries()]) {
        if (toolCallIds.has(toolCallId) || runtimeAgentIds.has(resolvedAgentId) || resolvedAgentId === agentId) {
            toolCallIds.add(toolCallId);
            toolAgentIds.delete(toolCallId);
        }
    }

    for (const [toolCallId, visibilityId] of [...visibleIdsByToolCallId.entries()]) {
        if (toolCallIds.has(toolCallId) || visibilityId === agentId) {
            toolCallIds.add(toolCallId);
            visibleIdsByToolCallId.delete(toolCallId);
        }
    }

    for (const toolCallId of toolCallIds) {
        spawnMetadataByToolCallId.delete(toolCallId);
        pendingStarted.delete(toolCallId);
        if (!state) {
            pendingModelsByToolCallId.delete(toolCallId);
            pendingThinkingByToolCallId.delete(toolCallId);
        }
    }

    spawnMetadataByAgentId.delete(agentId);
    backgroundMetadata.delete(agentId);
    if (!state) {
        liveBackgroundAgentIds.delete(agentId);
    }
}

function rememberPendingStartedSubagent(displayData, extra = {}, state = null) {
    const pendingStarted = state?.pendingStartedSubagentsByToolCallId ?? pendingStartedSubagentsByToolCallId;
    if (!displayData?.toolCallId || !isPendingSubagentVisibilityId(displayData.agentId)) {
        return;
    }

    const payload = buildSubagentPayload(displayData, extra);
    if (shouldSuppressVisibleSubagentPayload(payload)) {
        return;
    }

    pendingStarted.set(displayData.toolCallId, {
        toolCallId: displayData.toolCallId,
        visibilityId: displayData.agentId,
        payload,
        model: cleanAgentLabel(extra.model),
    });
}

function releasePendingStartedSubagent(toolCallId, state = null) {
    const pendingStarted = state?.pendingStartedSubagentsByToolCallId ?? pendingStartedSubagentsByToolCallId;
    if (toolCallId) {
        pendingStarted.delete(toolCallId);
    }
}

function extractBackgroundAgentDisplayName(description) {
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

function normalizeBackgroundAgentMetadata(agent = {}) {
    const runtimeAgentId = cleanAgentLabel(agent?.agentId ?? agent?.id);
    if (!runtimeAgentId) {
        return null;
    }

    const description = sanitizeSubagentMetadataText(
        agent?.workDescription
        ?? agent?.taskSummary
        ?? agent?.detailText
        ?? agent?.description
    );
    const descriptionDisplayName = extractBackgroundAgentDisplayName(description);
    const runtimeAgentName = cleanAgentLabel(agent?.agentName ?? agent?.name);
    const fallbackRuntimeLabel = isOpaqueSubagentHandle(runtimeAgentId)
        ? ""
        : (humanizeAgentName(runtimeAgentId) || runtimeAgentId);
    const runtimeDisplayName = pickPreferredAgentLabel([
        cleanAgentLabel(agent?.agentDisplayName),
        cleanAgentLabel(agent?.displayName),
        descriptionDisplayName,
        runtimeAgentName,
        fallbackRuntimeLabel,
    ], runtimeAgentId);
    const taskSummary = sanitizeSubagentMetadataText(agent?.taskSummary ?? agent?.detailText ?? description);

    return {
        agentId: runtimeAgentId,
        agentName: pickPreferredAgentLabel([
            runtimeAgentName,
            descriptionDisplayName,
            runtimeDisplayName,
            fallbackRuntimeLabel,
        ], runtimeAgentId),
        displayName: runtimeDisplayName,
        description,
        taskSummary,
    };
}

function collectStableSubagentIdentityKeys(values = []) {
    const candidates = new Set();

    for (const value of values) {
        const cleanedValue = cleanAgentLabel(value);
        if (!cleanedValue) {
            continue;
        }

        const extractedDisplayName = extractSpawnDisplayName(cleanedValue);
        for (const candidate of [cleanedValue, extractedDisplayName]) {
            const normalizedValue = normalizeAgentLabel(candidate);
            if (normalizedValue) {
                candidates.add(normalizedValue);
            }
        }
    }

    return candidates;
}

function getPendingStartedSubagentIdentityKeys(entry = {}) {
    const payload = entry?.payload ?? {};
    return collectStableSubagentIdentityKeys([
        payload.displayName,
        payload.agentName,
        extractSpawnDisplayName(payload.description),
        extractSpawnDisplayName(payload.taskSummary),
        extractSpawnDisplayName(payload.detailText),
    ]);
}

function getBackgroundAgentIdentityKeys(agent = {}) {
    return collectStableSubagentIdentityKeys([
        isStableLookupAgentId(agent.agentId) ? agent.agentId : "",
        agent.displayName,
        agent.agentName,
        extractBackgroundAgentDisplayName(agent.description),
    ]);
}

function pendingStartedSubagentMatchesBackgroundAgent(entry, agent) {
    const pendingKeys = getPendingStartedSubagentIdentityKeys(entry);
    const backgroundKeys = getBackgroundAgentIdentityKeys(agent);
    if (!pendingKeys.size || !backgroundKeys.size) {
        return false;
    }

    for (const pendingKey of pendingKeys) {
        if (backgroundKeys.has(pendingKey)) {
            return true;
        }
    }

    return false;
}

function getBackgroundAgentsFromSessionIdle(event) {
    const backgroundAgents = event?.data?.backgroundTasks?.agents;
    if (!Array.isArray(backgroundAgents)) {
        return [];
    }

    return backgroundAgents
        .map((agent) => normalizeBackgroundAgentMetadata(agent))
        .filter(Boolean);
}

function cacheBackgroundAgentMetadata(agent, state = null) {
    const backgroundMetadata = state?.backgroundAgentMetadataByAgentId ?? backgroundAgentMetadataByAgentId;
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    if (!agent?.agentId) {
        return null;
    }

    const visibilityId = runtimeVisibilityIds.get(agent.agentId) ?? agent.agentId;
    const existing = backgroundMetadata.get(visibilityId) ?? {};
    const nextMetadata = {
        agentId: visibilityId,
        runtimeAgentId: agent.agentId,
        agentName: pickPreferredAgentLabel([
            agent.agentName,
            existing.agentName,
            humanizeAgentName(agent.agentId),
            agent.agentId,
        ], visibilityId),
        displayName: pickPreferredAgentLabel([
            agent.displayName,
            agent.agentName,
            existing.displayName,
            existing.agentName,
            humanizeAgentName(agent.agentId),
            agent.agentId,
        ], visibilityId),
        description: cleanAgentLabel(agent.description || existing.description),
        taskSummary: cleanAgentLabel(agent.taskSummary || existing.taskSummary || agent.description),
    };
    backgroundMetadata.set(visibilityId, nextMetadata);
    return nextMetadata;
}

function getBackgroundAgentMetadata(agentId, state = null) {
    const backgroundMetadata = state?.backgroundAgentMetadataByAgentId ?? backgroundAgentMetadataByAgentId;
    if (!agentId || !backgroundMetadata.has(agentId)) {
        return null;
    }
    return backgroundMetadata.get(agentId);
}

function bindPendingStartedSubagentsToBackgroundAgents(backgroundAgents, state = null) {
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const pendingStarted = state?.pendingStartedSubagentsByToolCallId ?? pendingStartedSubagentsByToolCallId;
    if (!pendingStarted.size || !Array.isArray(backgroundAgents) || !backgroundAgents.length) {
        return;
    }

    const unmatchedBackgroundAgents = backgroundAgents.filter((agent) => !runtimeVisibilityIds.has(agent.agentId));
    if (!unmatchedBackgroundAgents.length) {
        return;
    }

    const pendingEntries = [...pendingStarted.values()];
    const claimedToolCallIds = new Set();
    const claimedBackgroundIds = new Set();
    const matchingBackgroundIdsByToolCallId = new Map();
    const matchingToolCallIdsByBackgroundId = new Map();

    for (const entry of pendingEntries) {
        const matchingBackgroundIds = unmatchedBackgroundAgents
            .filter((agent) => pendingStartedSubagentMatchesBackgroundAgent(entry, agent))
            .map((agent) => agent.agentId);
        matchingBackgroundIdsByToolCallId.set(entry.toolCallId, matchingBackgroundIds);

        for (const backgroundAgentId of matchingBackgroundIds) {
            const matchingToolCallIds = matchingToolCallIdsByBackgroundId.get(backgroundAgentId) ?? [];
            matchingToolCallIds.push(entry.toolCallId);
            matchingToolCallIdsByBackgroundId.set(backgroundAgentId, matchingToolCallIds);
        }
    }

    for (const entry of pendingEntries) {
        const matchingBackgroundIds = matchingBackgroundIdsByToolCallId.get(entry.toolCallId) ?? [];
        if (matchingBackgroundIds.length !== 1) {
            continue;
        }

        const backgroundAgentId = matchingBackgroundIds[0];
        if (claimedBackgroundIds.has(backgroundAgentId) || claimedToolCallIds.has(entry.toolCallId)) {
            continue;
        }
        if ((matchingToolCallIdsByBackgroundId.get(backgroundAgentId) ?? []).length !== 1) {
            continue;
        }

        bindRuntimeSubagentVisibilityId(backgroundAgentId, entry.toolCallId, state);
        releasePendingStartedSubagent(entry.toolCallId, state);
        claimedToolCallIds.add(entry.toolCallId);
        claimedBackgroundIds.add(backgroundAgentId);
    }

    const remainingPendingEntries = pendingEntries.filter((entry) => !claimedToolCallIds.has(entry.toolCallId));
    const remainingBackgroundAgents = unmatchedBackgroundAgents.filter((agent) => !claimedBackgroundIds.has(agent.agentId));
    if (remainingPendingEntries.length !== 1 || remainingBackgroundAgents.length !== 1) {
        return;
    }

    bindRuntimeSubagentVisibilityId(remainingBackgroundAgents[0].agentId, remainingPendingEntries[0].toolCallId, state);
    releasePendingStartedSubagent(remainingPendingEntries[0].toolCallId, state);
}

function getBackgroundAgentIdsFromSessionIdle(event, state = null) {
    const agentIds = new Set();

    for (const agent of getBackgroundAgentsFromSessionIdle(event)) {
        const metadata = cacheBackgroundAgentMetadata(agent, state);
        if (metadata?.agentId) {
            agentIds.add(metadata.agentId);
        }
    }

    return agentIds;
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
        renderAuthorized: false,
        payload: null,
        model: "",
        intent: "",
        thinking: false,
        activeTools: new Map(),
        retireTimer: null,
        hadLiveTool: false,
    };
    liveSubagentStatesByAgentId.set(agentId, nextState);
    return nextState;
}

function shouldTrackSubagentToolActivity(toolName) {
    const normalizedToolName = String(toolName || "").trim();
    if (!normalizedToolName) {
        return false;
    }

    if (isSuppressedRuntimeToolName(normalizedToolName)) {
        return false;
    }

    return !SUBAGENT_SPAWN_TOOLS.has(normalizedToolName);
}

function canRenderLiveSubagent(agentId) {
    if (!agentId) {
        return false;
    }

    const state = liveSubagentStatesByAgentId.get(agentId);
    return !!(state?.renderAuthorized || getBackgroundAgentMetadata(agentId));
}

function shouldUseFallbackSubagentRetire(agentId, state = null) {
    if (!agentId || getBackgroundAgentMetadata(agentId, state)) {
        return false;
    }

    return isPendingSubagentVisibilityId(agentId);
}

function cloneActiveToolMap(activeTools = null) {
    return new Map(
        [...(activeTools ?? new Map()).entries()].map(([toolKey, toolState]) => [
            toolKey,
            {
                toolName: toolState?.toolName ?? "",
                toolCallId: toolState?.toolCallId ?? null,
            },
        ])
    );
}

function upsertLiveSubagentPayload(agentId, payload = null, { authorize = false } = {}) {
    const state = ensureLiveSubagentState(agentId);
    if (!state) {
        return null;
    }

    if (authorize) {
        state.renderAuthorized = true;
    }

    if (!state.renderAuthorized && !getBackgroundAgentMetadata(agentId)) {
        return null;
    }

    if (payload) {
        state.payload = {
            ...(state.payload || {}),
            ...payload,
        };
    }
    return state;
}

function cloneHydratedActiveSubagentState(activeState = null) {
    if (!activeState?.payload?.agentId) {
        return null;
    }

    return {
        payload: { ...activeState.payload },
        model: cleanAgentLabel(activeState.model),
        intent: cleanAgentLabel(activeState.intent),
        thinking: !!activeState.thinking,
        activeTools: cloneActiveToolMap(activeState.activeTools),
        hadLiveTool: !!activeState.hadLiveTool,
        waitingForRetire: !!activeState.waitingForRetire,
    };
}

function cloneHydratedSubagentRuntimeState(state = null) {
    const source = state || createHydratedSubagentRuntimeState();
    const clonedState = createHydratedSubagentRuntimeState();
    clonedState.subagentIdsByToolCallId = new Map(source.subagentIdsByToolCallId ?? new Map());
    clonedState.toolAgentIdsByToolCallId = new Map(source.toolAgentIdsByToolCallId ?? new Map());
    clonedState.subagentSpawnMetadataByToolCallId = new Map(
        [...(source.subagentSpawnMetadataByToolCallId ?? new Map()).entries()].map(([toolCallId, metadata]) => [toolCallId, metadata ? { ...metadata } : metadata])
    );
    clonedState.subagentSpawnMetadataByAgentId = new Map(
        [...(source.subagentSpawnMetadataByAgentId ?? new Map()).entries()].map(([agentId, metadata]) => [agentId, metadata ? { ...metadata } : metadata])
    );
    clonedState.subagentSelectedHintsByAgentId = new Map(
        [...(source.subagentSelectedHintsByAgentId ?? new Map()).entries()].map(([agentId, hint]) => [agentId, hint ? { ...hint } : hint])
    );
    clonedState.backgroundAgentMetadataByAgentId = new Map(
        [...(source.backgroundAgentMetadataByAgentId ?? new Map()).entries()].map(([agentId, metadata]) => [agentId, metadata ? { ...metadata } : metadata])
    );
    clonedState.runtimeSubagentVisibilityIdsByAgentId = new Map(source.runtimeSubagentVisibilityIdsByAgentId ?? new Map());
    clonedState.pendingStartedSubagentsByToolCallId = new Map(
        [...(source.pendingStartedSubagentsByToolCallId ?? new Map()).entries()].map(([toolCallId, pendingStarted]) => [toolCallId, pendingStarted ? {
            ...pendingStarted,
            payload: pendingStarted.payload ? { ...pendingStarted.payload } : pendingStarted.payload,
        } : pendingStarted])
    );
    clonedState.pendingSubagentSelectionHint = source.pendingSubagentSelectionHint ? { ...source.pendingSubagentSelectionHint } : null;
    clonedState.activeSubagentsByAgentId = new Map(
        [...(source.activeSubagentsByAgentId ?? new Map()).entries()]
            .map(([agentId, activeState]) => [agentId, cloneHydratedActiveSubagentState(activeState)])
            .filter(([, activeState]) => !!activeState)
    );
    return clonedState;
}

function captureLiveSubagentRuntimeState() {
    const snapshot = createHydratedSubagentRuntimeState();
    snapshot.subagentIdsByToolCallId = new Map(subagentIdsByToolCallId);
    snapshot.toolAgentIdsByToolCallId = new Map(toolAgentIdsByToolCallId);
    snapshot.subagentSpawnMetadataByToolCallId = new Map(
        [...subagentSpawnMetadataByToolCallId.entries()].map(([toolCallId, metadata]) => [toolCallId, metadata ? { ...metadata } : metadata])
    );
    snapshot.subagentSpawnMetadataByAgentId = new Map(
        [...subagentSpawnMetadataByAgentId.entries()].map(([agentId, metadata]) => [agentId, metadata ? { ...metadata } : metadata])
    );
    snapshot.subagentSelectedHintsByAgentId = new Map(
        [...subagentSelectedHintsByAgentId.entries()].map(([agentId, hint]) => [agentId, hint ? { ...hint } : hint])
    );
    snapshot.backgroundAgentMetadataByAgentId = new Map(
        [...backgroundAgentMetadataByAgentId.entries()].map(([agentId, metadata]) => [agentId, metadata ? { ...metadata } : metadata])
    );
    snapshot.runtimeSubagentVisibilityIdsByAgentId = new Map(runtimeSubagentVisibilityIdsByAgentId);
    snapshot.pendingStartedSubagentsByToolCallId = new Map(
        [...pendingStartedSubagentsByToolCallId.entries()].map(([toolCallId, pendingStarted]) => [toolCallId, pendingStarted ? {
            ...pendingStarted,
            payload: pendingStarted.payload ? { ...pendingStarted.payload } : pendingStarted.payload,
        } : pendingStarted])
    );
    snapshot.pendingSubagentSelectionHint = pendingSubagentSelectionHint ? { ...pendingSubagentSelectionHint } : null;

    for (const [agentId, liveState] of liveSubagentStatesByAgentId.entries()) {
        const backgroundMetadata = getBackgroundAgentMetadata(agentId);
        if (!liveState?.renderAuthorized && !backgroundMetadata) {
            continue;
        }
        const payload = liveState?.payload ? { ...liveState.payload } : buildBackgroundSubagentPayload(agentId);
        if (!payload?.agentId || shouldSuppressVisibleSubagentPayload(payload)) {
            continue;
        }
        snapshot.activeSubagentsByAgentId.set(agentId, {
            payload,
            model: cleanAgentLabel(liveState?.model),
            intent: cleanAgentLabel(liveState?.intent),
            thinking: !!liveState?.thinking,
            activeTools: cloneActiveToolMap(liveState?.activeTools),
            hadLiveTool: !!liveState?.hadLiveTool,
            waitingForRetire: false,
        });
    }

    return snapshot;
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
        if (shouldUseFallbackSubagentRetire(agentId) && !state.retireTimer) {
            scheduleFallbackSubagentRetire(agentId);
        } else {
            cancelLiveSubagentRetire(agentId);
        }
        return;
    }

    cancelLiveSubagentRetire(agentId);
}

function trackLiveSubagentTool(agentId, payload = {}) {
    if (!agentId || !shouldTrackSubagentToolActivity(payload.toolName)) {
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

async function reconcileLiveBackgroundSubagents(backgroundAgentIds) {
    if (!(backgroundAgentIds instanceof Set)) {
        return;
    }

    liveBackgroundAgentIds.clear();
    for (const agentId of backgroundAgentIds) {
        liveBackgroundAgentIds.add(agentId);
    }

    for (const agentId of backgroundAgentIds) {
        const payload = buildBackgroundSubagentPayload(agentId);
        if (!payload) {
            continue;
        }

        upsertLiveSubagentPayload(agentId, payload, { authorize: true });
        cancelLiveSubagentRetire(agentId);
        await callWindowFunction("addSubagent", payload, 3000);
    }

    for (const [agentId, state] of [...liveSubagentStatesByAgentId.entries()]) {
        if (backgroundAgentIds.has(agentId)) {
            cancelLiveSubagentRetire(agentId);
            continue;
        }

        if (state?.activeTools?.size) {
            continue;
        }

        cancelLiveSubagentRetire(agentId);
        liveSubagentStatesByAgentId.delete(agentId);
        releaseSubagentIdentityState(agentId);
        await callWindowFunction("removeSubagent", { agentId }, 3000);
    }
}

function scheduleFallbackSubagentRetire(agentId) {
    if (!shouldUseFallbackSubagentRetire(agentId)) {
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
        if (liveBackgroundAgentIds.has(agentId)) {
            currentState.retireTimer = null;
            return;
        }

        currentState.retireTimer = null;
        liveSubagentStatesByAgentId.delete(agentId);
        releaseSubagentIdentityState(agentId);
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
    backgroundAgentMetadataByAgentId.clear();
    liveBackgroundAgentIds.clear();
    runtimeSubagentVisibilityIdsByAgentId.clear();
    pendingStartedSubagentsByToolCallId.clear();
    pendingSubagentSelectionHint = null;

    if (clearUi) {
        await callWindowFunction("clearSubagents", { preserveRoot: true }, 3000);
    }
}

function createHydratedRootRuntimeState() {
    return {
        working: false,
        model: "",
        intent: "",
        subtaskText: "",
        thinking: false,
        activeTools: new Map(),
    };
}

function cloneHydratedRootRuntimeState(state = null) {
    const source = state || createHydratedRootRuntimeState();
    return {
        working: !!source.working,
        model: cleanAgentLabel(source.model),
        intent: cleanAgentLabel(source.intent),
        subtaskText: cleanAgentLabel(source.subtaskText),
        thinking: !!source.thinking,
        activeTools: new Map(
            [...(source.activeTools ?? new Map()).entries()].map(([toolKey, toolState]) => [
                toolKey,
                {
                    toolName: cleanAgentLabel(toolState?.toolName),
                    toolCallId: toolState?.toolCallId ?? null,
                },
            ])
        ),
    };
}

function rootRuntimeStateHasActivity(state = null) {
    return !!(
        state?.working
        || state?.thinking
        || state?.intent
        || state?.subtaskText
        || state?.activeTools?.size
    );
}

function trackHydratedRootTool(state, payload = {}) {
    if (!state || !payload.toolName || !shouldMirrorRootToolActivity(payload.toolName)) {
        return;
    }

    const toolCallId = payload.toolCallId ?? null;
    const trackedKey = getTrackedToolKey(payload.toolName, toolCallId);
    state.activeTools.set(trackedKey, {
        toolName: payload.toolName,
        toolCallId,
    });
}

function clearHydratedRootTool(state, payload = {}) {
    if (!state?.activeTools?.size) {
        return;
    }

    const trackedKey = getTrackedToolKey(payload.toolName ?? "", payload.toolCallId ?? null);
    if (payload.toolCallId && state.activeTools.has(trackedKey)) {
        state.activeTools.delete(trackedKey);
        return;
    }

    const toolName = String(payload.toolName || "").trim();
    const anonymousKey = toolName ? getTrackedToolKey(toolName, null) : "";
    for (const [key, value] of state.activeTools.entries()) {
        if ((toolName && value.toolName === toolName) || key === anonymousKey) {
            state.activeTools.delete(key);
        }
    }
}

function normalizeRootSubtaskText(text) {
    return shouldSuppressRootChromeText(text) ? "" : cleanAgentLabel(text);
}

function normalizeRootChromeText(value) {
    return cleanAgentLabel(value)
        .replace(/^[•●▪◦]+\s*/u, "")
        .replace(/[^\p{L}\p{N}]+/gu, " ")
        .trim()
        .toLowerCase();
}

function shouldSuppressRootChromeText(value) {
    const normalized = normalizeRootChromeText(value);
    return !!normalized && SUPPRESSED_ROOT_CHROME_TEXT.has(normalized);
}

function captureLiveRootRuntimeState(state = rootRuntimeState) {
    return cloneHydratedRootRuntimeState(state);
}

function mergeRootRuntimeStates(historyState = null, liveState = rootRuntimeState) {
    const hydratedState = cloneHydratedRootRuntimeState(historyState);
    const currentLiveState = captureLiveRootRuntimeState(liveState);
    const preferredState = rootRuntimeStateHasActivity(currentLiveState) ? currentLiveState : hydratedState;
    const mergedState = cloneHydratedRootRuntimeState(preferredState);
    if (!mergedState.model) {
        mergedState.model = currentLiveState.model || hydratedState.model;
    }
    return mergedState;
}

async function replayHydratedRootRuntimeState(state) {
    if (!webview._handle || !state) {
        return;
    }

    await callWindowFunction("resetRootActivity", { clearIntent: true }, 3000);
    if (state.model) {
        await callWindowFunction("setAgentModel", {
            agentId: null,
            model: state.model,
        }, 3000);
    }

    if (!state.working) {
        return;
    }

    await callWindowFunction("setWorking", true, 3000);
    for (const activeTool of state.activeTools.values()) {
        await callWindowFunction("setAgentActivity", {
            agentId: null,
            toolName: activeTool.toolName,
            toolCallId: activeTool.toolCallId,
        }, 3000);
    }
    if (state.thinking) {
        await callWindowFunction("setAgentThinking", null, 3000);
    }
    if (state.intent) {
        await callWindowFunction("setAgentIntent", {
            agentId: null,
            intent: state.intent,
        }, 3000);
    }
    if (state.subtaskText) {
        await callWindowFunction("setSubtask", state.subtaskText, 3000);
    }
}

async function buildRootRuntimeStateFromHistory(events = null) {
    const historyEvents = Array.isArray(events) ? events : await session.getMessages().catch(() => []);
    if (!Array.isArray(historyEvents) || historyEvents.length === 0) {
        return null;
    }

    const rootState = createHydratedRootRuntimeState();
    for (const event of historyEvents) {
        if (event?.agentId) {
            continue;
        }

        switch (event?.type) {
            case "session.start": {
                if (event.data?.selectedModel) {
                    rootState.model = event.data.selectedModel;
                }
                break;
            }
            case "assistant.turn_start": {
                rootState.working = true;
                rootState.intent = "";
                rootState.subtaskText = "";
                rootState.thinking = false;
                rootState.activeTools.clear();
                break;
            }
            case "assistant.turn_end": {
                rootState.working = false;
                rootState.intent = "";
                rootState.subtaskText = "";
                rootState.thinking = false;
                rootState.activeTools.clear();
                break;
            }
            case "tool.execution_start": {
                const toolName = event.data?.toolName ?? "";
                trackHydratedRootTool(rootState, {
                    toolName,
                    toolCallId: getEventToolCallId(event),
                });
                if (shouldMirrorRootToolActivity(toolName)) {
                    rootState.subtaskText = normalizeRootSubtaskText(getToolLabel(toolName));
                }
                break;
            }
            case "tool.execution_complete": {
                clearHydratedRootTool(rootState, {
                    toolName: event.data?.toolName ?? "",
                    toolCallId: getEventToolCallId(event),
                });
                break;
            }
            case "assistant.reasoning": {
                rootState.thinking = true;
                break;
            }
            case "assistant.intent": {
                const intent = getIntentText(event);
                if (intent) {
                    rootState.intent = intent;
                    rootState.subtaskText = normalizeRootSubtaskText(intent);
                }
                break;
            }
            case "assistant.usage": {
                if (event.data?.model) {
                    rootState.model = event.data.model;
                }
                break;
            }
            case "session.model_change": {
                if (event.data?.newModel) {
                    rootState.model = event.data.newModel;
                }
                break;
            }
            default:
                break;
        }
    }

    return rootState;
}

async function replayRootRuntimeFromHistory(events = null) {
    const rootState = await buildRootRuntimeStateFromHistory(events);
    if (!rootState) {
        await callWindowFunction("resetRootActivity", { clearIntent: true }, 3000);
        return null;
    }
    await replayHydratedRootRuntimeState(rootState);
    return rootState;
}

async function syncRootRuntimeState(events = null) {
    const historyState = await buildRootRuntimeStateFromHistory(events);
    const mergedState = mergeRootRuntimeStates(historyState, rootRuntimeState);
    await replayHydratedRootRuntimeState(mergedState);
    return mergedState;
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
    const runtimeVisibilityIds = state?.runtimeSubagentVisibilityIdsByAgentId ?? runtimeSubagentVisibilityIdsByAgentId;
    const toolCallId = getEventToolCallId(event);
    const parentToolCallId = event.data?.parentToolCallId ?? null;

    if (event.agentId) {
        if (runtimeVisibilityIds.has(event.agentId)) {
            return runtimeVisibilityIds.get(event.agentId) ?? null;
        }

        const correlatedToolCallId = parentToolCallId || toolCallId;
        if (correlatedToolCallId && subagentIds.has(correlatedToolCallId)) {
            const visibilityId = subagentIds.get(correlatedToolCallId) ?? null;
            if (visibilityId) {
                runtimeVisibilityIds.set(event.agentId, visibilityId);
                return visibilityId;
            }
        }

        return event.agentId;
    }

    if (toolCallId && toolAgentIds.has(toolCallId)) {
        return toolAgentIds.get(toolCallId) ?? null;
    }

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

function normalizeRuntimeToolToken(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isSuppressedRuntimeToolName(toolName) {
    const normalizedToolName = String(toolName || "").trim();
    return !!normalizedToolName
        && (SUPPRESSED_ROOT_RUNTIME_TOOLS.has(normalizedToolName) || normalizedToolName.startsWith("copilot_avatar_"));
}

function isSuppressedRuntimeToolText(value) {
    const normalizedText = normalizeRuntimeToolToken(
        cleanAgentLabel(value).replace(/^[•●▪◦]+\s*/u, "")
    );
    if (!normalizedText) {
        return false;
    }

    const withoutUsing = normalizedText.startsWith("using ")
        ? normalizedText.slice("using ".length).trim()
        : normalizedText;
    if (!withoutUsing) {
        return false;
    }

    if (withoutUsing.startsWith("copilot avatar ")) {
        return true;
    }

    for (const toolName of SUPPRESSED_ROOT_RUNTIME_TOOLS) {
        if (withoutUsing === normalizeRuntimeToolToken(toolName)) {
            return true;
        }
    }

    return false;
}

function sanitizeSubagentMetadataText(value) {
    const cleaned = cleanAgentLabel(value);
    if (!cleaned || isSuppressedRuntimeToolText(cleaned)) {
        return "";
    }
    return cleaned;
}

function shouldMirrorRootToolActivity(toolName) {
    const normalizedToolName = String(toolName || "").trim();
    if (!normalizedToolName) {
        return false;
    }
    if (isSuppressedRuntimeToolName(normalizedToolName)) {
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

function isOpaqueSubagentHandle(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    return /^call[_-][a-z0-9]+/.test(normalized)
        || /^agent[-_]?call\b/.test(normalized)
        || /^subagent[-_]/.test(normalized)
        || /^pending:/.test(normalized);
}

function isStableLookupAgentId(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized) {
        return false;
    }

    if (isOpaqueSubagentHandle(normalized)) {
        return false;
    }

    return /^[a-z0-9@_-]+$/.test(normalized);
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

    for (const candidate of [runtimeDescription, spawnMetadata?.description]) {
        const summary = sanitizeSubagentMetadataText(stripLeadingAgentLabel(candidate, labels));
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

// subagent.selected does not carry a reliable correlation ID (SDK constraint). It must remain a
// weak, short-lived hint only. Identity is locked to an agentId only when subagent.started fires
// with a confirmed agentId. This function must never return true before that point.
function shouldBindPendingSelectionHint({ agentId, runtimeAgentName, runtimeDisplayName, spawnMetadata, state = null }) {
    // Squad agents always have spawnMetadata — never let the selection hint override them.
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

function resolvePreferredSquadAgentMetadata({
    agentId = null,
    runtimeAgentName = "",
    runtimeDisplayName = "",
    spawnMetadata = null,
    selectionHint = null,
}) {
    const runtimeIdentityStrong = [
        runtimeDisplayName,
        runtimeAgentName,
    ].some((value) => {
        const cleaned = cleanAgentLabel(value);
        return cleaned && !isLowConfidenceAgentLabel(cleaned, agentId);
    }) || isStableLookupAgentId(runtimeAgentName) || isStableLookupAgentId(agentId);

    if (runtimeIdentityStrong) {
        const runtimeMatch = resolveSquadAgentMetadata(squadContext, {
            agentId,
            agentName: runtimeAgentName,
            agentDisplayName: runtimeDisplayName,
        });
        if (runtimeMatch) {
            return runtimeMatch;
        }
    }

    if (!cleanAgentLabel(spawnMetadata?.name) && !cleanAgentLabel(spawnMetadata?.displayName)) {
        return null;
    }

    return resolveSquadAgentMetadata(squadContext, {
        agentId,
        agentName: runtimeAgentName,
        agentDisplayName: runtimeDisplayName,
        spawnName: spawnMetadata?.name,
        spawnDisplayName: spawnMetadata?.displayName,
    });
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
    const squadAgent = resolvePreferredSquadAgentMetadata({
        agentId,
        runtimeAgentName,
        runtimeDisplayName,
        spawnMetadata,
        selectionHint,
    });
    const opaqueAgentId = isOpaqueSubagentHandle(agentId);
    const displayName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        runtimeDisplayName,
        runtimeAgentName,
        spawnMetadata?.displayName,
        humanizeAgentName(spawnMetadata?.name),
        selectionHint?.displayName,
        humanizeAgentName(selectionHint?.name),
        selectionHint?.name,
    ], agentId) || runtimeDisplayName || runtimeAgentName || selectionHint?.displayName || selectionHint?.name || (opaqueAgentId ? "" : agentId) || "";
    const agentName = pickPreferredAgentLabel([
        squadAgent?.displayName,
        runtimeAgentName,
        runtimeDisplayName,
        spawnMetadata?.displayName,
        humanizeAgentName(spawnMetadata?.name),
        selectionHint?.displayName,
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
    const description = sanitizeSubagentMetadataText(
        runtimeDescription
        || squadAgent?.description
        || spawnMetadata?.description
        || ""
    );

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
    const toolCallId = getEventCorrelationToolCallId(event);
    const agentId = getSubagentVisibilityId({
        agentId: event.agentId ?? null,
        toolCallId,
        state,
    });
    if (toolCallId) {
        bindRuntimeSubagentVisibilityId(event.agentId ?? null, toolCallId, state);
    }
    const backgroundMetadata = getBackgroundAgentMetadata(agentId, state);
    const runtimeAgentName = pickPreferredAgentLabel([
        cleanAgentLabel(event.data?.agentName),
        cleanAgentLabel(backgroundMetadata?.agentName),
        cleanAgentLabel(backgroundMetadata?.displayName),
        humanizeAgentName(backgroundMetadata?.runtimeAgentId),
        cleanAgentLabel(backgroundMetadata?.runtimeAgentId),
    ], agentId);
    const runtimeDisplayName = pickPreferredAgentLabel([
        cleanAgentLabel(event.data?.agentDisplayName),
        cleanAgentLabel(backgroundMetadata?.displayName),
        cleanAgentLabel(event.data?.agentName),
        cleanAgentLabel(backgroundMetadata?.agentName),
        humanizeAgentName(backgroundMetadata?.runtimeAgentId),
        cleanAgentLabel(backgroundMetadata?.runtimeAgentId),
    ], agentId);
    const runtimeDescription = sanitizeSubagentMetadataText(
        event.data?.agentDescription
        || backgroundMetadata?.description
        || backgroundMetadata?.taskSummary
    );
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
    // Pending hint is used here only for display field resolution (lowest priority in
    // resolveSubagentDisplayFields). It does NOT lock identity — that only happened above
    // inside the shouldBindPendingSelectionHint branch where agentId is confirmed.
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
        description: sanitizeSubagentMetadataText(displayData.description),
        workDescription: sanitizeSubagentMetadataText(displayData.taskSummary),
        taskSummary: sanitizeSubagentMetadataText(displayData.taskSummary),
        detailText: sanitizeSubagentMetadataText(displayData.detailText),
        role: displayData.role,
        isDuck: displayData.isDuck,
        toolCallId: displayData.toolCallId,
        ...extra,
    };
}

function hasStrongSubagentPayloadIdentity(payload = {}) {
    if (!payload?.agentId) {
        return false;
    }

    for (const candidate of [payload.displayName, payload.agentName]) {
        const cleaned = cleanAgentLabel(candidate);
        if (cleaned && !isLowConfidenceAgentLabel(cleaned, payload.agentId)) {
            return true;
        }
    }

    return false;
}

function shouldSuppressVisibleSubagentPayload(payload = {}) {
    if (!payload?.agentId || !isOpaqueSubagentHandle(payload.agentId)) {
        return false;
    }

    if (hasStrongSubagentPayloadIdentity(payload)) {
        return false;
    }

    return ![
        payload.workDescription,
        payload.taskSummary,
        payload.detailText,
        payload.description,
    ].some((value) => sanitizeSubagentMetadataText(value));
}

function buildBackgroundSubagentPayload(agentId, state = null) {
    const metadata = getBackgroundAgentMetadata(agentId, state);
    if (!metadata?.agentId) {
        return null;
    }

    const displayData = resolveSubagentDisplayFields({
        agentId: metadata.agentId,
        runtimeAgentName: cleanAgentLabel(metadata.agentName || metadata.runtimeAgentId || metadata.agentId),
        runtimeDisplayName: cleanAgentLabel(metadata.displayName),
        runtimeDescription: cleanAgentLabel(metadata.description),
        spawnMetadata: getSubagentSpawnMetadata(null, agentId, state),
        selectionHint: getSubagentSelectionHint(agentId, state),
    });

    const payload = buildSubagentPayload({
        ...displayData,
        taskSummary: displayData.taskSummary || metadata.taskSummary || "",
        detailText: displayData.detailText || metadata.taskSummary || "",
    });
    return shouldSuppressVisibleSubagentPayload(payload) ? null : payload;
}

function createHydratedSubagentRuntimeState() {
    return {
        subagentIdsByToolCallId: new Map(),
        toolAgentIdsByToolCallId: new Map(),
        subagentSpawnMetadataByToolCallId: new Map(),
        subagentSpawnMetadataByAgentId: new Map(),
        subagentSelectedHintsByAgentId: new Map(),
        backgroundAgentMetadataByAgentId: new Map(),
        runtimeSubagentVisibilityIdsByAgentId: new Map(),
        pendingStartedSubagentsByToolCallId: new Map(),
        pendingSubagentSelectionHint: null,
        activeSubagentsByAgentId: new Map(),
    };
}

function mergeHydratedActiveSubagentState(targetState, sourceState) {
    if (!sourceState?.payload?.agentId) {
        return targetState;
    }

    const mergedState = targetState || cloneHydratedActiveSubagentState(sourceState);
    if (!mergedState) {
        return null;
    }

    mergedState.payload = {
        ...(mergedState.payload || {}),
        ...(sourceState.payload || {}),
    };
    if (sourceState.model) {
        mergedState.model = sourceState.model;
    }
    if (sourceState.intent) {
        mergedState.intent = sourceState.intent;
    }
    mergedState.thinking = !!sourceState.thinking || !!mergedState.thinking;
    mergedState.hadLiveTool = !!sourceState.hadLiveTool || !!mergedState.hadLiveTool;
    mergedState.waitingForRetire = false;
    for (const [toolKey, toolState] of sourceState.activeTools ?? new Map()) {
        mergedState.activeTools.set(toolKey, {
            toolName: toolState?.toolName ?? "",
            toolCallId: toolState?.toolCallId ?? null,
        });
    }
    return mergedState;
}

function mergeSubagentRuntimeSnapshots(historyState = null, liveSnapshot = null) {
    const mergedState = cloneHydratedSubagentRuntimeState(historyState);
    if (!liveSnapshot) {
        return mergedState;
    }

    for (const [toolCallId, agentId] of liveSnapshot.subagentIdsByToolCallId.entries()) {
        mergedState.subagentIdsByToolCallId.set(toolCallId, agentId);
    }
    for (const [toolCallId, agentId] of liveSnapshot.toolAgentIdsByToolCallId.entries()) {
        mergedState.toolAgentIdsByToolCallId.set(toolCallId, agentId);
    }
    for (const [toolCallId, metadata] of liveSnapshot.subagentSpawnMetadataByToolCallId.entries()) {
        mergedState.subagentSpawnMetadataByToolCallId.set(toolCallId, metadata ? { ...metadata } : metadata);
    }
    for (const [agentId, metadata] of liveSnapshot.subagentSpawnMetadataByAgentId.entries()) {
        mergedState.subagentSpawnMetadataByAgentId.set(agentId, metadata ? { ...metadata } : metadata);
    }
    for (const [agentId, hint] of liveSnapshot.subagentSelectedHintsByAgentId.entries()) {
        mergedState.subagentSelectedHintsByAgentId.set(agentId, hint ? { ...hint } : hint);
    }
    for (const [agentId, metadata] of liveSnapshot.backgroundAgentMetadataByAgentId.entries()) {
        mergedState.backgroundAgentMetadataByAgentId.set(agentId, metadata ? { ...metadata } : metadata);
    }
    for (const [agentId, visibilityId] of liveSnapshot.runtimeSubagentVisibilityIdsByAgentId.entries()) {
        mergedState.runtimeSubagentVisibilityIdsByAgentId.set(agentId, visibilityId);
    }
    for (const [toolCallId, pendingStarted] of liveSnapshot.pendingStartedSubagentsByToolCallId.entries()) {
        mergedState.pendingStartedSubagentsByToolCallId.set(toolCallId, pendingStarted ? {
            ...pendingStarted,
            payload: pendingStarted.payload ? { ...pendingStarted.payload } : pendingStarted.payload,
        } : pendingStarted);
    }
    if (liveSnapshot.pendingSubagentSelectionHint) {
        mergedState.pendingSubagentSelectionHint = { ...liveSnapshot.pendingSubagentSelectionHint };
    }

    for (const [agentId, liveState] of liveSnapshot.activeSubagentsByAgentId.entries()) {
        const existingState = mergedState.activeSubagentsByAgentId.get(agentId) || null;
        const nextState = mergeHydratedActiveSubagentState(existingState, liveState);
        if (nextState) {
            mergedState.activeSubagentsByAgentId.set(agentId, nextState);
        }
    }

    return mergedState;
}

function resetHydratedSubagentRuntimeState(state) {
    state.subagentIdsByToolCallId.clear();
    state.toolAgentIdsByToolCallId.clear();
    state.subagentSpawnMetadataByToolCallId.clear();
    state.subagentSpawnMetadataByAgentId.clear();
    state.subagentSelectedHintsByAgentId.clear();
    state.backgroundAgentMetadataByAgentId.clear();
    state.runtimeSubagentVisibilityIdsByAgentId.clear();
    state.pendingStartedSubagentsByToolCallId.clear();
    state.pendingSubagentSelectionHint = null;
    state.activeSubagentsByAgentId.clear();
}

function upsertHydratedSubagentState(activeSubagentsByAgentId, payload) {
    if (!payload?.agentId || shouldSuppressVisibleSubagentPayload(payload)) {
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
    if (!activeState || !shouldTrackSubagentToolActivity(payload.toolName)) {
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

function reconcileHydratedBackgroundSubagents(state, backgroundAgentIds) {
    if (!(state?.activeSubagentsByAgentId instanceof Map) || !(backgroundAgentIds instanceof Set)) {
        return;
    }

    for (const agentId of backgroundAgentIds) {
        const payload = buildBackgroundSubagentPayload(agentId, state);
        if (!payload) {
            continue;
        }

        const activeState = upsertHydratedSubagentState(state.activeSubagentsByAgentId, payload);
        if (activeState) {
            activeState.waitingForRetire = false;
        }
    }

    for (const [agentId, activeState] of [...state.activeSubagentsByAgentId.entries()]) {
        if (backgroundAgentIds.has(agentId) || activeState?.activeTools?.size) {
            if (activeState) {
                activeState.waitingForRetire = false;
            }
            continue;
        }

        state.activeSubagentsByAgentId.delete(agentId);
        releaseSubagentIdentityState(agentId, state);
    }
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
    for (const [agentId, metadata] of state.backgroundAgentMetadataByAgentId.entries()) {
        backgroundAgentMetadataByAgentId.set(agentId, metadata);
    }
    for (const [agentId, visibilityId] of state.runtimeSubagentVisibilityIdsByAgentId.entries()) {
        runtimeSubagentVisibilityIdsByAgentId.set(agentId, visibilityId);
    }
    for (const [toolCallId, pendingStarted] of state.pendingStartedSubagentsByToolCallId.entries()) {
        pendingStartedSubagentsByToolCallId.set(toolCallId, pendingStarted);
    }
    if (state.pendingSubagentSelectionHint) {
        pendingSubagentSelectionHint = state.pendingSubagentSelectionHint;
    }
    for (const [agentId, hydratedState] of state.activeSubagentsByAgentId.entries()) {
        const liveState = ensureLiveSubagentState(agentId);
        if (!liveState) {
            continue;
        }

        cancelLiveSubagentRetire(agentId);
        liveState.renderAuthorized = true;
        liveState.payload = hydratedState?.payload ? { ...hydratedState.payload } : liveState.payload;
        liveState.model = cleanAgentLabel(hydratedState?.model);
        liveState.intent = cleanAgentLabel(hydratedState?.intent);
        liveState.thinking = !!hydratedState?.thinking;
        liveState.hadLiveTool = !!hydratedState?.hadLiveTool;
        liveState.activeTools = cloneActiveToolMap(hydratedState?.activeTools);
    }
}

async function replayHydratedSubagentsToWebview(activeSubagentsByAgentId) {
    if (!webview._handle || !(activeSubagentsByAgentId instanceof Map) || activeSubagentsByAgentId.size === 0) {
        return;
    }

    for (const activeState of activeSubagentsByAgentId.values()) {
        if (!activeState?.payload?.agentId || shouldSuppressVisibleSubagentPayload(activeState.payload)) {
            continue;
        }
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

async function hydrateSubagentRuntimeFromHistory({ replayToWebview = false, events = null } = {}) {
    const historyEvents = Array.isArray(events) ? events : await session.getMessages().catch(() => []);
    if (!Array.isArray(historyEvents) || historyEvents.length === 0) {
        return null;
    }

    const historyState = createHydratedSubagentRuntimeState();
    for (const event of historyEvents) {
        switch (event?.type) {
            case "assistant.turn_start": {
                if (!event.agentId) {
                    setPendingSubagentSelectionHint(null, historyState);
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
            case "session.idle": {
                bindPendingStartedSubagentsToBackgroundAgents(getBackgroundAgentsFromSessionIdle(event), historyState);
                reconcileHydratedBackgroundSubagents(historyState, getBackgroundAgentIdsFromSessionIdle(event, historyState));
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
                const startedModel = event.data?.model ?? "";
                if (displayData.toolCallId) {
                    bindRuntimeSubagentVisibilityId(event.agentId ?? null, displayData.toolCallId, historyState);
                }
                if (!event.agentId && displayData.toolCallId) {
                    rememberPendingStartedSubagent(displayData, { model: startedModel }, historyState);
                }
                const startedState = upsertHydratedSubagentState(historyState.activeSubagentsByAgentId, buildSubagentPayload(displayData, { model: startedModel }));
                if (startedState && startedModel) {
                    startedState.model = startedModel;
                }
                markHydratedSubagentLive(startedState);
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
                releaseSubagentIdentityState(displayData.agentId, historyState);
                break;
            }
            default:
                break;
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
        rootRuntimeState.model = event.data.selectedModel;
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
    const model = event.data?.model ?? "";
    noteLiveSubagentSignal(displayData.agentId);
    if (toolCallId) {
        bindRuntimeSubagentVisibilityId(event.agentId ?? null, toolCallId);
    }
    if (!event.agentId && toolCallId) {
        rememberPendingStartedSubagent(displayData, { model });
    }

    const livePayload = buildSubagentPayload(displayData, { model });
    if (shouldSuppressVisibleSubagentPayload(livePayload)) {
        return;
    }
    const liveState = upsertLiveSubagentPayload(displayData.agentId, livePayload, { authorize: true });
    if (liveState) {
        liveState.model = cleanAgentLabel(model);
        liveState.intent = "";
        liveState.thinking = false;
    }

    await callWindowFunction("addSubagent", livePayload, 3000);

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
    releaseSubagentIdentityState(displayData.agentId);
});

session.on("subagent.failed", async (event) => {
    const displayData = resolveSubagentDisplayData(event);
    cancelLiveSubagentRetire(displayData.agentId);
    liveSubagentStatesByAgentId.delete(displayData.agentId);
    await callWindowFunction("failSubagent", buildSubagentPayload(displayData, {
        error: event.data?.error ?? "",
    }), 3000);
    releaseSubagentIdentityState(displayData.agentId);
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
        const basePayload = buildSubagentPayload(displayData);
        const displayPayload = buildSubagentPayload(displayData, { toolName });
        if (!shouldSuppressVisibleSubagentPayload(basePayload)) {
            upsertLiveSubagentPayload(agentId, basePayload);
        }
        if (!shouldSuppressVisibleSubagentPayload(displayPayload)
            && canRenderLiveSubagent(agentId)
            && shouldTrackSubagentToolActivity(toolName)) {
            await callWindowFunction("setAgentActivity", displayPayload);
        }
    } else if (shouldMirrorRootToolActivity(toolName)) {
        trackHydratedRootTool(rootRuntimeState, {
            toolName,
            toolCallId: event.data?.toolCallId ?? null,
        });
        await callWindowFunction("setAgentActivity", {
            agentId: null,
            toolName,
            toolCallId: event.data?.toolCallId ?? null,
        });
    }

    if (!agentId && shouldMirrorRootToolActivity(toolName)) {
        const toolLabel = getToolLabel(toolName);
        if (toolLabel) {
            rootRuntimeState.subtaskText = normalizeRootSubtaskText(toolLabel);
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
    if (!agentId) {
        clearHydratedRootTool(rootRuntimeState, {
            toolName: event.data?.toolName ?? "",
            toolCallId,
        });
    }
    if (agentId && !SUBAGENT_SPAWN_TOOLS.has(event.data?.toolName ?? "")) {
        const remainingToolCount = clearLiveSubagentTool(agentId, {
            toolName: event.data?.toolName ?? "",
            toolCallId,
        });
        if (remainingToolCount === 0 && shouldUseFallbackSubagentRetire(agentId)) {
            scheduleFallbackSubagentRetire(agentId);
        }
    }
    if (toolCallId) {
        toolAgentIdsByToolCallId.delete(toolCallId);
    }
    if (toolCallId && subagentIdsByToolCallId.has(toolCallId)) {
        releaseSubagentSpawnMetadata(subagentIdsByToolCallId.get(toolCallId) ?? null, toolCallId);
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
        const liveState = upsertLiveSubagentPayload(agentId, buildSubagentPayload(displayData));
        if (liveState) {
            liveState.thinking = true;
        }
        if (canRenderLiveSubagent(agentId)) {
            await callWindowFunction("setAgentThinking", buildSubagentPayload(displayData), 3000);
        }
        return;
    }

    const pendingToolCallId = getEventCorrelationToolCallId(event);
    if (pendingToolCallId) {
        pendingThinkingByToolCallId.add(pendingToolCallId);
        return;
    }

    rootRuntimeState.thinking = true;
    await callWindowFunction("setAgentThinking", null, 3000);
});

session.on("assistant.usage", async (event) => {
    const model = event.data?.model ?? "";
    if (!model) return;

    const agentId = resolveAgentIdFromEvent(event);
    if (agentId) {
        noteLiveSubagentSignal(agentId, { idleGrace: true });
        const displayData = resolveSubagentDisplayData(withResolvedAgentId(event, agentId));
        const liveState = upsertLiveSubagentPayload(agentId, buildSubagentPayload(displayData));
        if (liveState) {
            liveState.model = cleanAgentLabel(model);
        }
        if (canRenderLiveSubagent(agentId)) {
            await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, { model }), 3000);
        }
        return;
    }

    const pendingToolCallId = getEventCorrelationToolCallId(event);
    if (pendingToolCallId) {
        pendingModelsByToolCallId.set(pendingToolCallId, model);
        return;
    }

    rootRuntimeState.model = model;
    await callWindowFunction("setAgentModel", { agentId: null, model }, 3000);
});

session.on("session.model_change", async (event) => {
    if (!event.data?.newModel) return;
    if (event.agentId) {
        const displayData = resolveSubagentDisplayData(event);
        const liveState = upsertLiveSubagentPayload(displayData.agentId, buildSubagentPayload(displayData));
        if (liveState) {
            liveState.model = cleanAgentLabel(event.data.newModel);
        }
        if (canRenderLiveSubagent(displayData.agentId)) {
            await callWindowFunction("setAgentModel", buildSubagentPayload(displayData, {
                model: event.data.newModel,
            }), 3000);
        }
        return;
    }

    rootRuntimeState.model = event.data.newModel;
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
        const liveState = upsertLiveSubagentPayload(agentId, buildSubagentPayload(displayData));
        if (liveState) {
            liveState.intent = cleanAgentLabel(intent);
        }
        if (canRenderLiveSubagent(agentId)) {
            await callWindowFunction("setAgentIntent", buildSubagentPayload(displayData, { intent }));
        }
    } else {
        rootRuntimeState.intent = intent;
        rootRuntimeState.subtaskText = normalizeRootSubtaskText(intent);
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
    rootRuntimeState.working = true;
    rootRuntimeState.intent = "";
    rootRuntimeState.subtaskText = "";
    rootRuntimeState.thinking = false;
    rootRuntimeState.activeTools.clear();
    setPendingSubagentSelectionHint(null);
    await syncSquadContext();
    await evalWebview("window.setWorking(true)");
});

session.on("assistant.turn_end", async (event) => {
    if (event.agentId) return;
    rootRuntimeState.working = false;
    rootRuntimeState.intent = "";
    rootRuntimeState.subtaskText = "";
    rootRuntimeState.thinking = false;
    rootRuntimeState.activeTools.clear();
    await evalWebview("window.setWorking(false)");
    if (shouldUseClippySummaryFeedback() && rootTurnState.sawMessage && rootTurnState.lastMessage) {
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

session.on("session.idle", async (event) => {
    bindPendingStartedSubagentsToBackgroundAgents(getBackgroundAgentsFromSessionIdle(event));
    await reconcileLiveBackgroundSubagents(getBackgroundAgentIdsFromSessionIdle(event));
});
