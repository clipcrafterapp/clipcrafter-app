/**
 * Transcription provider abstraction.
 * 
 * TRANSCRIPTION_PROVIDER env var controls which backend is used:
 *   "modal" → faster-whisper on Modal GPU (unlimited, ~30x cheaper)
 *   "groq"  → Groq Whisper API (default, works out of the box)
 * 
 * Modal endpoint URL set via MODAL_TRANSCRIBE_URL env var.
 */

import { transcribeAudio as groqTranscribeAudio, TranscriptResult } from "@/lib/groq";

const PROVIDER = process.env.TRANSCRIPTION_PROVIDER ?? "groq";
const MODAL_URL = process.env.MODAL_TRANSCRIBE_URL ?? "";

/**
 * Transcribe audio file at the given local path.
 * Routes to Modal or Groq based on TRANSCRIPTION_PROVIDER env var.
 */
export async function transcribeAudio(audioPath: string): Promise<TranscriptResult> {
  if (PROVIDER === "modal") {
    return transcribeWithModal(audioPath);
  }
  return groqTranscribeAudio(audioPath);
}

async function transcribeWithModal(audioPath: string): Promise<TranscriptResult> {
  if (!MODAL_URL) {
    throw new Error(
      "MODAL_TRANSCRIBE_URL is not set. Deploy the Modal app first: modal deploy modal/transcribe.py"
    );
  }

  // Modal endpoint expects a URL — upload to R2 first then send the URL,
  // OR send as base64 for smaller files
  const fs = await import("fs");
  const stats = fs.statSync(audioPath);
  const MAX_BASE64_BYTES = 10 * 1024 * 1024; // 10MB — send larger files via R2 URL

  let audioUrl: string;

  if (stats.size <= MAX_BASE64_BYTES) {
    // Small file: encode as base64 data URI
    const data = fs.readFileSync(audioPath);
    audioUrl = `data:audio/mpeg;base64,${data.toString("base64")}`;
  } else {
    // Large file: upload to R2 and send public URL
    audioUrl = await uploadToR2ForModal(audioPath);
  }

  const res = await fetch(MODAL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      model_size: process.env.WHISPER_MODEL_SIZE ?? "large-v3",
    }),
    signal: AbortSignal.timeout(600_000), // 10 min timeout
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Modal transcription failed (${res.status}): ${err}`);
  }

  const result = await res.json() as {
    text: string;
    segments: Array<{ id: number; start: number; end: number; text: string }>;
    language: string;
    duration: number;
    elapsed_sec: number;
    realtime_factor: number;
    model: string;
  };

  console.log(
    `Modal transcription: ${result.duration}s audio → ${result.elapsed_sec}s (${result.realtime_factor}x realtime, model: ${result.model})`
  );

  return {
    text: result.text,
    segments: result.segments.map((s, i) => ({
      id: i,
      start: s.start,
      end: s.end,
      text: s.text,
    })),
  };
}

/**
 * Upload audio file to R2 with a temp key for Modal to fetch.
 * Returns a presigned GET URL valid for 1 hour.
 */
async function uploadToR2ForModal(audioPath: string): Promise<string> {
  const { r2Client, R2_BUCKET } = await import("@/lib/r2");
  const { PutObjectCommand, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
  const fs = await import("fs");
  const path = await import("path");

  const key = `modal-tmp/${Date.now()}-${path.basename(audioPath)}`;
  const fileBuffer = fs.readFileSync(audioPath);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: "audio/mpeg",
    })
  );

  // Generate presigned GET URL (1 hour)
  const getCommand = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  const url = await getSignedUrl(r2Client, getCommand, { expiresIn: 3600 });

  console.log(`Uploaded ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB to R2 for Modal`);
  return url;
}
