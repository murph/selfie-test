# Architecture Research

**Domain:** World ID IDKit integration — Next.js webapp with server-side signing and proof verification
**Researched:** 2026-04-28
**Confidence:** HIGH (official docs + source verified)

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  Page Component (app/page.tsx) — "use client"            │   │
│  │  • Fetches rp_context from /api/sign on mount            │   │
│  │  • Renders IDKitRequestWidget (dynamic, no SSR)          │   │
│  │  • Shows "Verified!" on onSuccess                        │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                            │ handleVerify callback               │
│                            ↓                                     │
│  ┌───────────────────────────────────────────────────────────┐   │
│  │  IDKitRequestWidget (@worldcoin/idkit)                   │   │
│  │  • Renders QR code connecting to World App               │   │
│  │  • preset={selfieCheckLegacy()}                          │   │
│  │  • rp_context = { rp_id, sig, nonce, created_at,        │   │
│  │                    expires_at }                           │   │
│  └────────────────────────┬─────────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────────┘
                            │ proof payload (IDKitResult)
                            ↓
┌──────────────────────────────────────────────────────────────────┐
│                    Next.js Server (Vercel)                        │
├──────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────┐    ┌───────────────────────────────┐  │
│  │  POST /api/sign       │    │  POST /api/verify             │  │
│  │                       │    │                               │  │
│  │  signRequest(         │    │  forward IDKitResult to       │  │
│  │    signingKeyHex,     │    │  developer.world.org API      │  │
│  │    action             │    │  return success/failure       │  │
│  │  ) → sig, nonce,      │    │                               │  │
│  │    created_at,        │    │                               │  │
│  │    expires_at         │    │                               │  │
│  └───────────────────────┘    └─────────────┬─────────────────┘  │
│          ↑                                  │                    │
│  RP_SIGNING_KEY (env var)                   │                    │
└─────────────────────────────────────────────┼────────────────────┘
                                              │ POST /api/v4/verify/{rp_id}
                                              ↓
┌──────────────────────────────────────────────────────────────────┐
│                  developer.world.org (external)                   │
│  Validates proof and returns success or error                     │
└──────────────────────────────────────────────────────────────────┘
                    ↑
            World App (user's phone)
            scans QR, completes Selfie Check,
            sends proof back to IDKit
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| `app/page.tsx` | Single-page UI: fetch signing context, render widget, show result | Next.js client component (`"use client"`) with dynamic import |
| `IDKitRequestWidget` | Render QR code, manage World App connection, emit proof on completion | `@worldcoin/idkit` React component (client-only, no SSR) |
| `app/api/sign/route.ts` | Generate short-lived signed rp_context; keeps signing key server-only | Next.js Route Handler using `signRequest` from `@worldcoin/idkit-core/signing` |
| `app/api/verify/route.ts` | Forward IDKitResult to World ID API; translate HTTP response | Next.js Route Handler; thin proxy to `developer.world.org` |
| `developer.world.org API` | Authoritative proof validation | External — `POST /api/v4/verify/{rp_id}` |
| World App | Biometric capture, proof generation | External — user's phone |
| Environment variables | Secure credential storage | Vercel env vars: `RP_SIGNING_KEY`, `APP_ID`, `RP_ID` |

## Recommended Project Structure

```
selfie-test/
├── app/
│   ├── layout.tsx              # Root layout (minimal)
│   ├── page.tsx                # Main page — "use client", holds all UI state
│   ├── globals.css             # Tailwind base styles
│   └── api/
│       ├── sign/
│       │   └── route.ts        # POST: generate rp_context with signRequest
│       └── verify/
│           └── route.ts        # POST: forward proof to World ID API
├── components/
│   └── SelfieWidget.tsx        # IDKitRequestWidget wrapper with dynamic import
├── lib/
│   └── world-id.ts             # Shared constants (APP_ID, RP_ID, ACTION)
├── .env.local                  # RP_SIGNING_KEY, not committed
├── next.config.ts
├── package.json
└── tsconfig.json
```

### Structure Rationale

- **`app/api/sign/` and `app/api/verify/`**: Separate routes enforce the security contract — signing key and external API calls never touch the browser bundle.
- **`components/SelfieWidget.tsx`**: Isolates the `dynamic(..., { ssr: false })` wrapper so `app/page.tsx` stays clean and testable.
- **`lib/world-id.ts`**: Single source of truth for `APP_ID`, `RP_ID`, and the action string — avoids typo drift between routes.
- **No `/db/` folder**: This is a test tool with no persistent storage; nullifier checking is intentionally omitted per project scope.

## Architectural Patterns

### Pattern 1: Server-Side Request Signing (Required)

**What:** The browser requests a signed `rp_context` from your backend before rendering the widget. The signing key never leaves the server.

**When to use:** Always — IDKit v4 refuses to open without a valid `rp_context`. This is a hard requirement, not optional.

**Trade-offs:** Adds one round-trip on page load; latency is negligible for a test tool.

**Example:**
```typescript
// app/api/sign/route.ts
import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit-core/signing";

export async function POST(req: Request) {
  const { action } = await req.json();
  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: process.env.RP_SIGNING_KEY!,
    action,
  });
  return NextResponse.json({
    sig,
    nonce,
    created_at: createdAt,
    expires_at: expiresAt,
  });
}
```

### Pattern 2: Dynamic Import with SSR Disabled

**What:** `IDKitRequestWidget` accesses browser globals and cannot run in Node.js. Wrap it in `next/dynamic` with `{ ssr: false }`.

**When to use:** Any Next.js App Router or Pages Router project using `@worldcoin/idkit`.

**Trade-offs:** Component renders only on the client; the QR code appears after hydration, not on server HTML. Acceptable for a test tool.

**Example:**
```typescript
// components/SelfieWidget.tsx
"use client";
import dynamic from "next/dynamic";
import type { IDKitRequestWidgetProps } from "@worldcoin/idkit";

const IDKitRequestWidget = dynamic(
  () => import("@worldcoin/idkit").then((m) => m.IDKitRequestWidget),
  { ssr: false }
);

export function SelfieWidget(props: IDKitRequestWidgetProps) {
  return <IDKitRequestWidget {...props} />;
}
```

### Pattern 3: Thin Proxy Verification Route

**What:** The verify API route forwards the raw `IDKitResult` payload directly to `developer.world.org` without remapping. The World ID API accepts the IDKit response shape as-is.

**When to use:** Always — do not validate proofs client-side.

**Trade-offs:** This project skips nullifier storage (out of scope). A production app would check the nullifier returned in the success response against a database before returning success.

**Example:**
```typescript
// app/api/verify/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json(); // raw IDKitResult
  const rp_id = process.env.RP_ID!;

  const res = await fetch(
    `https://developer.world.org/api/v4/verify/${rp_id}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: "verification_failed", detail: err }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}
```

## Data Flow

### Full Session Flow (Page Load → Verified)

```
Browser loads page
    ↓
useEffect → POST /api/sign { action }
    ↓
Server: signRequest(RP_SIGNING_KEY, action) → sig, nonce, timestamps
    ↓
Browser receives rp_context → setState(rpContext)
    ↓
SelfieWidget renders with rp_context, preset=selfieCheckLegacy()
    ↓
IDKit generates QR code (connect URL encoding the request)
    ↓
User scans QR with World App
    ↓
World App performs liveness/selfie check → generates Face proof
    ↓
IDKit receives proof → calls handleVerify(IDKitResult)
    ↓
handleVerify → POST /api/verify { ...IDKitResult }
    ↓
Server → POST developer.world.org/api/v4/verify/{rp_id}
    ↓
World ID API returns 200 OK
    ↓
Browser receives success → setVerified(true) → renders "Verified!"
    ↓
IDKit calls onSuccess() → optional additional state
```

### State Management

```
Component State (app/page.tsx)
  ├── rpContext: RpContext | null     (set after /api/sign response)
  ├── widgetOpen: boolean             (controls modal visibility)
  └── verified: boolean              (true after onSuccess)
```

State is local to the page component — no global store needed for this scope.

### Key Data Flows

1. **Sign flow (page load):** Browser → `POST /api/sign` → `signRequest()` → `rp_context` object → widget props. Happens once per page load; `rp_context` is short-lived (has `expires_at`).

2. **Proof flow (post-verification):** IDKit → `handleVerify(IDKitResult)` → `POST /api/verify` → `developer.world.org` → success boolean → UI state update.

3. **Secret containment:** `RP_SIGNING_KEY` flows only within the server process. `APP_ID` and `RP_ID` are non-secret and can be embedded client-side or read from env.

## Scaling Considerations

This is a single-user test tool. Scaling is not a meaningful concern. Notes for awareness only:

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1–10 users | Current architecture is correct; no changes needed |
| 10k+ users | Add nullifier storage (database) to prevent replay; rate-limit `/api/sign` |
| Production gate | Add nullifier deduplication; structured logging; alerting on verify failures |

### Scaling Priorities

1. **First bottleneck:** `rp_context` signing on each page load is CPU-cheap — not a bottleneck at any realistic scale for this use case.
2. **Second bottleneck:** External dependency on `developer.world.org` — handle timeouts gracefully with a timeout wrapper on the fetch in `/api/verify`.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Signing

**What people do:** Generate `rp_context` in the browser using the signing key passed via environment variable.

**Why it's wrong:** `NEXT_PUBLIC_*` variables are bundled into client JavaScript and visible to anyone who opens DevTools. An exposed signing key lets attackers forge valid `rp_context` objects and impersonate your app.

**Do this instead:** Keep the signing key in a server-only env var (no `NEXT_PUBLIC_` prefix) and call `signRequest` only inside a Route Handler or Server Action.

### Anti-Pattern 2: Client-Side Proof Verification

**What people do:** Call `developer.world.org` directly from the browser in `handleVerify`.

**Why it's wrong:** CORS restrictions aside, the browser has no server secret to authenticate with, and the result can be intercepted or replayed.

**Do this instead:** `handleVerify` posts the raw `IDKitResult` to your own `/api/verify` route. The server holds the authority to call the external API and trust the result.

### Anti-Pattern 3: Importing IDKit Without Disabling SSR

**What people do:** Import `IDKitRequestWidget` directly in a server component or without `{ ssr: false }`.

**Why it's wrong:** IDKit accesses browser globals (`window`, `navigator`) during module evaluation. The build fails or produces hydration errors at runtime.

**Do this instead:** Always wrap with `dynamic(() => import("@worldcoin/idkit")..., { ssr: false })`.

### Anti-Pattern 4: Reusing rp_context Across Requests

**What people do:** Generate `rp_context` once at startup and reuse it for all visitors.

**Why it's wrong:** `rp_context` has an `expires_at` timestamp and a `nonce`. Reusing it across sessions can cause the widget to silently fail when the token expires mid-session.

**Do this instead:** Fetch a fresh `rp_context` on each page load (or on each widget open if you want to be conservative).

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| `developer.world.org/api/v4/verify/{rp_id}` | Server-to-server POST with raw IDKitResult body | No API key needed; `rp_id` is in the URL path |
| World App (mobile) | IDKit handles QR code and deep-link protocol automatically | No direct server integration; all via IDKit SDK |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `page.tsx` ↔ `/api/sign` | `fetch` POST, JSON | Must be async-awaited before rendering widget |
| `handleVerify` callback ↔ `/api/verify` | `fetch` POST, JSON | IDKit awaits this — throw on failure to show error in widget |
| `/api/verify` ↔ `developer.world.org` | `fetch` POST, JSON | Add timeout; surface 4xx detail in logs for debugging |
| `SelfieWidget` ↔ `IDKitRequestWidget` | React props passthrough | Thin wrapper; keep it a dumb forwarder |

## Suggested Build Order

Build in dependency order — each step has exactly the prerequisites it needs:

1. **Project scaffold** — Next.js + TypeScript + Tailwind, env vars wired, Vercel config
2. **`/api/sign` route** — `signRequest` integration, verify it returns valid JSON; test with `curl`
3. **`/api/verify` route** — proxy to World ID API, handle errors; test with a valid proof from the simulator
4. **`SelfieWidget` component** — dynamic import wrapper, confirm no SSR errors on build
5. **`app/page.tsx`** — fetch rp_context on mount, render widget, wire `handleVerify` → `/api/verify`, show verified state
6. **End-to-end smoke test** — deploy to Vercel, scan QR with World App on staging, confirm "Verified!" renders

Steps 2 and 3 can be developed and unit-tested independently before any UI exists.

## Sources

- World ID IDKit Reference: https://docs.world.org/world-id/reference/idkit
- IDKit Integration Guide: https://docs.world.org/world-id/idkit/integrate
- IDKit React Reference: https://docs.world.org/world-id/idkit/react.md
- Legacy Presets (selfieCheckLegacy): https://docs.world.org/world-id/credentials/legacy-presets.md
- Selfie Check Beta Overview: https://docs.world.org/world-id/selfie-check/overview.md
- World ID Quick-Start Configuration: https://docs.world.org/world-id/quick-start/configuration
- idkit-js GitHub repository: https://github.com/worldcoin/idkit-js
- World ID Cloud Template: https://github.com/worldcoin/world-id-cloud-template

---
*Architecture research for: World ID IDKit integration — Next.js Selfie Check test webapp*
*Researched: 2026-04-28*
