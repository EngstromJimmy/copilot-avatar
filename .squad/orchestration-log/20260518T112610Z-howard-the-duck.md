# Howard the Duck — Orchestration Log
**Timestamp:** 2026-05-18T11:26:10Z  
**Agent:** Howard the Duck (QA)

## Summary
Reproduced the avatar sub-agent stale-identity bug, rejected Vision's initial revision for identity/materialization gaps, then approved Peter Parker's revision that fixes both with runtime-first identity precedence and card materialization from background-task snapshots.

## Work Delivered
1. **Background Identity Mismatch Review** (decision: 2026-05-18T13:02:05.771+02:00, rejected)
   - Reproduced Vision's mismatch: runtime says Vision, UI shows Tony Stark
   - Found `resolveSubagentDisplayFields()` ranks spawn aliases ahead of runtime names
   - Found `getBackgroundAgentsFromSessionIdle()` omits identity metadata
   - Status: Rejected Vision's revision

2. **Sub-agent Visibility Materialization Review** (decision: 2026-05-18T13:02:05.771+02:00, rejected)
   - Reproduced "spawned again, still no visible change" report
   - Found background reconcile helpers prune stale ids but don't materialize missing cards
   - Found weak updates (`setAgentIntent`, etc.) cannot create first card when `addSubagent` was never sent
   - Status: Rejected Vision's revision (same issues, two angles)

3. **Background Identity Refresh Approval** (decision: 2026-05-18T13:02:05.771+02:00, approved)
   - Reviewed Peter's revision: three key repairs confirmed
   - Verified lightweight probe: `node probe-regression.mjs` → 92 passed, 0 failed
   - Confirmed cards now materialize and identity refreshes from runtime/background
   - Status: Approved

4. **Clippy Feedback Gating Re-review** (decision: 2026-05-18T13:03:44.655+02:00, approved)
   - Confirmed intro/status lead-ins now blocked in Copilot mode
   - Verified extension-side gate: `shouldUseClippySummaryFeedback()` in `main.mjs`
   - Verified webview-side guard: `isClippyAvatar()` checks in `speakClippySummary()` / `flushClippySummary()`
   - Probe result: 81 passed, 0 failed
   - Status: Approved

## Approvals Secured
- Peter Parker's background-identity revision: Approved
- Clippy feedback gating implementation: Approved

## QA Guidance
When team reports sub-agent visibility issues:
1. Check if `addSubagent` / first render handoff was sent (not just weak updates)
2. Check if runtime/background identity is overriding stale spawn aliases
3. Use lightweight probe (`node probe-regression.mjs`) to validate both seams
