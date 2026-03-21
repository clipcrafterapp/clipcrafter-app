
---

## Phase 8 — Migrate Prototype Tools (from ~/dev/toolnexus)

The original prototype has these tools to migrate to ClipCrafter:

### 8.1 — VideoTrimmer (core tool)
- Multi-segment trim with speed control per segment
- YouTube URL + file upload input
- AI highlight extraction (uses transcript → Gemini)
- Auto-remove silence
- Captions generation (via Sarvam STT) with language selection
- Caption overlay on export
- Preview player with segment markers
- Export trimmed video (ffmpeg server-side or client-side WebCodecs)

### 8.2 — SmartVideoCropper
- Aspect ratio presets: 9:16 (Reels/TikTok), 1:1 (Square), 4:5 (Portrait), 16:9 (Landscape)
- Drag-to-reposition subject within frame
- Background color fill
- Live preview + export

### 8.3 — VideoPolisher (captions tool)
- Auto-generate captions from audio (Sarvam STT)
- Caption styles: modern, hormozi (yellow/black), neon, minimal
- Per-caption emoji enrichment (Gemini)
- Draggable caption box positioning
- Edit captions manually
- Export with burned-in captions

### 8.4 — BackgroundRemover
- AI background removal (Gemini vision)
- Image upload + preview
- Export as PNG with transparency

### 8.5 — ImageAnalyzer
- Analyze any image with Gemini vision
- Free-form Q&A about image content

### 8.6 — RegexGenerator
- Natural language → regex via Gemini
- Test against sample strings

### 8.7 — SpriteGenerator + SpritesheetAnimator
- Upload character image → AI analyzes animations
- Generate sprite sheet frames
- Preview animation

### 8.8 — StyleChanger
- Apply AI style transfer to images

### Tool Architecture
- All tools accessible from dashboard sidebar
- Tools that need video use the project system (transcript reuse)
- Tools that are standalone (BackgroundRemover, RegexGenerator, etc.) render inline
- Each tool gets its own route: /dashboard/tools/[toolId]

---

## Phase 9 — Billing (Stripe)
- Free: 30 min/month audio, watermarked export
- Pro: 10hr/month, $9/mo
- Team: unlimited, $29/mo

## Phase 10 — Polish
- Landing page improvements
- Error handling + toasts (react-hot-toast)
- Realtime via Supabase channels (replace polling)
- Mobile testing

---

## Revised Roadmap (OpusClip competitor analysis — 2026-03-21)

### Core insight
OpusClip wins on: auto-clipping any genre, AI reframe with subject tracking, viral scoring, direct publish to platforms.
ClipCrafter's edge: Indian language superiority (Sarvam), YouTube-first, open-source potential.

---

## Phase 8 — Core Video Tools (from prototype)

### 8.1 — AI Clip Editor (VideoTrimmer migration)
- Multi-segment trim with per-segment speed control
- AI-powered highlight selection from transcript (using existing Sarvam transcript)
- Silence auto-removal
- YouTube URL input (reuses cached transcript)
- Preview player with segment timeline
- Export via ffmpeg (server-side render job via Inngest)

### 8.2 — Reframe for Platforms (SmartVideoCropper migration)
- Presets: 9:16 (Reels/TikTok/Shorts), 1:1 (Square), 4:5 (Portrait), 16:9 (Landscape)
- Drag to reposition subject in frame
- Background fill color
- Server-side render (ffmpeg crop filter)

### 8.3 — Caption Studio (VideoPolisher migration)
- Auto-captions from Sarvam transcript (already have it!)
- Styles: hormozi (yellow/black), modern, neon, minimal
- Emoji enrichment per caption segment
- Draggable caption box positioning
- Manual caption editing
- Burn-in via ffmpeg drawtext filter (server-side)

---

## Phase 9 — OpusClip Competitor Features

### 9.1 — Viral Score
- Rate each AI-selected highlight clip 0-100
- Signals: hook strength (first 3s), speaker energy, keyword density, pacing
- Display score on each clip card in UI
- Model: Sarvam-30B / Gemini prompt with scoring rubric

### 9.2 — Clip Queue
- One long video → multiple clip candidates
- User reviews, approves or rejects each
- Batch process approved clips (parallel Inngest jobs)
- Clips table in DB: id, project_id, start_sec, end_sec, score, status, export_url

### 9.3 — Direct Publish
- Connect TikTok, YouTube, Instagram accounts via OAuth
- Schedule or publish immediately
- Track publish status per clip
- publishers table: id, user_id, platform, access_token, channel_name

### 9.4 — Brand Kit
- Upload logo, set brand colors, choose default caption font
- Intro/outro video clips
- Applied automatically to all exports
- brand_kits table per user

### 9.5 — Subject Tracking for Reframe
- Face/speaker detection using ffmpeg + OpenCV or Replicate
- Auto-pan to keep active speaker centered in 9:16 frame
- Manual override to lock on specific subject

---

## Phase 10 — Indian Language Edge (Differentiation)

### 10.1 — Multi-language Captions
- Show captions in original language (Telugu/Hindi/Tamil etc.)
- Side-by-side translation using Sarvam Translate API
- Export dual-language captions (source + English)

### 10.2 — Code-Mix Mode
- Handle Telugu-English mixed speech properly
- Sarvam Saaras v3 codemix mode already supports this
- Surface as a toggle option in project settings

### 10.3 — Voice-Over Translation (Dubbing)
- Translate transcript to target language
- Sarvam Bulbul v3 TTS to generate dubbed audio
- Merge dubbed audio with video (ffmpeg)
- Pricing: ₹30/10K chars (Bulbul v3)

### 10.4 — Regional Platform Publishing
- Moj, Josh, ShareChat OAuth integration
- India-first creator workflow

---

## Phase 11 — Billing (India-first pricing)

```
Free     — 30 min/month audio, watermarked clips
Creator  — 5hr/month, ₹499/mo (~$6) or $9/mo globally  
Pro      — 20hr/month, ₹999/mo (~$12) or $19/mo globally
Team     — Unlimited, ₹1999/mo (~$24) or $39/mo globally
```

- Stripe for global, Razorpay for India
- Usage tracked in usage_logs table
- Enforcement middleware on all processing routes
- Credits system: 1 credit = 1 min of processed audio

---

## Phase 12 — API & Integrations

- REST API: POST /api/v1/clip (submit YouTube URL or video, get clips back)
- Webhook callbacks on job completion
- API key management in dashboard
- Zapier / Make integration
- Postman collection + docs

