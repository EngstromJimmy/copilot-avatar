# Vision — Platform Dev

**Project:** CopilotAvatar  
**Owner:** Jimmy Engstrom  
**Stack:** JavaScript, Node.js, MJS, 3D rendering, Copilot CLI, Squad  

## Current Work Status

Implementing and refining sub-agent visibility, identity resolution, and metadata enrichment integration with Copilot SDK.

**Latest Focus:** Late-open naming restoration, sub-agent identity/history replay, mid-run avatar opens.

## Key Learnings — 2026-05-17

- Sub-agent card detail is a dedicated runtime field, not identity metadata. .github/extensions/copilot-avatar/main.mjs should derive 	askSummary/detailText from spawn or runtime descriptions, keep ole separate.
- Idle Squad root text is optional chrome. Keep .github/extensions/copilot-avatar/lib/squad-context.mjs free to send empty statusText/detailText.
- Voice persistence is a webview-owned seam in .github/extensions/copilot-avatar/content/main.js; placeholder rendering must not mutate saved voice until async list proves old voice is invalid.
- Sub-agent activity updates must resolve ownership through both parentToolCallId and runtime 	oolCallId. ssistant.intent, ssistant.usage, and 	ool.execution_complete can arrive without vent.agentId.
- Non-root badge detail should pin to explicit workDescription/	askSummary, and idle/meta tools must not outrank 	hinking.
- Opening the avatar after agents are already running needs runtime-side replay from session.getMessages() in .github/extensions/copilot-avatar/main.mjs.
- subagent.selected is useful as a short-lived identity hint only if bound to concrete gentId once weak event arrives.

## Recent Sessions

### 2026-05-17T20:31:24.735Z — Late-open Naming Session

Full Squadron integration restored for late-open avatar naming. All three agents completed orchestration and final validation:
- **Shuri:** Fixed sub-agent card detail precedence; queued updates until strong identity; resolved Squad names replace placeholders
- **Vision:** Restored thinking/detail wiring; rebuilt active sub-agent identity/history replay for mid-run avatar opens
- **Howard the Duck:** Validated bundle implementation and approved late-open naming fix

**Decisions merged:** 16 inbox entries consolidating sub-agent badge/detail contracts, voice persistence, Squad overlay cleanup, late-open card sequencing, and window behavior directives.

**Key outcome:** Sub-agent identity now flows: (1) cached spawn metadata → (2) Squad casting/roster → (3) generic fallback. Cast names resolve correctly. Late-open windows rebuild identity from session.getMessages() history replay.

## Archived Sessions

**Earlier work documented in history-archive.md:**
- Sub-agent Identity Regression Investigation (May 16-17 early)
- Label Regression Fix & Extension Reload Seam
- Generic-Label Filtering Implementation
- Squad SDK Casting Integration Analysis
- Cast Identity Resolution & Spawn Metadata Binding
- Mic State Handoff Bug & Web-Ready Gating
- Sub-agent Fallback Collapse Fix (May 16)
- Initial identity/badge system design