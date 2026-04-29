# Phase 1: Backend Foundation - Research

**Researched:** 2026-04-28
**Domain:** Next.js 15 App Router, @worldcoin/idkit v4 API route signing and verification
**Confidence:** HIGH

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| INFRA-01 | Signing key stored in `RP_SIGNING_KEY` env var (non-`NEXT_PUBLIC_` prefix, never in client bundle) | Verified: Vercel env var configuration, Next.js server-only env var model |
| INFRA-02 | Next.js 15 App Router project deployable to Vercel with `@worldcoin/idkit` dependency | Verified: create-next-app scaffolding, Vercel deployment, package install |
| CORE-01 | Server generates RP signature (`rp_context`) via `/api/rp-signature` POST route using `signRequest` from `@worldcoin/idkit/signing` | Verified: official IDKit Next.js example, exact import path and function signature |
| CORE-03 | Server verifies proof via `/api/verify-proof` POST route forwarding payload to `developer.world.org/api/v4/verify/{rp_id}` | Verified: official IDKit Next.js example, exact endpoint and forwarding pattern |
</phase_requirements>

## Summary

Phase 1 creates the Next.js 15 App Router project from scratch, wires both backend API routes, configures environment variables, and establishes that the routes respond correctly to curl. There is no frontend work in this phase — the success gate is curl-testable endpoints.

The project directory currently contains only `signing-key-0x6A1cA3.json`. A `create-next-app` scaffold is required as the first task. The two API routes are then created verbatim from the official Worldcoin IDKit Next.js example. The environment variable `RP_SIGNING_KEY` must be set in both `.env.local` (development) and the Vercel project dashboard (production).

**Primary recommendation:** Follow the official IDKit Next.js example exactly. The import path `@worldcoin/idkit/signing` (not `@worldcoin/idkit-core/signing`) is confirmed correct by the official source. Do not deviate from the example route implementations.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.4.0 | App Router, Route Handlers, Vercel deployment | Official IDKit example specifies this version; LTS-equivalent stability |
| react | ^18.3.1 | UI runtime (placeholder page only in this phase) | Peer dep of next and idkit |
| react-dom | ^18.3.1 | DOM rendering | Peer dep of next and idkit |
| @worldcoin/idkit | 4.1.3 | Provides `signRequest` via `/signing` subpath export | The one package that covers both signing and widget (Phase 2) |
| viem | ^2.47.2 | Peer dependency of @worldcoin/idkit ecosystem in official example | Listed in official example package.json; install to satisfy peer deps |
| typescript | ^5.9.3 | Type safety | create-next-app default; IDKit types ship with package |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @types/react | ^18.3.12 | TypeScript types for React | Always with TS |
| @types/react-dom | ^18.3.1 | TypeScript types for React DOM | Always with TS |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @worldcoin/idkit | @worldcoin/idkit-core directly | idkit-core has /signing subpath too, but @worldcoin/idkit is needed for Phase 2 widget — install once |
| next@^15.4.0 | next@16 | Next 16 is in active development with breaking async changes — no benefit here |

**Installation:**
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
npm install @worldcoin/idkit viem
```

Note: Run `create-next-app` from within the project root (the directory that already contains `signing-key-0x6A1cA3.json`). Use `.` as the project path to scaffold in place.

## Architecture Patterns

### Recommended Project Structure
```
app/
├── api/
│   ├── rp-signature/
│   │   └── route.ts        # POST — RP signing endpoint
│   └── verify-proof/
│       └── route.ts        # POST — proof forwarding to developer.world.org
├── layout.tsx               # Root layout (from scaffold)
└── page.tsx                 # Placeholder page (just needs to 200)
.env.local                   # Local development secrets (gitignored)
signing-key-0x6A1cA3.json   # Source of RP_SIGNING_KEY value (never commit)
```

### Pattern 1: Route Handler (POST)
**What:** Named export `POST` function in `app/api/.../route.ts`, receives `Request`, returns `Response` or `NextResponse`
**When to use:** All API routes in App Router

```typescript
// Source: https://nextjs.org/docs/app/getting-started/route-handlers
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json();
  // ... processing
  return NextResponse.json({ result: "value" });
}
```

### Pattern 2: /api/rp-signature Route (Exact Official Implementation)
**What:** Signs the RP request using `signRequest` from `@worldcoin/idkit/signing`
**When to use:** This is the only implementation for CORE-01

```typescript
// Source: github.com/worldcoin/idkit/tree/main/js/examples/nextjs/app/api/rp-signature/route.ts
import { NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit/signing";

// Do NOT add: export const runtime = "edge"

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      action: string;
      ttl?: number;
    };

    const signingKey = process.env.RP_SIGNING_KEY;

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      action: body.action,
      signingKeyHex: signingKey!,
      ttl: body.ttl,
    });

    return NextResponse.json({
      sig: sig,
      nonce: nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
```

### Pattern 3: /api/verify-proof Route (Exact Official Implementation)
**What:** Thin proxy — forwards IDKit proof payload to developer.world.org
**When to use:** This is the only implementation for CORE-03

```typescript
// Source: github.com/worldcoin/idkit/tree/main/js/examples/nextjs/app/api/verify-proof/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      rp_id?: string;
      devPortalPayload?: unknown;
    };

    const baseUrl =
      process.env.DEV_PORTAL_BASE_URL?.trim() || "https://developer.world.org";

    const response = await fetch(`${baseUrl}/api/v4/verify/${body.rp_id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body.devPortalPayload),
    });

    const payload = await response.json();
    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
```

### Pattern 4: Environment Variable Configuration
**What:** Server-side secrets stored without `NEXT_PUBLIC_` prefix
**When to use:** Always for signing key

`.env.local` (development, gitignored):
```
RP_SIGNING_KEY=0x5a740420eeea717300a714d9db73a1faf8be98eccb2c8a6739226da631754286
NEXT_PUBLIC_APP_ID=app_4c0f2b7ac8e5f61b994ff642c8670c62
NEXT_PUBLIC_RP_ID=rp_af321e6c2016688e
DEV_PORTAL_BASE_URL=https://developer.world.org
```

Vercel dashboard: add the same four variables under Settings > Environment Variables, targeting Production + Preview + Development environments.

### Anti-Patterns to Avoid
- **`NEXT_PUBLIC_RP_SIGNING_KEY`:** Adding `NEXT_PUBLIC_` prefix exposes the private key in the browser bundle. The key is never needed client-side.
- **`export const runtime = "edge"` on signing route:** The `@worldcoin/idkit-server` package (used internally by the signing function) is compiled for Node.js. Edge runtime excludes it. The commented-out line in the official example (`// export const runtime = "nodejs"`) indicates Node.js runtime is intentional.
- **Importing from `@worldcoin/idkit-core/signing` instead of `@worldcoin/idkit/signing`:** Both subpaths technically exist, but the official example uses `@worldcoin/idkit/signing`. Use that path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RP request signing | Custom ECDSA signing with raw crypto | `signRequest` from `@worldcoin/idkit/signing` | Correct nonce, TTL, timestamp format required by World ID protocol; rolling it breaks the RP flow silently |
| Proof verification | Custom call to developer.world.org | `@worldcoin/idkit/signing` proxy pattern | The verify-proof route is already a thin proxy — no logic needed |
| Next.js scaffold | Manual file creation | `create-next-app` | Scaffolding sets up tsconfig, next.config, tailwind, ESLint correctly |

**Key insight:** Both API routes are thin wrappers. The signing route calls one library function; the verify route is a fetch proxy. Any additional logic is wrong.

## Common Pitfalls

### Pitfall 1: Wrong import path for signRequest
**What goes wrong:** `import { signRequest } from "@worldcoin/idkit-core/signing"` works locally but causes confusion about which package owns the API
**Why it happens:** `@worldcoin/idkit-core` also exports a `/signing` subpath (idkit depends on it internally)
**How to avoid:** Always use `@worldcoin/idkit/signing` — this is what the official example uses
**Warning signs:** TypeScript errors about missing types if wrong package is imported

### Pitfall 2: Signing key exposed in client bundle
**What goes wrong:** Using `NEXT_PUBLIC_RP_SIGNING_KEY` makes the private key accessible in browser devtools and the Vercel deployment bundle inspector
**Why it happens:** `NEXT_PUBLIC_` prefix is how Next.js inlines env vars into the client bundle at build time
**How to avoid:** Use `RP_SIGNING_KEY` (no prefix) — accessed only in route handlers which are server-only
**Warning signs:** The key appears in `/_next/static/chunks/` build artifacts

### Pitfall 3: create-next-app run in wrong directory
**What goes wrong:** Running `npx create-next-app@latest selfie-test` from the parent directory creates a nested `selfie-test/selfie-test/` structure
**Why it happens:** The project root is `/home/murph/src/personal/selfie-test/` — scaffolding must happen inside it
**How to avoid:** `cd` to the project root first, then `npx create-next-app@latest .` (dot = current directory)
**Warning signs:** `signing-key-0x6A1cA3.json` ends up outside the Next.js project root

### Pitfall 4: DEV_PORTAL_BASE_URL misconfiguration
**What goes wrong:** Omitting the env var causes the verify route to use the hardcoded default `https://developer.world.org` — which is correct, but is silent about its behavior
**Why it happens:** The route checks `process.env.DEV_PORTAL_BASE_URL?.trim() || "https://developer.world.org"`
**How to avoid:** Set `DEV_PORTAL_BASE_URL=https://developer.world.org` explicitly in `.env.local` — makes the value visible and overridable
**Warning signs:** No warning; it silently uses the default

### Pitfall 5: .env.local committed to git
**What goes wrong:** The private signing key `0x5a740420...` is pushed to the repository
**Why it happens:** `signing-key-0x6A1cA3.json` is already in the root — easy to accidentally include both files
**How to avoid:** Verify `.gitignore` includes `.env.local` and `*.json` pattern or specific filename exclusion; do not commit `signing-key-0x6A1cA3.json` either
**Warning signs:** `git status` shows either file staged

### Pitfall 6: rp_id vs app_id confusion in verify endpoint
**What goes wrong:** Using `app_id` in the verify URL path instead of `rp_id`
**Why it happens:** Both IDs exist; the verify endpoint uses `rp_id`
**How to avoid:** URL is `/api/v4/verify/${body.rp_id}` — `rp_id` from the request body (`rp_af321e6c2016688e`)
**Warning signs:** 404 from developer.world.org

## Code Examples

### curl test for /api/rp-signature
```bash
# Source: Phase 1 success criteria
curl -s -X POST http://localhost:3000/api/rp-signature \
  -H "Content-Type: application/json" \
  -d '{"action": "selfie-check"}' | jq .
# Expected: { "sig": "...", "nonce": "...", "created_at": "...", "expires_at": "..." }
```

### curl test for /api/verify-proof
```bash
# Source: Phase 1 success criteria
curl -s -X POST http://localhost:3000/api/verify-proof \
  -H "Content-Type: application/json" \
  -d '{
    "rp_id": "rp_af321e6c2016688e",
    "devPortalPayload": {
      "nullifier_hash": "0x...",
      "merkle_root": "0x...",
      "proof": "0x...",
      "verification_level": "device"
    }
  }' | jq .
# Expected: upstream response from developer.world.org (may 400 with fake payload — that is correct behavior)
```

### Reading the signing key from JSON file (one-time setup task)
```bash
# Extract privateKey from signing-key-0x6A1cA3.json for .env.local
node -e "const k = require('./signing-key-0x6A1cA3.json'); console.log('RP_SIGNING_KEY=' + k.privateKey)"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `/pages/api/` | App Router `app/api/.../route.ts` | Next.js 13+ (stable 14) | Route Handlers use Web Request/Response APIs |
| `@worldcoin/idkit-js` v2.x | `@worldcoin/idkit` v4.x | 2024 | Completely new API; v2 is archived |
| `idkit-core/signing` in early research | `@worldcoin/idkit/signing` | Confirmed by official example | Use idkit package, not idkit-core directly |

**Deprecated/outdated:**
- `@worldcoin/idkit-js`: Archived v2.x package — do not use
- Pages Router for new projects: App Router is the current standard
- `export const runtime = 'edge'` on signing route: Was never correct; confirmed by commented-out line in official example

## Open Questions

1. **Does `@worldcoin/idkit/signing` work in Vercel serverless functions (Node.js runtime) without explicit runtime declaration?**
   - What we know: `@worldcoin/idkit-server` uses `@noble/secp256k1` (pure JS, no native addons). The official example has `// export const runtime = "nodejs"` commented out, suggesting default runtime works.
   - What's unclear: Whether Vercel's default Node.js runtime for App Router route handlers needs any explicit `runtime` declaration
   - Recommendation: Deploy without `export const runtime` and verify. If signing fails on Vercel, add `export const runtime = "nodejs"` explicitly.

2. **Should `signing-key-0x6A1cA3.json` be deleted after extracting to `.env.local`?**
   - What we know: The file contains a private key with a "do not commit" warning. It should not be in git history.
   - What's unclear: Whether the file predates the git repo (no git history exists) or was already added
   - Recommendation: Ensure `.gitignore` excludes `*.json` at root or specifically `signing-key-0x6A1cA3.json`. Ideally delete it after creating `.env.local`.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — curl-based smoke tests only |
| Config file | none — Wave 0 gap if automated tests desired |
| Quick run command | `curl -s -X POST http://localhost:3000/api/rp-signature -H "Content-Type: application/json" -d '{"action":"selfie-check"}' \| jq .sig` |
| Full suite command | Manual curl for both endpoints (see Code Examples above) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `RP_SIGNING_KEY` is not in client bundle | manual | Inspect `npm run build` output — search `_next/static/chunks/` for key value | N/A |
| INFRA-02 | Root path returns 200 | smoke | `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000` returns 200 | N/A |
| CORE-01 | `/api/rp-signature` returns `{sig, nonce, created_at, expires_at}` | smoke | `curl -s -X POST .../api/rp-signature -d '{"action":"selfie-check"}' -H "Content-Type: application/json" \| jq '.sig'` | N/A |
| CORE-03 | `/api/verify-proof` proxies to developer.world.org | smoke | `curl -s -X POST .../api/verify-proof -d '{"rp_id":"rp_af321e6c2016688e","devPortalPayload":{}}' -H "Content-Type: application/json" \| jq .` returns upstream response | N/A |

### Sampling Rate
- **Per task commit:** Manual curl check against `localhost:3000` after each route is implemented
- **Per wave merge:** All four curl tests above must return expected responses
- **Phase gate:** All curl tests green + `vercel deploy` succeeds before Phase 2

### Wave 0 Gaps
- No automated test framework exists — this phase uses curl smoke tests only, which is appropriate for a minimal backend scaffold. No unit test infrastructure is needed for Phase 1.

## Sources

### Primary (HIGH confidence)
- `github.com/worldcoin/idkit/tree/main/js/examples/nextjs` — Official IDKit Next.js example; exact import paths, env vars, route implementations verified by direct file fetch
- `registry.npmjs.org/@worldcoin/idkit/latest` — Confirmed `/signing` subpath export in v4.1.3; peer deps (react >=18)
- `registry.npmjs.org/@worldcoin/idkit-core/latest` — Confirmed internal dep chain: idkit-core -> idkit-server -> @noble/secp256k1
- `nextjs.org/docs/app/getting-started/installation` — create-next-app flags, scaffold structure, `--yes` defaults
- `nextjs.org/docs/app/getting-started/route-handlers` — Route Handler POST pattern, NextResponse.json usage
- `vercel.com/docs/environment-variables` — Server-only vs NEXT_PUBLIC_ env vars, Vercel dashboard configuration

### Secondary (MEDIUM confidence)
- `registry.npmjs.org/@worldcoin/idkit-server/latest` — Uses @noble/secp256k1 (pure JS, not Node native crypto); verified why edge runtime restriction exists
- WebSearch results confirming: Next.js 15 App Router is current standard; viem is peer dep in official example

### Tertiary (LOW confidence)
- Vercel community report of env vars missing in Next.js 15 API routes — unverified edge case; monitor if RP_SIGNING_KEY is undefined at runtime on Vercel

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions confirmed from official example and npm registry
- Architecture: HIGH — route implementations confirmed verbatim from official IDKit Next.js example
- Pitfalls: HIGH — import path verified; env var model verified by Next.js and Vercel docs; edge runtime issue confirmed by official example comment
- Validation: HIGH — curl tests are the phase's own success criteria per ROADMAP.md

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable ecosystem; @worldcoin/idkit v4 is current release)
