---
phase: 1
slug: backend-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | curl (manual smoke tests for API routes) |
| **Config file** | none — no test framework for Phase 1 |
| **Quick run command** | `curl -s -X POST http://localhost:3000/api/rp-signature -H 'Content-Type: application/json' -d '{"action":"test"}' \| jq .` |
| **Full suite command** | `npm run build && npm run start` then curl both routes |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick curl command against dev server
- **After every plan wave:** Build and test both routes
- **Before `/gsd:verify-work`:** Both routes return valid responses
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INFRA-02 | smoke | `npm run build` exits 0 | N/A | ⬜ pending |
| 1-01-02 | 01 | 1 | INFRA-01 | manual | Verify `.env.local` has `RP_SIGNING_KEY` (non-NEXT_PUBLIC) | N/A | ⬜ pending |
| 1-01-03 | 01 | 1 | CORE-01 | smoke | `curl -X POST /api/rp-signature` returns JSON with sig,nonce | N/A | ⬜ pending |
| 1-01-04 | 01 | 1 | CORE-03 | smoke | `curl -X POST /api/verify-proof` returns upstream response | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — curl-based smoke tests only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Signing key not in client bundle | INFRA-01 | Requires inspecting build output | `npm run build` then `grep -r "RP_SIGNING_KEY" .next/static/` returns empty |
| Vercel deploy succeeds | INFRA-02 | Requires external service | `vercel deploy` and check HTTP 200 on root |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
