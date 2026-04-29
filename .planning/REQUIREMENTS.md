# Requirements: Selfie Test Tester

**Defined:** 2026-04-28
**Core Value:** Display a working Selfie Check QR code and confirm verification succeeds

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Core Integration

- [x] **CORE-01**: Server generates RP signature (`rp_context`) via `/api/rp-signature` POST route using `signRequest` from `@worldcoin/idkit/signing`
- [ ] **CORE-02**: Page displays IDKit Selfie Check QR code using `IDKitRequestWidget` with `selfieCheckLegacy` preset
- [x] **CORE-03**: Server verifies proof via `/api/verify-proof` POST route forwarding payload to `developer.world.org/api/v4/verify/{rp_id}`
- [ ] **CORE-04**: Page shows "Verified!" message on successful Selfie Check completion

### Infrastructure

- [x] **INFRA-01**: Signing key stored in `RP_SIGNING_KEY` env var (non-`NEXT_PUBLIC_` prefix, never in client bundle)
- [x] **INFRA-02**: Next.js 15 App Router project deployable to Vercel with `@worldcoin/idkit` dependency

### Error Handling

- [ ] **ERR-01**: Page displays error state with IDKit error code when verification fails

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Developer Experience

- **DX-01**: Display raw IDKit response payload for debugging
- **DX-02**: Re-trigger verification button without page reload
- **DX-03**: Staging/production environment toggle

## Out of Scope

| Feature | Reason |
|---------|--------|
| Database / nullifier storage | Test tool only — no persistence needed |
| User accounts / auth | Single-purpose test page |
| Mobile-native deep link flow | Desktop QR flow only |
| Production fraud prevention | Test harness, not production gate |
| Custom action builder UI | Hardcoded action is fine for testing |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CORE-01 | Phase 1 | Complete |
| CORE-02 | Phase 2 | Pending |
| CORE-03 | Phase 1 | Complete |
| CORE-04 | Phase 2 | Pending |
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| ERR-01 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-04-28*
*Last updated: 2026-04-28 — traceability filled after roadmap creation*
