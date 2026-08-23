---
Task ID: 1
Agent: main
Task: Fix Prisma error and AI chat issues

Work Log:
- Identified root cause: AI chat route used `db.user.findMany({ where: { sentFriendRequests: ... } })` which fails on deployed Prisma client
- Replaced with `db.friendship.findMany()` direct query (same pattern as working /api/friends)
- Added `prisma generate` to build script to prevent stale client issues on Vercel
- Fixed confirmExpense bug: exact/percentage splits were filtering out "me", causing user's own split to be lost
- Added single expense guard: skip splits processing for personal expenses
- Audited all 15+ API routes - no other Prisma relation field issues found

Stage Summary:
- AI chat now works: friends query uses db.friendship.findMany() instead of User relation fields
- AI expense creation: exact/percentage splits now correctly include "me" with user's ID
- Build script runs prisma generate before next build
- All fixes pushed to GitHub (commits 9eead03, 12285c3)
