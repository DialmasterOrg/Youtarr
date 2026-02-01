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
