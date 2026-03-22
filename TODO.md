# ClipCrafter — Task Tracker

> Simple kanban in markdown. Move items between sections as they progress.
> Format: `- [ ] task description` | **Priority:** 🔴 high / 🟡 medium / 🟢 low

---

## 🚧 In Progress

- [ ] Verify highlights timestamp sync is correct after two-pass fix (retry a project and check) 🔴

---

## 📋 Backlog

### Production Blockers
- [ ] **yt-dlp cookies**: `--cookies-from-browser chrome` only works in local dev. Need a cookie export strategy for Vercel/cloud deployment 🔴
- [ ] **Live stream downloads**: YouTube live URLs (`/live/`) are unreliable with yt-dlp. Add detection + user-facing warning to use regular `watch?v=` URLs 🔴
- [ ] **Clips table migration**: Currently applied manually via psql. Add to a proper migration script so it runs automatically on deploy 🟡

### Video Player
- [ ] YouTube iframe: clicking a clip card should seek the iframe to the right timestamp (requires YouTube IFrame API) 🟡
- [ ] Show video duration in project card on dashboard 🟢
- [ ] Timeline drag handles: test with an actual uploaded MP4 (not YouTube) 🟡

### Highlights & Clips
- [ ] Test two-pass highlights (Gemini) end-to-end with a real non-live YouTube video 🔴
- [ ] Clip export: Inngest `clip.export` job is a stub — implement actual ffmpeg trim + R2 upload 🟡
- [ ] Auto-regenerate clips when user hits Retry on a project (currently only generates on manual click) 🟢

### UX
- [ ] Dashboard: show project thumbnail (extract first frame via ffmpeg and store in R2) 🟢
- [ ] Empty state on dashboard feels bare — add example/demo project 🟢
- [ ] Mobile: test clip card controls at 390px (dropdowns may overflow) 🟡

### Infrastructure
- [ ] Set up proper Supabase migrations CLI flow (supabase link + supabase db push) instead of manual psql 🟡
- [ ] Add error alerting — currently failures are silent in production 🟡
- [ ] Git author config (name + email not set, showing as hostname) 🟢

---

## ✅ Done

- [x] Phase 1–7: Next.js scaffold, auth, DB, R2 upload, Inngest pipeline, dashboard UI
- [x] Phase 8: Clip queue with scores, hashtags, clip titles
- [x] Two-column layout: sidebar clips + interactive video player
- [x] Keep/Skip instead of Approve/Reject
- [x] YouTube iframe fallback for old projects
- [x] Fix: YouTube video now uploaded to R2 after yt-dlp download (playable in browser)
- [x] Fix: Highlights now use two-pass approach (MM:SS ranges → enrich) — accurate timestamps
- [x] Fix: Transcript segments passed as `[MM:SS] text` format to Gemini (not raw text)
- [x] Fix: Switch highlights provider to Gemini
- [x] Fix: yt-dlp uses `--cookies-from-browser chrome` to bypass bot detection (local dev)

---

*Last updated: 2026-03-22*
