---
Task ID: 1
Agent: Main
Task: Fix AI decommissioned model error + History page "Something went wrong" crash

Work Log:
- Diagnosed AI error: Groq decommissioned `llama3-70b-8192`, replaced with `gemma2-9b-it` in groq.ts
- Built project successfully - no compile errors found for history page
- Ran subagent audit of all 8 view components for render-time crash risks
- Found crash bugs in friends-view.tsx (friend.email.charAt(0) without optional chaining), settle-view.tsx (.toFixed(2) on null amounts), expense-detail-dialog.tsx (same issues)
- Root cause: ErrorBoundary wrapped entire AppShell, so ANY view crash killed the whole app including history
- Added per-view ViewErrorBoundary in app-shell.tsx ViewRouter - each view now isolated
- Fixed all .toFixed(2) calls on raw API data across 5 files to use (Number(x) || 0).toFixed(2)
- Fixed split.userName.charAt(0) and friend.email.charAt(0) with optional chaining
- Verified build passes, pushed to GitHub

Stage Summary:
- AI fix: llama3-70b-8192 → gemma2-9b-it in fallback models
- History fix: Per-view error boundaries prevent one crash from killing entire app
- Defensive fixes: 10+ .toFixed() and .charAt() null safety fixes across 5 files
- Deployed: commit 1d1238f pushed to main
