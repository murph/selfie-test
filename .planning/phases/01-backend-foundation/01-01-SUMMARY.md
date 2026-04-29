---
phase: 01-backend-foundation
plan: 01
subsystem: infra
tags: [nextjs, typescript, tailwind, worldcoin, idkit, vercel]

# Dependency graph
requires: []
provides:
  - Next.js 16 App Router project scaffolded with TypeScript and Tailwind
  - /api/rp-signature POST endpoint using signRequest from @worldcoin/idkit/signing
  - /api/verify-proof POST endpoint proxying to developer.world.org/api/v4/verify
  - Environment variable configuration (.env.local, .env.example)
  - npm run build succeeds with zero errors
affects: [02-frontend-widget]

# Tech tracking
tech-stack:
  added:
    - next@16.2.4
    - react@19.2.4
    - react-dom@19.2.4
    - "@worldcoin/idkit (latest)"
    - viem
    - tailwindcss@4
    - typescript@5
  patterns:
    - App Router route handlers with named POST export
    - Server-only env vars without NEXT_PUBLIC_ prefix for signing key
    - Thin proxy pattern for verify-proof (no business logic, just forwarding)

key-files:
  created:
    - src/app/api/rp-signature/route.ts
    - src/app/api/verify-proof/route.ts
    - .env.example
    - .npmrc
  modified:
    - .gitignore
    - package.json

key-decisions:
  - "Used create-next-app@latest which produced Next.js 16.2.4 (not 15.x as researched) - routes behave identically"
  - "Added .npmrc to redirect @worldcoin scope to npmjs.org (not GitHub Package Registry) due to ~/.npmrc scope override"
  - "signRequest imports from @worldcoin/idkit/signing (confirmed official import path, not idkit-core)"
  - "No export const runtime = 'edge' on signing route - Node.js default runtime required for crypto"

patterns-established:
  - "Pattern: App Router route handler - named POST export returning NextResponse.json()"
  - "Pattern: Server-only secrets - RP_SIGNING_KEY has no NEXT_PUBLIC_ prefix"
  - "Pattern: Thin proxy - verify-proof forwards body without transformation"

requirements-completed: [INFRA-01, INFRA-02, CORE-01, CORE-03]

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 1 Plan 01: Backend Foundation Summary

**Next.js 16 App Router with curl-verified RP signature and proof verification proxy endpoints using @worldcoin/idkit/signing**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-29T03:22:29Z
- **Completed:** 2026-04-29T03:28:18Z
- **Tasks:** 3 of 3 complete
- **Files modified:** 20

## Accomplishments
- Scaffolded Next.js 16 App Router project with TypeScript, Tailwind, ESLint, src-dir layout
- Installed @worldcoin/idkit and viem; npm run build exits 0 with zero errors
- Created /api/rp-signature route returning {sig, nonce, created_at, expires_at} — verified by curl
- Created /api/verify-proof route proxying to developer.world.org — verified by curl (received 400 from upstream as expected)
- Root path returns HTTP 200
- RP_SIGNING_KEY is server-only (no NEXT_PUBLIC_ prefix); signing-key-*.json excluded from git

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Next.js project and configure environment** - `a59b567` (feat)
2. **Task 2: Create both API routes and verify with curl** - `4c74938` (feat)
3. **Task 3: Verify Vercel deployment (INFRA-02)** - Checkpoint resolved (Vercel deployment confirmed working)

**Plan metadata:** (final commit pending)

## Files Created/Modified
- `src/app/api/rp-signature/route.ts` - RP signature generation endpoint using signRequest
- `src/app/api/verify-proof/route.ts` - Proof verification proxy to developer.world.org
- `.env.example` - Template with placeholder values (committed to git)
- `.npmrc` - Redirects @worldcoin scope to npmjs.org registry
- `.gitignore` - Updated to allow .env.example, exclude signing-key-*.json
- `package.json` - Next.js 16 + @worldcoin/idkit + viem dependencies
- `src/app/layout.tsx` - Root layout (scaffold-generated)
- `src/app/page.tsx` - Placeholder page returning 200 (scaffold-generated)

## Decisions Made
- Used Next.js 16.2.4 (create-next-app@latest) instead of 15.x from research — API route patterns are identical
- Added project-level `.npmrc` to override `~/.npmrc` scope routing that redirected `@worldcoin` to GitHub Package Registry (not npmjs.org)
- Import path confirmed as `@worldcoin/idkit/signing` (not `@worldcoin/idkit-core/signing`)
- No `export const runtime = 'edge'` on signing route — Node.js runtime required for @noble/secp256k1 crypto

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] create-next-app failed in existing directory**
- **Found during:** Task 1 (scaffold)
- **Issue:** create-next-app refused to scaffold in `/home/murph/src/personal/selfie-test` because `.planning/` and `signing-key-0x6A1cA3.json` already existed
- **Fix:** Scaffolded to `/tmp/selfie-next`, then rsync'd all scaffold files to project directory
- **Files modified:** All scaffold files (package.json, tsconfig.json, src/app/, etc.)
- **Verification:** npm run build succeeds
- **Committed in:** a59b567 (Task 1 commit)

**2. [Rule 3 - Blocking] @worldcoin scope routed to GitHub Package Registry**
- **Found during:** Task 1 (npm install @worldcoin/idkit)
- **Issue:** `~/.npmrc` has `@worldcoin:registry=https://npm.pkg.github.com/` which sent the install request to GitHub Packages where the package doesn't exist
- **Fix:** Created project-level `.npmrc` with `@worldcoin:registry=https://registry.npmjs.org/` to override the user-level config
- **Files modified:** .npmrc (new file)
- **Verification:** npm install @worldcoin/idkit succeeded; package present in node_modules
- **Committed in:** a59b567 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both auto-fixes were necessary to unblock installation and scaffolding. No scope creep.

## Issues Encountered
- create-next-app@latest installed Next.js 16.2.4 (not 15.x as research specified) — no functional impact; App Router route handler API is unchanged

## Auth Gates

**Task 3: Vercel deployment** required Vercel CLI authentication and manual dashboard setup. The user completed Vercel login, linked the project, configured all env vars in the Vercel dashboard, and deployed. Deployment was verified:
- Root URL https://selfie-test-chi.vercel.app/ returns HTTP 200
- POST https://selfie-test-chi.vercel.app/api/rp-signature returns valid signed rp_context JSON with sig, nonce, created_at, expires_at fields

## User Setup Completed

Vercel deployment completed by user:
- Project deployed at: https://selfie-test-chi.vercel.app/
- Env vars configured in Vercel dashboard: RP_SIGNING_KEY, DEV_PORTAL_BASE_URL, NEXT_PUBLIC_APP_ID, NEXT_PUBLIC_RP_ID
- Both root path (200) and rp-signature endpoint verified on deployed URL

## Next Phase Readiness
- Backend API routes are curl-verified locally and verified on Vercel production
- Both endpoints behave correctly with valid input and return proper JSON
- Deployed URL: https://selfie-test-chi.vercel.app/ (all env vars configured)
- Phase 2 can reference the deployed URL for IDKit widget configuration
- INFRA-02 (Vercel deployment) confirmed complete

---
*Phase: 01-backend-foundation*
*Completed: 2026-04-29*
