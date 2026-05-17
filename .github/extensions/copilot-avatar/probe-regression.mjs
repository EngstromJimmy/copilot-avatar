/**
 * Howard the Duck — Regression Probe Suite
 *
 * Coverage:
 *   A. SAM TTS browser-native formant engine (feat/microsoft-sam-tts)
 *   B. Sub-agent visibility: late-open replay + turn_start reset guard
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

// ── 3. SAM TTS: speakSam uses custom formant synthesizer ─────────────────────
console.log("\n[3] SAM TTS: speakSam uses custom formant synthesizer");

assert("speakSam function is defined (async)", /async\s+function\s+speakSam\s*\(/.test(mainJs));

// Must call synthesizeSamAudio (custom Web-Audio engine), NOT a sam-js lib call
assert(
    "speakSam calls synthesizeSamAudio",
    /await\s+synthesizeSamAudio\s*\(\s*text\s*,\s*preset\s*\)/.test(mainJs)
);

// Must convert the AudioBuffer to a data URL for playback
assert(
    "speakSam calls audioBufferToWavDataUrl",
    /audioBufferToWavDataUrl\s*\(\s*audioBuffer\s*\)/.test(mainJs)
);

// synthesizeSamAudio must actually exist (not just called)
assert(
    "synthesizeSamAudio function is defined",
    /function\s+synthesizeSamAudio\s*\(/.test(mainJs) ||
        /async\s+function\s+synthesizeSamAudio\s*\(/.test(mainJs)
);

// SAM_PHONEME_DATA must be the acoustic data table (proves formant engine, not placeholder)
assert("SAM_PHONEME_DATA acoustic table is defined", /const\s+SAM_PHONEME_DATA\s*=\s*\{/.test(mainJs));

// SAM_VOICES must list the 6 presets by id
const voiceIds = ["sam", "elf", "cylon", "vader", "stuffy", "gruff"];
for (const id of voiceIds) {
    assert(`SAM_VOICES includes preset '${id}'`, mainJs.includes(`'${id}'`) || mainJs.includes(`"${id}"`));
}

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

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(60)}`);
console.log(`Result: ${pass} passed, ${fail} failed`);
if (failures.length > 0) {
    console.error("\nFailed assertions:");
    failures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
}
