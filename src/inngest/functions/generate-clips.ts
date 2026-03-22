/**
 * Inngest function: generate clips for a project
 * Triggered by: clips/generate event
 * Visible in Inngest dashboard, handles long Gemini calls without API timeout
 */
import { inngest } from "@/lib/inngest";
import { supabaseAdmin } from "@/lib/supabase";
import { generateHighlights, formatSegmentsForHighlights, buildTopicMap } from "@/lib/highlights";

export interface GenerateClipsEventData {
  projectId: string;
  userId: string;
  count?: number;       // undefined = auto
  prompt?: string;
  targetDuration?: number;
}

export const generateClips = inngest.createFunction(
  { id: "generate-clips", retries: 2, timeouts: { finish: "10m" } },
  { event: "clips/generate" },
  async ({ event, step }) => {
    const { projectId, count, prompt, targetDuration } = event.data as GenerateClipsEventData;

    // Mark project clips as generating
    await step.run("mark-generating", async () => {
      await supabaseAdmin
        .from("projects")
        .update({ clips_status: "generating" })
        .eq("id", projectId);
    });

    // Fetch transcript
    const transcript = await step.run("fetch-transcript", async () => {
      const { data } = await supabaseAdmin
        .from("transcripts")
        .select("segments")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (!data?.segments?.length) throw new Error("No transcript found");
      return data.segments as Array<{ start: number; end: number; text: string }>;
    });

    const formatted = formatSegmentsForHighlights(transcript);
    const isAuto = !count && !prompt;

    // Build topic map (auto mode) or generate manual highlights
    const highlights = await step.run("generate-highlights", async () => {
      const opts = count || prompt || targetDuration
        ? { count, prompt, targetDuration }
        : undefined;
      return generateHighlights(formatted, transcript, opts);
    });

    // Build full topic map for the filter UI (auto mode only)
    let topicMap = null;
    if (isAuto) {
      topicMap = await step.run("build-topic-map", async () => {
        try {
          return await buildTopicMap(formatted, transcript);
        } catch (err) {
          console.warn("Topic map failed, skipping:", err);
          return null;
        }
      });
    }

    // Save clips to DB
    await step.run("save-clips", async () => {
      // Clear existing clips
      await supabaseAdmin.from("clips").delete().eq("project_id", projectId);

      if (highlights.length === 0) {
        await supabaseAdmin
          .from("projects")
          .update({ clips_status: "failed", topic_map: null })
          .eq("id", projectId);
        return;
      }

      const insertPayload = highlights.map(h => ({
        project_id: projectId,
        title: h.clip_title || h.text.slice(0, 60),
        start_sec: h.start,
        end_sec: h.end,
        score: h.score ?? 50,
        score_reason: h.score_reason ?? null,
        hashtags: h.hashtags ?? [],
        clip_title: h.clip_title || null,
        topic: h.topic ?? null,
        status: "pending",
        caption_style: "hormozi",
        aspect_ratio: "9:16",
      }));

      await supabaseAdmin.from("clips").insert(insertPayload);

      // Store topic map on the project for the filter UI
      await supabaseAdmin
        .from("projects")
        .update({ clips_status: "done", topic_map: topicMap })
        .eq("id", projectId);
    });

    return { projectId, clipCount: highlights.length, topicCount: topicMap?.length ?? 0 };
  }
);
