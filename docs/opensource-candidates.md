# Open Source Candidates

Utilities and patterns in toolnexus-app that could be extracted as standalone packages.

Last reviewed: 2026-03-29

---

## 🟢 Strong Candidates

### 1. `focus-tracked-edit-state` pattern / hook
- **What:** `useState<string | null>` pattern for controlled inputs that sync with external state (DB round-trips, parent props). Null = derived mode, string = edit mode. No `useEffect`, no `setState`-in-render.
- **File:** `src/components/project/ClipEditControls.tsx`
- **Why open-source:** Solves a common pain point. Could be a tiny `useEditableValue(externalValue)` hook — ~20 lines.
- **Status:** Added today (2026-03-28). Blog post published.

### 2. `videoControls.ts` — ref-based video control factory
- **What:** Factory functions (`makeSeekToClip`, `makeTogglePlay`, `makeSkipTo`, `makeTimelineDrag`) that take refs and return event handlers. Separates video control logic from component render.
- **File:** `src/components/project/videoControls.ts`
- **Why open-source:** Ref-based video control pattern is underrepresented. Framework-agnostic logic layer.
- **Status:** Stable, in use.

### 3. `callLLM` — provider-agnostic LLM wrapper
- **What:** Single function that dispatches to Gemini (or other providers) based on env config. Standard message format in/out.
- **File:** `src/lib/llm.ts`
- **Why open-source:** Lightweight alternative to heavier AI SDK abstractions. Zero deps beyond the provider SDKs.
- **Status:** Stable, in use.

---

## 🟡 Possible (needs more polish)

### 4. Timeline handle drag with touch support
- **What:** Drag-to-trim timeline handles with mouse + touch event support, wider hit targets, init to current value (not 0).
- **File:** `src/components/project/PlayerSection.tsx` (drag logic), `videoControls.ts`
- **Why:** Touch-friendly timeline trim is non-trivial and poorly documented.
- **Status:** Fixed today (2026-03-28). Works but tightly coupled to app types.

### 5. `ClipTimingEditor` / `ClipTopicEditor` shared edit components
- **What:** Inline edit components for clip metadata that work in both list and graph views, with shared state management.
- **File:** `src/components/project/ClipEditControls.tsx`
- **Why:** Pattern of "same edit UX across multiple views" is reusable.
- **Status:** New today. Needs API abstraction before extracting.

---

### 7. `inngest-alerts` webhook pattern
- **What:** Inngest `function.failed` webhook receiver that verifies HMAC signatures and forwards alerts to an OpenClaw system event. Generic pattern for any Inngest → external notification flow.
- **File:** `src/app/api/webhooks/inngest-alerts/route.ts`
- **Why open-source:** Inngest alert forwarding is poorly documented. The HMAC verification + notify pattern is reusable for any webhook receiver.
- **Status:** Added 2026-03-29. Works in production.

### 8. `/api/health` parallel service check pattern
- **What:** `Promise.all`-based health check that runs Supabase, R2, and Railway worker pings in parallel and returns an aggregated `ok/degraded/down` status. Structured JSON response with per-service latency.
- **File:** `src/app/api/health/route.ts`
- **Why open-source:** Clean reference for Next.js multi-service health endpoints. Pattern is general-purpose.
- **Status:** Added 2026-03-29. Stable.

---

## 🔴 Not Ready

### 6. Presigned R2 upload/download flow
- **What:** Cloudflare R2 presigned URLs with `Content-Disposition: attachment` for forced downloads.
- **Why not yet:** Tightly coupled to Supabase auth + Inngest job IDs. Needs decoupling first.

---

## Notes
- Priority for extraction: `useEditableValue` hook (tiny, zero deps, highly reusable)
- All candidates should be MIT licensed
- Publish to npm under `@clipcrafter` scope or as standalone packages
