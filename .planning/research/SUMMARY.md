# Project Research Summary

**Project:** selfie-test — World ID IDKit v4 Selfie Check Test Harness
**Domain:** World ID biometric verification integration — Next.js webapp
**Researched:** 2026-04-28
**Confidence:** MEDIUM-HIGH (core stack and architecture HIGH; selfieCheckLegacy beta preset LOW)

## Executive Summary

This project is a single-purpose developer test harness for validating the World ID Selfie Check beta flow end-to-end. The correct approach is a minimal Next.js 15 (LTS) App Router application with exactly two API routes: one for server-side RP request signing and one for forwarding IDKit proofs to the World ID verification API. The frontend is a single page that fetches a signed `rp_context` on widget open, renders the `IDKitRequestWidget` with the `selfieCheckLegacy` preset, then displays "Verified!" on success.

## Recommended Stack

- **Next.js 15 (LTS)** — App Router, Route Handlers. Not Next.js 16 (breaking async changes, no benefit here).
- **@worldcoin/idkit@4.1.3** — React widget (`IDKitRequestWidget`, `selfieCheckLegacy`)
- **@worldcoin/idkit-core@4.1.3** — Server-side `signRequest` from `./signing` subpath
- **TypeScript 5.x** — Type safety for `RpContext`, `IDKitResult`
- **Tailwind CSS 4.x** — Minimal styling via `create-next-app` defaults

**Do NOT use:** `@worldcoin/idkit-js` (archived v2.x), `@worldcoin/idkit-standalone`, Pages Router.

## Table Stakes Features

1. QR code display via `IDKitRequestWidget` with `selfieCheckLegacy` preset
2. Server-side RP signature endpoint (`/api/sign`) — IDKit v4 will not open without valid `rp_context`
3. Server-side proof verification endpoint (`/api/verify`)
4. "Verified!" success confirmation
5. Error state display with error codes
6. Environment variable credential storage

## Architecture

Three-layer system with clear security boundaries:

1. **Client component** (`app/page.tsx`) — fetches `rp_context` on widget open, renders widget, displays result
2. **SelfieWidget wrapper** (`components/SelfieWidget.tsx`) — `next/dynamic` with `{ ssr: false }` isolating SSR-incompatible IDKit
3. **`/api/sign` Route Handler** — calls `signRequest(RP_SIGNING_KEY, action)`, returns `rp_context`
4. **`/api/verify` Route Handler** — thin proxy forwarding `IDKitResult` to `POST developer.world.org/api/v4/verify/{rp_id}`
5. **`lib/world-id.ts`** — shared constants (`APP_ID`, `RP_ID`, action string)

## Critical Pitfalls

| # | Pitfall | Prevention |
|---|---------|------------|
| 1 | Signing key exposed via `NEXT_PUBLIC_` prefix | Keep `RP_SIGNING_KEY` as non-prefixed server env var |
| 2 | `rp_context` fetched on page load, expires before scan | Fetch on widget open (button click), not `useEffect` mount |
| 3 | Wrong verify endpoint (domain or path param) | Use `developer.world.org/api/v4/verify/{rp_id}` — not worldcoin.org, not app_id |
| 4 | `handleVerify` returns instead of throws on failure | Must `throw new Error(...)` — resolved promise = success to IDKit |
| 5 | `selfieCheckLegacy` not enabled in Developer Portal | Verify portal enablement before writing integration code |
| 6 | Edge runtime on signing route | Never set `export const runtime = 'edge'` — `signRequest` needs Node.js `crypto` |

## Suggested Phase Structure

1. **Foundation** — Next.js 15 scaffold, env vars, Vercel project, portal confirmation
2. **Backend API Routes** — `/api/sign` + `/api/verify`, testable with `curl`
3. **Widget Integration** — `IDKitRequestWidget` + `selfieCheckLegacy`, end-to-end flow, success display

## Open Questions

- `selfieCheckLegacy` preset exact API signature — inspect TypeScript types after `npm install`
- Whether `environment` prop needs `"staging"` for beta Selfie Check access
- Whether World ID simulator supports Selfie Check flow or real device required

## Sources

- `docs.world.org/world-id/idkit/integrate` — signRequest, rp_context, verify endpoint
- `docs.world.org/world-id/credentials/legacy-presets` — selfieCheckLegacy preset
- `docs.world.org/world-id/selfie-check/overview` — Selfie Check beta overview
- `docs.world.org/world-id/idkit/react` — IDKitRequestWidget props, hooks
- `registry.npmjs.org/@worldcoin/idkit/latest` — version 4.1.3

---
*Research completed: 2026-04-28*
*Ready for roadmap: yes*
