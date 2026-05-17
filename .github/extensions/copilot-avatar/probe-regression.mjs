/**
 * Howard the Duck — Regression Probe Suite
 *
 * Coverage:
 *   A. SAM TTS browser-native seam contract (feat/microsoft-sam-tts)
 *   B. Sub-agent visibility: late-open replay + turn_start reset guard
 *   C. SAM browser-only provenance — no remote calls, no CDN/npm sam-js dep [Tony constraint]
 *   D. subagent.selected weak-hint contract — not deterministic correlation [Tony / SDK 0.1.32]
 *   E. generateRetroClippyVoice: clear stub in main.mjs — no remote generation [Shuri pass]
 *
 * Run: node probe-regression.mjs  (from the extension root)
 *
 * Technique: source-assertion probes only — no browser, no test framework.
 * Regex patterns are kept conservative; a pattern match confirms a code path
 * is present. Failures flag regressions or structural drift.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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

// ── 0. Syntax checks ──────────────────────────────────────────────────────────
console.log("\n[0] Syntax checks");

for (const rel of ["main.mjs", "lib/squad-context.mjs"]) {
    try {
        execSync(`node --check "${join(ROOT, rel)}"`, { stdio: "pipe" });
        assert(`node --check ${rel}`, true);
    } catch (e) {
        const msg = (e.stderr?.toString() ?? e.message).trim().split("\n")[0];
        assert(`node --check ${rel}`, false, msg);
    }
}

// content/main.js is browser-targeted JS; Node can still syntax-check it.
try {
    execSync(`node --check "${join(ROOT, "content", "main.js")}"`, { stdio: "pipe" });
    assert("node --check content/main.js", true);
} catch (e) {
    const msg = (e.stderr?.toString() ?? e.message).trim().split("\n")[0];
    assert("node --check content/main.js", false, msg);
}

// ── Load sources ──────────────────────────────────────────────────────────────
const mainJs = readFileSync(join(ROOT, "content", "main.js"), "utf-8");
const mainMjs = readFileSync(join(ROOT, "main.mjs"), "utf-8");
const htmlSrc = readFileSync(join(ROOT, "content", "index.html"), "utf-8");
const squadCtx = readFileSync(join(ROOT, "lib", "squad-context.mjs"), "utf-8");

// ── 1. SAM TTS: HTML UI elements ──────────────────────────────────────────────
console.log("\n[1] SAM TTS: HTML UI elements");

assert('index.html has <option value="sam"> in engine select', htmlSrc.includes('value="sam"'));
assert('index.html has #tts-sam-section container', htmlSrc.includes('id="tts-sam-section"'));
assert('index.html has #sam-voice-select', htmlSrc.includes('id="sam-voice-select"'));
assert('index.html has #tts-sam-test-btn', htmlSrc.includes('id="tts-sam-test-btn"'));

// ── 2. SAM TTS: speak() dispatch routing ──────────────────────────────────────
console.log("\n[2] SAM TTS: speak() dispatch routing");

// speak() must have an explicit sam branch
assert("speak() has engine === 'sam' branch", /engine\s*===\s*['"]sam['"]/.test(mainJs));

// The sam branch must call speakSam — and not fall through to speakWebSpeech
const speakBodyMatch = mainJs.match(
    /function speak\s*\([^)]*\)\s*\{[\s\S]{0,800}speakWebSpeech[\s\S]{0,200}\}/
);
if (speakBodyMatch) {
    assert(
        "speak() sam branch calls speakSam",
        /engine\s*===\s*['"]sam['"][\s\S]{0,60}speakSam/.test(speakBodyMatch[0])
    );
    assert(
        "speak() sam branch does NOT fall straight to speakWebSpeech",
        !/engine\s*===\s*['"]sam['"][\s\S]{0,60}speakWebSpeech/.test(speakBodyMatch[0])
    );
} else {
    assert("speak() body parseable for sam-routing check", false, "Could not isolate speak() body");
    assert("speak() sam branch calls speakSam", false, "Could not isolate speak() body");
}

// ── 3. SAM TTS: speakSam full formant synthesizer contract ───────────────────
//
// Peter's pass: the custom formant synthesizer is confirmed live in HEAD.
// Probes enforce the full implementation chain:
//   speakSam → synthesizeSamAudio → audioBufferToWavDataUrl → Audio.play()
// SAM_PHONEME_DATA (F1/F2 acoustic table) and SAM_VOICES (6 presets with
// pitch/formantShift/rate) must be present as part of the formant engine.
//
console.log("\n[3] SAM TTS: speakSam full formant synthesizer contract");

assert("speakSam function is defined (async)", /async\s+function\s+speakSam\s*\(/.test(mainJs));

// speakSam must call synthesizeSamAudio (the formant synthesis core)
assert(
    "speakSam calls synthesizeSamAudio",
    /async\s+function\s+speakSam\s*\([\s\S]{0,1200}synthesizeSamAudio/.test(mainJs)
);

// speakSam must call audioBufferToWavDataUrl to get a data URL for playback
assert(
    "speakSam calls audioBufferToWavDataUrl",
    /async\s+function\s+speakSam\s*\([\s\S]{0,1200}audioBufferToWavDataUrl/.test(mainJs)
);

// The synthesis helper and acoustic table must be defined
assert(
    "synthesizeSamAudio function is defined",
    /function\s+synthesizeSamAudio\s*\(/.test(mainJs)
);
assert(
    "audioBufferToWavDataUrl function is defined",
    /function\s+audioBufferToWavDataUrl\s*\(/.test(mainJs)
);
assert("SAM_PHONEME_DATA acoustic table is defined", mainJs.includes("SAM_PHONEME_DATA"));

// SAM_VOICES must list the 6 presets by id, each with pitch/formantShift/rate
const voiceIds = ["sam", "elf", "cylon", "vader", "stuffy", "gruff"];
for (const id of voiceIds) {
    assert(`SAM_VOICES includes preset '${id}'`, mainJs.includes(`'${id}'`) || mainJs.includes(`"${id}"`));
}
const svIdx = mainJs.indexOf("const SAM_VOICES");
const svBlock = mainJs.slice(svIdx, svIdx + 600);
assert("SAM_VOICES entries have 'pitch' field", svBlock.includes("pitch:"));
assert("SAM_VOICES entries have 'formantShift' field", svBlock.includes("formantShift:"));
assert("SAM_VOICES entries have 'rate' field", svBlock.includes("rate:"));

// ── 4. SAM TTS: settings persistence round-trip ────────────────────────────────
console.log("\n[4] SAM TTS: settings persistence round-trip");

// samVoice must be written in the saveSettings call
assert(
    "saveTtsSettings: saveSettings() includes samVoice field",
    /saveSettings\s*\(\s*\{[\s\S]{0,1200}\bsamVoice\b[\s\S]{0,400}\}\s*\)/.test(mainJs)
);

// samVoice must be read back from the persisted settings object
assert("loadSettings: savedTts.samVoice restores samVoice", /savedTts\.samVoice/.test(mainJs));

// The samVoiceSelect change listener must call saveTtsSettings
assert(
    "samVoiceSelect 'change' listener calls saveTtsSettings",
    /samVoiceSelect\.addEventListener\s*\(\s*['"]change['"][\s\S]{0,200}saveTtsSettings/.test(mainJs)
);

// ── 5. SAM TTS: persistence ordering — voice survives placeholder phase ────────
console.log("\n[5] SAM TTS: voice selection survives placeholder phase");

const restoreIdx = mainJs.indexOf("savedTts.samVoice");
const populateIdx = mainJs.indexOf("populateSamVoices()");
assert(
    "samVoice restored from savedTts BEFORE populateSamVoices() is called",
    restoreIdx !== -1 && populateIdx !== -1 && restoreIdx < populateIdx,
    `restoreIdx=${restoreIdx}, populateIdx=${populateIdx}`
);

// populateSamVoices preserves the current samVoice selection
assert(
    "populateSamVoices marks selected option by matching samVoice",
    /option\.selected\s*=\s*id\s*===\s*samVoice/.test(mainJs)
);

// populateSamVoices falls back gracefully when samVoice is unrecognised
assert(
    "populateSamVoices handles unrecognised samVoice (fallback)",
    /SAM_VOICES\.some\s*\(\s*v\s*=>\s*v\.id\s*===\s*samVoice\s*\)/.test(mainJs)
);

// DEFAULT_SETTINGS in main.mjs includes samVoice
assert("DEFAULT_SETTINGS.samVoice is defined in main.mjs", /samVoice\s*:\s*['"]sam['"]/.test(mainMjs));

// ── 6. SAM TTS: updateEngineUI shows/hides SAM section ────────────────────────
console.log("\n[6] SAM TTS: updateEngineUI shows/hides SAM section");

assert(
    "updateEngineUI derives isSam from ttsEngine === 'sam'",
    /const\s+isSam\s*=\s*ttsEngine\s*===\s*['"]sam['"]/.test(mainJs)
);
assert(
    "updateEngineUI toggles ttsSamSection.classList hidden",
    /ttsSamSection\.classList\.toggle\s*\(\s*['"]hidden['"]/.test(mainJs)
);
// WebSpeech section is hidden when SAM is active (isSam in the guard)
assert(
    "updateEngineUI hides webspeech section when SAM is active",
    /ttsWebspeechSection\.classList\.toggle\s*\(\s*['"]hidden['"][\s\S]{0,60}isSam/.test(mainJs)
);

// ── 7. SAM TTS: canPreviewCurrentVoice handles SAM engine ─────────────────────
console.log("\n[7] SAM TTS: canPreviewCurrentVoice handles SAM engine");

assert(
    "canPreviewCurrentVoice has sam branch returning samVoiceSelect.options.length",
    /engine\s*===\s*['"]sam['"][\s\S]{0,80}samVoiceSelect\.options\.length/.test(mainJs)
);

// ── 8. Sub-agent visibility: subagent.started calls addSubagent directly ───────
console.log("\n[8] Sub-agent visibility: subagent.started → addSubagent (no tool gate)");

// The live session.on("subagent.started") handler must call addSubagent
assert(
    'session.on("subagent.started") calls addSubagent',
    /session\.on\s*\(\s*["']subagent\.started["'][\s\S]{0,500}addSubagent/.test(mainMjs)
);

// Guard: addSubagent must NOT be gated behind a hadLiveTool / tool-evidence check
const startedHandlerMatch = mainMjs.match(
    /session\.on\s*\(\s*["']subagent\.started["'][^,]*,\s*async\s*\(event\)\s*=>\s*\{([\s\S]{0,700}?)\}\s*\)\s*;/
);
if (startedHandlerMatch) {
    const body = startedHandlerMatch[1];
    assert(
        "subagent.started: addSubagent is NOT gated behind a tool-evidence check",
        !body.includes("hadLiveTool") &&
            !body.includes("seenStarted") &&
            !body.includes("waitForTool")
    );
    // addSubagent appears before any syncPending calls (eagerness check)
    const addIdx = body.indexOf("addSubagent");
    const syncIdx = body.indexOf("syncPending");
    assert(
        "subagent.started: addSubagent fires before syncPending calls",
        addIdx !== -1 && (syncIdx === -1 || addIdx < syncIdx)
    );
} else {
    assert("subagent.started: handler body parseable", false, "Could not isolate handler body");
    assert("subagent.started: addSubagent is NOT gated behind a tool-evidence check", false);
}

// ── 9. Sub-agent visibility: late-open window replay sequence ─────────────────
console.log("\n[9] Sub-agent visibility: late-open window replay sequence");

// syncVisibleWindowState on waitForReady must call all three steps in order
// Use a wider window to capture the full function body
const syncFnMatch = mainMjs.match(
    /async\s+function\s+syncVisibleWindowState[\s\S]{0,1800}?replayToWebview\s*:\s*true/
);
if (syncFnMatch) {
    const body = syncFnMatch[0];
    const clearIdx = body.indexOf("clearSubagents");
    const resetIdx = body.indexOf("resetSubagentRuntimeState");
    const hydrateIdx = body.indexOf("hydrateSubagentRuntimeFromHistory");
    assert(
        "syncVisibleWindowState: clearSubagents called before rehyd",
        clearIdx !== -1 && clearIdx < hydrateIdx
    );
    assert(
        "syncVisibleWindowState: resetSubagentRuntimeState called before rehyd",
        resetIdx !== -1 && resetIdx < hydrateIdx
    );
    assert(
        "syncVisibleWindowState: hydrateSubagentRuntimeFromHistory called with replayToWebview: true",
        hydrateIdx !== -1
    );
} else {
    assert("syncVisibleWindowState: function body parseable", false, "Could not isolate function body");
    assert("syncVisibleWindowState: clearSubagents called before rehyd", false);
    assert("syncVisibleWindowState: resetSubagentRuntimeState called before rehyd", false);
    assert("syncVisibleWindowState: hydrateSubagentRuntimeFromHistory with replayToWebview: true", false);
}

// ── 10. Sub-agent visibility: assistant.turn_start reset guard ────────────────
//
// KNOWN RISK (not a current code defect, documented for awareness):
// If the root agent begins a SECOND turn (no agentId) AFTER subagent.started × N
// during a multi-step coordinator loop, resetHydratedSubagentRuntimeState wipes
// activeSubagentsByAgentId, making those N agents invisible in a late-open replay.
// The current guard ensures reset fires only for root-agent turns (no agentId), but
// a multi-round coordinator can still hit this path legitimately. This was the
// probable cause of the "three running agents not visible" failure.
//
console.log("\n[10] Sub-agent visibility: assistant.turn_start reset guard");

assert(
    'history replay: assistant.turn_start reset fires only when !event.agentId',
    /["']assistant\.turn_start["'][\s\S]{0,100}if\s*\(\s*!event\.agentId\s*\)[\s\S]{0,80}resetHydratedSubagentRuntimeState/.test(
        mainMjs
    )
);

// Verify there is no unconditional resetHydratedSubagentRuntimeState in a
// turn_start case block — strip the guarded form first to catch any stray call.
const strippedForReset = mainMjs.replace(
    /if\s*\(\s*!event\.agentId\s*\)\s*\{[\s\S]{0,200}?resetHydratedSubagentRuntimeState[\s\S]{0,200}?\}/g,
    "/* GUARDED_RESET */"
);
assert(
    "history replay: NO unconditional resetHydratedSubagentRuntimeState in turn_start case",
    !/["']assistant\.turn_start["'][\s\S]{0,200}resetHydratedSubagentRuntimeState/.test(strippedForReset)
);

// ── 11. Sub-agent name resolution: resolveSquadAgentMetadata key variants ─────
console.log("\n[11] Sub-agent name resolution: key variant lookup");

// Must try all four display-name variants
for (const prop of ["spawnDisplayName", "spawnName", "agentName", "agentDisplayName"]) {
    assert(
        `resolveSquadAgentMetadata: normalizeAgentKey called on ${prop}`,
        new RegExp(`normalizeAgentKey\\s*\\(\\s*agentData\\.${prop}`).test(squadCtx)
    );
}
// Must also try stable agentId via isStableLookupAgentId
assert(
    "resolveSquadAgentMetadata: stable agentId used as lookup key",
    /isStableLookupAgentId\s*\(\s*agentData\.agentId\s*\)/.test(squadCtx)
);

// ── 12. Sub-agent identity: GENERIC_AGENT_LABELS suppresses noisy names ───────
console.log("\n[12] Sub-agent identity: GENERIC_AGENT_LABELS suppression");

assert(
    "GENERIC_AGENT_LABELS set is defined in main.mjs",
    /const\s+GENERIC_AGENT_LABELS\s*=\s*new\s+Set/.test(mainMjs)
);
for (const label of ["general-purpose agent", "general purpose agent", "coding agent"]) {
    assert(
        `GENERIC_AGENT_LABELS includes '${label}'`,
        mainMjs.includes(label)
    );
}

// ── 13. SAM TTS: browser-only — no remote calls, no CDN import ────────────────
//
// Tony's constraint: SAM synthesis must be 100% browser-native Web Audio API.
// The old tetyys.com remote SAM path must be absent. No external library import.
//
console.log("\n[13] SAM TTS: browser-only synthesis — no remote calls");

// No reference to old remote SAM server
assert("SAM: no tetyys.com reference in main.js", !mainJs.includes("tetyys"));
assert("SAM: no tetyys.com reference in index.html", !htmlSrc.includes("tetyys"));

// No CDN or npm sam-js import in main.js (library was removed; synthesis is custom)
assert(
    "SAM: no 'import SamJs' CDN/npm dependency in main.js",
    !/import\s+SamJs\b/.test(mainJs) && !/from\s+['"]sam-js['"]/.test(mainJs)
);

// synthesizeSamAudio uses OfflineAudioContext — browser Web Audio path confirmed
const synthStart = mainJs.indexOf("function synthesizeSamAudio");
const synthEnd = mainJs.indexOf("\nfunction ", synthStart + 1);
const synthBody = mainJs.slice(synthStart, synthEnd > 0 ? synthEnd : synthStart + 2000);
assert(
    "SAM: synthesizeSamAudio uses OfflineAudioContext (browser Web Audio)",
    synthBody.includes("OfflineAudioContext")
);

// samG2P is confirmed present in Peter's implementation — absence is now a failure.
const g2pStart = mainJs.indexOf("function samG2P(");
assert("SAM: samG2P function is present (confirmed live in Peter's pass)", g2pStart !== -1);
if (g2pStart !== -1) {
    const g2pWindow = mainJs.slice(g2pStart, g2pStart + 3200);
    assert("SAM: samG2P contains no fetch() call", !g2pWindow.includes("fetch("));
    assert("SAM: samG2P contains no XMLHttpRequest", !g2pWindow.includes("XMLHttpRequest"));
} else {
    assert("SAM: samG2P contains no fetch() call", false, "samG2P absent — unexpected in full implementation");
    assert("SAM: samG2P contains no XMLHttpRequest", false, "samG2P absent");
}

// speakSam must use only local synthesis — no fetch, no WebSocket, no remote URL
const speakSamBodyMatch = mainJs.match(/async\s+function\s+speakSam\s*\([\s\S]{0,1200}?\n\}/);
if (speakSamBodyMatch) {
    const speakSamBody = speakSamBodyMatch[0];
    assert("SAM: speakSam contains no fetch() call", !speakSamBody.includes("fetch("));
    assert("SAM: speakSam contains no XMLHttpRequest", !speakSamBody.includes("XMLHttpRequest"));
    assert("SAM: speakSam contains no WebSocket", !speakSamBody.includes("WebSocket"));
} else {
    assert("SAM: speakSam body parseable", false, "Could not isolate speakSam body");
    assert("SAM: speakSam contains no fetch() call", false);
    assert("SAM: speakSam contains no XMLHttpRequest", false);
}

// ── 14. Sub-agent selection hint: not used as deterministic correlation ────────
//
// Tony's constraint (SDK 0.1.32): subagent.selected carries no reliable toolCallId,
// so it cannot deterministically identify which runtime agent was selected in a
// concurrent scenario. The code must treat it as a weak, pending hint only.
//
console.log("\n[14] subagent.selected: weak hint only — not deterministic correlation");

// Live handler must route to setPendingSubagentSelectionHint, not addSubagent
assert(
    "live subagent.selected handler calls setPendingSubagentSelectionHint",
    /session\.on\s*\(\s*["']subagent\.selected["'][\s\S]{0,300}setPendingSubagentSelectionHint/.test(mainMjs)
);
assert(
    "live subagent.selected handler does NOT call addSubagent (no card creation)",
    !/session\.on\s*\(\s*["']subagent\.selected["'][\s\S]{0,300}addSubagent/.test(mainMjs)
);
assert(
    "live subagent.selected handler does NOT call callWindowFunction",
    !/session\.on\s*\(\s*["']subagent\.selected["'][\s\S]{0,300}callWindowFunction/.test(mainMjs)
);

// History replay case must also route to setPendingSubagentSelectionHint
assert(
    "history replay subagent.selected case calls setPendingSubagentSelectionHint",
    /["']subagent\.selected["'][\s\S]{0,100}setPendingSubagentSelectionHint/.test(mainMjs)
);

// shouldBindPendingSelectionHint must require a truthy agentId before binding
assert(
    "shouldBindPendingSelectionHint: guards on !agentId before binding",
    /function\s+shouldBindPendingSelectionHint[\s\S]{0,200}!agentId/.test(mainMjs)
);

// Binding should only happen via shouldBindPendingSelectionHint — not via a
// direct hintsByAgentId.set inside the subagent.selected handler itself.
const liveSelHandlerMatch = mainMjs.match(
    /session\.on\s*\(\s*["']subagent\.selected["'][^,]*,\s*\(event\)\s*=>\s*\{([\s\S]{0,400}?)\}\s*\)\s*;/
);
if (liveSelHandlerMatch) {
    const body = liveSelHandlerMatch[1];
    assert(
        "live subagent.selected handler does NOT directly call hintsByAgentId.set",
        !body.includes("hintsByAgentId.set")
    );
} else {
    assert("live subagent.selected: handler body parseable", false, "Could not isolate handler body");
}

// ── 15. generateRetroClippyVoice: clear stub in main.mjs ─────────────────────
//
// Shuri's pass: the remote tetyys.com SAPI4 path was removed. The function must
// be a clear stub — it throws an Error (does not generate audio remotely) and
// contains no outbound calls. The comment/throw together act as a seam marker
// for a future browser-native implementation.
//
console.log("\n[15] generateRetroClippyVoice: stub in main.mjs — no remote generation");

// Function must exist (it is the seam, not deleted)
assert(
    "generateRetroClippyVoice function is defined in main.mjs",
    /generateRetroClippyVoice\s*\(\s*\)\s*\{/.test(mainMjs)
);

// Stub must signal unavailability via throw / Error — not silently no-op
assert(
    "generateRetroClippyVoice throws Error (stub signals unavailability)",
    /generateRetroClippyVoice[\s\S]{0,200}throw\s+new\s+Error\s*\(/.test(mainMjs)
);

// No remote generation — must not fetch, call XMLHttpRequest, or reference tetyys
const retroStart = mainMjs.indexOf("generateRetroClippyVoice");
if (retroStart !== -1) {
    const retroWindow = mainMjs.slice(retroStart, retroStart + 500);
    assert("generateRetroClippyVoice: no fetch() call", !retroWindow.includes("fetch("));
    assert("generateRetroClippyVoice: no XMLHttpRequest", !retroWindow.includes("XMLHttpRequest"));
    assert("generateRetroClippyVoice: no active tetyys.com URL", !retroWindow.includes("https://tetyys"));
} else {
    assert("generateRetroClippyVoice: function body parseable", false, "Function not found in main.mjs");
    assert("generateRetroClippyVoice: no fetch() call", false);
    assert("generateRetroClippyVoice: no active tetyys.com URL", false);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Result: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
    console.error("\nFailed assertions:");
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
}
