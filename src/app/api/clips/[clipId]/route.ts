/**
 * PATCH /api/clips/[clipId] — update status, caption_style, or aspect_ratio
 */
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getSupabaseUserId } from "@/lib/user";

const VALID_STATUSES = ["pending", "approved", "rejected", "exporting", "exported"] as const;
const VALID_CAPTION_STYLES = ["hormozi", "modern", "neon", "minimal"] as const;
const VALID_ASPECT_RATIOS = ["9:16", "1:1", "16:9"] as const;

function applyEnumUpdate<T extends string>(
  body: Record<string, unknown>,
  key: string,
  validValues: readonly T[],
  updates: Record<string, unknown>
): string | null {
  if (!(key in body)) return null;
  if (!validValues.includes(body[key] as T)) {
    return `Invalid ${key}. Must be one of: ${validValues.join(", ")}`;
  }
  updates[key] = body[key];
  return null;
}

function applyNumericUpdate(
  body: Record<string, unknown>,
  key: string,
  updates: Record<string, unknown>
): string | null {
  if (!(key in body)) return null;
  const v = Number(body[key]);
  if (!Number.isFinite(v) || v < 0) return `Invalid ${key}`;
  updates[key] = v;
  return null;
}

function buildClipUpdates(body: Record<string, unknown>): {
  updates: Record<string, unknown>;
  error: string | null;
} {
  const updates: Record<string, unknown> = {};
  const errors = [
    applyEnumUpdate(body, "status", VALID_STATUSES, updates),
    applyEnumUpdate(body, "caption_style", VALID_CAPTION_STYLES, updates),
    applyEnumUpdate(body, "aspect_ratio", VALID_ASPECT_RATIOS, updates),
    applyNumericUpdate(body, "start_sec", updates),
    applyNumericUpdate(body, "end_sec", updates),
  ].filter(Boolean);
  return { updates, error: errors[0] ?? null };
}

async function authorizeClipAccess(
  clipId: string,
  supabaseUserId: string
): Promise<{ clip: Record<string, unknown> | null; error: Response | null }> {
  const { data: clip, error } = await supabaseAdmin
    .from("clips")
    .select("id, project_id, status, caption_style, aspect_ratio, projects(user_id)")
    .eq("id", clipId)
    .single();

  if (error || !clip)
    return { clip: null, error: Response.json({ error: "Clip not found" }, { status: 404 }) };

  type ClipRow = typeof clip & { projects: { user_id: string } | null };
  const typedClip = clip as ClipRow;
  if (typedClip.projects?.user_id !== supabaseUserId) {
    return { clip: null, error: Response.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { clip, error: null };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ clipId: string }> }) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseUserId = await getSupabaseUserId(userId);
  if (!supabaseUserId) return Response.json({ error: "Failed to resolve user" }, { status: 500 });

  const { clipId } = await params;

  const { error: authError } = await authorizeClipAccess(clipId, supabaseUserId);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { updates, error: buildError } = buildClipUpdates(body);
  if (buildError) return Response.json({ error: buildError }, { status: 400 });
  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }
  const { data: updated, error: updateError } = await supabaseAdmin
    .from("clips")
    .update(updates)
    .eq("id", clipId)
    .select()
    .single();
  if (updateError) return Response.json({ error: updateError.message }, { status: 500 });
  return Response.json({ clip: updated }, { status: 200 });
}
