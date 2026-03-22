# Clip Export — Build Task

## What to build

### 1. UI — Multi-select clips + Export button

In `src/app/dashboard/projects/[id]/page.tsx`:

**Per clip card:** add a checkbox top-right. Default: ALL clips selected. Clicking checkbox toggles selection (does not navigate to clip).

**Above clips list (sticky bar when any clip selected):**
```
[☑ Select All]   [Caption: ON toggle]   [Export 5 clips ▶]
```
- Select All checkbox: checked when all selected, indeterminate when some
- Caption toggle: ON by default (green pill when on, gray when off)
- Export button: "Export N clips" where N = selected count. Disabled when 0 selected or any clip is already exporting.

**State to add:**
```typescript
const [selectedClipIds, setSelectedClipIds] = useState<Set<string>>(new Set())
const [withCaptions, setWithCaptions] = useState(true)
```

When clips load, auto-select all:
```typescript
// when clips array changes, select all by default
useEffect(() => {
  if (clips && clips.length > 0) {
    setSelectedClipIds(new Set(clips.map(c => c.id)))
  }
}, [clips?.length])
```

**Export button handler:** POST to `/api/projects/[id]/clips/export-batch` with `{ clipIds: [...selectedClipIds], withCaptions }`. On response, update clip statuses to "exporting".

**Clip card with export status:**
- "exporting": show spinner + "Exporting…"
- "exported": show green "↓ Download" link (href = clip.export_url)
- Keep existing Keep/Skip/style/ratio controls

---

### 2. Batch Export API

Create `src/app/api/projects/[id]/clips/export-batch/route.ts`:

```typescript
POST body: { clipIds: string[], withCaptions: boolean }
```

- Auth check (same pattern as other routes)
- Validate all clipIds belong to this project
- Update all clips to status="exporting"
- Send one Inngest event per clip: `clipcrafter/clip.export` with data: `{ clipId, projectId, userId, withCaptions }`
- Return 202 `{ queued: clipIds.length }`

---

### 3. Inngest clip-export function — REAL implementation

Rewrite `src/inngest/functions/clip-export.ts` to actually export:

```
Step 1: fetch-clip-and-project
  - Get clip: id, start_sec, end_sec, caption_style, aspect_ratio, project_id
  - Get project: r2_key, audio_key (to find video path)
  - Get transcript segments filtered to [start_sec, end_sec] range

Step 2: download-video
  - Download video from R2 using the project's video key
  - For uploaded files: r2_key is already the R2 key (e.g. "videos/uuid/video.mp4" or original upload path)
  - For YouTube (old): r2_key is a YouTube URL — download with yt-dlp  
  - For YouTube (new after our fix): r2_key is "videos/uuid/video.mp4"
  - Write to: /tmp/clipcrafter-export-{clipId}-source.mp4

Step 3: trim-and-render
  Use ffmpeg to:
  a. Trim: -ss {start_sec} -to {end_sec}
  b. If withCaptions=true AND transcript segments exist: burn in captions
  c. Output: /tmp/clipcrafter-export-{clipId}.mp4

  Caption burning approach — generate SRT first, then use ffmpeg subtitles filter:
  - Generate SRT file from transcript segments (offset by -start_sec so clip starts at 0)
  - SRT path: /tmp/clipcrafter-export-{clipId}.srt
  - Apply with ffmpeg subtitles filter + force_style per caption_style:
    - hormozi: FontSize=28,PrimaryColour=&H0000FFFF,BackColour=&H00000000,Bold=1,BorderStyle=4,Shadow=0,Outline=0
      (Yellow bold text, black opaque background box)
    - modern: FontSize=24,PrimaryColour=&HWFFFFFF,BackColour=&H66000000,Bold=0
    - neon: FontSize=24,PrimaryColour=&H0000FF00,Outline=2,OutlineColour=&H0000FF00
    - minimal: FontSize=22,PrimaryColour=&HWFFFFFF,BackColour=&H00000000,BorderStyle=0
  
  ffmpeg command:
  ```
  ffmpeg -i source.mp4 -ss {start} -to {end} 
    [-vf subtitles={srt_path}:force_style='{style}']  <- if captions
    -c:v libx264 -crf 23 -preset fast -c:a aac -movflags +faststart
    output.mp4
  ```
  Note: use -ss before -i for fast seek, but use -ss AFTER -i for accurate seek (needed for captions sync).
  For captions, use accurate seek: `ffmpeg -i source.mp4 -ss {start} -t {duration} -vf subtitles=...`

Step 4: upload-to-r2
  - Read output file
  - Upload to R2 key: `exports/{projectId}/{clipId}.mp4`
  - Generate presigned URL (1 week expiry)
  - Update clip: status="exported", export_url=presignedUrl

Step 5: cleanup
  - Delete temp files (source + output + srt)
```

**SRT generation helper:**
```typescript
function generateSRT(
  segments: Array<{ start: number; end: number; text: string }>,
  clipStart: number,
  clipEnd: number
): string {
  // Filter segments to clip range, offset timestamps
  const relevant = segments.filter(s => s.end > clipStart && s.start < clipEnd)
  return relevant.map((seg, i) => {
    const start = Math.max(0, seg.start - clipStart)
    const end = Math.min(clipEnd - clipStart, seg.end - clipStart)
    return `${i + 1}\n${formatSRTTime(start)} --> ${formatSRTTime(end)}\n${stripSpeakerTag(seg.text)}\n`
  }).join('\n')
}

function formatSRTTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')},${ms.toString().padStart(3,'0')}`
}

function stripSpeakerTag(text: string): string {
  return text.replace(/^\[Speaker \d+\]\s*/, '')
}
```

**Event data interface:**
```typescript
export interface ClipExportEventData {
  clipId: string
  projectId: string
  userId: string
  withCaptions?: boolean  // NEW
}
```

---

## Files to create/edit:

1. `src/app/dashboard/projects/[id]/page.tsx` — checkbox per clip, export bar, Download link
2. `src/app/api/projects/[id]/clips/export-batch/route.ts` — NEW batch trigger
3. `src/inngest/functions/clip-export.ts` — real ffmpeg implementation
4. `src/app/api/clips/[clipId]/export/route.ts` — add withCaptions to event data

## Key packages already available:
- `fluent-ffmpeg` — already used in process-video.ts
- `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` — already used
- `fs/promises` — use for temp file ops

## Notes:
- Use `execFileAsync(ffmpegPath, [...args])` pattern from process-video.ts for ffmpeg
- OR use fluent-ffmpeg — your choice, but be consistent
- The SRT `force_style` approach requires libass support in ffmpeg — test with `ffmpeg -filters | grep subtitles`
- If subtitles filter fails, fallback: burn text with drawtext filter per segment (less elegant but always works)
- Add `ffmpeg-static` or use system ffmpeg (check with `which ffmpeg`)

## Commit when done:
`feat(export): multi-select clips, batch export with optional caption burn-in`

When done: `openclaw system event --text "Done: clip export with captions implemented" --mode now`
