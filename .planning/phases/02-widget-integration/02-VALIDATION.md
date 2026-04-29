---
phase: 2
slug: widget-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (live World App scan required) |
| **Config file** | none |
| **Quick run command** | `npm run build` |
| **Full suite command** | `npm run build && npm run start` then manual QR scan test |
| **Estimated runtime** | ~10 seconds (build) + manual testing |

---

## Sampling Rate

- **After every task commit:** Run `npm run build`
- **After every plan wave:** Build + manual verification on localhost
- **Before `/gsd:verify-work`:** Full manual walkthrough on Vercel deployment
- **Max feedback latency:** 10 seconds (build only)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | CORE-02 | manual | `npm run build` exits 0 | N/A | ⬜ pending |
| 2-01-01 | 01 | 1 | CORE-04 | manual | Visual check: "Verified!" after scan | N/A | ⬜ pending |
| 2-01-01 | 01 | 1 | ERR-01 | manual | Visual check: error code displayed on failure | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*No automated test framework needed — all phase behaviors require live World App interaction.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| QR code displays in IDKit modal | CORE-02 | Requires browser rendering + IDKit widget | Open page, click "Start Verification", verify QR modal appears |
| "Verified!" shown after scan | CORE-04 | Requires live World App Selfie Check | Scan QR with World App, complete Selfie Check, verify success message |
| Error code shown on failure | ERR-01 | Requires triggering an error condition | Cancel/reject in World App, verify error code displayed |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
