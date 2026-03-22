# Abstraction Audit Log

## Phase 8 Audit — 2026-03-22

### Found & Fixed
- **DRY violation:** `src/lib/gemini.ts` was a dead file with an old `generateHighlights` function superseded by `highlights.ts`. Deleted.
- **SOLID/DRY:** All Gemini SDK calls in `highlights.ts` were inline. Extracted to `src/lib/llm.ts` (provider-agnostic `callLLM`). Highlights now calls `callLLM` — can swap providers via env vars.
- **YAGNI:** `clip-export.ts` had a stub render step with no implementation. Replaced with real ffmpeg export.

### Still OK
- `transcribe.ts` — Sarvam-specific by design (unique Batch API, not chat completions). Not worth abstracting yet — YAGNI.
- `r2.ts` — S3-compatible, already abstracted enough.
- `process-video.ts` — large but single responsibility (video pipeline). Steps are logically separated.
