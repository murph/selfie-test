# Selfie Test Tester

## What This Is

A minimal Next.js webapp that displays a World ID Selfie Check QR code using IDKit. Users scan the QR code with their phone, complete the Selfie Check flow in World App, and see a "Verified!" confirmation on the web page. Hosted on Vercel.

## Core Value

Display a working Selfie Check QR code and confirm verification succeeds — a test harness for the Selfie Check beta flow.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Display IDKit Selfie Check QR code on page load
- [ ] Sign IDKit requests server-side using rp_context (signing key)
- [ ] Verify proof server-side via World ID verify API
- [ ] Show "Verified!" message on successful Selfie Check completion
- [ ] Store credentials securely in environment variables

### Out of Scope

- Persistent storage / database — no need to store nullifiers beyond the session
- User accounts or authentication — this is a single-purpose test page
- Mobile-native integration — web only, desktop QR flow
- Production fraud prevention — this is a test tool, not a production gate

## Context

- Using World ID IDKit v4.x with the `selfieCheckLegacy` preset
- IDKit React component: `IDKitRequestWidget` from `@worldcoin/idkit`
- Backend signing via `signRequest` from `@worldcoin/idkit-core/signing`
- Verification endpoint: `POST https://developer.world.org/api/v4/verify/{rp_id}`
- Selfie Check is in beta with early access granted
- Hosting target: Vercel

## Constraints

- **Tech stack**: Next.js (React) — single project with API routes
- **Hosting**: Vercel — must be deployable with `vercel deploy`
- **Credentials**: app_id `app_4c0f2b7ac8e5f61b994ff642c8670c62`, rp_id `rp_af321e6c2016688e`, signing key in env var (not committed)
- **IDKit version**: v4.x (`@worldcoin/idkit` and `@worldcoin/idkit-core`)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js with API routes | Single project for frontend + backend signing/verification | — Pending |
| selfieCheckLegacy preset | Matches Selfie Check beta flow, returns Face proof | — Pending |
| No database | Test tool only — no need to persist nullifiers | — Pending |

---
*Last updated: 2026-04-28 after initialization*
