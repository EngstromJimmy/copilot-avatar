# Vision — Platform Dev — Archived Sessions

## 2026-05-17 — Sub-agent Identity Regression Investigation (CONSOLIDATED)

**Problem:** UI displays generic "general-purpose" agent placeholder instead of Squad cast names and roles.

**Root Cause — Seam Misalignment:**
Commit c8724b0 added webview-side low-confidence detection without matching extension-layer filter logic. Extension sends generic labels (line 405 fallback) before Squad enrichment, breaking contract.

**Mechanism:**
```
Copilot SDK { agentDisplayName: "General Purpose Agent" }
    ↓ (no filter in main.mjs)
webview receives { displayName: "Generic label", role: "" }
    ↓ (no Squad fallback in payload)
Renders generic placeholder
```

**Last Working:** Commit 3d4ed87 — Squad metadata properly consulted, no webview-side filter yet.

**Fix Direction:** Mirror webview `isLowConfidenceLabel()` in extension before line 405 fallback. If low-confidence AND squadAgent exists, prefer Squad displayName + role over generic Copilot labels. Apply to all three handlers (started/completed/failed).

**Key Insight:** Webview filtering is good hygiene but insufficient—extension must filter at source (Copilot ↔ Squad boundary) so Squad metadata reaches payload for all cases.

## 2026-05-17 — Auto-Generated Squad Files in .gitattributes

**What:** Marked squad state files as auto-generated for GitHub PR collapse.

**Changes Applied:**
1. Added `generated=true` to: `.squad/log/**`, `.squad/orchestration-log/**`, health reports, precheck reports, state markers, temp files
2. Preserved union merge: `.squad/decisions.md`, `.squad/agents/*/history.md`, `.squad/log/**`, `.squad/orchestration-log/**`

**Why:** Auto-generated files change frequently; marking them collapses diffs in PR review, keeping focus on actual code changes. Union merge remains for distributed team workflow.

## 2026-05-16 — Sub-agent Fallback Collapse Fix

**Problem:** Reconnects after context change could mint third generic card beside two real Copilot-owned agents.

**Root Issues:**
1. Cached metadata lost during rehydration
2. Fallback identity keyed to opaque runtime IDs instead of human labels
3. Collapse not invoked at all rehydration/render points

**Fixes Applied:**
1. Preserve cached identity metadata during rehydrate
2. Derive fallback identity only from human labels (displayName, agentName)
3. Invoke collapse on first-render, rehydrate, and webview addSubagent
4. Avoid fallback to runtime agentId

**Result:** Reconnects maintain exactly 2 visible cards without minting third generic card. Full coverage achieved.

## 2026-05-15+ — Older Sessions

Earlier work consolidated into this archive:
- Squad sub-agent display integration analysis
- Initial sub-agent naming fix (agentId lookup approach, later superseded)
- Implementation of corrected sub-agent display name lookup
- Copilot-owned sub-agent visibility implementation
- First-render gate removal
- Multi-agent identity & badge system design review
