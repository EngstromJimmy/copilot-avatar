/**
 * Howard the Duck — Copilot Avatar Regression Probe
 *
 * Coverage:
 *   A. The retro engine keeps value="c64", shows the SAM (Software Automatic Mouth) C64 version label, and legacy sam settings still migrate cleanly
 *   B. The speech path moves onto the external discordier/sam library seam
 *   C. C64 settings expose and persist voice + mouth + pitch + related SAM params
 *   D. Browser-only/no-network behavior for the retro path remains intact
 *   E. Sub-agent visibility/name guardrails hold for both Squad and non-Squad projects
 *   F. Clippy-only summary intros stay off the Copilot speech path
 *   G. Deepgram supplier wiring stays explicit across UI, persistence, and runtime speech routing
 *   H. Copilot SDK API contract: joinSession + getEvents + approveAll handler
 *   I. Real entrypoint coverage: extension.mjs waits for main.mjs and logs startup failures
 *
 * Run: node probe-regression.mjs  (from the extension root)
 *
 * Technique: lightweight source assertions plus a stubbed entrypoint import probe — no browser harness, no framework.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
let pass = 0;
let fail = 0;
const failures = [];

function assert(label, condition, detail = "") {
    if (condition) {
        console.log(`  PASS  ${label}`);
        pass++;
    } else {
        console.error(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
        fail++;
        failures.push(label);
    }
}

function read(rel) {
    return readFileSync(join(ROOT, rel), "utf-8");
}

function sourceWindow(source, anchor, after = 1200, before = 120) {
    const index = source.indexOf(anchor);
    if (index === -1) return "";
    return source.slice(Math.max(0, index - before), index + after);
}

function functionWindow(source, name, length = 2600) {
    const regex = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
    const match = regex.exec(source);
    if (!match) return "";
    return source.slice(match.index, match.index + length);
}

function includesAny(source, patterns) {
    return patterns.some((pattern) => pattern.test(source));
}

function normalizeFsPath(value) {
    const text = String(value || "").trim();
    return text ? resolve(text) : "";
}

function toDataModuleUrl(source) {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(String(source || ""))}`;
}

function replaceExtensionEntryMainImport(source, replacementUrl) {
    return String(source || "").replace(
        /(["'])\.\/main\.mjs\1/,
        JSON.stringify(replacementUrl)
    );
}

async function probeExtensionEntrypoint({ shouldFail = false } = {}) {
    const probeKey = `__copilotAvatarEntryProbe_${shouldFail ? "fail" : "ok"}_${Math.random().toString(16).slice(2)}`;
    globalThis[probeKey] = { loaded: false };

    const mainUrl = shouldFail
        ? toDataModuleUrl(`await Promise.resolve(); throw new Error("probe main load failure");`)
        : toDataModuleUrl(`await Promise.resolve(); globalThis[${JSON.stringify(probeKey)}].loaded = true;`);
    const entrySource = replaceExtensionEntryMainImport(read("extension.mjs"), mainUrl);
    const entryUrl = toDataModuleUrl(entrySource);

    const logs = [];
    const originalConsoleError = console.error;
    let importError = null;
    console.error = (...args) => {
        logs.push(args.map((arg) => String(arg)).join(" "));
    };

    try {
        await import(entryUrl);
        await Promise.resolve();
    } catch (error) {
        importError = error;
    } finally {
        console.error = originalConsoleError;
    }

    const result = {
        importError,
        loaded: globalThis[probeKey]?.loaded === true,
        logs,
    };
    delete globalThis[probeKey];
    return result;
}

// ── 0. Syntax checks ──────────────────────────────────────────────────────────
console.log("\n[0] Syntax checks");

for (const rel of ["main.mjs", "lib/squad-context.mjs", "content/main.js", "probe-regression.mjs"]) {
    try {
        execSync(`node --check "${join(ROOT, rel)}"`, { stdio: "pipe" });
        assert(`node --check ${rel}`, true);
    } catch (error) {
        const message = (error.stderr?.toString() ?? error.message).trim().split("\n")[0];
        assert(`node --check ${rel}`, false, message);
    }
}

// ── Load sources ──────────────────────────────────────────────────────────────
const mainJs = read("content/main.js");
const mainMjs = read("main.mjs");
const extensionMjs = read("extension.mjs");
const copilotWebviewJs = read("lib/copilot-webview.js");
const htmlSrc = read("content/index.html");
const packageJson = read("package.json");
const repoRoot = normalizeFsPath(execSync("git rev-parse --show-toplevel", { cwd: ROOT, encoding: "utf-8" }));
const {
    getSquadWindowContext,
    loadSquadContext,
    resolveSquadAgentMetadata,
} = await import(pathToFileURL(join(ROOT, "lib", "squad-context.mjs")).href);

async function findNonSquadProbeContext(startDir) {
    let current = dirname(startDir || ROOT);
    while (current) {
        const context = await loadSquadContext(current);
        if (!context.active) {
            return { cwd: current, context };
        }
        const parent = dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
    return null;
}

const squadProbeContext = await loadSquadContext(repoRoot);
const nonSquadProbe = await findNonSquadProbeContext(repoRoot);

const legacyBrowserSynthPresent = includesAny(mainJs, [
    /SAM_PHONEME_DATA/,
    /function\s+samG2P\s*\(/,
    /synthesizeSamAudio\s*\(/,
    /formantShift\s*:/,
]);
const samLibraryReferencePresent = includesAny(`${mainJs}\n${mainMjs}\n${htmlSrc}\n${packageJson}`, [
    /discordier\/sam/i,
    /\b["']sam-js["']/,
    /new\s+SamJs\s*\(/,
    /\.\s*buf(?:8|32)\s*\(/,
]);

const defaultSettingsWindow = sourceWindow(mainMjs, "const DEFAULT_SETTINGS", 1400, 0);
const savePayloadWindow = sourceWindow(mainJs, "function saveTtsSettings()", 1600, 0);
const ttsSettingsWindow = sourceWindow(mainJs, "window.getTtsSettings", 900, 0);
const loadSettingsWindow = sourceWindow(mainJs, "let savedTts = {}", 3600, 0);
const c64RestoreWindow = sourceWindow(mainJs, "const initialC64Preset", 500, 40);
const speakWindow = functionWindow(mainJs, "speak", 1200);
const previewWindow = functionWindow(mainJs, "previewCurrentVoice", 1200);
const showMessageWindow = sourceWindow(mainJs, "window.showMessage = (text) => {", 900, 0);
const flushClippySummaryWindow = functionWindow(mainJs, "flushClippySummary", 900);
const turnEndWindow = sourceWindow(mainMjs, 'session.on("assistant.turn_end"', 900, 0);
const startedHandlerWindow = sourceWindow(mainMjs, 'session.on("subagent.started"', 1600, 0);
const c64SectionWindow = sourceWindow(htmlSrc, 'id="tts-c64-section"', 1600, 0);
const deepgramSectionWindow = sourceWindow(htmlSrc, 'id="tts-deepgram-section"', 1200, 0);
const speakC64Window = functionWindow(mainJs, "speakC64", 2800);
const speakDeepgramWindow = functionWindow(mainJs, "speakDeepgram", 3200);
const generateDeepgramSpeechWindow = functionWindow(mainMjs, "generateDeepgramSpeech", 2600);
const ensureAvatarWindow = functionWindow(mainJs, "ensureAvatar", 1400);
const clearSubagentsWindow = sourceWindow(mainJs, "function clearSubagents({ preserveRoot = true } = {}) {", 1600, 0);
const setAgentActivityWindow = sourceWindow(mainJs, "window.setAgentActivity = (payload = {}) => {", 1400, 0);
const setAgentThinkingWindow = sourceWindow(mainJs, "window.setAgentThinking = (payload = {}) => {", 900, 0);
const setAgentIntentWindow = sourceWindow(mainJs, "window.setAgentIntent = (payload = {}) => {", 900, 0);
const liveStartedVisibilityWindow = functionWindow(mainMjs, "getSubagentVisibilityId", 2200);
const canRenderLiveSubagentWindow = functionWindow(mainMjs, "canRenderLiveSubagent", 500);
const replayHydratedRootWindow = functionWindow(mainMjs, "replayHydratedRootRuntimeState", 2200);
const buildRootHistoryWindow = functionWindow(mainMjs, "buildRootRuntimeStateFromHistory", 3000);
const syncRootRuntimeWindow = functionWindow(mainMjs, "syncRootRuntimeState", 2000);
const captureLiveSubagentWindow = functionWindow(mainMjs, "captureLiveSubagentRuntimeState", 2800);
const mergeSubagentSnapshotsWindow = functionWindow(mainMjs, "mergeSubagentRuntimeSnapshots", 2600);
const refreshSessionContextWindow = functionWindow(mainMjs, "refreshSessionContext", 1600);
const visibleWindowSyncRetryWindow = functionWindow(mainMjs, "scheduleVisibleWindowStateSyncRetry", 900);
const backgroundAgentsWindow = functionWindow(mainMjs, "getBackgroundAgentsFromSessionIdle", 1200);
const backgroundMetadataNormalizeWindow = functionWindow(mainMjs, "normalizeBackgroundAgentMetadata", 1600);
const liveBackgroundReconcileWindow = functionWindow(mainMjs, "reconcileLiveBackgroundSubagents", 1800);
const hydratedBackgroundReconcileWindow = functionWindow(mainMjs, "reconcileHydratedBackgroundSubagents", 1800);
const fallbackRetireWindow = functionWindow(mainMjs, "scheduleFallbackSubagentRetire", 1400);
const releaseIdentityStateWindow = functionWindow(mainMjs, "releaseSubagentIdentityState", 2200);
const mergeHydratedWindow = functionWindow(mainMjs, "mergeHydratedSubagentRuntimeState", 2200);
const resolveTaskSummaryWindow = functionWindow(mainMjs, "resolveSubagentTaskSummary", 1200);
const preferredSquadResolverWindow = functionWindow(mainMjs, "resolvePreferredSquadAgentMetadata", 1400);
const resolveDisplayFieldsWindow = functionWindow(mainMjs, "resolveSubagentDisplayFields", 1800);
const resolveDisplayDataWindow = functionWindow(mainMjs, "resolveSubagentDisplayData", 1800);

// ── 1. C64 engine + external library seam ──────────────────────────────────────
console.log("\n[1] C64 engine + external library seam");

assert(
    'engine select keeps value="c64" but shows the SAM (Software Automatic Mouth) C64 version label',
    /<option[^>]+value=["']c64["'][^>]*>\s*SAM\s*\(Software Automatic Mouth\)\s*C64 version\s*<\/option>/i.test(htmlSrc),
    'Expected value="c64" option label "SAM (Software Automatic Mouth) C64 version" in index.html'
);
assert(
    "engine select does not keep a visible single-engine value=\"sam\" option",
    !/<option[^>]+value=["']sam["']/i.test(htmlSrc)
);
assert(
    "package/source references discordier/sam via sam-js or equivalent library seam",
    samLibraryReferencePresent,
    "No sam-js / discordier-sam reference found in package.json, HTML, or JS"
);
assert(
    "live speech routing no longer uses engine === 'sam' as an active engine id",
    !/engine\s*===\s*['"]sam['"]/.test(`${speakWindow}\n${previewWindow}\n${sourceWindow(mainJs, "function updateEngineUI()", 1200, 0)}`),
    "stale sam engine branch still appears in live routing code"
);
assert("legacy samVoiceSelect UI identifier is gone", !/\bsamVoiceSelect\b/.test(mainJs));
assert("legacy ttsSamTestBtn UI identifier is gone", !/\bttsSamTestBtn\b/.test(mainJs));
assert(
    "legacy inline SAM synth tables/helpers are removed from content/main.js",
    !legacyBrowserSynthPresent && !/synthesizeSamAudio\s*\(/.test(mainJs),
    "Legacy synth markers (SAM_PHONEME_DATA / samG2P / synthesizeSamAudio / formantShift presets) still exist"
);

// ── 2. Runtime wiring + settings surface ───────────────────────────────────────
console.log("\n[2] Runtime wiring + settings surface");

assert(
    "speak() keeps an explicit C64 branch",
    /engine\s*===\s*['"]c64['"]/.test(speakWindow),
    "No explicit C64 branch found in speak()"
);
assert(
    "previewCurrentVoice() keeps an explicit C64 branch",
    /engine\s*===\s*['"]c64['"]/.test(previewWindow),
    "No explicit C64 branch found in previewCurrentVoice()"
);
assert(
    "dedicated speakC64 function exists",
    !!speakC64Window,
    "No dedicated C64 speech function found"
);
if (speakC64Window) {
    assert(
    "speakC64() goes through SamJs output rather than synthesizeSamAudio()",
    /buildC64SamInstance\s*\(|new\s+SamJs\s*\(|\.\s*wav\s*\(|\.\s*buf(?:8|32)\s*\(|\.\s*speak\s*\(/.test(speakC64Window) &&
        !/synthesizeSamAudio\s*\(/.test(speakC64Window),
    "speakC64() does not appear to use sam-js output or still calls synthesizeSamAudio()"
    );
}
assert(
    "C64 settings section keeps the voice selector",
    /c64-voice-select/.test(c64SectionWindow),
    "C64 voice selector missing from HTML section"
);
assert(
    "C64 settings section exposes a Mouth control",
    /\bMouth\b/i.test(c64SectionWindow),
    "No Mouth control found in the C64 settings section"
);
assert(
    "C64 settings section exposes a Pitch control",
    /\bPitch\b/i.test(c64SectionWindow),
    "No Pitch control found in the C64 settings section"
);
assert(
    "C64 settings section exposes throat and speed/rate controls",
    /\bThroat\b/i.test(c64SectionWindow) && /\b(?:Speed|Rate)\b/i.test(c64SectionWindow),
    "C64 settings section is missing Throat and/or Speed/Rate controls"
);

// ── 3. Persistence: C64 voice controls stay round-trippable ────────────────────
console.log("\n[3] Persistence contract");

assert("DEFAULT_SETTINGS includes c64Voice", /\bc64Voice\s*:/.test(defaultSettingsWindow));
assert("saveTtsSettings payload includes c64Voice", /\bc64Voice\b/.test(savePayloadWindow));
assert("window.getTtsSettings exposes c64Voice", /\bc64Voice\b/.test(ttsSettingsWindow));
assert(
    "DEFAULT_SETTINGS includes c64 mouth/pitch/throat/speed settings",
    /\bc64Mouth\s*:/.test(defaultSettingsWindow) &&
    /\bc64Pitch\s*:/.test(defaultSettingsWindow) &&
    /\bc64Throat\s*:/.test(defaultSettingsWindow) &&
    /\bc64(?:Speed|Rate)\s*:/.test(defaultSettingsWindow),
    "DEFAULT_SETTINGS is missing one or more C64 parameter fields"
);
assert(
    "saveTtsSettings payload includes c64 mouth/pitch/throat/speed settings",
    /\bc64Mouth\b/.test(savePayloadWindow) &&
    /\bc64Pitch\b/.test(savePayloadWindow) &&
    /\bc64Throat\b/.test(savePayloadWindow) &&
    /\bc64(?:Speed|Rate)\b/.test(savePayloadWindow),
    "saveTtsSettings() is missing one or more C64 parameter fields"
);
assert(
    "load path restores savedTts.c64Voice or legacy savedTts.samVoice into c64Voice",
    /savedTts\.c64Voice\s*\|\|\s*savedTts\.samVoice/.test(c64RestoreWindow) &&
    /c64Voice\s*=\s*initialC64Preset\.id/.test(c64RestoreWindow),
    "No savedTts.c64Voice / savedTts.samVoice -> c64Voice restore found"
);
assert(
    "load path restores savedTts.c64 mouth/pitch/throat/speed settings",
    /savedTts\.c64Mouth/.test(c64RestoreWindow) &&
    /savedTts\.c64Pitch/.test(c64RestoreWindow) &&
    /savedTts\.c64Throat/.test(c64RestoreWindow) &&
    /savedTts\.c64(?:Speed|Rate)/.test(c64RestoreWindow),
    "No savedTts restore found for one or more C64 parameter fields"
);
assert(
    'engine select exposes value="deepgram"',
    /<option[^>]+value=["']deepgram["'][^>]*>\s*Deepgram\s*<\/option>/i.test(htmlSrc),
    'Expected value="deepgram" option label "Deepgram" in index.html'
);
assert("DEFAULT_SETTINGS includes deepgramApiKey", /\bdeepgramApiKey\s*:/.test(defaultSettingsWindow));
assert("DEFAULT_SETTINGS includes deepgramVoice", /\bdeepgramVoice\s*:/.test(defaultSettingsWindow));
assert("saveTtsSettings payload includes deepgramApiKey", /\bdeepgramApiKey\b/.test(savePayloadWindow));
assert("saveTtsSettings payload includes deepgramVoice", /\bdeepgramVoice\b/.test(savePayloadWindow));
assert(
    "load path restores savedTts.deepgramApiKey and savedTts.deepgramVoice",
    /savedTts\.deepgramApiKey/.test(mainJs) && /savedTts\.deepgramVoice/.test(mainJs),
    "No savedTts restore found for Deepgram credentials or voice"
);
assert(
    "window.getTtsSettings exposes Deepgram state without leaking the API key",
    /\bdeepgramVoice\b/.test(ttsSettingsWindow) && /\bdeepgramHasApiKey\b/.test(ttsSettingsWindow),
    "window.getTtsSettings() is missing Deepgram summary fields"
);
assert(
    "Deepgram settings section keeps the API key input",
    /deepgram-apikey-input/.test(deepgramSectionWindow),
    "Deepgram API key input missing from HTML section"
);
assert(
    "Deepgram preset section keeps the voice selector",
    /deepgram-voice-select/.test(htmlSrc),
    "Deepgram voice selector missing from HTML"
);
assert(
    "updateEngineUI() tracks Deepgram explicitly",
    /const\s+isDeepgram\s*=\s*ttsEngine\s*===\s*['"]deepgram['"]/.test(mainJs) &&
        /ttsDeepgramSection\.classList\.toggle\(\s*['"]hidden['"]\s*,\s*!isDeepgram\s*\)/.test(mainJs) &&
        /deepgramPresetSection\.classList\.toggle\(\s*['"]hidden['"]\s*,\s*!isDeepgram\s*\)/.test(mainJs),
    "Deepgram UI toggles are not explicit in updateEngineUI()"
);
assert(
    "canPreviewCurrentVoice() keeps an explicit Deepgram branch",
    /engine\s*===\s*['"]deepgram['"]/.test(functionWindow(mainJs, "canPreviewCurrentVoice", 800)),
    "No explicit Deepgram branch found in canPreviewCurrentVoice()"
);
assert(
    "previewCurrentVoice() keeps an explicit Deepgram branch",
    /engine\s*===\s*['"]deepgram['"]/.test(previewWindow),
    "No explicit Deepgram branch found in previewCurrentVoice()"
);
assert(
    "speak() keeps an explicit Deepgram branch",
    /engine\s*===\s*['"]deepgram['"]/.test(speakWindow),
    "No explicit Deepgram branch found in speak()"
);
assert(
    "dedicated speakDeepgram function exists",
    !!speakDeepgramWindow,
    "No dedicated Deepgram speech function found"
);
if (speakDeepgramWindow) {
    assert(
        "speakDeepgram() routes through the extension backend callback with the selected model",
        /copilot\.generateDeepgramSpeech\s*\(\s*\{[\s\S]*model:\s*deepgramVoice/.test(speakDeepgramWindow) &&
            !/https:\/\/api\.deepgram\.com\/v1\/speak/.test(speakDeepgramWindow),
        "Deepgram browser path should use the backend callback, not a direct fetch"
    );
}
assert(
    "main.mjs exposes a generateDeepgramSpeech backend callback",
    /generateDeepgramSpeech:\s*\(payload\)\s*=>\s*generateDeepgramSpeech\(payload\)/.test(mainMjs),
    "Webview callbacks do not expose generateDeepgramSpeech"
);
if (generateDeepgramSpeechWindow) {
    assert(
        "generateDeepgramSpeech() calls Deepgram's speak endpoint with token auth and the selected model",
        /https:\/\/api\.deepgram\.com\/v1\/speak/.test(generateDeepgramSpeechWindow) &&
            /Authorization:\s*`Token\s*\$\{apiKey\}`/.test(generateDeepgramSpeechWindow) &&
            /model:\s*voiceModel/.test(generateDeepgramSpeechWindow),
        "Deepgram backend callback is missing endpoint, token auth, or model selection"
    );
    assert(
        "generateDeepgramSpeech() returns audio payload data for the webview",
        /audioBase64:\s*buffer\.toString\(["']base64["']\)/.test(generateDeepgramSpeechWindow) &&
            /mimeType:\s*response\.headers\.get\(["']content-type["']\)/.test(generateDeepgramSpeechWindow),
        "Deepgram backend callback is not returning serialized audio data"
    );
}

// ── 4. Migration: legacy sam settings normalize cleanly ────────────────────────
console.log("\n[4] Legacy settings migration");

assert(
    "main.mjs normalizeSettings remaps legacy engine:'sam' to c64",
    /settings\.engine\s*===\s*['"]sam['"][\s\S]{0,120}nextSettings\.engine\s*=\s*['"]c64['"]/.test(mainMjs),
    "No normalizeSettings() remap from legacy sam engine to c64"
);
assert(
    "main.mjs normalizeSettings migrates legacy samVoice to c64Voice",
    /!settings\.c64Voice\s*&&\s*settings\.samVoice[\s\S]{0,120}nextSettings\.c64Voice\s*=\s*settings\.samVoice/.test(mainMjs),
    "No normalizeSettings() remap from legacy samVoice to c64Voice"
);
assert(
    "main.mjs normalizeSettings deletes stale samVoice key",
    /delete\s+nextSettings\.samVoice/.test(mainMjs),
    "Stale samVoice key is not cleared during normalization"
);
assert(
    "content/main.js remaps savedTts.engine === 'sam' to c64",
    /savedTts\.engine\s*===\s*['"]sam['"][\s\S]{0,80}['"]c64['"]/.test(mainJs),
    "No savedTts.engine load remap from sam to c64"
);
assert(
    "loadSettings() and saveSettings() both pass through normalizeSettings()",
    (/return\s+normalizeSettings\s*\(\s*JSON\.parse/.test(mainMjs) ||
        /activeSettings\s*=\s*normalizeSettings\s*\(\s*JSON\.parse/.test(mainMjs)) &&
    /const\s+nextSettings\s*=\s*normalizeSettings\s*\(\s*\{\s*\.\.\.currentSettings,\s*\.\.\.settings\s*\}\s*\)/.test(mainMjs),
    "normalizeSettings() is not clearly used on both load and save paths"
);

// ── 5. Browser-only / no-network behavior ──────────────────────────────────────
console.log("\n[5] Browser-only / no-network behavior");

assert("source does not reference samtts.com", !/samtts\.com/i.test(`${mainJs}\n${mainMjs}\n${htmlSrc}\n${packageJson}`));
assert("source does not include copied Next.js asset paths", !/\/_next\//.test(`${mainJs}\n${htmlSrc}`));

assert("speakC64 body parseable", !!speakC64Window, "Function not found");
if (speakC64Window) {
    assert("speakC64 contains no fetch()", !speakC64Window.includes("fetch("));
    assert("speakC64 contains no XMLHttpRequest", !speakC64Window.includes("XMLHttpRequest"));
    assert("speakC64 contains no WebSocket", !speakC64Window.includes("WebSocket"));
}

assert(
    "visible UI copy avoids authenticity claims for the browser-only retro path",
    !/authentic microsoft sam|sapi-compatible|classic windows xp voice/i.test(`${htmlSrc}\n${mainJs}`),
    "UI/source copy still overclaims authenticity"
);

// ── 6. Sub-agent visibility: subagent.started → addSubagent ────────────────────
console.log("\n[6] Sub-agent visibility: subagent.started → addSubagent");

assert(
    'session.on("subagent.started") calls addSubagent',
    /session\.on\s*\(\s*["']subagent\.started["'][\s\S]{0,1000}addSubagent/.test(mainMjs)
);
assert(
    "main.mjs defines canRenderLiveSubagent()",
    /function\s+canRenderLiveSubagent\s*\(/.test(mainMjs)
);

if (startedHandlerWindow) {
    const body = startedHandlerWindow;
    assert(
        "subagent.started: addSubagent is NOT gated behind a tool-evidence check",
        !body.includes("hadLiveTool") && !body.includes("seenStarted") && !body.includes("waitForTool")
    );
    const addIndex = body.indexOf("addSubagent");
    const syncModelIndex = body.indexOf("syncPendingModelForSubagent");
    const syncThinkingIndex = body.indexOf("syncPendingThinkingForSubagent");
    assert(
        "subagent.started: addSubagent fires before syncPending calls",
        addIndex !== -1
            && (syncModelIndex === -1 || addIndex < syncModelIndex)
            && (syncThinkingIndex === -1 || addIndex < syncThinkingIndex)
    );
    assert(
        "subagent.started: missing agentId falls back to a provisional visible owner before addSubagent",
        /if\s*\(\s*!event\.agentId\s*&&\s*toolCallId\s*\)\s*\{[\s\S]{0,120}rememberPendingStartedSubagent\s*\(\s*displayData\s*,\s*\{\s*model\s*\}\s*\)\s*;/.test(
            body
        ) &&
            /callWindowFunction\(\s*["']addSubagent["']/.test(body),
        "subagent.started() no longer clearly preserves/render-starts an agent when event.agentId is missing"
    );
} else {
    assert("subagent.started: handler body parseable", false, "Could not isolate handler body");
    assert("subagent.started: addSubagent is NOT gated behind a tool-evidence check", false);
}
assert(
    "live subagent updates stay gated to started/background-authorized cards",
    /canRenderLiveSubagent\s*\(\s*agentId\s*\)\s*&&\s*shouldTrackSubagentToolActivity/.test(mainMjs) &&
        /if\s*\(\s*canRenderLiveSubagent\s*\(\s*agentId\s*\)\s*\)\s*\{[\s\S]{0,140}setAgentThinking/.test(mainMjs) &&
        /if\s*\(\s*canRenderLiveSubagent\s*\(\s*agentId\s*\)\s*\)\s*\{[\s\S]{0,180}setAgentIntent/.test(mainMjs),
    "Non-started agents can still leak raw call_* identities into the webview update path"
);
assert(
    "subagent activity tracking suppresses avatar/meta tools",
    /function\s+shouldTrackSubagentToolActivity\s*\(/.test(mainMjs) &&
        /report_intent/.test(mainMjs) &&
        /normalizedToolName\.startsWith\(\s*["']copilot_avatar_["']\s*\)/.test(mainMjs),
    "Avatar control tools like copilot_avatar_show can still enter subagent activity state"
);

// ── 7. Clippy-only summary feedback gating ───────────────────────────────────────
console.log("\n[7] Clippy-only summary feedback gating");

assert(
    "showMessage keeps a dedicated Clippy staging branch before raw Copilot speech",
    /if\s*\(\s*isClippyAvatar\(\)\s*\)\s*\{[\s\S]{0,160}pendingClippyMessage\s*=\s*text\s*\|\|\s*['"][\s\S]{0,120}return;[\s\S]{0,160}speak\s*\(\s*text\s*\)/.test(
        showMessageWindow
    ),
    "window.showMessage no longer clearly separates Clippy staging from Copilot raw speech"
);
assert(
    "Copilot-mode showMessage clears staged Clippy summaries before raw speech",
    /if\s*\(\s*isClippyAvatar\(\)\s*\)\s*\{[\s\S]{0,160}pendingClippyMessage\s*=\s*text\s*\|\|\s*['"][\s\S]{0,120}return;\s*\}[\s\S]{0,80}clearClippySummaryState\s*\(\s*\)\s*;[\s\S]{0,80}speak\s*\(\s*text\s*\)/.test(
        showMessageWindow
    ),
    "window.showMessage still lets Copilot-mode speech reuse staged Clippy summary state"
);
assert(
    "showMessage does not summarize Copilot-mode assistant text inline",
    !/summarizeForClippy\s*\(/.test(showMessageWindow),
    "window.showMessage now reaches summarizeForClippy() directly"
);

const clippySummaryModeHelper =
    /function\s+shouldUseClippySummaryFeedback\s*\(\s*settings\s*=\s*activeSettings\s*\)\s*\{\s*return\s+settings\?\.avatarStyle\s*===\s*["']clippy["'];?\s*\}/.test(
        mainMjs
    );
const clippyTurnEndGuarded =
    /if\s*\(\s*shouldUseClippySummaryFeedback\(\)\s*&&\s*rootTurnState\.sawMessage\s*&&\s*rootTurnState\.lastMessage\s*\)\s*\{[\s\S]{0,120}callWindowFunction\(\s*["']flushClippySummary["']/.test(
        turnEndWindow
    );

assert(
    "main.mjs keeps an explicit Clippy summary-mode helper",
    clippySummaryModeHelper,
    "shouldUseClippySummaryFeedback() is missing or no longer keys directly off avatarStyle === 'clippy'"
);
assert(
    "assistant.turn_end only flushes Clippy summaries in Clippy mode",
    clippyTurnEndGuarded,
    "assistant.turn_end still reaches flushClippySummary without an explicit Clippy-mode gate"
);

// ── 8. Webview pending-state visibility contract ─────────────────────────────────
console.log("\n[8] Sub-agent visibility: webview pending-state contract");

assert(
    "content/main.js keeps pending caches for non-root model/activity/intent/thinking updates",
    /const\s+pendingAgentModels\s*=\s*new\s+Map/.test(mainJs) &&
        /const\s+pendingAgentActivities\s*=\s*new\s+Map/.test(mainJs) &&
        /const\s+pendingAgentIntents\s*=\s*new\s+Map/.test(mainJs) &&
        /const\s+pendingAgentThinking\s*=\s*new\s+Set/.test(mainJs)
);
assert(
    "setAgentActivity queues weak update-only payloads instead of minting an anonymous card",
    setAgentActivityWindow.includes("!avatars.has(resolvedId)") &&
        setAgentActivityWindow.includes("!hasStrongAgentIdentity(resolvedId, payload)") &&
        setAgentActivityWindow.includes("queuePendingAgentActivity(resolvedId, payload);") &&
        setAgentActivityWindow.indexOf("queuePendingAgentActivity(resolvedId, payload);") <
            setAgentActivityWindow.indexOf("const avatar = ensureAvatar(resolvedId, payload);"),
    "window.setAgentActivity() no longer clearly queues weak updates before returning"
);
assert(
    "setAgentThinking queues weak update-only payloads instead of minting an anonymous card",
    setAgentThinkingWindow.includes("!avatars.has(resolvedId)") &&
        setAgentThinkingWindow.includes("!hasStrongAgentIdentity(resolvedId, data)") &&
        setAgentThinkingWindow.includes("pendingAgentThinking.add(resolvedId);") &&
        setAgentThinkingWindow.indexOf("pendingAgentThinking.add(resolvedId);") <
            setAgentThinkingWindow.indexOf("const avatar = ensureAvatar(resolvedId, data);"),
    "window.setAgentThinking() no longer clearly queues weak updates before returning"
);
assert(
    "setAgentIntent queues weak update-only payloads instead of minting an anonymous card",
    setAgentIntentWindow.includes("!avatars.has(resolvedId)") &&
        setAgentIntentWindow.includes("!hasStrongAgentIdentity(resolvedId, payload)") &&
        setAgentIntentWindow.includes("pendingAgentIntents.set(resolvedId, payload);") &&
        setAgentIntentWindow.indexOf("pendingAgentIntents.set(resolvedId, payload);") <
            setAgentIntentWindow.indexOf("const avatar = ensureAvatar(resolvedId, payload);"),
    "window.setAgentIntent() no longer clearly queues weak updates before returning"
);
assert(
    "ensureAvatar consumes pending subagent payloads and reapplies queued non-root state",
    /const\s+data\s*=\s*resolvedId\s*===\s*ROOT_AGENT_ID\s*\?\s*payload\s*:\s*consumePendingSubagent\(payload\)/.test(
        ensureAvatarWindow
    ) &&
        /applyPendingAgentState\(avatar\)/.test(ensureAvatarWindow),
    "ensureAvatar() no longer clearly drains queued subagent state on first render"
);
assert(
    "clearSubagents wipes pending non-root UI caches alongside visible cards",
    /pendingSubagents\.length\s*=\s*0/.test(clearSubagentsWindow) &&
        /pendingAgentActivities\.keys\(\)/.test(clearSubagentsWindow) &&
        /pendingAgentIntents\.keys\(\)/.test(clearSubagentsWindow) &&
        /pendingAgentThinking\.values\(\)/.test(clearSubagentsWindow) &&
        /clearPendingAgentState\(agentId,\s*\{\s*preserveModel:\s*true\s*\}\)/.test(clearSubagentsWindow),
    "clearSubagents() no longer clearly clears queued non-root UI state"
);

// ── 9. Late-open replay sequence ────────────────────────────────────────────────
console.log("\n[9] Sub-agent visibility: late-open replay sequence");

const syncFnMatch = mainMjs.match(
    /async\s+function\s+syncVisibleWindowState[\s\S]{0,2400}?replayHydratedSubagentsToWebview/
);
if (syncFnMatch) {
    const body = syncFnMatch[0];
    const rootReplayIndex = body.indexOf("syncRootRuntimeState");
    const liveSnapshotIndex = body.indexOf("captureLiveSubagentRuntimeState");
    const readyGuardIndex = body.indexOf("if (waitForReady && !ready)");
    const clearIndex = body.indexOf("clearSubagents");
    const resetIndex = body.indexOf("resetSubagentRuntimeState");
    const hydrateIndex = body.indexOf("hydrateSubagentRuntimeFromHistory");
    const mergeIndex = body.indexOf("mergeSubagentRuntimeSnapshots");
    const replayIndex = body.indexOf("replayHydratedSubagentsToWebview");
    assert("syncVisibleWindowState: root history replay happens on first-ready sync", rootReplayIndex !== -1);
    assert(
        "syncVisibleWindowState: root history replay happens before subagent clear/rehydrate",
        rootReplayIndex !== -1 && rootReplayIndex < clearIndex && rootReplayIndex < hydrateIndex
    );
    assert(
        "syncVisibleWindowState: captures live subagent snapshot before clear/reset",
        liveSnapshotIndex !== -1 && liveSnapshotIndex < clearIndex && liveSnapshotIndex < resetIndex
    );
    assert(
        "syncVisibleWindowState: destructive replay waits for a successful ready handshake",
        /const\s+ready\s*=\s*waitForReady\s*\?\s*await\s+waitForWebviewReady\(\)\s*:\s*true\s*;/.test(body) &&
            /if\s*\(\s*waitForReady\s*&&\s*!ready\s*\)\s*\{[\s\S]{0,260}scheduleVisibleWindowStateSyncRetry\s*\(/.test(body) &&
            /if\s*\(\s*waitForReady\s*&&\s*!ready\s*\)\s*\{[\s\S]{0,360}return\s+false\s*;/.test(body) &&
            readyGuardIndex !== -1 &&
            readyGuardIndex < clearIndex &&
            readyGuardIndex < resetIndex,
        "syncVisibleWindowState() still clears or resets runtime state after a failed ready handshake"
    );
    assert("syncVisibleWindowState: clearSubagents called before rehyd", clearIndex !== -1 && clearIndex < hydrateIndex);
    assert(
        "syncVisibleWindowState: resetSubagentRuntimeState called before rehyd",
        resetIndex !== -1 && resetIndex < hydrateIndex
    );
    assert(
        "syncVisibleWindowState: merges live subagent snapshot after history hydration",
        hydrateIndex !== -1 && mergeIndex !== -1 && hydrateIndex < mergeIndex && mergeIndex < replayIndex
    );
} else {
    assert("syncVisibleWindowState: function body parseable", false, "Could not isolate function body");
    assert("syncVisibleWindowState: root history replay happens on first-ready sync", false);
    assert("syncVisibleWindowState: root history replay before subagent rehydrate", false);
    assert("syncVisibleWindowState: captures live subagent snapshot before clear/reset", false);
    assert("syncVisibleWindowState: destructive replay waits for a successful ready handshake", false);
    assert("syncVisibleWindowState: clearSubagents called before rehyd", false);
    assert("syncVisibleWindowState: resetSubagentRuntimeState called before rehyd", false);
    assert("syncVisibleWindowState: merges live subagent snapshot after history hydration", false);
}
assert(
    "main.mjs defines scheduleVisibleWindowStateSyncRetry()",
    /function\s+scheduleVisibleWindowStateSyncRetry\s*\(/.test(mainMjs) &&
        /setTimeout\s*\(/.test(visibleWindowSyncRetryWindow),
    "No bounded retry helper found for a missed webview ready handshake"
);
assert("main.mjs defines buildRootRuntimeStateFromHistory()", /async\s+function\s+buildRootRuntimeStateFromHistory\s*\(/.test(mainMjs));
assert("main.mjs defines syncRootRuntimeState()", /async\s+function\s+syncRootRuntimeState\s*\(/.test(mainMjs));
assert(
    "root history replay rebuilds working/subtask state from turn, tool, and intent events",
    /case\s+["']assistant\.turn_start["'][\s\S]{0,180}rootState\.working\s*=\s*true/.test(buildRootHistoryWindow) &&
        /case\s+["']tool\.execution_start["'][\s\S]{0,320}rootState\.subtaskText\s*=\s*normalizeRootSubtaskText\s*\(\s*getToolLabel\s*\(\s*toolName\s*\)\s*\)/.test(buildRootHistoryWindow) &&
        /case\s+["']assistant\.intent["'][\s\S]{0,260}rootState\.subtaskText\s*=\s*normalizeRootSubtaskText\s*\(\s*intent\s*\)/.test(buildRootHistoryWindow) &&
        /case\s+["']assistant\.turn_end["'][\s\S]{0,260}rootState\.subtaskText\s*=\s*["']["']/.test(buildRootHistoryWindow),
    "buildRootRuntimeStateFromHistory() no longer clearly reconstructs the late-open root subtask snapshot"
);
assert(
    "root history replay replays reset, working, activity, and subtask into the webview",
    /resetRootActivity/.test(replayHydratedRootWindow) &&
        /setWorking/.test(replayHydratedRootWindow) &&
        /setAgentActivity/.test(replayHydratedRootWindow) &&
        /setSubtask/.test(replayHydratedRootWindow),
    "replayHydratedRootRuntimeState() no longer clearly pushes the rebuilt root subtask snapshot into the page"
);
assert(
    "first-open root sync prefers live root runtime state when current-turn events are newer than history",
    /mergeRootRuntimeStates/.test(syncRootRuntimeWindow) &&
        /buildRootRuntimeStateFromHistory/.test(syncRootRuntimeWindow) &&
        /replayHydratedRootRuntimeState/.test(syncRootRuntimeWindow),
    "syncRootRuntimeState() no longer clearly merges current live root state with history before first-open replay"
);
assert(
    "main.mjs defines captureLiveSubagentRuntimeState()",
    /function\s+captureLiveSubagentRuntimeState\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines mergeSubagentRuntimeSnapshots()",
    /function\s+mergeSubagentRuntimeSnapshots\s*\(/.test(mainMjs)
);
assert(
    "live subagent snapshot preserves active cards plus runtime correlation maps",
    /subagentIdsByToolCallId/.test(captureLiveSubagentWindow) &&
        /toolAgentIdsByToolCallId/.test(captureLiveSubagentWindow) &&
        /backgroundAgentMetadataByAgentId/.test(captureLiveSubagentWindow) &&
        /liveSubagentStatesByAgentId/.test(captureLiveSubagentWindow) &&
        /renderAuthorized/.test(captureLiveSubagentWindow),
    "captureLiveSubagentRuntimeState() no longer clearly preserves the live subagent state needed to survive a first-open/context resync"
);
assert(
    "subagent snapshot merge overlays live state after history so current-turn agents are not dropped",
    /cloneHydratedSubagentRuntimeState/.test(mergeSubagentSnapshotsWindow) &&
        /activeSubagentsByAgentId/.test(mergeSubagentSnapshotsWindow) &&
        /pendingStartedSubagentsByToolCallId/.test(mergeSubagentSnapshotsWindow),
    "mergeSubagentRuntimeSnapshots() no longer clearly merges live current-turn subagents back over history"
);
assert(
    "refreshSessionContext no longer clears live subagents before a visible cwd resync",
    !/resetSubagentRuntimeState\s*\(\s*\{\s*clearUi\s*:\s*true\s*\}\s*\)/.test(refreshSessionContextWindow) &&
        /syncVisibleWindowState\s*\(\s*\{\s*waitForReady\s*:\s*cwdChanged\s*&&\s*!!webview\._handle\s*\}\s*\)/.test(refreshSessionContextWindow),
    "refreshSessionContext() still drops visible subagents on cwd change instead of rehydrating them"
);

// ── 10. Background-agent idle reconciliation ────────────────────────────────────
console.log("\n[10] Sub-agent visibility: background-agent idle reconciliation");

assert(
    "main.mjs defines getBackgroundAgentIdsFromSessionIdle()",
    /function\s+getBackgroundAgentIdsFromSessionIdle\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines getBackgroundAgentsFromSessionIdle()",
    /function\s+getBackgroundAgentsFromSessionIdle\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines bindPendingStartedSubagentsToBackgroundAgents()",
    /function\s+bindPendingStartedSubagentsToBackgroundAgents\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines reconcileHydratedBackgroundSubagents()",
    /function\s+reconcileHydratedBackgroundSubagents\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines reconcileLiveBackgroundSubagents()",
    /async\s+function\s+reconcileLiveBackgroundSubagents\s*\(/.test(mainMjs)
);
assert(
    "main.mjs defines releaseSubagentIdentityState()",
    /function\s+releaseSubagentIdentityState\s*\(/.test(mainMjs)
);
assert(
    "main.mjs tracks the latest live background-agent snapshot",
    /const\s+liveBackgroundAgentIds\s*=\s*new\s+Set\s*\(\s*\)/.test(mainMjs),
    "No liveBackgroundAgentIds snapshot set found in main.mjs"
);
assert(
    'history replay: session.idle reconciles background subagents',
    /case\s+["']session\.idle["'][\s\S]{0,260}bindPendingStartedSubagentsToBackgroundAgents\s*\(\s*getBackgroundAgentsFromSessionIdle\s*\(\s*event\s*\)\s*,\s*historyState\s*\)[\s\S]{0,220}reconcileHydratedBackgroundSubagents\s*\(\s*historyState\s*,\s*getBackgroundAgentIdsFromSessionIdle\s*\(\s*event\s*,\s*historyState\s*\)\s*\)/.test(
        mainMjs
    )
);
assert(
    'live runtime: session.idle reconciles background subagents',
    /session\.on\s*\(\s*["']session\.idle["']\s*,\s*async\s*\(event\)\s*=>\s*\{[\s\S]{0,220}bindPendingStartedSubagentsToBackgroundAgents\s*\(\s*getBackgroundAgentsFromSessionIdle\s*\(\s*event\s*\)\s*\)[\s\S]{0,220}reconcileLiveBackgroundSubagents\s*\(\s*getBackgroundAgentIdsFromSessionIdle\s*\(\s*event\s*\)\s*\)/.test(
        mainMjs
    )
);
assert(
    'live runtime: assistant.turn_start no longer clears subagents',
    !/session\.on\s*\(\s*["']assistant\.turn_start["']\s*,[\s\S]{0,220}resetSubagentRuntimeState/.test(mainMjs)
);
assert(
    'history replay: assistant.turn_start no longer resets hydrated subagents',
    !/case\s+["']assistant\.turn_start["'][\s\S]{0,220}resetHydratedSubagentRuntimeState/.test(mainMjs)
);
assert(
    "live runtime: missing agentId events get a provisional visible id instead of disappearing",
    /function\s+getPendingSubagentVisibilityId\s*\(/.test(mainMjs) &&
        /function\s+rememberPendingStartedSubagent\s*\(/.test(mainMjs) &&
        /function\s+bindRuntimeSubagentVisibilityId\s*\(/.test(mainMjs) &&
        /getSubagentVisibilityId\s*\(\s*\{[\s\S]{0,80}toolCallId/.test(liveStartedVisibilityWindow),
    "main.mjs no longer clearly provisions a visible sub-agent identity when subagent.started omits event.agentId"
);
assert(
    "history replay: unresolved started agents are retained with provisional ids",
    /case\s+["']subagent\.started["'][\s\S]{0,420}rememberPendingStartedSubagent\s*\(\s*displayData\s*,\s*\{\s*model:\s*startedModel\s*\}\s*,\s*historyState\s*\)/.test(
        mainMjs
    ) &&
        /upsertHydratedSubagentState\s*\(\s*historyState\.activeSubagentsByAgentId/.test(mainMjs),
    "hydrateSubagentRuntimeFromHistory() no longer clearly retains started agents when event.agentId is missing"
);
assert(
    "background-task helper preserves richer identity metadata than bare agentId",
    /(description|cleanAgentLabel|backgroundTasks)/.test(backgroundAgentsWindow),
    "getBackgroundAgentIdsFromSessionIdle() only reads agentId, so runtime/background-task labels cannot correct a stale Tony/Howard-style card"
);
assert(
    "background metadata normalization can derive a human display name from description text",
    /extractBackgroundAgentDisplayName\s*\(\s*description\s*\)/.test(backgroundMetadataNormalizeWindow) &&
        /descriptionDisplayName/.test(backgroundMetadataNormalizeWindow),
    "normalizeBackgroundAgentMetadata() no longer derives display identity from background description text"
);
assert(
    "display resolution lets fresh runtime labels outrank cached spawn aliases",
    /const\s+displayName\s*=\s*pickPreferredAgentLabel\s*\(\s*\[[\s\S]{0,180}runtimeDisplayName[\s\S]{0,80}runtimeAgentName[\s\S]{0,120}spawnMetadata\?\.displayName[\s\S]{0,120}selectionHint\?\.displayName/.test(
        resolveDisplayFieldsWindow
    ),
    "resolveSubagentDisplayFields() still ranks spawn metadata ahead of fresh runtime labels, so a background-task Vision can stay rendered as stale Tony Stark"
);
assert(
    "task-summary resolution prefers fresh runtime description before cached spawn description",
    /for\s*\(\s*const\s+candidate\s+of\s+\[\s*runtimeDescription\s*,\s*spawnMetadata\?\.description\s*\]\s*\)/.test(
        resolveTaskSummaryWindow
    ),
    "resolveSubagentTaskSummary() still prefers cached spawn description over runtime/background-task description, so the card detail can stay stale"
);
assert(
    "display-data resolution merges background metadata before falling back to spawn aliases",
    /const\s+backgroundMetadata\s*=\s*getBackgroundAgentMetadata\s*\(\s*agentId\s*,\s*state\s*\)/.test(resolveDisplayDataWindow) &&
        /backgroundMetadata\?\.displayName/.test(resolveDisplayDataWindow) &&
        /backgroundMetadata\?\.description/.test(resolveDisplayDataWindow),
    "resolveSubagentDisplayData() no longer merges cached background metadata into runtime label/description resolution"
);
assert(
    "identity cleanup releases visibility/runtime caches for stale or terminal subagents",
    /collectSubagentToolCallIds/.test(releaseIdentityStateWindow) &&
        /runtimeVisibilityIds/.test(releaseIdentityStateWindow) &&
        /spawnMetadataByToolCallId/.test(releaseIdentityStateWindow) &&
        /pendingStarted/.test(releaseIdentityStateWindow),
    "releaseSubagentIdentityState() no longer clears the stale alias/pending metadata caches that can keep Tony visible after Howard is the only live agent"
);
assert(
    "background reconciliation and fallback retire both clear stale identity caches before removing cards",
    /releaseSubagentIdentityState\s*\(\s*agentId\s*\)/.test(liveBackgroundReconcileWindow) &&
        /releaseSubagentIdentityState\s*\(\s*agentId\s*\)/.test(fallbackRetireWindow),
    "Stale-card removal no longer clearly clears alias caches, so an old Tony/General Purpose owner can survive after the card is removed"
);
assert(
    "live background reconciliation refreshes the latest snapshot before pruning cards",
    /liveBackgroundAgentIds\.clear\s*\(\s*\)/.test(liveBackgroundReconcileWindow) &&
        /liveBackgroundAgentIds\.add\s*\(\s*agentId\s*\)/.test(liveBackgroundReconcileWindow),
    "reconcileLiveBackgroundSubagents() no longer clearly records the active background-agent ids before it starts pruning"
);
assert(
    "fallback retire refuses to prune agents still present in the latest background snapshot",
    /liveBackgroundAgentIds\.has\s*\(\s*agentId\s*\)/.test(fallbackRetireWindow),
    "scheduleFallbackSubagentRetire() can still remove a card even while the last background snapshot says that agent is active"
);
assert(
    "history merge rehydrates live subagent runtime state for future background reconciliation",
    /for\s*\(\s*const\s+\[agentId,\s*hydratedState\]\s+of\s+state\.activeSubagentsByAgentId\.entries\(\)\s*\)/.test(mainMjs) &&
        /ensureLiveSubagentState\s*\(\s*agentId\s*\)/.test(mainMjs) &&
        /liveState\.activeTools\s*=\s*cloneActiveToolMap/.test(mainMjs),
    "mergeHydratedSubagentRuntimeState() no longer repopulates liveSubagentStatesByAgentId, so a late-open Tony card can survive later background snapshots"
);

// ── 11. Squad vs non-Squad metadata contract ───────────────────────────────────
console.log("\n[11] Sub-agent contract: Squad enrichment remains optional");

assert(
    "loadSquadContext detects the current repo as a Squad project",
    squadProbeContext.active && squadProbeContext.agentsByKey instanceof Map && squadProbeContext.agentsByKey.size > 0,
    `loadSquadContext(${repoRoot}) did not expose Squad metadata`
);
for (const [label, agentData] of [
    ["spawnDisplayName", { spawnDisplayName: "Howard the Duck" }],
    ["spawnName", { spawnName: "tester" }],
    ["agentName", { agentName: "tester" }],
    ["agentDisplayName", { agentDisplayName: "Howard the Duck" }],
    ["stable agentId", { agentId: "tester" }],
]) {
    const match = resolveSquadAgentMetadata(squadProbeContext, agentData);
    assert(
        `Squad metadata resolves Howard via ${label}`,
        match?.displayName === "Howard the Duck" && /tester/i.test(match?.role || ""),
        `Expected Howard the Duck / Tester, got ${match ? `${match.displayName} / ${match.role}` : "no match"}`
    );
}
assert(
    "probe finds an inactive non-Squad cwd outside the repo",
    !!nonSquadProbe,
    "Could not find a parent directory where loadSquadContext() goes inactive"
);
if (nonSquadProbe) {
    const nonSquadContext = nonSquadProbe.context;
    const windowContext = getSquadWindowContext(nonSquadContext);
    assert(
        "non-Squad context stays inactive with empty optional enrichment",
        !nonSquadContext.active &&
            nonSquadContext.squadPath === null &&
            nonSquadContext.agentsByKey instanceof Map &&
            nonSquadContext.agentsByKey.size === 0 &&
            windowContext.active === false &&
            windowContext.statusText === "" &&
            windowContext.detailText === "",
        `loadSquadContext(${nonSquadProbe.cwd}) returned active=${nonSquadContext.active}`
    );
    assert(
        "non-Squad context does not invent Squad names",
        resolveSquadAgentMetadata(nonSquadContext, {
            agentId: "tester",
            agentName: "tester",
            spawnName: "tester",
            agentDisplayName: "Howard the Duck",
        }) === null,
        "Inactive context still returned Squad enrichment"
    );
}
assert(
    "main.mjs prefers runtime-backed squad identity before spawn aliases",
    /runtimeIdentityStrong/.test(preferredSquadResolverWindow) &&
        /resolveSquadAgentMetadata\s*\(\s*squadContext\s*,\s*\{[\s\S]{0,120}agentName:\s*runtimeAgentName[\s\S]{0,80}agentDisplayName:\s*runtimeDisplayName[\s\S]{0,80}\}\s*\)/.test(
            preferredSquadResolverWindow
        ) &&
        /return\s+resolveSquadAgentMetadata\s*\(\s*squadContext\s*,\s*\{[\s\S]{0,200}spawnName:\s*spawnMetadata\?\.name/.test(
            preferredSquadResolverWindow
        ),
    "resolvePreferredSquadAgentMetadata() no longer clearly tries runtime/background identity before falling back to stale spawn aliases"
);

// ── 12. Runtime visibility + non-Squad naming contract ─────────────────────────
console.log("\n[12] Sub-agent contract: runtime visibility, Squad optional");

assert(
    "visibility stays owned by runtime/background state, not Squad metadata",
    /renderAuthorized/.test(canRenderLiveSubagentWindow) &&
        /getBackgroundAgentMetadata/.test(canRenderLiveSubagentWindow) &&
        !/squadContext|resolveSquadAgentMetadata|getSquadWindowContext/.test(
            `${startedHandlerWindow}\n${canRenderLiveSubagentWindow}\n${liveBackgroundReconcileWindow}`
        ),
    "Visibility path now depends on Squad metadata instead of Copilot runtime presence"
);
assert(
    "display fallback keeps non-Squad runtime names ahead of stale spawn aliases",
    /const\s+displayName\s*=\s*pickPreferredAgentLabel\s*\(\s*\[[\s\S]{0,180}squadAgent\?\.displayName[\s\S]{0,80}runtimeDisplayName[\s\S]{0,80}runtimeAgentName[\s\S]{0,120}spawnMetadata\?\.displayName/.test(
        resolveDisplayFieldsWindow
    ) &&
        /const\s+agentName\s*=\s*pickPreferredAgentLabel\s*\(\s*\[[\s\S]{0,180}squadAgent\?\.displayName[\s\S]{0,80}runtimeAgentName[\s\S]{0,80}runtimeDisplayName[\s\S]{0,120}spawnMetadata\?\.displayName/.test(
            resolveDisplayFieldsWindow
        ),
    "Without Squad metadata, runtime labels can no longer win over stale spawn aliases"
);

// ── 13. Generic-label suppression ───────────────────────────────────────────────
console.log("\n[13] Sub-agent identity: GENERIC_AGENT_LABELS suppression");

assert("GENERIC_AGENT_LABELS set is defined in main.mjs", /const\s+GENERIC_AGENT_LABELS\s*=\s*new\s+Set/.test(mainMjs));
for (const label of ["general-purpose agent", "general purpose agent", "coding agent"]) {
    assert(`GENERIC_AGENT_LABELS includes '${label}'`, mainMjs.includes(label));
}
assert(
    "root runtime tool suppression includes report_intent and copilot_avatar_*",
    /SUPPRESSED_ROOT_CHROME_TEXT/.test(mainMjs) &&
        /SUPPRESSED_ROOT_RUNTIME_TOOLS/.test(mainMjs) &&
        /report_intent/.test(mainMjs) &&
        /normalizedToolName\.startsWith\(\s*["']copilot_avatar_["']\s*\)/.test(mainMjs),
    "Root first-open replay can regress into avatar/report_intent noise if internal tool labels are not suppressed"
);
assert(
    "opaque call_* handles are not treated as stable subagent identities",
    /function\s+isOpaqueSubagentHandle[\s\S]+?\^call\[_-\]/.test(mainMjs) &&
        /function\s+isStableLookupAgentId[\s\S]+?isOpaqueSubagentHandle/.test(mainMjs),
    "Raw call_* toolCallIds can still masquerade as stable agent identity and leak into visible subagent cards"
);
assert(
    "main.mjs suppresses opaque non-root payloads that have only tool-call metadata",
    /function\s+shouldSuppressVisibleSubagentPayload/.test(mainMjs) &&
        /session\.on\s*\(\s*["']subagent\.started["'][\s\S]+?shouldSuppressVisibleSubagentPayload/.test(mainMjs) &&
        /function\s+replayHydratedSubagentsToWebview[\s\S]+?shouldSuppressVisibleSubagentPayload/.test(mainMjs),
    "subagent.started can still authorize/render an opaque call_* payload with no human identity"
);
assert(
    "subagent metadata sanitization strips internal avatar tool labels before payload/replay state",
    /function\s+sanitizeSubagentMetadataText/.test(mainMjs) &&
        /isSuppressedRuntimeToolText/.test(mainMjs) &&
        /buildSubagentPayload[\s\S]{0,220}sanitizeSubagentMetadataText/.test(mainMjs),
    "Internal tool labels like 'Using Copilot Avatar Show' can still survive into non-root task/detail text"
);
assert(
    "content/main.js ignores opaque fake cards and suppressed runtime tool labels",
    /window\.addSubagent\s*=\s*\(payload = \{\}\)\s*=>\s*\{[\s\S]{0,220}shouldSuppressSubagentPayload/.test(mainJs) &&
        /window\.setAgentActivity\s*=\s*\(payload = \{\}\)\s*=>\s*\{[\s\S]{0,260}shouldSuppressRuntimeToolName/.test(mainJs),
    "The webview can still materialize a fake call_* card or show avatar-control tool activity if backend filtering regresses"
);

// ── 14. subagent.selected remains a weak hint ──────────────────────────────────
console.log("\n[14] subagent.selected: weak hint only");

assert(
    "live subagent.selected handler calls setPendingSubagentSelectionHint",
    /session\.on\s*\(\s*["']subagent\.selected["'][\s\S]{0,300}setPendingSubagentSelectionHint/.test(mainMjs)
);
assert(
    "live subagent.selected handler does NOT call addSubagent",
    !/session\.on\s*\(\s*["']subagent\.selected["'][\s\S]{0,300}addSubagent/.test(mainMjs)
);
assert(
    "history replay subagent.selected case calls setPendingSubagentSelectionHint",
    /["']subagent\.selected["'][\s\S]{0,100}setPendingSubagentSelectionHint/.test(mainMjs)
);
assert(
    "shouldBindPendingSelectionHint guards on !agentId before binding",
    /function\s+shouldBindPendingSelectionHint[\s\S]{0,200}!agentId/.test(mainMjs)
);

const liveSelectedHandler = mainMjs.match(
    /session\.on\s*\(\s*["']subagent\.selected["'][^,]*,\s*\(event\)\s*=>\s*\{([\s\S]{0,400}?)\}\s*\)\s*;/
);
if (liveSelectedHandler) {
    assert(
        "live subagent.selected handler does NOT directly call hintsByAgentId.set",
        !liveSelectedHandler[1].includes("hintsByAgentId.set")
    );
} else {
    assert("live subagent.selected: handler body parseable", false, "Could not isolate handler body");
}

// ── 15. Retro Clippy seam remains local-only stub ──────────────────────────────
console.log("\n[15] generateRetroClippyVoice: local-only stub seam");

assert(
    "generateRetroClippyVoice function is defined in main.mjs",
    /generateRetroClippyVoice\s*\(\s*\)\s*\{/.test(mainMjs)
);
assert(
    "generateRetroClippyVoice throws Error",
    /generateRetroClippyVoice[\s\S]{0,200}throw\s+new\s+Error\s*\(/.test(mainMjs)
);

const retroWindow = sourceWindow(mainMjs, "generateRetroClippyVoice", 500, 0);
assert("generateRetroClippyVoice: no fetch() call", !retroWindow.includes("fetch("));
assert("generateRetroClippyVoice: no XMLHttpRequest", !retroWindow.includes("XMLHttpRequest"));
assert("generateRetroClippyVoice: no active tetyys.com URL", !retroWindow.includes("https://tetyys"));

// ── 16. Copilot SDK API contract: joinSession + getEvents ───────────────────
console.log("\n[16] Copilot SDK API contract: joinSession + getEvents + approveAll");

assert(
    "main.mjs imports joinSession from copilot-sdk/extension",
    /import\s*\{\s*joinSession\s*\}\s*from\s+["']@github\/copilot-sdk\/extension["']/.test(mainMjs)
);
assert(
    "main.mjs imports approveAll from @github/copilot-sdk",
    /import\s*\{\s*[^}]*approveAll[^}]*\}\s*from\s+["']@github\/copilot-sdk["']/.test(mainMjs)
);
assert(
    "main.mjs no longer imports extension from copilot-sdk/extension",
    !/import\s*\{\s*extension\s*\}\s*from\s+["']@github\/copilot-sdk\/extension["']/.test(mainMjs)
);
assert(
    "main.mjs calls joinSession()",
    /const\s+session\s*=\s*await\s+joinSession\s*\(/.test(mainMjs)
);
assert(
    "joinSession call includes onPermissionRequest: approveAll",
    /joinSession\s*\(\s*\{\s*onPermissionRequest\s*:\s*approveAll/.test(mainMjs)
);
assert(
    "main.mjs uses session.getEvents() for history replay",
    /\bsession\.getEvents\s*\(/.test(mainMjs)
 );
assert(
    "main.mjs no longer calls session.getMessages()",
    !/\bsession\.getMessages\s*\(/.test(mainMjs)
);
assert(
    "lib/copilot-webview.js imports joinSession from copilot-sdk/extension",
    /import\s*\{\s*joinSession\s*\}\s*from\s+["']@github\/copilot-sdk\/extension["']/.test(copilotWebviewJs)
);
assert(
    "lib/copilot-webview.js imports approveAll from @github/copilot-sdk",
    /import\s*\{\s*[^}]*approveAll[^}]*\}\s*from\s+["']@github\/copilot-sdk["']/.test(copilotWebviewJs)
);
assert(
    "lib/copilot-webview.js no longer imports extension from copilot-sdk/extension",
    !/import\s*\{\s*extension\s*\}\s*from\s+["']@github\/copilot-sdk\/extension["']/.test(copilotWebviewJs)
);
assert(
    "lib/copilot-webview.js bootstrap joinSession includes onPermissionRequest: approveAll",
    /joinSession\s*\(\s*\{\s*onPermissionRequest\s*:\s*approveAll/.test(copilotWebviewJs)
);

// ── 17. Real extension entrypoint seam ────────────────────────────────────────
console.log("\n[17] Real extension entrypoint seam");

assert(
    'extension.mjs awaits import("./main.mjs")',
    /await\s+import\s*\(\s*["']\.\/main\.mjs["']\s*\)/.test(extensionMjs),
    'Expected awaited import("./main.mjs") in extension.mjs so activation waits for main session setup'
);

const entrypointSuccessProbe = await probeExtensionEntrypoint();
assert(
    "extension.mjs waits for main.mjs evaluation before activation resolves",
    !entrypointSuccessProbe.importError && entrypointSuccessProbe.loaded,
    entrypointSuccessProbe.importError
        ? `Unexpected import error: ${entrypointSuccessProbe.importError.message}`
        : "Entrypoint resolved before the stub main module finished evaluating"
);

const entrypointFailureProbe = await probeExtensionEntrypoint({ shouldFail: true });
assert(
    "extension.mjs logs startup failures instead of rejecting the entrypoint",
    !entrypointFailureProbe.importError &&
        entrypointFailureProbe.logs.some((line) => line.includes("[copilot-avatar] Failed to load extension:")),
    entrypointFailureProbe.importError
        ? `Entrypoint rejected: ${entrypointFailureProbe.importError.message}`
        : "Did not capture the expected startup failure log"
);
assert(
    "extension.mjs logs a stack line for startup failures",
    entrypointFailureProbe.logs.some((line) => line.includes("[copilot-avatar] Stack:")),
    "Did not capture the expected stack log line"
);

// ── Summary ────────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Result: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
    console.error("\nFailed assertions:");
    failures.forEach((label) => console.error(`  ✗ ${label}`));
    process.exit(1);
}
