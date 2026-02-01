# Copilot Integration Consultant Protocol

This repository uses an upstream relay workflow to keep backend logic aligned while preserving a custom UI architecture.
When reviewing an upstream-sync pull request (branch: sync/upstream-updates), follow this protocol:

## 1) Categorize Changes
Classify each upstream change into one of:
- Pure Logic/Backend: server, jobs, models, migrations, config, scripts, docs, API logic.
- UI/Frontend: any change touching the UI paths listed in the PR body or affecting user-facing layout/UX.

## 2) Ready for Auto-Merge Summary
If all changes are Pure Logic/Backend and conflicts are resolved:
- Provide a brief summary.
- Mark the PR as "Ready for Auto-Merge".
- Highlight any tests or compatibility checks to run.

## 3) UI Porting Strategy
If any changes affect UI/Frontend:
- Summarize upstream intent and behavior.
- Provide a porting strategy that maps upstream file changes to our modern UI structure.
- Example format:
  - Upstream: client/src/OldMenu.js line 40 updates selection logic.
  - Port to: client/src/components/modern-nav/NewModernNav.tsx line 120 (apply the same selection logic).

## 4) Output Template
Use the following sections in your review comment:
- Changes Classified
- Ready for Auto-Merge (Yes/No)
- Porting Strategy (only if UI impacted)
- Risk Notes / Follow-ups

## 5) Sample Copilot Review Comment (bot-friendly)
Use this template when composing the automated review comment for upstream-sync PRs:

**Copilot Integration Summary**

**Changes Classified:** _<Pure Logic/Backend | UI/Frontend>_

**Files (sample):**
<insert up to 15 files here, grouped by classification>

**Ready for Auto-Merge:** _<Yes/No>_

**Porting Strategy (if UI impacted):**
- Upstream: `client/src/OldMenu.js` line 40 — changed selection logic.
- Port to: `client/src/components/modern-nav/NewModernNav.tsx` line 120 — apply same selection change, adapt types and prop names.

**Risk Notes / Follow-ups:**
- Run `Upstream Compatibility Check` (workflow_dispatch) with `ref=<sync branch>` to validate tests.
- If conflicts exist, resolve in branch then re-run checks.
