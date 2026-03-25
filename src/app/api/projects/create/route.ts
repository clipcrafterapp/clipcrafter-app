import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

/**
 * Normalize a YouTube URL to a canonical video ID form: https://www.youtube.com/watch?v=ID
 * This ensures youtu.be/ID, youtube.com/live/ID, /shorts/, and full watch URLs all
 * map to the same stored key for deduplication purposes.
 */
function normalizeYouTubeUrl(url: string): string {
  const match = url.match(/(?:v=|youtu\.be\/|\/live\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match) return `https://www.youtube.com/watch?v=${match[1]}`;
  return url; // fallback: store as-is
}

function validateCreateBody(body: unknown): {
  error: string | null;
  title: string;
  type: string;
  youtubeUrl?: string;
} {
  const { title, type, youtubeUrl } = body as {
    title?: string;
    type?: string;
    youtubeUrl?: string;
  };
  if (!title || typeof title !== "string" || title.trim() === "") {
    return { error: "title is required", title: "", type: "" };
  }
  if (type !== "upload" && type !== "youtube") {
    return { error: 'type must be "upload" or "youtube"', title: "", type: "" };
  }
  if (type === "youtube" && !youtubeUrl) {
    return { error: "youtubeUrl is required for type=youtube", title: "", type: "" };
  }
  return { error: null, title: title.trim(), type, youtubeUrl };
}

async function findReusableYouTubeAssets(
  normalizedUrl: string,
  supabaseUserId: string
): Promise<{ audioKey: string | null; transcriptSegments: unknown | null }> {
  const { data: source } = await supabaseAdmin
    .from("projects")
    .select("id, audio_key")
    .eq("user_id", supabaseUserId)
    .eq("r2_key", normalizedUrl)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!source?.audio_key) return { audioKey: null, transcriptSegments: null };

  const { data: transcript } = await supabaseAdmin
    .from("transcripts")
    .select("segments")
    .eq("project_id", source.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return {
    audioKey: source.audio_key,
    transcriptSegments: transcript ? transcript.segments : null,
  };
}

async function resolveYouTubeAssets(
  type: string,
  youtubeUrl: string | undefined,
  supabaseUserId: string
): Promise<{
  normalizedUrl: string | undefined;
  audioKey: string | null;
  transcriptSegments: unknown | null;
}> {
  if (type !== "youtube" || !youtubeUrl) {
    return { normalizedUrl: undefined, audioKey: null, transcriptSegments: null };
  }
  const normalizedUrl = normalizeYouTubeUrl(youtubeUrl.trim());
  const { audioKey, transcriptSegments } = await findReusableYouTubeAssets(
    normalizedUrl,
    supabaseUserId
  );
  return { normalizedUrl, audioKey, transcriptSegments };
}

async function copyTranscriptIfReused(projectId: string, segments: unknown | null): Promise<void> {
  if (!segments) return;
  await supabaseAdmin.from("transcripts").insert({ project_id: projectId, segments });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { error: validationError, title, type, youtubeUrl } = validateCreateBody(body);
  if (validationError) {
    return Response.json({ error: validationError }, { status: 400 });
  }

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) {
    return Response.json({ error: "Failed to resolve user" }, { status: 500 });
  }

  // ── YouTube asset reuse ──
  // If the user already has a *completed* project for this URL, reuse its audio + transcript.
  // A new project is always created (user may want different clip selections), but we skip
  // re-downloading and re-transcribing by copying the existing audio_key + transcript segments
  // and setting status="transcribed" so the Inngest job jumps straight to highlight generation.
  const {
    normalizedUrl,
    audioKey: reusedAudioKey,
    transcriptSegments: reusedTranscriptSegments,
  } = await resolveYouTubeAssets(type, youtubeUrl, supabaseUserId);

  const { data, error } = await supabaseAdmin
    .from("projects")
    .insert({
      user_id: supabaseUserId,
      title: title.trim(),
      type,
      status: reusedTranscriptSegments ? "transcribed" : "pending",
      ...(normalizedUrl ? { r2_key: normalizedUrl } : {}),
      ...(reusedAudioKey ? { audio_key: reusedAudioKey } : {}),
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  await copyTranscriptIfReused(data.id, reusedTranscriptSegments);

  return Response.json(
    {
      id: data.id,
      title: data.title,
      status: data.status,
      created_at: data.created_at,
      reused_assets: !!reusedTranscriptSegments,
    },
    { status: 201 }
  );
}
