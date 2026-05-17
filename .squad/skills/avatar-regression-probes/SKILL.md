---
name: "avatar-regression-probes"
description: "Validate Squad avatar regressions with alias-resolution probes and source assertions around reset paths."
domain: "testing, extension-ui"
confidence: "high"
source: "earned"
---

## Context
Use this when CopilotAvatar changes touch Squad identity, sub-agent badges, or session-to-session replay behavior. The repo has no built-in test suite for the extension, so reliable review work needs a compact probe that exercises both the data seam and the UI-state seam.

## Patterns
- Run `node --check` on `.github/extensions/copilot-avatar/main.mjs`, `.github/extensions/copilot-avatar/lib/squad-context.mjs`, and `.github/extensions/copilot-avatar/content/main.js` before trusting anything else.
- Probe `loadSquadContext()` from the repo root and from a clearly non-Squad cwd to verify both the positive and negative paths.
- Use `resolveSquadAgentMetadata()` against casting aliases like `lead`, `backend-dev`, and `tester` so roster-name regressions show up immediately.
- Add targeted source assertions for stale-state boundaries: reset every runtime cache in `main.mjs`, clear non-root avatars in `content/main.js`, and keep the reset wired to session start, context change, and scope drift.
- Add a prompt-boundary assertion: `assistant.turn_start` must clear sub-agent runtime state before any Squad-context refresh or replay hook runs, or prior-turn Copilot-presence/tool state can resurrect a whole graveyard of cards for one ugly flash.
- Add targeted source assertions for no-terminal-event leaks: if a visible sub-agent finishes its last tool without a matching `subagent.completed` / `subagent.failed`, the extension still needs a fallback retire path instead of leaving an idle ghost on screen until the next directive.
- Add a late-open stale-card assertion: before replaying `session.getMessages()` back into an open webview, clear non-root avatars and reset backend sub-agent caches so idle background agents from older turns cannot survive as fake live cards.
- For stale-idle ghost checks, live-probe the page by queueing `setAgentIntent` / `setAgentActivity` / `setAgentThinking` for a missing non-root `agentId`, rendering a generic stale card, calling `clearSubagents({ preserveRoot: true })`, then re-adding that same `agentId` with a real name. The card must come back `Idle` with empty detail, proving both visible ghosts and pending UI caches were actually wiped.
- Add targeted source assertions for the live-signal paths: placeholder labels should yield to Squad names, per-subagent model hooks should still flow through `assistant.usage` / `tool.execution_complete` / `session.model_change`, and `getAvatarBadgeText()` should still prefer current activity text.
- Add a root-overlay suppression assertion: if Squad idle chrome should be silent, clear `statusText` / `detailText` in the runtime payload and make the webview honor explicit empty strings instead of reviving fallback copy like `Squad ready`.
- Add a visibility-ownership assertion: `subagent.started` should be enough to drive `addSubagent` for a Copilot-owned runtime agent, with no extra first-render debounce or tool-evidence gate layered on top.
- Add a wrapper-tool assertion for the root agent: parent spawn tools such as `task`, `agent`, and `runSubagent` should not mirror into the root badge/subtask overlay unless the product explicitly wants that orchestration text visible.
- Add a duplicate-identity probe: two different runtime `agentId` values that both resolve to the same cast identity (for example `Tony Stark`) must not remain visible together unless the product explicitly wants parallel clones.
- Add targeted source assertions for Squad-only root visuals: root accessories should be created only for `ROOT_AGENT_ID`, then toggled from `window.setSquadContext(payload.active)` instead of any separate cwd sniff inside the webview.
- If an extension pushes state immediately after `webview.show()`, add a page-owned readiness latch (for example `window.__copilotAvatarReady`) and wait for it before sending root-only state like `setSquadContext()`. A live handle or websocket alone does not prove the page module has finished defining its API.
- If a root-only Squad signal can arrive before the root avatar exists, latch it in page state and replay it during `initializeRootAvatar()` / root-avatar creation so the first visible frame picks up the correct chrome.
- For late-open badge regressions, queue `setAgentThinking` / `setAgentIntent` / `setAgentActivity` against a missing non-root `agentId`, assert no `.subagent-label[data-agent-id="..."]` exists yet, then send `addSubagent` with the resolved Squad payload and verify the card appears with the cast name, visible thinking/running badge state, and the assigned work description in `.agent-detail`.
- After a real read-only probe, poll the live avatar window and count visible cards by display name. Static regex/source assertions can all pass while duplicate cast cards or blank idle ghosts still survive in the rendered UI.
- To prove two named agents are visible together, overlap a long-running read-only lead/root probe with a second read-only sub-agent probe, then snapshot the live `.subagent-label` cards immediately during that overlap window.
- If the user explicitly wants to see specific cast identities and the live runtime does not surface them, stage a transient webview-only demo with `clearSubagents({ preserveRoot: true })`, `addSubagent`, `setAgentIntent`, and `setAgentActivity` after the real probe. Use it to make Tony/Howard/etc. visibly inspectable, but never mistake that demo for evidence that the runtime event pipeline is healthy.
- Before blaming the webview, check which `copilot-avatar` extension process is actually running and reload extensions after local `.github/extensions/copilot-avatar/*.mjs` edits. A live avatar window can keep stale extension behavior even when the on-disk source already contains the identity fix.
- When refining Squad-only root flair, keep the silhouette minimal: reuse the same root lifecycle hooks, with a face-side curved mic boom + compact capsule. Preferred finish is dark graphite (`0x1c1c1c`). Extend the boom curve from the temple/ear region down to the mouth with 5–6 CatmullRom points for a natural arc without an ear-ring anchor.

## Examples
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` should resolve `tester` → `Howard the Duck`, `backend-dev` → `Peter Parker`, `lead` → `Tony Stark`.
- `.github/extensions/copilot-avatar/main.mjs` should call `resetSubagentRuntimeState({ clearUi: true })` before rehydrating later views.
- `.github/extensions/copilot-avatar/main.mjs` should clear non-root cards, reset sub-agent caches, and then hydrate from `session.getMessages()` when a late-open/reload path rebuilds the avatar window.
- `.github/extensions/copilot-avatar/main.mjs` should run `resetSubagentRuntimeState({ clearUi: true })` inside `assistant.turn_start` before `refreshVisibleSquadContext()` / `syncKnownSubagents()` can replay anything.
- `.github/extensions/copilot-avatar/main.mjs` should call `ensureSubagentVisible()` from `subagent.started` instead of waiting for `tool.execution_start` / `tool.execution_progress` to unlock first render.
- `.github/extensions/copilot-avatar/lib/squad-context.mjs` can keep `getSquadWindowContext()` active while sending blank `statusText` / `detailText`, and `.github/extensions/copilot-avatar/content/main.js` should preserve those blanks instead of falling back to `Squad ready`.
- `.github/extensions/copilot-avatar/content/main.js` should expose `clearSubagents({ preserveRoot: true })` so stale Squad cards disappear when Squad turns off.
- `.github/extensions/copilot-avatar/main.mjs` can gate root-level `setAgentActivity` / `setSubtask` calls behind a helper like `shouldMirrorRootToolActivity()` so wrapper tools do not flash `task` on the root overlay.
- `.github/extensions/copilot-avatar/main.mjs` should not rely on `tool.execution_complete` as a cosmetic-only event; if the SDK skips a terminal sub-agent event, a visible card still needs a fallback way to retire.
- `.github/extensions/copilot-avatar/content/main.js` can attach `createSquadMicBoom()` inside `createAvatarInstance()` for the root avatar, then flip it through `updateRootSquadMicBoom()` when `window.setSquadContext()` changes.
- `.github/extensions/copilot-avatar/main.mjs` can poll `window.__copilotAvatarReady === true` before calling `window.setSquadContext(...)`, so the first Squad payload is not dropped during page bootstrap.
- `.github/extensions/copilot-avatar/content/main.js` should call `updateRootSquadMicBoom(rootAvatar)` inside `initializeRootAvatar()` so an already-latched `squadRootMicActive` flag still lights up the mic when the mesh appears.
- A live overlap snapshot can legitimately show `Tony Stark` and `Howard the Duck` together while the root card stays idle; verify the named sub-agent cards by display name, model row, and badge text before the overlap collapses.

## Anti-Patterns
- Approving a stale-state fix without checking both backend cache reset and webview avatar clearing.
- Approving a suppression fix that only clears ghosts on the next directive while letting same-turn no-completion agents pile up as idle cards.
- Verifying Squad names only with cast slugs while ignoring slot aliases that real events use.
- Keying visible-card coexistence only by runtime `agentId` and never checking whether two cards collapse to the same cast identity.
- Checking model wiring only on the root agent and missing per-subagent updates.
- Treating static code search as enough without at least one positive and one negative `loadSquadContext()` probe.
- Clearing the runtime payload but leaving `payload.statusText || '● Squad ready'` in the webview; explicit empty strings must survive the handoff when silence is the desired UI state.
- Signing off after regex/source checks without one live avatar-window poll; duplicate `Howard the Duck`-style ghosts and blank idle cards can slip through.
- Polling only after the overlap window ends and treating the missing cards as proof that concurrent visibility never happened.
- Detecting Squad a second time inside `content/main.js` and letting root-only Squad visuals leak into normal Copilot sessions.
- Treating `webview.show()` or the initial websocket as proof that `window.setSquadContext` already exists.
- Assuming `window.setSquadContext()` always runs after `initializeRootAvatar()`; on a fast webview connection the signal can arrive first, and the root chrome stays stale unless initialization reapplies the latched flag.
- Assuming the live avatar is already running the current project extension code without checking the loaded extension source or reloading it after local extension changes.
- Layering a second Squad accessory on top of the existing root flair instead of refactoring the old geometry out first.
