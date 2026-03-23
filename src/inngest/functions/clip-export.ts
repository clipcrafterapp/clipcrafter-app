import os from "os";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import type { Caption } from "@remotion/captions";

const execFileAsync = promisify(execFile);

export interface ClipExportEventData {
  clipId: string;
  projectId: string;
  userId: string;
  withCaptions?: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function isYouTubeUrl(str: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(str);
}

async function downloadR2Object(r2Key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2Key });
  const response = await r2Client.send(command);
  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function downloadYouTubeVideo(url: string, outputPath: string): Promise<void> {
  await execFileAsync("yt-dlp", [
    "--format", "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
    "--merge-output-format", "mp4",
    "--output", outputPath,
    "--no-playlist",
    "--extractor-args", "youtube:player_client=web,android",
    "--socket-timeout", "30",
    url,
  ], { timeout: 5 * 60 * 1000 });
}

interface Segment {
  start: number;
  end: number;
  text: string;
}

function stripSpeakerTag(text: string): string {
  return text.replace(/^\[Speaker \d+\]\s*/, "");
}

/** Convert transcript segments → Remotion Caption format */
function toCaptions(segments: Segment[], clipStart: number, clipEnd: number): Caption[] {
  return segments
    .filter(s => s.end > clipStart && s.start < clipEnd)
    .map(s => ({
      text: stripSpeakerTag(s.text),
      startMs: s.start * 1000,
      endMs: s.end * 1000,
      timestampMs: s.start * 1000,
      confidence: 1,
    }));
}

/** Render clip with Remotion (captions as React JSX, no drawtext needed) */
async function renderWithRemotion(opts: {
  videoSrc: string;
  startSec: number;
  endSec: number;
  captions: Caption[];
  captionStyle: string;
  withCaptions: boolean;
  outputPath: string;
}): Promise<void> {
  // Dynamic import — keeps this out of the Next.js bundle
  const { bundle } = await import("@remotion/bundler");
  const { renderMedia, selectComposition } = await import("@remotion/renderer");

  const entryPoint = path.resolve(process.cwd(), "src/remotion/index.ts");
  const bundled = await bundle({ entryPoint, enableCaching: true });

  const inputProps = {
    videoSrc: opts.videoSrc,
    startSec: opts.startSec,
    endSec: opts.endSec,
    captions: opts.captions,
    captionStyle: opts.captionStyle,
    withCaptions: opts.withCaptions,
  };

  const composition = await selectComposition({
    serveUrl: bundled,
    id: "ClipComposition",
    inputProps,
  });

  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: "h264",
    outputLocation: opts.outputPath,
    inputProps,
    concurrency: 2,
    onProgress: ({ progress }) => {
      console.log(`[remotion] rendering ${(progress * 100).toFixed(0)}%`);
    },
  });
}

// ── main handler ──────────────────────────────────────────────────────────────

export async function clipExportHandler(
  event: { data: ClipExportEventData },
  step: { run: (id: string, fn: () => Promise<unknown>) => Promise<unknown> }
): Promise<Record<string, unknown>> {
  const { clipId, projectId, withCaptions = false } = event.data;

  const sourcePath = path.join(os.tmpdir(), `clipcrafter-export-${clipId}-source.mp4`);
  const outputPath = path.join(os.tmpdir(), `clipcrafter-export-${clipId}.mp4`);

  try {
    // Step 1 — fetch clip, project, and transcript segments
    const { clip, segments, r2Key } = await step.run("fetch-clip-and-project", async () => {
      const { data: clipData, error: clipError } = await supabaseAdmin
        .from("clips")
        .select("id, start_sec, end_sec, caption_style, aspect_ratio, project_id")
        .eq("id", clipId)
        .single();

      if (clipError || !clipData) throw new Error(`Clip ${clipId} not found`);

      const { data: projectData, error: projError } = await supabaseAdmin
        .from("projects")
        .select("r2_key, audio_key")
        .eq("id", projectId)
        .single();

      if (projError || !projectData) throw new Error(`Project ${projectId} not found`);
      if (!projectData.r2_key) throw new Error(`Project ${projectId} has no r2_key`);

      // Fetch transcript segments in the clip range
      const { data: transcriptData } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      const allSegments: Segment[] = Array.isArray(transcriptData?.segments)
        ? transcriptData.segments as Segment[]
        : [];

      const clipSegments = allSegments.filter(
        s => s.end > clipData.start_sec && s.start < clipData.end_sec
      );

      return {
        clip: clipData as { id: string; start_sec: number; end_sec: number; caption_style: string; aspect_ratio: string; project_id: string },
        segments: clipSegments,
        r2Key: projectData.r2_key as string,
      };
    }) as { clip: { id: string; start_sec: number; end_sec: number; caption_style: string; aspect_ratio: string; project_id: string }; segments: Segment[]; r2Key: string };

    // Step 2 — download source video
    await step.run("download-video", async () => {
      if (isYouTubeUrl(r2Key)) {
        await downloadYouTubeVideo(r2Key, sourcePath);
      } else {
        const buffer = await downloadR2Object(r2Key);
        await fs.writeFile(sourcePath, buffer);
      }
    });

    // Step 3 — render with Remotion (captions as React JSX, no drawtext needed)
    await step.run("trim-and-render", async () => {
      const captions = withCaptions
        ? toCaptions(segments, clip.start_sec, clip.end_sec)
        : [];

      await renderWithRemotion({
        videoSrc: sourcePath,      // local file path
        startSec: clip.start_sec,
        endSec: clip.end_sec,
        captions,
        captionStyle: clip.caption_style,
        withCaptions,
        outputPath,
      });
    });

    // Step 4 — upload to R2 and generate presigned URL
    const exportUrl = await step.run("upload-to-r2", async () => {
      const outputBuffer = await fs.readFile(outputPath);
      const exportKey = `exports/${projectId}/${clipId}.mp4`;

      await r2Client.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: exportKey,
        Body: outputBuffer,
        ContentType: "video/mp4",
      }));

      const presignedUrl = await getSignedUrl(
        r2Client,
        new GetObjectCommand({ Bucket: R2_BUCKET, Key: exportKey }),
        { expiresIn: 7 * 24 * 3600 } // 1 week
      );

      await supabaseAdmin
        .from("clips")
        .update({ status: "exported", export_url: presignedUrl })
        .eq("id", clipId);

      return presignedUrl;
    }) as string;

    // Step 5 — cleanup temp files
    await step.run("cleanup", async () => {
      await Promise.allSettled([
        fs.unlink(sourcePath),
        fs.unlink(outputPath),
      ]);
    });

    return { clipId, projectId, status: "exported", exportUrl };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("clips")
      .update({ status: "pending" })
      .eq("id", clipId);

    // Best-effort cleanup
    await Promise.allSettled([
      fs.unlink(sourcePath).catch(() => undefined),
      fs.unlink(outputPath).catch(() => undefined),
    ]);

    return { clipId, status: "failed", error: errorMessage };
  }
}

export const clipExport = inngest.createFunction(
  { id: "clip-export", retries: 2 },
  { event: "clipcrafter/clip.export" },
  async ({ event, step }) => clipExportHandler(event as { data: ClipExportEventData }, step)
);
