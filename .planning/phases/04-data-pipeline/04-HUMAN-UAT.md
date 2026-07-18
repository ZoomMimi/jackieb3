---
status: partial
phase: 04-data-pipeline
source: [04-VERIFICATION.md]
started: 2026-07-18T00:00:00Z
updated: 2026-07-18T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Timezone spot-check — 5 photos with known locations assigned to correct local-timezone day

expected: Select 5 photos from `.planning/data/photo-index.json` with known physical locations and verify each was assigned to the correct local-timezone calendar day in `.planning/data/voyage-timeline-enriched.json`. Photos taken near midnight Eastern time are the risk: if the pipeline used raw UTC division, those photos would land on the wrong day. Confirm the day assignment uses local timezone (Eastern/ET), not raw UTC.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
