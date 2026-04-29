# Feature Research

**Domain:** World ID Selfie Check test harness webapp
**Researched:** 2026-04-28
**Confidence:** MEDIUM — IDKit v4.x official docs consulted; selfieCheckLegacy preset is beta and not fully documented publicly

## Feature Landscape

### Table Stakes (Users Expect These)

Features a developer expects from a verification test harness. Missing any of these means the tool doesn't work as a test harness.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| QR code display on page load | Entry point for the entire flow — no QR, no test | LOW | IDKitRequestWidget renders this; widget must open automatically |
| Server-side RP signature generation | Required by IDKit v4.x — client cannot sign | MEDIUM | `/api/sign` endpoint using `signRequest` from `@worldcoin/idkit-core/signing`; signing key must never be exposed to client |
| Server-side proof verification | Security requirement; IDKit docs are explicit that backend must verify | MEDIUM | `POST https://developer.world.org/api/v4/verify/{rp_id}` with raw IDKit response |
| "Verified!" success confirmation | User needs to know the full round-trip worked | LOW | Display after `onSuccess` callback fires |
| Environment variable credential storage | app_id, rp_id, signing key must not be committed | LOW | Standard Next.js `.env.local` pattern |
| selfieCheckLegacy preset wired | Without the correct preset the wrong proof type is requested | LOW | Pass `preset={selfieCheckLegacy()}` to IDKitRequestWidget |
| Staging/production environment toggle | Simulator only works with `environment: "staging"` | LOW | Single env var `NEXT_PUBLIC_IDKIT_ENVIRONMENT`; must be "staging" for simulator, "production" for real device |

### Differentiators (Nice to Have for Testing)

Features that make the test harness more useful for debugging and iterating on the Selfie Check beta flow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Raw proof/response display | Shows the full IDKit response payload for debugging — nullifier, protocol_version, results array | LOW | JSON.stringify the IDKit response into a `<pre>` block; extremely useful for beta validation |
| Verify API response display | Shows what the World ID verify endpoint actually returned (success fields, nullifier, created_at, environment) | LOW | Log/display the JSON from the verify API call |
| Error state display with message | Shows the error code and detail when verification fails (e.g., `all_verifications_failed`, `verification_error`) | LOW | IDKit `onError` + backend error response surfaced to UI |
| Nullifier display | Makes it easy to confirm the same user doesn't double-verify in testing | LOW | Part of verify API response; display `nullifier` field |
| One-click QR URL copy | World ID simulator supports pasting a connect URL — avoids manual copy | LOW | Copy the connection URL to clipboard; labeled "Copy for Simulator" |
| Staging/production mode indicator | Prevents confusion about which environment a test ran in | LOW | Badge or label showing current environment value |
| Re-trigger flow button | Allows re-running without a full page reload | LOW | Reset IDKit state and re-open widget on button click |
| Action label display | Shows which action string was used — confirms scoping is correct | LOW | Display the `action` value configured for the widget |

### Anti-Features (Deliberately NOT Build)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Nullifier persistence / database | "Track who has verified" | Out of scope per PROJECT.md; adds infra complexity and session handling for zero test value | In-memory session only; display nullifier on screen after each verify |
| User accounts / auth | "Protect the test page" | This is a single-purpose internal test page; auth adds friction without value | Deploy to a non-indexed Vercel URL; share URL directly |
| Mobile-native QR scanning path | "Make it work on phone" | The QR flow is designed to be desktop-displayed and phone-scanned; swapping makes the flow untestable | Keep desktop display, phone scanning as designed |
| Production fraud prevention | "Make it production-safe" | Test tool explicitly; adding rate-limiting, nullifier dedup across sessions complicates the harness | Accept that nullifiers from the same person always match; display them |
| Custom action builder UI | "Let users pick actions" | Scope creep; action is a fixed test value | Hard-code the action in env var or config constant |
| Webhook / event forwarding | "Send verification events somewhere" | Adds outbound networking and endpoint config for zero test value | Display proof data inline |
| Multi-action / multi-app support | "Test different app configurations" | Multiplies config complexity; this tool has one app_id and one rp_id | Build separate deployments for different configurations if needed |

## Feature Dependencies

```
Server-side RP signature [/api/sign]
    └──required by──> QR code display (IDKitRequestWidget needs rp_context)
                          └──required by──> User completes Selfie Check in World App
                                                └──required by──> Proof returned to client (onSuccess)
                                                                      └──required by──> Server-side proof verification [/api/verify]
                                                                                            └──required by──> "Verified!" confirmation display

Raw proof display ──enhances──> Server-side proof verification
Verify API response display ──enhances──> Server-side proof verification
Error state display ──enhances──> Server-side proof verification (onError path)
One-click QR URL copy ──enhances──> QR code display (simulator workflow)
Nullifier display ──enhances──> Verify API response display
Re-trigger flow button ──enhances──> QR code display
Environment indicator ──enhances──> Staging/production environment toggle
```

### Dependency Notes

- **RP signature required before QR display:** IDKit v4.x will not render a valid QR without a signed `rp_context`. The signature fetch must complete before the widget opens.
- **Proof verification depends on proof receipt:** The verify API call only happens inside `handleVerify`, which IDKit calls with the proof payload. No proof = no verify call.
- **Raw display enhances verify:** Raw proof and verify API response are independent displays that both depend on the verify round-trip completing.
- **One-click copy is simulator-specific:** Only useful in staging; has no value in production but doesn't conflict.

## MVP Definition

### Launch With (v1)

Minimum to validate the Selfie Check beta flow end-to-end.

- [ ] QR code displayed automatically on page load — without this nothing works
- [ ] Server-side RP signature endpoint (`/api/sign`) — required by IDKit v4.x
- [ ] Server-side proof verification endpoint (`/api/verify`) — confirms the proof is valid
- [ ] "Verified!" success message — confirms the full round-trip completed
- [ ] Raw IDKit response display — essential for debugging a beta feature with sparse docs
- [ ] Error state display — beta flow will have failures; must see why
- [ ] Environment variable credential storage — no secrets committed

### Add After Validation (v1.x)

Add once basic round-trip is confirmed working.

- [ ] Verify API response display (nullifier, created_at, environment) — add when debugging specific proof fields
- [ ] One-click QR URL copy for simulator — add when iterating rapidly with the World ID simulator
- [ ] Re-trigger flow button — add when running repeated tests in a session
- [ ] Staging/production mode indicator — add when sharing with other team members to prevent confusion

### Future Consideration (v2+)

- [ ] Action label and config display — useful if the tool evolves to test multiple configurations
- [ ] Logging / test run history (in-memory only) — useful for comparing runs within a session without a database

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| QR code display (IDKitRequestWidget) | HIGH | LOW | P1 |
| Server-side RP signature (/api/sign) | HIGH | MEDIUM | P1 |
| Server-side proof verification (/api/verify) | HIGH | MEDIUM | P1 |
| "Verified!" success message | HIGH | LOW | P1 |
| Raw IDKit response display | HIGH | LOW | P1 |
| Error state display | HIGH | LOW | P1 |
| Environment variable credential storage | HIGH | LOW | P1 |
| Verify API response display | MEDIUM | LOW | P2 |
| One-click QR URL copy (simulator) | MEDIUM | LOW | P2 |
| Re-trigger flow button | MEDIUM | LOW | P2 |
| Staging/production indicator badge | LOW | LOW | P2 |
| Action label display | LOW | LOW | P3 |

## Competitor Feature Analysis

No direct competitor test harnesses for World ID Selfie Check exist — this is a beta feature with no prior art. Comparison is against general IDKit integration examples and the World ID staging simulator.

| Feature | World ID Simulator (worldcoin/simulator) | Typical IDKit Example Apps | This Tool |
|---------|------------------------------------------|---------------------------|-----------|
| QR code display | Yes (simulated) | Yes | Yes |
| RP signature (v4) | N/A (internal) | Sometimes omitted | Yes, required |
| Raw proof display | No | Rarely | Yes — P1 |
| Verify API response | No | Rarely | Yes — P2 |
| selfieCheckLegacy preset | Unknown (beta) | Not seen in public examples | Yes |
| Error display | No | Rarely | Yes — P1 |
| Production-safe | N/A | Sometimes | Deliberately not |

## Sources

- [IDKit Integration Docs — docs.world.org](https://docs.world.org/world-id/idkit/integrate)
- [IDKit Reference — docs.world.org](https://docs.world.org/world-id/reference/idkit)
- [Verify API Reference — docs.world.org](https://docs.world.org/world-id/reference/api)
- [Testing World ID — docs.world.org](https://docs.world.org/world-id/id/testing)
- [worldcoin/idkit-js on GitHub](https://github.com/worldcoin/idkit-js)
- [World ID Debug Tools (archived Aug 2025) — github.com/worldcoin/world-id-debug-tools](https://github.com/worldcoin/world-id-debug-tools)
- [PROJECT.md — project scope constraints](/.planning/PROJECT.md)

---
*Feature research for: World ID Selfie Check test harness webapp*
*Researched: 2026-04-28*
