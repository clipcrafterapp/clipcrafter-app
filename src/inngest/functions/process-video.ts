import os from "os";
import path from "path";
import fs from "fs/promises";
import ffmpeg from "fluent-ffmpeg";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { r2Client, R2_BUCKET } from "@/lib/r2";
import { transcribeAudio } from "@/lib/groq";
import { generateHighlights } from "@/lib/gemini";

async function updateProjectStatus(
  projectId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await supabaseAdmin.from("projects").update(fields).eq("id", projectId);
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

function extractAudioFromVideo(videoPath: string, audioPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .output(audioPath)
      .audioCodec("libmp3lame")
      .noVideo()
      .on("end", () => resolve())
      .on("error", (err: Error) => reject(err))
      .run();
  });
}

export interface ProcessVideoEventData {
  projectId: string;
  r2Key: string;
  userId: string;
}

export interface ProcessVideoStep {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>;
}

export async function processVideoHandler(
  event: { data: ProcessVideoEventData },
  step: ProcessVideoStep
): Promise<Record<string, unknown>> {
  const { projectId, r2Key } = event.data;

  const uniqueSuffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const videoPath = path.join(os.tmpdir(), `video-${uniqueSuffix}.mp4`);
  const audioPath = path.join(os.tmpdir(), `audio-${uniqueSuffix}.mp3`);

  let transcriptId: string | undefined;
  let highlightId: string | undefined;

  try {
    // Step 1 — download-from-r2
    await step.run("download-from-r2", async () => {
      await updateProjectStatus(projectId, { status: "processing" });
      const buffer = await downloadR2Object(r2Key);
      await fs.writeFile(videoPath, buffer);
    });

    // Step 2 — extract-audio
    await step.run("extract-audio", async () => {
      await updateProjectStatus(projectId, { status: "extracting_audio" });
      await extractAudioFromVideo(videoPath, audioPath);
    });

    // Step 3 — transcribe
    const transcript = await step.run("transcribe", async () => {
      await updateProjectStatus(projectId, { status: "transcribing" });
      const result = await transcribeAudio(audioPath);

      const { data } = await supabaseAdmin
        .from("transcripts")
        .insert({ project_id: projectId, segments: result.segments })
        .select()
        .single();

      transcriptId = (data as { id: string } | null)?.id;
      return result;
    });

    // Step 4 — generate-highlights
    await step.run("generate-highlights", async () => {
      await updateProjectStatus(projectId, { status: "generating_highlights" });
      const highlights = await generateHighlights(
        (transcript as { text: string }).text
      );

      const { data } = await supabaseAdmin
        .from("highlights")
        .insert({ project_id: projectId, segments: highlights })
        .select()
        .single();

      highlightId = (data as { id: string } | null)?.id;
    });

    // Step 5 — finalize
    await step.run("finalize", async () => {
      await fs.unlink(videoPath).catch(() => undefined);
      await fs.unlink(audioPath).catch(() => undefined);
      await updateProjectStatus(projectId, {
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    });

    return { projectId, status: "completed", transcriptId, highlightId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await supabaseAdmin
      .from("projects")
      .update({ status: "failed", error_message: errorMessage })
      .eq("id", projectId);
    return { projectId, status: "failed", error: errorMessage };
  }
}

export const processVideo = inngest.createFunction(
  { id: "process-video", retries: 3 },
  { event: "video/process" },
  async ({ event, step }) => processVideoHandler(event, step)
);
