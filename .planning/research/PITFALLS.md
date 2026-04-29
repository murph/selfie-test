# Pitfalls Research

**Domain:** World ID IDKit v4 + Selfie Check integration (Next.js/Vercel test harness)
**Researched:** 2026-04-28
**Confidence:** HIGH (official docs + verified cross-references)

---

## Critical Pitfalls

### Pitfall 1: Signing Key Exposed via NEXT_PUBLIC_ Prefix

**What goes wrong:**
The RP signing key ends up in the browser bundle because a developer prefixes it with `NEXT_PUBLIC_` or references `process.env.RP_SIGNING_KEY` inside a client component. Any visitor can extract it from the JS bundle via DevTools.

**Why it happens:**
Next.js requires the `NEXT_PUBLIC_` prefix to pass env vars to the client — developers familiar with CRA or Vite cargo-cult the same pattern without realizing server-side API routes use non-prefixed vars directly. The mistake is also easy to make when quickly wiring a proof-of-concept.

**How to avoid:**
- Keep the signing key only in a non-prefixed env var (e.g., `RP_SIGNING_KEY`), never `NEXT_PUBLIC_RP_SIGNING_KEY`.
- Call `signRequest` exclusively inside a Next.js API route (`/api/sign` or similar), never in any file under `app/` or `pages/` that renders on the client.
- Confirm at deploy time that `process.env.RP_SIGNING_KEY` is set in Vercel's server environment (not "Exposed to Browser").

**Warning signs:**
- The env var name appears in the browser's Network tab or `window.__NEXT_DATA__`.
- `signRequest` is imported directly inside a React component file.
- Build output or source maps contain the hex key string.

**Phase to address:** Foundation phase (project scaffolding). Get the API route boundary right before any other code is written.

---

### Pitfall 2: rp_context Fetched Once on Page Load, Expires Before User Scans QR

**What goes wrong:**
The page fetches the signed `rp_context` on mount and stores it in state. If the user leaves the tab open for more than 5 minutes (default TTL is 300 seconds) and then tries to scan, World App rejects the request with an invalid/expired signature error. The UI shows nothing useful.

**Why it happens:**
The natural React pattern is to `useEffect(() => fetch('/api/sign'), [])` on mount and store the result. This works perfectly in development with fast iteration but silently fails for real users who load the page and get distracted.

**How to avoid:**
- Fetch a fresh `rp_context` when the user opens the widget, not on page load.
- Tie the signature fetch to the "Show QR" button click, so the signature is always <5 seconds old when World App sees it.
- Alternatively: set `ttl` to a larger value via `signRequest`'s third argument (but the default 300s is already generous — fix the fetch timing instead).

**Warning signs:**
- World App shows a generic error or silently does nothing after scanning.
- Signature works fine in fast testing but fails intermittently for real users.
- The `expires_at` timestamp in the signed token is in the past when World App processes it.

**Phase to address:** Widget integration phase. The fetch timing must be decided before the QR display logic is written.

---

### Pitfall 3: Wrong Verify Endpoint Domain or Path Parameter

**What goes wrong:**
The backend calls the old `worldcoin.org` v1/v2 endpoint with `app_id` in the path, receiving a 404 or `app_not_migrated` error. Or the call goes to `world.org/api/v4/verify/{app_id}` — still wrong because v4 uses `rp_id`, not `app_id`.

**Why it happens:**
Documentation, tutorials, and blog posts from before mid-2025 reference the old `developer.worldcoin.org/api/v1/verify/{app_id}` endpoint. The domain migration from `worldcoin.org` to `world.org` and the `app_id` → `rp_id` path parameter change are two simultaneous breaking changes that are easy to get half-right.

**How to avoid:**
- Use exactly: `POST https://developer.world.org/api/v4/verify/{rp_id}` where `rp_id` is the value from the Developer Portal (not `app_id`).
- Verify the response for `success: true` — a 200 with `success: false` is still a failure.
- Store the endpoint as a constant, not interpolated inline, so it's easy to audit.

**Warning signs:**
- HTTP 404 from the verify endpoint.
- Error code `app_not_migrated` in the API response.
- Verification appears to succeed (no thrown error) but `success` is `false` in the response body.

**Phase to address:** Backend verification route, first phase with API routes.

---

### Pitfall 4: handleVerify Returns Instead of Throwing on Failure

**What goes wrong:**
The `handleVerify` callback returns normally (or returns a resolved promise) even when the backend says verification failed. IDKit sees a resolved promise and immediately calls `onSuccess`, showing the user "Verified!" for an actually-failed proof.

**Why it happens:**
Developers check `response.ok` but `return` rather than `throw` — a common async/await mistake. Because `handleVerify` is async, any non-throwing resolution looks like success to IDKit.

**How to avoid:**
```typescript
handleVerify={async (proof) => {
  const res = await fetch('/api/verify', {
    method: 'POST',
    body: JSON.stringify(proof),
  });
  if (!res.ok) {
    throw new Error(await res.text()); // MUST throw — never return
  }
}}
```
The widget only enters error state when `handleVerify` rejects. Return = success, throw = failure.

**Warning signs:**
- "Verified!" appears even when the backend logs a verification failure.
- The `onError` callback with `failed_by_host_app` is never triggered despite backend errors.
- Unit tests for the verify route pass but the end-to-end flow claims success for bad proofs.

**Phase to address:** Backend verification route + widget wiring, same phase.

---

### Pitfall 5: selfieCheckLegacy Preset Not Enabled for the App in Developer Portal

**What goes wrong:**
The widget opens but World App returns `credential_unavailable` because the app does not have the Selfie Check credential type enabled. The beta is "only by request" — having the SDK and preset alone is insufficient.

**Why it happens:**
Selfie Check is a beta feature requiring explicit early-access enrollment via the Developer Portal. Developers assume that using the `selfieCheckLegacy` preset in code is all that's needed, not realizing there's a corresponding portal-side flag that must be activated by Worldcoin's team.

**How to avoid:**
- Confirm that Selfie Check access is activated in the Developer Portal for `app_4c0f2b7ac8e5f61b994ff642c8670c62` before writing any integration code.
- When the credential is granted, verify it's reflected under the app's "Allowed Credentials" in the portal.
- Test with the Worldcoin Simulator (staging) first; it surfaces `credential_unavailable` immediately without requiring a real device.

**Warning signs:**
- World App shows "credential unavailable" after scanning the QR.
- IDKit fires `onError` with error code `credential_unavailable`.
- The Developer Portal shows no Selfie Check credential listed under the app's settings.

**Phase to address:** Project setup phase — verify portal configuration before any code.

---

### Pitfall 6: Vercel API Route Using Edge Runtime Breaks signRequest

**What goes wrong:**
The `/api/sign` route is deployed as a Vercel Edge Function (either via `export const runtime = 'edge'` or via `vercel.json` edge config). The `signRequest` function from `@worldcoin/idkit-core/signing` uses Node.js `crypto` internally, which is not available in the Edge Runtime. The route crashes with `Error: The edge runtime does not support Node.js 'crypto' module`.

**Why it happens:**
Edge functions are faster for simple operations and Vercel encourages their use. Developers add `export const runtime = 'edge'` to an API route without checking whether its dependencies use Node.js builtins.

**How to avoid:**
- Do not set `export const runtime = 'edge'` on any route that imports from `@worldcoin/idkit-core/signing`.
- Use the default Node.js runtime for signing routes (the Next.js default — omit the `runtime` export entirely).
- If edge performance is needed elsewhere, keep signing isolated in its own route file that never opts into edge.

**Warning signs:**
- `TypeError: The 'crypto' module is not available in the Edge Runtime` in Vercel build or function logs.
- The signing route works locally (`next dev` uses Node.js) but fails after deployment.
- Error appears only in production Vercel logs, not during local testing.

**Phase to address:** Foundation phase — set runtime explicitly when creating the API route.

---

### Pitfall 7: Verify Proof Called Client-Side

**What goes wrong:**
The proof payload returned by IDKit is forwarded directly to the World ID verify API from the browser (e.g., in `handleVerify` or `onSuccess`). This exposes the verify call to manipulation, bypasses nullifier deduplication, and leaks proof data to the client.

**Why it happens:**
The `handleVerify` callback runs on the client, so calling `fetch('https://developer.world.org/api/v4/verify/...')` directly from it is syntactically valid. For a quick test harness, it feels simpler than adding a backend route. The error is that the API accepts the call fine — there's no technical guardrail stopping it.

**How to avoid:**
- `handleVerify` must call your own backend route (`/api/verify`), which in turn calls the World API.
- Never call `https://developer.world.org` directly from client code.
- The backend route is where nullifier deduplication and any session state must live.

**Warning signs:**
- Network tab shows a request to `developer.world.org` originating from the browser.
- No `/api/verify` route exists in the project.
- The proof payload is visible in browser DevTools request bodies.

**Phase to address:** Backend verification route, established before widget integration.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Skip nullifier deduplication | Faster MVP | Replay attacks; same proof accepted multiple times | Never for production; acceptable for this test harness only if noted explicitly |
| Hardcode `action` string in both frontend and backend | Less config | Action mismatch causes `all_verifications_failed`; hard to trace | Never — use a shared constant or env var |
| Fetch `rp_context` on page load | Simpler code | Expired signatures for users who leave tab open | Only acceptable if TTL is raised and user is notified |
| Inline the verify API call in `handleVerify` without abstraction | Fewer files | Hard to add error handling, logging, or nullifier checks later | Never |
| Use `any` type for IDKit proof payload | Avoids TypeScript friction | Type errors at runtime instead of compile time | Never — IDKit ships TypeScript types |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| World ID Verify API | Calling `/api/v4/verify/{app_id}` — using app_id instead of rp_id | `/api/v4/verify/{rp_id}` — the rp_id from Developer Portal |
| World ID Verify API | Checking HTTP status only, ignoring `success` field in 200 response | Check `response.success === true` explicitly |
| `signRequest` | Passing signing key with `0x` prefix when env var strips it, or vice versa | Test both; the SDK accepts with or without `0x` but be consistent |
| `IDKitRequestWidget` | Passing `rp_id` inside `rp_context` explicitly when SDK builds it from top-level `rp_id` prop | Check SDK version's prop API — some versions take `rp_id` as a separate prop |
| Next.js env vars | Prefixing signing key with `NEXT_PUBLIC_` | Never prefix secrets with `NEXT_PUBLIC_` |
| Selfie Check beta | Using `selfieCheckLegacy` without portal-side enablement | Confirm credential access in Developer Portal first |
| QR bridge polling | Widget polling timeout if user doesn't scan within the polling window | The default timeout is generous; don't reduce it for "cleaner" UX |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching `rp_context` on every render (not just on open) | Excessive `/api/sign` calls; signing key used at high rate | Gate the fetch inside the button handler or `onOpenChange` | Immediately in dev; worse at any real traffic |
| Calling the World API verify endpoint synchronously inside a Vercel serverless function with a long cold start | User sees a multi-second spinner on first verify | Keep the function warm or use a region close to `developer.world.org` | First request after idle period |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Signing key in `NEXT_PUBLIC_` var or client code | Full impersonation — attacker can forge requests from your `app_id` | API route only; never in client bundle |
| Skipping nullifier deduplication | Proof replay — same user appears to verify multiple times | Check nullifier against in-memory set or DB before accepting |
| Not validating `success: true` in verify response | Invalid proofs silently accepted | Explicit `if (!body.success) throw` check |
| Storing signing key in git-tracked `.env` | Key leaks in commit history | `.env.local` (gitignored) only; Vercel secrets for production |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No loading state while fetching `rp_context` | Widget appears unresponsive; user clicks multiple times | Show spinner or disable button while fetching signature |
| Showing QR code before `rp_context` is ready | QR renders with stale/null context; scan fails | Only render `IDKitRequestWidget` after `rp_context` is populated |
| Generic error message on `credential_unavailable` | User doesn't know they need the Selfie Check-enabled World App | Detect error code and explain "Selfie Check beta access required" |
| `onSuccess` shows "Verified!" before `handleVerify` resolves | User sees success before backend confirms — breaks if `handleVerify` later throws | This can't happen if `handleVerify` throws correctly (IDKit waits for it) — but make sure `handleVerify` is wired |
| No retry path after `user_rejected` | User cancelled accidentally and has no way to try again | Reset widget open state and show "Try again" button on `user_rejected` error code |

---

## "Looks Done But Isn't" Checklist

- [ ] **Signing route:** Verify `RP_SIGNING_KEY` is set in Vercel environment (not just `.env.local`) — check Vercel dashboard, not just local behavior.
- [ ] **Verification route:** Confirm `handleVerify` throws (not returns) on non-OK backend response — test with a deliberately bad proof.
- [ ] **Verify endpoint:** Confirm request goes to `developer.world.org` (not `developer.worldcoin.org`) and path uses `rp_id` — check Network tab.
- [ ] **Preset activation:** Confirm Selfie Check credential is enabled in Developer Portal — check before writing integration code.
- [ ] **QR timing:** Confirm `rp_context` fetch is triggered on widget open, not page load — let the page sit for 6+ minutes and verify QR still works.
- [ ] **Edge runtime:** Confirm signing API route has no `export const runtime = 'edge'` — check for it explicitly.
- [ ] **Client-side verify:** Confirm no direct call to `developer.world.org` from browser — inspect Network tab after a verification attempt.

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Signing key exposed | HIGH | Immediately rotate key in Developer Portal; redeploy with new key; audit git history and invalidate any published commits |
| Wrong verify endpoint | LOW | Update the URL constant in the verify route; redeploy |
| rp_context expires before scan | LOW | Move fetch to button click handler; no data loss |
| handleVerify not throwing | LOW | Add `throw` in the error branch; redeploy; test with bad proof |
| credential_unavailable (portal not enabled) | LOW-MEDIUM | Contact Worldcoin for beta access enablement; no code change needed |
| Edge runtime crash on signing | LOW | Remove `export const runtime = 'edge'` from signing route; redeploy |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Signing key in client code | Phase 1: Foundation & project scaffolding | `grep -r "NEXT_PUBLIC_RP\|NEXT_PUBLIC_SIGN" .` returns nothing |
| Wrong verify endpoint | Phase 2: Backend API routes | Integration test hits correct URL; check with `curl` |
| handleVerify not throwing | Phase 2: Backend API routes + widget wiring | Test with deliberately invalid proof payload |
| rp_context fetched on page load | Phase 3: Widget integration | Load page, wait 6 min, verify QR scan still succeeds |
| Selfie Check not enabled in portal | Phase 1: Foundation (pre-code) | `credential_unavailable` never fires in staging test |
| Edge runtime crash | Phase 1: Foundation | Deploy to Vercel preview; confirm signing route returns 200 |
| Client-side verify call | Phase 2: Backend API routes | Network tab shows only `/api/verify` calls, not `developer.world.org` |

---

## Sources

- [IDKit Integration Guide — docs.world.org](https://docs.world.org/world-id/idkit/integrate.md) — HIGH confidence
- [IDKit React Reference — docs.world.org](https://docs.world.org/world-id/idkit/react.md) — HIGH confidence (handleVerify/onSuccess timing confirmed)
- [IDKit Error Codes — docs.world.org](https://docs.world.org/world-id/idkit/error-codes.md) — HIGH confidence
- [Legacy Presets Reference — docs.world.org](https://docs.world.org/world-id/credentials/legacy-presets.md) — HIGH confidence (selfieCheckLegacy confirmed)
- [Selfie Check Overview — docs.world.org](https://docs.world.org/world-id/selfie-check/overview.md) — HIGH confidence (beta/by-request status confirmed)
- [RP Signatures — docs.world.org](https://docs.world.org/world-id/idkit/signatures) — HIGH confidence (TTL 300s, Keccak-256, EIP-191 confirmed)
- [World ID Verify API — docs.world.org](https://docs.world.org/world-id/reference/api) — HIGH confidence (v4 endpoint, rp_id param, error codes confirmed)
- [World ID 4.0: What Changed — Medium/Eregha Thompson, Mar 2026](https://medium.com/@godbrand0/world-id-4-0-what-changed-and-why-it-matters-2dedc1c41f8d) — MEDIUM confidence (breaking change summary, community article)
- [Vercel Edge Runtime: Node.js crypto not supported](https://github.com/vercel/next.js/discussions/62985) — HIGH confidence (known Next.js limitation)
- [idkit-js README — github.com/worldcoin](https://github.com/worldcoin/idkit-js/blob/main/README.md) — HIGH confidence

---
*Pitfalls research for: World ID IDKit v4 Selfie Check — Next.js/Vercel test harness*
*Researched: 2026-04-28*
