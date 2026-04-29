# Stack Research

**Domain:** World ID IDKit v4 integration — minimal Next.js webapp
**Researched:** 2026-04-28
**Confidence:** MEDIUM (core stack HIGH; selfieCheckLegacy specifics LOW — beta feature with limited public docs)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 15.x (LTS) | Framework — pages + API routes | Next.js 15 is LTS through Oct 2026; Next.js 16 has breaking async API changes that add migration cost for zero benefit in a minimal test tool. App Router is the standard pattern; Route Handlers replace pages/api. |
| React | 18.x (peer dep) | UI rendering | @worldcoin/idkit peer dep is `react ">18.0.0"`. Next.js 15 ships React 18 by default. React 19 compatibility with IDKit has a known open issue (framer-motion peer conflict in idkit-js@2.x line); v4.x resolves this but verify at install time. |
| TypeScript | 5.x | Type safety | Next.js 15 defaults to TypeScript. IDKit exports `RpContext` and other types used in the integration. Mandatory for catching rp_context shape errors at compile time. |
| @worldcoin/idkit | 4.1.3 | React widget — IDKitRequestWidget, preset exports | This is the React package. Exports `IDKitRequestWidget`, `orbLegacy`, `selfieCheckLegacy` (beta), and `RpContext` type. Current latest stable is 4.1.3. |
| @worldcoin/idkit-core | 4.1.3 | Server-side signing — signRequest | Ships `./signing` subpath export used for `signRequest`. Pure TypeScript, no browser dependencies. Same version as idkit (pinned). |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.x | Minimal page styling | For the single-page "scan QR / Verified!" UI. create-next-app ships Tailwind v4 for new projects; zero config for minimal styling needs. |
| dotenv / Next env loading | built-in | Environment variables | Next.js natively loads `.env.local`; no extra library needed. `NEXT_PUBLIC_` prefix for client-safe vars; signing key must be non-prefixed (server-only). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `create-next-app@latest` | Scaffold project | Run with `--typescript --tailwind --eslint --app`; selects App Router by default (recommended). |
| ESLint + eslint-config-next | Lint | Bundled with create-next-app. Catches common App Router mistakes. |
| Vercel CLI | Deployment | `npm i -g vercel` then `vercel deploy`. Reads `NEXT_PUBLIC_*` and private env vars from Vercel dashboard. |

---

## Installation

```bash
# Scaffold (choose App Router when prompted, or pass flags)
npx create-next-app@latest selfie-test --typescript --tailwind --eslint --app

cd selfie-test

# World ID IDKit — React widget + core signing
npm install @worldcoin/idkit@4.1.3 @worldcoin/idkit-core@4.1.3
```

No additional runtime dependencies needed. The signing key lives in `.env.local` (never committed).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Next.js 15 (LTS) | Next.js 16 | If starting a new long-lived production app that needs Turbopack, Cache Components, or React 19.2 features — not this test tool. |
| App Router Route Handlers | Pages Router API Routes | Pages Router is the older pattern; App Router Route Handlers are the current standard. Pages Router still works but is not the recommended path for new projects. |
| App Router Route Handlers | Server Actions ("use server") | Server Actions are designed for internal component mutations. Route Handlers are correct for endpoints called by client fetch() or external services — which is what the signing endpoint is. |
| Next.js (monorepo) | Separate Express/Node backend | Unnecessary complexity. Next.js Route Handlers cover server-side signing and verification forwarding within one deployment unit. |
| Tailwind CSS | CSS Modules / styled-components | Either works for this scope. Tailwind is the create-next-app default and zero-config. For a test tool with one page, pick whatever ships fastest. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@worldcoin/idkit-js` (idkit-js repo, v2.x) | The `worldcoin/idkit-js` repo was archived April 14, 2026 and is read-only. Latest version was 2.4.2 — this is NOT the v4 SDK. | `@worldcoin/idkit@4.1.3` from the `worldcoin/idkit` repo |
| `@worldcoin/idkit-standalone` | v2.x standalone widget; same archived repo lineage, not v4. | `@worldcoin/idkit@4.1.3` (React component) |
| `NEXT_PUBLIC_` prefix on signing key | Would expose RP signing key to the browser. Security critical — the key must never reach the client. | Non-prefixed env var (`RP_SIGNING_KEY`) loaded only in Route Handlers / server code |
| Client-side `signRequest` calls | The World ID docs are explicit: "Never generate RP signatures on the client and never expose your RP signing key." | Next.js Route Handler (`/api/rp-signature`) that calls `signRequest` server-side |
| Hardcoded `app_id`, `rp_id`, signing key | Credentials committed to git are a security incident. `app_4c0f2b7ac8e5f61b994ff642c8670c62` and `rp_af321e6c2016688e` are the real values per PROJECT.md. | `.env.local` for development; Vercel environment variables for production |
| `pages/api/` directory | Old Pages Router pattern. Mixes routing conventions with App Router. | App Router Route Handlers: `app/api/rp-signature/route.ts` |

---

## Stack Patterns by Variant

**For the signing endpoint:**
- Use `app/api/rp-signature/route.ts` with `export async function POST(request: Request)`
- Import `signRequest` from `@worldcoin/idkit-core/signing`
- Return `{ nonce, created_at, expires_at, signature }` — client passes this to `rp_context`

**For the verification endpoint:**
- Use `app/api/verify/route.ts`
- Forward IDKit proof payload as-is to `POST https://developer.world.org/api/v4/verify/{rp_id}`
- No nullifier storage needed (per PROJECT.md — test tool only)

**For the frontend widget:**
- Use `IDKitRequestWidget` from `@worldcoin/idkit` as a Client Component (`"use client"`)
- Pass `preset={selfieCheckLegacy()}` (or `selfieCheckLegacy({ signal: "..." })` if binding signal)
- Fetch `rp_context` from `/api/rp-signature` on mount before opening the widget
- `handleVerify` callback POSTs to `/api/verify`

**For Vercel deployment:**
- `vercel env add RP_SIGNING_KEY` (secret, not NEXT_PUBLIC)
- `vercel env add NEXT_PUBLIC_APP_ID` (client-safe)
- `vercel env add NEXT_PUBLIC_RP_ID` (client-safe — rp_id is not secret, signing key is)
- `vercel deploy` with no additional config; Next.js 15 is natively supported

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `@worldcoin/idkit@4.1.3` | `react >=18.0.0`, `react-dom >=18.0.0` | React 19 peer dep compatibility had a known issue in idkit-js v2.x (framer-motion). v4.1.3 drops that dependency. Verify peer dep resolution at install. |
| `@worldcoin/idkit-core@4.1.3` | No peer deps | Pure TypeScript. Depends on `@noble/hashes ^1.7.2` (bundled) and `@worldcoin/idkit-server@1.1.1` (bundled). No browser environment needed — safe for Node.js Route Handlers. |
| `next@15.x` | `node >=18.x` | Next.js 15 still supports Node 18. Next.js 16 drops Node 18 (requires 20.9+). Run Node 20 LTS regardless. |
| `@worldcoin/idkit@4.1.3` | `@worldcoin/idkit-core@4.1.3` | Versions are pinned together — idkit's own dependency declares `@worldcoin/idkit-core@4.1.3`. Do not mix major versions. |

---

## Critical Integration Notes

### selfieCheckLegacy is a beta preset
The `selfieCheckLegacy` preset is documented under World ID legacy presets and described as "Returns a World ID 3.0 Face proof." It is import-compatible with the same pattern as `orbLegacy`. Access requires early access grant from World (per PROJECT.md — already obtained). The preset is not extensively documented in public-facing docs; expect to reference the `@worldcoin/idkit@4.1.3` TypeScript types as source of truth for its signature.

**Confidence: LOW** — confirmed the preset name and that it exists in the preset catalog, but no public code example was found. The integration pattern (imported from `@worldcoin/idkit`, passed as `preset` prop) is confirmed by analogy with `orbLegacy` which is identically structured.

### rp_context is mandatory in v4
Unlike v2/v3 IDKit, v4 will not open the widget without a valid `rp_context`. The signing flow is not optional. This means a cold-start page load must fetch the signature before the widget can render open.

### Verification endpoint changed in v4
Old endpoint: `https://developer.worldcoin.org/api/v1/verify/{app_id}`
Current endpoint: `https://developer.world.org/api/v4/verify/{rp_id}` (note: domain and path both changed, and keyed on `rp_id` not `app_id`)

---

## Sources

- `https://registry.npmjs.org/@worldcoin/idkit/latest` — version 4.1.3, peer deps (HIGH confidence)
- `https://registry.npmjs.org/@worldcoin/idkit-core` — version 4.1.3, ./signing export (HIGH confidence)
- `https://docs.world.org/world-id/idkit/integrate` — signRequest import path, rp_context structure, verify endpoint (HIGH confidence)
- `https://docs.world.org/world-id/reference/idkit` — IDKitRequestWidget props, RpContext type (HIGH confidence)
- `https://docs.world.org/world-id/credentials/legacy-presets` — selfieCheckLegacy preset confirmed in catalog (MEDIUM confidence — beta feature)
- `https://docs.world.org/world-id/selfie-check/overview.md` — Selfie Check beta overview, IDKit integration requirement (MEDIUM confidence)
- `https://nextjs.org/blog/next-16` — Next.js 16 breaking changes (async params), version requirements (HIGH confidence)
- `https://github.com/worldcoin/idkit-js` — Archived April 14 2026, v2.x line — NOT the v4 SDK (HIGH confidence)
- WebSearch: Next.js 15 vs 16 stability, create-next-app defaults, Route Handlers vs Server Actions (MEDIUM confidence)

---

*Stack research for: World ID IDKit v4 selfieCheckLegacy — Next.js webapp*
*Researched: 2026-04-28*
