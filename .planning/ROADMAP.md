# Roadmap: Selfie Test Tester

## Overview

Two phases deliver the complete test harness. Phase 1 establishes the Next.js project and both API routes — the backend is testable with curl before any UI exists. Phase 2 wires the IDKit widget to those routes, completing the end-to-end flow with success and error display.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Backend Foundation** - Next.js scaffold + both API routes, curl-testable
- [ ] **Phase 2: Widget Integration** - IDKit QR widget wired to routes with success/error display

## Phase Details

### Phase 1: Backend Foundation
**Goal**: The Next.js project exists, deploys to Vercel, and both API routes respond correctly to curl requests
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, CORE-01, CORE-03
**Success Criteria** (what must be TRUE):
  1. `curl -X POST /api/rp-signature` returns a valid `rp_context` JSON object signed with the RP signing key
  2. `curl -X POST /api/verify-proof` forwards a proof payload to `developer.world.org/api/v4/verify/{rp_id}` and returns the upstream response
  3. `RP_SIGNING_KEY` env var is consumed only server-side — it does not appear in any client bundle or `NEXT_PUBLIC_` variable
  4. `vercel deploy` succeeds and the deployed URL returns a 200 on the root path
**Plans**: TBD

### Phase 2: Widget Integration
**Goal**: A user can open the page, scan the QR code, complete Selfie Check in World App, and see a result on screen
**Depends on**: Phase 1
**Requirements**: CORE-02, CORE-04, ERR-01
**Success Criteria** (what must be TRUE):
  1. Visiting the page displays the IDKit `IDKitRequestWidget` QR code using the `selfieCheckLegacy` preset
  2. After a successful Selfie Check scan, the page shows a "Verified!" message
  3. After a failed or rejected verification, the page displays an error state including the IDKit error code
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Backend Foundation | 0/TBD | Not started | - |
| 2. Widget Integration | 0/TBD | Not started | - |
