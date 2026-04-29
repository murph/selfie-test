# Phase 2: Widget Integration - Research

**Researched:** 2026-04-28
**Domain:** IDKit React widget integration, Next.js client component, state machine UI
**Confidence:** HIGH — all claims verified against installed package source, official type definitions, and confirmed API routes from Phase 1

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CORE-02 | Page displays IDKit Selfie Check QR code using `IDKitRequestWidget` with `selfieCheckLegacy` preset | Verified: `IDKitRequestWidget` and `selfieCheckLegacy` are both exported from `@worldcoin/idkit@4.1.3` (confirmed in installed `dist/index.d.ts`). Widget requires `open`, `onOpenChange`, `app_id`, `action`, `rp_context`, `allow_legacy_proofs`, and `preset` props. |
| CORE-04 | Page shows "Verified!" message on successful Selfie Check completion | Verified: `onSuccess` callback receives `IDKitResult`; state machine switches to `verified` state; UI-SPEC defines exact copy as "Verified!" in `green-600`. |
| ERR-01 | Page displays error state with IDKit error code when verification fails | Verified: `onError` callback receives `IDKitErrorCodes` enum value (string union). UI-SPEC defines error display as "Verification failed" + monospace error code in `red-600`. |
</phase_requirements>

---

## Summary

Phase 2 replaces the scaffolded `page.tsx` with a single "use client" page that implements the complete IDKit widget flow. The backend (both API routes) is complete from Phase 1 — this phase is pure frontend work.

The flow is: button click → fetch `rp_context` from `/api/rp-signature` → set state → open `IDKitRequestWidget` → on success show "Verified!" → on error show error code. The UI-SPEC defines a three-state machine (idle / verified / error) with a loading sub-state during the `rp_context` fetch.

The installed package (`@worldcoin/idkit@4.1.3`) exports exactly the symbols needed: `IDKitRequestWidget`, `selfieCheckLegacy`, `IDKitResult`, `IDKitErrorCodes`, and `RpContext`. No additional packages are required.

**Primary recommendation:** Rewrite `src/app/page.tsx` as a single "use client" component implementing the three-state machine exactly as specified in the UI-SPEC. No new files, no wrapper components, no `next/dynamic` needed — the "use client" directive handles the browser-only requirement.

---

## Standard Stack

### Core (already installed — no new packages)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| `@worldcoin/idkit` | 4.1.3 | `IDKitRequestWidget`, `selfieCheckLegacy`, `IDKitErrorCodes`, `IDKitResult`, `RpContext` | Installed: `node_modules/@worldcoin/idkit/dist/index.d.ts` |
| `react` | 19.2.4 | `useState` for state machine | Installed: `package.json` |
| `next` | 16.2.4 | App Router, "use client" | Installed: `package.json` |
| Tailwind CSS | 4.x | Utility classes per UI-SPEC | Installed: `package.json` |

### No New Dependencies

Phase 2 requires zero new package installs. Everything is already present from Phase 1.

---

## Architecture Patterns

### File to Modify

Only one file changes: `src/app/page.tsx`. The current file contains the Next.js scaffold placeholder. Replace it entirely.

### Recommended Structure (single file)

```
src/app/page.tsx   ← "use client" — full replacement of scaffold placeholder
```

No new files needed. The UI-SPEC explicitly calls for "no component library" and "plain Tailwind CSS." There is no `SelfieWidget.tsx` wrapper; the widget renders directly in the page.

### State Machine (three mutually exclusive states)

Per UI-SPEC:

| State | Variable | Trigger |
|-------|----------|---------|
| `idle` | Neither `result` nor `error` set | Initial load |
| `loading` | `loading === true` | Button clicked, awaiting `/api/rp-signature` |
| `verified` | `result !== null` | `onSuccess` fires |
| `error` | `error !== null` | `onError` fires, or `rp_context` fetch fails |

Implementation uses four `useState` variables (per official IDKit example pattern):
- `widgetOpen: boolean`
- `widgetRpContext: RpContext | null`
- `widgetError: string | null`
- `widgetIdkitResult: IDKitResult | null`
- `loading: boolean` (for button text during fetch)

### Pattern: fetchRpContext → setRpContext → open widget

```typescript
// Source: official IDKit Next.js example (confirmed pattern)
const startWidgetFlow = async () => {
  setLoading(true);
  setWidgetError(null);
  setWidgetIdkitResult(null);
  try {
    const rpContext = await fetchRpContext(action);
    setWidgetRpContext(rpContext);
    setWidgetOpen(true);
  } catch (error) {
    setWidgetError(error instanceof Error ? error.message : "Unknown error");
  } finally {
    setLoading(false);
  }
};
```

### Pattern: Conditional widget render

Widget must only render when `widgetRpContext` is set (it requires `rp_context` as a required prop):

```tsx
// Source: official IDKit Next.js example
{widgetRpContext && (
  <IDKitRequestWidget
    open={widgetOpen}
    onOpenChange={setWidgetOpen}
    app_id={APP_ID}
    action={action}
    rp_context={widgetRpContext}
    allow_legacy_proofs={true}
    preset={selfieCheckLegacy({ signal: "demo-signal" })}
    onSuccess={(result) => { setWidgetIdkitResult(result); }}
    handleVerify={async (result) => {
      await verifyProof(result);
    }}
    onError={(errorCode) => {
      setWidgetError(`Verification failed: ${errorCode}`);
    }}
  />
)}
```

### Pattern: fetchRpContext function

Calls `/api/rp-signature` (Phase 1 route) and constructs `RpContext` object:

```typescript
// Source: Phase 1 route.ts output shape + official example
const RP_ID = process.env.NEXT_PUBLIC_RP_ID as string;
const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;
const ACTION = "selfie-check";

async function fetchRpContext(action: string): Promise<RpContext> {
  const response = await fetch("/api/rp-signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const payload = await response.json();
    throw new Error(payload.error ?? "Failed to fetch RP signature");
  }
  const data = await response.json();
  return {
    rp_id: RP_ID,
    nonce: data.nonce,
    created_at: data.created_at,
    expires_at: data.expires_at,
    signature: data.sig,
  };
}
```

**Critical field mapping:** The Phase 1 route returns `sig` (not `signature`). The `RpContext` type wants `signature`. Map: `signature: data.sig`.

### Pattern: verifyProof function

Calls `/api/verify-proof` (Phase 1 route). Must `throw` on failure — IDKit treats resolved promise as success:

```typescript
// Source: official IDKit Next.js example — handleVerify MUST throw on failure
async function verifyProof(payload: IDKitResult): Promise<unknown> {
  const response = await fetch("/api/verify-proof", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ rp_id: RP_ID, devPortalPayload: payload }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error ?? "Verification failed");
  return json;
}
```

### Layout (per UI-SPEC)

```tsx
// viewport: full height, flex column, items-center, justify-center
// container: max-w-sm, flex col, gap-4, text-center
<div className="min-h-screen flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
  <div className="flex flex-col items-center gap-4 text-center max-w-sm w-full px-4">
    <h1 className="text-2xl font-semibold">Selfie Test Tester</h1>
    <button ...>Start Verification</button>
    {/* status — conditional */}
    {/* IDKitRequestWidget — conditional on widgetRpContext */}
  </div>
</div>
```

### Button States (per UI-SPEC)

| State | Text | Classes |
|-------|------|---------|
| Idle | Start Verification | Normal |
| Loading (fetch in progress) | Loading... | `disabled opacity-50 cursor-not-allowed` |
| Widget open | Start Verification | `disabled opacity-50 cursor-not-allowed` |

Button is disabled when `loading === true` OR `widgetOpen === true`.

### Status Display (per UI-SPEC)

```tsx
{widgetIdkitResult && (
  <p className="text-green-600 text-base">Verified!</p>
)}
{widgetError && (
  <p className="text-red-600 text-base">
    Verification failed{" "}
    <code className="font-mono text-sm">{widgetError}</code>
  </p>
)}
```

### Anti-Patterns to Avoid

- **`next/dynamic` with `{ ssr: false }`:** NOT needed. "use client" at the top of `page.tsx` is sufficient. The widget renders in a client component — no SSR conflict.
- **Fetching `rp_context` on mount (`useEffect`):** Causes expiry before the user scans. Always fetch on button click.
- **Resolving `handleVerify` on failure:** Must `throw` — IDKit interprets a resolved promise as success regardless of content.
- **Rendering `IDKitRequestWidget` without `rp_context`:** `rp_context` is a required prop per `IDKitRequestConfig`. Render the widget conditionally on `widgetRpContext !== null`.
- **`allow_legacy_proofs: false` with `selfieCheckLegacy`:** The official example uses `allow_legacy_proofs: true` with legacy presets (selfieCheckLegacy returns 3.0 proofs). Set to `true`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR renderer | `IDKitRequestWidget` | Library owns QR, bridge connection, and polling |
| Error code display | Custom enum lookup | Use `errorCode` string directly from `onError` callback | Already human-readable snake_case strings |
| Proof construction | Manual payload assembly | `IDKitResult` type from `onSuccess`/`handleVerify` callbacks | Library assembles the full result object |
| `rp_context` assembly | Custom signing | `/api/rp-signature` (Phase 1) | Already built and verified |

---

## Common Pitfalls

### Pitfall 1: Field name mismatch between route and RpContext type

**What goes wrong:** Phase 1 route returns `sig` field. `RpContext` type requires `signature` field. Using `data.signature` instead of `data.sig` when constructing `RpContext` causes widget to fail silently with malformed context.

**How to avoid:** In `fetchRpContext`, map explicitly: `signature: data.sig`.

**Confidence:** HIGH — verified by reading both `route.ts` (returns `sig`) and `RpContext` type definition (requires `signature`).

### Pitfall 2: handleVerify must throw on failure

**What goes wrong:** If `handleVerify` returns a resolved promise (even with error content), IDKit treats it as success and calls `onSuccess`.

**How to avoid:** `if (!response.ok) throw new Error(json.error ?? "Verification failed")` before returning.

**Confidence:** HIGH — stated in official IDKit docs and repeated in project SUMMARY.md.

### Pitfall 3: Rendering widget without rp_context

**What goes wrong:** `IDKitRequestWidget` requires `rp_context` as a non-optional prop (`IDKitRequestConfig.rp_context: RpContext`). Mounting it before fetch completes causes TypeScript error or runtime crash.

**How to avoid:** Wrap in `{widgetRpContext && <IDKitRequestWidget ... rp_context={widgetRpContext} />}`.

**Confidence:** HIGH — verified in `IDKitRequestConfig` type definition (field is required, not optional).

### Pitfall 4: environment prop may be needed for staging

**What goes wrong:** `selfieCheckLegacy` is in preview. The `IDKitRequestConfig` has an optional `environment?: "production" | "staging"` prop. Without `environment: "staging"`, the Selfie Check flow may not activate if the app is registered in the staging environment.

**How to avoid:** Check Vercel env config. The existing setup uses `NEXT_PUBLIC_APP_ID=app_4c0f2b7ac8e5f61b994ff642c8670c62` — if this is a staging app ID, add `environment="staging"` to the widget. Start without it; add if QR scan produces `credential_unavailable`.

**Confidence:** MEDIUM — `environment` prop is confirmed in type definitions; whether it is required for the specific app ID is runtime-dependent.

### Pitfall 5: page.tsx currently uses Server Component features

**What goes wrong:** Current `page.tsx` imports `next/image` and renders server-side. Adding `"use client"` at the top while keeping `next/image` imports is fine (Image works in client components), but the old scaffold content is a complete replacement — not a merge.

**How to avoid:** Replace the file completely. Do not attempt to preserve scaffold content.

### Pitfall 6: Button disabled state during rp_context fetch

**What goes wrong:** UI-SPEC explicitly requires a "Loading..." button text during the async fetch. Without this, the user may click the button multiple times, triggering multiple parallel fetches and opening multiple widgets.

**How to avoid:** Set `loading: true` before the fetch, `loading: false` in the `finally` block. Disable button when `loading || widgetOpen`.

---

## Code Examples

### Complete prop set for IDKitRequestWidget

```typescript
// Source: installed @worldcoin/idkit@4.1.3 dist/index.d.ts
// IDKitRequestWidgetProps = IDKitRequestHookConfig & WidgetSharedProps<IDKitResult>
// Required from IDKitRequestConfig:
//   app_id: `app_${string}`
//   action: string
//   rp_context: RpContext        ← required, not optional
//   allow_legacy_proofs: boolean ← required, not optional
// Required for preset variant:
//   preset: Preset               ← selfieCheckLegacy() returns SelfieCheckLegacyPreset
// Required from WidgetSharedProps:
//   open: boolean
//   onOpenChange: (open: boolean) => void
//   onSuccess: (result: IDKitResult) => MaybePromise<void>
// Optional:
//   handleVerify?: (result: IDKitResult) => MaybePromise<void>
//   onError?: (errorCode: IDKitErrorCodes) => MaybePromise<void>
//   autoClose?: boolean
//   language?: "en" | "es" | "th"
```

### selfieCheckLegacy signature

```typescript
// Source: installed @worldcoin/idkit-core@4.1.3 dist/index.d.ts
declare function selfieCheckLegacy(opts?: {
  signal?: string;
}): SelfieCheckLegacyPreset;
// Returns: { type: "SelfieCheckLegacy"; signal?: string }
// Usage: preset={selfieCheckLegacy({ signal: "demo-signal" })}
// signal is optional — can be omitted entirely: preset={selfieCheckLegacy()}
```

### IDKitErrorCodes enum values

```typescript
// Source: installed @worldcoin/idkit-core@4.1.3 dist/index.d.ts
enum IDKitErrorCodes {
  UserRejected = "user_rejected",
  VerificationRejected = "verification_rejected",
  CredentialUnavailable = "credential_unavailable",
  MalformedRequest = "malformed_request",
  InvalidNetwork = "invalid_network",
  InclusionProofPending = "inclusion_proof_pending",
  InclusionProofFailed = "inclusion_proof_failed",
  UnexpectedResponse = "unexpected_response",
  ConnectionFailed = "connection_failed",
  MaxVerificationsReached = "max_verifications_reached",
  FailedByHostApp = "failed_by_host_app",
  GenericError = "generic_error",
  Timeout = "timeout",
  Cancelled = "cancelled",
}
// onError receives IDKitErrorCodes — a string enum value
// Display directly: `Verification failed: ${errorCode}`
```

### Env var access in client component

```typescript
// NEXT_PUBLIC_ vars are available in client components via process.env
// Non-NEXT_PUBLIC_ vars are undefined on client — this is correct behavior
const APP_ID = process.env.NEXT_PUBLIC_APP_ID as `app_${string}`;
const RP_ID = process.env.NEXT_PUBLIC_RP_ID as string;
// RP_SIGNING_KEY is NOT accessible here — correct, it stays server-only
```

---

## State of the Art

| Old Approach (SUMMARY.md / earlier research) | Current Confirmed Approach |
|----------------------------------------------|---------------------------|
| `next/dynamic` with `{ ssr: false }` for IDKit widget | Just `"use client"` — sufficient for client-only rendering |
| Separate `components/SelfieWidget.tsx` wrapper | Single file `page.tsx` — UI-SPEC says no component library, one file is cleaner |
| `@worldcoin/idkit-core` as separate dep for `signRequest` | `signRequest` re-exported from `@worldcoin/idkit/signing` — no separate package needed |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no test config files, no test directories |
| Config file | None — Wave 0 must create if needed |
| Quick run command | N/A — no test infrastructure |
| Full suite command | N/A — no test infrastructure |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORE-02 | Page renders IDKitRequestWidget QR with selfieCheckLegacy preset | manual-only | N/A — requires World App scan | ❌ manual |
| CORE-04 | "Verified!" message appears after successful scan | manual-only | N/A — requires live World App completion | ❌ manual |
| ERR-01 | Error state shows IDKit error code after failure | manual-only | N/A — requires World App rejection | ❌ manual |

**Note:** All three requirements involve the IDKit bridge and live World App interaction. There is no way to automate end-to-end testing without a World App simulator (which does not support Selfie Check). Verification is via human walkthrough on the deployed Vercel URL.

Build verification is automatable:

| Check | Command |
|-------|---------|
| TypeScript compile clean | `npm run build` |
| No `NEXT_PUBLIC_RP_SIGNING_KEY` in bundle | `grep -r "NEXT_PUBLIC_RP_SIGNING_KEY" src/` (must return empty) |

### Sampling Rate

- **Per task commit:** `npm run build` (TypeScript + Next.js compile check)
- **Per wave merge:** `npm run build` + manual spot check in browser
- **Phase gate:** Manual walkthrough of full QR flow on Vercel before `/gsd:verify-work`

### Wave 0 Gaps

None — no test framework installation needed. This phase uses build verification + manual walkthrough. The ROADMAP Phase 2 success criteria define the manual verification checklist.

---

## Open Questions

1. **Does this app_id require `environment: "staging"` for Selfie Check?**
   - What we know: The `environment` prop exists and defaults to `"production"`. The Selfie Check preset is in preview ("Contact us if you need it enabled" — from type definition JSDoc).
   - What's unclear: Whether `app_4c0f2b7ac8e5f61b994ff642c8670c62` is a production or staging app ID, and whether the Selfie Check feature is portal-enabled for it.
   - Recommendation: Start without `environment` prop. If QR scan produces `credential_unavailable`, add `environment="staging"` and redeploy.

2. **Is `signal` in `selfieCheckLegacy` meaningful for a test harness?**
   - What we know: `signal` is optional (`selfieCheckLegacy(opts?: { signal?: string })`). The official example uses `"demo-signal"`.
   - What's unclear: Whether the signal needs to match a specific value for the Selfie Check beta.
   - Recommendation: Use `"demo-signal"` to match the official example. Can be changed without any backend impact.

---

## Sources

### Primary (HIGH confidence)

- Installed `node_modules/@worldcoin/idkit/dist/index.d.ts` — `IDKitRequestWidget`, `IDKitRequestWidgetProps`, widget prop types
- Installed `node_modules/@worldcoin/idkit-core/dist/index.d.ts` — `selfieCheckLegacy`, `RpContext`, `IDKitErrorCodes`, `IDKitRequestConfig`, `IDKitResult`
- `src/app/api/rp-signature/route.ts` (Phase 1 artifact) — confirmed output field `sig` (not `signature`)
- `src/app/api/verify-proof/route.ts` (Phase 1 artifact) — confirmed accepts `{ rp_id, devPortalPayload }`
- `.planning/phases/02-widget-integration/02-UI-SPEC.md` — state machine, copy, layout, interaction contract
- Additional context in prompt — official IDKit Next.js example patterns (github.com/worldcoin/idkit/tree/main/js/examples/nextjs)

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — prior research on pitfalls; cross-verified against installed types
- `.planning/STATE.md` — confirmed decisions: `rp_context` fetched on button click, no edge runtime

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all exports verified in installed package dist files
- Architecture: HIGH — single-file "use client" pattern confirmed against official example and UI-SPEC
- Pitfalls: HIGH — `sig` vs `signature` field mismatch verified against actual Phase 1 code; handleVerify throw behavior from official docs
- Environment prop: MEDIUM — type confirmed, runtime behavior app-ID-dependent

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable library, no fast-moving changes expected)
